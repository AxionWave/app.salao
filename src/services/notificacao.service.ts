import axios from 'axios';
import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

export type StatusNotificacao = 'pendente' | 'enviado' | 'entregue' | 'falhou';

export interface Notificacao {
    id: number;
    evento: string;
    canal: string;
    destino: string | null;
    agendamentoId: number | null;
    status: StatusNotificacao;
    tentativas: number;
    ultimoErro: string | null;
    dataCriacao: string;
    dataEnvio: string | null;
}

/** O que o cliente vê pelo link do e-mail, sem login. */
export interface AgendamentoPublico {
    empresa: string;
    endereco: string | null;
    telefone: string | null;
    cliente: string;
    profissional: string;
    servicos: string[];
    inicio: string;
    fim: string;
    fuso: string;
    status: string;
    podeConfirmar: boolean;
}

export const EVENTOS: Record<string, string> = {
    agendamento_criado: 'Horário marcado',
    agendamento_remarcado: 'Horário alterado',
    agendamento_cancelado: 'Horário cancelado',
    agendamento_confirmado: 'Presença confirmada',
};

export const CANAIS: Record<string, string> = {
    email: 'E-mail',
    whatsapp: 'WhatsApp',
};

/** Sem token nem refresh: a página pública não tem sessão. */
const publico = axios.create({
    baseURL: `${API_CONFIG.productApi}${API_CONFIG.productBase}/publico/agendamentos`,
    headers: { 'Content-Type': 'application/json' },
});

export const notificacaoService = {
    async historicoCliente(clienteId: number): Promise<Notificacao[]> {
        const { data } = await lyraClient.get<Notificacao[]>(`${API_CONFIG.productBase}/clientes/${clienteId}/notificacoes`);
        return data;
    },

    async verPublico(token: string): Promise<AgendamentoPublico> {
        const { data } = await publico.get<AgendamentoPublico>(`/${encodeURIComponent(token)}`);
        return data;
    },

    async confirmarPublico(token: string): Promise<AgendamentoPublico> {
        const { data } = await publico.post<AgendamentoPublico>(`/${encodeURIComponent(token)}/confirmar`);
        return data;
    },
};
