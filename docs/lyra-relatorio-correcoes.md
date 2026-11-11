# Lyra — Relatório do que não está funcionando e deve ser corrigido

Data: 10/11/2026. Escopo: `api.salao` (.NET 8) e `app.salao` (React), incluindo as Fases 1 e 2 ainda não commitadas.

**Como foi feito:** leitura do código (backend e front) e testes de API com uma empresa falsa (999999), sem gravar dados reais. As telas **não** foram testadas no navegador com um usuário real, e o Core/Gateway (login, pessoas, perfis) não está nestes repositórios. Itens que dependem deles estão marcados **"a confirmar"**.
Cada item tem um código `R-xx`. O que falta fazer está em [próximos passos](./lyra-proximos-passos.md).

## Resumo

| Severidade | Qtd | O que significa |
|---|---|---|
| **Alta** | 7 | Falha de segurança, perda de acesso ou tela principal inutilizável. Corrigir antes de vender. |
| **Média** | 12 | Dado errado ou fluxo comum quebrado em situações reais. Corrigir nas próximas entregas. |
| **Baixa** | 12 | Incômodo, texto, caso raro. Corrigir quando passar pelo código. |

Prioridade sugerida: **R-01, R-02** (segurança) → **R-03, R-06, R-07** (acesso e agenda) → **R-04** (dados pessoais) → o resto das Médias.

## Situação em 10/11/2026

**Corrigidos:** R-01 a R-10, R-11 (expediente; o fuso ainda não avisa), R-12 a R-18, R-19 (com o botão Remarcar), R-20 a R-24, R-26 a R-31 (R-29 inteiro, com a família para o telefone único). Os itens do backend foram validados por testes de API (114 de 114 passando).

O que mudou para quem usa:
- A API não sobe em produção sem `JWT_SECRET` e ignora os cabeçalhos `X-Empresa-Id`, `X-User-Roles` e afins.
- O cliente do agendamento é escolhido por busca (nome, telefone ou e-mail, cada palavra em qualquer campo), pela rota nova `GET /api/salao/agendamentos/clientes`, liberada para o módulo Agenda.
- Na edição de agendamento, o que não foi trocado pode estar inativo, e preço/duração gravados são mantidos.
- Não dá para marcar no passado (5 min de tolerância), concluir ou marcar falta antes do início, nem iniciar atendimento mais de 1 h antes. Status finais pedem confirmação.
- Listagem de agendamentos limitada a 62 dias; de bloqueios, a um ano.
- O perfil de acesso tem a opção "Cadastrar profissionais" e sempre mantém o módulo principal.
- Editar profissional limpa os dados da pessoa anterior, bloqueia o Salvar até a pessoa carregar e só manda senha quando o login é ligado agora.
- `/primeiro-acesso` exige login e usa o e-mail da sessão.
- Início mostra os bloqueios (mês, semana e dia) e vira o dia sozinho.
- Serviços mostram profissionais inativos ainda vinculados como "(inativo)" e avisam quando ninguém ativo atende.
- A lista de perfis de acesso (`GET /api/salao/perfis-acesso`) exige o módulo Profissionais ou Configurações.
- Remover bloqueio e excluir perfil pedem confirmação. Sair apaga os nomes personalizados guardados no navegador.
- Agenda, Início, bloqueios e avisos de impacto mostram e gravam os horários no fuso da empresa, mesmo quando o computador está em outro fuso. Uma linha discreta avisa quando os dois diferem.
- Erros da API e do front em produção vão para o Sentry (projetos `lyra-api` e `lyra-web`), que avisa por e-mail. Uma tela que quebra mostra "Algo deu errado nesta tela" com o botão Recarregar, em vez da página de erro do React Router.
- Base das notificações (sem efeito visível ainda): criar, remarcar, cancelar e confirmar agendamento gravam a mensagem numa fila (`lyra.notificacoes`) na mesma transação, e um worker envia com novas tentativas. Como nenhum canal real está ligado, nada é enfileirado em produção. O histórico por cliente sai em `GET /api/salao/clientes/{id}/notificacoes`.
- A grade do dia (Agenda e Início) se ajusta à altura da tela: as linhas encolhem até um mínimo legível para o expediente inteiro caber, e, se não couber, a grade rola por dentro e abre na hora atual. Horários que já passaram (5 min de tolerância, como na API) e dias anteriores não abrem para marcar, nem pelo "+ Horário" da semana.
- E-mail para o cliente (Resend, remetente `naoresponda@lyra.lumensoft.com.br` com o nome da empresa e resposta para o e-mail dela): horário marcado, alterado, cancelado e presença confirmada, com `.ics` para a agenda do celular. Fica desligado até a empresa ligar "Avisar clientes por e-mail" em Configurações. Nome, e-mail, telefone e endereço vêm do cadastro da empresa no Core. A ficha do cliente ganhou a aba Mensagens, e o link `/c/{token}` do e-mail abre uma página sem login para confirmar presença (rota pública `/api/salao/publico/**` no Gateway).
- E-mail redesenhado: logo da empresa no topo (ou as iniciais, se não houver), selo e cor por tipo de aviso, data em destaque com início, fim e duração, serviços com duração e valor e o total (os valores não aparecem no cancelamento), horário anterior riscado na remarcação e botões para Google Agenda, Como chegar (Google Maps) e WhatsApp da empresa (só quando o telefone é celular). O logo é enviado no ASC, em Administração da Empresa, e fica guardado no AW.Arquivos como imagem pública (PNG, JPG, WebP ou GIF, até 2 MB), servida sem login por `/api/arquivos/publico/{token}` no Gateway; o Core guarda o token em `core.empresas.logo_token`.

