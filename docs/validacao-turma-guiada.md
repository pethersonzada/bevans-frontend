# Validação do cadastro e da viagem privada — 22/11/2026

Contas de teste autorizadas, API remota configurada no frontend e dois emuladores
Android. Datas dos arquivos JSON estão em UTC; os testes ocorreram em 22/11 no
fuso America/Sao_Paulo. Não houve alteração de código/configuração do backend.

## O que passou

1. Turma 10 criada pela interface Dados → Trajeto → Revisão. Nome, turno,
   capacidade e dois pontos públicos foram preservados após force-stop e
   confirmados por GET antes da tela de sucesso. Coleta da mesma turma foi aberta.
2. Passageiro solicitou vínculo por contrato real; motorista aprovou. A presença
   AMBOS foi confirmada com dois endereços distintos, derivados dos locais públicos
   que já haviam sido escolhidos no cadastro Android. Preparação feita por HTTP;
   não declarar que vínculo/aprovação foram executados nas telas.
3. Início IDA pela interface do motorista: execução 68. API de ambas as contas
   confirmou a mesma identidade, um esperado no painel e três pontos no roteiro.
   O mapa mostrou o passageiro como próxima parada, com marcador intermediário;
   não avançou automaticamente só por GPS. A Home passageira reconheceu viagem
   ativa mesmo sem localização recente.
4. Editar presença e escolher VOLTA sem salvar preservou o rascunho por múltiplos
   ciclos de polling. Cancelar restaurou AMBOS. A suíte automatizada também testa
   atualização real dos campos salvos enquanto o formulário está em edição.
5. Encerramento direto por HTTP confirmado nas duas contas. Segunda IDA pelo app:
   execução 69, com o mesmo esperado e três pontos novamente. A segunda execução
   também foi encerrada por HTTP ao terminar os testes.
6. Auditoria de permissões: 403 para passageiro consultar turmas do motorista e
   gestão pública; 403 para motorista consultar embarques próprios de passageiro;
   401 na central sem sessão. Consultas autorizadas de central/preferências: 200.
7. Reteste no emulador principal: IDA 70 e VOLTA 71 iniciadas pela interface,
   com um esperado e três pontos em ambas. GPS simulado foi publicado pelo app;
   a API própria passageira retornou ATUALIZADA. Após sair do mapa sem publicar
   novas amostras, retornou DESATUALIZADA, sem confundir isso com viagem encerrada.
8. Na VOLTA 71, embarque simulado pelo painel do motorista foi confirmado como
   EMBARCADO na API própria passageira. Desembarque exigiu revisão e confirmação
   explícita; a API retornou DESEMBARCADO. IDA 70 e VOLTA 71 foram encerradas pelo
   mapa, com retorno à Home e INATIVA confirmada nas duas contas.

Evidências sem nomes, endereços, coordenadas ou credenciais: `http-privado.json` e
`http-permissoes.json` em `docs/evidencias/frontend-2026-11-22/`.

## Falhas e limites observados

- O encerramento pelo mapa apresentou erro; a chamada direta de mesmo contrato
  retornou 200 e a releitura confirmou INATIVA. A causa da diferença no dispositivo
  não foi isolada. O frontend agora confere a execução antes de escrever, confirma
  o estado depois da ação e preserva a mensagem de erro. Testes cobrem timeout
  após gravação e repetição sem novo POST. Reteste nativo passou nas execuções
  70/71; a causa da falha inicial não foi isolada.
- O GPS simulado no emulador desenhou a posição e o trajeto, mas a consulta
  autorizada retornou SEM_LOCALIZACAO e o motorista apresentou falha de publicação.
  Reteste no principal publicou GPS em 70/71 e a API retornou ATUALIZADA. Não se
  atribui causalidade à mudança de mensagem: a causa inicial não foi isolada.
- A amostra simulada não equivale a deslocamento real nem valida precisão/TTL
  em campo. Foram testados início/encerramento nos dois sentidos e embarque/
  desembarque simulado na VOLTA, mas faltam deslocamento, conclusão manual das
  paradas, cache já visitado, ações na interface passageira e falhas de rede.
  Expiração após envio válido foi conferida pela API, sem aceite visual completo.
- O build de desenvolvimento exibiu avisos de Mapbox/rede que sobrepunham
  controles. Esses avisos foram fechados para os testes; não se afirma release
  nativa validada. APK existente foi usado, com o JavaScript atual pelo Metro.
- Capturas com nomes das contas foram mantidas somente em `.expo`, sem commit
  ou publicação nas issues. Os recursos novos de teste permanecem identificados
  para inspeção; não há execução de teste ativa ao final.

