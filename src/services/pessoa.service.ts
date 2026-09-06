import { httpClient } from '@core/services';

export interface Pessoa {
    id?: number;
    nomeCompleto?: string;
    cpf?: string;
    telefone?: string;
    dataNascimento?: string;
    email?: string;
    emailLogin?: string;
    podeLogar?: boolean;
    estaAtivo?: boolean;
    perfilAcessoId?: number;
    perfilAcessoNome?: string;
    senhaInicial?: string;
    senha?: string;
}

type PerfilResumo = {
    perfilAcessoId?: number;
    perfilNome?: string;
    relacionamentoAtivo?: boolean;
};

type PessoaCompleta = Pessoa & {
    pessoaId?: number;
    usuarioEmail?: string;
    perfisAcesso?: PerfilResumo[];
};

function perfilAtivo(data: PessoaCompleta): PerfilResumo | undefined {
    const lista = data.perfisAcesso ?? [];
    return lista.find((p) => p.relacionamentoAtivo) ?? lista[lista.length - 1];
}

function deCompleta(data: PessoaCompleta, fallbackId: number): Pessoa {
    const perfil = perfilAtivo(data);
    return {
        id: data.pessoaId ?? data.id ?? fallbackId,
        nomeCompleto: data.nomeCompleto,
        cpf: data.cpf,
        telefone: data.telefone,
        dataNascimento: data.dataNascimento,
        email: data.email ?? data.emailLogin,
        emailLogin: data.emailLogin ?? data.usuarioEmail ?? data.email,
        podeLogar: data.podeLogar,
        estaAtivo: data.estaAtivo,
        perfilAcessoId: perfil?.perfilAcessoId ?? data.perfilAcessoId,
        perfilAcessoNome: perfil?.perfilNome,
    };
}

export const pessoaService = {
    async obter(id: number): Promise<Pessoa> {
        try {
            const { data } = await httpClient.get<PessoaCompleta>(`/api/pessoas/${id}/completo`);
            return deCompleta(data, id);
        } catch {
            const { data } = await httpClient.get<Pessoa>(`/api/pessoas/${id}`);
            return data;
        }
    },

    async criar(body: Pessoa, empresaId?: number): Promise<Pessoa> {
        const { data } = await httpClient.post<Pessoa>('/api/pessoas', body, {
            params: empresaId ? { empresaId } : undefined,
        });
        return data;
    },

    async atualizar(id: number, body: Pessoa, empresaId?: number): Promise<Pessoa> {
        const { data } = await httpClient.put<Pessoa>(`/api/pessoas/${id}`, body, {
            params: empresaId ? { empresaId } : undefined,
        });
        return data;
    },
};