**A confirmar no Core:** se o Core também confere o token em `definir-senha-inicial` (R-05) e se substitui a lista de módulos ao salvar perfil (R-03). Também conferir se o `JWT_SECRET` de produção não é o antigo valor de exemplo (`defaultSecret…`): a API aceita qualquer chave não vazia, e trocar exige mudar o oAuth junto.

**Pendentes:** nenhum. O R-25 não se confirmou: a imagem tem `tzdata`, e o CI checa isso.

---

## Alta

### R-01 — Chave do token padrão no repositório
- **Onde:** `api.salao/src/Lyra.API/appsettings.json` (linha 10) e `Program.cs` (linhas 53–56). Em Development, `Program.cs` (linhas 75–83) também desliga a verificação da assinatura.
- **Problema:** se a variável `JWT_SECRET` não estiver definida no servidor, vale a chave `defaultSecretKeyForJWTTokenGenerationAndValidation`, que está no código. Quem conhece a chave forja um token de qualquer empresa ou de super admin. Se o servidor subir como Development por engano, nem a chave é necessária.
- **Correção:** a API deve recusar subir sem `JWT_SECRET` (ou com a chave padrão), e a chave deve sair do `appsettings.json`.

### R-02 — Empresa e permissões aceitas por cabeçalho
- **Onde:** `Lyra.Infrastructure/Auth/HttpCurrentUserAccessor.cs` (linhas 20–38).
- **Problema:** quando o token não traz `empresaId` ou `roles`, a API usa os cabeçalhos `X-Empresa-Id` e `X-User-Roles` mandados pelo próprio navegador. Basta mandar `X-User-Roles: SUPER_ADMIN` para passar em qualquer permissão, ou trocar `X-Empresa-Id` para ver outra empresa. A confirmar se o Gateway apaga esses cabeçalhos.
- **Correção:** remover esse plano B, ou aceitar os cabeçalhos só quando vierem do Gateway.

### R-03 — Salvar um perfil remove acessos sem aviso
- **Onde:** `app.salao/src/services/perfilAcesso.service.ts`. O catálogo está nas linhas 67–73, os módulos enviados nas linhas 143–170 e o `incluirRaiz` na linha 274.
- **Problema:**
  - O catálogo de permissões não tem "Profissionais". Ao salvar qualquer perfil, o módulo de Profissionais é retirado, e só o admin continua vendo essa tela.
  - Ao salvar o perfil "Funcionário Lyra", o módulo principal do Lyra é retirado. A partir daí ninguém com esse perfil consegue logar.
  - A confirmar se o Core substitui a lista inteira de módulos (é o mais provável).
- **Correção:** incluir "Profissionais" no catálogo e enviar sempre o módulo principal.

