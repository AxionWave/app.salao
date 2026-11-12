import axios from 'axios';
import { lyraClient } from '@core/services';
import { API_CONFIG } from '@core/config';
import type { Terminologia } from './configuracao.service';

/** Como a empresa recebe agendamentos online (Configurações). */
export interface PortalConfig {
    ativo: boolean;
    endereco: string | null;
    apresentacao: string | null;
    antecedenciaMinutos: number;
    janelaDias: number;
    limiteAbertos: number;
    passoMinutos: number;
    servicosOcultos: number[];
    profissionaisOcultos: number[];
    /** Até quantas horas antes o cliente cancela ou remarca pelo site; null = só falando com a empresa. */
    prazoAlteracaoHoras: number | null;
    /** O que o cliente marca ou remarca pelo site já entra confirmado. */
    confirmarAutomatico: boolean;
}

export interface ItemPortal {
    id: number;
    nome: string;
}

export interface PortalConfigResposta {
    portal: PortalConfig;
    /** Endereço sugerido pelo nome da empresa, enquanto não há um. */
    sugestao: string | null;
    servicos: ItemPortal[];
    profissionais: ItemPortal[];
}

export interface PaginaPortal {
    endereco: string;
    empresa: {
        nome: string;
        logoUrl: string | null;
        endereco: string | null;
        telefone: string | null;
        email: string | null;
    };
    apresentacao: string | null;
    termos: Terminologia;
    fusoHorario: string;
    antecedenciaMinutos: number;
    janelaDias: number;
    servicos: { id: number; nome: string; duracaoMinutos: number; preco: number; profissionalIds: number[] }[];
    profissionais: { id: number; nome: string; cor: string }[];
    prazoAlteracaoHoras: number | null;
}

export interface HorariosPortal {
    data: string;
    duracaoMinutos: number;
    fusoHorario: string;
    profissionais: { profissionalId: number; nome: string; horarios: { inicio: string; hora: string }[] }[];
}

export interface ContaCliente {
    email: string;
    nome: string | null;
    telefone: string | null;
}

export interface SessaoCliente {
    token: string;
    expira: string;
    conta: ContaCliente;
}

/** Avisos por e-mail desta empresa para o e-mail da conta (a mesma lista do link "não quero mais receber"). */
export interface PreferenciasCliente {
    /** False quando a entrega de e-mails não está ligada neste ambiente. */
    disponivel: boolean;
    empresaEnvia: boolean;
    receberEmails: boolean;
    /** 'devolvido' ou 'reclamacao' (marcado como spam): o site não desfaz. */
    bloqueio: string | null;
}

export interface AgendamentoPortal {
    id: number;
    profissional: string;
    servicos: string[];
    inicio: string;
    fim: string;
    preco: number;
    status: string;
    /** Nome de quem vai, quando é alguém da família; null quando é o próprio cliente. */
    para: string | null;
}

/** Alguém da família do cliente, montada pela empresa no cadastro. */
export interface PessoaFamilia {
    id: number;
    nome: string;
    parentesco: string | null;
}

export interface AgendamentoCliente {
    id: number;
    /** Primeiro agendamento da cadeia de remarcações: o UID do evento no calendário. */
    cadeia: number;
    inicio: string;
    fim: string;
    status: string;
    profissionalId: number;
    profissional: string;
    servicos: ItemPortal[];
    preco: number;
    motivoCancelamento: string | null;
    podeAlterar: boolean;
    /** Até quando dá para cancelar ou remarcar pelo site; null quando a empresa não deixa. */
    alterarAte: string | null;
    /** Nome de quem vai, quando é alguém da família; null quando é o próprio cliente. */
    para: string | null;
}

export interface MeusAgendamentos {
    proximos: AgendamentoCliente[];
    historico: AgendamentoCliente[];
}

/** A conta vale em qualquer empresa: uma sessão só, separada da sessão da equipe. */
const CHAVE_SESSAO = 'lyra-portal-sessao';

export function sessaoSalva(): SessaoCliente | null {
    try {
        const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? 'null') as SessaoCliente | null;
        return s && new Date(s.expira) > new Date() ? s : null;
    } catch {
        return null;
    }
}

export function salvarSessao(s: SessaoCliente | null) {
    if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
    else localStorage.removeItem(CHAVE_SESSAO);
}

/** Sem os interceptadores da equipe: um 401 aqui não pode derrubar o login de quem usa o Lyra. */
const publico = axios.create({
    baseURL: `${API_CONFIG.productApi}${API_CONFIG.productBase}/publico/portal`,
    headers: { 'Content-Type': 'application/json' },
});

