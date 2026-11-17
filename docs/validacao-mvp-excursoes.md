# Validação do MVP de excursões

Validação realizada em 17/11/2026. O cadastro, a persistência, o planejamento e a
operação receberam correções e evidências reais. **A jornada completa de convite
e inscrição pelo navegador continua bloqueada. O MVP ainda não está pronto para
entrega integral a um motorista.**

## Escopo, ambiente e autorização

- Frontend: `main`, partindo de `bb77c5a`, sem alterações locais anteriores.
  Preservados `c7dd223`, `f34549f` e o relatório
  [da correção do mapa](correcao-mapa-excursao-2026-11-17.md).
- Backend consultado: `2396d3c`; webapp consultado: `d589683`. Apenas leitura.
  Nenhum backend, webapp, deploy, PR ou push foi alterado/executado.
- Utilizada a API HTTPS configurada no app. O usuário autorizou expressamente
  usar esse ambiente e as contas fornecidas, informando que ainda não há usuários
  utilizando o produto. **Não foi comprovado isolamento de banco de homologação.**
- Escritas limitadas a cinco excursões novas identificadas como `TESTE MVP
  EXCURSOES`: três para os modos de coleta, uma cadastrada no Android e uma para
  capacidade/validade. A excursão antiga concluída não foi alterada.
- Os três testes de ida e volta terminaram com excursões concluídas; a excursão
  de limites foi cancelada. A criada no Android ficou publicada, sem inscritos e
  sem convites. Registros sintéticos foram mantidos para inspeção, sem exclusão.
- Locais públicos recuperados pela busca existente: Marco Zero, Praça do Arsenal
  e Parque Treze de Maio. Participantes fictícios, contatos `example.invalid`.
  Não foram usados endereços residenciais de passageiros.
- Motorola edge 60 neo, Android 16/API 36, instalação nativa `com.bevans.app`
  existente, com JavaScript atualizado pelo Metro. Não é Expo Go. Não foi gerado
  nem instalado um novo APK de distribuição nesta validação.

## Issues e contratos consultados

