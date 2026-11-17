# Roteiro operacional no mapa do motorista

Validação local em 17/11/2026, na branch `estabilizacao-rotas-mobile-20261116`, PR [#47](https://github.com/pethersonzada/bevans-frontend/pull/47).

Código e testes no commit `38f4795` — Integrar roteiro operacional completo ao mapa e preservar todos os pontos do snapshot.

## Contrato adotado

Referência lida diretamente do backend no commit [`2396d3c`](https://github.com/pethersonzada/bevans-backend/blob/2396d3c/docs/roteiro-operacional-api.md), incluindo `PontoColetaPrivadaDTO`, `OperacaoService.roteiroViagem` e a formação dos registros operacionais. O backend foi acessado somente para leitura.

O mapa consulta `GET /operacoes/VIAGEM/{viagemId}/roteiro` pelo cliente autenticado Firebase, com `Cache-Control: no-store`. A identidade vem de `/rota/status-atual?turmaId=...`; o sentido confirmado pelo servidor prevalece sobre o parâmetro da tela. Falha HTTP ou sentido inválido bloqueia a consulta operacional.

O mapa deixou de consultar `/rota/otimizar`, publicações públicas e configurações privadas de coleta para montar a navegação. Origem, destino e pontos intermediários vêm exclusivamente do snapshot. O GPS atual é acrescentado antes da sequência oficial, incluindo a origem ainda não visitada. A VOLTA não recebe inversão adicional. FIXA e FLEXIVEL usam a ordem já salva na partida.

Cada ponto mantém `tipo`, `paradaId`, nome, coordenadas e sua lista de passageiros. A chave local combina posição no snapshot, tipo e parada; nunca usa ID de passageiro como ID de parada. Não há deduplicação por distância: pontos coincidentes, paradas vazias, embarques compartilhados e exceções aprovadas continuam presentes. O próximo ponto exibe também os passageiros previstos.

Antes das direções, os passageiros são conciliados com o painel da mesma viagem e sentido por `alunoId`, quantidade, `paradaId` e `ordem`. Coordenadas inválidas, IDs duplicados, extremos ausentes ou divergência com a operação bloqueiam o roteiro inteiro. O painel continua usando seu formato existente, e os IDs dos registros operacionais não são confundidos com `alunoId`.

## Progresso, cache e Mapbox

- Cache v4 separado por usuário, turma, viagem e sentido. Cada execução no mesmo dia recebe outra chave.
- A assinatura inclui o snapshot completo, inclusive extremos, ordem, associações e coordenadas dos passageiros. Caches das versões anteriores não são consumidos.
- Visitas são restauradas somente como prefixo contíguo da mesma assinatura. Origem, paradas sem passageiros e destino também têm progresso próprio.
- Chegada exige duas leituras próximas, precisão até 45 m e velocidade até 18 km/h, medidas em relação ao ponto original. O ponto ajustado à rua pelo Mapbox não substitui o endereço operacional. Visita geográfica não confirma embarque no backend.
- Recálculo pede apenas os pontos ainda pendentes, na mesma ordem. Uma resposta atrasada é descartada se algum desses pontos foi visitado durante a consulta.
- Permanecem timeout, token obrigatório e limite de 25 waypoints do Mapbox. A contagem inclui o GPS atual: acima do limite, a navegação é bloqueada explicitamente. Não há corte, amostragem, reotimização ou fracionamento do roteiro nesta integração.
- Respostas Mapbox sem todos os waypoints, trechos ou geometria válida são rejeitadas. O fallback de geometria exige a mesma execução, assinatura e sequência pendente, coordenadas originais e índices coerentes. Falhas do envio de GPS não apagam erros do roteiro.
- O snapshot completo sempre precisa ser confirmado no servidor ao abrir/retomar. O cache de geometria não permite iniciar offline sem essa confirmação.

HTTP 409 informa a indisponibilidade do roteiro, incluindo viagem antiga sem snapshot; não reconstrói histórico com o cadastro atual. HTTP 503 informa a indisponibilidade do snapshot salvo e permite nova tentativa. A mensagem original do servidor é preservada. Nenhum desses erros permite reutilizar geometria antiga. Ausência de snapshot nas viagens antigas requer tratamento operacional no servidor; o app não cria outra viagem automaticamente.

## Evidências locais

| Modalidade | IDA e VOLTA | Evidência |
| --- | --- | --- |
| Privada porta a porta | Aprovadas em testes | Endereço do sentido e extremos preservados |
| Privada com paradas | Aprovadas em testes | Parada vazia, IDs em domínios distintos e embarque compartilhado |
| Pública FIXA | Aprovadas em testes | Sequência oficial e exceção aprovada antes do destino |
| Pública FLEXIVEL | Aprovadas em testes | Sequência não monotônica já otimizada pelo backend preservada |

`tests/roteiro-navegacao.cjs` valida contrato, conciliação, identidades, assinatura, retomada, limites, resposta parcial e erros HTTP. `tests/mapa-roteiro-operacional.cjs` monta a tela com hooks e módulos nativos simulados e exercita o caminho tela → cliente HTTP autenticado simulado → snapshot → Mapbox simulado → marcadores e progresso. As requisições desses testes falham se houver consulta ao otimizador ou aos cadastros atuais. Também cobrem reinício, segunda execução, chegada ao destino, recálculo por desvio e resposta atrasada.

- `npm run check`: arquitetura, TypeScript e **253 testes aprovados**, incluindo a suíte existente de excursões e demais módulos.
- `npm run bundle:android`: exportação Android Hermes concluída em `.expo/ci-android`, com `CI=true`, `EXPO_NO_DOTENV=1` e `EXPO_OFFLINE=1`, sem carregar credenciais locais.
- Bundle: `_expo/static/js/android/entry-29f28e09cc2e581f65668429ccfb4d41.hbc` (4,6 MB). SHA-256: `5aaf13f5eb5d9261c7e8b9bd1d402b759c3982143137445ecbfb08ef97be7cb4`.
- Logs locais: `.expo/roteiro-check.log` e `.expo/roteiro-bundle-android.log` (arquivos ignorados pelo Git).
- `git diff --check`: aprovado.
- `adb devices -l`: lista vazia; nenhum aparelho ou emulador conectado. A consulta precisou executar fora do sandbox porque o ADB não conseguia acessar sua configuração local.

Os testes usam respostas compatíveis com o contrato lido, não uma sessão Firebase real de homologação. A exportação JavaScript/Hermes não comprova compilação ou execução nativa em aparelho.

## Homologação ainda pendente

- [ ] Confirmar backend da PR #62 com migração `021-roteiro-operacional.sql` na API de homologação e registrar seu commit efetivo.
- [ ] Com sessão Firebase de motorista proprietário, consultar status, roteiro e painel da mesma viagem. Comparar integralmente a sequência e todos os passageiros nas quatro modalidades e nos dois sentidos.
- [ ] Alterar cadastros depois da partida e conferir que o mapa continua usando o snapshot; encerrar e iniciar outra execução no mesmo dia e conferir o progresso zerado.
- [ ] Exercitar viagem antiga sem snapshot (409), snapshot indisponível (503), autorização negada, perda de rede e recuperação, sem carregar rota parcial ou geometria de outra execução.
- [ ] Validar a chave Mapbox do build distribuído, o limite de waypoints e pontos coincidentes no provedor real. Roteiros acima do limite ficam bloqueados até existir suporte a fracionamento seguro.
- [ ] Compilar/instalar o app em dois Androids e verificar GPS real, chegada sequencial, retomada, background, fonte grande, passageiros compartilhados, extremos e integração motorista/passageiro. Não há dispositivos conectados para esse aceite nesta sessão.

Sem merge, deploy, publicação de APK ou alterações no backend. Esta evidência substitui, para a montagem do mapa, a referência anterior a `/rota/otimizar` no documento de estabilização de 16/11.
