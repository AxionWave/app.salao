/**
 * Troca local ↔ homolog sem editar URL.
 *
 * .env.local (híbrido Lyra):
 *   VITE_GATEWAY_AMBIENTE=homolog   → login / oAuth / Core (VPS)
 *   VITE_LYRA_AMBIENTE=local        → API Lyra em http://localhost:8092
 */

export type Ambiente = 'local' | 'homolog';

export const GATEWAY_BY_AMBIENTE: Record<Ambiente, string> = {
    local: 'http://localhost:8080',
    homolog: 'https://enterprise.lumenemotion.com.br',
};

export const LYRA_API_LOCAL = 'http://localhost:8092';


export function parseAmbiente(value: unknown): Ambiente | null {
    const v = String(value ?? '')
        .trim()
        .toLowerCase();
    if (v === 'local' || v === 'homolog' || v === 'hmg') return v === 'hmg' ? 'homolog' : v;
    if (v === 'prd' || v === 'prod' || v === 'producao' || v === 'produção' || v === 'production') {
        return 'homolog';
    }
    if (v === 'dev' || v === 'des' || v === 'development') return 'local';
    return null;
}

export function resolveGatewayUrl(productAmbiente?: unknown): { url: string; ambiente: Ambiente } {
    const product = parseAmbiente(productAmbiente);
    const gateway = parseAmbiente(import.meta.env.VITE_GATEWAY_AMBIENTE);
    const app = parseAmbiente(import.meta.env.VITE_APP_AMBIENTE);
    const explicit = String(import.meta.env.VITE_GATEWAY_URL || '')
        .trim()
        .replace(/\/$/, '');

    const fromUrl: Ambiente | null = explicit
        ? explicit.includes('localhost') || explicit.includes('127.0.0.1')
            ? 'local'
            : 'homolog'
        : null;
    const ambiente: Ambiente = gateway || app || fromUrl || product || 'local';
    const url = GATEWAY_BY_AMBIENTE[ambiente];

    const oauth = parseAmbiente(import.meta.env.VITE_OAUTH_AMBIENTE);
    if (oauth && oauth !== ambiente) {
        console.warn(
            `[enterprise] VITE_OAUTH_AMBIENTE=${oauth} ignorado no front. ` +
                `O browser só chama o Gateway (${ambiente} → ${url}). ` +
                `Para oAuth local, use VITE_GATEWAY_AMBIENTE=local e suba o Gateway na sua máquina.`
        );
    }

    return { url, ambiente };
}

/**
 * API de negócio do Lyra — independente do Gateway.
 * `VITE_LYRA_AMBIENTE=local` → :8092 na máquina. Senão, o mesmo host do Gateway (VPS).
 */
export function resolveProductApiUrl(): string {
    const lyra = parseAmbiente(import.meta.env.VITE_LYRA_AMBIENTE);
    if (lyra === 'local') return LYRA_API_LOCAL;
    return resolveGatewayUrl().url;
}

/** Início do ASC (hub). VITE_ASC_AMBIENTE, senão localhost → :3000, senão /app/ na VPS. */
export function urlInicioAsc(): string {
    const explicit = parseAmbiente(import.meta.env.VITE_ASC_AMBIENTE);
    const fromHost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'local'
            : 'homolog';
    const ambiente: Ambiente = explicit || fromHost;
    return ambiente === 'local'
        ? 'http://localhost:3000/inicio'
        : 'https://enterprise.lumenemotion.com.br/app/inicio';
}

/** Primeiro acesso / senha inicial no ASC (não clonamos o fluxo no Lyra). */
export function urlPrimeiroAcessoAsc(): string {
    const explicit = parseAmbiente(import.meta.env.VITE_ASC_AMBIENTE);
    const fromHost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'local'
            : 'homolog';
    const ambiente: Ambiente = explicit || fromHost;
    return ambiente === 'local'
        ? 'http://localhost:3000/primeiro-acesso'
        : 'https://enterprise.lumenemotion.com.br/app/primeiro-acesso';
}
