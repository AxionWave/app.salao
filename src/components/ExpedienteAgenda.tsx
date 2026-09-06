import { useMemo, useState } from 'react';

export type ExpedienteDia = { ativo: boolean; inicio: string; fim: string };

const DIAS = [
    { id: 1, label: 'Seg', nome: 'Segunda' },
    { id: 2, label: 'Ter', nome: 'Terça' },
    { id: 3, label: 'Qua', nome: 'Quarta' },
    { id: 4, label: 'Qui', nome: 'Quinta' },
    { id: 5, label: 'Sex', nome: 'Sexta' },
    { id: 6, label: 'Sáb', nome: 'Sábado' },
    { id: 0, label: 'Dom', nome: 'Domingo' },
] as const;

function duracao(inicio: string, fim: string): string {
    const [hi, mi] = inicio.split(':').map(Number);
    const [hf, mf] = fim.split(':').map(Number);
    const min = hf * 60 + mf - (hi * 60 + mi);
    if (!Number.isFinite(min) || min <= 0) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function resumo(dias: Record<number, ExpedienteDia>): string {
    const ativos = DIAS.filter((d) => dias[d.id]?.ativo).map((d) => dias[d.id]);
    if (!ativos.length) return 'Sem expediente';
    const iguais = ativos.every((i) => i.inicio === ativos[0].inicio && i.fim === ativos[0].fim);
    const temDom = dias[0]?.ativo;
    if (iguais && ativos.length === 6 && !temDom) {
        return `Seg–Sáb ${ativos[0].inicio.slice(0, 5)}–${ativos[0].fim.slice(0, 5)}`;
    }
    if (iguais) return `${ativos.length} dias · ${ativos[0].inicio.slice(0, 5)}–${ativos[0].fim.slice(0, 5)}`;
    return `${ativos.length} dia${ativos.length === 1 ? '' : 's'} com horário próprio`;
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
    const textoResumo = useMemo(() => resumo(dias), [dias]);

    const atualizar = (id: number, patch: Partial<ExpedienteDia>) => {
        onChange({ ...dias, [id]: { ...dias[id], ...patch } });
    };

    const escolher = (id: number) => {
        setSelecionado(id);
        if (!aberto) setAberto(true);
        if (!dias[id].ativo) atualizar(id, { ativo: true });
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
                            return (
                                <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => escolher(d.id)}
                                    aria-pressed={ativo}
                                    aria-current={foco ? 'true' : undefined}
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
                                                {item.inicio.slice(0, 5)}
                                            </span>
                                            <span className="my-0.5 block h-3 w-px" style={{ background: corToken }} />
                                            <span className="font-mono text-[10px] tabular-nums leading-tight" style={{ color: 'var(--ink)' }}>
                                                {item.fim.slice(0, 5)}
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
                                            ? `Na agenda · ${duracao(dia.inicio, dia.fim) || 'horário'}`
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
                            <div className={`grid grid-cols-2 gap-2 ${dia.ativo ? '' : 'pointer-events-none opacity-40'}`}>
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--faint)' }}>
                                        Início
                                    </span>
                                    <input
                                        type="time"
                                        className="lyra-input font-mono text-sm tabular-nums"
                                        style={{ marginTop: 0 }}
                                        disabled={!dia.ativo}
                                        value={dia.inicio}
                                        onChange={(e) => atualizar(selecionado, { inicio: e.target.value })}
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--faint)' }}>
                                        Término
                                    </span>
                                    <input
                                        type="time"
                                        className="lyra-input font-mono text-sm tabular-nums"
                                        style={{ marginTop: 0 }}
                                        disabled={!dia.ativo}
                                        value={dia.fim}
                                        onChange={(e) => atualizar(selecionado, { fim: e.target.value })}
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
