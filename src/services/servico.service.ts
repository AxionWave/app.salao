import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

export interface Servico {
    id: number;
    empresaId: number;
    nome: string;
    duracaoMinutos: number;
    preco: number;
    categoria: string | null;
    ativo: boolean;
    dataCriacao: string;
    dataAtualizacao: string | null;
    intervaloAposMinutos: number;
    /** Quem atende. Vazio = todos. */
    profissionalIds: number[];
}

export interface SalvarServico {
    nome: string;
    duracaoMinutos: number;
    preco: number;
    categoria?: string | null;
    ativo: boolean;
    intervaloAposMinutos: number;
    profissionalIds: number[];
}

export interface ProfissionalResumo {
    id: number;
    nome: string;
    cor: string;
}

export interface ListaServicos {
    items: Servico[];
    total: number;
    page: number;
    pageSize: number;
    categorias: string[];
    profissionais: ProfissionalResumo[];
}

const base = `${API_CONFIG.productBase}/servicos`;

export const servicoService = {
    async listar(params?: {
        search?: string;
        ativo?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<ListaServicos> {
        const { data } = await lyraClient.get<ListaServicos>(base, { params });
        return data;
    },

    async obter(id: number): Promise<Servico> {
        const { data } = await lyraClient.get<Servico>(`${base}/${id}`);
        return data;
    },

    async criar(body: SalvarServico): Promise<Servico> {
        const { data } = await lyraClient.post<Servico>(base, body);
        return data;
    },

    async atualizar(id: number, body: SalvarServico): Promise<Servico> {
        const { data } = await lyraClient.put<Servico>(`${base}/${id}`, body);
        return data;
    },

    async alterarAtivo(id: number, ativo: boolean): Promise<Servico> {
        const { data } = await lyraClient.patch<Servico>(`${base}/${id}/ativo`, { ativo });
        return data;
    },
};
