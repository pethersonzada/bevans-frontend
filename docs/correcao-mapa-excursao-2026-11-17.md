# Mapa de excursões: causa, correção e validação Android

Commits locais: `c7dd223` (fixtures de testes) e `f34549f` (correção funcional).
Este relatório e as capturas são registrados em commit documental separado.

Escopo desta entrega: a prioridade crítica do mapa, antes da reformulação visual.
Base do frontend: `main`, `7a06ebe`, árvore limpa ao iniciar. Backend e webapp
consultados apenas para leitura. Nenhum push, PR, deploy ou alteração desses
repositórios. A validação usou a instalação nativa existente do BeVans, atualizada
pelo Metro local, no Motorola edge 60 neo autorizado pelo usuário, Android 16/API
36. Não foi uma validação em Expo Go nem somente exportação de JavaScript.

## Causa raiz comprovada

Em `GestaoExcursao.tsx`, `pontos` começava vazio e o mapa estava dentro de
`!!pontos.length`. Nenhuma consulta era realizada ao abrir a seção: o motorista
precisava tocar em “Ver sequência dos pontos”. A função `consultarRoteiro`
executava `setPontos([])` **antes** de aguardar `planejarExcursao`. Assim:

1. Ao entrar, o componente Mapbox nem era montado.
2. Uma nova consulta desmontava um mapa que já estivesse visível.
3. HTTP 409, falha de rede ou resposta vazia mantinham a lista vazia e o mapa
   ausente, independentemente da configuração ou disponibilidade do Mapbox.

Havia uma segunda condição em `MapaPreviaPublica`: `if(!pontos.length)return
null`. Portanto, simplesmente retirar a condição do componente pai também não
resolveria a montagem independente do planejamento.

Outros defeitos encontrados: o serviço só verificava `Array.isArray`, sem
validar coordenadas; a prévia não configurava seu próprio token; e o ajuste de
câmera ocorria antes da confirmação do carregamento nativo, sem reaplicação
quando o mapa ficasse pronto. Esses eram riscos adicionais, não evidência de
que o token do aparelho estivesse inválido.

## Relação com a issue #39

