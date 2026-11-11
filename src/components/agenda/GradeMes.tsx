import {
    corToken,
    faixaNoDia,
    formatarHora,
    mesmoDia,
    ocupaHorario,
} from '@/lib/agenda';
import { hojeNaEmpresa } from '@/lib/fuso';
import { type Agendamento } from '@/services/agendamento.service';
import { type Bloqueio } from '@/services/bloqueio.service';

const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function GradeMes({
    mes,
    dias,
    agendamentos,
    bloqueios = [],
    onDia,
}: {
    mes: Date;
    dias: Date[];
    agendamentos: Agendamento[];
    bloqueios?: Bloqueio[];
    onDia: (dia: Date) => void;
}) {
    const hoje = hojeNaEmpresa();
    const mesRef = mes.getMonth();
    const anoRef = mes.getFullYear();

    return (
        <div>
            <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
                {SEMANA.map((d) => (
                    <p
                        key={d}
                        className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.06em] sm:px-1 sm:text-[11px] sm:tracking-[0.12em]"
                        style={{ color: 'var(--faint)' }}
                    >
                        {d}
                    </p>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {dias.map((dia) => {
                    const doMes = dia.getMonth() === mesRef && dia.getFullYear() === anoRef;
                    const ehHoje = dia.getTime() === hoje.getTime();
                    const doDia = agendamentos
                        .filter((a) => mesmoDia(a.inicio, dia))
                        .sort((a, b) => a.inicio.localeCompare(b.inicio));
                    const ativos = doDia.filter((a) => ocupaHorario(a.status));
                    const preview = ativos.slice(0, 2);
                    const bloqueio = bloqueios.find((b) => faixaNoDia(b, dia) !== null);
                    return (
                        <button
                            key={dia.toISOString()}
                            type="button"
                            onClick={() => onDia(dia)}
                            className="flex min-h-[3.25rem] min-w-0 flex-col rounded-lyra border px-1 py-1 text-left transition sm:min-h-[5.75rem] sm:px-1.5 sm:py-1.5 hover:border-[color-mix(in_oklab,var(--copper)_45%,transparent)]"
                            style={{
                                borderColor: ehHoje ? 'var(--copper)' : 'var(--line)',
                                background: ehHoje
                                    ? 'color-mix(in oklab, var(--copper) 12%, var(--panel))'
                                    : doMes
                                      ? 'var(--panel)'
                                      : 'var(--panel2)',
                                opacity: doMes ? 1 : 0.48,
                                boxShadow: ehHoje
                                    ? '0 0 0 1px color-mix(in oklab, var(--copper) 35%, transparent)'
                                    : undefined,
                            }}
                        >
                            <div className="flex items-baseline justify-between gap-1">
                                <span
                                    className="font-display text-sm font-semibold tabular-nums"
                                    style={{ color: ehHoje ? 'var(--copper)' : 'var(--ink)' }}
                                >
                                    {dia.getDate()}
                                </span>
                                {ativos.length > 0 && (
                                    <span className="hidden text-[10px] tabular-nums sm:inline" style={{ color: 'var(--muted-foreground)' }}>
                                        {ativos.length}
                                    </span>
                                )}
                            </div>
                            <div className="mt-auto flex items-center gap-1 sm:hidden">
                                {ativos.length > 0 && (
                                    <span
                                        className="rounded-full px-1.5 text-[10px] font-semibold leading-4 tabular-nums"
                                        style={{
                                            background: 'color-mix(in oklab, var(--copper) 22%, var(--card))',
                                            color: 'var(--ink)',
                                        }}
                                    >
                                        {ativos.length}
                                    </span>
                                )}
                                {bloqueio && (
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full border border-dashed"
                                        style={{ borderColor: 'var(--muted-foreground)' }}
                                        title={bloqueio.motivo || 'Bloqueado'}
                                    />
                                )}
                            </div>
                            <div className="mt-1 hidden min-h-0 flex-1 flex-col gap-0.5 sm:flex">
                                {bloqueio && (
                                    <span
                                        className="truncate rounded-sm border border-dashed px-1 py-0.5 text-[10px] leading-tight"
                                        style={{ borderColor: 'var(--line)', color: 'var(--muted-foreground)' }}
                                    >
                                        {bloqueio.motivo || 'Bloqueado'}
                                    </span>
                                )}
                                {preview.map((a) => (
                                    <span
                                        key={a.id}
                                        className="truncate rounded-sm px-1 py-0.5 text-[10px] leading-tight"
                                        style={{
                                            background: `color-mix(in oklab, ${corToken(a.profissionalCor)} 18%, var(--card))`,
                                            borderLeft: `2px solid ${corToken(a.profissionalCor)}`,
                                        }}
                                    >
                                        {formatarHora(a.inicio)} {a.clienteNome}
                                    </span>
                                ))}
                                {ativos.length > 2 && (
                                    <span className="px-1 text-[10px]" style={{ color: 'var(--faint)' }}>
                                        +{ativos.length - 2}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
