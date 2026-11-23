# Relatório do frontend

Atualizado em 22/11/2026 (America/Sao_Paulo). Trabalho exclusivamente em `main`; nenhum arquivo de backend alterado. As quatro alterações preexistentes em notificações, botões do motorista, operação pública e seu teste foram preservadas e não pertencem aos commits desta rodada.

## Inventário de issues

Consultadas as 38 issues abertas do frontend, seus corpos, comentários e labels, além dos contratos e issues do backend. Não tratar implementação prévia como trabalho novo nem teste automatizado como aceite em aparelho.

| Issue | Estado real | Evidência e pendência |
| --- | --- | --- |
| [#49](https://github.com/pethersonzada/bevans-frontend/issues/49) | Implementado; aceite parcial | Cadastro Dados → Trajeto → Revisão, pontos locais, rascunho por conta, criação única com conferência GET. Android: criação, reinício e seleção sem GPS executados. Faltam aparelho físico, leitor de tela e falha de rede durante POST no dispositivo. |
| [#45](https://github.com/pethersonzada/bevans-frontend/issues/45) | Aceite integrado pendente | Requer motorista/passageiro simultâneos em dois Androids e evidência de waypoints IDA/VOLTA; um emulador conectado. |
| [#44](https://github.com/pethersonzada/bevans-frontend/issues/44) | Implementado; aceite integrado pendente | Mapa público usa snapshot por viagem/modalidade; regressões FIXA/FLEXÍVEL aprovadas. Falta aprovação de embarques + navegação em duas sessões Android. |
| [#43](https://github.com/pethersonzada/bevans-frontend/issues/43) | Implementado; aceite integrado pendente | Conflito separado do fluxo, mensagem de 409 preservada e esquema rotulado. Testes de edição/revisão aprovados; concorrência entre dispositivos pendente. |
| [#42](https://github.com/pethersonzada/bevans-frontend/issues/42) | Implementado; validação parcial | Botão de confirmar ponto e CTA bloqueado já existem. Android exercitou aproximação, confirmação e descrição. Falta fonte grande/leitor de tela em todos os fluxos. |
| [#41](https://github.com/pethersonzada/bevans-frontend/issues/41) | Melhorado; validação parcial | Proximidade dinâmica e aviso sem chave já implementados. Busca real por Shopping Recife e Marco Zero aprovada no Android; lista de resultados agora rolável. Cobertura/limites do provedor em distribuição pendentes. |
| [#40](https://github.com/pethersonzada/bevans-frontend/issues/40) | Implementado; aceite integrado pendente | Cache por usuário/turma/viagem/sentido e assinatura de pontos, com regressões. Segunda execução no dia em dois aparelhos pendente. |
| [#39](https://github.com/pethersonzada/bevans-frontend/issues/39) | Implementado; aceite integrado pendente | Revisão prévia e início com resultado incerto distintos, mensagens da API preservadas. Falta repetir excursão operacional equivalente em API/dispositivo. |
| [#38](https://github.com/pethersonzada/bevans-frontend/issues/38) | Implementado; aceite integrado pendente | Roteiro oficial reconciliado, assinatura de coordenadas, bloqueio de snapshot inválido. Faltam comparação HTTP/waypoints e perda de rede no Android. |
| [#37](https://github.com/pethersonzada/bevans-frontend/issues/37) | Implementado; aceite integrado pendente | Home usa CARREGANDO/INDETERMINADO e ATIVA sem GPS; testes de expiração/erro. Falta observar sincronização motorista/passageiro em dois aparelhos. |
| [#36](https://github.com/pethersonzada/bevans-frontend/issues/36) | Bloqueado por contrato | Responsável depende de comprovação efetiva e contratos de backend #26. Sessão mobile ainda recusa esse papel; não se concede rastreio sem vínculo comprovado. |
| [#35](https://github.com/pethersonzada/bevans-frontend/issues/35) | Implementado; validação parcial | Editor de excursão em etapas e datas nativas existentes; validação de calendário/ordem/rascunho aprovada. Falta completar teclado, fuso e compartilhamento em dispositivo. |
| [#34](https://github.com/pethersonzada/bevans-frontend/issues/34) | Mitigado; dependência backend | Prechecagem e conferência após início/encerramento existem. Operação atômica entre dispositivos exige contrato transacional; não é garantida pelo frontend. |
| [#33](https://github.com/pethersonzada/bevans-frontend/issues/33) | Implementado; validação parcial | Coleta por sentido, paradas e escolha própria existentes. Android abriu coleta da turma recém-criada; faltam mudanças de modo, vínculos e GPS em operação. |
| [#32](https://github.com/pethersonzada/bevans-frontend/issues/32) | Implementado; entrega real pendente | Central e push com isolamento de sessão já implementados; testes aprovados. FCM físico foreground/background e worker remoto pendentes. |
| [#31](https://github.com/pethersonzada/bevans-frontend/issues/31) | Implementado; aceite integrado pendente | Painel operacional autorizado e confirmação/versionamento existentes. Falta ciclo de embarque/desembarque com duas contas/aparelhos. |
| [#30](https://github.com/pethersonzada/bevans-frontend/issues/30) | Implementado; aceite integrado pendente | Módulo público separado de excursões, editor, catálogo e operação existentes. Aceite completo nas issues #26/#27/#29/#43/#44. |
| [#29](https://github.com/pethersonzada/bevans-frontend/issues/29) | Implementado; aceite integrado pendente | Filtros/favoritos paginados com API existentes. Falta persistência após reinício e alternância real de contas no Android. |
| [#28](https://github.com/pethersonzada/bevans-frontend/issues/28) | Implementado; aceite integrado pendente | Rastreamento com identidade de viagem e TTL existente. Falta GPS em movimento com motorista/passageiro. |
| [#27](https://github.com/pethersonzada/bevans-frontend/issues/27) | Implementado; aceite integrado pendente | Pedidos fixos/flexíveis e estados da API existentes. Falta ciclo de solicitação e aprovação entre duas contas no Android. |
| [#26](https://github.com/pethersonzada/bevans-frontend/issues/26) | Implementado; aceite integrado pendente | Editor público FIXA/FLEXÍVEL separado da turma privada, extremos e paradas. Regressões aprovadas; aceite nativo completo pendente. |
| [#25](https://github.com/pethersonzada/bevans-frontend/issues/25) | Implementado; validação parcial | Novo cadastro elimina criação antecipada ao abrir mapa e confere dados por GET. Android criou turma com ambos pontos; geração de viagem IDA/VOLTA com passageiros pendente. |
| [#23](https://github.com/pethersonzada/bevans-frontend/issues/23) | Bloqueado por contrato | Não implementar permissões GESTOR sem contratos e isolamento de organizações do backend #38. |
| [#21](https://github.com/pethersonzada/bevans-frontend/issues/21) | Implementado; validação Android | Preferência Sistema/Claro/Escuro persistida, estilos compartilhados e componentes adaptados sem remontagem. Android: restauração e troca do sistema com campo preservado. Falta revisão ampliada em iOS/fonte grande. |
| [#20](https://github.com/pethersonzada/bevans-frontend/issues/20) | Implementado; aceite integrado pendente | Publicação/vagas/aprovações e contato protegido existentes. Falta lotação concorrente e abertura WhatsApp em aparelho. |
| [#19](https://github.com/pethersonzada/bevans-frontend/issues/19) | Implementado; aceite integrado pendente | Catálogo público e detalhes existentes; privados não são publicados automaticamente. Falta bateria de filtros/vagas no Android. |
| [#18](https://github.com/pethersonzada/bevans-frontend/issues/18) | Bloqueado por contrato | Removida consulta privada de otimização do passageiro. Posição própria agregada exige contrato seguro; backend #41/#46. Sem fabricar fila. |
| [#16](https://github.com/pethersonzada/bevans-frontend/issues/16) | Parcial; bloqueado por contrato | Motorista já gerencia excursões; passageiro passa a abrir convite oficial com validação. Minhas excursões/detalhe nativos dependem de backend #68; descoberta da execução web já documentada no backend #66; implantação não homologada aqui. |
| [#13](https://github.com/pethersonzada/bevans-frontend/issues/13) | Implementado; conferência de aceite | Regressões executam edição de presença durante polling e mudança dos dados, preservando rascunho. Conferir critérios antes de encerrar. |
| [#10](https://github.com/pethersonzada/bevans-frontend/issues/10) | Implementado; validação parcial | Pesquisa por código e busca com debounce/pin existentes; cadastro reutiliza picker. Android buscou POIs sem GPS; restante do ciclo IDA/VOLTA pendente. |
| [#9](https://github.com/pethersonzada/bevans-frontend/issues/9) | Implementado; conferência de aceite | Consulta de passageiros aprovada é restrita à turma e motorista; não usa lista global. Confirmar fluxo real de inclusão e revogação em dispositivo. |
| [#8](https://github.com/pethersonzada/bevans-frontend/issues/8) | Implementado parcialmente | Primitivas de carregamento/vazio/erro e aviso offline existentes; revisão incremental de telas continua. Não afirmar revisão visual integral do aplicativo. |
| [#7](https://github.com/pethersonzada/bevans-frontend/issues/7) | Implementado; conferência de aceite | Suíte Node de serviços e componentes e CI existentes. Resultados locais desta rodada registrados abaixo; E2E nativo permanece distinto. |
| [#6](https://github.com/pethersonzada/bevans-frontend/issues/6) | Implementado; validação parcial | Localização com timeout/cancelamento, TTL e contexto existentes. Android: GPS negado e busca alternativa; movimento/background ainda pendentes. |
| [#5](https://github.com/pethersonzada/bevans-frontend/issues/5) | Melhoria incremental | Novo domínio de cadastro extraído da rota e formulário em componente próprio. Ainda existem chamadas e regras em telas legadas; refatoração integral não concluída. |
| [#4](https://github.com/pethersonzada/bevans-frontend/issues/4) | Implementado; conferência de aceite | Headers, corpo vazio, ApiError, timeout/rede já existentes. Bypass de túnel agora restrito a development e removido em staging/production; regressão adicionada. |
| [#3](https://github.com/pethersonzada/bevans-frontend/issues/3) | Implementado; conferência de aceite | Token central, renovação uma vez em 401, limpeza/redirecionamento e bloqueio de respostas antigas cobertos pela suíte. Conferir encerramento da issue. |
| [#2](https://github.com/pethersonzada/bevans-frontend/issues/2) | Implementado; conferência de aceite | Edição usa sessão e guard MOTORISTA; busca não encontrou fallback arbitrário de userId. Inicialização/autenticada/ausente cobertas em testes. |

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
- Não executados: dois Androids simultâneos, aparelho físico, leitor de tela, GPS em movimento, entrega FCM, compartilhamento com destinatário real e reserva por convite válido do passageiro.
- Credenciais de teste não foram gravadas em arquivos versionados nem reproduzidas neste relatório.

## Dependências do backend

- Criada [backend #68](https://github.com/pethersonzada/bevans-backend/issues/68): vínculo comprovado de inscrição com conta Firebase e listagem própria. Relacionada a frontend #16. `ExcursaoController` continua restrito a motorista.
- [Backend #66](https://github.com/pethersonzada/bevans-backend/issues/66): descoberta de execução da própria inscrição com X-Inscricao no webapp; não resolve vínculo Firebase mobile.
- Responsável e gestor continuam sujeitos a [#26](https://github.com/pethersonzada/bevans-backend/issues/26) e [#38](https://github.com/pethersonzada/bevans-backend/issues/38).
- Criação de turma não dispõe de idempotência de servidor. Se POST ficar incerto sem um resultado único na releitura, cadastro bloqueia novo envio e orienta conferir turmas. Reconciliação por diferenças da lista não oferece garantia transacional contra outro dispositivo criando exatamente os mesmos dados.
- Troca atômica de viagem e posição própria do passageiro precisam de evolução de contrato; nunca liberar otimização integral aos passageiros.

## Commits e próximos passos

- `5c60f02`: Aprimorando a criação de turmas com etapas e rascunho recuperável (#49/#25).
- Segundo lote: convite do passageiro, filtros, sugestões roláveis e cabeçalho de túnel, validado antes do commit. Sem push/deploy.

Continuar validação Android do passageiro e revisar as issues de infraestrutura de autenticação já cobertas. Tema #21 implementado nesta rodada; detalhes em docs/aparencia-mobile.md. Manter issues com aceite de dois dispositivos abertas até evidência real.


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