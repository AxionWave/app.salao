export const AUTH_STORAGE_KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_TYPE: 'token_type',
    EXPIRES_IN: 'expires_in',
    USER_INFO: 'user_info',
    MUST_CHANGE_PASSWORD: 'must_change_password',
} as const;

export function clearAuthSessionStorage(): void {
    for (const k of Object.values(AUTH_STORAGE_KEYS)) {
        localStorage.removeItem(k);
    }
}
