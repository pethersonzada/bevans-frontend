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

Commits desta continuação: fcb8c24 (quarto lote e contraste), 83aba88 (presença e limpeza), 0c9feeb (filtros e jornada pública). Os 375 testes e o bundle foram executados sobre a árvore de trabalho com as alterações externas preservadas; não equivalem a uma homologação isolada do commit limpo. As 34 issues abertas foram reavaliadas, com atualizações específicas nas afetadas e sem novos fechamentos parciais.

## Quinto lote — conferência e regressão nativa de cache

Reconsultadas as 34 issues abertas e seus comentários. Fetch confirmou sete commits
locais exclusivos e um commit remoto exclusivo, d910667 (somente README). Nenhum
merge, branch ou push nesta etapa. As cinco alterações externas continuam fora
dos commits. Backend #68/#69 reconsultadas: abertas; main consultada 018576b.

Verificação isolada de `git archive` do commit 1b7c362: arquitetura, TypeScript,
374 testes e bundle Android aprovados, sem .env e sem as alterações externas.
Node_modules instalado compartilhado por junction; não é um npm ci novo.
A árvore com as cinco alterações externas passou em 375 testes. Novo comando
`node scripts/validar-commit.cjs HEAD` permite repetir a extração e as verificações.

Turma 10: primeira IDA 73 teve embarque próprio no passageiro independente,
conclusão manual da parada no motorista, visita MOTORISTA persistida e geometria
somente com destino pendente. Após force-stop, uma falha de consulta exigiu
retentativa; a mesma execução retomou o progresso válido. Passageiro restaurou
EMBARCADO e confirmou DESEMBARCADO pela interface com revisão; GET próprio conferiu.
GPS atualizado foi observado na tela passageira durante a sessão simultânea.
Encerramento 73 pelo mapa exigiu retentativa; API confirmou INATIVA nas duas contas,
mas a releitura nativa chegou a informar resultado incerto.

Segunda IDA do mesmo dia, execução 74: um esperado, três pontos, endereço IDA
conferido por comparação própria e estado AGUARDANDO. Passageiro e waypoint
reapareceram no mapa; cache de 73 manteve a visita e geometria de 74 voltou a conter
ponto individual e destino. 74 encerrada e conferida INATIVA. Evidências objetivas
em `docs/evidencias/frontend-2026-11-23/quinto-cache.json`; capturas identificadas
das contas e SQLite do aparelho permanecem somente locais.

Dois emuladores independentes foram usados simultaneamente, com APK existente e
JavaScript do Metro dedicado 8083. Não houve deslocamento real ou aparelho físico.
Timeouts voltaram a ocorrer; host com aproximadamente 387 MB livres. Redução do
isolado de 2048 MB/quatro núcleos para 1024 MB/dois núcleos não isolou nem eliminou
a causa. As issues #40/#45 permanecem abertas para os critérios ainda pendentes.
O formulário público perdeu a edição durante falha de polling, e GPS recebeu
rejeição de intervalo mínimo; correções e retestes pertencem às próximas etapas
deste lote, ainda não a este registro de evidências.

### Recuperação do pedido público

Na rota exclusiva 5/FLEXÍVEL, um timeout periódico removia o formulário e
desmontava o picker. Detalhes agora preservam a última versão lida e a edição
desta conta/rota, com indicação de dados antigos. Solicitar vínculo/embarque fica
bloqueado até revalidar; mesmo um callback capturado antes da falha não escreve.
Retentativa preserva a escolha e uma versão despublicada mantém o bloqueio.
Regressão falhou contra o código anterior e passou após a correção.

Na interface passageira independente: vínculo solicitado, local público pesquisado,
pin explicitamente confirmado e pedido 6/VOLTA enviado. Interface e GET próprio
mostraram PENDENTE em 23/11. Aprovação, rejeição e snapshot deste trecho seguem em
validação. Chamadas com os serviços reais verificaram 404 na rota despublicada,
400 na parada desativada e 409 no horário passado; publicação, mesmo ID de parada
e horário restaurados. Isso não substitui aceite visual dos três erros ou lotação
com outra conta passageira. Nenhum endpoint de motorista foi consultado como
passageiro. Check da árvore durante esta etapa: arquitetura, TypeScript e 378
testes aprovados; alterações externas incluídas. Bundle final ainda pendente.

### GPS e operação própria em dois emuladores

Na VOLTA 75, comparação autorizada confirmou o endereço VOLTA distinto e três
pontos com um esperado; geometria separada de IDA/73. Após recarregar o bundle,
GPS simulado no local público foi publicado. Não houve nova rejeição por intervalo
no trecho observado, sem atribuir resolução definitiva aos timeouts de rede.

Reproduzida rejeição de GPS por intervalo mínimo: o emissor contava cinco segundos
desde o começo da requisição, permitindo envio imediatamente após uma resposta
demorada. Agora aguarda cinco segundos após o término, tanto em sucesso como em
falha, sem fila de amostras antigas. Dois testes falharam antes e passaram depois.

