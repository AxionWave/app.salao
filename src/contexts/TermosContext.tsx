import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '@core/services';
import {
    configuracaoService,
    type ChaveTermo,
    type ConfiguracaoEmpresa,
    type Terminologia,
    type Termo,
} from '@/services/configuracao.service';

const STORAGE_KEY = 'lyra-terminologia';

/** Igual ao segmento "beleza" da API: é o que a empresa vê enquanto não configurou nada. */
export const TERMINOLOGIA_PADRAO: Terminologia = {
    recurso: { singular: 'Profissional', plural: 'Profissionais', genero: 'm' },
    servico: { singular: 'Serviço', plural: 'Serviços', genero: 'm' },
    cliente: { singular: 'Cliente', plural: 'Clientes', genero: 'm' },
    agendamento: { singular: 'Horário', plural: 'Horários', genero: 'm' },
};

export interface Termos extends Terminologia {
    /** "Novo serviço", "Nova consulta". */
    novo: (chave: ChaveTermo) => string;
    /** "Editar serviço". */
    editar: (chave: ChaveTermo) => string;
    /** "Nenhum serviço", "Nenhuma consulta". */
    nenhum: (chave: ChaveTermo) => string;
    /** Singular ou plural em minúsculas, conforme `n`. */
    contagem: (chave: ChaveTermo, n: number) => string;
    /** Singular em minúsculas (para meio de frase). */
    um: (chave: ChaveTermo) => string;
    /** Plural em minúsculas (para meio de frase). */
    varios: (chave: ChaveTermo) => string;
    /** Concorda palavra masculina terminada em "o"/"os": adj('agendamento', 'cadastrado') → "cadastrada" se feminino. */
    adj: (chave: ChaveTermo, masculino: string) => string;
}

interface TermosContextValue {
    termos: Termos;
    configuracao: ConfiguracaoEmpresa | null;
    recarregar: () => Promise<void>;
    aplicar: (config: ConfiguracaoEmpresa) => void;
}

function lerCache(): Terminologia | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Terminologia) : null;
    } catch {
        return null;
    }
}

function montar(t: Terminologia): Termos {
    const minus = (s: string) => s.toLocaleLowerCase('pt-BR');
    const termo = (c: ChaveTermo): Termo => t[c];
    return {
        ...t,
        novo: (c) => `${termo(c).genero === 'f' ? 'Nova' : 'Novo'} ${minus(termo(c).singular)}`,
        editar: (c) => `Editar ${minus(termo(c).singular)}`,
        nenhum: (c) => `${termo(c).genero === 'f' ? 'Nenhuma' : 'Nenhum'} ${minus(termo(c).singular)}`,
        contagem: (c, n) => minus(n === 1 ? termo(c).singular : termo(c).plural),
        um: (c) => minus(termo(c).singular),
        varios: (c) => minus(termo(c).plural),
        adj: (c, masculino) => {
            if (termo(c).genero !== 'f') return masculino;
            if (masculino.endsWith('os')) return `${masculino.slice(0, -2)}as`;
            if (masculino.endsWith('o')) return `${masculino.slice(0, -1)}a`;
            return masculino;
        },
    };
}

const TermosContext = createContext<TermosContextValue | null>(null);

export function TermosProvider({ children }: { children: ReactNode }) {
    const [terminologia, setTerminologia] = useState<Terminologia>(() => lerCache() ?? TERMINOLOGIA_PADRAO);
    const [configuracao, setConfiguracao] = useState<ConfiguracaoEmpresa | null>(null);

    const aplicar = useCallback((config: ConfiguracaoEmpresa) => {
        setConfiguracao(config);
        setTerminologia(config.terminologia);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config.terminologia));
        } catch {
            /* storage cheio ou bloqueado: segue com o estado em memória */
        }
    }, []);

    const recarregar = useCallback(async () => {
        if (!authService.isAuthenticated()) return;
        try {
            aplicar(await configuracaoService.obter());
        } catch {
            /* API fora do ar: mantém o cache/padrão para não travar a tela */
        }
    }, [aplicar]);

    useEffect(() => {
        void recarregar();
    }, [recarregar]);

    const value = useMemo<TermosContextValue>(
        () => ({ termos: montar(terminologia), configuracao, recarregar, aplicar }),
        [terminologia, configuracao, recarregar, aplicar]
    );

    return <TermosContext.Provider value={value}>{children}</TermosContext.Provider>;
}

export function useTermos(): Termos {
    const ctx = useContext(TermosContext);
    return ctx ? ctx.termos : montar(TERMINOLOGIA_PADRAO);
}

export function useConfiguracaoEmpresa(): TermosContextValue {
    const ctx = useContext(TermosContext);
    if (!ctx) throw new Error('useConfiguracaoEmpresa fora do TermosProvider');
    return ctx;
}
