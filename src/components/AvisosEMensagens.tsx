import { useEffect, useRef, useState, type ReactNode } from 'react';
import PageCard from '@/components/layout/PageCard';
import { Alert, Button, Modal, Switch, Textarea } from '@/components/ui';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { useTermos } from '@/contexts/TermosContext';
import {
    configuracaoService,
    type AvisoEvento,
    type Avisos,
    type AvisosResposta,
    type EventoAviso,
    type ModeloAviso,
    type PreviaAviso,
    type VariavelAviso,
} from '@/services/configuracao.service';

const LEMBRETES: { horas: number; nome: string }[] = [
    { horas: 24, nome: '1 dia antes' },
    { horas: 2, nome: '2 horas antes' },
];

const MAX_ASSUNTO = 150;
const MAX_MENSAGEM = 1000;
const MAX_RECADO = 500;

function Chip({
    ligado,
    apagado = false,
    disabled,
    onClick,
    children,
}: {
    ligado: boolean;
    /** Ligado, mas sem efeito agora (ex.: o envio de e-mails está desligado). */
    apagado?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={ligado}
            disabled={disabled}
            onClick={onClick}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed"
            style={{
                ...(ligado
                    ? { borderColor: 'var(--copper)', background: 'var(--copper)', color: '#fff' }
                    : { borderColor: 'var(--line)', background: 'transparent', color: 'var(--muted-foreground)' }),
                opacity: apagado ? 0.5 : 1,
            }}
        >
            {ligado ? '✓ ' : ''}
            {children}
        </button>
    );
}