Controle passageiro passou a mostrar a referência da execução (#75), inclusive
quando a resposta própria não informa sentido. Timeout de GET agora informa
consulta demorada; somente falha de escrita alerta para confirmação possivelmente
registrada. Mesma distinção nas consultas do painel do mapa.

75: sem Wi-Fi/dados, Embarquei mostrou erro e API manteve AGUARDANDO/versão 0.
Conectividade original restaurada; embarque pela interface levou a EMBARCADO/1,
uma pessoa na van. Repetição HTTP do próprio embarque retornou 200 sem incrementar
versão/contagem; desembarque com versão antiga retornou 409 e preservou EMBARCADO.
Desembarque pela interface, após revisão, confirmou DESEMBARCADO/2, zero na van e
um desembarcado. Encerramento nativo e INATIVA conferidos nas duas contas.
Evidências sem dados pessoais em `quinto-operacao.json`. Duplicidade/conflito de
contrato via HTTP não são apresentados como conflito reproduzido visualmente.

Check completo da árvore: arquitetura, TypeScript e 379 testes aprovados. Inclui
as cinco modificações externas. Bundle e nova extração limpa seguem para o final
do lote. #31/#40/#45 continuam abertas pelos demais critérios, inclusive campo,
sessão expirada e matriz de turmas/contas. Nenhum backend alterado ou push.

### FLEXÍVEL/VOLTA e bloqueio após encerramento

Turma 12/rota pública 5, somente a conta passageira autorizada. Vínculo aprovado
na interface motorista; pedido 6 rejeitado e «Pedido recusado» observado no segundo
emulador. Passageiro criou o pedido 9/VOLTA com pin público explicitamente
confirmado; motorista aprovou pela interface. Revisão e início nativos geraram
viagem 76/PUBLICA/VOLTA. Snapshot: quatro pontos, um esperado, extremos públicos
invertidos e ponto excepcional próprio presente. Pedidos 7 (24/11/VOLTA) e 8
(23/11/IDA), preparados/aprovados via serviços HTTP para controle, ficaram fora.
Geometria nativa de 76 contém PARADA:6, EXCEPCIONAL e DESTINO. O mapa mostrou
ROTA VOLTA e parada pública; passageiro mostrou viagem em andamento e localização
indisponível/desatualizada, sem confundir isso com encerramento.

76 encerrada pelo mapa e conferida FINALIZADA/INATIVA; rota 5 despublicada ao fim.
Timeouts nativos continuaram; GPS recente neste trecho público não foi confirmado.
Lotação com outra conta e aparelho físico seguem pendentes. Registros sanitizados
em `docs/evidencias/frontend-2026-11-23/quinto-publico.json`; capturas com identificação
permanecem locais. #44 atualizada e mantida aberta pelos critérios restantes.

Achado nativo em 76 já encerrada: o controle próprio mostrava «Viagem encerrada»
mas mantinha Embarquei habilitado. O encerramento oficial recebido na consulta de
GPS agora bloqueia as ações do painel e fecha confirmação aberta; callbacks
anteriores também verificam o bloqueio atual. Nenhuma consulta extra ou aprovação
por GPS foi adicionada. Três regressões cobrem encerramento, leitura cancelada,
GPS ausente e callbacks antigos. Nove testes operacionais direcionados aprovados;
check da árvore aprovado em 382 testes (inclui alterações externas), antes do
ajuste posterior de rótulos acessíveis da excursão. Reteste nativo e bundle final
registrados na etapa seguinte.

### Excursão, compartilhamento e acessibilidade nativa

Excursão exclusiva 8, `VALIDACAO_EXCURSAO_2311`, preparada via serviços HTTP como
rascunho PARADA_UNICA, com locais públicos e nenhum inscrito. Calendário e relógio
nativos abriram; a tela informou GMT, fuso original do aparelho, exibindo 12:00
para o instante enviado como 09:00-03:00. Na interface, capacidade alterada de
quatro para cinco, revisão e salvamento confirmados por GET/versão 2; ponto e
ordem mantidos. Publicação com confirmação nativa levou a PUBLICADA/versão 3.
Não é uma prova de criação completa pelo wizard ou dos três modos em dispositivo.

Convite 7 gerado pelo app, compartilhamento Android aberto duas vezes e fechado
sem escolher destinatário; GET de metadados continuou com um único convite.
Android retornou a ação shared; feedback limita-se à disponibilização ao sistema,
sem afirmar entrega. Convite 7 posteriormente revogado pela interface.
Convites temporários 8/9 foram emitidos pelos serviços HTTP para abrir a página
oficial no Chrome, sem inscrição. Convite 9 válido mostrou título/destino público,
partida e cinco vagas; DELETE 204 e reabertura do MESMO segredo, mantido somente
em memória, mostraram «Convite inválido, expirado ou indisponível».
O primeiro reload sem fragmento foi descartado como evidência de revogação.
Os três convites foram conferidos revogados; excursão sem inscrições/execuções
cancelada por serviço autorizado ao fim (CANCELADA/versão 4).

Página web válida exibiu falta de `NEXT_PUBLIC_BEVANS_MAPBOX_TOKEN`, impedindo
conferência visual do encontro naquele deploy; achado registrado em webapp #14,
sem modificar seu código ou configuração. Backend #68 continua impedindo a lista
própria Firebase; não houve associação inventada por e-mail.

Tela equivalente a 320 dp com fonte 150%: campo de capacidade permaneceu visível
com teclado aberto e ação Continuar acessível. TalkBack instalado foi conectado;
depois de dispensar a solicitação do sistema, foco por teclado percorreu Porta a
porta → Um ponto de encontro → Vários pontos de encontro → Continuar. Inspeção
nativa confirmou checkable=true e checked=true somente na opção atual. Corrigidos
rótulos que antes incluíam glifos e uso de selected em lugar de checked.
Não houve validação auditiva ou aceite por usuário de leitor de tela. Capturas
públicas de tema claro/escuro, teclado e convite em `docs/evidencias/frontend-2026-11-23`.
Fonte, tamanho, tema, TalkBack e sua permissão temporária de notificação foram
restaurados aos valores originais. Check após o ajuste: arquitetura, TypeScript e
382 testes aprovados na árvore com modificações externas.

Reteste de 39331e6 na mesma instalação principal: logout motorista → login
passageiro → controle 76. Somente Meu embarque/AGUARDANDO foi exibido; Embarquei e
Desembarquei ficaram desabilitados junto de Viagem encerrada. Force-stop e nova
abertura do controle próprio preservaram sessão e bloqueio. Isso amplia o teste
de troca de papel, sem completar cache legado, mudança de endereço ou duas contas
passageiras distintas. Captura sem identificação em `quinto-76-encerrada.png`.

### Fechamento verificável do quinto lote

- `7683487` — Registrando a validação do cache por execução.
- `c697a64` — Preservando pedidos de embarque durante falhas de consulta.
- `9979996` — Respeitando o intervalo do GPS e conferindo a operação do passageiro.
- `39331e6` — Bloqueando confirmações após o encerramento e validando a volta pública.
- `e5790b1` — Validando convites e tornando a escolha de embarque acessível.

`node scripts/validar-commit.cjs HEAD` foi executado de ponta a ponta sobre
`e5790b175ddb92b4065c05dc2c926eb87eefef73`: git archive limpo, sem .env e sem as
alterações externas; arquitetura, TypeScript, **381 testes e bundle Android
Metro/Hermes aprovados**. Dependências compartilhadas por junction, sem npm ci
novo. Logs locais na extração `.expo/validacao-commits/e5790b175ddb92b4065c05dc2c926eb87eefef73-1795444143167`.
Verificação anterior do baseline 1b7c362 passou em 374 testes e bundle.

Árvore com as cinco alterações externas: **382 testes, arquitetura, TypeScript
e bundle Android aprovados**. Logs `.expo/quinto-check-382-final.log` e
`.expo/quinto-bundle-arvore.log`. São resultados distintos; o teste adicional
externo não foi incluído nos commits. Resumo e hashes dos logs em
`docs/evidencias/frontend-2026-11-23/quinto-validacao-final.json`. O commit de
fechamento altera somente documentação/evidências; o código é o de e5790b1.

As 34 issues foram reconsultadas ao fechar; nenhuma encerrada neste lote.
Atualizadas #6, #16, #31, #35, #40, #44, #45 e a evidência de testes em #7.
O cenário obrigatório 73 visitada → 74 nova IDA passou, mas #40 ainda requer cache
legado, alteração de endereço e matriz restante. #44 ainda requer lotação com outra
conta e demais erros visualmente; #45 ainda requer matriz completa simultânea,
background/401/403/TTL GPS, duas turmas e campo. #31 mantém pendências operacionais;
#16/#35 não equivalem ao aceite dos três modos, iOS ou inscrição completa.
Backend #68 e #69 reconsultadas e abertas; nenhum código/configuração backend
alterado. Falta de configuração de mapa web registrada em webapp #14.

Todos os recursos sintéticos conferidos sem viagem ativa; rota 5 despublicada,
excursão 8 cancelada, convites 7/8/9 revogados. Conta motorista restaurada no
principal. Host de debug voltou a vazio; Home utilizável no Metro original 8081,
PID 21692 preservado. Metro dedicado 8083 e emulador isolado encerrados;
redirecionamento 8083 removido. Fonte 1.0, tamanho 1080x2340, tema Sistema/Android
claro e acessibilidade originais conferidos. Permissão temporária de notificações
do TalkBack voltou a negada; sem avaliação auditiva ou aparelho físico.

Fetch final confirmou 12 commits locais exclusivos e um remoto exclusivo antes
deste registro final; o remoto d910667 continua somente README. Com este commit
documental, são 13 locais/um remoto. Não houve merge, branch, push ou novo APK.
Permanecem exatamente as cinco modificações externas, preservadas e fora dos
commits: notificações, botões do motorista, operação pública, cadastro de turma
e teste público correspondente.
