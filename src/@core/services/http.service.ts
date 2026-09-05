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

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
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
                clearAuthSessionStorage();
                window.location.href = '/login';
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

/** API Lyra (localhost:8092 quando VITE_LYRA_AMBIENTE=local). 401 daqui não desloga. */
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
            } catch {
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
