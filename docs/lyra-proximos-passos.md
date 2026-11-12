# Lyra — Próximas etapas de evolução

Atualizado em 11/11/2026. Os códigos `R-xx` são os do [relatório de correções](./lyra-relatorio-correcoes.md).

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
- **Lembretes agendados:** um serviço em segundo plano que, a cada minuto, procura o que venceu (sem Hangfire nem Quartz). Cancelar não precisa remover nada: só agendamento de pé recebe lembrete. Respeita o fuso da empresa.
- **WhatsApp:** a Cloud API oficial da Meta. Mensagens iniciadas pela empresa exigem **modelos aprovados** pela Meta (confirmação, lembrete, cancelamento), e cada conversa tem custo. Os botões **Confirmo** / **Remarcar** voltam pelo webhook. Evitar APIs não oficiais: o número pode ser banido.
- **Entrega compartilhada (AW.Mensageria):** o Lyra decide o quê e quando avisar e monta a mensagem; a entrega é de um serviço comum a todos os sistemas da Lumen (repositório `AxionWave/AW.Mensageria`, sistema `MSG`). Ele fala com os provedores, guarda o histórico, tenta de novo quando falha e mantém a lista de quem pediu para não receber. O WhatsApp entra lá, porque a conta da Meta tem um número, um webhook e um conjunto de modelos para todos os sistemas.
- **E-mail:** Resend, com domínio próprio (`lyra.lumensoft.com.br`) e SPF/DKIM configurados para não cair no spam. O e-mail leva um anexo `.ics` para o cliente pôr na agenda do celular.
- **Links de confirmação:** um token assinado e de uso único por agendamento (`/c/{token}`), que funciona sem login.

### Configuração por empresa
- [x] Ligar e desligar cada evento e cada canal, e definir os horários dos lembretes (o WhatsApp entra na mesma tela quando existir).
- [x] Textos com variáveis (`{cliente}`, `{servico}`, `{data}`, `{hora}`, `{endereco}` e outras) e os nomes do segmento (sessão, consulta, horário).
- [ ] Número de WhatsApp próprio da empresa (cada uma conecta o seu) ou o número da Lumen como padrão.
- [ ] Limite de mensagens por plano, porque WhatsApp tem custo.

### LGPD
- [ ] Consentimento do cliente para receber WhatsApp e e-mail, guardado com data e origem.
- [x] Link de "não quero mais receber" em todos os e-mails; respeitar isso no worker (o WhatsApp terá o seu quando existir).
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
   - Transporte: o cliente tenta WebSocket, depois SSE e por fim long polling. O nginx do servidor não está em nenhum repositório; se ele não repassar o `Upgrade`, cai no SSE (a api.salao manda `X-Accel-Buffering: no` no hub para o nginx não segurar a resposta). Desde 12/11/2026 o site `api.lumensoft.com.br` repassa (`Upgrade` e `Connection` via `map $http_upgrade $lyra_connection_upgrade`), aplicado pelo workflow manual `nginx-api-websocket.yml` do app.salao (ação `mostrar` só lê; `aplicar` guarda cópia em `/root/nginx-backups`, roda `nginx -t` e volta sozinho se falhar).
