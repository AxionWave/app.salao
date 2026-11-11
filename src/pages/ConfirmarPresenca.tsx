import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Alert, Button } from '@/components/ui';
import { mensagemErroHttp } from '@/exceptions';
import { notificacaoService, type AgendamentoPublico } from '@/services/notificacao.service';

function formatar(iso: string, fuso: string, opcoes: Intl.DateTimeFormatOptions): string {
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: fuso,
            ...opcoes,
        }).format(new Date(iso));
    } catch {
        return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(iso));
    }
}

const SITUACAO: Record<string, string> = {
    confirmado: 'Presença confirmada. Até lá!',
    cancelado: 'Este horário foi cancelado.',
    em_atendimento: 'Este atendimento já começou.',
    concluido: 'Este atendimento já foi concluído.',
    no_show: 'Este horário já passou.',
};

/** Aberta pelo link do e-mail, sem login: mostra o horário e deixa o cliente confirmar presença. */
export default function ConfirmarPresencaPage() {
    const { token = '' } = useParams();
    const [dados, setDados] = useState<AgendamentoPublico | null>(null);
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(true);
    const [confirmando, setConfirmando] = useState(false);

    useEffect(() => {
        let vivo = true;
        notificacaoService
            .verPublico(token)
            .then((d) => vivo && setDados(d))
            .catch((e) => {
                if (!vivo) return;
                setErro(
                    axios.isAxiosError(e) && e.response?.status === 404
                        ? 'Este link não é válido. Confira se ele foi copiado inteiro do e-mail.'
                        : mensagemErroHttp(e),
                );
            })
            .finally(() => vivo && setCarregando(false));
        return () => {
            vivo = false;
        };
    }, [token]);

    const confirmar = async () => {
        setConfirmando(true);
        setErro('');
        try {
            setDados(await notificacaoService.confirmarPublico(token));
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setConfirmando(false);
        }
    };

    const situacao =
        dados && !dados.podeConfirmar
            ? (SITUACAO[dados.status] ?? (new Date(dados.inicio) < new Date() ? 'Este horário já passou.' : null))
            : null;

    return (
        <div
            className="flex min-h-[100dvh] items-center justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[calc(2.5rem+var(--lyra-safe-top))]"
            style={{ background: 'var(--lyra-bg)', color: 'var(--lyra-text)' }}
        >
            <div
                className="lyra-rise w-full max-w-md rounded-lyra border p-6 sm:p-8"
                style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
            >
                {carregando && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando seu horário…
                    </p>
                )}

                {!carregando && !dados && erro && <Alert titulo="Link inválido">{erro}</Alert>}

                {dados && (
                    <div className="flex flex-col gap-5">
                        <div>
                            <p
                                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                                style={{ color: 'var(--copper)' }}
                            >
                                {dados.empresa}
                            </p>
                            <h1 className="mt-1 font-display text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
                                Olá, {dados.cliente}!
                            </h1>
                        </div>

                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                            <dt style={{ color: 'var(--muted-foreground)' }}>Quando</dt>
                            <dd className="first-letter:uppercase" style={{ color: 'var(--ink)' }}>
                                {formatar(dados.inicio, dados.fuso, {
                                    weekday: 'long',
                                    day: '2-digit',
                                    month: 'long',
                                })}{' '}
                                às{' '}
                                {formatar(dados.inicio, dados.fuso, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </dd>
                            {dados.servicos.length > 0 && (
                                <>
                                    <dt style={{ color: 'var(--muted-foreground)' }}>Serviço</dt>
                                    <dd style={{ color: 'var(--ink)' }}>{dados.servicos.join(', ')}</dd>
                                </>
                            )}
                            <dt style={{ color: 'var(--muted-foreground)' }}>Com</dt>
                            <dd style={{ color: 'var(--ink)' }}>{dados.profissional}</dd>
                            {dados.endereco && (
                                <>
                                    <dt style={{ color: 'var(--muted-foreground)' }}>Onde</dt>
                                    <dd style={{ color: 'var(--ink)' }}>{dados.endereco}</dd>
                                </>
                            )}
                        </dl>

                        {erro && <Alert titulo="Não deu para confirmar">{erro}</Alert>}

                        {dados.podeConfirmar ? (
                            <Button onClick={() => void confirmar()} disabled={confirmando}>
                                {confirmando ? 'Confirmando…' : 'Confirmar presença'}
                            </Button>
                        ) : (
                            situacao && (
                                <p
                                    className="rounded-lyra px-4 py-3 text-sm font-medium"
                                    style={{
                                        background: 'var(--panel2)',
                                        color: dados.status === 'confirmado' ? 'var(--ok)' : 'var(--ink)',
                                    }}
                                >
                                    {situacao}
                                </p>
                            )
                        )}

                        {dados.telefone && (
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                Precisa remarcar ou cancelar? Fale com {dados.empresa} pelo{' '}
                                <a href={`tel:${dados.telefone.replace(/[^\d+]/g, '')}`} className="underline">
                                    {dados.telefone}
                                </a>
                                .
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
