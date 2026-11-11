import { useEffect, useState } from 'react';
import { desligarPush, estadoPush, ligarPush, type EstadoPush } from '@/lib/push';

/** Rodapé do sino: liga ou desliga os avisos (Web Push) neste navegador ou celular. */
export default function AvisosNoAparelho() {
    const [estado, setEstado] = useState<EstadoPush | null>(null);
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState(false);

    useEffect(() => {
        let vivo = true;
        estadoPush()
            .then((e) => vivo && setEstado(e))
            .catch(() => vivo && setEstado('indisponivel'));
        return () => {
            vivo = false;
        };
    }, []);

    if (estado === null || estado === 'indisponivel') return null;

    const alternar = async () => {
        setOcupado(true);
        setErro(false);
        try {
            if (estado === 'ligado') {
                await desligarPush();
                setEstado('desligado');
            } else {
                setEstado(await ligarPush());
            }
        } catch {
            setErro(true);
        } finally {
            setOcupado(false);
        }
    };

    const texto = (cor: string, conteudo: string) => (
        <p className="text-xs" style={{ color: cor }}>
            {conteudo}
        </p>
    );

    return (
        <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            {estado === 'instalar' &&
                texto(
                    'var(--muted-foreground)',
                    'Para receber os avisos no iPhone com o Lyra fechado: toque em Compartilhar → Adicionar à Tela de Início e abra o Lyra pelo ícone.'
                )}
            {estado === 'bloqueado' &&
                texto(
                    'var(--muted-foreground)',
                    'As notificações do Lyra estão bloqueadas neste navegador. Libere nas permissões do site (o cadeado na barra de endereço) e volte aqui.'
                )}
            {(estado === 'ligado' || estado === 'desligado') && (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                            {estado === 'ligado' ? 'Avisos neste aparelho: ligados' : 'Receber avisos neste aparelho'}
                        </p>
                        <p className="text-[0.7rem]" style={{ color: 'var(--faint)' }}>
                            {erro ? 'Não deu certo. Tente de novo.' : 'Mesmo com o Lyra fechado.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void alternar()}
                        disabled={ocupado}
                        className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60"
                        style={
                            estado === 'ligado'
                                ? { borderColor: 'var(--line)', color: 'var(--muted-foreground)' }
                                : { borderColor: 'var(--copper)', background: 'var(--copper)', color: '#fff' }
                        }
                    >
                        {ocupado ? '…' : estado === 'ligado' ? 'Desligar' : 'Ativar'}
                    </button>
                </div>
            )}
        </div>
    );
}
