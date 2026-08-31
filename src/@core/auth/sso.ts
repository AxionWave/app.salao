import { AUTH_STORAGE_KEYS } from './auth.storage';
import { authService } from '../services/auth.service';

/** Hash `#sso=` — o fragmento não vai para o servidor nem para o Gateway. */
const SSO_PREFIX = 'sso=';

function fromBase64Utf8(b64: string): string {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function toBase64Utf8(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => {
        bin += String.fromCharCode(b);
    });
    return btoa(bin);
}

export function consumeEnterpriseSsoFromHash(): boolean {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw.startsWith(SSO_PREFIX)) {
        return false;
    }
    try {
        const packed = decodeURIComponent(raw.slice(SSO_PREFIX.length));
        const data = JSON.parse(fromBase64Utf8(packed)) as {
            access_token?: string;
            refresh_token?: string;
            token_type?: string;
            expires_in?: string;
            must_change_password?: string;
        };
        if (!data.access_token) {
            return false;
        }
        authService.applySession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_type: data.token_type,
            expires_in: data.expires_in,
            must_change_password: data.must_change_password,
        });
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        return true;
    } catch {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        return false;
    }
}

export function buildSsoLaunchUrl(targetHref: string): string {
    const access = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    if (!access) {
        return targetHref;
    }
    const payload = {
        access_token: access,
        refresh_token: localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN) || undefined,
        token_type: localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_TYPE) || 'Bearer',
        expires_in: localStorage.getItem(AUTH_STORAGE_KEYS.EXPIRES_IN) || undefined,
        must_change_password: localStorage.getItem(AUTH_STORAGE_KEYS.MUST_CHANGE_PASSWORD) || undefined,
    };
    const packed = encodeURIComponent(toBase64Utf8(JSON.stringify(payload)));
    const url = new URL(targetHref, window.location.href);
    url.hash = `sso=${packed}`;
    return url.toString();
}
