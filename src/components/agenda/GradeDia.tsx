import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTelaLarga } from '@/lib/useMediaQuery';
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
import { agoraNaEmpresa, hojeNaEmpresa } from '@/lib/fuso';
import { rotuloServicos, type Agendamento, type ProfissionalAgenda } from '@/services/agendamento.service';
import { bloqueiaProfissional, type Bloqueio } from '@/services/bloqueio.service';
import { useTermos } from '@/contexts/TermosContext';

function useAgora(ativo: boolean) {
    const [agora, setAgora] = useState(() => agoraNaEmpresa());
    useEffect(() => {
        if (!ativo) return;
        const t = window.setInterval(() => setAgora(agoraNaEmpresa()), 30_000);
        return () => window.clearInterval(t);
    }, [ativo]);
    return agora;
}

const LINHA_MIN = 28;
const LINHA_MAX = 64;
/** Mesma tolerância da API para marcar um horário que acabou de começar. */
const TOLERANCIA_PASSADO_MIN = 5;
/** Margem entre o fim da grade e o fim da janela quando ela se ajusta à tela. */
const FOLGA_INFERIOR_PX = 48;

/** Altura da caixa da grade: a definida por quem usa, ou o que sobra da janela abaixo dela. */
function useAlturaCaixa(ref: RefObject<HTMLDivElement>, altura: string | undefined) {
    const [px, setPx] = useState<number | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const medir = () =>
            setPx(
                altura
                    ? el.clientHeight
                    : Math.max(240, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - FOLGA_INFERIOR_PX)
            );
        medir();
        if (altura) {
            const ro = new ResizeObserver(medir);
            ro.observe(el);
            return () => ro.disconnect();
        }
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [ref, altura]);
    return px;
}

