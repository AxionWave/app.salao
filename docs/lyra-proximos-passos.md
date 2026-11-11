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
- [x] **R-26 — Fuso da empresa na grade:** as telas trabalham no relógio da empresa (`lib/fuso.ts`) e só convertem para UTC ao falar com a API. Testado com a empresa em Manaus e o computador em Brasília: o horário das 08:00 aparece às 08:00 e um clique às 10:00 grava 14:00 UTC.

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
Agenda (API) ──grava na mesma transação──▶ tabela lyra.notificacoes (outbox)
                                                  │
                                    Worker em segundo plano (HostedService)
                                    ├── Painel ao vivo ...... SignalR (WebSocket)
                                    ├── Celular/navegador ... Web Push (PWA)
                                    ├── E-mail .............. AW.Mensageria ──▶ Resend
                                    └── WhatsApp ............ AW.Mensageria ──▶ WhatsApp Cloud API (Meta)
                                                  │
                         Respostas (botões, links) ──▶ webhook ──▶ atualiza o status
                                                                   └──▶ SignalR avisa a equipe
```

- **Outbox:** a notificação é gravada na mesma transação do agendamento. Se o e-mail ou o WhatsApp estiverem fora do ar, nada se perde: o worker tenta de novo com espera crescente e registra o resultado de cada envio (enviado, entregue, lido, falhou).
- **Ao vivo para a equipe:** SignalR na própria API, autenticado pelo mesmo JWT, com um grupo por empresa (por profissional fica para quando o usuário estiver ligado ao profissional). A Agenda e o Início deixam de precisar de recarregar: um agendamento novo aparece na grade de todo mundo na hora.
- **Com o app fechado:** o front vira PWA ("instalar no celular") e usa Web Push. O profissional recebe a notificação no celular sem precisar de app na loja.
- **Lembretes agendados:** Hangfire (com Postgres) ou Quartz. Ao criar ou remarcar, agenda os lembretes; ao cancelar, remove. Precisa respeitar o fuso da empresa.
- **WhatsApp:** a Cloud API oficial da Meta. Mensagens iniciadas pela empresa exigem **modelos aprovados** pela Meta (confirmação, lembrete, cancelamento), e cada conversa tem custo. Os botões **Confirmo** / **Remarcar** voltam pelo webhook. Evitar APIs não oficiais: o número pode ser banido.
- **Entrega compartilhada (AW.Mensageria):** o Lyra decide o quê e quando avisar e monta a mensagem; a entrega é de um serviço comum a todos os sistemas da Lumen (repositório `AxionWave/AW.Mensageria`, sistema `MSG`). Ele fala com os provedores, guarda o histórico, tenta de novo quando falha e mantém a lista de quem pediu para não receber. O WhatsApp entra lá, porque a conta da Meta tem um número, um webhook e um conjunto de modelos para todos os sistemas.
- **E-mail:** Resend, com domínio próprio (`lyra.lumensoft.com.br`) e SPF/DKIM configurados para não cair no spam. O e-mail leva um anexo `.ics` para o cliente pôr na agenda do celular.
- **Links de confirmação:** um token assinado e de uso único por agendamento (`/c/{token}`), que funciona sem login.

### Configuração por empresa
- [ ] Ligar e desligar cada evento e cada canal, e definir os horários dos lembretes.
- [ ] Textos com variáveis (`{cliente}`, `{servico}`, `{data}`, `{hora}`, `{endereco}`) e os nomes do segmento (sessão, consulta, horário).
- [ ] Número de WhatsApp próprio da empresa (cada uma conecta o seu) ou o número da Lumen como padrão.
- [ ] Limite de mensagens por plano, porque WhatsApp tem custo.

### LGPD
- [ ] Consentimento do cliente para receber WhatsApp e e-mail, guardado com data e origem.
- [ ] Link de "não quero mais receber" em todas as mensagens; respeitar isso no worker.
- [x] Histórico de envios por cliente, visível na ficha (aba Mensagens).

### Entregas, em ordem
1. [x] Outbox, worker e histórico de envios.
   - A tabela `lyra.notificacoes` é ao mesmo tempo a fila e o histórico. Uma linha por canal ligado, gravada no mesmo `SaveChanges` do agendamento, para os eventos criado, remarcado (inclusive ao editar o horário ou o profissional), cancelado e confirmado. Cada linha guarda o destino e os dados da mensagem (`dados`, em JSON, com a data no fuso da empresa).
   - O worker roda a cada `Notificacoes:IntervaloSegundos` (10 s) e pega uma linha por vez com `FOR UPDATE SKIP LOCKED`, então várias instâncias da API não enviam em dobro. Se falhar, tenta de novo depois de 1 min, 5 min, 30 min, 2 h e 6 h; depois disso marca `falhou` e registra erro (vai para o Sentry).
   - Canais implementam `ICanalNotificacao`. Só entra na fila o canal que está em `Notificacoes:Canais` **e** tem implementação registrada. Nesta entrega nenhum canal real existe, então nada é enfileirado em produção; o e-mail (entrega 3) é o primeiro.
2. [x] SignalR: grade e Início ao vivo e o sino de notificações no painel.
   - Hub `PainelHub` em `/api/salao/hub/painel`, com o mesmo JWT (no WebSocket e no SSE o token vai na query `access_token`, que a api.salao e o Gateway só aceitam em `/api/{produto}/hub/**`; o log do Gateway grava só o caminho). Exige o módulo Agenda e põe a conexão no grupo `empresa-{id}`. Grupo por profissional ficou para depois: o JWT não diz qual profissional é o usuário.
   - Grade ao vivo: depois do commit, criar, remarcar, editar, mudar status, confirmar pelo link e criar ou remover bloqueio mandam `agendaAlterada` ao grupo. Agenda e Início recarregam em silêncio (sem o "carregando"), com 400 ms de espera para juntar vários avisos. Ao reconectar, recarregam também, porque podem ter perdido avisos.
   - Sino: é o canal `painel` da outbox (`Notificacoes:Canais`), uma linha por evento para a equipe, sem destino. "Enviar" é mandar `notificacao` ao grupo; o worker acorda na hora em vez de esperar os 10 s. A linha guarda `autorId` (quem fez, ou vazio quando foi o cliente pelo link) e o sino esconde o que o próprio usuário fez. `GET /api/salao/painel/notificacoes` traz os 30 últimos e quantos não foram vistos; `POST .../vistas` zera o contador (tabela `lyra.painel_leituras`, por usuário). Clicar num aviso abre a Agenda no dia. As linhas do painel não aparecem na aba Mensagens do cliente.
   - Transporte: o cliente tenta WebSocket, depois SSE e por fim long polling. O nginx do servidor não está em nenhum repositório; se ele não repassar o `Upgrade`, cai no SSE (a api.salao manda `X-Accel-Buffering: no` no hub para o nginx não segurar a resposta). Para WebSocket de verdade, o `location` da API precisa de `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade` e `proxy_set_header Connection "upgrade"`.
3. [x] E-mail: confirmação, remarcação, cancelamento, com `.ics` e link de confirmar.
   - Resend com o domínio `lyra.lumensoft.com.br` (SPF, DKIM e DMARC na Hostinger, região São Paulo, sem rastreio de abertura e clique). Remetente `naoresponda@`, com o nome da empresa como nome de exibição e `reply_to` para o e-mail dela.
   - Desde a AW.Mensageria, o `CanalEmail` monta o e-mail e pede o envio em `POST http://mensageria:8080/api/mensageria/envios` (token interno, `X-Origin-System: LYR`, chave `lyra-notificacao-{id}`). A chave do Resend (`RESEND_API_KEY`) e o remetente do Lyra ficam na Mensageria; na api.salao, sem `GATEWAY_INTERNAL_TOKEN` o canal nem é registrado. "Enviado" na ficha do cliente quer dizer que a Mensageria aceitou; destino descadastrado vira "falhou" com o motivo.
   - Retorno da entrega: o webhook do Resend chega à Mensageria (`/api/mensageria/webhooks/resend`, público no Gateway e conferido pela assinatura Svix), que avisa a api.salao em `POST http://salao:8080/api/salao/internos/mensageria/envios` (token interno, novas tentativas se ela estiver fora do ar). Na ficha: **Entregue** quando o Resend confirma; **Falhou** com o motivo quando o e-mail volta, o Resend não entrega ou as tentativas acabam; e o aviso "marcou como spam" quando o cliente reclama. Devolução e spam põem o e-mail na lista de descadastros da Mensageria, compartilhada por todos os sistemas, e os próximos nem saem.
   - Por empresa: `enviar_emails` em `lyra.empresa_config`, desligado por padrão, chave em Configurações. Os dados da empresa (nome, e-mail, telefone, endereço) são lidos de `core.empresas`.
   - Eventos: criado, remarcado, cancelado e confirmado (este só quando a equipe confirma; quando o próprio cliente confirma pelo link, a tela já mostra o resultado). O `.ics` usa o mesmo UID ao longo das remarcações e `METHOD:CANCEL` no cancelamento, então o celular atualiza o evento em vez de duplicar.
   - Sem envio em dobro: a mesma chave na Mensageria devolve o envio já criado, e a Mensageria manda ao Resend com `Idempotency-Key`. Pedido recusado (4xx, fora 408 e 429) falha na hora, sem novas tentativas.
   - Link `/c/{token}`: token assinado (HMAC) com o id do agendamento, sem login, via `GET /api/salao/publico/agendamentos/{token}` e `POST .../confirmar`. Só confirma agendamento futuro e ainda "agendado". O Gateway tem a rota `salao-public` sem o filtro de JWT.
   - Aba **Mensagens** na ficha do cliente com o histórico de envios.
   - Visual: logo da empresa (ou iniciais), selo e cor por evento, bloco de data com início, fim e duração, serviços com duração e valor e o total (sem valores no cancelamento), horário anterior riscado na remarcação, botões Google Agenda, Como chegar e WhatsApp (só celular). A versão em texto puro leva as mesmas informações. Os itens (nome, duração e preço) passaram a ser gravados em `dados` da notificação; notificações antigas saem só com os nomes.
   - Logo: enviado no ASC (Administração da Empresa) para o AW.Arquivos como imagem pública (PNG, JPG, WebP ou GIF, até 2 MB, conferida pelos bytes; SVG não). O Core guarda o token em `core.empresas.logo_token` (`PATCH /api/empresas/{id}/logo`), o Gateway serve `/api/arquivos/publico/{token}` sem JWT e o e-mail monta a URL com `Email:UrlArquivos` (padrão `https://api.lumensoft.com.br`). Se a coluna ainda não existir no Core, o e-mail sai sem logo. Antes do envio, o ASC abre um recorte (quadrado 1:1 ou horizontal 3:1, com arrastar e zoom) e manda um PNG já no tamanho final; a troca e a remoção do logo só aparecem no modo de edição de Dados da empresa.
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
