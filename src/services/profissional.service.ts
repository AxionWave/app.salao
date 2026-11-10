import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

export interface Intervalo {
    diaSemana: number;
    inicio: string;
    fim: string;
}

export interface Profissional {
    id: number;
    empresaId: number;
    pessoaId: number | null;
    nome: string;
    cor: string;
    ativo: boolean;
    disponibilidades: Intervalo[];
    dataCriacao: string;
    dataAtualizacao: string | null;
}

export interface SalvarProfissional {
    nome: string;
    pessoaId: number;
    cor: string;
    ativo: boolean;
    disponibilidades: Intervalo[];
}

export interface ListaProfissionais {
    items: Profissional[];
    total: number;
    page: number;
    pageSize: number;
}

export interface AgendamentoAfetado {
    id: number;
    inicio: string;
    fim: string;
    clienteNome: string;
    status: string;
}

export interface ImpactoProfissional {
    total: number;
    itens: AgendamentoAfetado[];
}

const base = `${API_CONFIG.productBase}/profissionais`;

export const profissionalService = {
    async listar(params?: {
        search?: string;
        ativo?: boolean;
        page?: number;
        pageSize?: number;
    }): Promise<ListaProfissionais> {
        const { data } = await lyraClient.get<ListaProfissionais>(base, { params });
        return data;
    },

    async obter(id: number): Promise<Profissional> {
        const { data } = await lyraClient.get<Profissional>(`${base}/${id}`);
        return data;
    },

    async criar(body: SalvarProfissional): Promise<Profissional> {
        const { data } = await lyraClient.post<Profissional>(base, body);
        return data;
    },

    async atualizar(id: number, body: SalvarProfissional): Promise<Profissional> {
        const { data } = await lyraClient.put<Profissional>(`${base}/${id}`, body);
        return data;
    },

    async alterarAtivo(id: number, ativo: boolean): Promise<Profissional> {
        const { data } = await lyraClient.patch<Profissional>(`${base}/${id}/ativo`, { ativo });
        return data;
    },

    /** Agendamentos futuros em aberto que ficam sem atendimento (desativar) ou fora do novo expediente. */
    async impacto(id: number, body: { ativo: boolean; disponibilidades?: Intervalo[] }): Promise<ImpactoProfissional> {
        const { data } = await lyraClient.post<ImpactoProfissional>(`${base}/${id}/impacto`, body);
        return data;
    },
};
