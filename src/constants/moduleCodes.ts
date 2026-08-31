/** Códigos alinhados ao Core (seed) e ao claim JWT `modulos`. */
export const SIGLA = 'LYR';
export const MODULO_RAIZ = 'LYR0000000';
export const MODULO_AGENDA = 'LYR0000001';
export const MODULO_SERVICOS = 'LYR0000002';
export const MODULO_CLIENTES = 'LYR0000003';

export const MODULOS = [
    { codigo: 'LYR0000000', nome: 'Início', path: '/inicio', descricao: 'Painel do salão' },
    { codigo: 'LYR0000001', nome: 'Agenda', path: '/agenda', descricao: 'Horários e atendimentos' },
    { codigo: 'LYR0000002', nome: 'Serviços', path: '/servicos', descricao: 'Catálogo de serviços' },
    { codigo: 'LYR0000003', nome: 'Clientes', path: '/clientes', descricao: 'Clientes do salão' },
] as const;