export default function AvisosEMensagens() {
    const t = useTermos();
    const [dados, setDados] = useState<AvisosResposta | null>(null);
    const [avisos, setAvisos] = useState<Avisos | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [salvoEm, setSalvoEm] = useState<Date | null>(null);
    const [editando, setEditando] = useState<EventoAviso | null>(null);

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const r = await configuracaoService.avisos();
                if (!vivo) return;
                setDados(r);
                setAvisos(r.avisos);
            } catch (e) {
                if (vivo) setErro(mensagemErroHttp(e));
            } finally {
                if (vivo) setCarregando(false);
            }
        })();
        return () => {
            vivo = false;
        };
    }, []);

    const mudar = (fn: (a: Avisos) => Avisos) => {
        setAvisos((a) => (a ? fn(a) : a));
        setSalvoEm(null);
    };

    const mudarEvento = (evento: EventoAviso, parcial: Partial<AvisoEvento>) =>
        mudar((a) => ({ ...a, eventos: a.eventos.map((e) => (e.evento === evento ? { ...e, ...parcial } : e)) }));

    const salvar = async (proximo: Avisos): Promise<string | null> => {
        setSalvando(true);
        setErro('');
        try {
            const r = await configuracaoService.salvarAvisos(proximo);
            setDados(r);
            setAvisos(r.avisos);
            setSalvoEm(new Date());
            return null;
        } catch (e) {
            const msg = mensagemErroHttp(e);
            setErro(msg);
            return msg;
        } finally {
            setSalvando(false);
        }
    };

    const clientes = t.cliente.plural.toLocaleLowerCase('pt-BR');
    const modeloEditando = dados?.modelos.find((m) => m.evento === editando) ?? null;
    const eventoEditando = avisos?.eventos.find((e) => e.evento === editando) ?? null;

    return (
        <PageCard fill={false}>
            <div className="p-5 md:p-6">
                <div className="mb-4 flex flex-col gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                        Avisos
                    </p>
                    <h2 className="font-display text-lg font-semibold">Avisos e mensagens</h2>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        O que avisar, por onde e com que texto. O sino do Lyra mostra tudo para a equipe, sempre.
                    </p>
                </div>

                {erro && !editando && (
                    <div className="mb-4">
                        <Alert titulo={tituloDeMensagem(erro)}>{erro}</Alert>
                    </div>
                )}

                {carregando && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando avisos…
                    </p>
                )}

                {!carregando && dados && avisos && (
                    <div className="flex flex-col gap-4">
                        <Switch
                            label={`Avisar ${clientes} por e-mail`}
                            descricao="Quem tiver e-mail no cadastro recebe os avisos marcados abaixo, com o convite para a agenda do celular e um botão para confirmar presença. O remetente é o nome da empresa e as respostas vão para o e-mail do cadastro dela. Todo e-mail traz um link para a pessoa deixar de receber."
                            checked={avisos.enviarEmails}
                            disabled={salvando}
                            onChange={(v) => mudar((a) => ({ ...a, enviarEmails: v }))}
                        />

                        <div className="rounded-lyra border" style={{ borderColor: 'var(--line)' }}>
                            {dados.modelos.map((m, i) => {
                                const e = avisos.eventos.find((x) => x.evento === m.evento);
                                if (!e) return null;
                                const lembrete = m.evento === 'agendamento_lembrete';
                                const personalizado = e.assunto !== null || e.mensagem !== null;
                                return (
                                    <div
                                        key={m.evento}
                                        className={`flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between ${i > 0 ? 'border-t' : ''}`}
                                        style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                                    >
                                        <div className="min-w-0">
                                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                                {m.nome}
                                                {personalizado && (
                                                    <span
                                                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                                        style={{
                                                            background: 'color-mix(in oklab, var(--copper) 14%, transparent)',
                                                            color: 'var(--copper)',
                                                        }}
                                                    >
                                                        Texto próprio
                                                    </span>
                                                )}
                                            </p>
                                            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                {m.descricao}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                                            {lembrete ? (
                                                LEMBRETES.map(({ horas, nome }) => {
                                                    const ligado = avisos.lembretesHoras.includes(horas);
                                                    return (
                                                        <Chip
                                                            key={horas}
                                                            ligado={ligado}
                                                            apagado={!avisos.enviarEmails}
                                                            disabled={salvando}
                                                            onClick={() =>
                                                                mudar((a) => ({
                                                                    ...a,
                                                                    lembretesHoras: ligado
                                                                        ? a.lembretesHoras.filter((h) => h !== horas)
                                                                        : [...a.lembretesHoras, horas],
                                                                }))
                                                            }
                                                        >
                                                            {nome}
                                                        </Chip>
                                                    );
                                                })
                                            ) : (
                                                <Chip
                                                    ligado={e.cliente}
                                                    apagado={!avisos.enviarEmails}
                                                    disabled={salvando}
                                                    onClick={() => mudarEvento(m.evento, { cliente: !e.cliente })}
                                                >
                                                    E-mail ao {t.cliente.singular.toLocaleLowerCase('pt-BR')}
                                                </Chip>
                                            )}
                                            {m.equipe && (
                                                <Chip
                                                    ligado={e.equipe}
                                                    disabled={salvando}
                                                    onClick={() => mudarEvento(m.evento, { equipe: !e.equipe })}
                                                >
                                                    Celular da equipe
                                                </Chip>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                disabled={salvando}
                                                onClick={() => {
                                                    setErro('');
                                                    setEditando(m.evento);
                                                }}
                                            >
                                                Editar texto
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="-mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {avisos.enviarEmails
                                ? 'O lembrete sai só para quem ainda tem o horário de pé; quem marcou em cima da hora não recebe lembrete repetido. "Celular da equipe" vale para quem ativou os avisos no aparelho.'
                                : `Os e-mails só saem com "Avisar ${clientes} por e-mail" ligado. "Celular da equipe" vale para quem ativou os avisos no aparelho.`}
                        </p>

                        <Textarea
                            label="Recado em todo e-mail"
                            placeholder="Ex.: Chegue 10 minutos antes. Atrasos acima de 15 minutos podem precisar de remarcação."
                            value={avisos.recado ?? ''}
                            maxLength={MAX_RECADO}
                            rows={2}
                            disabled={salvando}
                            helperText={`Aparece em destaque em todos os e-mails ao ${t.cliente.singular.toLocaleLowerCase('pt-BR')}, menos no de cancelamento. Aceita as mesmas variáveis dos textos.`}
                            onChange={(ev) => mudar((a) => ({ ...a, recado: ev.target.value }))}
                        />

                        <div className="border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                            <Switch
                                label={`Resumo do dia para ${t.recurso.plural.toLocaleLowerCase('pt-BR')}`}
                                descricao={`Às 7h, cada ${t.recurso.singular.toLocaleLowerCase('pt-BR')} com ${t.agendamento.plural.toLocaleLowerCase('pt-BR')} no dia recebe a lista por e-mail, com um botão para abrir a agenda. Vale o e-mail de login da pessoa no cadastro.`}
                                checked={avisos.resumoDiario}
                                disabled={salvando}
                                onChange={(v) => mudar((a) => ({ ...a, resumoDiario: v }))}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            {salvoEm && (
                                <span className="text-xs" style={{ color: 'var(--ok)' }}>
                                    Salvo
                                </span>
                            )}
                            <Button onClick={() => void salvar(avisos)} disabled={salvando}>
                                {salvando ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {modeloEditando && eventoEditando && avisos && dados && (
                <EditorTexto
                    modelo={modeloEditando}
                    evento={eventoEditando}
                    recado={avisos.recado}
                    variaveis={dados.variaveis}
                    salvando={salvando}
                    onClose={() => setEditando(null)}
                    onSalvar={async (assunto, mensagem) => {
                        const proximo: Avisos = {
                            ...avisos,
                            eventos: avisos.eventos.map((e) =>
                                e.evento === modeloEditando.evento ? { ...e, assunto, mensagem } : e
                            ),
                        };
                        const falha = await salvar(proximo);
                        if (!falha) setEditando(null);
                        return falha;
                    }}
                />
            )}
        </PageCard>
    );
}

function EditorTexto({
    modelo,
    evento,
    recado,
    variaveis,
    salvando,
    onClose,
    onSalvar,
}: {
    modelo: ModeloAviso;
    evento: AvisoEvento;
    recado: string | null;
    variaveis: VariavelAviso[];
    salvando: boolean;
    onClose: () => void;
    /** Devolve a mensagem de erro, ou null quando salvou. */
    onSalvar: (assunto: string | null, mensagem: string | null) => Promise<string | null>;
}) {
    const [assunto, setAssunto] = useState(evento.assunto ?? modelo.assunto);
    const [mensagem, setMensagem] = useState(evento.mensagem ?? modelo.mensagem);
    const [previa, setPrevia] = useState<PreviaAviso | null>(null);
    const [erroPrevia, setErroPrevia] = useState('');
    const [erroSalvar, setErroSalvar] = useState('');
    const assuntoRef = useRef<HTMLInputElement>(null);
    const mensagemRef = useRef<HTMLTextAreaElement>(null);
    const campoAtivo = useRef<'assunto' | 'mensagem'>('mensagem');
    const pedido = useRef(0);

    useEffect(() => {
        const id = ++pedido.current;
        const timer = window.setTimeout(async () => {
            try {
                const p = await configuracaoService.previaAviso({ evento: modelo.evento, assunto, mensagem, recado });
                if (id !== pedido.current) return;
                setPrevia(p);
                setErroPrevia('');
            } catch (e) {
                if (id === pedido.current) setErroPrevia(mensagemErroHttp(e));
            }
        }, 400);
        return () => window.clearTimeout(timer);
    }, [modelo.evento, assunto, mensagem, recado]);

    const inserir = (nome: string) => {
        const alvo = campoAtivo.current === 'assunto' ? assuntoRef.current : mensagemRef.current;
        const atual = campoAtivo.current === 'assunto' ? assunto : mensagem;
        const trecho = `{${nome}}`;
        const inicio = alvo?.selectionStart ?? atual.length;
        const fim = alvo?.selectionEnd ?? atual.length;
        const novo = atual.slice(0, inicio) + trecho + atual.slice(fim);
        if (campoAtivo.current === 'assunto') setAssunto(novo);
        else setMensagem(novo);
        requestAnimationFrame(() => {
            if (!alvo) return;
            alvo.focus();
            alvo.setSelectionRange(inicio + trecho.length, inicio + trecho.length);
        });
    };

    const visiveis = variaveis.filter((v) => v.nome !== 'quando_anterior' || modelo.evento === 'agendamento_remarcado');
    const padrao = assunto.trim() === modelo.assunto && mensagem.trim() === modelo.mensagem;

    return (
        <Modal
            aberto
            eyebrow="Texto do e-mail"
            titulo={modelo.nome}
            subtitulo={modelo.descricao}
            largura="72rem"
            onClose={onClose}
            rodape={
                <>
                    <Button
                        variant="ghost"
                        disabled={salvando || padrao}
                        className="mr-auto"
                        onClick={() => {
                            setAssunto(modelo.assunto);
                            setMensagem(modelo.mensagem);
                        }}
                    >
                        Restaurar padrão
                    </Button>
                    <Button variant="secondary" onClick={onClose} disabled={salvando}>
                        Cancelar
                    </Button>
                    <Button
                        disabled={salvando}
                        onClick={async () => {
                            setErroSalvar('');
                            const falha = await onSalvar(assunto, mensagem);
                            if (falha) setErroSalvar(falha);
                        }}
                    >
                        {salvando ? 'Salvando…' : 'Salvar'}
                    </Button>
                </>
            }
        >
            <div className="grid gap-5 pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                    {(erroSalvar || erroPrevia) && (
                        <Alert titulo={tituloDeMensagem(erroSalvar || erroPrevia)}>{erroSalvar || erroPrevia}</Alert>
                    )}
                    <label className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        <span className="mb-1.5 block">Assunto</span>
                        <input
                            ref={assuntoRef}
                            className="lyra-input"
                            style={{ marginTop: 0 }}
                            value={assunto}
                            maxLength={MAX_ASSUNTO}
                            disabled={salvando}
                            onFocus={() => {
                                campoAtivo.current = 'assunto';
                            }}
                            onChange={(e) => setAssunto(e.target.value)}
                        />
                    </label>
                    <label className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        <span className="mb-1.5 block">Mensagem</span>
                        <textarea
                            ref={mensagemRef}
                            className="lyra-input min-h-[7rem] resize-y"
                            style={{ marginTop: 0 }}
                            rows={5}
                            value={mensagem}
                            maxLength={MAX_MENSAGEM}
                            disabled={salvando}
                            onFocus={() => {
                                campoAtivo.current = 'mensagem';
                            }}
                            onChange={(e) => setMensagem(e.target.value)}
                        />
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--faint)' }}>
                            É o primeiro parágrafo, depois de "Olá, nome!". Data, serviços, endereço e botões vêm logo abaixo,
                            sempre.
                        </span>
                    </label>
                    <div>
                        <p className="mb-2 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                            Variáveis
                            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>
                                toque para inserir onde está o cursor
                            </span>
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                            {visiveis.map((v) => (
                                <button
                                    key={v.nome}
                                    type="button"
                                    disabled={salvando}
                                    title={`Ex.: ${v.exemplo}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => inserir(v.nome)}
                                    className="rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:border-[var(--copper)]"
                                    style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                                >
                                    <span className="block font-mono text-xs font-semibold" style={{ color: 'var(--copper)' }}>
                                        {`{${v.nome}}`}
                                    </span>
                                    <span className="block text-[11px] leading-tight" style={{ color: 'var(--muted-foreground)' }}>
                                        {v.descricao}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        Prévia
                        <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>
                            com um horário de exemplo
                        </span>
                    </p>
                    <div
                        className="overflow-hidden rounded-lyra border"
                        style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                    >
                        <p className="truncate border-b px-3 py-2 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>
                            <span style={{ color: 'var(--muted-foreground)' }}>Assunto: </span>
                            {previa?.assunto ?? '…'}
                        </p>
                        {previa ? (
                            <iframe
                                title="Prévia do e-mail"
                                sandbox=""
                                srcDoc={previa.html}
                                className="block h-[28rem] w-full lg:h-[36rem]"
                                style={{ background: '#f5f0eb', border: 0 }}
                            />
                        ) : (
                            <p className="px-3 py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Montando a prévia…
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