Foram lidos descrição e comentários das issues do frontend
[#16](https://github.com/pethersonzada/bevans-frontend/issues/16),
[#35](https://github.com/pethersonzada/bevans-frontend/issues/35) e
[#39](https://github.com/pethersonzada/bevans-frontend/issues/39), do backend
[#29](https://github.com/pethersonzada/bevans-backend/issues/29),
[#30](https://github.com/pethersonzada/bevans-backend/issues/30),
[#31](https://github.com/pethersonzada/bevans-backend/issues/31) e
[#32](https://github.com/pethersonzada/bevans-backend/issues/32), e do webapp
[#14](https://github.com/pethersonzada/bevans-webapp/issues/14).
Nenhuma issue foi fechada ou recebeu comentário externo nesta entrega.

Os contratos foram conferidos nos controllers, DTOs e serviços de excursão,
coleta, roteiro, execução, convite, inscrição e operação do backend. Foi
consultada também a página `app/excursoes/page.js` do webapp, que permanece uma
apresentação institucional com aviso de ausência de inscrições reais.

| Operação | Contrato verificado | Evidência integrada |
| --- | --- | --- |
| Criar/editar/consultar | `POST /excursoes`, `PUT/GET /excursoes/{id}` | Escrita seguida de GET, comparando versão e campos |
| Coleta | `PUT /excursoes/{id}/coleta` com modo, versão e paradas confirmadas | Três modos; IDs, ordem, nome, horário e instruções |
| Publicar/cancelar | `PUT /excursoes/{id}/publicacao` e `/cancelamento` | Estado devolvido e nova leitura |
| Planejar | `POST /excursoes/{id}/planejamento?sentido=…&otimizar=false` | IDA e VOLTA nos três modos |
| Iniciar/consultar | `POST/GET /excursoes/{id}/execucoes` | Início, snapshot oficial e repetição concorrente |
| Finalizar | `PUT /excursoes/{id}/execucoes/{execucao}/finalizacao` | Seis execuções finalizadas; conflito com pessoa embarcada |
| Operação | `/operacoes/EXCURSAO/{execucao}` e transições operacionais existentes | Aguardando → embarcado → desembarcado, com nova consulta |
| Convites | `POST/GET /excursoes/{id}/convites`, `DELETE …/{convite}` | Emissão 201, revogação 204, expiração e acesso recusado |
| Inscrição pública | `POST /publico/excursoes/credenciais` e `/inscricoes`, headers `X-Convite`/`X-Inscricao` | Solicitação, confirmação, pin inválido e capacidade |
| Participantes | `GET /excursoes/{id}/inscricoes`, `PUT …/{inscricao}/confirmacao` | Listagem atualizada com participante confirmado |

O início tardio é permitido pelo backend enquanto a excursão estiver publicada.
O app não acrescentou prazo de início. Edição e inscrições, por outro lado,
encerram na partida ou após existir uma execução, conforme contratos distintos.
A VOLTA exige IDA finalizada, retorno e origem operacional. Esses dados precisam
ser configurados antes da IDA, pois o backend não permite editar depois dela.

## Causas encontradas e correções

1. **Confirmação insuficiente de persistência.** O app aceitava o retorno da
   escrita e comparava apenas parte das paradas. Agora normaliza textos e horários,
   compara ordem, IDs, coordenadas, nome, horário e instruções, e só conclui o
   salvamento após GET da mesma versão/configuração. Se a leitura falhar após uma
   escrita aceita, “Conferir salvamento” repete a conferência sem repetir o PUT.
   Alterações concorrentes não são anunciadas como salvas.
2. **Diferenças de representação.** `HH:mm` enviado e `HH:mm:ss` recebido podiam
   manter uma edição já salva como pendente. A comparação usa a mesma forma
   canônica. Datas impossíveis são rejeitadas antes de conversões que as ajustariam
   silenciosamente. Seletores nativos existentes foram preservados; os instantes
   são enviados em ISO e exibidos no fuso do aparelho, sem digitação manual de ISO.
3. **Resposta de convite incompatível.** O app esperava `{id, token}`; o contrato
   real é `{convite: {id, …}, token}`. Uma emissão válida acabava tratada como falha.
   O parser foi corrigido e comprovado com HTTP 201. A lista continua sem segredo;
   o token emitido permanece apenas em memória. Convites em memória deixam de ser
   compartilháveis quando existe execução, mesmo se a excursão ainda é publicada.
4. **Início sem conferência oficial.** O app não verificava identidade, sentido,
   estado e pontos da resposta, nem abria o controle com uma consulta posterior.
   Agora valida o DTO, aguarda GET das execuções e navega com execução e excursão
   correspondentes. Toques repetidos são bloqueados; resultado de início incerto
   exige consulta antes de outra tentativa. Erros estruturados não são substituídos
   por uma única explicação para todos os 409.
5. **Controle sem roteiro da execução.** O controle operacional mostrava presença,
   mas não o snapshot criado no início. Agora apresenta sentido, extremos, pontos
   ordenados e quantidade de autorizados por ponto. Usa GET das execuções da própria
   excursão, sem inventar endpoint. Alterações ficam bloqueadas enquanto esse estado
   não está confirmado ou quando o trecho já terminou. Não há embarque automático
   por GPS. Finalização continua disponível na tela de operação da excursão.
6. **Editor com versão anterior após publicar.** Na validação Android, publicar
   atualizou a visão geral, mas o editor oculto retinha a versão anterior. A revisão
   do editor agora avança após cada salvamento/publicação aceito. Teste específico
   comprova que a próxima edição recebe a versão nova. Rascunhos ainda não salvos
   continuam protegidos de atualizações em segundo plano.
7. **Rolagem e teclado.** A troca de seção reaproveitava a posição de rolagem e
   podia abrir uma etapa no final. O contêiner muda por etapa, mantendo o rascunho.
   O formulário acompanha a abertura do teclado e mede a área visível para trazer
   o campo focado acima do rodapé. O resultado foi inspecionado no aparelho.

Modos de coleta incompatíveis são validados. Trocar para porta a porta mantém as
paradas no rascunho até salvar e avisa que sairão do cadastro. O salvamento de
mudanças nos embarques pede confirmação. Nenhum ponto de passageiro é inventado.

## Mapa e organização das telas

A causa raiz anterior permanece documentada: condição `pontos.length` no pai,
limpeza de pontos antes da consulta e retorno `null` no mapa vazio impediam até
montar o Mapbox. Essa correção foi preservada. Os estados de carregamento, ausência
de pontos, erro de planejamento e falha de renderização continuam separados.

O mapa segue independente da geração do roteiro, com locais confirmados e sem
linhas retas apresentadas como ruas. Agora permite selecionar marcador, aproximar
a câmera, identificar o ponto e abrir sua edição. Paradas intermediárias são
menores e numeradas; “Ver todos os pontos” restaura o enquadramento. Pontos na
mesma coordenada ainda podem se sobrepor; não foram deslocados artificialmente.

A visão geral organiza os acessos em informações, embarques, revisão,
participantes/convites e operação, usando tokens, botões, Safe Area e componentes
existentes. Publicação, edição, convites e início refletem impedimentos conhecidos.
Há distinção entre locais cadastrados, prévia consultada e roteiro da execução.

Foi investigada a infraestrutura existente em `src/app/mapa.tsx` e
`src/services/roteiroNavegacao.ts`. Há integração Mapbox Directions com validação de
geometria e limite de 25 coordenadas. O cadastro de excursão aceita até 50 paradas,
além dos extremos, portanto não se pode simplesmente reutilizar a chamada e
descartar pontos. A [documentação Directions](https://docs.mapbox.com/api/navigation/directions/)
e a [cobrança Mapbox](https://www.mapbox.com/pricing) foram consultadas. O plano e a
quota da conta não foram comprovados. Não foram adicionadas chamadas de Directions,
outro provedor, estimativa de custo gratuita ou geometria fictícia. Geometria
viária de excursões fica pendente de solução para o limite e orçamento da conta.

## Investigação do HTTP 409 / issue #39

Os cinco códigos citados existem no código atual do backend. O erro original da
excursão antiga **não foi reproduzido**. Não foi forçado conflito nela.

| Condição | Comprovação nesta entrega |
| --- | --- |
| `ESTADO_INVALIDO` | HTTP 409 real ao iniciar rascunho e excursão sintética cancelada |
| `IDA_NAO_FINALIZADA` | HTTP 409 real ao pedir VOLTA antes da IDA |
| `EXECUCAO_EXISTENTE` | HTTP 409 real ao reiniciar sentido já finalizado |
| Mesmo sentido em andamento | Duas requisições concorrentes retornaram o mesmo ID, conforme idempotência do backend |
| `EXECUCAO_ATIVA` | Contrato e testes locais; não forçado na API nesta entrega |
| `ROTEIRO_INCONSISTENTE` | Contrato para pin inválido/parada não ativa de confirmado; não reproduzido em dados persistidos |
| Versão antiga | HTTP 409 real na publicação, preservando mensagem; essa resposta não trouxe código |
| Finalizar com embarcado | HTTP 409 real; após desembarque, finalização aceita |

Um 409 no início não prova erro no planejamento. O planejamento é outra chamada;
uma falha nela não desmonta os locais cadastrados. A #39 permanece pendente da
reprodução histórica, com status/código/mensagem originais, sem afirmar que todo
conflito é versão desatualizada.

## Evidências e resultados

O [registro HTTP sanitizado](evidencias/mvp-excursoes-2026-11-17/http.json) tem 155
respostas observadas pelo runner, além de verificações explícitas de 401 sem sessão
e 403 com perfil passageiro. Isso é contagem de requisições, não de casos de teste.
Não inclui as requisições feitas pelo aparelho. Contém caminhos normalizados,
status, códigos, mensagens de domínio e contagens; não contém credenciais, tokens,
coordenadas, nomes ou contatos privados.

O runner `scripts/validar-excursoes.cjs` executa serviços TypeScript reais do app,
autenticação real e API remota, sem mock de resposta. Exige autorização explícita
por ambiente e credenciais em variáveis; mantém os IDs próprios em `.expo`, sem
versioná-los. `preparar` cria as três excursões apenas uma vez; `completar` opera
os recursos desse manifesto; `auditar` lê o estado final e verifica permissões;
`limites` cria um recurso separado, valida capacidade/convites e o cancela.

Para repetir em outro ambiente autorizado: fornecer `BEVANS_TEST_WRITE=CONFIRMADO`,
`BEVANS_TEST_EMAIL` e `BEVANS_TEST_PASSWORD` por variáveis de ambiente. Para o teste
de papel, fornecer também `BEVANS_TEST_PASSENGER_EMAIL`. Executar
`node scripts/validar-excursoes.cjs preparar`, depois `completar`, `auditar` e
`limites`. Não remover os manifestos em `.expo/mvp-excursoes` para repetir criações
no mesmo ambiente. `BEVANS_TEST_MODES` permite completar apenas os modos escolhidos;
nesta execução, múltiplas paradas foram operadas pelo Android antes de `auditar`.

- Três modos com novas leituras após salvar. Parada única recuperada; múltiplas
  passaram por adição de segunda e terceira, inversão, edição de nome/horário/
  instruções e remoção. Troca de modo não deixou paradas ativas incompatíveis.
- IDA/VOLTA dos três modos comparadas com os locais e a ordem salvos, sem otimização.
  Porta a porta incluiu somente o ponto público confirmado do participante fictício.
- Seis execuções finalizadas. A auditoria final confirmou duas por excursão, todas
  finalizadas, com zero na van e um desembarcado em cada sentido.
- No Android: nova excursão criada com origem/destino/parada confirmados, datas
  nativas, capacidade dois, salva, fechada, reaberta, parada renomeada, salva,
  reaberta e excursão publicada. A excursão de múltiplas paradas do runner foi
  operada no aparelho: início IDA → embarque → desembarque → finalização → VOLTA
  → embarque → desembarque → finalização. A auditoria REST confirmou o resultado.
- Capacidade um: primeiro confirmado; segunda inscrição recusada por 409. Pin
  inválido recusado por 400. Convites revogado e expirado recusados por 404; a
  expiração foi aguardada de fato, sem alterar relógio ou banco.

Capturas originais, sem edição, em
[evidencias/mvp-excursoes-2026-11-17](evidencias/mvp-excursoes-2026-11-17/):

| Arquivo | Evidência |
| --- | --- |
| `01-datas.png` | Datas e horários brasileiros no cadastro |
| `02-rascunho-reaberto.png` | Nova leitura após sair e reabrir |
| `03-publicada.png` | Excursão cadastrada no aparelho publicada |
| `04-campo-com-teclado.png` | Campo da parada visível durante digitação |
| `05-embarque-ida.png` | Snapshot real e contador com uma pessoa na van |
| `06-desembarque-ida.png` | Zero na van e um desembarcado |
| `07-roteiro-volta.png` | VOLTA ativa, extremos invertidos e pontos de desembarque |
| `08-execucoes-finalizadas.png` | IDA e VOLTA finalizadas; novos inícios bloqueados |
| `09-convites-bloqueados.png` | Motivo real da indisponibilidade da página pública |

Verificações finais aprovadas: `npm run architecture`, `npm run typecheck`,
`npm test` e `npm run check` (**313 testes, zero falhas**), `npm run bundle:android`
e `git diff --check`. O bundle foi exportado com `CI=1`, `EXPO_OFFLINE=1` e
`EXPO_NO_DOTENV=1` para não carregar credenciais na exportação de conferência.
A prova do Mapbox no aparelho usa a configuração existente do app, separadamente
da exportação. Revisão React aplicada a hooks, limpeza de listeners, respostas
tardias, identidade de recursos e ações acessíveis.
O [resumo verificável](evidencias/mvp-excursoes-2026-11-17/verificacao.json) registra
resultados, contagens finais e SHA-256 das capturas originais.

Testes novos cobrem DTO aninhado, normalização/comparação completa, GET de
persistência, repetição sem PUT, versões, calendário/fuso, execução inválida,
pré-condições, concorrência, início incerto, snapshot, estados HTTP 400/401/403/409/
500, encerramento dos convites, bloqueio de embarques e navegação com rascunho.
Falhas 500/rede e toque duplo no componente foram simulados em testes locais;
não são apresentados como prova de falha real da API ou de rede no aparelho.

## Classificação dos fluxos e limites

| Fluxo | Classificação | Limite da evidência |
| --- | --- | --- |
| Cadastro, datas, salvar/reabrir, publicar | **Validado** | API e Android; ainda sem APK de distribuição |
| Persistência dos três modos, ordem/edição/remoção | **Validado** | API real; cadastro e edição de parada única também no Android |
| Prévia e execução IDA/VOLTA sem otimização | **Validado** | Três modos na API; múltiplas paradas operadas no Android |
| Embarque/desembarque e finalização | **Validado** | API e aparelho; nenhuma movimentação física/GPS de van testada |
| Emitir/revogar/expirar convite, inscrever e confirmar | **Validado** | Contratos HTTP reais; inscrição exercitada por runner |
| Compartilhamento nativo e inscrição pelo navegador | **Bloqueado** | Webapp #14 e `EXPO_PUBLIC_CONVITE_WEB_URL` ausente |
| Capacidade e pin inválido | **Validado** | API real em recurso próprio; não por formulário web |
| Reprodução original da #39 | **Bloqueado** | Não reproduzida; requer cenário original diagnosticável |
| Recuperação de perda de rede durante início | **Implementado, pendente de validação** | Teste local aprovado; sem interrupção real de rede no Android |
| Seleção de marcador → edição | **Implementado, pendente de validação** | Teste de componente aprovado; edição no Android feita pela lista |
| Início tardio e otimização | **Implementado, pendente de validação** | Compatibilidade com contrato preservada; sem ensaio integrado específico |
| Geometria pelas ruas e próxima parada dinâmica | **Bloqueado** | Sem geometria de excursão implementada nem próxima parada no contrato consultado |
| Fluxo de passageiro ocasional no Android/web | **Bloqueado** | Permissão negativa 403 validada; jornada pública depende do webapp |

## Arquivos e commits

- Persistência/contratos: `src/services/excursoes.ts`, `excursaoValidacao.ts`,
  `excursaoFormulario.ts`, `convitesCompartilhamento.ts`; formulário em
  `src/components/excursoes/Planejamento.ts` e `PlanejarExcursao.tsx`.
- Mapa/teclado: `src/components/MapaPreviaPublica.tsx`, `MapMarker.tsx` e
  `src/components/excursoes/ViagemUI.tsx`.
- Jornada/operação: `src/app/editar-excursao.tsx`, `controle-viagem.tsx`,
  `src/components/excursoes/OperacaoExcursao.tsx`, `RoteiroExecucaoExcursao.tsx`,
  `VisaoGeralViagem.tsx`, `ConvitesViagem.tsx` e `src/services/operacoes.ts`.
- Validação: `tests/excursoes-mvp.cjs`, `excursoes-operacao.cjs`,
  `convites-compartilhamento.cjs`, `integracao-modulos.cjs`, `usabilidade.cjs`,
  `tests/helpers/excursoes.cjs`, runner, este relatório e evidências.

Commits funcionais locais na `main`, sem push:

- `e72634c` — Corrigindo a persistência das paradas e o contrato dos convites.
- `2b43358` — Integrando o roteiro oficial ao controle de embarque.
- O registro documental e o runner são feitos em commit separado, com mensagem
  “Documentando a validação integrada das excursões no Android”.

## Próximas prioridades

1. Implementar e publicar a inscrição do webapp #14, configurar sua URL HTTPS e
   validar o compartilhamento nativo até inscrição/confirmação pelo navegador.
   Não foi criada uma segunda inscrição dentro do mobile nem usada URL fictícia.
2. Retomar a #39 com condições originais reproduzíveis. No backend, conservar
   códigos estruturados para conflitos; capacidade/versão/finalização observadas
   ainda retornam mensagem sem código específico.
3. Validar seleção de marcadores, otimização, perda de rede real e APK de
   distribuição em outra rodada física. Resolver limite/custo de Directions antes
   de incluir geometria e definir contrato de próxima parada se necessário.

As correções permitem testar a operação móvel com excursões preparadas; a ausência
da inscrição web continua impedindo a jornada integral sem intervenção técnica.
