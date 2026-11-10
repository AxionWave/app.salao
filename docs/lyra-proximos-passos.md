# Lyra — Próximas etapas de evolução

Atualizado em 10/11/2026. Os códigos `R-xx` são os do [relatório de correções](./lyra-relatorio-correcoes.md).

A ordem das etapas segue as dependências: cada uma usa o que a anterior entrega. O agendamento online, por exemplo, precisa da trava contra horário duplicado (Etapa 0) e do envio de mensagens (Etapa 1) para o código de acesso e a confirmação.

| Etapa | Entrega | Depende de |
|---|---|---|
| 0 | Base sólida: pendências, trava de horário, testes no CI | — |
| 1 | Notificações ao vivo: painel, e-mail e WhatsApp | 0 |
| 2 | Portal do cliente: cadastro, login e agendamento online | 0 e 1 |
| 3 | Menos faltas: confirmação, lembretes, lista de espera | 1 e 2 |
| 4 | Financeiro: sinal via Pix, caixa, comissão | 2 |
| 5 | Gestão: relatórios, indicadores, várias unidades | 4 |
| 6 | Clínicas: ficha de atendimento e anexos | 0 |

---

## Etapa 0 — Base sólida

Sem isto, o agendamento online gera horário duplicado e ninguém percebe uma regressão.

**Confirmar com o time do Core**
- [ ] O `JWT_SECRET` de produção não é o antigo valor de exemplo (trocar exige mudar no oAuth e na API ao mesmo tempo).
- [ ] O Core confere o token em `definir-senha-inicial` (R-05) e substitui a lista de módulos ao salvar perfil (R-03).
- [ ] Editar a pessoa sem `senha` não altera a senha atual (R-04).
- [x] A imagem Docker da API tem `tzdata` (R-25): conferido (versão 2026f, com Manaus e Lisboa), e o CI checa a cada execução.

**Agenda**
- [x] **R-17 — Trava contra dois agendamentos no mesmo horário.** `pg_advisory_xact_lock` por empresa e profissional ao criar, editar e remarcar. Testado com 10 pedidos simultâneos: só 1 grava.
- [x] **Remarcar** (decisão para R-19): a equipe remarca agendamentos em aberto, faltas e cancelados. O original em aberto é cancelado com motivo "Remarcado" e o novo guarda `remarcadoDeId`. Cancelar pede um motivo opcional. A falta continua ocupando o horário.
- [x] **R-10 — Desativar profissional:** antes de desativar, a tela lista os agendamentos futuros em aberto e oferece desligar o login (nunca o do próprio usuário). Inativo continua na grade enquanto tiver agendamentos, sem aceitar horários novos.
- [x] **R-11 — Expediente que esconde agendamentos:** ao salvar um expediente que deixa agendamentos de fora, a tela lista quais são e pede confirmação; a grade se estende para mostrá-los. (Troca de fuso da empresa ainda não avisa.)
- [x] **R-14 — Cancelado na grade:** vira uma faixa estreita à direita, clicável para remarcar; o resto do horário fica livre para marcar.
- [x] **R-30 — Preparo:** horários dentro do preparo ficam desabilitados na grade.
- [x] **R-31 — Ocupação:** a capacidade desconta os bloqueios (Agenda e Início).

**Cadastros, sessão e acabamento**
- [x] **Família (decisão para o telefone único de R-29):** fichas podem formar um grupo familiar com parentesco; telefone e e-mail só se repetem dentro da mesma família. Ao digitar um contato que já existe, a ficha oferece entrar na família.
- [x] R-22 serviço só com profissionais inativos (a lista mostra "(inativo)" e avisa quando ninguém ativo atende) · R-29 (perfis só para quem tem Profissionais ou Configurações; remover bloqueio e excluir perfil pedem confirmação) · R-23 termos limpos ao sair e recarregados no primeiro acesso · R-24 Início vira o dia sozinho (a cada minuto e ao voltar para a aba) · R-28 redirecionamento da sessão respeita o subcaminho do app.
- [ ] R-26 fuso da empresa na grade.

**Qualidade**
- [x] Testes de integração em `api.salao/tests/Lyra.Tests` (43 casos: conflito, expediente com pausa, preparo, bloqueio, status, remarcação, concorrência, permissões com token assinado, isolamento entre empresas e profissionais inativos). Cada execução cria um Postgres descartável; o GitHub Actions roda em todo push na `develop` e o deploy em `production` só segue se passarem.
- [x] Erros, logs e alerta no Sentry (organização `lumen-6u`, projetos `lyra-api` e `lyra-web`). A API manda os 500 como issue e os logs do `ILogger` (Warning de negócio vira só breadcrumb); o front captura erros de tela, navegação e replay com texto mascarado. Nenhum dado de cliente sai (sem PII, corpo de requisição nem query string). Só liga com DSN: produção (compose e workflow) tem, local e testes não. Alerta: regra padrão "high priority issues" por e-mail em cada projeto.
- [x] Source maps do front no Sentry: o build de produção envia os mapas com o secret `SENTRY_AUTH_TOKEN` (token de organização) e os apaga antes de publicar. Sem o secret o build sai sem mapas e a pilha de erros do front vem minificada.
- [ ] Validar com uma conta real no homolog: horários livres com pausa, preparo e bloqueio; configuração da empresa; perfil só com "Agendar".

