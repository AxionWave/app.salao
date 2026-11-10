import { Button } from '@/components/ui';
import {
    cloneDia,
    corStatus,
    corToken,
    dataComMinutos,
    faixaNoDia,
    faixasNoDia,
    formatarDiaColuna,
    formatarHora,
    formatarMinutos,
    labelStatus,
    mesmoDia,
    ocupaHorario,
} from '@/lib/agenda';
import { rotuloServicos, type Agendamento, type ProfissionalAgenda } from '@/services/agendamento.service';
import { type Bloqueio } from '@/services/bloqueio.service';
import { useTermos } from '@/contexts/TermosContext';

export default function GradeSemana({
    dias,
    profissionais,
    agendamentos,
    bloqueios = [],
    onSlot,
    onAbrir,
    onBloqueio,
    onDia,
    compact = false,
}: {
    dias: Date[];
    profissionais: ProfissionalAgenda[];
    agendamentos: Agendamento[];
    bloqueios?: Bloqueio[];
    onSlot: (profissionalId: number, inicio: Date) => void;
    onAbrir: (a: Agendamento) => void;
    onBloqueio?: (b: Bloqueio) => void;
    onDia?: (dia: Date) => void;
    compact?: boolean;
}) {
    const termos = useTermos();
    const hoje = cloneDia(new Date());
    const unico = profissionais.length === 1 ? profissionais[0] : null;

    return (
        <div className="overflow-x-auto">
            <div
                className={`grid gap-2.5 ${compact ? 'min-w-[44rem]' : 'min-w-[56rem]'}`}
                style={{ gridTemplateColumns: 'repeat(7, minmax(7.5rem, 1fr))' }}
            >
                {dias.map((dia) => {
                    const rotulo = formatarDiaColuna(dia);
                    const doDia = agendamentos
                        .filter((a) => mesmoDia(a.inicio, dia))
                        .sort((a, b) => a.inicio.localeCompare(b.inicio));
                    const ativos = doDia.filter((a) => ocupaHorario(a.status)).length;
                    const ehHoje = dia.getTime() === hoje.getTime();
                    const faixasUnico = unico ? faixasNoDia(unico.disponibilidades, dia) : [];
                    const bloqueiosDoDia = bloqueios
                        .map((b) => ({ b, f: faixaNoDia(b, dia) }))
                        .filter((x) => x.f !== null);
                    return (
                        <div
                            key={dia.toISOString()}
                            className={`flex flex-col overflow-hidden rounded-lyra border ${compact ? 'min-h-[16rem]' : 'min-h-[22rem]'}`}
                            style={{
                                borderColor: ehHoje ? 'var(--copper)' : 'var(--line)',
                                background: 'var(--panel)',
                                boxShadow: ehHoje ? '0 0 0 1px color-mix(in oklab, var(--copper) 35%, transparent)' : undefined,
                            }}
                        >
                            <button
                                type="button"
                                disabled={!onDia}
                                onClick={() => onDia?.(dia)}
                                className={`w-full px-2.5 py-2 text-left ${onDia ? 'cursor-pointer' : 'cursor-default'}`}
                                style={{
                                    background: ehHoje
                                        ? 'color-mix(in oklab, var(--copper) 14%, var(--panel))'
                                        : 'var(--panel2)',
                                    borderBottom: '1px solid var(--line)',
                                }}
                            >
                                <div className="flex items-baseline justify-between gap-1">
                                    <p
                                        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                                        style={{ color: ehHoje ? 'var(--copper)' : 'var(--faint)' }}
                                    >
                                        {rotulo.dia}
                                    </p>
                                    <p className="font-display text-lg font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                                        {dia.getDate()}
                                    </p>
                                </div>
                                <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                                    {ativos === 0 ? 'Livre' : `${ativos} ${termos.contagem('agendamento', ativos)}`}
                                </p>
                            </button>
                            <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
                                {bloqueiosDoDia.map(({ b, f }) => (
                                    <button
                                        key={`b-${b.id}`}
                                        type="button"
                                        disabled={!onBloqueio}
                                        onClick={() => onBloqueio?.(b)}
                                        className="rounded-md border border-dashed px-2 py-1.5 text-left disabled:cursor-default"
                                        style={{ borderColor: 'var(--line)', background: 'var(--panel2)' }}
                                        title={b.motivo ?? 'Bloqueado'}
                                    >
                                        <p className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--faint)' }}>
                                            {f && f.inicio === 0 && f.fim === 24 * 60
                                                ? 'Dia todo'
                                                : f && `${formatarMinutos(f.inicio)}–${formatarMinutos(f.fim)}`}
                                        </p>
                                        <p className="truncate text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                                            {b.motivo ?? 'Bloqueado'}
                                        </p>
                                        <p className="truncate text-[11px]" style={{ color: 'var(--faint)' }}>
                                            {b.profissionalNome ?? 'Empresa toda'}
                                        </p>
                                    </button>
                                ))}
                                {doDia.length === 0 && bloqueiosDoDia.length === 0 && (
                                    <button
                                        type="button"
                                        disabled={!onDia}
                                        onClick={() => onDia?.(dia)}
                                        className="px-1 py-3 text-center text-[11px] disabled:cursor-default"
                                        style={{ color: 'var(--faint)' }}
                                    >
                                        Sem horários
                                    </button>
                                )}
                                {doDia.map((a) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => onAbrir(a)}
                                        className="lyra-agenda-bloco rounded-md px-2 py-1.5 text-left"
                                        style={{
                                            background: `color-mix(in oklab, ${corToken(a.profissionalCor)} 16%, var(--card))`,
                                            borderLeft: `3px solid ${corToken(a.profissionalCor)}`,
                                            opacity: ocupaHorario(a.status) ? 1 : 0.5,
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="font-mono text-[11px] font-semibold tabular-nums">
                                                {formatarHora(a.inicio)}
                                            </p>
                                            <span
                                                className="h-1.5 w-1.5 rounded-full"
                                                style={{ background: corStatus(a.status) }}
                                                title={labelStatus(a.status)}
                                            />
                                        </div>
                                        <p className="truncate text-xs font-medium">{a.clienteNome}</p>
                                        <p className="truncate text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                                            {rotuloServicos(a)}
                                        </p>
                                    </button>
                                ))}
                            </div>
                            <div className="border-t p-1.5" style={{ borderColor: 'var(--line)' }}>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full"
                                    disabled={Boolean(unico && (!unico.ativo || faixasUnico.length === 0))}
                                    onClick={() => {
                                        const prof = unico ?? profissionais.find((p) => p.ativo);
                                        if (!prof) return;
                                        const minutos = faixasNoDia(prof.disponibilidades, dia)[0]?.inicio ?? 9 * 60;
                                        onSlot(prof.id, dataComMinutos(dia, minutos));
                                    }}
                                >
                                    + Horário
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
