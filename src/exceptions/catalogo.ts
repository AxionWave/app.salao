/**
 * Catálogo de mensagens ao utilizador.
 * Para um campo novo (ex. rg), acrescente em MENSAGENS_CAMPO.
 */
export const MENSAGENS_CAMPO: Record<string, string> = {
    cpf: 'Este CPF já está cadastrado.',
    cnpj: 'Já existe uma empresa com este CNPJ.',
    email: 'Este e-mail já está em uso.',
    email_login: 'Este e-mail já está em uso.',
    telefone: 'Este telefone já está cadastrado.',
    nome: 'Já existe um cadastro com este nome.',
};

export const MENSAGEM_DUPLICIDADE_GENERICA =
    'Estes dados já estão cadastrados. Confira CPF, e-mail ou telefone.';

export const TITULOS = {
    duplicidade: 'Cadastro duplicado',
    acesso: 'Acesso negado',
    rede: 'Sem conexão',
    salvar: 'Não foi possível salvar',
    conflito: 'Horário ocupado',
} as const;
