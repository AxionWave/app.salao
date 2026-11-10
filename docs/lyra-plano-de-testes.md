# Lyra — Plano de testes pelo front

Roteiro manual para validar o sistema usando só a interface (front em `http://localhost:3002`, API em `http://localhost:8092`, homolog).
Marque cada caso com `[x]` quando passar. Quando falhar, anote o que aconteceu ao lado.
Casos marcados com **⚠ R-xx** têm um problema conhecido no [relatório de correções](./lyra-relatorio-correcoes.md) e devem falhar até ele ser corrigido.

## 0. Preparação

- [ ] **P-01** Front e API no ar: abrir `http://localhost:8092/health` responde 200 e `http://localhost:3002` abre a tela de login.
- [ ] **P-02** Ter uma empresa de teste em homolog (não usar empresa de cliente real).
- [ ] **P-03** Ter três usuários nessa empresa:
  - **Admin**: perfil "Cliente Admin" (todos os módulos).
  - **Recepção**: perfil com só "Agendar".
  - **Sem acesso**: usuário sem nenhum módulo Lyra.
- [ ] **P-04** Anotar o fuso do computador (Configurações do Windows → Data e hora) para comparar com o fuso da empresa.

Massa de dados sugerida (criada nos próprios testes abaixo):
- Profissionais: **Ana** (seg–sex 09:00–12:00 e 13:00–18:00) e **Bruno** (seg–sáb 08:00–17:00).
- Serviços: **Consulta** (30 min, só Ana, preparo 10 min), **Retorno** (15 min, todos), **Avaliação** (60 min, só Bruno).
- Clientes: **Maria Teste**, **João Teste** e mais 12 clientes para testar listas longas.

---

## 1. Login e sessão

- [ ] **L-01** Login com usuário e senha corretos → entra na tela Início.
- [ ] **L-02** Senha errada → mensagem de erro, continua na tela de login.
- [ ] **L-03** Usuário **Sem acesso** → login recusado com mensagem clara.
- [ ] **L-04** Após login, os nomes do menu seguem a terminologia da empresa (ex.: "Profissionais" ou "Médicos").
- [ ] **L-05** Sair (logout) → volta ao login; botão "voltar" do navegador não reabre telas internas.
- [ ] **L-06** Logar com outra empresa no mesmo navegador → a terminologia é a da nova empresa, não a da anterior. **⚠ R-23**
- [ ] **L-07** Primeiro acesso: usuário novo define a senha e entra. A terminologia aparece correta logo depois. **⚠ R-23**
- [ ] **L-08** Deixar a sessão expirar (ou apagar o token no navegador) e clicar em algo → volta ao login sem tela quebrada.

## 2. Configurações → Empresa (segmento, fuso, nomes)

- [ ] **C-01** Abrir Configurações → o bloco da empresa mostra segmento, fuso e nomes atuais.
- [ ] **C-02** Trocar o segmento para "Saúde" e salvar → menu e telas passam a usar os nomes do segmento (ex.: "Pacientes", "Consultas").
- [ ] **C-03** Ligar "Personalizar nomes", mudar "Profissional" para "Médica" (gênero feminino) e salvar → textos concordam no feminino ("Nova médica", "Nenhuma médica", "Todas as médicas").
- [ ] **C-04** Personalizar com um campo vazio → Salvar bloqueado ou erro claro.
- [ ] **C-05** Nome com mais de 40 caracteres → erro claro.
- [ ] **C-06** Desligar "Personalizar nomes" e salvar → volta aos nomes do segmento.
- [ ] **C-07** Trocar o fuso para "Manaus" e salvar → a Agenda mostra o aviso "Fuso horário diferente" (se o computador estiver em Brasília).
- [ ] **C-08** Voltar o fuso para o do computador → o aviso some.
- [ ] **C-09** Recarregar a página (F5) → as configurações salvas continuam.
- [ ] **C-10** Usuário **Recepção** não vê o item Configurações no menu.

## 3. Configurações → Perfis de acesso

- [ ] **PA-01** Listar perfis → aparecem "Cliente Admin", "Funcionário Lyra" e os personalizados.
- [ ] **PA-02** Criar perfil "Recepção" só com "Agendar" → salva e aparece na lista.
- [ ] **PA-03** Editar o perfil "Recepção" e salvar sem mudar nada → o usuário desse perfil continua acessando a Agenda. **⚠ R-03**
- [ ] **PA-04** Editar o "Funcionário Lyra" e salvar → os usuários desse perfil continuam conseguindo logar. **⚠ R-03**
- [ ] **PA-05** Perfil com "Profissionais"? Verificar se existe a opção de dar acesso à tela Profissionais. **⚠ R-03**
- [ ] **PA-06** Excluir um perfil personalizado → pede confirmação antes. **⚠ R-29**

