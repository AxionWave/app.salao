import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

/**
 * Avisos da agenda no aparelho com o Lyra fechado (Web Push). A assinatura é por navegador e fica
 * ligada ao usuário que ativou; ao sair, ela é removida para o próximo usuário não receber os avisos.
 */
export type EstadoPush = 'indisponivel' | 'instalar' | 'bloqueado' | 'desligado' | 'ligado';

const base = `${API_CONFIG.productBase}/push`;
let chaveCache: Promise<string | null> | null = null;

export function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    });
}

function suportado(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** No iPhone, o Web Push só existe com o Lyra instalado na tela de início. */
function iphoneSemInstalar(): boolean {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const instalado =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return ios && !instalado;
}

function chavePublica(): Promise<string | null> {
    chaveCache ??= lyraClient
        .get<{ chavePublica: string | null }>(`${base}/chave`)
        .then((r) => r.data.chavePublica)
        .catch(() => {
            chaveCache = null;
            return null;
        });
    return chaveCache;
}

function bytes(base64url: string): Uint8Array<ArrayBuffer> {
    const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function descricaoAparelho(): string {
    const ua = navigator.userAgent;
    const navegador = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    const sistema = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    return sistema ? `${navegador} no ${sistema}` : navegador;
}

async function assinaturaAtual(): Promise<PushSubscription | null> {
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) ?? null;
}

async function enviar(sub: PushSubscription) {
    const json = sub.toJSON();
    await lyraClient.post(`${base}/assinaturas`, {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        aparelho: descricaoAparelho(),
    });
}

export async function estadoPush(): Promise<EstadoPush> {
    if (iphoneSemInstalar()) return 'instalar';
    if (!suportado() || !(await chavePublica())) return 'indisponivel';
    if (Notification.permission === 'denied') return 'bloqueado';
    const sub = await assinaturaAtual();
    return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado';
}

/** Reenvia a assinatura deste aparelho (o navegador pode trocá-la, e garante que é do usuário atual). */
export async function sincronizarPush(): Promise<void> {
    if (!suportado() || Notification.permission !== 'granted') return;
    const sub = await assinaturaAtual();
    if (sub) await enviar(sub).catch(() => undefined);
}

export async function ligarPush(): Promise<EstadoPush> {
    const chave = await chavePublica();
    if (!chave) return 'indisponivel';
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desligado';
    const reg = await navigator.serviceWorker.ready;
    const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(chave) }));
    await enviar(sub);
    return 'ligado';
}

/** Remove a assinatura na API (precisa do token: chamar antes de limpar a sessão) e no navegador. */
export async function desligarPush(): Promise<void> {
    if (!suportado()) return;
    const sub = await assinaturaAtual();
    if (!sub) return;
    await lyraClient.post(`${base}/assinaturas/remover`, { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => false);
}