3. [x] E-mail: confirmação, remarcação, cancelamento, com `.ics` e link de confirmar.
   - Resend com o domínio `lyra.lumensoft.com.br` (SPF, DKIM e DMARC na Hostinger, região São Paulo, sem rastreio de abertura e clique). Remetente `naoresponda@`, com o nome da empresa como nome de exibição e `reply_to` para o e-mail dela.
   - Desde a AW.Mensageria, o `CanalEmail` monta o e-mail e pede o envio em `POST http://mensageria:8080/api/mensageria/envios` (token interno, `X-Origin-System: LYR`, chave `lyra-notificacao-{id}`). A chave do Resend (`RESEND_API_KEY`) e o remetente do Lyra ficam na Mensageria; na api.salao, sem `GATEWAY_INTERNAL_TOKEN` o canal nem é registrado. "Enviado" na ficha do cliente quer dizer que a Mensageria aceitou; destino descadastrado vira "falhou" com o motivo.
   - Retorno da entrega: o webhook do Resend chega à Mensageria (`/api/mensageria/webhooks/resend`, público no Gateway e conferido pela assinatura Svix), que avisa a api.salao em `POST http://salao:8080/api/salao/internos/mensageria/envios` (token interno, novas tentativas se ela estiver fora do ar). Na ficha: **Entregue** quando o Resend confirma; **Falhou** com o motivo quando o e-mail volta, o Resend não entrega ou as tentativas acabam; e o aviso "marcou como spam" quando o cliente reclama. Devolução e spam põem o e-mail na lista de descadastros da Mensageria, valendo para todos os sistemas, e os próximos nem saem. O pedido do próprio cliente pelo link vale só para a empresa que mandou (veja a entrega 7).
   - Por empresa: `enviar_emails` em `lyra.empresa_config`, desligado por padrão, chave em Configurações. Os dados da empresa (nome, e-mail, telefone, endereço) são lidos de `core.empresas`.
   - Eventos: criado, remarcado, cancelado e confirmado (este só quando a equipe confirma; quando o próprio cliente confirma pelo link, a tela já mostra o resultado). O `.ics` usa o mesmo UID ao longo das remarcações e `METHOD:CANCEL` no cancelamento, então o celular atualiza o evento em vez de duplicar.
   - Sem envio em dobro: a mesma chave na Mensageria devolve o envio já criado, e a Mensageria manda ao Resend com `Idempotency-Key`. Pedido recusado (4xx, fora 408 e 429) falha na hora, sem novas tentativas.
   - Link `/c/{token}`: token assinado (HMAC) com o id do agendamento, sem login, via `GET /api/salao/publico/agendamentos/{token}` e `POST .../confirmar`. Só confirma agendamento futuro e ainda "agendado". O Gateway tem a rota `salao-public` sem o filtro de JWT.
   - Aba **Mensagens** na ficha do cliente com o histórico de envios.
   - Visual: logo da empresa (ou iniciais), selo e cor por evento, bloco de data com início, fim e duração, serviços com duração e valor e o total (sem valores no cancelamento), horário anterior riscado na remarcação, botões Google Agenda, Como chegar e WhatsApp (só celular). A versão em texto puro leva as mesmas informações. Os itens (nome, duração e preço) passaram a ser gravados em `dados` da notificação; notificações antigas saem só com os nomes.
   - Logo: enviado no ASC (Administração da Empresa) para o AW.Arquivos como imagem pública (PNG, JPG, WebP ou GIF, até 2 MB, conferida pelos bytes; SVG não). O Core guarda o token em `core.empresas.logo_token` (`PATCH /api/empresas/{id}/logo`), o Gateway serve `/api/arquivos/publico/{token}` sem JWT e o e-mail monta a URL com `Email:UrlArquivos` (padrão `https://api.lumensoft.com.br`). Se a coluna ainda não existir no Core, o e-mail sai sem logo. Antes do envio, o ASC abre um recorte (quadrado 1:1 ou horizontal 3:1, com arrastar e zoom) e manda um PNG já no tamanho final; a troca e a remoção do logo só aparecem no modo de edição de Dados da empresa.
