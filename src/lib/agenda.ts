import type { IntervaloAgenda } from '@/services/agendamento.service';

export const SLOT_MIN = 30;
export const ROW_PX = 52;

export const STATUS_AGENDA = [
    { id: 'agendado', label: 'Agendado' },
    { id: 'confirmado', label: 'Confirmado' },
    { id: 'em_atendimento', label: 'Em atendimento' },
    { id: 'concluido', label: 'Concluído' },
    { id: 'cancelado', label: 'Cancelado' },
    { id: 'no_show', label: 'Não compareceu' },
] as const;

export function cloneDia(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function adicionarDias(d: Date, n: number): Date {
    const x = cloneDia(d);
    x.setDate(x.getDate() + n);
    return x;
}

export function inicioDaSemana(d: Date): Date {
    const x = cloneDia(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
}

export function paraDatetimeLocal(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function deDatetimeLocal(s: string): Date {
    return new Date(s);
}

export function hhmmParaMinutos(hhmm: string): number {
    const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

export function minutosDoInstante(iso: string): number {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
}

export function dataComMinutos(dia: Date, minutos: number): Date {
    const x = cloneDia(dia);
    x.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
    return x;
}

export function formatarHora(iso: string): string {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatarMinutos(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatarDuracaoMinutos(minutos: number): string {
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
}

export function formatarDiaLongo(d: Date): string {
    const texto = d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function partesDia(d: Date): { semana: string; data: string } {
    const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const data = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    return {
        semana: semana.charAt(0).toUpperCase() + semana.slice(1),
        data,
    };
}

export function formatarDiaColuna(d: Date): { dia: string; data: string } {
    return {
        dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        data: d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
    };
}

export function formatarFaixaSemana(ini: Date): string {
    const fim = adicionarDias(ini, 6);
    return `${ini.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${fim.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })}`;
}

export function isoData(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    const x = cloneDia(d);
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export function parseIsoData(s: string | null | undefined): Date | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : cloneDia(d);
}

export function inicioDoMes(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function adicionarMeses(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function formatarMesAno(d: Date): string {
    const texto = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Grade de 6 semanas (seg–dom) cobrindo o mês de `d`. */
export function celulasDoMes(d: Date): Date[] {
    const ini = inicioDaSemana(inicioDoMes(d));
    return Array.from({ length: 42 }, (_, i) => adicionarDias(ini, i));
}

export function mesmoDia(iso: string, dia: Date): boolean {
    const d = new Date(iso);
    return d.getFullYear() === dia.getFullYear() && d.getMonth() === dia.getMonth() && d.getDate() === dia.getDate();
}

export type Faixa = { inicio: number; fim: number };

/** Faixas de expediente do dia, em minutos, ordenadas. Vazio = folga. */
export function faixasNoDia(disp: IntervaloAgenda[], dia: Date): Faixa[] {
    return disp
        .filter((x) => x.diaSemana === dia.getDay())
        .map((x) => ({ inicio: hhmmParaMinutos(x.inicio), fim: hhmmParaMinutos(x.fim) }))
        .filter((f) => f.fim > f.inicio)
        .sort((a, b) => a.inicio - b.inicio);
}

/** Do início da primeira faixa ao fim da última (inclui as pausas). */
export function intervaloNoDia(disp: IntervaloAgenda[], dia: Date): Faixa | null {
    const faixas = faixasNoDia(disp, dia);
    if (!faixas.length) return null;
    return { inicio: faixas[0].inicio, fim: Math.max(...faixas.map((f) => f.fim)) };
}

/** Minutos trabalhados no dia, sem as pausas. */
export function minutosNoDia(disp: IntervaloAgenda[], dia: Date): number {
    return faixasNoDia(disp, dia).reduce((acc, f) => acc + (f.fim - f.inicio), 0);
}

export function resumoFaixas(faixas: Faixa[]): string {
    return faixas.map((f) => `${formatarMinutos(f.inicio)}–${formatarMinutos(f.fim)}`).join(', ');
}

/** Parte de um período (ISO) que cai dentro do dia, em minutos; null se não toca o dia. */
export function faixaNoDia(periodo: { inicio: string; fim: string }, dia: Date): Faixa | null {
    const d0 = cloneDia(dia).getTime();
    const d1 = adicionarDias(dia, 1).getTime();
    const ini = new Date(periodo.inicio).getTime();
    const fim = new Date(periodo.fim).getTime();
    if (fim <= d0 || ini >= d1) return null;
    return {
        inicio: ini <= d0 ? 0 : Math.round((ini - d0) / 60000),
        fim: fim >= d1 ? 24 * 60 : Math.round((fim - d0) / 60000),
    };
}

export function limitesGrade(listas: IntervaloAgenda[][], dia: Date): { inicio: number; fim: number } {
    let min = 24 * 60;
    let max = 0;
    for (const d of listas) {
        const iv = intervaloNoDia(d, dia);
        if (iv) {
            min = Math.min(min, iv.inicio);
            max = Math.max(max, iv.fim);
        }
    }
    if (max <= min) return { inicio: 8 * 60, fim: 20 * 60 };
    return { inicio: min, fim: max };
}

function deslocamentoMinutos(timeZone: string, d: Date): number | null {
    try {
        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).formatToParts(d);
        const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
        const comoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'));
        return Math.round((comoUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
    } catch {
        return null;
    }
}

/** A grade usa o relógio do navegador; avisa quando ele está num fuso diferente do da empresa. */
export function fusoDiferenteDoNavegador(fusoEmpresa: string | undefined, agora = new Date()): boolean {
    if (!fusoEmpresa) return false;
    const empresa = deslocamentoMinutos(fusoEmpresa, agora);
    return empresa !== null && empresa !== -agora.getTimezoneOffset();
}

export function gerarSlots(inicio: number, fim: number): number[] {
    const out: number[] = [];
    const a = Math.floor(inicio / SLOT_MIN) * SLOT_MIN;
    for (let m = a; m < fim; m += SLOT_MIN) out.push(m);
    return out;
}

export function slotDentro(faixas: Faixa[], minutos: number): boolean {
    return faixas.some((f) => minutos >= f.inicio && minutos < f.fim);
}

export function ocupaHorario(status: string): boolean {
    return status !== 'cancelado';
}

export function statusTerminal(status: string): boolean {
    return status === 'concluido' || status === 'cancelado' || status === 'no_show';
}

export function labelStatus(id: string): string {
    return STATUS_AGENDA.find((s) => s.id === id)?.label ?? id;
}

export function varianteStatus(id: string): 'copper' | 'ok' | 'warn' | 'danger' | 'faint' {
    switch (id) {
        case 'confirmado':
            return 'ok';
        case 'em_atendimento':
            return 'warn';
        case 'concluido':
            return 'faint';
        case 'cancelado':
        case 'no_show':
            return 'danger';
        default:
            return 'copper';
    }
}

export function transicoesDe(atual: string): { id: string; label: string; perigo?: boolean }[] {
    if (statusTerminal(atual)) return [];
    const acao: Record<string, string> = {
        agendado: 'Voltar a agendado',
        confirmado: 'Confirmar',
        em_atendimento: 'Em atendimento',
        concluido: 'Concluir',
        cancelado: 'Cancelar',
        no_show: 'Não compareceu',
    };
    return STATUS_AGENDA.filter((s) => s.id !== atual).map((s) => ({
        id: s.id,
        label: acao[s.id] ?? s.label,
        perigo: s.id === 'cancelado' || s.id === 'no_show',
    }));
}

export function iniciaisNome(nome: string): string {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

export function corToken(cor: string): string {
    return `var(--${cor || 'copper'})`;
}

export function corStatus(status: string): string {
    switch (status) {
        case 'confirmado':
            return 'var(--ok)';
        case 'em_atendimento':
            return 'var(--warn)';
        case 'concluido':
            return 'var(--faint)';
        case 'cancelado':
        case 'no_show':
            return 'var(--destructive)';
        default:
            return 'var(--copper)';
    }
}