### R-04 — Editar profissional pode gravar dados de outra pessoa
- **Onde:** `app.salao/src/pages/Profissionais.tsx`: `abrirEditar` (linhas 184–227) e o envio da pessoa (linhas 229–244).
- **Problema:** ao abrir a edição, CPF, telefone, nascimento e e-mail do profissional aberto antes continuam no formulário até a busca terminar (ou para sempre, se ela falhar). Um "Salvar" nesse momento grava no cadastro da pessoa os dados errados. Além disso, toda edição com login ligado manda `senha = CPF`, o que pode redefinir a senha da pessoa (a confirmar no Core).
- **Correção:** limpar os campos ao abrir, bloquear o Salvar até a pessoa carregar, e só mandar senha na criação ou quando o login for ligado agora.

### R-05 — Tela de primeiro acesso sem estar logado (a confirmar)
- **Onde:** `app.salao/src/pages/PrimeiroAcesso.tsx` (linhas 60–72 e 99).
- **Problema:** abrir `/primeiro-acesso?email=alguem@x.com` sem estar logado mostra o formulário de definir senha para aquele e-mail. Se o Core não conferir o token, dá para trocar a senha de outra pessoa.
- **Correção:** exigir sessão e usar o e-mail do token, nunca o da URL. Confirmar o comportamento no Core.

### R-06 — Quem só tem "Agendar" não consegue escolher cliente
- **Onde:** `app.salao/src/pages/Agenda.tsx` (linhas 158–161, erro escondido) e `api.salao/.../ClientesController.cs` (linha 13, exige o módulo Clientes).
- **Problema:** para um perfil de recepção só com "Agendar", a lista de clientes volta 403. A tela diz "Nenhum cliente ativo", e não dá para marcar nada.
- **Correção:** criar uma busca de clientes liberada para o módulo Agenda, por exemplo `GET /agendamentos/clientes?busca=`.

### R-07 — A Agenda só mostra 10 clientes
- **Onde:** `app.salao/src/pages/Agenda.tsx` (linha 159 pede `pageSize: 200`) e `api.salao/.../ClienteService.cs` (linha 22: acima de 100, volta para 10).
- **Problema:** o formulário de agendamento lista só os 10 primeiros clientes em ordem. A partir do 11º, não dá para marcar horário para o cliente.
- **Correção:** trocar o select por um campo de busca de clientes (que também resolve R-06 e escala para milhares). Paliativo: pedir `pageSize: 100`.

---

## Média

### R-08 — Não dá para editar agendamento com serviço, cliente ou profissional desativado
- **Onde:** `AgendamentoService.AtualizarAsync`, que chama a mesma validação da criação.
- **Problema:** se o serviço foi desativado depois, até mudar só a observação dá erro "inativo". No front o serviço some da lista e os horários livres falham em silêncio.
- **Correção:** na edição, só exigir "ativo" do que foi trocado.

### R-09 — Editar recalcula preço e duração pelo catálogo atual
- **Onde:** `AgendamentoService.AtualizarAsync` (os itens são recriados com o preço e a duração atuais).
- **Problema:** mudar só a observação de um atendimento antigo troca o preço gravado pelo novo preço da tabela. Se a duração mudou, o horário de fim também muda e pode até dar erro de conflito.
- **Correção:** se a lista de serviços não mudou, manter os itens como estão.

### R-10 — Desativar profissional com agendamentos futuros
- **Onde:** `ProfissionalService` (sem nenhuma checagem) e `OpcoesAsync` (só devolve ativos).
- **Problema:** os agendamentos dele somem da grade, mas continuam contando nos indicadores. Não dá para editá-los, e o login da pessoa continua ativo.
- **Correção:** avisar com a lista de agendamentos futuros antes de desativar, mostrar na grade os inativos que ainda têm agendamentos e desligar o login.

### R-11 — Mudar expediente ou fuso deixa agendamentos fora da grade
- **Onde:** `ProfissionalService.Aplicar` e `ConfiguracaoEmpresaService.SalvarAsync`. Os limites da grade estão em `lib/agenda.ts` (`limitesGrade`).
- **Problema:** se o expediente passa a começar mais tarde, os agendamentos antes do novo horário ficam fora da área visível da grade (escondidos ou por cima do cabeçalho).
- **Correção:** avisar ao salvar quantos agendamentos ficam fora e incluir os agendamentos no cálculo dos limites da grade.

