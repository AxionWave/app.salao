import { useEffect, useRef, useState } from 'react';
import { mensagemErroHttp } from '@/exceptions';
import { formatarTelefoneExibicao } from '@/lib/telefone';
import { agendamentoService } from '@/services/agendamento.service';
import type { Cliente } from '@/services/cliente.service';

export type ClienteEscolhido = { id: number; nome: string };

const ESPERA_DIGITACAO_MS = 250;

const buscarNaAgenda = async (texto: string) => (await agendamentoService.buscarClientes(texto)).items;

/** Busca no servidor por nome, telefone ou e-mail; escala para milhares de fichas. */
export default function CampoCliente({
    label,
    valor,
    onChange,
    disabled,
    obrigatorio = true,
    buscar = buscarNaAgenda,
    ocultar,
    listaNoFluxo = false,
}: {
    label: string;
    valor: ClienteEscolhido | null;
    onChange: (c: ClienteEscolhido | null) => void;
    disabled?: boolean;
    obrigatorio?: boolean;
    buscar?: (texto: string) => Promise<Cliente[]>;
    /** Fichas que não podem ser escolhidas (ex.: a própria ficha em edição). */
    ocultar?: (c: Cliente) => boolean;
    /** Lista ocupa espaço no layout; use no fim de áreas com rolagem, onde uma lista flutuante seria cortada. */
    listaNoFluxo?: boolean;
}) {
    const [texto, setTexto] = useState(valor?.nome ?? '');
    const [aberto, setAberto] = useState(false);
    const [resultados, setResultados] = useState<Cliente[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    const pedido = useRef(0);
    const lista = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (listaNoFluxo && aberto) lista.current?.scrollIntoView({ block: 'nearest' });
    }, [listaNoFluxo, aberto, resultados.length]);

    useEffect(() => {
        setTexto(valor?.nome ?? '');
    }, [valor?.id, valor?.nome]);

    useEffect(() => {
        if (!aberto) return;
        const atual = ++pedido.current;
        setCarregando(true);
        const timer = window.setTimeout(() => {
            buscar(texto === valor?.nome ? '' : texto)
                .then((r) => {
                    if (atual !== pedido.current) return;
                    setResultados(ocultar ? r.filter((c) => !ocultar(c)) : r);
                    setErro('');
                })
                .catch((e) => {
                    if (atual !== pedido.current) return;
                    setResultados([]);
                    setErro(mensagemErroHttp(e));
                })
                .finally(() => {
                    if (atual === pedido.current) setCarregando(false);
                });
        }, ESPERA_DIGITACAO_MS);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- buscar/ocultar costumam ser funções inline
    }, [aberto, texto, valor?.nome]);

    const escolher = (c: Cliente) => {
        onChange({ id: c.id, nome: c.nome });
        setTexto(c.nome);
        setAberto(false);
    };

    return (
        <div className="relative w-full">
            <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {label}
                {obrigatorio && <span style={{ color: 'var(--destructive)' }}> *</span>}
            </label>
            <input
                className="lyra-input"
                style={{ marginTop: 0 }}
                value={texto}
                disabled={disabled}
                placeholder="Buscar por nome ou telefone"
                autoComplete="off"
                role="combobox"
                aria-expanded={aberto}
                onFocus={() => setAberto(true)}
                onBlur={() => window.setTimeout(() => setAberto(false), 150)}
                onChange={(e) => {
                    setTexto(e.target.value);
                    setAberto(true);
                    if (valor) onChange(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setAberto(false);
                    if (e.key === 'Enter' && resultados.length > 0) {
                        e.preventDefault();
                        escolher(resultados[0]);
                    }
                }}
            />
            {aberto && (
                <div
                    ref={lista}
                    role="listbox"
                    className={`${listaNoFluxo ? '' : 'absolute left-0 right-0 z-20 shadow-lg '}mt-1 max-h-60 overflow-y-auto rounded-lyra border py-1`}
                    style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                >
                    {erro ? (
                        <p className="px-3 py-2 text-xs" style={{ color: 'var(--destructive)' }}>
                            {erro}
                        </p>
                    ) : resultados.length === 0 ? (
                        <p className="px-3 py-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {carregando ? 'Buscando…' : 'Nenhuma ficha encontrada.'}
                        </p>
                    ) : (
                        resultados.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                role="option"
                                aria-selected={valor?.id === c.id}
                                className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm"
                                style={{
                                    color: 'var(--ink)',
                                    background:
                                        valor?.id === c.id
                                            ? 'color-mix(in oklab, var(--copper) 12%, var(--panel))'
                                            : undefined,
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => escolher(c)}
                            >
                                <span className="min-w-0 truncate">
                                    {c.nome}
                                    {c.familiaNome && (
                                        <span className="ml-1.5 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                                            {c.parentesco ? `${c.parentesco} · ` : ''}
                                            {c.familiaNome}
                                        </span>
                                    )}
                                </span>
                                <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                                    {formatarTelefoneExibicao(c.telefone)}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