4. [ ] WhatsApp: modelos aprovados, envio, webhook dos botões.
5. [x] Lembretes agendados e resumo do dia do profissional.
   - Sem Hangfire: o `AgendadorAvisos` roda a cada minuto na própria API e põe na fila o que venceu. Cada aviso reserva uma chave em `lyra.avisos_programados` (`lembrete:{agendamento}:{horas}:{início}`, `resumo:{profissional}:{dia}`) na mesma transação da notificação, então sai uma vez só, mesmo com várias instâncias. As chaves somem depois de 4 dias.
   - Lembrete ao cliente: `lembretes_horas` em `lyra.empresa_config` (padrão 24 h; na tela, "1 dia antes" e "2 horas antes"; a API aceita até 3 valores de 1 a 72). Vale para agendado e confirmado. Com 24 h e 2 h, cada um sai na sua hora; se a API ficou fora, sai só o mais próximo. Quem marcou ou foi remarcado já dentro da janela não recebe, porque acabou de receber o e-mail do agendamento. Como a chave leva o início, remarcar arma o lembrete de novo.
   - O e-mail diz "hoje" ou "amanhã" (no fuso da empresa), traz o botão de confirmar só se ainda não está confirmado e não manda `.ics` (o convite foi no e-mail do agendamento). Por enquanto sai só por e-mail, então depende de "Avisar clientes por e-mail"; o WhatsApp entra pelo mesmo evento (`agendamento_lembrete`). O sino não mostra lembretes.
   - Resumo do dia: `resumo_diario` em `lyra.empresa_config` (desligado por padrão, independente do e-mail aos clientes). A partir das 7h no fuso da empresa (até o meio-dia, se a API ficou fora), cada profissional ativo com agendamentos no dia recebe a lista: horário, cliente, serviços, confirmado ou não e observações, com o botão "Abrir a agenda" (`/agenda?data=…`). Usa a terminologia da empresa. O e-mail vem do Core: `core.pessoas.email_login` da pessoa do profissional ou, sem ele, o do usuário ligado a ela (`core.usuario_pessoa`). Profissional sem e-mail fica sem resumo.
6. [x] PWA e Web Push.
   - PWA: `public/manifest.webmanifest` (abre em `/inicio`, tela cheia), ícones em `public/icons` e `public/sw.js`. O service worker só cuida do push e do clique na notificação; não guarda nada offline. O `sw.js` precisa sair sem cache: em produção o front é servido pelo nginx da VPS (`/var/www/enterprise-apps/lyra`), que já manda `no-cache`; o `nginx.conf` do repositório só vale para a imagem Docker. No iPhone o push só funciona com o app adicionado à tela de início (Safari → Compartilhar → Adicionar à Tela de Início); o sino explica isso.
   - Ligar: rodapé do sino, "Ativar avisos neste aparelho". Cada aparelho vira uma linha em `lyra.push_assinaturas` (endpoint único; se outro usuário entra no mesmo aparelho, a assinatura passa para ele). Sair do sistema remove a assinatura do aparelho. Rotas: `GET /api/salao/push/chave`, `POST /api/salao/push/assinaturas` e `POST /api/salao/push/assinaturas/remover`.
   - Envio: o canal `push` manda os mesmos eventos do sino (novo, remarcado, cancelado, confirmado pelo cliente) a todos os aparelhos da empresa, menos os de quem fez a ação. Cifra aes128gcm (RFC 8291) e VAPID (RFC 8292) feitos na própria API, sem biblioteca; só aceita endpoints do Google, Mozilla, Apple e Microsoft. Clicar na notificação abre a agenda do dia. Resposta 404/410 apaga a assinatura. O histórico da ficha do cliente não mostra o push.
   - Celular (abaixo de 768 px): o menu vira gaveta (botão ☰ no cabeçalho, com perfil, tema e Sair no rodapé), o cabeçalho fica fixo no topo e os botões da página descem para uma faixa abaixo dele. O sino abre em largura total. Tabelas viram cartões (`Table.Cell rotulo`), a semana vira lista por dia, o mês mostra só a contagem por dia e a grade do dia usa colunas mais estreitas. Campos com fonte de 16 px (o iPhone não dá zoom ao focar) e respiro para o entalhe e a barra inferior do iPhone (`env(safe-area-inset-*)`, `--lyra-safe-top`).
   - Chaves VAPID nos secrets `WEBPUSH_PUBLIC_KEY` e `WEBPUSH_PRIVATE_KEY` do api.salao. Sem elas o canal não liga e o botão não aparece. Trocar as chaves invalida as assinaturas existentes (cada aparelho precisa ativar de novo).