## 4. Serviços

- [ ] **S-01** Criar **Consulta**: 30 min, R$ 150,00, categoria "Clínica", preparo 10 min, quem atende: só Ana → salva e aparece na lista com "+ 10 min de preparo" e "Ana".
- [ ] **S-02** Criar **Retorno**: 15 min, quem atende: "Todos" → coluna "Quem atende" mostra todos.
- [ ] **S-03** Criar **Avaliação**: 1,5 hora (usar a unidade "Horas") → lista mostra "1 h 30 min".
- [ ] **S-04** Criar serviço com nome repetido → erro "Já existe um serviço com este nome".
- [ ] **S-05** Duração 0 ou vazia → Salvar bloqueado.
- [ ] **S-06** Preparo acima de 240 → o campo limita a 240.
- [ ] **S-07** Editar **Consulta**, marcar também Bruno, salvar, reabrir → Ana e Bruno marcados.
- [ ] **S-08** Editar e clicar "Todos" → volta para todos atendem.
- [ ] **S-09** Buscar "consul" → filtra a lista. Filtros Todos/Ativos/Inativos funcionam.
- [ ] **S-10** Desativar um serviço → some do formulário de agendamento; reativar → volta.
- [ ] **S-11** Paginação: com mais de 10 serviços, "Próxima" e "Anterior" funcionam.
- [ ] **S-12** Serviço vinculado só a um profissional que foi desativado → aviso na tela. **⚠ R-22**

## 5. Clientes / Pacientes

- [ ] **CL-01** Criar **Maria Teste** com telefone válido → aparece na lista.
- [ ] **CL-02** Telefone inválido → bloqueia o Salvar.
- [ ] **CL-03** Mesmo telefone em outro cliente → erro de duplicado (ver se isso é desejado para familiares). **⚠ R-29**
- [ ] **CL-04** Editar, buscar, desativar e reativar cliente.
- [ ] **CL-05** Cadastrar 12 clientes ou mais e abrir "Novo agendamento" → **todos** aparecem no campo cliente. **⚠ R-07**
- [ ] **CL-06** Cliente desativado não aparece no formulário de agendamento.

## 6. Profissionais e expediente

- [ ] **PR-01** Criar **Ana** com CPF, nascimento e telefone válidos → aparece na lista com o resumo do expediente.
- [ ] **PR-02** No expediente de Ana: segunda com 09:00–12:00, clicar "+ Adicionar faixa" e ajustar para 13:00–18:00 → a tela mostra "com pausas" e o resumo "09:00–12:00, 13:00–18:00".
- [ ] **PR-03** Repetir a pausa de segunda a sexta; sábado e domingo como "Folga" → salvar e reabrir mostra igual.
- [ ] **PR-04** Faixas sobrepostas (09:00–12:00 e 11:00–14:00) → mensagem em vermelho e Salvar bloqueado.
- [ ] **PR-05** Término antes do início → mensagem em vermelho e Salvar bloqueado.
- [ ] **PR-06** Remover uma faixa com o "×" → some.
- [ ] **PR-07** Só clicar no domingo (que está de folga) para olhar e salvar → o domingo **continua** de folga. **⚠ R-12**
- [ ] **PR-08** CPF inválido → bloqueia o Salvar.
- [ ] **PR-09** Criar com "Pode fazer login" e e-mail → a pessoa consegue logar depois.
- [ ] **PR-10** Abrir a edição de Bruno logo depois de Ana → os campos mostram os dados de Bruno, nunca os de Ana (repetir com internet lenta: DevTools → Network → Slow 3G). **⚠ R-04**
- [ ] **PR-11** Editar um profissional com login e salvar → a senha dele **não** muda. **⚠ R-04**
- [ ] **PR-12** Criar profissional com nome repetido → erro; tentar de novo com outro nome → não dá erro de CPF duplicado. **⚠ R-16**
- [ ] **PR-13** Desativar um profissional com agendamentos futuros → aviso com a quantidade. **⚠ R-10**
- [ ] **PR-14** Mudar o expediente deixando um agendamento futuro fora do horário → aviso; o agendamento continua visível na grade. **⚠ R-11**

