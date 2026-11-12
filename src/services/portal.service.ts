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

export interface AgendamentoPortal {
    id: number;
    profissional: string;
    servicos: string[];
    inicio: string;
    fim: string;
    preco: number;
    status: string;
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

    async agendar(
        endereco: string,
        body: { servicoIds: number[]; profissionalId: number | null; inicio: string; observacoes: string | null },
    ): Promise<AgendamentoPortal> {
        const { data } = await publico.post<AgendamentoPortal>(rota(endereco, '/agendamentos'), body);
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