## Repetir o diagnóstico

`scripts/validar-turma-guiada.cjs` usa credenciais somente por
`BEVANS_TEST_EMAIL`, `BEVANS_TEST_PASSENGER_EMAIL` e `BEVANS_TEST_PASSWORD`.
Nunca versionar seus valores. A API é a configuração normal do frontend.

- `node scripts/validar-turma-guiada.cjs preparar`: exige turma exclusiva
  `VALIDACAO_GUIADA_2211`, inativa e sem outros passageiros; vincula a conta de
  teste e prepara presença própria.
- `... conferir`: compara identidade das sessões, vínculo, roteiro e operação
  própria; registra somente metadados de resposta e estado do GPS.
- `... presenca`: consulta somente a confirmação da conta passageira e registra
  status e correspondência dos endereços de teste, sem seus valores.
- `... encerrar`: encerra somente a turma exclusiva e recusa presença de pessoas
  fora deste teste. Confere novamente o estado nas duas contas.

O manifesto com IDs fica em `.expo/turma-guiada-2211`. Não apagar esse manifesto
entre tentativas, pois ele permite reaproveitar recursos e evitar duplicação.

## Continuação em 23/11

Na interface passageira da turma 10, IDA foi salva e restaurada após force-stop;
VOLTA, AMBOS e NAO_VOU foram confirmados por GET próprio. AMBOS usou os dois
endereços distintos de teste. A limpeza passou a existir no aplicativo: cancelar
preservou NAO_VOU; confirmar retornou status vazio. Nenhuma viagem privada foi
iniciada nessa continuação; a turma foi novamente conferida INATIVA.

O ciclo público separado está registrado em RELATORIO_FRONTEND.md e
`docs/evidencias/frontend-2026-11-23/rota-publica.json`: turma 11, rota 4, execução
72. A turma pública é um recurso novo e não publica a turma privada 10.

## Quinto lote — cache efetivamente visitado

Em 23/11, turma 10, AMBOS preparado por HTTP próprio com os endereços distintos
8/9. A execução 73/IDA foi iniciada pelo Android. Emulador principal motorista
e isolado passageiro permaneceram autenticados simultaneamente. O passageiro
usou Embarquei; GET próprio e mapa motorista confirmaram EMBARCADO. GPS simulado
preciso e recente habilitou Concluir; a ação manual gravou a visita individual.
O armazenamento do aparelho confirmou MOTORISTA e geometria com só o destino
pendente. Não foi inserida visita diretamente no armazenamento.

Force-stop do motorista preservou o progresso da mesma execução. A primeira
consulta falhou; após retentativa, o mapa mostrou o destino e o marcador visitado.
O passageiro manteve EMBARCADO após reiniciar e confirmou Desembarquei com revisão;
GET próprio retornou DESEMBARCADO. A tela própria chegou a exibir GPS atualizado.
O encerramento pelo mapa exigiu retentativa; INATIVA foi confirmado nas duas contas,
embora uma releitura nativa tenha terminado com resultado incerto.

Na segunda IDA do mesmo dia, execução 74, snapshot com três pontos e um esperado,
estado próprio AGUARDANDO e endereço IDA correto. Mapa voltou a mostrar o passageiro
e o waypoint. Cache de 73 manteve a visita; geometria de 74 contém ponto individual
e destino, sem visita herdada. 74 também foi encerrada e conferida INATIVA.

`quinto-cache.json` registra metadados sem nomes ou coordenadas. Capturas e banco
local do aparelho permanecem ignorados pelo Git. A leitura do banco selecionou
somente chaves de roteiro da turma de teste; nenhum token foi publicado.

Reapareceram timeouts com dois emuladores. O host teve cerca de 387 MB livres;
reduzir o isolado de 2048 MB/quatro núcleos para 1024 MB/dois núcleos não eliminou
as falhas. Não há diagnóstico definitivo de rede, aceite físico ou deslocamento.
As issues #40/#45 continuam abertas para os demais critérios.

Para verificar o código efetivamente commitado, `node scripts/validar-commit.cjs
HEAD` extrai `git archive` em `.expo/validacao-commits`, usa o node_modules instalado
por junction e roda check e bundle sem copiar `.env` ou alterações locais.
Resultado e logs ficam na extração. Não cria branch nem altera a árvore de trabalho.
O commit 1b7c362 foi verificado separadamente: 374 testes, arquitetura, TypeScript
e bundle Android aprovados; a árvore externa tinha 375 testes. Dependências
compartilhadas não equivalem a uma instalação nova por npm ci.
