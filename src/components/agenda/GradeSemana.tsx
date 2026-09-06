import { Button } from '@/components/ui';
import {
    cloneDia,
    corStatus,
    corToken,
    dataComMinutos,
    formatarDiaColuna,
    formatarHora,
    intervaloNoDia,
    labelStatus,
    mesmoDia,
    ocupaHorario,
} from '@/lib/agenda';
import { rotuloServicos, type Agendamento, type ProfissionalAgenda } from '@/services/agendamento.service';

export default function GradeSemana({
    dias,
    profissionais,
    agendamentos,
    onSlot,
    onAbrir,
}: {
    dias: Date[];
    profissionais: ProfissionalAgenda[];
    agendamentos: Agendamento[];
    onSlot: (profissionalId: number, inicio: Date) => void;
    onAbrir: (a: Agendamento) => void;
}) {
    const hoje = cloneDia(new Date());
    const unico = profissionais.length === 1 ? profissionais[0] : null;

    return (
        <div className="overflow-x-auto">
            <div className="grid min-w-[56rem] gap-2.5" style={{ gridTemplateColumns: 'repeat(7, minmax(8rem, 1fr))' }}>
                {dias.map((dia) => {
                    const rotulo = formatarDiaColuna(dia);
                    const doDia = agendamentos
                        .filter((a) => mesmoDia(a.inicio, dia))
                        .sort((a, b) => a.inicio.localeCompare(b.inicio));
                    const ativos = doDia.filter((a) => ocupaHorario(a.status)).length;
                    const ehHoje = dia.getTime() === hoje.getTime();
                    const iv = unico ? intervaloNoDia(unico.disponibilidades, dia) : null;
                    return (
                        <div
                            key={dia.toISOString()}
                            className="flex min-h-[22rem] flex-col overflow-hidden rounded-lyra border"
                            style={{
                                borderColor: ehHoje ? 'var(--copper)' : 'var(--line)',
                                background: 'var(--panel)',
                                boxShadow: ehHoje ? '0 0 0 1px color-mix(in oklab, var(--copper) 35%, transparent)' : undefined,
                            }}
                        >
                            <div
                                className="px-2.5 py-2"
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
                                    {ativos === 0 ? 'Livre' : `${ativos} horário${ativos === 1 ? '' : 's'}`}
                                </p>
                            </div>
                            <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
                                {doDia.length === 0 && (
                                    <p className="px-1 py-3 text-center text-[11px]" style={{ color: 'var(--faint)' }}>
                                        Sem horários
                                    </p>
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
                                    disabled={Boolean(unico && !iv)}
                                    onClick={() => {
                                        const prof = unico ?? profissionais[0];
                                        if (!prof) return;
                                        const intervalo = intervaloNoDia(prof.disponibilidades, dia);
                                        const minutos = intervalo?.inicio ?? 9 * 60;
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
