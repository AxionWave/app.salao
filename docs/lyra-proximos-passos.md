# Lyra — Próximos passos

Atualizado em 10/11/2026. Os códigos `R-xx` são os do [relatório de correções](./lyra-relatorio-correcoes.md), onde estão o local no código e o detalhe de cada problema.

## 1. Confirmar com o time do Core (antes de vender)

- [ ] O `JWT_SECRET` de produção não é o antigo valor de exemplo (`defaultSecret…`). Trocar a chave exige mudar no oAuth e na API ao mesmo tempo.
- [ ] O Core confere o token em `definir-senha-inicial` e só troca a senha do dono do token (R-05).
- [ ] Ao salvar um perfil, o Core substitui a lista inteira de módulos (R-03). Se sim, conferir que perfis antigos salvos antes da correção ainda têm o módulo principal e o de Profissionais.
- [ ] Editar a pessoa do profissional sem `senha` não altera a senha atual (R-04).
- [ ] A imagem Docker da API tem `tzdata`; testar com uma empresa em Manaus (R-25).

## 2. Agenda — corrigir nas próximas entregas

- [ ] **R-17 — Dois agendamentos no mesmo horário.** Travar por profissional na transação (`pg_advisory_xact_lock`) ou usar constraint de exclusão no Postgres. Obrigatório antes do agendamento online.
- [ ] **R-10 — Desativar profissional com agendamentos futuros.** Avisar com a lista, manter na grade quem ainda tem agendamentos e desligar o login.
- [ ] **R-14 — Cancelado cobre o horário na grade.** Esconder cancelados por padrão (com filtro) ou desenhá-los sem bloquear o clique.
- [ ] **R-30 — Slot dentro do tempo de preparo parece livre.** Desabilitar como já é feito com os bloqueios.
- [ ] **R-19 — "Não compareceu" ocupa o horário.** Decidir com o negócio se libera o horário; se sim, ajustar `GarantirLivreAsync`, `HorariosLivresAsync` e `ocupaHorario`.
- [ ] **R-11 — Mudar expediente ou fuso esconde agendamentos.** Avisar ao salvar e incluir os agendamentos no cálculo dos limites da grade.
- [ ] **R-31 — Ocupação não desconta bloqueios.** Subtrair os minutos bloqueados da capacidade (Agenda e Início).

## 3. Cadastros e perfis

- [ ] **R-22 — Serviço vinculado só a profissionais inativos.** Mostrar os inativos em "Quem atende", com aviso de que o serviço não pode ser agendado.
- [ ] **R-29 — Lacunas restantes:**
  - [ ] `PerfisController` aceita o módulo principal: qualquer usuário do Lyra lista os perfis de acesso. Restringir a quem gerencia perfis.
  - [ ] Pedir confirmação ao remover bloqueio e ao excluir perfil.
  - [ ] Decidir se o telefone continua único por cliente (familiares com o mesmo telefone são comuns em clínicas).

## 4. Sessão, fuso e acabamento

- [ ] **R-23 — Terminologia de outra sessão.** Limpar o cache `lyra-terminologia` no logout e recarregar os nomes depois do primeiro acesso.
- [ ] **R-24 — Painel não vira o dia.** Recalcular "hoje" ao voltar o foco da janela ou a cada poucos minutos.
- [ ] **R-28 — Sessão expirada redireciona para `/login` fixo.** Usar `import.meta.env.BASE_URL`.
- [ ] **R-26 — Grade no fuso do computador.** Calcular e formatar no fuso da empresa (por exemplo, `date-fns-tz`). Só importa se houver clientes atendidos de outro fuso.

## 5. Validar com usuário real (homolog)

As regras novas foram cobertas por testes de API com uma empresa falsa. Falta passar com uma conta real, no navegador:

- [ ] Horários livres com expediente com pausa, preparo e bloqueios.
- [ ] Recusas por expediente, bloqueio, preparo e "não atende".
- [ ] Salvar a configuração da empresa (nomes e fuso).
- [ ] Modal de bloqueio, faixas de expediente, "Quem atende", chips de horários livres e busca de cliente na agenda.
- [ ] Perfil só com "Agendar": consegue buscar cliente e marcar, mas não abre Clientes.

## 6. Depois (evolução do produto)

- [ ] Agendamento online pelo cliente (depende de R-17).
- [ ] Lembretes de horário (WhatsApp ou e-mail) e confirmação pelo cliente.
- [ ] Testes automatizados no CI: unitários do `AgendamentoService` e um e2e de API contra um banco descartável.