---

## Etapa 1 — Notificações ao vivo

### O que cada um recebe

| Evento | Profissional / recepção | Cliente |
|---|---|---|
| Agendamento criado (pela equipe ou online) | Aviso na hora no painel e no celular | E-mail e WhatsApp com data, serviço, endereço e botões **Confirmar** / **Cancelar** |
| Cliente confirmou ou cancelou | Aviso na hora; a grade se atualiza sozinha | Mensagem de confirmação do que fez |
| Remarcado | Aviso para o profissional antigo e o novo | E-mail e WhatsApp com o novo horário |
| Cancelado pela equipe | — | E-mail e WhatsApp, com link para remarcar |
| Lembrete (24 h e 2 h antes, configurável) | Resumo do dia às 7h | WhatsApp com botões **Confirmo** / **Preciso remarcar** |
| Cliente atrasado ou chegou | Aviso para o profissional | — |
| Bloqueio criado em cima de agendamentos | Lista dos afetados | Mensagem pedindo para remarcar |

### Como funciona por dentro

```
Agenda (API) ──grava na mesma transação──▶ tabela notificacao_pendente (outbox)
                                                  │
                                    Worker em segundo plano (HostedService)
                                    ├── Painel ao vivo ...... SignalR (WebSocket)
                                    ├── Celular/navegador ... Web Push (PWA)
                                    ├── E-mail .............. Amazon SES ou Resend
                                    └── WhatsApp ............ WhatsApp Cloud API (Meta)
                                                  │
                         Respostas (botões, links) ──▶ webhook ──▶ atualiza o status
                                                                   └──▶ SignalR avisa a equipe
```

- **Outbox:** a notificação é gravada na mesma transação do agendamento. Se o e-mail ou o WhatsApp estiverem fora do ar, nada se perde: o worker tenta de novo com espera crescente e registra o resultado de cada envio (enviado, entregue, lido, falhou).
- **Ao vivo para a equipe:** SignalR na própria API, autenticado pelo mesmo JWT, com um grupo por empresa e outro por profissional. A Agenda e o Início deixam de precisar de recarregar: um agendamento novo aparece na grade de todo mundo na hora.
- **Com o app fechado:** o front vira PWA ("instalar no celular") e usa Web Push. O profissional recebe a notificação no celular sem precisar de app na loja.
- **Lembretes agendados:** Hangfire (com Postgres) ou Quartz. Ao criar ou remarcar, agenda os lembretes; ao cancelar, remove. Precisa respeitar o fuso da empresa.
- **WhatsApp:** a Cloud API oficial da Meta. Mensagens iniciadas pela empresa exigem **modelos aprovados** pela Meta (confirmação, lembrete, cancelamento), e cada conversa tem custo. Os botões **Confirmo** / **Remarcar** voltam pelo webhook. Evitar APIs não oficiais: o número pode ser banido.
- **E-mail:** Amazon SES (mais barato) ou Resend (mais simples), com domínio próprio e SPF/DKIM configurados para não cair no spam. O e-mail leva um anexo `.ics` para o cliente pôr na agenda do celular.
- **Links de confirmação:** um token assinado e de uso único por agendamento (`/c/{token}`), que funciona sem login.

### Configuração por empresa
- [ ] Ligar e desligar cada evento e cada canal, e definir os horários dos lembretes.
- [ ] Textos com variáveis (`{cliente}`, `{servico}`, `{data}`, `{hora}`, `{endereco}`) e os nomes do segmento (sessão, consulta, horário).
- [ ] Número de WhatsApp próprio da empresa (cada uma conecta o seu) ou o número da Lumen como padrão.
- [ ] Limite de mensagens por plano, porque WhatsApp tem custo.

### LGPD
- [ ] Consentimento do cliente para receber WhatsApp e e-mail, guardado com data e origem.
- [ ] Link de "não quero mais receber" em todas as mensagens; respeitar isso no worker.
- [ ] Histórico de envios por cliente, visível na ficha.

### Entregas, em ordem
1. [ ] Outbox, worker e histórico de envios.
2. [ ] SignalR: grade e Início ao vivo e o sino de notificações no painel.
3. [ ] E-mail: confirmação, remarcação, cancelamento, com `.ics` e link de confirmar.
4. [ ] WhatsApp: modelos aprovados, envio, webhook dos botões.
5. [ ] Lembretes agendados e resumo do dia do profissional.
6. [ ] PWA e Web Push.
7. [ ] Tela de configuração das notificações e textos.