### R-12 — Clicar num dia de folga no expediente o transforma em dia de trabalho
- **Onde:** `app.salao/src/components/ExpedienteAgenda.tsx` (linha 140).
- **Problema:** só de clicar em "Dom" para olhar, o domingo vira 09:00–19:00, e isso é salvo junto.
- **Correção:** o clique só seleciona o dia; para trabalhar nele, usar o botão "Trabalha".

### R-13 — Status: qualquer transição e sem confirmação
- **Onde:** `StatusAgendamento.cs` (linhas 28–35), `lib/agenda.ts` (`transicoesDe`) e `Agenda.tsx`.
- **Problema:** dá para "Concluir" ou marcar "Não compareceu" um agendamento da semana que vem. "Cancelar" e "Não compareceu" são definitivos e acontecem com um clique.
- **Correção:** definir quais transições valem (por exemplo, não concluir antes do início) e pedir confirmação nos status finais.

### R-14 — Agendamento cancelado cobre o horário na grade
- **Onde:** `GradeDia.tsx` (bloco do agendamento por cima dos slots).
- **Problema:** clicar no horário de um cancelado abre o cancelado. Não dá para remarcar ali pelo clique, e um novo agendamento fica sobreposto.
- **Correção:** esconder os cancelados por padrão (com um filtro para mostrar) ou desenhá-los estreitos e sem bloquear o clique.

### R-15 — Tela Início ignora bloqueios
- **Onde:** `Inicio.tsx` (as grades são montadas sem `bloqueios`).
- **Problema:** férias e feriados aparecem como horário livre no painel, e clicar leva a um erro.
- **Correção:** carregar os bloqueios também no painel.

### R-16 — Criar profissional pode deixar pessoa solta no Core
- **Onde:** `Profissionais.tsx` (linhas 262–282).
- **Problema:** a pessoa é criada no Core antes do profissional no Lyra. Se o Lyra recusar (nome repetido, por exemplo), a pessoa fica sem vínculo, e tentar de novo esbarra em CPF duplicado.
- **Correção:** reaproveitar o `pessoaId` já criado na nova tentativa, ou fazer as duas criações no backend.

### R-17 — Dois agendamentos no mesmo horário ao mesmo tempo
- **Onde:** `AgendamentoService.GarantirLivreAsync` (checa e grava sem trava).
- **Problema:** duas pessoas salvando o mesmo horário no mesmo segundo conseguem as duas. Fica mais provável com o agendamento online.
- **Correção:** usar uma trava por profissional na transação (por exemplo, `pg_advisory_xact_lock`) ou uma constraint de exclusão no Postgres.

### R-18 — Listagens sem limite de período
- **Onde:** `AgendamentoService.ListarAsync` e `BloqueioService.ListarAsync`.
- **Problema:** pedir de 2000 a 2100 traz a tabela inteira com joins, o que é pesado e um risco de lentidão.
- **Correção:** limitar o período (por exemplo, no máximo 62 dias).

### R-19 — "Não compareceu" continua ocupando o horário
- **Onde:** `GarantirLivreAsync`, `HorariosLivresAsync` e `ocupaHorario` em `lib/agenda.ts`.
- **Problema:** depois de marcar falta, não dá para encaixar outra pessoa naquele horário.
- **Correção:** liberar o horário para `no_show` (decisão de negócio).

---

## Baixa

### R-20 — Dá para marcar no passado
- **Problema:** `CriarAsync` não confere se o início já passou; só os horários livres filtram isso.
- **Correção:** recusar, ou permitir só como "registro retroativo" explícito.

### R-21 — Novo agendamento já vem com o primeiro cliente escolhido
- **Onde:** `Agenda.tsx` (`abrirNovo`).
- **Problema:** é fácil marcar para o cliente errado sem perceber.
- **Correção:** começar com o campo vazio.

