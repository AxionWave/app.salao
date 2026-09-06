import { useEffect, useState } from 'react';
import {
    ROW_PX,
    SLOT_MIN,
    cloneDia,
    corStatus,
    corToken,
    dataComMinutos,
    formatarHora,
    formatarMinutos,
    gerarSlots,
    iniciaisNome,
    intervaloNoDia,
    labelStatus,
    limitesGrade,
    mesmoDia,
    minutosDoInstante,
    ocupaHorario,
    slotDentro,
} from '@/lib/agenda';
import { rotuloServicos, type Agendamento, type ProfissionalAgenda } from '@/services/agendamento.service';

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
    onSlot,
    onAbrir,
}: {
    dia: Date;
    profissionais: ProfissionalAgenda[];
    agendamentos: Agendamento[];
    onSlot: (profissionalId: number, inicio: Date) => void;
    onAbrir: (a: Agendamento) => void;
}) {
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
                    const iv = intervaloNoDia(p.disponibilidades, dia);
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
                                    <p className="text-[11px]" style={{ color: 'var(--faint)' }}>
                                        {iv
                                            ? `${n} horário${n === 1 ? '' : 's'} · ${formatarMinutos(iv.inicio)}–${formatarMinutos(iv.fim)}`
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
                        onSlot={onSlot}
                        onAbrir={onAbrir}
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
    onSlot,
    onAbrir,
}: {
    dia: Date;
    profissional: ProfissionalAgenda;
    slots: number[];
    gradeInicio: number;
    linhaAgora: number | null;
    agendamentos: Agendamento[];
    onSlot: (profissionalId: number, inicio: Date) => void;
    onAbrir: (a: Agendamento) => void;
}) {
    const iv = intervaloNoDia(profissional.disponibilidades, dia);
    return (
        <div
            className="relative border-l"
            style={{ borderColor: 'var(--line)', height: slots.length * ROW_PX }}
        >
            {!iv && (
                <div className="absolute inset-3 z-10 flex items-center justify-center rounded-lyra" style={{ background: 'var(--panel2)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--faint)' }}>
                        Folga
                    </p>
                </div>
            )}
            {iv &&
                slots.map((m, i) => {
                    const livre = slotDentro(iv, m);
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
    return (
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
    );
}