7. [x] Tela de configuração das notificações e textos.
   - Configurações → **Avisos e mensagens** reúne o que antes ficava em Dados da empresa ("Avisar clientes por e-mail", lembretes e resumo do dia) e, por evento (marcado, alterado, cancelado, presença confirmada, lembrete), liga e desliga o **e-mail ao cliente** e o **celular da equipe** (push). O sino do painel mostra tudo sempre. Lembrete sem nenhum horário marcado fica desligado.
   - Fica em `lyra.empresa_config.avisos` (jsonb). Evento que não está lá vale ligado e com o texto padrão, então empresas antigas continuam como estavam. Ligar e desligar vale ao pôr na fila; os textos são lidos na hora do envio.
   - **Editar texto** troca o assunto e o primeiro parágrafo de cada e-mail, com variáveis (`{cliente}` primeiro nome, `{servico}`, `{profissional}`, `{data}`, `{hora}`, `{dia}` hoje/amanhã/data, `{quando}`, `{quando_anterior}`, `{empresa}`, `{endereco}`, `{telefone}`). Variável desconhecida é recusada; assunto até 150 caracteres e mensagem até 1000 (quebra de linha vira `<br>`). Texto igual ao padrão ou em branco volta a ser o padrão. O resto do e-mail (data, serviços, endereço, botões) é fixo. Prévia ao vivo com dados de exemplo da empresa (`POST /api/salao/configuracao/avisos/previa`) e botão "Restaurar padrão".
   - **Recado em todo e-mail** (até 500 caracteres, aceita as mesmas variáveis): caixa em destaque em todos os e-mails ao cliente, menos no de cancelamento.
   - Rotas: `GET` e `PUT /api/salao/configuracao/avisos`, com o módulo Configurações.
   - **Não quero mais receber:** todo e-mail tem o link no rodapé e os cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post` (cancelar com um clique no Gmail e no Outlook). Quem monta o link é a Mensageria, com o código do envio (`https://api.lumensoft.com.br/api/mensageria/publico/descadastro/env_…`, público no Gateway). A página pede confirmação antes de descadastrar (leitores de link de antivírus abrem o GET) e oferece "Voltar a receber". O descadastro pelo link vale para o sistema e a empresa daquele e-mail; os próximos envios dela para esse endereço saem como "descadastrado".

---

## Etapa 2 — Portal do cliente

O cliente entra, se cadastra e marca sozinho.

### Acesso
- [x] **Endereço por empresa:** `lyra.lumensoft.com.br/{endereco}` (ex.: `/salao-bela`), com logo, apresentação, endereço, telefone, serviços e profissionais. É o link que a empresa põe no Instagram e no Google. Cores próprias por empresa ficaram para depois.
- [x] **Login sem senha por e-mail:** o cliente informa o e-mail e recebe um código de 6 dígitos. Pelo WhatsApp entra junto com a entrega 4 da Etapa 1.
- [x] **Conta separada da equipe:** o cliente não é usuário do Core. A conta fica no próprio Lyra (`lyra.contas_cliente`, uma por e-mail), com token próprio e escopo só do portal, e é ligada à ficha pelo e-mail ou pelo telefone (pelo telefone, sem ganhar acesso ao que já era da ficha: ver Área do cliente). Um cliente nunca chega às rotas da equipe.
- [x] **Uma conta, várias empresas:** a conta é do e-mail, e em cada empresa ela vira (ou encontra) a ficha daquela empresa; cada empresa vê só a sua.
- [ ] **Dependentes:** quem entra pelo telefone ou e-mail da família marca para qualquer membro dela (usa o grupo familiar que já existe).