### R-22 — Serviço vinculado só a profissionais inativos
- **Onde:** `ServicoService.ListarAsync` (só devolve ativos) e `Servicos.tsx`.
- **Problema:** aparece "#12" em "Quem atende", e o serviço fica impossível de agendar sem nenhum aviso.
- **Correção:** listar também os vinculados inativos, com aviso.

### R-23 — Terminologia de outra sessão e texto fixo
- **Onde:** `TermosContext.tsx` (cache não é limpo no logout), `PrimeiroAcesso.tsx` (não recarrega os nomes) e `Inicio.tsx` (texto fixo "Nenhuma cadeira cadastrada").
- **Correção:** limpar o cache no logout, recarregar depois do primeiro acesso e usar os termos configurados.

### R-24 — Painel não vira o dia
- **Onde:** `Inicio.tsx` ("hoje" é calculado uma vez só).
- **Problema:** com a aba aberta durante a noite, o painel continua mostrando o dia anterior.
- **Correção:** recalcular periodicamente ou quando a janela volta ao foco.

### R-25 — Fuso fixo em −3 quando o servidor não tem a base de fusos (a confirmar)
- **Onde:** `FusoHorarioEmpresa.cs`.
- **Problema:** se o container não tiver `tzdata`, Manaus, Rio Branco e Lisboa ficam com 1 a 3 horas de erro.
- **Correção:** garantir `tzdata` na imagem Docker e testar com uma empresa de Manaus.

### R-26 — A grade usa o fuso do computador, não o da empresa
- **Onde:** front inteiro (`lib/agenda.ts` e grades).
- **Problema:** quem acessa de outro fuso vê os horários deslocados. Hoje aparece um aviso amarelo, mas a grade não corrige.
- **Correção:** formatar e calcular as datas no fuso da empresa (por exemplo com `date-fns-tz`). Só importa se houver clientes atendidos de outro fuso.

### R-27 — Caracteres estranhos na Agenda
- **Onde:** `Agenda.tsx`, 5 ocorrências de "⬦" ("Montando a grade⬦", "Salvando⬦", "Atualizando⬦", "Adicionar serviço⬦", "Recado interno, preferência⬦").
- **Problema:** o arquivo foi salvo com a codificação errada em algum momento; deveria ser "…".
- **Correção:** trocar por "…".

### R-28 — Sessão expirada pode redirecionar para o lugar errado (a confirmar)
- **Onde:** `http.service.ts` (linha 70, `window.location.href = '/login'`).
- **Problema:** se o app for publicado num subcaminho, o redirecionamento sai dele.
- **Correção:** usar `import.meta.env.BASE_URL`.

### R-29 — Pequenas lacunas
- `PerfisController.cs` aceita o módulo principal, então qualquer usuário do Lyra lista os perfis de acesso.
- O aviso ao criar bloqueio conta também agendamentos passados ou concluídos (`BloqueioService.cs`, linhas 80–86).
- Remover bloqueio e excluir perfil não pedem confirmação.
- Telefone único por cliente impede cadastrar familiares com o mesmo telefone (decisão de negócio; em clínicas é comum).

### R-30 — Slot dentro do tempo de preparo parece livre
- **Onde:** `GradeDia.tsx`.
- **Problema:** o horário logo depois de um atendimento com preparo aparece clicável, mas dá erro ao salvar.
- **Correção:** desabilitar os slots cobertos pelo preparo, como já é feito com os bloqueios.

### R-31 — Ocupação não desconta bloqueios
- **Onde:** `Agenda.tsx` e `Inicio.tsx` (cálculo da ocupação).
- **Problema:** num dia com férias de meio período, a capacidade continua cheia e a porcentagem fica baixa.
- **Correção:** subtrair os minutos bloqueados da capacidade.

---

## O que ainda não foi testado de ponta a ponta

Estes itens passaram em compilação e em testes de API com dados vazios, mas precisam ser validados com um usuário real:

- O cálculo dos horários livres com dados reais: expediente com pausa, preparo e bloqueios.
- A recusa por expediente, bloqueio, preparo e "não atende".
- Salvar a configuração da empresa (`PUT /configuracao`) com uma conta real.
- Todas as telas novas no navegador: modal de bloqueio, faixas de expediente, "Quem atende" e chips de horários livres.
