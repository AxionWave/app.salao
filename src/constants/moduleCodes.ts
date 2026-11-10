import type { ChaveTermo } from '@/services/configuracao.service';

/** Códigos alinhados ao Core (seed) e ao claim JWT `modulos`. */
export const SIGLA = 'LYR';
export const MODULO_RAIZ = 'LYRA000000';
export const MODULO_RAIZ_LEGADO = 'LYR0000000';
export const MODULOS_RAIZ = [MODULO_RAIZ, MODULO_RAIZ_LEGADO] as const;
export const MODULO_AGENDA = 'LYR0000001';
export const MODULO_SERVICOS = 'LYR0000002';
export const MODULO_CLIENTES = 'LYR0000003';
export const MODULO_PROFISSIONAIS = 'LYR0000004';
export const MODULO_CONFIGURACOES = 'LYR0000005';
export const MODULO_RELATORIO = 'LYR0000006';

/** `termo`: o nome do menu vem da terminologia da empresa (plural). */
export const MODULOS: readonly {
    codigo: string;
    aliases?: readonly string[];
    nome: string;
    termo?: ChaveTermo;
    path: string;
}[] = [
    { codigo: MODULO_RAIZ, aliases: [MODULO_RAIZ_LEGADO], nome: 'Início', path: '/inicio' },
    { codigo: MODULO_AGENDA, nome: 'Agenda', path: '/agenda' },
    { codigo: MODULO_SERVICOS, nome: 'Serviços', termo: 'servico', path: '/servicos' },
    { codigo: MODULO_CLIENTES, nome: 'Clientes', termo: 'cliente', path: '/clientes' },
    { codigo: MODULO_PROFISSIONAIS, nome: 'Profissionais', termo: 'recurso', path: '/profissionais' },
    { codigo: MODULO_CONFIGURACOES, nome: 'Configurações', path: '/configuracoes' },
];

export function temModuloRaiz(hasModulo: (codigo: string) => boolean): boolean {
    return MODULOS_RAIZ.some((c) => hasModulo(c));
}
