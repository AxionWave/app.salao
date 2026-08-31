import { AUTH_STORAGE_KEYS, clearAuthSessionStorage } from '../auth/auth.storage';
import { httpClient, oauthClient } from './http.service';

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    must_change_password?: boolean;
}

export interface StoredUserInfo {
    userId: string;
    username: string;
    email: string;
    empresaId: string;
    roles: string[];
    modulos: string[];
}

const parseJwt = (token: string): Record<string, unknown> | null => {
    try {
        const base64Url = token.split('.')[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        return JSON.parse(decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        ));
    } catch {
        return null;
    }
};

export const authService = {
    async login(credentials: LoginRequest): Promise<LoginResponse> {
        const response = await oauthClient.post<LoginResponse>('/login', credentials);
        const data = response.data;
        localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_TYPE, data.token_type ?? 'Bearer');
        localStorage.setItem(AUTH_STORAGE_KEYS.EXPIRES_IN, String(data.expires_in ?? 0));
        if (data.must_change_password !== undefined) {
            localStorage.setItem(AUTH_STORAGE_KEYS.MUST_CHANGE_PASSWORD, JSON.stringify(data.must_change_password));
        }
        const decoded = parseJwt(data.access_token);
        if (decoded) {
            const userInfo: StoredUserInfo = {
                userId: String(decoded.userId ?? ''),
                username: String(decoded.username ?? ''),
                email: String(decoded.email ?? ''),
                empresaId: String(decoded.empresaId ?? ''),
                roles: Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [],
                modulos: Array.isArray(decoded.modulos) ? (decoded.modulos as string[]) : [],
            };
            localStorage.setItem(AUTH_STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
        }
        return data;
    },

    logout(): void {
        clearAuthSessionStorage();
    },

    getAccessToken(): string | null {
        return localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    },

    isAuthenticated(): boolean {
        return !!this.getAccessToken();
    },

    getStoredUserInfo(): StoredUserInfo | null {
        const info = localStorage.getItem(AUTH_STORAGE_KEYS.USER_INFO);
        return info ? (JSON.parse(info) as StoredUserInfo) : null;
    },

    getModulos(): string[] {
        const token = this.getAccessToken();
        if (token) {
            const decoded = parseJwt(token);
            if (decoded?.modulos && Array.isArray(decoded.modulos)) {
                return (decoded.modulos as unknown[]).map((m) => String(m).trim()).filter(Boolean);
            }
        }
        return this.getStoredUserInfo()?.modulos || [];
    },

    getRoles(): string[] {
        return this.getStoredUserInfo()?.roles || [];
    },

    isSuperAdmin(): boolean {
        return this.getRoles().some((r) => r.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === 'SUPERADMIN');
    },

    hasModulo(codigo: string): boolean {
        if (this.isSuperAdmin()) return true;
        const want = codigo.trim().toUpperCase();
        return this.getModulos().some((c) => c.trim().toUpperCase() === want);
    },

    needsPasswordChange(): boolean {
        const must = localStorage.getItem(AUTH_STORAGE_KEYS.MUST_CHANGE_PASSWORD);
        if (must === null) return false;
        try {
            return JSON.parse(must) === true;
        } catch {
            return false;
        }
    },
};
