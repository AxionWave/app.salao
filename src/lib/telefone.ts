import { DDI_POR_ISO, MAX_NACIONAL, MIN_NACIONAL } from '@/lib/paises-telefone';

export const PAIS_PADRAO = 'BR';

export type PaisTelefone = {
    iso: string;
    ddi: string;
    nome: string;
    bandeira: string;
};

function nomesRegiao(): Intl.DisplayNames | null {
    try {
        return new Intl.DisplayNames(['pt-BR'], { type: 'region' });
    } catch {
        return null;
    }
}

export function bandeiraEmoji(iso: string): string {
    if (!/^[A-Za-z]{2}$/.test(iso)) return '';
    return iso
        .toUpperCase()
        .split('')
        .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
        .join('');
}

let cachePaises: PaisTelefone[] | null = null;

export function listarPaisesTelefone(): PaisTelefone[] {
    if (cachePaises) return cachePaises;
    const nomes = nomesRegiao();
    const todos = Object.keys(DDI_POR_ISO).map((iso) => ({
        iso,
        ddi: DDI_POR_ISO[iso],
        nome: nomes?.of(iso) ?? iso,
        bandeira: bandeiraEmoji(iso),
    }));
    const br = todos.filter((p) => p.iso === PAIS_PADRAO);
    const resto = todos
        .filter((p) => p.iso !== PAIS_PADRAO)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    cachePaises = [...br, ...resto];
    return cachePaises;
}

export function somenteDigitos(valor: string): string {
    return valor.replace(/\D/g, '');
}

export function maxNacional(iso: string): number {
    return MAX_NACIONAL[iso] ?? 12;
}

export function minNacional(iso: string): number {
    return MIN_NACIONAL[iso] ?? 8;
}

export function ddiDoPais(iso: string): string {
    return DDI_POR_ISO[iso] ?? DDI_POR_ISO[PAIS_PADRAO];
}

function mascarar(digitos: string, padrao: string): string {
    let i = 0;
    let out = '';
    for (const c of padrao) {
        if (i >= digitos.length) break;
        if (c === '0') {
            out += digitos[i];
            i += 1;
        } else {
            out += c;
        }
    }
    if (i < digitos.length) out += digitos.slice(i);
    return out;
}

export function formatarNacional(iso: string, nacional: string): string {
    const d = somenteDigitos(nacional).slice(0, maxNacional(iso));
    if (!d) return '';
    if (iso === 'BR') {
        if (d.length <= 2) return d.length === 2 ? `(${d}` : d;
        if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
        if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    if (iso === 'US' || iso === 'CA') {
        return mascarar(d, '(000) 000-0000');
    }
    if (iso === 'PT') return mascarar(d, '000 000 000');
    if (iso === 'AR') return mascarar(d, '(000) 000-0000');
    if (iso === 'MX') return mascarar(d, '000 000 0000');
    if (iso === 'GB') return mascarar(d, '00000 000000');
    if (iso === 'FR') return mascarar(d, '00 00 00 00 00');
    if (iso === 'DE') return mascarar(d, '000 00000000');
    if (iso === 'ES') return mascarar(d, '000 00 00 00');
    if (iso === 'IT') return mascarar(d, '000 000 0000');
    if (iso === 'AU') return mascarar(d, '0000 000 000');
    if (iso === 'CL') return mascarar(d, '0 0000 0000');
    if (iso === 'CO') return mascarar(d, '000 000 0000');
    if (iso === 'PE') return mascarar(d, '000 000 000');
    if (iso === 'UY') return mascarar(d, '0000 0000');
    return d.replace(/(\d{2,4})(?=\d)/g, '$1 ').trim();
}

export function nacionalDoValor(valor: string, iso: string): string {
    const d = somenteDigitos(valor);
    if (!d) return '';
    const ddi = ddiDoPais(iso);
    if (iso === 'BR') {
        if (d.startsWith('55') && d.length >= 12) return d.slice(2).slice(0, maxNacional(iso));
        return d.slice(0, maxNacional(iso));
    }
    if (d.startsWith(ddi) && d.length > ddi.length) {
        return d.slice(ddi.length).slice(0, maxNacional(iso));
    }
    return d.slice(0, maxNacional(iso));
}

export function telefoneParaArmazenar(nacionalOuCompleto: string, iso: string): string {
    const nacional = nacionalDoValor(nacionalOuCompleto, iso);
    if (!nacional) return '';
    if (iso === 'BR') return nacional.slice(0, 11);
    return `${ddiDoPais(iso)}${nacional}`.slice(0, 15);
}

const DDI_ORDENADOS = [...new Set(Object.values(DDI_POR_ISO))].sort((a, b) => b.length - a.length);

export function paisDoTelefone(valor: string, atual: string = PAIS_PADRAO): string {
    const d = somenteDigitos(valor);
    if (!d) return atual || PAIS_PADRAO;
    if (d.length <= 11) return PAIS_PADRAO;
    if (d.startsWith('55') && d.length >= 12 && d.length <= 13) return PAIS_PADRAO;
    for (const ddi of DDI_ORDENADOS) {
        if (ddi === '55') continue;
        if (!d.startsWith(ddi)) continue;
        const nacional = d.slice(ddi.length);
        if (nacional.length < 6) continue;
        const candidato = Object.keys(DDI_POR_ISO).find((iso) => DDI_POR_ISO[iso] === ddi);
        if (candidato) return candidato;
    }
    return atual || PAIS_PADRAO;
}

export function formatarTelefoneExibicao(valor: string): string {
    const d = somenteDigitos(valor);
    if (!d) return '';
    const iso = paisDoTelefone(d);
    const nacional = nacionalDoValor(d, iso);
    const local = formatarNacional(iso, nacional);
    if (iso === 'BR') return local;
    return `+${ddiDoPais(iso)} ${local}`.trim();
}

export function formatarTelefoneDigitacao(valor: string, iso: string): string {
    return formatarNacional(iso, nacionalDoValor(valor, iso));
}

export function telefoneValido(valor: string, iso?: string): boolean {
    const d = somenteDigitos(valor);
    if (!d) return false;
    const pais = iso ?? paisDoTelefone(d);
    const nacional = nacionalDoValor(d, pais);
    const n = nacional.length;
    return n >= minNacional(pais) && n <= maxNacional(pais) && d.length <= 15;
}

export function placeholderTelefone(iso: string): string {
    if (iso === 'BR') return '(11) 99999-9999';
    if (iso === 'US' || iso === 'CA') return '(201) 555-0123';
    if (iso === 'PT') return '912 345 678';
    return 'Número';
}
