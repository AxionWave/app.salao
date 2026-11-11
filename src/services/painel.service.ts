import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

/** Aviso do sino: o que aconteceu na agenda, com os dados do momento do evento. */
export interface AvisoPainel {
    id: number;
    evento: string;
    agendamentoId: number | null;
    cliente: string;
    profissional: string;
    inicio: string;
    /** `dd/MM/yyyy HH:mm` no fuso da empresa. */
    inicioLocal: string;
    inicioAnteriorLocal: string | null;
    motivo: string | null;
    /** `cliente` quando o próprio cliente fez (link do e-mail). */
    origem: string | null;
    autorId: number | null;
    data: string;
}

export interface SinoPainel {
    itens: AvisoPainel[];
    naoLidas: number;
}

const base = `${API_CONFIG.productBase}/painel/notificacoes`;

export const painelService = {
    async listar(): Promise<SinoPainel> {
        const { data } = await lyraClient.get<SinoPainel>(base);
        return data;
    },

    async marcarVistas(): Promise<void> {
        await lyraClient.post(`${base}/vistas`);
    },
};
