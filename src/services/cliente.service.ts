import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

export interface Cliente {
    id: number;
    empresaId: number;
    nome: string;
    telefone: string;
    email: string | null;
    observacoes: string | null;
    ativo: boolean;
    familiaId: number | null;
    familiaNome: string | null;
    parentesco: string | null;
    dataCriacao: string;
    dataAtualizacao: string | null;
}

export interface SalvarCliente {
    nome: string;
    telefone: string;
    email?: string | null;
    observacoes?: string | null;
    ativo: boolean;
    parentesco?: string | null;
    /** Entra na família desta ficha (a API cria a família se ela ainda não tiver). */
    familiaDeClienteId?: number | null;
    sairDaFamilia?: boolean;
}

export interface ListaClientes {
    items: Cliente[];
    total: number;
    page: number;
    pageSize: number;
}

const base = `${API_CONFIG.productBase}/clientes`;

export const clienteService = {
    async listar(params?: {
        search?: string;
        ativo?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<ListaClientes> {
        const { data } = await lyraClient.get<ListaClientes>(base, { params });
        return data;
    },

    async obter(id: number): Promise<Cliente> {
        const { data } = await lyraClient.get<Cliente>(`${base}/${id}`);
        return data;
    },

    async criar(body: SalvarCliente): Promise<Cliente> {
        const { data } = await lyraClient.post<Cliente>(base, body);
        return data;
    },

    async atualizar(id: number, body: SalvarCliente): Promise<Cliente> {
        const { data } = await lyraClient.put<Cliente>(`${base}/${id}`, body);
        return data;
    },

    async familia(id: number): Promise<Cliente[]> {
        const { data } = await lyraClient.get<Cliente[]>(`${base}/${id}/familia`);
        return data;
    },

    async mesmoContato(params: { telefone?: string; email?: string; ignorarId?: number }): Promise<Cliente[]> {
        const { data } = await lyraClient.get<Cliente[]>(`${base}/mesmo-contato`, { params });
        return data;
    },

    async alterarAtivo(id: number, ativo: boolean): Promise<Cliente> {
        const { data } = await lyraClient.patch<Cliente>(`${base}/${id}/ativo`, { ativo });
        return data;
    },
};
