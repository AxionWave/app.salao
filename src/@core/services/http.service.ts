import axios, { AxiosHeaders, AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG, SECURITY_CONFIG } from '../config';
import { AUTH_STORAGE_KEYS, clearAuthSessionStorage } from '../auth/auth.storage';

function applyGatewayHeaders(config: InternalAxiosRequestConfig): void {
    const secretToken = String(SECURITY_CONFIG.secretTokenQR || '').trim();
    if (!secretToken) return;
    if (!config.headers) config.headers = new AxiosHeaders();
    if (typeof (config.headers as AxiosHeaders).set === 'function') {
        (config.headers as AxiosHeaders).set('X-Secret-Token', secretToken);
    }
}

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Limpa a sessão e abre o login com o aviso de sessão expirada. */
export function irParaLoginSessaoExpirada(): void {
    clearAuthSessionStorage();
    const login = `${import.meta.env.BASE_URL}login`;
    if (window.location.pathname !== login) {
        window.location.href = `${login}?sessao=expirada`;
    }
}

/** O refresh foi recusado (ou não existe): a sessão acabou. Falha de rede não conta. */
function sessaoAcabou(err: unknown): boolean {
    if (err instanceof Error && err.message === 'missing_refresh_token') return true;
    const status = (err as AxiosError).response?.status;
    return status === 400 || status === 401 || status === 403;
}

let refreshInFlight: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
            if (!refreshToken) {
                throw new Error('missing_refresh_token');
            }
            const { data } = await oauthClient.post<{
                access_token: string;
                refresh_token: string;
                token_type?: string;
                expires_in?: number;
            }>('/token', { refresh_token: refreshToken });
            localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
            localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
            return data.access_token;
        })().finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
}

function attachAuth(client: AxiosInstance): AxiosInstance {
    client.interceptors.request.use((config) => {
        const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        applyGatewayHeaders(config);
        return config;
    });

    client.interceptors.response.use(
        (response) => response,
        async (error: AxiosError) => {
            const status = error.response?.status;
            const original = error.config as RetryConfig | undefined;
            if (status !== 401 || !original || original._retry) {
                return Promise.reject(error);
            }
            original._retry = true;
            try {
                const accessToken = await refreshAccessToken();
                if (!original.headers || typeof (original.headers as AxiosHeaders).set !== 'function') {
                    original.headers = new AxiosHeaders();
                }
                (original.headers as AxiosHeaders).set('Authorization', `Bearer ${accessToken}`);
                applyGatewayHeaders(original);
                return client(original);
            } catch (refreshErr) {
                irParaLoginSessaoExpirada();
                return Promise.reject(refreshErr);
            }
        }
    );
    return client;
}

export const oauthClient: AxiosInstance = axios.create({
    baseURL: `${API_CONFIG.gateway}/api/auth`,
    headers: { 'Content-Type': 'application/json' },
});

oauthClient.interceptors.request.use((config) => {
    applyGatewayHeaders(config);
    return config;
});

export const httpClient: AxiosInstance = attachAuth(
    axios.create({
        baseURL: API_CONFIG.gateway,
        headers: { 'Content-Type': 'application/json' },
    })
);

/**
 * API Lyra (localhost:8092 quando VITE_LYRA_AMBIENTE=local). Só desloga quando o refresh é recusado:
 * um 401 que persiste com token renovado (ex.: API local com outro JWT_SECRET) não derruba a sessão.
 */
function attachLyraAuth(client: AxiosInstance): AxiosInstance {
    client.interceptors.request.use((config) => {
        const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    client.interceptors.response.use(
        (response) => response,
        async (error: AxiosError) => {
            const status = error.response?.status;
            const original = error.config as RetryConfig | undefined;
            if (status !== 401 || !original || original._retry) {
                return Promise.reject(error);
            }
            original._retry = true;
            try {
                const accessToken = await refreshAccessToken();
                if (!original.headers || typeof (original.headers as AxiosHeaders).set !== 'function') {
                    original.headers = new AxiosHeaders();
                }
                (original.headers as AxiosHeaders).set('Authorization', `Bearer ${accessToken}`);
                return client(original);
            } catch (refreshErr) {
                if (sessaoAcabou(refreshErr)) irParaLoginSessaoExpirada();
                return Promise.reject(error);
            }
        }
    );
    return client;
}

export const lyraClient: AxiosInstance = attachLyraAuth(
    axios.create({
        baseURL: API_CONFIG.productApi,
        headers: { 'Content-Type': 'application/json' },
    })
);
