import type { ReactNode } from 'react';

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export interface Horario {
    inicio: string;
    hora: string;
}

export function hojeNoFuso(fuso: string): string {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
            new Date(),
        );
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
}

export function somarDias(dia: string, n: number): string {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function rotuloDia(dia: string) {
    const d = new Date(`${dia}T12:00:00Z`);
    return {
        semana: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(d).replace('.', ''),
        numero: d.getUTCDate(),
        mes: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', ''),
    };
}

export function quando(iso: string, fuso: string, curto = false): string {
    const opcoes: Intl.DateTimeFormatOptions = curto
        ? { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' };
    try {
        return new Intl.DateTimeFormat('pt-BR', { ...opcoes, timeZone: fuso }).format(new Date(iso));
    } catch {
        return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(iso));
    }
}

export function Cartao({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-lyra border p-5 sm:p-6" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
            {children}
        </div>
    );
}

export function Titulo({ children, voltar }: { children: ReactNode; voltar?: () => void }) {
    return (
        <div className="mb-4 flex items-center gap-2">
            {voltar && (
                <button
                    type="button"
                    onClick={voltar}
                    aria-label="Voltar"
                    className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ color: 'var(--muted-foreground)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </button>
            )}
            <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                {children}
            </h2>
        </div>
    );
}

export function Opcao({
    selecionado,
    onClick,
    titulo,
    detalhe,
    lateral,
}: {
    selecionado: boolean;
    onClick: () => void;
    titulo: string;
    detalhe?: string;
    lateral?: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={selecionado}
            onClick={onClick}
            className="flex w-full items-center justify-between gap-3 rounded-lyra border px-4 py-3 text-left transition-colors"
            style={{
                borderColor: selecionado ? 'var(--copper)' : 'var(--line)',
                background: selecionado ? 'color-mix(in oklab, var(--copper) 10%, var(--panel))' : 'var(--card)',
            }}
        >
            <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {titulo}
                </span>
                {detalhe && (
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {detalhe}
                    </span>
                )}
            </span>
            {lateral && (
                <span className="shrink-0 text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                    {lateral}
                </span>
            )}
        </button>
    );
}

export function SeletorDia({ dias, dia, onChange }: { dias: string[]; dia: string; onChange: (dia: string) => void }) {
    return (
        <div
            className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2"
            style={{ scrollbarWidth: 'thin' }}
            role="listbox"
            aria-label="Dia"
        >
            {dias.map((d) => {
                const r = rotuloDia(d);
                const ativo = d === dia;
                return (
                    <button
                        key={d}
                        type="button"
                        role="option"
                        aria-selected={ativo}
                        onClick={() => onChange(d)}
                        className="flex w-14 shrink-0 flex-col items-center rounded-lyra border py-2"
                        style={{
                            borderColor: ativo ? 'var(--copper)' : 'var(--line)',
                            background: ativo ? 'var(--copper)' : 'var(--card)',
                            color: ativo ? '#fff' : 'var(--ink)',
                        }}
                    >
                        <span className="text-[11px] uppercase">{r.semana}</span>
                        <span className="text-lg font-semibold leading-tight">{r.numero}</span>
                        <span className="text-[11px]">{r.mes}</span>
                    </button>
                );
            })}
        </div>
    );
}

export function GradeHorarios({
    carregando,
    livres,
    selecionado,
    onSelect,
}: {
    carregando: boolean;
    livres: Horario[];
    selecionado: Horario | null;
    onSelect: (h: Horario) => void;
}) {
    if (carregando) {
        return (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Buscando horários…
            </p>
        );
    }
    if (livres.length === 0) {
        return (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Sem horários livres neste dia. Tente outro.
            </p>
        );
    }
    return (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {livres.map((h) => {
                const ativo = selecionado?.inicio === h.inicio;
                return (
                    <button
                        key={h.inicio}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => onSelect(h)}
                        className="rounded-lyra border py-2 text-sm font-medium tabular-nums"
                        style={{
                            borderColor: ativo ? 'var(--copper)' : 'var(--line)',
                            background: ativo ? 'var(--copper)' : 'var(--card)',
                            color: ativo ? '#fff' : 'var(--ink)',
                        }}
                    >
                        {h.hora}
                    </button>
                );
            })}
        </div>
    );
}

/** Horários de vários profissionais numa grade só, sem repetir o mesmo início. */
export function juntarHorarios(
    profissionais: { profissionalId: number; horarios: Horario[] }[],
    profissionalId: number | null,
): Horario[] {
    const porInicio = new Map<string, Horario>();
    profissionais
        .filter((p) => profissionalId === null || p.profissionalId === profissionalId)
        .flatMap((p) => p.horarios)
        .forEach((h) => porInicio.set(h.inicio, h));
    return [...porInicio.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export interface EventoAgenda {
    /** Mesmo UID dos convites por e-mail: o calendário atualiza o evento em vez de duplicar. */
    cadeia: number;
    inicio: string;
    fim: string;
    servicos: string[];
    profissional: string;
}

const utcCompacto = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function resumoEvento(ev: EventoAgenda, empresa: string) {
    return ev.servicos.length > 0 ? `${ev.servicos.join(', ')} – ${empresa}` : empresa;
}

function linkGoogleAgenda(ev: EventoAgenda, empresa: string, local: string | null): string {
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: resumoEvento(ev, empresa),
        dates: `${utcCompacto(ev.inicio)}/${utcCompacto(ev.fim)}`,
        details: `Com ${ev.profissional}`,
    });
    if (local) params.set('location', local);
    return `https://calendar.google.com/calendar/render?${params}`;
}

function baixarIcs(ev: EventoAgenda, empresa: string, local: string | null) {
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const linhas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Lumen//Lyra//PT-BR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:lyra-agendamento-${ev.cadeia}@lyra.lumensoft.com.br`,
        `SEQUENCE:${Math.floor(Date.now() / 60000)}`,
        `DTSTAMP:${utcCompacto(new Date().toISOString())}`,
        `DTSTART:${utcCompacto(ev.inicio)}`,
        `DTEND:${utcCompacto(ev.fim)}`,
        `SUMMARY:${esc(resumoEvento(ev, empresa))}`,
        `DESCRIPTION:${esc(`Com ${ev.profissional}`)}`,
        ...(local ? [`LOCATION:${esc(local)}`] : []),
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
    ];
    const url = URL.createObjectURL(new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'horario.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AdicionarAgenda({ evento, empresa, local }: { evento: EventoAgenda; empresa: string; local: string | null }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span>Adicionar à agenda:</span>
            <a
                href={linkGoogleAgenda(evento, empresa, local)}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
                style={{ color: 'var(--copper)' }}
            >
                Google
            </a>
            <button
                type="button"
                className="font-medium underline"
                style={{ color: 'var(--copper)' }}
                onClick={() => baixarIcs(evento, empresa, local)}
            >
                Apple / Outlook (.ics)
            </button>
        </div>
    );
}
