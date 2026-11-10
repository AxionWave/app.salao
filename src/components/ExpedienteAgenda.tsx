import { useMemo, useState } from 'react';

export type FaixaHorario = { inicio: string; fim: string };
export type ExpedienteDia = { ativo: boolean; faixas: FaixaHorario[] };
type IntervaloSemana = { diaSemana: number; inicio: string; fim: string };

const MAX_FAIXAS = 6;

const DIAS = [
    { id: 1, label: 'Seg', nome: 'Segunda' },
    { id: 2, label: 'Ter', nome: 'Terça' },
    { id: 3, label: 'Qua', nome: 'Quarta' },
    { id: 4, label: 'Qui', nome: 'Quinta' },
    { id: 5, label: 'Sex', nome: 'Sexta' },
    { id: 6, label: 'Sáb', nome: 'Sábado' },
    { id: 0, label: 'Dom', nome: 'Domingo' },
] as const;

function minutos(hhmm: string): number {
    const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

/** Minutos cobertos por pelo menos uma faixa; sobreposição não conta duas vezes. */
function minutosCobertos(faixas: { inicio: string; fim: string }[]): number {
    const ordenadas = faixas
        .map((f) => [minutos(f.inicio), minutos(f.fim)] as const)
        .filter(([a, b]) => b > a)
        .sort((x, y) => x[0] - y[0]);
    let total = 0;
    let ate = -1;
    for (const [a, b] of ordenadas) {
        if (b <= ate) continue;
        total += b - Math.max(a, ate);
        ate = b;
    }
    return total;
}

function hhmm(min: number): string {
    const x = Math.max(0, Math.min(23 * 60 + 59, min));
    return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

function duracaoTexto(min: number): string {
    if (min <= 0) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function textoFaixas(faixas: FaixaHorario[]): string {
    return faixas.map((f) => `${f.inicio.slice(0, 5)}–${f.fim.slice(0, 5)}`).join(', ');
}

export function expedientePadrao(): Record<number, ExpedienteDia> {
    const out: Record<number, ExpedienteDia> = {};
    for (const d of DIAS) {
        out[d.id] = { ativo: d.id !== 0, faixas: [{ inicio: '09:00', fim: '19:00' }] };
    }
    return out;
}

export function expedienteDeIntervalos(lista: IntervaloSemana[]): Record<number, ExpedienteDia> {
    const out = expedientePadrao();
    for (const d of DIAS) {
        const faixas = lista
            .filter((i) => i.diaSemana === d.id)
            .map((i) => ({ inicio: i.inicio.slice(0, 5), fim: i.fim.slice(0, 5) }))
            .sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
        out[d.id] = faixas.length ? { ativo: true, faixas } : { ...out[d.id], ativo: false };
    }
    return out;
}

export function intervalosDoExpediente(dias: Record<number, ExpedienteDia>): IntervaloSemana[] {
    return DIAS.filter((d) => dias[d.id]?.ativo).flatMap((d) =>
        dias[d.id].faixas.map((f) => ({ diaSemana: d.id, inicio: f.inicio, fim: f.fim }))
    );
}

/** Primeiro problema encontrado no expediente, ou null se estiver válido. */
export function erroExpediente(dias: Record<number, ExpedienteDia>): string | null {
    for (const d of DIAS) {
        const dia = dias[d.id];
        if (!dia?.ativo) continue;
        const ordenadas = [...dia.faixas].sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
        for (let i = 0; i < ordenadas.length; i++) {
            if (minutos(ordenadas[i].fim) <= minutos(ordenadas[i].inicio)) {
                return `${d.nome}: o término precisa ser depois do início.`;
            }
            if (i > 0 && minutos(ordenadas[i].inicio) < minutos(ordenadas[i - 1].fim)) {
                return `${d.nome}: há faixas de horário sobrepostas.`;
            }
        }
    }
    return null;
}

export function resumoExpediente(lista: IntervaloSemana[]): string {
    const porDia = new Map<number, string>();
    for (const d of DIAS) {
        const faixas = lista
            .filter((i) => i.diaSemana === d.id)
            .sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
        if (faixas.length) porDia.set(d.id, textoFaixas(faixas));
    }
    if (!porDia.size) return 'Sem expediente';
    const textos = [...porDia.values()];
    const iguais = textos.every((t) => t === textos[0]);
    if (iguais && porDia.size === 6 && !porDia.has(0)) return `Seg–Sáb ${textos[0]}`;
    if (iguais) return `${porDia.size} dia${porDia.size === 1 ? '' : 's'} · ${textos[0]}`;
    return `${porDia.size} dia${porDia.size === 1 ? '' : 's'} com horário próprio`;
}

export default function ExpedienteAgenda({
    dias,
    onChange,
    cor,
}: {
    dias: Record<number, ExpedienteDia>;
    onChange: (dias: Record<number, ExpedienteDia>) => void;
    cor: string;
}) {
    const [aberto, setAberto] = useState(false);
    const [selecionado, setSelecionado] = useState<number>(1);
    const dia = dias[selecionado];
    const corToken = `var(--${cor})`;
    const textoResumo = useMemo(() => resumoExpediente(intervalosDoExpediente(dias)), [dias]);
    const erro = useMemo(() => erroExpediente(dias), [dias]);

    const atualizar = (id: number, patch: Partial<ExpedienteDia>) => {
        onChange({ ...dias, [id]: { ...dias[id], ...patch } });
    };

    const atualizarFaixa = (indice: number, patch: Partial<FaixaHorario>) => {
        atualizar(selecionado, {
            faixas: dia.faixas.map((f, i) => (i === indice ? { ...f, ...patch } : f)),
        });
    };

    const adicionarFaixa = () => {
        const ultimoFim = Math.max(...dia.faixas.map((f) => minutos(f.fim)));
        atualizar(selecionado, {
            faixas: [...dia.faixas, { inicio: hhmm(ultimoFim + 60), fim: hhmm(ultimoFim + 180) }],
        });
    };

    const podeAdicionar =
        dia?.ativo && dia.faixas.length < MAX_FAIXAS && Math.max(...dia.faixas.map((f) => minutos(f.fim))) <= 22 * 60;
    const minutosDia = minutosCobertos(dia?.faixas ?? []);

    const escolher = (id: number) => {
        setSelecionado(id);
        if (!aberto) setAberto(true);
    };

    return (
        <div
            className="mt-5 overflow-hidden"
            style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                background: 'var(--panel)',
            }}
        >
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                aria-expanded={aberto}
                onClick={() => setAberto((v) => !v)}
            >
                <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                        Agenda
                    </span>
                    <span className="mt-0.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        Expediente
                    </span>
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {textoResumo}
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    <span className="flex gap-0.5" aria-hidden>
                        {DIAS.map((d) => (
                            <span
                                key={d.id}
                                className="h-7 w-1.5 rounded-full"
                                style={{
                                    background: dias[d.id]?.ativo
                                        ? corToken
                                        : 'color-mix(in oklab, var(--line) 80%, transparent)',
                                }}
                            />
                        ))}
                    </span>
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="shrink-0 transition-transform"
                        style={{
                            color: 'var(--faint)',
                            transform: aberto ? 'rotate(180deg)' : 'none',
                        }}
                    >
                        <path
                            d="M2 4.5L6 8.5L10 4.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            </button>

            {aberto && (
                <div className="border-t px-3 pb-3 pt-3" style={{ borderColor: 'var(--line)' }}>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--faint)' }}>
                        Toda semana
                    </p>
                    <div className="grid grid-cols-7 gap-1">
                        {DIAS.map((d) => {
                            const item = dias[d.id];
                            const ativo = item.ativo;
                            const foco = selecionado === d.id;
                            const faixas = [...item.faixas].sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
                            return (
                                <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => escolher(d.id)}
                                    aria-pressed={ativo}
                                    aria-current={foco ? 'true' : undefined}
                                    title={ativo ? textoFaixas(faixas) : 'Folga'}
                                    className="flex min-h-[6.5rem] flex-col rounded-lg px-1 pb-1.5 pt-1.5 text-center transition"
                                    style={{
                                        border: `1px solid ${foco ? 'var(--ring)' : 'var(--line)'}`,
                                        background: foco
                                            ? 'color-mix(in oklab, var(--copper) 10%, var(--card))'
                                            : 'var(--card)',
                                        boxShadow: foco
                                            ? '0 0 0 1px color-mix(in oklab, var(--copper) 35%, transparent)'
                                            : 'none',
                                    }}
                                >
                                    <span
                                        className="text-[10px] font-semibold uppercase tracking-wider"
                                        style={{ color: foco ? 'var(--copper)' : 'var(--faint)' }}
                                    >
                                        {d.label}
                                    </span>
                                    {ativo ? (
                                        <span
                                            className="mt-1 flex min-h-0 flex-1 flex-col items-center justify-center rounded-md px-0.5 py-1"
                                            style={{
                                                background: `color-mix(in oklab, ${corToken} 32%, transparent)`,
                                            }}
                                        >
                                            <span className="font-mono text-[10px] tabular-nums leading-tight" style={{ color: 'var(--ink)' }}>
                                                {faixas[0]?.inicio.slice(0, 5)}
                                            </span>
                                            <span className="my-0.5 flex flex-col items-center gap-0.5">
                                                {faixas.map((f, i) => (
                                                    <span
                                                        key={i}
                                                        className="block w-px"
                                                        style={{
                                                            height: faixas.length > 1 ? 5 : 12,
                                                            background: corToken,
                                                        }}
                                                    />
                                                ))}
                                            </span>
                                            <span className="font-mono text-[10px] tabular-nums leading-tight" style={{ color: 'var(--ink)' }}>
                                                {faixas[faixas.length - 1]?.fim.slice(0, 5)}
                                            </span>
                                        </span>
                                    ) : (
                                        <span
                                            className="mt-1 flex flex-1 items-center justify-center rounded-md border border-dashed text-[9px] font-medium uppercase tracking-wide"
                                            style={{ borderColor: 'var(--line)', color: 'var(--faint)' }}
                                        >
                                            Folga
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {dia && (
                        <div
                            className="mt-3 rounded-lg px-3 py-3"
                            style={{
                                border: '1px solid var(--line)',
                                background: 'var(--card)',
                            }}
                        >
                            <div className="mb-3 flex items-start justify-between gap-2">
                                <div>
                                    <p className="font-display text-base font-semibold" style={{ color: 'var(--ink)' }}>
                                        {DIAS.find((d) => d.id === selecionado)?.nome}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        {dia.ativo
                                            ? `Na agenda · ${duracaoTexto(minutosDia) || 'horário'}${dia.faixas.length > 1 ? ' com pausas' : ''}`
                                            : 'Fora da agenda nesta semana'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                    style={{
                                        border: '1px solid var(--line)',
                                        color: dia.ativo ? 'var(--muted-foreground)' : 'var(--copper)',
                                        background: dia.ativo
                                            ? 'transparent'
                                            : 'color-mix(in oklab, var(--copper) 12%, transparent)',
                                    }}
                                    onClick={() => atualizar(selecionado, { ativo: !dia.ativo })}
                                >
                                    {dia.ativo ? 'Folga' : 'Trabalha'}
                                </button>
                            </div>
                            <div className={`flex flex-col gap-2 ${dia.ativo ? '' : 'pointer-events-none opacity-40'}`}>
                                {dia.faixas.map((f, i) => (
                                    <div key={i} className="flex items-end gap-2">
                                        <label className="block flex-1">
                                            <span className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--faint)' }}>
                                                Início
                                            </span>
                                            <input
                                                type="time"
                                                className="lyra-input font-mono text-sm tabular-nums"
                                                style={{ marginTop: 0 }}
                                                disabled={!dia.ativo}
                                                value={f.inicio}
                                                onChange={(e) => atualizarFaixa(i, { inicio: e.target.value })}
                                            />
                                        </label>
                                        <label className="block flex-1">
                                            <span className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--faint)' }}>
                                                Término
                                            </span>
                                            <input
                                                type="time"
                                                className="lyra-input font-mono text-sm tabular-nums"
                                                style={{ marginTop: 0 }}
                                                disabled={!dia.ativo}
                                                value={f.fim}
                                                onChange={(e) => atualizarFaixa(i, { fim: e.target.value })}
                                            />
                                        </label>
                                        {dia.faixas.length > 1 && (
                                            <button
                                                type="button"
                                                className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                                                style={{ border: '1px solid var(--line)', color: 'var(--muted-foreground)' }}
                                                aria-label="Remover faixa"
                                                onClick={() =>
                                                    atualizar(selecionado, { faixas: dia.faixas.filter((_, idx) => idx !== i) })
                                                }
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {podeAdicionar && (
                                    <button
                                        type="button"
                                        className="self-start rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                        style={{
                                            border: '1px dashed var(--line)',
                                            color: 'var(--copper)',
                                        }}
                                        onClick={adicionarFaixa}
                                    >
                                        + Adicionar faixa (ex.: depois do almoço)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {erro && (
                <p className="border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--destructive)' }}>
                    {erro}
                </p>
            )}
        </div>
    );
}
