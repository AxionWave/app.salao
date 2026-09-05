import { resolveGatewayUrl, resolveProductApiUrl } from './ambientes';

export const APP_CONFIG = {
    nome: import.meta.env.VITE_APP_NOME_APP || 'Lyra',
    sigla: import.meta.env.VITE_APP_SIGLA_SISTEMA || 'LYR',
    empresa: import.meta.env.VITE_APP_NOME_EMPRESA || 'Enterprise X',
    descricao: import.meta.env.VITE_APP_DESCRICAO_APP || 'Sistema Salão',
    versao: import.meta.env.VITE_APP_VERSAO_APP || '1.0.0',
} as const;

export const API_CONFIG = {
    gateway: resolveGatewayUrl().url,
    /** Lyra local (:8092) ou Gateway, conforme VITE_LYRA_AMBIENTE. */
    productApi: resolveProductApiUrl(),
    productBase: '/api/salao',
} as const;

export const SECURITY_CONFIG = {
    secretTokenQR: import.meta.env.VITE_APP_SECRET_TOKEN_QR || '',
} as const;
