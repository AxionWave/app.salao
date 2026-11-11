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
    /** Horas antes do início em que o cliente recebe lembrete; vazio = nenhum. */
    lembretesHoras: number[];
    /** Profissionais recebem a agenda do dia por e-mail às 7h. */
    resumoDiario: boolean;
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
    lembretesHoras?: number[];
    resumoDiario?: boolean;
}

export type EventoAviso =
    | 'agendamento_criado'
    | 'agendamento_remarcado'
    | 'agendamento_cancelado'
    | 'agendamento_confirmado'
    | 'agendamento_lembrete';

export interface AvisoEvento {
    evento: EventoAviso;
    /** E-mail ao cliente neste evento (vale só com o envio de e-mails ligado). */
    cliente: boolean;
    /** Push no celular da equipe. O sino mostra sempre. */
    equipe: boolean;
    /** null = texto padrão. */
    assunto: string | null;
    mensagem: string | null;
}

export interface Avisos {
    enviarEmails: boolean;
    lembretesHoras: number[];
    resumoDiario: boolean;
    eventos: AvisoEvento[];
    /** Nota em todo e-mail ao cliente, menos no de cancelamento. */
    recado: string | null;
}

export interface ModeloAviso {
    evento: EventoAviso;
    nome: string;
    descricao: string;
    assunto: string;
    mensagem: string;
    /** O evento também avisa a equipe por push. */
    equipe: boolean;
}

export interface VariavelAviso {
    nome: string;
    descricao: string;
    exemplo: string;
}

export interface AvisosResposta {
    avisos: Avisos;
    modelos: ModeloAviso[];
    variaveis: VariavelAviso[];
}

export interface PreviaAviso {
    assunto: string;
    html: string;
    texto: string;
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

    async avisos(): Promise<AvisosResposta> {
        const { data } = await lyraClient.get<AvisosResposta>(`${base}/avisos`);
        return data;
    },

    async salvarAvisos(body: Avisos): Promise<AvisosResposta> {
        const { data } = await lyraClient.put<AvisosResposta>(`${base}/avisos`, body);
        return data;
    },

    async previaAviso(body: {
        evento: EventoAviso;
        assunto: string | null;
        mensagem: string | null;
        recado: string | null;
    }): Promise<PreviaAviso> {
        const { data } = await lyraClient.post<PreviaAviso>(`${base}/avisos/previa`, body);
        return data;
    },
};