---

## Etapa 2 — Portal do cliente

O cliente entra, se cadastra e marca sozinho.

### Acesso
- **Endereço por empresa:** `lyra.lumensoft.com.br/{empresa}`, com logo, cores, endereço, serviços e profissionais. É o link que a empresa põe no Instagram e no Google.
- **Login sem senha:** o cliente informa o telefone ou o e-mail e recebe um código de 6 dígitos por WhatsApp ou e-mail (usa a Etapa 1). Mais simples para o público e sem senha para esquecer.
- **Conta separada da equipe:** o cliente não é usuário do Core. Criar uma conta de cliente no próprio Lyra, com token próprio e escopo só do portal, ligada à ficha existente pelo telefone ou pelo e-mail. Assim um cliente nunca chega às rotas da equipe.
- **Uma conta, várias empresas:** a mesma pessoa pode ser cliente de mais de uma empresa da Lumen; cada empresa vê só a sua ficha.
- **Dependentes:** quem entra pelo telefone ou e-mail da família marca para qualquer membro dela (usa o grupo familiar que já existe).

### Agendamento online
- [ ] Fluxo: serviço → profissional (ou "qualquer um") → dia → horário livre (usa a rota de horários livres que já existe) → confirmar.
- [ ] Regras por empresa: antecedência mínima (ex.: 2 h), janela máxima (ex.: 60 dias), limite de agendamentos em aberto por cliente, prazo para cancelar ou remarcar sozinho.
- [ ] Escolher quais serviços e profissionais aparecem online e se o agendamento online já entra confirmado ou fica "a confirmar" pela recepção.
- [ ] Proteção: limite de tentativas por IP e por telefone, captcha no cadastro e a trava de R-17.

### Área do cliente
- [ ] Próximos agendamentos, com botões de cancelar (com motivo, dentro do prazo da empresa), remarcar (usa a mesma rota de remarcação da equipe) e adicionar à agenda.
- [ ] Histórico, dados pessoais e preferências de notificação.
- [ ] "Marcar de novo" com o mesmo serviço e profissional.

---

## Etapa 3 — Menos faltas e mais encaixes

- [ ] **Confirmação obrigatória:** sem confirmação até X horas antes, a recepção recebe aviso (e a empresa pode liberar o horário automaticamente).
- [ ] **Lista de espera:** o cliente pede um dia ou um profissional cheio. Quando alguém cancela, os da lista recebem WhatsApp e o primeiro que aceitar fica com o horário.
- [ ] **Agendamento recorrente:** "toda terça às 10h por 8 semanas" (terapias, fisioterapia, pacotes).
- [ ] **Retorno:** o serviço sugere quando voltar (ex.: 30 dias) e o cliente recebe um convite para marcar.
- [ ] **Avaliação pós-atendimento:** nota e comentário; nota baixa avisa o gestor.
- [ ] Indicador de faltas por cliente, com regra opcional de exigir sinal para quem falta muito.

---

## Etapa 4 — Financeiro

- [ ] **Sinal no agendamento online via Pix** (Mercado Pago, Asaas ou Efí), com devolução conforme a regra de cancelamento.
- [ ] **Fechar atendimento:** serviços, produtos, desconto e forma de pagamento; gera o recibo.
- [ ] **Pacotes e planos:** "10 sessões", com saldo debitado a cada atendimento.
- [ ] **Comissão por profissional:** percentual por serviço e relatório do período.
- [ ] **Caixa do dia:** entradas por forma de pagamento e fechamento.
- [ ] Nota fiscal de serviço (NFS-e) por integração, em uma fase posterior.

---

## Etapa 5 — Gestão

- [ ] Relatórios: faturamento, ocupação, faltas, serviços e profissionais mais procurados, clientes novos e clientes que sumiram.
- [ ] Painel do dono com comparação entre meses.
- [ ] Exportar para Excel.
- [ ] Várias unidades na mesma empresa, com profissionais que atendem em mais de uma.
- [ ] Sincronização com o Google Agenda do profissional.
- [ ] Registro de quem fez o quê (auditoria) em agendamentos, cadastros e perfis.

---

## Etapa 6 — Clínicas e consultórios

Para o segmento de saúde, com cuidado extra de LGPD (dado sensível).

- [ ] Ficha de atendimento por sessão (evolução), com modelos por especialidade.
- [ ] Anexos (exames, fotos de antes e depois) em armazenamento privado.
- [ ] Anamnese que o cliente preenche no portal antes da primeira consulta.
- [ ] Acesso restrito à ficha: só o profissional que atendeu e quem a empresa autorizar, com registro de cada acesso.
- [ ] Termo de consentimento assinado no portal.
