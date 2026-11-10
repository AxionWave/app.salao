import { useEffect, useState } from 'react';
import {
    ROW_PX,
    SLOT_MIN,
    cloneDia,
    corStatus,
    corToken,
    dataComMinutos,
    faixaNoDia,
    faixasNoDia,
    formatarHora,
    formatarMinutos,
    gerarSlots,
    iniciaisNome,
    labelStatus,
    limitesGrade,
    mesmoDia,
    minutosDoInstante,
    ocupaHorario,
    resumoFaixas,
    slotDentro,
    type Faixa,
} from '@/lib/agenda';
import { rotuloServicos, type Agendamento, type ProfissionalAgenda } from '@/services/agendamento.service';
import { bloqueiaProfissional, type Bloqueio } from '@/services/bloqueio.service';
import { useTermos } from '@/contexts/TermosContext';

function useAgora(ativo: boolean) {
    const [agora, setAgora] = useState(() => new Date());
    useEffect(() => {
        if (!ativo) return;
        const t = window.setInterval(() => setAgora(new Date()), 30_000);
        return () => window.clearInterval(t);
    }, [ativo]);
    return agora;
}

export default function GradeDia({
    dia,
    profissionais,
    agendamentos,
    bloqueios = [],
    onSlot,
    onAbrir,
    onBloqueio,
}: {
    dia: Date;
    profissionais: ProfissionalAgenda[];
    agendamentos: Agendamento[];
    bloqueios?: Bloqueio[];
    onSlot: (profissionalId: number, inicio: Date) => void;
    onAbrir: (a: Agendamento) => void;
    onBloqueio?: (b: Bloqueio) => void;
}) {
    const termos = useTermos();
    const limites = limitesGrade(
        profissionais.map((p) => p.disponibilidades),
        dia
    );
    const slots = gerarSlots(limites.inicio, limites.fim);
    const ehHoje = cloneDia(dia).getTime() === cloneDia(new Date()).getTime();
    const agora = useAgora(ehHoje);
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    const linhaAgora =
        ehHoje && agoraMin >= limites.inicio && agoraMin < limites.fim
            ? ((agoraMin - limites.inicio) / SLOT_MIN) * ROW_PX
            : null;
    const cols = `3.75rem repeat(${Math.max(profissionais.length, 1)}, minmax(12rem, 1fr))`;

    return (
        <div className="min-w-[42rem]">
            <div className="grid" style={{ gridTemplateColumns: cols }}>
                <div
                    className="sticky top-0 z-30 border-b"
                    style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                />
                {profissionais.map((p) => {
                    const n = agendamentos.filter(
                        (a) => a.profissionalId === p.id && mesmoDia(a.inicio, dia) && ocupaHorario(a.status)
                    ).length;
                    const faixas = faixasNoDia(p.disponibilidades, dia);
                    return (
                        <div
                            key={p.id}
                            className="sticky top-0 z-20 border-b border-l px-3 py-2.5"
                            style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                        >
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                                    style={{
                                        background: `color-mix(in oklab, ${corToken(p.cor)} 22%, var(--panel2))`,
                                        color: corToken(p.cor),
                                    }}
                                >
                                    {iniciaisNome(p.nome)}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                                        {p.nome}
                                    </p>
                                    <p className="truncate text-[11px]" style={{ color: 'var(--faint)' }}>
                                        {faixas.length
                                            ? `${n} ${termos.contagem('agendamento', n)} · ${resumoFaixas(faixas)}`
                                            : 'Folga'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="grid" style={{ gridTemplateColumns: cols }}>
                <div
                    className="sticky left-0 z-10"
                    style={{ background: 'var(--card)' }}
                >
                    {slots.map((m) => (
                        <div
                            key={m}
                            className="flex items-start justify-end border-t pr-2 pt-1 font-mono text-[11px] tabular-nums"
                            style={{
                                height: ROW_PX,
                                borderColor: 'var(--line)',
                                color: m % 60 === 0 ? 'var(--ink)' : 'var(--faint)',
                                fontWeight: m % 60 === 0 ? 600 : 400,
                            }}
                        >
                            {m % 60 === 0 ? formatarMinutos(m) : ''}
                        </div>
                    ))}
                </div>
                {profissionais.map((p) => (
                    <ColunaProfissional
                        key={p.id}
                        dia={dia}
                        profissional={p}
                        slots={slots}
                        gradeInicio={limites.inicio}
                        linhaAgora={linhaAgora}
                        agendamentos={agendamentos.filter((a) => a.profissionalId === p.id && mesmoDia(a.inicio, dia))}
                        bloqueios={bloqueios.filter((b) => bloqueiaProfissional(b, p.id))}
                        onSlot={onSlot}
                        onAbrir={onAbrir}
                        onBloqueio={onBloqueio}
                    />
                ))}
            </div>
        </div>
    );
}

function ColunaProfissional({
    dia,
    profissional,
    slots,
    gradeInicio,
    linhaAgora,
    agendamentos,
    bloqueios,
    onSlot,
    onAbrir,
    onBloqueio,
}: {
    dia: Date;
    profissional: ProfissionalAgenda;
    slots: number[];
    gradeInicio: number;
    linhaAgora: number | null;
    agendamentos: Agendamento[];
    bloqueios: Bloqueio[];
    onSlot: (profissionalId: number, inicio: Date) => void;
    onAbrir: (a: Agendamento) => void;
    onBloqueio?: (b: Bloqueio) => void;
}) {
    const faixas = faixasNoDia(profissional.disponibilidades, dia);
    const gradeFim = gradeInicio + slots.length * SLOT_MIN;
    const bloqueiosDoDia = bloqueios
        .map((b) => ({ b, f: faixaNoDia(b, dia) }))
        .filter((x): x is { b: Bloqueio; f: Faixa } => x.f !== null && x.f.fim > gradeInicio && x.f.inicio < gradeFim);
    const bloqueado = (m: number) => bloqueiosDoDia.some(({ f }) => m < f.fim && m + SLOT_MIN > f.inicio);
    return (
        <div
            className="relative border-l"
            style={{ borderColor: 'var(--line)', height: slots.length * ROW_PX }}
        >
            {faixas.length === 0 && (
                <div className="absolute inset-3 z-10 flex items-center justify-center rounded-lyra" style={{ background: 'var(--panel2)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--faint)' }}>
                        Folga
                    </p>
                </div>
            )}
            {faixas.length > 0 &&
                slots.map((m, i) => {
                    const livre = slotDentro(faixas, m) && !bloqueado(m);
                    return (
                        <button
                            key={m}
                            type="button"
                            onClick={() => onSlot(profissional.id, dataComMinutos(dia, m))}
                            disabled={!livre}
                            className="lyra-agenda-slot group absolute left-0 right-0 border-t"
                            style={{
                                top: i * ROW_PX,
                                height: ROW_PX,
                                borderColor: 'var(--line)',
                                background: livre ? 'transparent' : 'color-mix(in oklab, var(--panel2) 55%, transparent)',
                                cursor: livre ? 'pointer' : 'default',
                            }}
                            aria-label={livre ? `Marcar ${formatarMinutos(m)} com ${profissional.nome}` : undefined}
                        >
                            {livre && (
                                <span
                                    className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                                    style={{ color: 'var(--copper)' }}
                                >
                                    + Horário
                                </span>
                            )}
                        </button>
                    );
                })}
            {bloqueiosDoDia.map(({ b, f }) => (
                <BlocoBloqueio
                    key={b.id}
                    b={b}
                    faixa={{ inicio: Math.max(f.inicio, gradeInicio), fim: Math.min(f.fim, gradeFim) }}
                    gradeInicio={gradeInicio}
                    onAbrir={onBloqueio}
                />
            ))}
            {agendamentos.map((a) => (
                <BlocoAgendamento key={a.id} a={a} gradeInicio={gradeInicio} onAbrir={onAbrir} />
            ))}
            {linhaAgora !== null && (
                <div
                    className="pointer-events-none absolute left-0 right-0 z-20"
                    style={{ top: linhaAgora }}
                    aria-hidden
                >
                    <div className="h-px w-full" style={{ background: 'var(--copper)' }} />
                    <span
                        className="absolute -left-1 -top-1 h-2 w-2 rounded-full"
                        style={{ background: 'var(--copper)' }}
                    />
                </div>
            )}
        </div>
    );
}

function BlocoBloqueio({
    b,
    faixa,
    gradeInicio,
    onAbrir,
}: {
    b: Bloqueio;
    faixa: Faixa;
    gradeInicio: number;
    onAbrir?: (b: Bloqueio) => void;
}) {
    const top = ((faixa.inicio - gradeInicio) / SLOT_MIN) * ROW_PX + 2;
    const height = Math.max(ROW_PX / 2, ((faixa.fim - faixa.inicio) / SLOT_MIN) * ROW_PX - 4);
    return (
        <button
            type="button"
            disabled={!onAbrir}
            onClick={() => onAbrir?.(b)}
            className="absolute left-1 right-1 z-[5] overflow-hidden rounded-lg px-2.5 py-1.5 text-left disabled:cursor-default"
            style={{
                top,
                height,
                background:
                    'repeating-linear-gradient(135deg, var(--panel2) 0 8px, color-mix(in oklab, var(--panel2) 55%, var(--card)) 8px 16px)',
                border: '1px dashed var(--line)',
            }}
            title={b.motivo ?? 'Bloqueado'}
        >
            <p className="truncate text-[11px] font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                {b.motivo ?? 'Bloqueado'}
            </p>
            <p className="truncate font-mono text-[10px] tabular-nums" style={{ color: 'var(--faint)' }}>
                {b.profissionalId === null ? 'Empresa · ' : ''}
                {formatarMinutos(faixa.inicio)}–{formatarMinutos(faixa.fim)}
            </p>
        </button>
    );
}

function BlocoAgendamento({
    a,
    gradeInicio,
    onAbrir,
}: {
    a: Agendamento;
    gradeInicio: number;
    onAbrir: (a: Agendamento) => void;
}) {
    const ini = minutosDoInstante(a.inicio);
    const fim = minutosDoInstante(a.fim);
    const top = ((ini - gradeInicio) / SLOT_MIN) * ROW_PX + 3;
    const height = Math.max(ROW_PX - 8, ((fim - ini) / SLOT_MIN) * ROW_PX - 6);
    const cancelado = !ocupaHorario(a.status);
    const alto = height >= ROW_PX * 1.4;
    const preparo = cancelado ? 0 : a.intervaloAposMinutos ?? 0;
    return (
        <>
            {preparo > 0 && (
                <div
                    className="pointer-events-none absolute left-1.5 right-1.5 z-[9] rounded-b-lg px-2.5 text-[10px]"
                    style={{
                        top: top + height,
                        height: Math.max(6, (preparo / SLOT_MIN) * ROW_PX),
                        background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${corToken(a.profissionalCor)} 10%, transparent) 0 6px, transparent 6px 12px)`,
                        borderLeft: `3px dotted color-mix(in oklab, ${corToken(a.profissionalCor)} 55%, transparent)`,
                        color: 'var(--faint)',
                    }}
                    title={`${preparo} min de preparo`}
                >
                    {preparo >= 15 ? 'preparo' : ''}
                </div>
            )}
            <button
                type="button"
                onClick={() => onAbrir(a)}
                className="lyra-agenda-bloco absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-lg px-2.5 py-1.5 text-left"
                style={{
                    top,
                    height,
                    background: `color-mix(in oklab, ${corToken(a.profissionalCor)} 16%, var(--card))`,
                    border: `1px solid color-mix(in oklab, ${corToken(a.profissionalCor)} 35%, var(--line))`,
                    borderLeft: `3px solid ${corToken(a.profissionalCor)}`,
                    opacity: cancelado ? 0.5 : 1,
                    boxShadow: 'var(--lyra-shadow-sm)',
                }}
            >
                <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                        {a.clienteNome}
                    </p>
                    <span
                        className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: corStatus(a.status) }}
                        title={labelStatus(a.status)}
                    />
                </div>
                <p className="truncate font-mono text-[10px] tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                    {formatarHora(a.inicio)}
                    {alto ? ` – ${formatarHora(a.fim)}` : ''}
                </p>
                {alto && (
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--faint)' }}>
                        {rotuloServicos(a)}
                    </p>
                )}
            </button>
        </>
    );
}
