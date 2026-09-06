import { httpClient, lyraClient } from '@core/services';

export interface PerfilAcesso {
    id: number;
    nome: string;
    descricao?: string;
    ativo?: boolean;
    sistemaCodigo?: string | null;
}

function ehPerfilEquipeLyra(p: PerfilAcesso): boolean {
    const codigo = (p.sistemaCodigo || '').toUpperCase();
    if (codigo === 'LYR') return true;
    if (codigo === 'ASC') return false;
    const nome = (p.nome || '').toLowerCase();
    if (/super\s*admin|cliente\s*admin|^administrador$/.test(nome)) return false;
    return /lyra|profissional|funcion/.test(nome);
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
};
