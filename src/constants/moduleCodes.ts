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

export const MODULOS = [
    { codigo: MODULO_RAIZ, aliases: [MODULO_RAIZ_LEGADO], nome: 'Início', path: '/inicio', descricao: 'Painel do salão' },
    { codigo: MODULO_AGENDA, nome: 'Agenda', path: '/agenda', descricao: 'Horários e atendimentos' },
    { codigo: MODULO_SERVICOS, nome: 'Serviços', path: '/servicos', descricao: 'Catálogo de serviços' },
    { codigo: MODULO_CLIENTES, nome: 'Clientes', path: '/clientes', descricao: 'Clientes do salão' },
    { codigo: MODULO_PROFISSIONAIS, nome: 'Profissionais', path: '/profissionais', descricao: 'Equipe que atende' },
    { codigo: MODULO_CONFIGURACOES, nome: 'Configurações', path: '/configuracoes', descricao: 'Perfis e permissões do Lyra' },
] as const;

export function temModuloRaiz(hasModulo: (codigo: string) => boolean): boolean {
    return MODULOS_RAIZ.some((c) => hasModulo(c));
}