## 7. Agenda — visualização

- [ ] **A-01** Visão Dia: colunas por profissional, cabeçalho com "N agendamentos · 09:00–12:00, 13:00–18:00".
- [ ] **A-02** Na pausa de almoço de Ana, os slots ficam acinzentados e não clicáveis.
- [ ] **A-03** No dia de folga, a coluna mostra "Folga".
- [ ] **A-04** Botões anterior / Hoje / próximo mudam o dia.
- [ ] **A-05** Visão Semana: 7 colunas, contagem por dia, "Livre" quando vazio; clicar no dia abre a visão Dia.
- [ ] **A-06** Filtro por profissional e por status funcionam nas duas visões.
- [ ] **A-07** Linha do "agora" aparece no dia de hoje.
- [ ] **A-08** Indicadores "Ocupação" e "Equipe" fazem sentido (ocupação desconta a pausa de almoço).
- [ ] **A-09** Agendamento com preparo mostra a faixa hachurada "preparo" logo abaixo.
- [ ] **A-10** Agendamento cancelado não impede clicar no horário para marcar outro. **⚠ R-14**
- [ ] **A-11** O slot que fica dentro do tempo de preparo não é clicável (hoje abre o formulário e só dá erro ao salvar). **⚠ R-30**
- [ ] **A-12** Num dia com bloqueio de meio período, a "Ocupação" desconta o tempo bloqueado. **⚠ R-31**

## 8. Agenda — criar e editar agendamento

- [ ] **AG-01** Clicar num slot livre de Ana às 10:00 → abre o formulário com Ana e 10:00 preenchidos.
- [ ] **AG-02** O campo cliente começa **vazio** (não pré-seleciona o primeiro). **⚠ R-21**
- [ ] **AG-03** Escolher **Consulta** → o select de profissional mostra só quem atende (Ana).
- [ ] **AG-04** Trocar para **Avaliação** com Ana selecionada → aparece "(não atende)" e o aviso em vermelho; salvar dá erro "Ana não atende «Avaliação»".
- [ ] **AG-05** Aparece "Horários livres neste dia" com os horários de Ana; a pausa de almoço não aparece; clicar num horário preenche o início.
- [ ] **AG-06** Dia de folga ou totalmente bloqueado → "Nenhum horário livre neste dia".
- [ ] **AG-07** Adicionar dois serviços em sequência → duração e preço somados; horários livres se ajustam à duração total.
- [ ] **AG-08** Salvar → aparece na grade no horário certo.
- [ ] **AG-09** Marcar outro agendamento para Ana no mesmo horário → erro "Ana já tem outro agendamento neste intervalo".
- [ ] **AG-10** Marcar para Ana colado no fim de uma Consulta (sem os 10 min de preparo) → erro de "tempo de preparo".
- [ ] **AG-11** Marcar às 11:45 uma Consulta de 30 min (passa do almoço) → erro "Fora do expediente de Ana neste dia (09:00–12:00, 13:00–18:00)".
- [ ] **AG-12** Marcar num sábado para Ana → erro "Ana não atende neste dia da semana".
- [ ] **AG-13** Marcar às 23:45 um serviço de 30 min → erro "precisa começar e terminar no mesmo dia" (ou fora do expediente).
- [ ] **AG-14** Marcar num horário que já passou → deveria ser recusado ou exigir confirmação. **⚠ R-20**
- [ ] **AG-15** Editar: mudar só a observação e salvar → salva sem erro.
- [ ] **AG-16** Editar: remarcar para outro horário livre → salva; os horários livres não mostram o próprio horário antigo como ocupado.
- [ ] **AG-17** Editar um agendamento cujo serviço foi desativado depois → consegue salvar a observação. **⚠ R-08**
- [ ] **AG-18** Editar só a observação de um agendamento antigo depois de mudar o preço do serviço → o preço do agendamento **não** muda. **⚠ R-09**
- [ ] **AG-19** Usuário **Recepção** (só "Agendar") consegue escolher o cliente e marcar. **⚠ R-06**

## 9. Agenda — status

