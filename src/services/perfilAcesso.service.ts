import { httpClient, lyraClient } from '@core/services';
import {
    MODULO_AGENDA,
    MODULO_CLIENTES,
    MODULO_CONFIGURACOES,
    MODULO_RAIZ,
    MODULO_RELATORIO,
    MODULO_SERVICOS,
} from '@/constants/moduleCodes';

export interface PerfilAcesso {
    id: number;
    nome: string;
    descricao?: string;
    ativo?: boolean;
    sistemaCodigo?: string | null;
}

export type PerfilOrigem = 'SISTEMA' | 'EMPRESA';

export interface PermissoesLyra {
    podeVisualizar?: boolean;
    podeCriar?: boolean;
    podeEditar?: boolean;
    podeExcluir?: boolean;
    podeConfigurar?: boolean;
    podeVerRelatorios?: boolean;
}

export interface ModuloPerfilLyra {
    moduloId: number;
    moduloCodigo: string;
    moduloNome: string;
    permissoes?: PermissoesLyra;
}

export interface PerfilLyraCompleto {
    id: number;
    nome: string;
    descricao?: string;
    ativo: boolean;
    origem?: PerfilOrigem;
    sistemaCodigo?: string | null;
    empresaId: number;
    modulos: ModuloPerfilLyra[];
}

export interface ModuloLyraCatalogo {
    moduloId: number;
    moduloCodigo: string;
    moduloNome: string;
}

export type FlagLyra = 'agendar' | 'servicos' | 'clientes' | 'configuracoes' | 'relatorio';

export const CATALOGO_FLAGS: {
    id: FlagLyra;
    codigo: string;
    label: string;
    detalhe: string;
}[] = [
    { id: 'agendar', codigo: MODULO_AGENDA, label: 'Agendar', detalhe: 'Criar e alterar horários na agenda' },
    { id: 'clientes', codigo: MODULO_CLIENTES, label: 'Cadastrar clientes', detalhe: 'Abrir e editar ficha do salão' },
    { id: 'servicos', codigo: MODULO_SERVICOS, label: 'Cadastrar serviços', detalhe: 'Incluir e alterar o catálogo' },
    { id: 'relatorio', codigo: MODULO_RELATORIO, label: 'Ver relatório financeiro', detalhe: 'A tela vem depois; a permissão já fica no perfil' },
    { id: 'configuracoes', codigo: MODULO_CONFIGURACOES, label: 'Entrar nas configurações', detalhe: 'Perfis e permissões desta empresa' },
];

export type FlagsForm = Record<FlagLyra, boolean>;

export const flagsVazias: FlagsForm = {
    agendar: false,
    servicos: false,
    clientes: false,
    configuracoes: false,
    relatorio: false,
};

export const flagsTodas: FlagsForm = {
    agendar: true,
    servicos: true,
    clientes: true,
    configuracoes: true,
    relatorio: true,
};

function ehPerfilEquipeLyra(p: PerfilAcesso): boolean {
    const codigo = (p.sistemaCodigo || '').toUpperCase();
    if (codigo === 'LYR') return true;
    if (codigo === 'ASC') return false;
    const nome = (p.nome || '').toLowerCase();
    if (/super\s*admin|cliente\s*admin|^administrador$/.test(nome)) return false;
    return /lyra|profissional|funcion/.test(nome);
}

export function ehClienteAdmin(nome: string): boolean {
    const n = (nome || '').trim().toLowerCase();
    return n === 'cliente admin' || n === 'clienteadmin' || n === 'administrador';
}

export function ehFuncionarioLyra(nome: string): boolean {
    return (nome || '').trim().toLowerCase() === 'funcionário lyra';
}

function codigoSistema(p: { sistemaCodigo?: string | null }): string {
    return (p.sistemaCodigo || '').trim().toUpperCase();
}

/** Cliente Admin + perfis do produto LYR (o GET /completo?sistemaCodigo=LYR na VPS hoje devolve 400). */
function visivelNasConfiguracoesLyra(p: Pick<PerfilLyraCompleto, 'nome' | 'sistemaCodigo' | 'ativo'>): boolean {
    if (p.ativo === false) return false;
    if (ehClienteAdmin(p.nome) || ehFuncionarioLyra(p.nome)) return true;
    const codigo = codigoSistema(p);
    return codigo === 'LYR' || codigo === 'LYRA';
}

export function ehPerfilFixo(p: Pick<PerfilLyraCompleto, 'nome' | 'origem'>): boolean {
    return p.origem === 'SISTEMA' || ehClienteAdmin(p.nome) || ehFuncionarioLyra(p.nome);
}

export function flagsDoPerfil(p: PerfilLyraCompleto): FlagsForm {
    if (ehClienteAdmin(p.nome)) return { ...flagsTodas };
    const ligados = new Set((p.modulos || []).map((m) => (m.moduloCodigo || '').trim().toUpperCase()));
    return {
        agendar: ligados.has(MODULO_AGENDA),
        servicos: ligados.has(MODULO_SERVICOS),
        clientes: ligados.has(MODULO_CLIENTES),
        configuracoes: ligados.has(MODULO_CONFIGURACOES),
        relatorio: ligados.has(MODULO_RELATORIO),
    };
}

function permissoesOperacao(): PermissoesLyra {
    return { podeVisualizar: true, podeCriar: true, podeEditar: true, podeExcluir: false };
}

