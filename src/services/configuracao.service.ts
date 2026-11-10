import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';

export type Genero = 'm' | 'f';

export interface Termo {
    singular: string;
    plural: string;
    genero: Genero;
}

export interface Terminologia {
    recurso: Termo;
    servico: Termo;
    cliente: Termo;
    agendamento: Termo;
}

export type ChaveTermo = keyof Terminologia;

export interface ConfiguracaoEmpresa {
    segmento: string;
    fusoHorario: string;
    terminologia: Terminologia;
    personalizada: boolean;
    dataAtualizacao: string | null;
    enviarEmails: boolean;
}

export interface Segmento {
    id: string;
    nome: string;
    terminologia: Terminologia;
}

export interface FusoHorario {
    id: string;
    nome: string;
}

export interface OpcoesConfiguracao {
    segmentos: Segmento[];
    fusosHorarios: FusoHorario[];
}

export interface SalvarConfiguracao {
    segmento: string;
    fusoHorario: string;
    terminologia: Terminologia | null;
    enviarEmails?: boolean;
}

const base = `${API_CONFIG.productBase}/configuracao`;

export const configuracaoService = {
    async obter(): Promise<ConfiguracaoEmpresa> {
        const { data } = await lyraClient.get<ConfiguracaoEmpresa>(base);
        return data;
    },

    async opcoes(): Promise<OpcoesConfiguracao> {
        const { data } = await lyraClient.get<OpcoesConfiguracao>(`${base}/opcoes`);
        return data;
    },

    async salvar(body: SalvarConfiguracao): Promise<ConfiguracaoEmpresa> {
        const { data } = await lyraClient.put<ConfiguracaoEmpresa>(base, body);
        return data;
    },
};