export default function GradeDia({
    dia,
    profissionais,
    agendamentos,
    bloqueios = [],
    altura,
    onSlot,
    onAbrir,
    onBloqueio,
}: {
    dia: Date;
    profissionais: ProfissionalAgenda[];
    agendamentos: Agendamento[];
    bloqueios?: Bloqueio[];
    /** Altura fixa (CSS) da grade; sem ela, a grade ocupa o resto da janela. */
    altura?: string;
    onSlot: (profissionalId: number, inicio: Date) => void;
    onAbrir: (a: Agendamento) => void;
    onBloqueio?: (b: Bloqueio) => void;
}) {
    const termos = useTermos();
    const telaLarga = useTelaLarga();
    const caixaRef = useRef<HTMLDivElement>(null);
    const cabecalhoRef = useRef<HTMLDivElement>(null);
    const alturaCaixa = useAlturaCaixa(caixaRef, altura);
    const limites = limitesGrade(
        profissionais.map((p) => p.disponibilidades),
        dia,
        agendamentos.filter((a) => profissionais.some((p) => p.id === a.profissionalId))
    );
    const slots = gerarSlots(limites.inicio, limites.fim);
    const hoje = hojeNaEmpresa().getTime();
    const diaMs = cloneDia(dia).getTime();
    const ehHoje = diaMs === hoje;
    const agora = useAgora(ehHoje);
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    const passadoAntesDe = diaMs < hoje ? Infinity : ehHoje ? agoraMin - TOLERANCIA_PASSADO_MIN : -Infinity;
    const cabecalhoPx = cabecalhoRef.current?.offsetHeight ?? 58;
    const linha =
        alturaCaixa === null
            ? ROW_PX
            : Math.min(LINHA_MAX, Math.max(LINHA_MIN, Math.floor((alturaCaixa - cabecalhoPx - 2) / Math.max(slots.length, 1))));
    const linhaAgora =
        ehHoje && agoraMin >= limites.inicio && agoraMin < limites.fim
            ? ((agoraMin - limites.inicio) / SLOT_MIN) * linha
            : null;
    const colunaMinRem = telaLarga ? 12 : 9.5;
    const cols = `3.75rem repeat(${Math.max(profissionais.length, 1)}, minmax(${colunaMinRem}rem, 1fr))`;

    const rolouPara = useRef('');
    useEffect(() => {
        const el = caixaRef.current;
        const chave = `${diaMs}:${linha}`;
        if (!el || alturaCaixa === null || rolouPara.current === chave) return;
        rolouPara.current = chave;
        el.scrollTop = linhaAgora !== null ? Math.max(0, linhaAgora - linha) : 0;
    }, [diaMs, linha, alturaCaixa, linhaAgora]);

    return (
        <div
            ref={caixaRef}
            className="overflow-auto"
            style={{ height: altura ?? (alturaCaixa !== null ? alturaCaixa : undefined) }}
        >
            <div
                className="md:min-w-[42rem]"
                style={{ minWidth: `calc(3.75rem + ${Math.max(profissionais.length, 1)} * ${colunaMinRem}rem)` }}
            >
                <div ref={cabecalhoRef} className="sticky top-0 z-30 grid" style={{ gridTemplateColumns: cols }}>
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
                                            {!p.ativo
                                                ? `Inativo · ${n} ${termos.contagem('agendamento', n)}`
                                                : faixas.length
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
                                    height: linha,
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
                            linha={linha}
                            passadoAntesDe={passadoAntesDe}
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
        </div>
    );
}

function ColunaProfissional({
    dia,
    profissional,
    slots,
    gradeInicio,
    linha,
    passadoAntesDe,
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
    linha: number;
    /** Slots que começam antes deste minuto já passaram e não podem ser marcados. */
    passadoAntesDe: number;
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
    const ocupacoes = agendamentos
        .filter((a) => ocupaHorario(a.status))
        .map((a) => ({
            inicio: minutosDoInstante(a.inicio),
            fim: minutosDoInstante(a.fim) + (a.intervaloAposMinutos ?? 0),
        }));
    const ocupado = (m: number) => ocupacoes.some((o) => m >= o.inicio && m < o.fim);
    const cancelados = agendamentos.filter((a) => !ocupaHorario(a.status));
    const temCanceladoJunto = (a: Agendamento) =>
        cancelados.some((c) => c.id !== a.id && c.inicio < a.fim && c.fim > a.inicio);
    return (
        <div
            className="relative border-l"
            style={{ borderColor: 'var(--line)', height: slots.length * linha }}
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
                    const livre =
                        profissional.ativo && m >= passadoAntesDe && slotDentro(faixas, m) && !bloqueado(m) && !ocupado(m);
                    return (
                        <button
                            key={m}
                            type="button"
                            onClick={() => onSlot(profissional.id, dataComMinutos(dia, m))}
                            disabled={!livre}
                            className="lyra-agenda-slot group absolute left-0 right-0 border-t"
                            style={{
                                top: i * linha,
                                height: linha,
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
                    linha={linha}
                    onAbrir={onBloqueio}
                />
            ))}
            {agendamentos.map((a) => (
                <BlocoAgendamento
                    key={a.id}
                    a={a}
                    gradeInicio={gradeInicio}
                    linha={linha}
                    onAbrir={onAbrir}
                    abrirEspaco={ocupaHorario(a.status) && temCanceladoJunto(a)}
                />
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
    linha,
    onAbrir,
}: {
    b: Bloqueio;
    faixa: Faixa;
    gradeInicio: number;
    linha: number;
    onAbrir?: (b: Bloqueio) => void;
}) {
    const top = ((faixa.inicio - gradeInicio) / SLOT_MIN) * linha + 2;
    const height = Math.max(linha / 2, ((faixa.fim - faixa.inicio) / SLOT_MIN) * linha - 4);
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

/** Cancelado vira uma faixa estreita à direita: continua clicável (para remarcar) sem tampar o horário. */
const LARGURA_CANCELADO = '30%';

function BlocoAgendamento({
    a,
    gradeInicio,
    linha,
    onAbrir,
    abrirEspaco,
}: {
    a: Agendamento;
    gradeInicio: number;
    linha: number;
    onAbrir: (a: Agendamento) => void;
    /** Deixa à direita o espaço do cancelado que estava no mesmo horário. */
    abrirEspaco: boolean;
}) {
    const ini = minutosDoInstante(a.inicio);
    const fim = minutosDoInstante(a.fim);
    const top = ((ini - gradeInicio) / SLOT_MIN) * linha + 3;
    const height = Math.max(linha - 6, ((fim - ini) / SLOT_MIN) * linha - 6);
    const cancelado = !ocupaHorario(a.status);
    const alto = height >= 72;
    const compacto = height < 40;
    const preparo = cancelado ? 0 : a.intervaloAposMinutos ?? 0;
    const lados = cancelado
        ? { left: 'auto', right: '0.375rem', width: LARGURA_CANCELADO }
        : { left: '0.375rem', right: abrirEspaco ? `calc(${LARGURA_CANCELADO} + 0.625rem)` : '0.375rem' };
    if (cancelado) {
        return (
            <button
                type="button"
                onClick={() => onAbrir(a)}
                className="lyra-agenda-bloco absolute z-[11] overflow-hidden rounded-lg px-1.5 py-1 text-left"
                style={{
                    ...lados,
                    top,
                    height,
                    background: 'var(--panel2)',
                    border: '1px dashed var(--line)',
                }}
                title={`${labelStatus(a.status)}: ${a.clienteNome} · ${formatarHora(a.inicio)}`}
            >
                <p className="truncate text-[10px] font-semibold line-through" style={{ color: 'var(--faint)' }}>
                    {a.clienteNome}
                </p>
                <p className="truncate text-[10px]" style={{ color: 'var(--faint)' }}>
                    {labelStatus(a.status)}
                </p>
            </button>
        );
    }
    return (
        <>
            {preparo > 0 && (
                <div
                    className="pointer-events-none absolute z-[9] rounded-b-lg px-2.5 text-[10px]"
                    style={{
                        ...lados,
                        top: top + height,
                        height: Math.max(6, (preparo / SLOT_MIN) * linha),
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
                className={`lyra-agenda-bloco absolute z-10 overflow-hidden rounded-lg px-2.5 text-left ${compacto ? 'py-0.5' : 'py-1.5'}`}
                style={{
                    ...lados,
                    top,
                    height,
                    background: `color-mix(in oklab, ${corToken(a.profissionalCor)} 16%, var(--card))`,
                    border: `1px solid color-mix(in oklab, ${corToken(a.profissionalCor)} 35%, var(--line))`,
                    borderLeft: `3px solid ${corToken(a.profissionalCor)}`,
                    boxShadow: 'var(--lyra-shadow-sm)',
                }}
            >
                <div className={`flex justify-between gap-1 ${compacto ? 'items-center' : 'items-start'}`}>
                    <p className="truncate text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                        {a.clienteNome}
                        {compacto && (
                            <span className="ml-1.5 font-mono text-[10px] font-normal tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                                {formatarHora(a.inicio)}
                            </span>
                        )}
                    </p>
                    <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${compacto ? '' : 'mt-0.5'}`}
                        style={{ background: corStatus(a.status) }}
                        title={labelStatus(a.status)}
                    />
                </div>
                {!compacto && (
                    <p className="truncate font-mono text-[10px] tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                        {formatarHora(a.inicio)}
                        {alto ? ` – ${formatarHora(a.fim)}` : ''}
                    </p>
                )}
                {alto && (
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--faint)' }}>
                        {rotuloServicos(a)}
                    </p>
                )}
            </button>
        </>
    );
}