function payloadModulos(
    flags: FlagsForm,
    catalogo: ModuloLyraCatalogo[],
    opts?: { incluirRaiz?: boolean }
): { moduloId: number; permissoes: PermissoesLyra }[] {
    const byCodigo = new Map(catalogo.map((m) => [m.moduloCodigo, m]));
    const out: { moduloId: number; permissoes: PermissoesLyra }[] = [];
    const push = (codigo: string, perm: PermissoesLyra) => {
        const m = byCodigo.get(codigo);
        if (m) out.push({ moduloId: m.moduloId, permissoes: perm });
    };
    if (flags.agendar) push(MODULO_AGENDA, permissoesOperacao());
    if (flags.clientes) push(MODULO_CLIENTES, permissoesOperacao());
    if (flags.servicos) push(MODULO_SERVICOS, permissoesOperacao());
    if (flags.relatorio) {
        push(MODULO_RELATORIO, { podeVisualizar: true, podeVerRelatorios: true });
    }
    if (flags.configuracoes) {
        push(MODULO_CONFIGURACOES, { podeVisualizar: true, podeConfigurar: true });
    }
    if (opts?.incluirRaiz !== false) {
        const raiz = byCodigo.get(MODULO_RAIZ);
        if (raiz && !out.some((x) => x.moduloId === raiz.moduloId)) {
            out.push({ moduloId: raiz.moduloId, permissoes: { podeVisualizar: true } });
        }
    }
    return out;
}

export function rotuloFlags(flags: FlagsForm): string {
    const nomes = CATALOGO_FLAGS.filter((c) => flags[c.id]).map((c) => c.label);
    return nomes.length ? nomes.join(' · ') : 'Nenhuma permissão Lyra';
}

export const perfilAcessoService = {
    async listarLyra(empresaId?: number): Promise<PerfilAcesso[]> {
        try {
            const { data } = await lyraClient.get<PerfilAcesso[]>('/api/salao/perfis-acesso');
            const lista = Array.isArray(data) ? data : [];
            if (lista.length > 0) {
                return lista.filter((p) => p.ativo !== false);
            }
        } catch {
            // API local antiga sem a rota — tenta o Core
        }

        const { data } = await httpClient.get<{ content?: PerfilAcesso[] }>('/api/perfis-acesso', {
            params: {
                page: 0,
                size: 100,
                sistemaCodigo: 'LYR',
                empresaId,
            },
        });
        return (data.content ?? []).filter((p) => p.ativo !== false && ehPerfilEquipeLyra(p));
    },

    async listarCompletos(empresaId: number): Promise<PerfilLyraCompleto[]> {
        const hidratar = async (candidatos: PerfilAcesso[]): Promise<PerfilLyraCompleto[]> => {
            const visiveis = candidatos.filter((p) => visivelNasConfiguracoesLyra(p));
            const completos = await Promise.all(
                visiveis.map(async (p) => {
                    const { data } = await httpClient.get<PerfilLyraCompleto>(`/api/perfis-acesso/${p.id}/completo`);
                    return data;
                })
            );
            return completos.filter((p) => p.ativo !== false);
        };

        try {
            const { data: lista } = await httpClient.get<PerfilAcesso[]>(`/api/perfis-acesso/empresa/${empresaId}`);
            return hidratar(Array.isArray(lista) ? lista : []);
        } catch {
            const { data } = await httpClient.get<{ content?: PerfilLyraCompleto[] }>('/api/perfis-acesso/completo', {
                params: { page: 0, size: 20, empresaId },
            });
            return (data.content ?? []).filter((p) => visivelNasConfiguracoesLyra(p));
        }
    },

    async catalogoModulosLyra(): Promise<ModuloLyraCatalogo[]> {
        const { data } = await httpClient.get<
            { sistemaCodigo?: string; modulos?: { moduloId?: number; moduloCodigo?: string; moduloNome?: string }[] }[]
        >('/api/modulos/sistemas');
        const lyra = (data || []).find((s) => (s.sistemaCodigo || '').toUpperCase() === 'LYR');
        return (lyra?.modulos || [])
            .filter((m) => m.moduloId && m.moduloCodigo)
            .map((m) => ({
                moduloId: m.moduloId as number,
                moduloCodigo: m.moduloCodigo as string,
                moduloNome: m.moduloNome || m.moduloCodigo || '',
            }));
    },

    async criar(params: {
        nome: string;
        descricao?: string;
        empresaId: number;
        flags: FlagsForm;
        catalogo: ModuloLyraCatalogo[];
    }): Promise<PerfilLyraCompleto> {
        const { data } = await httpClient.post<PerfilLyraCompleto>('/api/perfis-acesso/completo', {
            nome: params.nome.trim(),
            descricao: params.descricao?.trim() || undefined,
            empresaId: params.empresaId,
            sistemaCodigo: 'LYR',
            modulos: payloadModulos(params.flags, params.catalogo, { incluirRaiz: true }),
        });
        return data;
    },

    async atualizar(
        id: number,
        params: {
            nome: string;
            descricao?: string;
            empresaId: number;
            flags: FlagsForm;
            catalogo: ModuloLyraCatalogo[];
        }
    ): Promise<PerfilLyraCompleto> {
        const { data } = await httpClient.put<PerfilLyraCompleto>(`/api/perfis-acesso/${id}/completo`, {
            nome: params.nome.trim(),
            descricao: params.descricao?.trim() || undefined,
            empresaId: params.empresaId,
            sistemaCodigo: 'LYR',
            modulos: payloadModulos(params.flags, params.catalogo, {
                incluirRaiz: !ehFuncionarioLyra(params.nome),
            }),
        });
        return data;
    },

    async desativar(id: number): Promise<void> {
        await httpClient.delete(`/api/perfis-acesso/${id}`);
    },
};
