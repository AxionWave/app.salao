/**
 * A agenda trabalha no relógio da empresa, não no do navegador.
 *
 * As telas usam `Date` "de relógio": os campos locais (`getHours`, `getDate`…) são a hora da empresa.
 * `relogio` converte o instante da API para esse formato e `instante` faz o caminho de volta antes de enviar.
 * Sem fuso definido, os dois devolvem a mesma hora (comportamento do navegador).
 */

let fusoEmpresa: string | null = null;
const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(timeZone: string): Intl.DateTimeFormat {
    let f = formatadores.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        formatadores.set(timeZone, f);
    }
    return f;
}

/** Hora da empresa no instante `d`, lida como se fosse UTC (ms). */
function relogioComoUtc(timeZone: string, d: Date): number {
    const partes = formatador(timeZone).formatToParts(d);
    const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
    return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'), d.getMilliseconds());
}

function fusoValido(timeZone: string): boolean {
    try {
        formatador(timeZone);
        return true;
    } catch {
        return false;
    }
}

export function definirFuso(timeZone: string | null | undefined): void {
    fusoEmpresa = timeZone && fusoValido(timeZone) ? timeZone : null;
}

export function fusoAtual(): string | null {
    return fusoEmpresa;
}

/** Instante (ISO da API ou `Date`) → `Date` cujos campos locais são a hora da empresa. */
export function relogio(x: Date | string): Date {
    const d = typeof x === 'string' ? new Date(x) : x;
    if (!fusoEmpresa || Number.isNaN(d.getTime())) return new Date(d.getTime());
    const u = new Date(relogioComoUtc(fusoEmpresa, d));
    return new Date(
        u.getUTCFullYear(),
        u.getUTCMonth(),
        u.getUTCDate(),
        u.getUTCHours(),
        u.getUTCMinutes(),
        u.getUTCSeconds(),
        u.getUTCMilliseconds()
    );
}

/** Inverso de `relogio`: hora da empresa → instante real (para enviar à API). */
export function instante(d: Date): Date {
    if (!fusoEmpresa || Number.isNaN(d.getTime())) return new Date(d.getTime());
    const alvo = Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds()
    );
    // Duas passadas acertam o deslocamento quando o palpite cai do outro lado de uma troca de horário de verão.
    let t = alvo - (relogioComoUtc(fusoEmpresa, new Date(alvo)) - alvo);
    t = alvo - (relogioComoUtc(fusoEmpresa, new Date(t)) - t);
    return new Date(t);
}

/** Agora, no relógio da empresa. */
export function agoraNaEmpresa(): Date {
    return relogio(new Date());
}

/** Meia-noite de hoje, no relógio da empresa. */
export function hojeNaEmpresa(): Date {
    const d = agoraNaEmpresa();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** O navegador está num fuso diferente do da empresa (agora). */
export function navegadorEmOutroFuso(agora = new Date()): boolean {
    if (!fusoEmpresa) return false;
    return relogioComoUtc(fusoEmpresa, agora) !== agora.getTime() - agora.getTimezoneOffset() * 60_000;
}
