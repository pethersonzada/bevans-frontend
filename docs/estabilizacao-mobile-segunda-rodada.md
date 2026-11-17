# Segunda rodada de estabilização

Branch: `estabilizacao-rotas-mobile-20261116`, PR #47. Base preservada: `69b6872`.

## P1: correções implementadas

| Issues | Problema e causa | Correção e arquivos | Evidência | Aceite pendente |
|---|---|---|---|---|
| #37, #28 | Erro de rede na consulta GPS apagava o estado ATIVA já confirmado. Respostas contraditórias e IDs negativos eram aceitos. | `passageiroHome.ts`: mantém ATIVA/AGUARDANDO em falha de transporte do GPS; propaga erro de autorização; recusa estados contraditórios e IDs negativos. Não converte strings de coordenadas em números. | Regressões de rede, timeout, sessão, estado contraditório e ID negativo em `frontend-regressions.cjs`. | Movimento, background, expiração de posição e reconexão nos dois aparelhos. |
| #37, #45 | Turma removida podia manter a seleção antiga indefinidamente; falha atrasada do radar não conferia a turma atual. Estado da Home não era explicitamente limpo ao trocar conta. | `home-passageiro.tsx`: seleção volta à primeira turma disponível; revisão da requisição já protege trocas concorrentes; erro do radar confere turma; mudança de conta limpa dados e invalida requisições/timers. | TypeScript e inspeção do ciclo de revisão existente. A Home completa não tem novo teste de montagem nesta rodada. | Troca real de conta/turma, vínculo removido durante uso e resposta atrasada. |
| #28, #45 | Atalho de acompanhamento aceitava qualquer ID truthy e não distinguia erro de consulta. | `AtalhosTurma.tsx`: exige inteiro positivo; mostra consulta e erro distintos. | Teste de IDs negativos, zero, fracionário, string, nulo e válido em `ux-navegacao.cjs`. | Acompanhamento autorizado no aparelho. O atalho “Meu embarque” ainda aponta à coleta privada; identificação pública no contexto da turma permanece pendente. |
| #39, #16 | Prévia de excursão podia aplicar resultado de outra excursão; retorno vazio não produzia feedback. | `GestaoExcursao.tsx`: confere contexto e montagem antes de aplicar resultados/erros; limpa prévia ao mudar contexto; informa roteiro vazio. | Teste com promessa atrasada após troca de ID e retorno vazio em `excursao-usabilidade.cjs`. | Integração backend #62, horários, prévia após execução e ciclo IDA/VOLTA completo. |
| #43, #30 | Editor substituía todo 409 por versão genérica; ação de descarte aparecia no fluxo normal e competia com Continuar/Salvar. | `PlanejarRotaPublica.tsx`: preserva mensagem da API; oferece revisão após conflito; decisão em página própria, sem footer de edição; falha de leitura preserva rascunho. | Regressões de mensagem específica, conflito e preservação do rascunho após falha de reload em `rota-publica-planejamento.cjs`. | Edição simultânea em duas sessões e publicação real. O cliente não torna transacionais os dois endpoints de gravação. |
| #43, #44 | Início de trecho sem horário configurado ficava disponível. | `PlanejarRotaPublica.tsx`: bloqueia trecho sem horário salvo e explica a configuração necessária. | Teste IDA habilitada/VOLTA sem horário bloqueada. | FIXA/FLEXÍVEL com aprovações reais; início pela Home e gestão. |
| #41 | Geocodificação completa pode retornar rua como aproximação; cliente rotulava tudo como estabelecimento. Ausência de chave POI era silenciosa. | `enderecoSearch.ts`: descarta tipo explícito diferente de amenity. `EnderecoSearchInput.tsx`: informa indisponibilidade de estabelecimentos quando chave não está configurada, mantendo busca de endereço e pin. | Regressão de rua versus estabelecimento. Consultas reais HTTP 200: ETE Cícero Dias, UFPE e Praça Duque de Caxias/Bezerros retornaram amenity. Hospital Jesus Pequenino/Bezerros retornou vazio. | Cobertura de outras localidades, chave e limites do provedor no aplicativo distribuído. |

## P2: seletor

#42: a seleção pública informa que é necessário selecionar e confirmar o ponto no mapa antes de habilitar “Usar este ponto”. Preservados estilo e comportamento do picker da rodada anterior. O teste existente exercita candidato ausente e confirmado. Teclado, leitor de tela, fonte grande e Safe Area exigem aparelho.

## P0: correções preservadas e limites

#38/#40: mantidos isolamento por execução/turma/sentido, assinatura da geometria e conferência com a operação. Não houve nova alteração nessas regras. Testes de roteiro continuam aprovados. O aceite de segunda execução no mesmo dia, embarques obrigatórios e IDA/VOLTA continua pendente no Android.

#44: snapshot ativo e extremos públicos da rodada anterior preservados. Não há evidência HTTP autenticada nova de todos os embarques/endereços nem de otimização FLEXÍVEL completa; não declarar issue encerrada.

#16: a busca no backend `main` continua mostrando `/excursoes` protegido para motorista. Não foi identificado contrato de listagem de inscrições próprias por conta passageira nesta inspeção. Mantido acesso por convite; nenhuma associação por email foi inventada.

Backend PR #62 continua aberta como rascunho. Nenhuma API ou configuração de produção alterada. Nenhuma issue fechada. #45 permanece gate de aceite em dois Androids.

## Validação local

- `npm ci`: 781 pacotes instalados pelo lockfile.
- `npm run check`: arquitetura, TypeScript e **223 testes aprovados** (216 na base).
- `npm run bundle:android`: exportado para `.expo/ci-android`, com configuração de CI sem credenciais.
- `git diff --check`: aprovado.
- Consultas de POI somente de leitura; não foram exibidas chaves.
- Não houve teste em aparelhos nem sessão autenticada de homologação nesta rodada.

## Checklist nos dois Androids

1. Confirmar API/turma idênticas; confirmar IDA, VOLTA e AMBOS com endereços distintos; iniciar segunda execução no mesmo dia e verificar todos os waypoints.
2. Iniciar viagem sem GPS, desconectar rede, retomar, expirar localização e encerrar; distinguir viagem ativa sem posição de viagem encerrada.
3. Trocar conta/turma e remover vínculo durante consulta; impedir retorno de dados antigos.
4. Editar/publicar rota em duas sessões, provocar conflito e falha de reload; manter rascunho e mensagem específica. Validar horários e FIXA/FLEXÍVEL.
5. Após compatibilidade backend, criar/publicar excursão, consultar/otimizar roteiro, iniciar/encerrar IDA e VOLTA e consultar roteiro salvo.
6. Buscar ETE/escola/praça/hospital em Pernambuco e confirmar pin manual quando a busca vier vazia; verificar teclado, acessibilidade e bordas Android.