publico.interceptors.request.use((config) => {
    const token = sessaoSalva()?.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const rota = (endereco: string, resto = '') => `/${encodeURIComponent(endereco)}${resto}`;
const baseConfig = `${API_CONFIG.productBase}/configuracao/portal`;

export const portalService = {
    async pagina(endereco: string): Promise<PaginaPortal> {
        const { data } = await publico.get<PaginaPortal>(rota(endereco));
        return data;
    },

    async horarios(endereco: string, dia: string, servicoIds: number[], profissionalId: number | null): Promise<HorariosPortal> {
        const params = new URLSearchParams({ data: dia });
        servicoIds.forEach((id) => params.append('servicoIds', String(id)));
        if (profissionalId) params.set('profissionalId', String(profissionalId));
        const { data } = await publico.get<HorariosPortal>(rota(endereco, `/horarios?${params}`));
        return data;
    },

    async pedirCodigo(endereco: string, email: string): Promise<void> {
        await publico.post(rota(endereco, '/codigo'), { email });
    },

    async entrar(endereco: string, email: string, codigo: string): Promise<SessaoCliente> {
        const { data } = await publico.post<SessaoCliente>(rota(endereco, '/entrar'), { email, codigo });
        return data;
    },

    async conta(endereco: string): Promise<ContaCliente> {
        const { data } = await publico.get<ContaCliente>(rota(endereco, '/conta'));
        return data;
    },

    async salvarConta(endereco: string, nome: string, telefone: string): Promise<ContaCliente> {
        const { data } = await publico.put<ContaCliente>(rota(endereco, '/conta'), { nome, telefone });
        return data;
    },

    async preferencias(endereco: string): Promise<PreferenciasCliente> {
        const { data } = await publico.get<PreferenciasCliente>(rota(endereco, '/conta/preferencias'));
        return data;
    },

    async salvarPreferencias(endereco: string, receberEmails: boolean): Promise<PreferenciasCliente> {
        const { data } = await publico.put<PreferenciasCliente>(rota(endereco, '/conta/preferencias'), { receberEmails });
        return data;
    },

    /** Vazio na maioria das contas: só tem família quem a empresa pôs numa, e com o e-mail da conta na ficha. */
    async familia(endereco: string): Promise<PessoaFamilia[]> {
        const { data } = await publico.get<PessoaFamilia[]>(rota(endereco, '/conta/familia'));
        return data;
    },

    async agendar(
        endereco: string,
        body: {
            servicoIds: number[];
            profissionalId: number | null;
            inicio: string;
            observacoes: string | null;
            /** Alguém da família; null = o próprio cliente. */
            clienteId: number | null;
        },
    ): Promise<AgendamentoPortal> {
        const { data } = await publico.post<AgendamentoPortal>(rota(endereco, '/agendamentos'), body);
        return data;
    },

    async meusAgendamentos(endereco: string): Promise<MeusAgendamentos> {
        const { data } = await publico.get<MeusAgendamentos>(rota(endereco, '/meus-agendamentos'));
        return data;
    },

    async horariosRemarcar(endereco: string, id: number, dia: string, profissionalId: number | null): Promise<HorariosPortal> {
        const params = new URLSearchParams({ data: dia });
        if (profissionalId) params.set('profissionalId', String(profissionalId));
        const { data } = await publico.get<HorariosPortal>(rota(endereco, `/meus-agendamentos/${id}/horarios?${params}`));
        return data;
    },

    async cancelar(endereco: string, id: number, motivo: string | null): Promise<AgendamentoCliente> {
        const { data } = await publico.post<AgendamentoCliente>(rota(endereco, `/meus-agendamentos/${id}/cancelar`), { motivo });
        return data;
    },

    async remarcar(endereco: string, id: number, profissionalId: number | null, inicio: string): Promise<AgendamentoCliente> {
        const { data } = await publico.post<AgendamentoCliente>(rota(endereco, `/meus-agendamentos/${id}/remarcar`), {
            profissionalId,
            inicio,
        });
        return data;
    },

    async config(): Promise<PortalConfigResposta> {
        const { data } = await lyraClient.get<PortalConfigResposta>(baseConfig);
        return data;
    },

    async salvarConfig(body: PortalConfig): Promise<PortalConfigResposta> {
        const { data } = await lyraClient.put<PortalConfigResposta>(baseConfig, body);
        return data;
    },

    async disponivel(endereco: string): Promise<{ disponivel: boolean; motivo: string | null }> {
        const { data } = await lyraClient.get<{ disponivel: boolean; motivo: string | null }>(`${baseConfig}/disponivel`, {
            params: { endereco },
        });
        return data;
    },
};
