import { AxiosError } from 'axios';
import { MENSAGEM_DUPLICIDADE_GENERICA, MENSAGENS_CAMPO, TITULOS } from './catalogo';

type CorpoErro = {
    message?: string;
    error?: string;
    title?: string;
};

const TECNICO =
    /duplicate key|violates unique|could not execute|insert into|sql \[|constraint |org\.hibernate|npgsql|psql|stack trace|error: duplicate/i;

function textoDoErro(err: unknown): string {
    const ax = err as AxiosError<CorpoErro>;
    const data = ax.response?.data;
    if (typeof data === 'string') return data;
    const msg = data?.message || data?.title || ax.message || '';
    const extra = typeof data?.error === 'string' && data.error !== msg ? ` ${data.error}` : '';
    return `${msg}${extra}`.trim();
}

function campoDuplicado(texto: string): string | null {
    const key = texto.match(/Key \(([a-z_]+)\)=/i);
    const campo = key?.[1]?.toLowerCase();
    if (campo && MENSAGENS_CAMPO[campo]) return MENSAGENS_CAMPO[campo];
    for (const [nome, frase] of Object.entries(MENSAGENS_CAMPO)) {
        if (new RegExp(`\\(${nome}\\)=`, 'i').test(texto)) return frase;
    }
    if (/duplicate key|violates unique/i.test(texto)) return MENSAGEM_DUPLICIDADE_GENERICA;
    return null;
}

function eMensagemSegura(texto: string): boolean {
    if (!texto || texto.length > 180) return false;
    return !TECNICO.test(texto);
}

/** Mensagem curta para o utilizador. Nunca devolve SQL nem nome de constraint. */
export function mensagemErroHttp(err: unknown, fallback = 'Não foi possível concluir a operação.'): string {
    const ax = err as AxiosError<CorpoErro>;

    if (ax.code === 'ERR_NETWORK' || ax.message === 'Network Error') {
        if (ax.config?.url?.includes('/api/salao') || ax.config?.baseURL?.includes('8092')) {
            return 'API Lyra local (:8092) fora do ar. Suba a api.salao.';
        }
        return 'Não foi possível falar com o Gateway. Confira a conexão.';
    }

    const status = ax.response?.status;
    const headerMsg = ax.response?.headers?.['x-error-message'];
    if (typeof headerMsg === 'string' && eMensagemSegura(headerMsg)) {
        return headerMsg.trim();
    }
    if (status === 401) return 'Sessão expirada. Entre novamente.';
    if (status === 403) {
        if (ax.config?.url?.includes('/api/pessoas')) {
            return 'Sem permissão para cadastrar pessoas no ASC. Entre com o admin da empresa.';
        }
        return 'Você não tem permissão para esta ação.';
    }
    if (status === 404) return 'Registro não encontrado.';

    const bruto = textoDoErro(err);
    const duplicado = campoDuplicado(bruto);
    if (duplicado) return duplicado;

    const apiMsg = ax.response?.data?.message;
    if (typeof apiMsg === 'string' && eMensagemSegura(apiMsg)) {
        return apiMsg.trim();
    }

    if (eMensagemSegura(bruto)) return bruto;
    return fallback;
}

export function tituloDeMensagem(msg: string): string {
    if (/já está cadastrad|já existe|duplicidade/i.test(msg)) return TITULOS.duplicidade;
    if (/já tem um horário|sobreposição|ocupado/i.test(msg)) return TITULOS.conflito;
    if (/permissão|acesso negado/i.test(msg)) return TITULOS.acesso;
    if (/fora do ar|gateway|conexão/i.test(msg)) return TITULOS.rede;
    return TITULOS.salvar;
}

export function tituloErroHttp(err: unknown): string {
    return tituloDeMensagem(mensagemErroHttp(err));
}