A [issue #39](https://github.com/pethersonzada/bevans-frontend/issues/39) relata
409 ao iniciar e “Planejamento indisponível ou inconsistente” na prévia. Qualquer
erro no planejamento causava a ausência do mapa pela condição descrita acima.
Um 409 **somente no início** não demonstra por si só erro no Mapbox ou no endpoint
de planejamento. As duas chamadas e seus motivos precisam ser distinguidos.

O código local do backend (`2396d3c`) diferencia `ROTEIRO_INCONSISTENTE`,
`ESTADO_INVALIDO`, `EXECUCAO_ATIVA`, `EXECUCAO_EXISTENTE` e `IDA_NAO_FINALIZADA`.
Em particular, participantes confirmados sem parada ativa ou pontos inválidos
podem impedir o planejamento. A documentação antiga de roteiro no backend ainda
descreve bloqueios por horário/publicação e 409 para sentido já executado;
`RoteiroExcursaoService` atual permite prévia em rascunho/após o horário e devolve
o snapshot do sentido executado. Não usar esse documento antigo para inferir o
status do servidor implantado.

Na validação pelo app, a excursão relatada já estava concluída. IDA retornou
**HTTP 200 com quatro pontos válidos: ORIGEM, COLETA, COLETA, DESTINO**. VOLTA
retornou **HTTP 400**, com “Retorno exige horário de volta e origem operacional
configurados”. Esses resultados foram registrados na própria chamada feita
pelo aplicativo, sem consulta externa de todas as excursões e sem logs de pins
ou passageiros. [Registro sanitizado](evidencias/mapa-excursao-2026-11-17/planejamento.txt).

O motivo exato do **409 histórico** permanece sem reprodução no estado atual.
Não foi inventado conflito de versão nem alterado o cadastro para provocá-lo.
A issue #39 não está integralmente resolvida por esta entrega.

## Implementação

- `GestaoExcursao`: mapa montado ao abrir a seção, usando origem, destino e
  paradas salvos. Estados separados para consulta ainda não realizada,
  carregando, sucesso, resposta vazia e erro. O erro HTTP não remove o mapa.
- Cadastro e roteiro do servidor possuem legendas distintas. No modo porta a
  porta não são fabricados pins de participantes ausentes do cadastro.
- IDA/VOLTA invertem os extremos dos locais salvos. O cadastro mostrado na VOLTA
  não é anunciado como execução autorizada quando a API recusa o planejamento.
- Consulta cancelável, invalidação por versão/sentido/execuções e descarte de
  respostas atrasadas, inclusive ao sair e retornar à mesma excursão.
- “Editar locais da excursão” abre o editor existente, sem depender do sucesso
  do planejamento e sem contornar as regras de persistência do backend.
- `mapaExcursao`: valida números finitos, limites geográficos, nomes, IDs e tipos
  retornados. Rejeita `(0,0)`, conforme o backend; aceita latitude **ou** longitude
  zero válida. Dados de participantes não são repassados ao mapa.
- `MapaPreviaPublica`: inicialização explícita de token; mapa sem pins também
  pode montar, sem coordenada fictícia; câmera ajustada após carregar e quando
  os pontos mudam; estados de carregamento, token ausente, pontos inválidos e
  falha de carregamento/renderização, com recarga independente da API.
- Removida a linha reta da prévia compartilhada: somente marcadores reais. Não
  houve chamada adicional ao Directions, novo provedor ou geometria inventada.
- `ApiError` preserva `codigo`/`code`, mensagem e status HTTP. 409 não é convertido
  automaticamente em conflito de versão. Diagnóstico em desenvolvimento registra
  apenas status, sentido, quantidade, tipos e resultado da validação.
- `app.config.js`: removida a opção `RNMapboxMapsAccessToken`, não reconhecida
  pelo plugin instalado (`@rnmapbox/maps` 10.3.11). O plugin continua habilitado;
  o token público de execução é aplicado por `MapboxGL.setAccessToken`.

Não houve reformulação visual. O ajuste da altura da moldura permite mostrar os
avisos abaixo do mapa, sem recortá-los no editor.

## Verificação dos seis pontos solicitados

| Investigação | Evidência e conclusão |
| --- | --- |
| API retorna origem, destino e paradas? | IDA real: HTTP 200, quatro pontos, origem + duas coletas + destino. Snapshot da execução existente. |
| 409 tem relação com o mapa ausente? | Sim, um erro no planejamento impedia a montagem pelo fluxo anterior. Motivo específico do 409 histórico não reproduzido; início não foi acionado na excursão concluída. |
| Coordenadas são válidas? | Todos os quatro pontos reais passaram na validação numérica/geográfica. Casos inválidos adicionais são rejeitados em testes. |
| Componente é desmontado/ocultado? | Condição no pai, limpeza antecipada da lista e retorno nulo no filho identificados e corrigidos. Troca de tela ainda desmonta o mapa naturalmente. |
| Mapbox funciona sem planejamento? | Estilo/tiles e marcadores visíveis no aparelho antes do POST; permaneceram visíveis após HTTP 400 de VOLTA. |
| Token, estilo, permissões ou configuração nativa? | Token público presente; estilo Dark e tiles carregados no build nativo; manifesto possui INTERNET e permissões de localização. Prévia de locais salvos não solicita GPS. Não foi observada falha de token ou estilo nesse aparelho. |

O SDK lança erro ao importar sem módulo nativo. Expo Go não substitui o build
nativo necessário; plugins novos exigem recompilação. Esta correção foi testada
com o módulo já instalado. Eventos usados conferidos no código instalado e na
[documentação do MapView](https://rnmapbox.github.io/docs/components/MapView).

## Evidências do Android real

Capturas originais, sem imagens geradas ou alteração de coordenadas:

- [Locais salvos antes da consulta](evidencias/mapa-excursao-2026-11-17/locais-salvos.png).
- [Planejamento IDA aceito, mapa visível](evidencias/mapa-excursao-2026-11-17/planejamento-ida.png).
- [VOLTA recusada com HTTP 400, mapa preservado](evidencias/mapa-excursao-2026-11-17/erro-planejamento-volta.png).
- [Parada salva aberta no picker para edição](evidencias/mapa-excursao-2026-11-17/editar-ponto.png).

O zoom regional enquadra os extremos; paradas próximas podem se sobrepor nessa
escala. O picker de uma parada comprova o pin em escala local. A ida/volta troca
os ícones de origem/destino. Não foi simulada viagem GPS em movimento.

## Testes e limites do aceite

`npm run check`: arquitetura, TypeScript e **298 testes aprovados**.
`npm run bundle:android`: exportação Metro/Hermes aprovada com `CI=1`,
`EXPO_NO_DOTENV=1` e `EXPO_OFFLINE=1`, sem incorporar as credenciais locais.
`git diff --check`: aprovado.

As regressões incluem montagem antes/durante/depois da consulta, erro 409 com
código e mensagem específicos, resposta vazia, resposta atrasada, cancelamento,
troca de versão, três modos de coleta, IDA/VOLTA, dados inválidos, token ausente,
erro nativo/recarga e câmera após carregamento. Mocks antigos de importação foram
atualizados; dois cenários de atalhos de turma tinham fixtures incompatíveis
com a consulta de coleta já existente e foram ajustados, sem alterar esse fluxo
do aplicativo.

Issues consultadas para este diagnóstico: frontend #39 (sem comentários), #35,
#42, #6, #16 e backend #31; inventário de issues do frontend e histórico recente
também consultados. Nenhuma issue foi fechada ou alterada.

| Fluxo | Classificação |
| --- | --- |
| Mapa com locais salvos antes do planejamento | **Validado** no Android real. |
| Roteiro IDA existente com pontos válidos | **Validado** pelo app/API e mapa nativo. |
| Mapa preservado após falha de planejamento | **Validado** com HTTP 400 real; 409 e resposta vazia em testes simulados. |
| Abrir ponto salvo para editar sem planejamento | **Validado** no Android real, sem salvar mudanças. |
| Nova camada de validação/erros/cancelamento | **Validado** em testes automatizados; falhas de token/estilo simuladas, sem invalidar o token do aparelho. |
| Causa específica do 409 histórico e início de nova execução | **Implementado, pendente de validação** do tratamento no cenário histórico; é necessária excursão de teste no estado que reproduza o conflito. |
| Roteiro operacional de VOLTA nesta excursão | **Bloqueado** por configuração de retorno exigida pela API; mapa de cadastro disponível. |

A API HTTPS usada era a já configurada no app, em `development`; não foi
confirmado um banco isolado de homologação. Não foram criadas excursões,
alteradas paradas persistidas, iniciadas/canceladas execuções, compartilhados
convites ou modificados participantes. Os demais critérios do MVP, aceite
passageiro/motorista, todos os modos com persistência real, release/EAS e iOS
continuam fora deste aceite específico do mapa.