- [ ] **ST-01** Confirmar → badge "Confirmado".
- [ ] **ST-02** Em atendimento → Concluir → badge "Concluído"; o formulário fica só leitura com "Agendamento encerrado".
- [ ] **ST-03** Cancelar → pede confirmação antes. **⚠ R-13**
- [ ] **ST-04** "Concluir" um agendamento da semana que vem → deveria ser bloqueado. **⚠ R-13**
- [ ] **ST-05** Marcar "Não compareceu" → o horário fica livre para encaixe. **⚠ R-19**

## 10. Bloqueios

- [ ] **B-01** Agenda → "Bloquear horário" → modal abre com "Empresa toda" e "Dia inteiro" ligados.
- [ ] **B-02** Bloquear Ana num dia inteiro com motivo "Férias" → fecha; na visão Dia a coluna de Ana mostra o bloco hachurado "Férias" e os slots ficam desabilitados.
- [ ] **B-03** Na visão Semana, o dia mostra o cartão "Dia todo · Férias · Ana".
- [ ] **B-04** Tentar marcar para Ana nesse dia → erro "Este horário está bloqueado na agenda: Férias."
- [ ] **B-05** Bloqueio "Empresa toda" num feriado → afeta todas as colunas; nenhum horário livre no dia.
- [ ] **B-06** Desligar "Dia inteiro" e bloquear 14:00–15:00 (reunião) → só essa faixa fica bloqueada.
- [ ] **B-07** Fim antes do início → botão "Bloquear" desabilitado.
- [ ] **B-08** Bloquear um período que já tem agendamentos → aviso amarelo com a quantidade; os agendamentos continuam na grade.
- [ ] **B-09** O aviso só conta agendamentos futuros e ativos. **⚠ R-29**
- [ ] **B-10** Lista "Próximos bloqueios" mostra o criado; "Remover" apaga e a grade atualiza.
- [ ] **B-11** Clicar no bloco hachurado da grade → abre o detalhe com "Remover bloqueio".
- [ ] **B-12** Remover pede confirmação. **⚠ R-29**
- [ ] **B-13** Bloqueio de vários dias ("De" 20/12 "Até" 02/01) → aparece em todos os dias do período.

## 11. Tela Início (painel)

- [ ] **I-01** Indicadores do dia (agendamentos, a confirmar, em atendimento, ocupação) batem com a Agenda.
- [ ] **I-02** "Próximos" lista os próximos horários de hoje em ordem.
- [ ] **I-03** Atalhos levam para a Agenda no dia/agendamento certo.
- [ ] **I-04** Dias com bloqueio aparecem como bloqueados no painel (não como livres). **⚠ R-15**
- [ ] **I-05** Textos usam a terminologia da empresa (nada de "cadeira" fixo). **⚠ R-23**
- [ ] **I-06** Deixar a aba aberta virando a meia-noite → o painel passa para o novo dia. **⚠ R-24**

## 12. Permissões por perfil

| Caso | Usuário | Esperado |
|---|---|---|
| **PM-01** | Admin | Vê todos os itens do menu. |
| **PM-02** | Recepção | Vê Início e Agenda; não vê Serviços, Clientes, Profissionais, Configurações. |
| **PM-03** | Recepção | Digitar `/servicos` na URL → bloqueado. |
| **PM-04** | Recepção | Consegue criar bloqueio e agendamento. **⚠ R-06** |
| **PM-05** | Sem acesso | Não entra no sistema. |

## 13. Fuso horário

- [ ] **F-01** Empresa e computador no mesmo fuso → sem aviso; horários da grade batem com os horários livres.
- [ ] **F-02** Empresa em Manaus e computador em Brasília → aviso amarelo na Agenda. Marcar às 10:00 pelos horários livres → anotar onde aparece na grade (diferença esperada de 1 hora). **⚠ R-26**
- [ ] **F-03** Em produção (Docker), empresa em Manaus → expediente e horários livres respeitam −4h. **⚠ R-25**

## 14. Geral

- [ ] **G-01** Tema claro/escuro: telas novas (bloqueio, faixas de expediente, quem atende) ficam legíveis nos dois.
- [ ] **G-02** Celular (DevTools → modo dispositivo, 390 px): Agenda, modal de bloqueio e editor de expediente usáveis.
- [ ] **G-03** Nenhum texto com caracteres estranhos ("⬦", "�"). **⚠ R-27**
- [ ] **G-04** Sem erros vermelhos no console do navegador (F12) durante os testes.
- [ ] **G-05** Dois usuários marcando o mesmo horário ao mesmo tempo → só um consegue. **⚠ R-17**
