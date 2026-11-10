import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

export interface AgendamentoServico {
    id: number;
    nome: string;
    duracaoMinutos: number;
    preco: number;
}

export interface Agendamento {
    id: number;
    empresaId: number;
    clienteId: number;
    clienteNome: string;
    clienteTelefone: string;
    servicos: AgendamentoServico[];
    servicoNome: string;
    duracaoMinutos: number;
    preco: number;
    profissionalId: number;
    profissionalNome: string;
    profissionalCor: string;
    inicio: string;
    fim: string;
    status: string;
    observacoes: string | null;
    dataCriacao: string;
    dataAtualizacao: string | null;
    /** Preparo depois do atendimento; a agenda fica ocupada até fim + este tempo. */
    intervaloAposMinutos: number;
}

export interface SalvarAgendamento {
    clienteId: number;
    servicoIds: number[];
    profissionalId: number;
    inicio: string;
    observacoes?: string | null;
}

export interface IntervaloAgenda {
    diaSemana: number;
    inicio: string;
    fim: string;
}

export interface ProfissionalAgenda {
    id: number;
    nome: string;
    cor: string;
    disponibilidades: IntervaloAgenda[];
}

export interface ServicoAgenda {
    id: number;
    nome: string;
    duracaoMinutos: number;
    preco: number;
    intervaloAposMinutos: number;
    /** Quem atende. Vazio = todos. */
    profissionalIds: number[];
}

export interface OpcoesAgenda {
    profissionais: ProfissionalAgenda[];
    servicos: ServicoAgenda[];
    fusoHorario: string;
}

export interface HorarioLivre {
    inicio: string;
    hora: string;
}

export interface HorariosLivres {
    data: string;
    duracaoMinutos: number;
    fusoHorario: string;
    profissionais: { profissionalId: number; nome: string; horarios: HorarioLivre[] }[];
}

export function atendeServicos(servicos: ServicoAgenda[], profissionalId: number): boolean {
    return servicos.every((s) => s.profissionalIds.length === 0 || s.profissionalIds.includes(profissionalId));
}

export interface ListaAgendamentos {
    items: Agendamento[];
}

export function rotuloServicos(a: Agendamento): string {
    if (a.servicos?.length) return a.servicos.map((s) => s.nome).join(' + ');
    return a.servicoNome || 'Serviços';
}

const base = `${API_CONFIG.productBase}/agendamentos`;

export const agendamentoService = {
    async listar(params: {
        de: string;
        ate: string;
        profissionalId?: number;
        status?: string;
    }): Promise<ListaAgendamentos> {
        const { data } = await lyraClient.get<ListaAgendamentos>(base, { params });
        return data;
    },

    async opcoes(): Promise<OpcoesAgenda> {
        const { data } = await lyraClient.get<OpcoesAgenda>(`${base}/opcoes`);
        return data;
    },

    async horariosLivres(params: {
        data: string;
        servicoIds: number[];
        profissionalId?: number;
        ignorarAgendamentoId?: number;
    }): Promise<HorariosLivres> {
        const { data } = await lyraClient.get<HorariosLivres>(`${base}/horarios-livres`, {
            params,
            paramsSerializer: { indexes: null },
        });
        return data;
    },

    async obter(id: number): Promise<Agendamento> {
        const { data } = await lyraClient.get<Agendamento>(`${base}/${id}`);
        return data;
    },

    async criar(body: SalvarAgendamento): Promise<Agendamento> {
        const { data } = await lyraClient.post<Agendamento>(base, body);
        return data;
    },

    async atualizar(id: number, body: SalvarAgendamento): Promise<Agendamento> {
        const { data } = await lyraClient.put<Agendamento>(`${base}/${id}`, body);
        return data;
    },

    async alterarStatus(id: number, status: string): Promise<Agendamento> {
        const { data } = await lyraClient.patch<Agendamento>(`${base}/${id}/status`, { status });
        return data;
    },
};