### Agendamento online
- [x] Fluxo: serviço (um ou mais) → profissional ou "sem preferência" (pulado quando só um atende) → dia → horário livre → e-mail e código → nome e telefone (só na primeira vez) → confirmar.
- [x] Vários serviços são feitos em sequência e reservam o tempo somado (mais o preparo de cada um): só aparecem horários em que tudo cabe, e o resumo mostra "reservado das 10:00 às 13:30". Na confirmação, "Alterar serviços" troca a lista sem sair da tela; se o novo total não couber no horário escolhido (ou o profissional não fizer algum), passa para quem faz todos ou volta para a escolha do horário com o aviso.
- [x] Regras por empresa: antecedência mínima, janela máxima, limite de agendamentos em aberto por cliente, de quanto em quanto tempo os horários aparecem e até quando o cliente cancela ou remarca sozinho.
- [x] Escolher quais serviços e profissionais aparecem online.
- [x] Agendamento online já entrar confirmado: opção "Já entrar confirmado" em Configurações → Agendamento online (desligada por padrão). Ligada, o que o cliente marca ou remarca pelo site entra como "confirmado", a tela diz "Horário marcado e confirmado!" e o e-mail sai sem o botão de confirmar presença. O que a equipe marca continua "agendado".
- [x] Proteção: limites de códigos por e-mail e por IP, tentativas por código e a mesma checagem de conflito da agenda (R-17).
- [ ] Captcha no pedido de código, se aparecer abuso.

### Como ficou (entregas 1 a 3)
- **Configuração:** Configurações → **Agendamento online** (módulo Configurações). Liga e desliga a página, escolhe o endereço (sugestão a partir do nome da empresa, conferência ao digitar, endereços reservados como `agenda` e `configuracoes` recusados, único entre empresas), texto de apresentação (até 500 caracteres), antecedência (0 a 7 dias), janela (1 a 365 dias), limite em aberto (1 a 20), passo dos horários (10, 15, 20, 30 ou 60 min) e quais serviços e profissionais ficam de fora. Fica em `lyra.empresa_config.portal` (jsonb) e `portal_endereco` (índice único). Rotas: `GET`/`PUT /api/salao/configuracao/portal` e `GET .../portal/disponivel?endereco=`.
- **Página pública:** `GET /api/salao/publico/portal/{endereco}` e `.../horarios?data&servicoIds&profissionalId`, sem login (rota `salao-public` do Gateway). Página desligada ou inexistente dá 404. Aparecem só profissionais ativos, com disponibilidade e não ocultos, e serviços ativos, não ocultos e com ao menos um deles. Os horários são os livres da agenda (mesma regra da equipe), dentro da antecedência e da janela.
- **Código por e-mail:** `POST .../codigo` manda o código pela AW.Mensageria como envio **transacional** (sai mesmo para quem pediu "não quero mais receber" daquela empresa; só e-mail que voltou ou marcou spam bloqueia, e aí a tela pede outro e-mail). O código vale 10 minutos e 5 tentativas; no banco fica só o HMAC (`lyra.codigos_acesso`). Limites: um código a cada 30 s e 5 por hora por e-mail, 30 por hora por IP; acima disso, 429.
- **Sessão do cliente:** `POST .../entrar` devolve um token próprio (audiência `lyra-portal`, 30 dias), guardado no navegador. `GET`/`PUT .../conta` lê e completa nome e telefone; se a ficha já existe, vem preenchido dela. O token da equipe não serve nas rotas do cliente e vice-versa.
- **Agendar:** `POST .../agendamentos`. Só aceita horário que está na grade livre naquele momento (o cliente nunca vê o motivo de um bloqueio da equipe; vê "Este horário não está mais livre"). Sem preferência, fica com o profissional livre com menos horários no dia. A ficha é achada pelo e-mail, depois pelo telefone, ou criada ("Cadastro feito pelo agendamento online."); ficha inativa recusa e manda falar com a empresa. Entra como "agendado", com origem cliente: o sino e o push dizem "Novo horário online" e o e-mail de "Horário marcado" sai ao cliente como os outros.

