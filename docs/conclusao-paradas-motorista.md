# Conclusão explícita das paradas pelo motorista

PR [#47](https://github.com/pethersonzada/bevans-frontend/pull/47), branch `estabilizacao-rotas-mobile-20261116`, validação em 17/11/2026. Base anterior: `06f7954`, com 253 testes.

Código e testes no commit `654eed8` — Separar chegada GPS da conclusão explícita das paradas.

## Problema e comportamento corrigido

Antes, duas leituras GPS a até 30 m do ponto, com precisão até 45 m e velocidade até 18 km/h, executavam `paradasRef.current.shift()` e salvavam a visita. A van podia perder um embarque apenas por passar devagar perto do endereço. A observação de que GPS não confirma embarque não impedia esse avanço da navegação.

Agora o GPS atualiza somente a indicação transitória do próximo ponto. Nenhuma leitura GPS remove pontos ou grava conclusão. Existem três situações distintas:

| Situação | Significado | Avança a navegação? |
| --- | --- | --- |
| Próximo da parada | Leitura confiável a até 80 m | Não |
| Chegou ao ponto | Duas observações distintas e recentes a até 30 m, precisão até 45 m e velocidade conhecida até 5 km/h | Não |
| Parada concluída | Motorista acionou a conclusão do próximo ponto, após conferência oficial e persistência local | Sim, somente esse ponto |

A chegada expira em 15 segundos, é invalidada ao sair do mapa e nunca é restaurada do cache. GPS impreciso, observações repetidas, posição antiga e velocidade desconhecida não autorizam conclusão. A chegada também é conferida novamente depois da consulta HTTP.

## Controle operacional e interface

O cartão mostra nome do próximo ponto, passageiros previstos, estados oficiais, proximidade/chegada, impedimentos e até duas ações: **Controle de embarque** e **Concluir parada**. O controle existente continua responsável por embarque, ausência, desembarque e correções com motivo. Não foi criado um segundo mecanismo de confirmação no mapa.

- `AGUARDANDO` bloqueia a conclusão do ponto. O motorista precisa registrar explicitamente o ocorrido no controle operacional.
- `EMBARCADO`, `NAO_EMBARCOU` e `DESEMBARCADO` são estados resolvidos para o ponto de coleta. A conclusão local não altera esses estados.
- Embarque compartilhado exige que todos os passageiros associados estejam resolvidos.
- Pontos individuais, excepcionais e paradas sem passageiros seguem a mesma sequência e exigem ação explícita.
- Origem é apenas referência do snapshot; não exige retorno à garagem, chegada nem conclusão e fica fora da contagem de embarques. As direções começam no GPS atual. Destino exige que não existam passageiros aguardando ou embarcados na operação; os desembarques permanecem explícitos.
- Concluir o destino zera distância/estimativa, mas não encerra a viagem automaticamente.

O botão de conclusão só fica disponível com chegada válida, conexão e painel operacional válido. No clique, o app consulta novamente status e painel, confere viagem, sentido, IDs dos passageiros, parada e ordem, e reavalia os impedimentos. Falhas de rede, autorização, conflito, leitura do painel ou persistência local mantêm o ponto pendente. O aplicativo não registra ausência, não enfileira embarques offline e não assume sucesso de uma confirmação operacional que falhou.

Toque duplo é serializado por uma trava imediata. Um callback antigo não pode concluir o ponto seguinte, mesmo que esteja nas mesmas coordenadas. Sair do mapa durante a consulta invalida a resposta. Após concluir, o cartão mostra feedback e o marcador ganha uma indicação de conclusão. A lista de passageiros pode rolar e os botões têm identificação acessível e área mínima de 48 dp; o botão de centralização fica acima do cartão.

## Ordem, cache, retomada e concorrência

O snapshot segue na ordem oficial, inclusive na VOLTA. O recálculo do Mapbox inclui todos os pontos que ainda não foram concluídos explicitamente. A comparação da sequência pendente inteira descarta também um recálculo antigo quando uma correção operacional reabre um ponto anterior.

O cache v5 separa usuário, turma, viagem e sentido. Aceita apenas prefixo contíguo do mesmo snapshot com a marca de confirmação explícita `MOTORISTA`. A versão v4, que permitia avanço pelo GPS, não é migrada nem consumida. Isso pode reapresentar pontos antigos; impede que uma passagem por proximidade seja restaurada como parada concluída.

Na abertura, retomada e atualização do painel, as conclusões locais são conciliadas com os registros oficiais. Uma correção para `AGUARDANDO` reabre o ponto e todo o sufixo. O prefixo reduzido é persistido para impedir que uma futura reconexão ressuscite conclusões invalidadas. A atualização é serializada com a conclusão manual; respostas de leituras anteriores são ignoradas. A segunda viagem no mesmo dia não herda progresso da primeira.

## Contrato e limitação do backend

Foi consultado somente para leitura o backend da PR #62 no commit `2396d3c`: `docs/roteiro-operacional-api.md`, `OperacaoController`, `OperacaoService` e a consulta de status. Foram preservados `GET /operacoes/VIAGEM/{viagemId}/roteiro`, `GET /operacoes/VIAGEM/{viagemId}`, status e os endpoints existentes de alteração de registro, com versão e correção auditada. Nenhum arquivo do backend foi alterado.

O contrato **não oferece conclusão de parada ou cursor de navegação persistido no servidor**, nem uma transação que conclua o ponto condicionada às versões de todos os passageiros. Assim, a conclusão de navegação permanece local, precedida de consulta oficial; os estados dos passageiros continuam autoritativos no backend. Correções posteriores são reconciliadas nas consultas seguintes. Uma alteração no servidor ocorrida depois da última leitura não pode ser eliminada atomicamente pelo frontend.

Permanece um bloqueio para garantia de conclusão transacional entre vários aparelhos e recuperação após limpar os dados do app: será necessário um contrato backend próprio para conclusão/reabertura de pontos, com controle de versão da execução e idempotência. Esta rodada não inventa essa operação nem apresenta o cache local como confirmação de embarque.

## Evidências

- `npm ci`: 781 pacotes instalados pelo lockfile.
- `npm run check`: arquitetura, TypeScript e **285 testes aprovados**. Os 253 testes anteriores foram preservados; os cenários que dependiam do avanço automático passaram a usar a ação explícita. Foram acrescentadas 32 regressões.
- A cobertura inclui passagem lenta sem parada, chegada sem avanço, pontos coincidentes, aguardando, embarque compartilhado, ausência, desembarque, paradas vazias, origem/destino, IDA/VOLTA, reinício, segunda execução, desvio, cache antigo, toque duplo, GPS impreciso, expiração, rede, confirmação operacional falha, correção concorrente e respostas atrasadas.
- `npm run bundle:android`: exportação Hermes em `.expo/ci-android`, com configuração de CI, sem carregar credenciais locais.
- Artefato: `_expo/static/js/android/entry-8e90730d09a24db03dca6932189cab7e.hbc` (4,7 MB).
- `git diff --check`: aprovado.
- `adb devices -l`: nenhum aparelho ou emulador conectado nesta sessão.
- Logs locais ignorados pelo Git: `.expo/paradas-npm-ci.log`, `.expo/paradas-check.log` e `.expo/paradas-bundle-android.log`.

Os testes montam a tela com módulos nativos e HTTP simulados, e exercitam também o cliente existente de alteração operacional com falha de confirmação. Não equivalem a uma sessão Firebase real ou a execução nativa.

## Homologação pendente

- [ ] Com sessão Firebase de motorista proprietário, confirmar os estados e conflitos da API da PR #62, inclusive versão concorrente e falha de confirmação sem avanço local.
- [ ] Em dois Androids, dirigir perto do ponto sem parar e conferir que a parada continua pendente, mesmo que a chegada seja indicada.
- [ ] Confirmar embarques compartilhados, ausência explícita, desembarques, paradas vazias, origem/destino e os dois sentidos.
- [ ] Testar GPS real, fontes grandes, TalkBack, rolagem do cartão, perda de sinal, background, retorno do controle operacional, reinício e segunda viagem.
- [ ] Corrigir um passageiro para aguardando em outra sessão e verificar reabertura e recálculo. Registrar a limitação transacional do contrato descrita acima.

Sem merge, deploy, publicação de APK ou alteração do backend. A exportação Android não substitui compilação e instalação em aparelho real.

## Correção de progressão privada (#54)

O painel oficial passa a reconciliar o prefixo das paradas privadas cujo estado já foi resolvido. IDA: EMBARCADO, NAO_EMBARCOU e DESEMBARCADO resolvem a coleta. VOLTA: apenas DESEMBARCADO ou NAO_EMBARCOU resolvem a entrega; o embarque no campus não conclui endereços. Paradas sem passageiros e DESTINO continuam exigindo conclusão explícita. A geometria é recalculada apenas com os pontos pendentes, usando a ordem oficial. Na retomada, estados confirmados reconstroem esse prefixo mesmo sem cache; correções reabrem os pontos. O marcador de cache OPERACIONAL distingue o progresso misto privado. Modalidade pública, excursão, regras de chegada e encerramento continuam inalteradas. Não se confirma embarque/desembarque pelo GPS e não se encerra automaticamente.

## Operação direta no mapa privado (#55)

A IDA privada oferece confirmação individual de embarque no cartão do ponto atual, com configurações para ausências/correções. A VOLTA oferece confirmação individual de desembarque no ponto; o controle continua disponível para embarques no campus e exceções. A IDA deixa de exigir desembarques individuais ao chegar ao destino: Encerrar viagem, com chegada GPS confirmada e confirmação explícita, chama a operação atômica do backend `/operacoes/VIAGEM/{id}/concluir-ida`. Não chama o endpoint genérico antes da chegada. O backend valida a própria amostra GPS e encerra com auditoria. Modalidades públicas e excursões conservam o fluxo anterior.
