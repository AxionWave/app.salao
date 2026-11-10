import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

export interface Bloqueio {
    id: number;
    /** null = vale para a empresa inteira. */
    profissionalId: number | null;
    profissionalNome: string | null;
    inicio: string;
    fim: string;
    motivo: string | null;
    dataCriacao: string;
}

export interface SalvarBloqueio {
    profissionalId: number | null;
    inicio: string;
    fim: string;
    motivo?: string | null;
}

export interface CriarBloqueioResposta {
    bloqueio: Bloqueio;
    agendamentosNoPeriodo: number;
}

const base = `${API_CONFIG.productBase}/bloqueios`;

export function bloqueiaProfissional(b: Bloqueio, profissionalId: number): boolean {
    return b.profissionalId === null || b.profissionalId === profissionalId;
}

export const bloqueioService = {
    async listar(params: { de: string; ate: string; profissionalId?: number }): Promise<Bloqueio[]> {
        const { data } = await lyraClient.get<{ items: Bloqueio[] }>(base, { params });
        return data.items;
    },

    async criar(body: SalvarBloqueio): Promise<CriarBloqueioResposta> {
        const { data } = await lyraClient.post<CriarBloqueioResposta>(base, body);
        return data;
    },

    async excluir(id: number): Promise<void> {
        await lyraClient.delete(`${base}/${id}`);
    },
};