### Área do cliente
- [x] Próximos agendamentos, com botões de cancelar (com motivo, dentro do prazo da empresa), remarcar (usa a mesma remarcação da equipe) e adicionar à agenda.
- [x] Histórico e dados pessoais (nome e telefone).
- [x] Preferências de notificação pelo portal: em Meus horários → Seus dados, "Avisos por e-mail" liga e desliga os avisos daquela empresa para o e-mail da conta. É a mesma lista do link "não quero mais receber" (fica na AW.Mensageria, por sistema e empresa; `GET`/`PUT .../portal/{endereco}/conta/preferencias` na api.salao, que chama `GET`/`PUT /api/mensageria/preferencias` com o token interno). O código de acesso continua chegando. E-mail que voltou ou foi marcado como spam aparece com o motivo e não se reativa pelo site. O WhatsApp entra na mesma tela quando existir.
- [x] "Marcar de novo" com o mesmo serviço e profissional.

### Como ficou (entrega 4: área do cliente)
- **Onde:** na página da empresa, "Meus horários" (ou "Já marcou? Ver meus horários" sem login, que pede o código e volta para lá). A tela de "Horário marcado!" também leva para lá e já tem "Adicionar à agenda".
- **O que o cliente vê:** os agendamentos da empresa que a conta marcou (`agendamentos.conta_cliente_id`, herdado na remarcação) e os das fichas com o e-mail da conta, que é verificado pelo código. A ficha achada só pelo telefone **não** ganha mais o e-mail da conta e não entra na área: o telefone não é verificado, e quem digitasse o telefone de outra pessoa veria os horários dela. Os e-mails de um agendamento feito pelo portal vão para o e-mail da conta, não para o da ficha. Horário de outra pessoa dá 404.
- **Próximos e histórico:** `GET .../meus-agendamentos` devolve os em aberto que ainda não acabaram e os 20 últimos do histórico (atendidos, faltas e cancelados; o cancelado por remarcação some, porque o novo horário já conta a história). Cada item traz `cadeia` (o primeiro da cadeia de remarcações), `podeAlterar` e `alterarAte`.
- **Prazo:** Configurações → Agendamento online → "Cancelar e remarcar pelo site": não permitir, até a hora do horário, ou até 2, 6, 12, 24 (padrão) ou 48 horas antes (a API aceita de 0 a 168). Fora do prazo, a área mostra o telefone da empresa e a API responde 409 com a mesma orientação.
- **Cancelar:** `POST .../meus-agendamentos/{id}/cancelar` com motivo opcional (até 200). Usa o mesmo cancelamento da equipe, com origem cliente: o sino e o push dizem "Cliente cancelou" (com o termo da empresa) e o cliente recebe o e-mail de cancelamento com o motivo.
- **Remarcar:** `GET .../meus-agendamentos/{id}/horarios?data&profissionalId` mostra a grade com os mesmos serviços, sem contar o próprio horário como ocupado (dá para trocar por um vizinho que encosta nele). `POST .../remarcar` com `inicio` e `profissionalId` opcional passa pelas mesmas regras de agendar (antecedência, janela, grade, serviço ainda visível) e usa a remarcação da equipe: o anterior fica cancelado como "Remarcado", o sino diz "Cliente remarcou" e o e-mail de "Horário alterado" mantém o mesmo evento no calendário.
- **Adicionar à agenda:** link do Google Agenda e arquivo `.ics` gerado no navegador, com o mesmo UID dos convites por e-mail (`lyra-agendamento-{cadeia}@lyra.lumensoft.com.br`), então o calendário atualiza o evento em vez de duplicar.
- **Marcar de novo:** no histórico, leva direto ao dia e horário com os mesmos serviços e profissional, se ainda estiverem na página.

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
