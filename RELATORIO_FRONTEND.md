# Relatório do frontend

Atualizado em 23/11/2026 (America/Sao_Paulo). Trabalho exclusivamente em `main`; nenhum arquivo de backend alterado. As quatro alterações preexistentes em notificações, botões do motorista, operação pública e seu teste foram preservadas e não pertencem aos commits desta rodada.

## Inventário de issues

Consultadas as 38 issues abertas do frontend, seus corpos, comentários e labels, além dos contratos e issues do backend. Não tratar implementação prévia como trabalho novo nem teste automatizado como aceite em aparelho.

| Issue | Estado real | Evidência e pendência |
| --- | --- | --- |
| [#49](https://github.com/pethersonzada/bevans-frontend/issues/49) | Implementado; aceite parcial | Cadastro Dados → Trajeto → Revisão, pontos locais, rascunho por conta, criação única com conferência GET. Android: criação, reinício e seleção sem GPS executados. Faltam aparelho físico, leitor de tela e falha de rede durante POST no dispositivo. |
| [#45](https://github.com/pethersonzada/bevans-frontend/issues/45) | Aceite integrado parcial | Presença IDA/VOLTA/AMBOS/NAO_VOU/LIMPAR testada na interface da turma 10, incluindo force-stop e cancelamento da limpeza. Ciclo público FIXA e execução 72 validados serialmente. Gate segue aberto para simultaneidade, movimento e demais cenários. |
| [#44](https://github.com/pethersonzada/bevans-frontend/issues/44) | Implementado; aceite integrado pendente | Execução pública 72 iniciada pelo app após revisão de um embarque aprovado. Snapshot com três pontos, parada correta e extremos públicos conferidos; mapa mostrou o waypoint público. Encerramento nativo confirmado INATIVA. Faltam FLEXÍVEL, VOLTA e dois aparelhos simultâneos. |
| [#43](https://github.com/pethersonzada/bevans-frontend/issues/43) | Implementado; aceite integrado pendente | Além da separação rascunho/gestão já existente, removido espaço literal que causava Text strings must be rendered dentro da gestão. Regressão falhou antes e passou após a correção; página reaberta no Android. Concorrência e variantes continuam pendentes. |
| [#42](https://github.com/pethersonzada/bevans-frontend/issues/42) | Implementado; validação parcial | Botão de confirmar ponto e CTA bloqueado já existem. Android exercitou aproximação, confirmação e descrição. Falta fonte grande/leitor de tela em todos os fluxos. |
| [#41](https://github.com/pethersonzada/bevans-frontend/issues/41) | Melhorado; validação parcial | Proximidade dinâmica e aviso sem chave já implementados. Busca real por Shopping Recife e Marco Zero aprovada no Android; lista de resultados agora rolável. Cobertura/limites do provedor em distribuição pendentes. |
| [#40](https://github.com/pethersonzada/bevans-frontend/issues/40) | Implementado; aceite parcial | Segunda IDA no mesmo dia gerou execução 69 e incluiu novamente o passageiro. Não foi marcado como visitado na execução 68; conclusão manual e reaparecimento após ponto visitado permanecem pendentes. VOLTA 71 foi iniciada e encerrada no app. |
| [#39](https://github.com/pethersonzada/bevans-frontend/issues/39) | Implementado; aceite integrado pendente | Revisão prévia e início com resultado incerto distintos, mensagens da API preservadas. Falta repetir excursão operacional equivalente em API/dispositivo. |
| [#38](https://github.com/pethersonzada/bevans-frontend/issues/38) | Implementado; aceite parcial | Snapshots das duas execuções contêm o passageiro; mapa exibe próxima parada e marcador. Sem aceite completo de recálculo, geometrias offline ou pontos visitados. |
| [#37](https://github.com/pethersonzada/bevans-frontend/issues/37) | Implementado; aceite parcial | Passageiro mostrou viagem ativa sem GPS. Reteste confirmou GPS ATUALIZADA e depois DESATUALIZADA pela API autorizada. Falta revisar todas as variantes na interface passageira e em movimento real. |
| [#36](https://github.com/pethersonzada/bevans-frontend/issues/36) | Bloqueado por contrato | Responsável depende de comprovação efetiva e contratos de backend #26. Sessão mobile ainda recusa esse papel; não se concede rastreio sem vínculo comprovado. |
| [#35](https://github.com/pethersonzada/bevans-frontend/issues/35) | Implementado; validação parcial | Editor de excursão em etapas e datas nativas existentes; validação de calendário/ordem/rascunho aprovada. Falta completar teclado, fuso e compartilhamento em dispositivo. |
| [#34](https://github.com/pethersonzada/bevans-frontend/issues/34) | Mitigado; bloqueado por contrato | Encerramento no mapa passou a conferir execução e estado final, sem repetir POST quando INATIVA. Troca transacional depende de backend #69. |
| [#33](https://github.com/pethersonzada/bevans-frontend/issues/33) | Implementado; validação parcial | Coleta por sentido, paradas e escolha própria existentes. Android abriu coleta da turma recém-criada; faltam mudanças de modo, vínculos e GPS em operação. |
| [#32](https://github.com/pethersonzada/bevans-frontend/issues/32) | Implementado; entrega real pendente | Central e push com isolamento de sessão já implementados; testes aprovados. FCM físico foreground/background e worker remoto pendentes. |
| [#31](https://github.com/pethersonzada/bevans-frontend/issues/31) | Implementado; aceite integrado pendente | VOLTA 71: embarque e desembarque simulados pela interface do motorista, confirmados como EMBARCADO/DESEMBARCADO na API própria passageira. Falta confirmação pela interface passageira e concorrência entre aparelhos. |
| [#30](https://github.com/pethersonzada/bevans-frontend/issues/30) | Implementado; aceite integrado pendente | Módulo público separado de excursões, editor, catálogo e operação existentes. Aceite completo nas issues #26/#27/#29/#43/#44. |
| [#29](https://github.com/pethersonzada/bevans-frontend/issues/29) | Implementado; aceite integrado pendente | Filtros aplicados persistem por conta com esquema validado e gravações ordenadas; Android restaurou Recife/Arsenal/Outros/favoritas após force-stop. Favorito salvo no app e confirmado na API própria. Limites de disponibilidade, segunda conta passageira e bateria ampliada mantidos em acompanhamento. |
| [#28](https://github.com/pethersonzada/bevans-frontend/issues/28) | Implementado; aceite integrado pendente | Rastreamento com identidade de viagem e TTL existente. Falta GPS em movimento com motorista/passageiro. |
| [#27](https://github.com/pethersonzada/bevans-frontend/issues/27) | Implementado; aceite integrado pendente | Rota FIXA exclusiva: solicitação de vínculo e embarque IDA na interface passageira; aprovações separadas pela interface motorista; GET próprio confirmou APROVADO na parada correta. Teste serial no principal. FLEXÍVEL, cancelamento e variantes pendentes. |
| [#26](https://github.com/pethersonzada/bevans-frontend/issues/26) | Implementado; aceite integrado pendente | Editor público FIXA/FLEXÍVEL separado da turma privada, extremos e paradas. Regressões aprovadas; aceite nativo completo pendente. |
| [#25](https://github.com/pethersonzada/bevans-frontend/issues/25) | Implementado; validação parcial | Novo cadastro elimina criação antecipada e confere os pontos por GET. Android criou turma e iniciou IDA/VOLTA com o passageiro; deslocamento físico e demais modos pendentes. |
| [#23](https://github.com/pethersonzada/bevans-frontend/issues/23) | Bloqueado por contrato | Não implementar permissões GESTOR sem contratos e isolamento de organizações do backend #38. |
| [#21](https://github.com/pethersonzada/bevans-frontend/issues/21) | Implementado; validação Android | Contraste conferido em painel motorista e excursões passageiras; cartões selecionados e placeholders corrigidos. Rádio compartilhado anuncia checked corretamente; Sistema restaurado. Falta revisão ampliada com TalkBack, fonte grande e iOS. |
| [#20](https://github.com/pethersonzada/bevans-frontend/issues/20) | Implementado; aceite integrado pendente | Recurso público novo preparado por HTTP, com capacidade 4. Vínculo e embarque aprovados na interface; retirada da publicação executada na gestão e conferida false. Lotação concorrente e WhatsApp não executados. |
| [#19](https://github.com/pethersonzada/bevans-frontend/issues/19) | Implementado; aceite integrado pendente | Catálogo nativo testou filtros combinados, favorito persistente e detalhes da rota sintética; ciclo de vínculo/embarque confirmado. Escopo ampliado de filtros e experiência com disponibilidade/concorrência ainda pendente. |
| [#18](https://github.com/pethersonzada/bevans-frontend/issues/18) | Bloqueado por contrato | Removida consulta privada de otimização do passageiro. Posição própria agregada exige contrato seguro; backend #41/#46. Sem fabricar fila. |
| [#16](https://github.com/pethersonzada/bevans-frontend/issues/16) | Parcial; bloqueado por contrato | Aba passageira abre convite oficial com validação; código inválido e retorno testados no Android. Listagem própria Firebase depende de backend #68. |
| [#13](https://github.com/pethersonzada/bevans-frontend/issues/13) | Concluída e fechada | Rascunho VOLTA preservado durante polling no Android com AMBOS salvo; cancelar restaurou o servidor. Rádio recebeu estado acessível; testes de mudança concorrente aprovados. |
| [#10](https://github.com/pethersonzada/bevans-frontend/issues/10) | Implementado; validação parcial | Pesquisa por código e busca com debounce/pin existentes; cadastro reutiliza picker. Android buscou POIs sem GPS; restante do ciclo IDA/VOLTA pendente. |
| [#9](https://github.com/pethersonzada/bevans-frontend/issues/9) | Implementado; conferência de aceite | Consulta de passageiros aprovada é restrita à turma e motorista; não usa lista global. Confirmar fluxo real de inclusão e revogação em dispositivo. |
| [#8](https://github.com/pethersonzada/bevans-frontend/issues/8) | Implementado parcialmente | Textos auxiliares e áreas de toque ajustados; erro/vazio/recuperação do catálogo observados. Corrigido aviso nativo de texto cru na gestão pública, com regressão. Revisão ampliada de estados, fonte grande e leitor de tela permanece pendente. |
| [#7](https://github.com/pethersonzada/bevans-frontend/issues/7) | Implementado; conferência de aceite | Suíte Node de serviços e componentes e CI existentes. Resultados locais desta rodada registrados abaixo; E2E nativo permanece distinto. |
| [#6](https://github.com/pethersonzada/bevans-frontend/issues/6) | Implementado; validação parcial | GPS negado e busca alternativa testados. Reteste Android publicou amostra simulada; API própria retornou ATUALIZADA e depois DESATUALIZADA. Movimento real, revogação e precisão em campo pendentes. |
| [#5](https://github.com/pethersonzada/bevans-frontend/issues/5) | Melhoria incremental | Formulário/domínio do cadastro separados; Home do motorista reutiliza serviços de análise, remoção e status, eliminando HTTP direto e any nesse trecho. Outras telas legadas ainda exigem evolução gradual. |
| [#4](https://github.com/pethersonzada/bevans-frontend/issues/4) | Concluída e fechada | Contrato HTTP revalidado; bypass de túnel somente em development, removido em staging/production, com regressão. |
| [#3](https://github.com/pethersonzada/bevans-frontend/issues/3) | Concluída e fechada | Token central, 401, sessão, logout e respostas antigas cobertos pela suíte; troca de perfis validada no Android. |
| [#2](https://github.com/pethersonzada/bevans-frontend/issues/2) | Concluída e fechada | Identidade e guards revalidados; sem fallback arbitrário. Login/logout/restauração e bloqueio de cadastro do motorista para passageiro testados. |

## Alterações desta rodada

- Cadastro privado em três etapas com progresso, turno guiado/personalizado, validação de assentos, origem/destino com pin e revisão editável.
- Seleção de pontos antes do POST, rascunho persistido por conta, retenção de ID/intenção de criação e reconciliação após timeout sem repetir POST. Sucesso exige GET autorizado e comparação de nome, turno, capacidade, nomes e coordenadas.
- Coleta permanece na tela existente, acessível após criar, independente por sentido.
- Passageiro pode informar convite e abrir somente a página HTTPS configurada, sem guardar token, anunciar reserva ou exibir erro nativo com URL. Listagem própria não foi inventada.
- Lista de sugestões passa a permitir rolagem; bypass de túnel removido de staging/production.

## Testes e evidências

- Linha de base: `npm run check` aprovado com arquitetura, TypeScript e 343 testes.
- Após cadastro/convite: 352 testes aprovados; bundle Android Metro/Hermes exportado. Verificação posterior aprovada com **355 testes**, arquitetura e TypeScript; bundle Android também aprovado com EXPO_NO_DOTENV=1.
- Android: emulador `emulator-5554`, development build instalado, Metro local existente. Sessão do motorista restaurada; cadastro completo com turma exclusiva `VALIDACAO_GUIADA_2211`, capacidade 12, dois locais públicos; GPS negado, busca real de POIs, falha de endereço reverso com descrição manual e pin preservado. Rascunho retomado após force-stop; POST concluído e conferido pelo GET; aberta a coleta da turma criada.
- Capturas sem dados pessoais: [revisão](docs/evidencias/frontend-2026-11-22/01-revisao-turma.png), [criação confirmada](docs/evidencias/frontend-2026-11-22/02-turma-criada.png).
- Não executados: aparelho físico, leitor de tela, GPS em movimento, entrega FCM, compartilhamento com destinatário real e reserva por convite válido do passageiro. Dois emuladores foram usados na fase integrada, com os limites descritos abaixo.
- Credenciais de teste não foram gravadas em arquivos versionados nem reproduzidas neste relatório.

## Dependências do backend

- Criada [backend #68](https://github.com/pethersonzada/bevans-backend/issues/68): vínculo comprovado de inscrição com conta Firebase e listagem própria. Relacionada a frontend #16. `ExcursaoController` continua restrito a motorista.
- [Backend #66](https://github.com/pethersonzada/bevans-backend/issues/66): descoberta de execução da própria inscrição com X-Inscricao no webapp; não resolve vínculo Firebase mobile.
- Responsável e gestor continuam sujeitos a [#26](https://github.com/pethersonzada/bevans-backend/issues/26) e [#38](https://github.com/pethersonzada/bevans-backend/issues/38).
- Criação de turma não dispõe de idempotência de servidor. Se POST ficar incerto sem um resultado único na releitura, cadastro bloqueia novo envio e orienta conferir turmas. Reconciliação por diferenças da lista não oferece garantia transacional contra outro dispositivo criando exatamente os mesmos dados.
- Troca atômica de viagem e posição própria do passageiro precisam de evolução de contrato; nunca liberar otimização integral aos passageiros.

## Commits e próximos passos

- `5c60f02`: Aprimorando a criação de turmas com etapas e rascunho recuperável (#49/#25).
- `b2e8b93`: Integrando convites de excursão ao passageiro e aprimorando a busca de rotas (#16/#19/#29/#41).
- `e68ad75`: Implementando aparência clara e escura com preferência persistente (#21).
- `fcb8c24`: Concluindo a validação das viagens e corrigindo o contraste das telas (#5/#6/#13/#21/#31/#34/#45). Sem push/deploy.

Manter abertas as issues cujo aceite exige aparelho físico, interface passageira, concorrência ou contrato indisponível. Tema #21 documentado em docs/aparencia-mobile.md.


## Validação adicional do passageiro

Login e restauração da conta passageira executados no mesmo emulador após logout do motorista; tentativa de deep link para cadastro privado não exibiu formulário de motorista. A aba Excursões apresentou estado de URL ausente corretamente.

A página `https://bevans-webapp.vercel.app/convite` foi confirmada pelo README da main do webapp e GET HTTP 200 (título Inscrição em excursão | BeVans); build-info informou commit `2f17fcbd1dd8fe0d09b0152a94d5d7a1ed52b127`. Somente `EXPO_PUBLIC_CONVITE_WEB_URL` foi configurada no `.env` local não versionado. Metro de teste iniciado em 8082 preservando o processo 8081 existente; emulador apontado a 10.0.2.2:8082.

Convite propositalmente inválido abriu na guia segura do navegador Android, exibiu “Convite inválido, expirado ou indisponível” e retornou ao app com link limpo e aviso de que a abertura não confirma reserva. Nenhuma inscrição real criada. [Captura do convite inválido](docs/evidencias/frontend-2026-11-22/04-convite-invalido-android.png). A captura 03 registra o estado anterior à configuração.

Catálogo ganhou Limpar filtros, reset de paginação e proteção de resultado tardio ao favoritar. Rotas são remontadas por conta; login recebeu rótulos de acessibilidade e controle de visibilidade de senha bloqueado durante operação.
## Aparência — terceiro lote

Sistema/Claro/Escuro implementados no Perfil com persistência local, fallback e erro recuperável. Componentes visuais assinam a paleta e estilos estáticos são avaliados uma vez por tema, preservando os formulários e o estado de navegação. Cards de marca e mapas conservam suas cores próprias com contraste. Migração e manutenção documentadas em [aparencia-mobile.md](docs/aparencia-mobile.md).

Validação: arquitetura, TypeScript e **360 testes aprovados**. Testes novos cobrem preferência, armazenamento indisponível, sistema, notificações, estilos em cache e contraste mínimo 4,5:1 dos pares principais. Android: Escuro permaneceu selecionado após reiniciar; no modo Sistema, alternância claro/escuro manteve o campo Cidade preenchido. Modo do Android restaurado para claro e preferência do app para Sistema. Evidências 05, 06 e 07.

A conferência atual do backend identificou que #66 já tem contrato de descoberta de execuções da própria inscrição documentado na main. Isso foi informado na issue; não equivale à homologação de implantação. O bloqueio Firebase mobile #68 permanece.

Uma segunda instância Android, sem dados copiados do dispositivo original, foi iniciada sob `.expo/test-avds` para ampliar a validação integrada. O erro inicial de concorrência do AVD original foi contornado com diretório de dados isolado.

## Fechamento da rodada

- Todas as 38 issues inicialmente abertas foram avaliadas e receberam atualização no GitHub. Fechadas **#2, #3, #4 e #13**, pelos critérios revalidados. As demais permanecem abertas quando falta implementação, contrato ou aceite específico; não foram encerradas em massa.
- Criada também [backend #69](https://github.com/pethersonzada/bevans-backend/issues/69), para troca atômica condicionada à execução esperada (#34). Mantida [backend #68](https://github.com/pethersonzada/bevans-backend/issues/68), para vínculo Firebase e excursões próprias.
- Teste integrado usou dois emuladores, turma nova 10 e execuções IDA 68/69/70 e VOLTA 71. 68/69 foram encerradas por HTTP; 70/71 pelo mapa Android, com INATIVA confirmada em ambas as contas. Vínculo/presença foram preparados por HTTP. Reteste no principal publicou GPS; VOLTA teve embarque e desembarque simulados pela interface do motorista e conferência da API própria passageira. Nenhuma execução ficou ativa. Detalhes em [validacao-turma-guiada.md](docs/validacao-turma-guiada.md).
- Home do motorista agora delega aprovação, remoção e estado aos serviços existentes; remoção valida os IDs, aceita 204 e preserva 403. O mapa preserva a mensagem de erro do GPS, verifica a execução antes de encerrar e confirma INATIVA por GET, recuperando timeout após gravação sem repetir o POST.
- Verificação final: **363 testes, arquitetura e TypeScript aprovados**, bundle Android Metro/Hermes aprovado com `EXPO_NO_DOTENV=1`. Não há script de ESLint neste projeto. Não foi gerado novo APK; usado o build de desenvolvimento já instalado e o JavaScript atual pelo Metro.
- Recursos sintéticos novos permanecem para inspeção. Somente os dados desses recursos foram escritos na API remota configurada; não se comprovou segregação de banco de homologação. Códigos/infraestrutura/configurações de backend não foram alterados.
- O segundo emulador isolado foi encerrado; o fuso GMT original do principal foi restaurado. O Metro original 8081 foi preservado; o Metro de teste 8082 foi usado para carregar a configuração pública de convites. `.env` local alterou apenas essa URL pública, sem versionar credenciais.
- Pendente: excursões próprias (#68), troca atômica (#69), deslocamento real e conclusão manual das paradas/visitadas, confirmação na interface passageira, push físico, responsável/gestor e bateria visual ampliada/fonte grande/iOS. As falhas iniciais de GPS/encerramento não se repetiram no reteste do principal; a causa original não foi isolada. São limites reais; não declarar o pedido integralmente concluído.

Commits registrados: `5c60f02` (cadastro guiado), `b2e8b93` (convites e busca), `e68ad75` (aparência). O quarto lote reúne conferência de encerramento, presença, contraste auxiliar e validação integrada. Todos na main, sem push ou deploy. Os quatro arquivos com mudanças preexistentes conservam seu diff original fora dos commits desta rodada.
No reteste final, textos auxiliares sem cor explícita foram vinculados à paleta em controle, rastreamento, coleta, avisos, datas, login e notificações. Conferência visual do painel escuro concluída em 23/11 com o bundle atual; também corrigida a cor do placeholder do motivo. Preferência restaurada para Sistema em 23/11; o rádio expôs checked=true no Android.

## Continuação em 23/11/2026

Confirmadas main e as três revisões anteriores. Reconsultadas as 34 issues abertas, seus critérios, comentários e labels; as quatro concluídas anteriormente continuam fechadas. Quarto lote encontrado sem commit. A consulta de ambas as contas confirmou a turma 10 INATIVA antes de qualquer novo teste. Falhas intermitentes de GPS/encerramento permanecem em acompanhamento; reteste aprovado não é diagnóstico definitivo.

Na continuação, o turno dos cartões selecionados dos dois perfis passou a usar a cor de contraste da paleta. A aba Excursões passageira foi conferida em escuro. Check completo: 363 testes aprovados; bundle Android aprovado. Uma quinta alteração externa surgiu em CadastroTurma.tsx (imports/exemplo do campo), foi identificada e mantida fora do lote. O JSON de permissões foi reduzido aos 19 eventos da auditoria desta rodada.

## Presença passageira — 23/11/2026

Turma 10: IDA salva na interface e restaurada após force-stop/reabrir a mesma turma; VOLTA, AMBOS com dois endereços distintos e NAO_VOU confirmados por GET próprio. Detectada ausência da ação LIMPAR e resumo indevido de endereços antigos. Adicionada limpeza com revisão explícita e resumo apenas dos sentidos confirmados. Cancelar preservou NAO_VOU; confirmar retornou status vazio. Escrita extraída para serviço com conferência de resultado, validação de IDs e reconciliação de timeout sem repetir POST. Áreas de toque de presença ajustadas para 48dp.

Check completo: arquitetura, TypeScript e 368 testes aprovados; bundle Android aprovado. Três falhas iniciais dos novos testes eram ausência de URLSearchParams no ambiente simulado e foram corrigidas no harness. Evidências próprias sem dados pessoais em docs/evidencias/frontend-2026-11-23/presenca-propria.json. A turma continuava INATIVA antes desse teste, que não iniciou viagem. Intermitência de GPS/encerramento e restante do aceite #45 permanecem abertos.

## Catálogo e rota pública — continuação validada

- `83aba88` registra a presença passageira e sua limpeza; `fcb8c24` registra o quarto lote. Lote de catálogo: pesquisa persistente por conta, rótulos de ações com nome da rota, rádio acessível e correção de texto cru na gestão pública.
- Filtros: esquema v1, validação de categoria/campos, fallback para dados inválidos, fila por conta e restauração que aguarda escrita pendente. Falha local não bloqueia pesquisa remota; respostas da conta anterior são descartadas.
- Android: cidade Recife, destino Arsenal, categoria Outros e somente favoritas reapareceram após force-stop. Favorito da rota 4 foi criado pela interface e confirmado no GET próprio; permaneceu favoritado após reinício.
- Turma exclusiva 11/rota 4: preparo HTTP com três locais públicos retornados pelo provedor, uma parada e capacidade 4. Solicitações de vínculo e embarque IDA pela interface passageira; aprovações separadas pela interface motorista. Pedido 5 APROVADO e vínculo confirmado por GET próprio. Testes seriais no principal, sem afirmar simultaneidade.
- Execução 72 PUBLICA/IDA: revisão confirmou um embarque e um ponto intermediário; início nativo, snapshot de três pontos com extremos públicos e parada aprovada, waypoint observado no mapa e GPS recebido pela API própria. Encerramento pelo mapa confirmou FINALIZADA/INATIVA. Turma 10 também conferida INATIVA. Retirada da publicação da rota 4 pela interface confirmada publicada=false. Favorito de teste restaurado para false por HTTP.
- Corrigido aviso Text strings must be rendered within a Text: espaço literal entre componentes na gestão pública. O teste de renderização falhou antes e passou após remover o espaço. Reabertura da gestão sem o aviso. Nenhum código de backend alterado.
- Check final: arquitetura, TypeScript e 375 testes aprovados; bundle Android Metro/Hermes aprovado. Não houve novo APK ou validação física, TalkBack ou iOS.
- Limites do ambiente: APKs dos dois emuladores tinham o mesmo SHA-256. Metro 8083 dedicado preservou o 8081 existente. O host alterado pelo diálogo simples do React Native é transitório; a configuração nativa persistente foi usada para o teste de force-stop. Dois emuladores apresentaram instabilidade de recarga/rede; após encerrar o isolado, a leitura no principal se recuperou. Causa não isolada; não atribuir resolução definitiva de GPS/encerramento.

Fechamento do teste público: a interface passageira exibiu APROVADO para o pedido de 23/11/2026, IDA, Encontro público de teste 2311. Filtros foram limpos pela interface (cidade/destino vazios, todas as categorias, favoritas=false); Sistema permaneceu restaurado. Nenhuma viagem sintética ativa; rota 4 despublicada e favorito de teste removido. As cinco alterações externas seguem fora dos commits. Nenhum push autorizado ou executado.

Commit do lote de catálogo: Preservando filtros e validando a jornada das rotas públicas. As 34 issues restantes foram mantidas abertas: avanços de aceite não substituem os critérios ainda pendentes. Dependências de backend #68/#69 reconsultadas e continuam abertas; nenhuma duplicata criada.

Ambiente restaurado: host nativo de debug voltou ao valor original vazio; app reiniciado e Home utilizável no Metro original 8081. Emulador isolado e Metro dedicado 8083 encerrados; redirecionamento adicional 8083 removido. Preferência Sistema e filtros padrão conferidos no Android.
