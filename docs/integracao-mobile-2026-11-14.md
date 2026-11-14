# Integração mobile — 14/11/2026

## Estado e fonte de verdade

Implementação local na `main`, sem push, deploy, EAS ou publicação. O backend
local consultado está limpo e exatamente em `a89141d`, conforme solicitado.
Foram consultadas as issues abertas/fechadas do frontend e comentários,
issues de integração do backend e webapp #14, além dos contratos de `docs` e
DTOs/controllers reais do backend. Não foram criados endpoints ou dados fictícios.

O diretório iniciou limpo em `fix/address-draft-stabilization`. `git fetch origin`
confirmou `main` igual a `origin/main`; a branch anterior tinha três commits
descendentes. Foi preservada, e seus commits foram incorporados à `main` por
fast-forward, reutilizando editor, capacidade e correções existentes.

## Funcionalidades e arquivos principais

| Área | Código integrado | Evidência e limite |
| --- | --- | --- |
| Navegação | `(tabs)/_layout.tsx`, `rotas.tsx`, `excursoes.tsx` | Início, Rotas, Excursões e Perfil; ícones, seleção, safe area e histórico de retorno Android. Teste automatizado da estrutura; falta aparelho. |
| Home | `home-passageiro.tsx`, `home-motorista.tsx`, `AtalhosTurma`, `PresencaTurma` | Preserva seleção de turma, presença e fluxo existente; atalhos de coleta/controle e central. Presença por paradas não exige endereço no sentido configurado. |
| Catálogo | `CatalogoRotas`, `catalogo.ts`, `detalhe-rota.tsx`, `embarques.ts` | Filtros por cidade/categoria/destino, paginação, favoritas persistidas, detalhes/paradas/horários; vínculo e pedido por data/sentido, pin confirmado em FLEXIVEL, histórico próprio. |
| Motorista de rota pública | `rotas-publicas.tsx`, `editar-rota-publica.tsx`, `PedidosRota` | Reutiliza criação/edição/publicação, mapa e capacidade anteriores; análise de pedidos e início autorizado de viagem pelo fluxo existente. |
| Excursões | `excursoes.ts`, `editar-excursao.tsx`, `GestaoExcursao` | Lista própria, criação/edição/publicação/cancelamento, origem/destino, três modos, pins/ordem/horários, reposicionamento, reservas/confirmados, convite/compartilhamento/revogação, prévia OR-Tools e início/fim IDA/VOLTA. API arbitra versões e conflitos. |
| Passageiro de excursão | tab Excursões | Estado explicativo por convite; contrato atual não lista excursões por conta Firebase. Inscrição e credencial individual permanecem no webapp #14; nenhuma lista inventada. |
| Operação | `controle-viagem.tsx`, `operacoes.ts` | Painel compartilhado por VIAGEM/EXCURSAO, contadores oficiais, própria confirmação, embarque/desembarque, ausência e correção do motorista com motivo/versão; releitura após ação/conflito. GPS não confirma embarque. |
| GPS | `rastreamento.ts`, `RastreamentoViagem`, `viagens.ts`, `passageiroHome.ts`, `telemetria.ts`, `mapa.tsx` | Migração do legado 410 para viagem/execução, precisão e timestamp reais, TTL local de 30s, invalidação em falha/blur/background, pausa por foco/rede, permissão negada/revogada e término. Polling autorizado de 10s, escolhido como alternativa contratual ao SSE. Logs de GPS, roteiro e participantes removidos do mapa. |
| Coleta privada | `coleta-privada.tsx`, `coletaPrivada.ts` | Modos por turma/sentido, pins, edição/ordem/reposicionamento, escolha persistida, sugestão pelo endereço próprio e resultado da API, mapa pré-viagem e acesso à execução. Não publica residências nem mistura entidades. |
| Notificações | `notificacoes.tsx`, `notificacoes.ts`, `AtalhoNotificacoes`, `AberturaPush` | Central paginada, leitura, contador e preferências; contexto derivado do histórico autenticado. Push contém somente ID, que não é tratado como autorização de viagem. |
| Push Android | `push.ts`, `PreferenciaPush`, `AuthContext`, `app.config.js` | Expo Notifications nativo, permissão, token FCM Android, instalação por conta, renovação em foco e revogação/logout com invalidação local do token. Nunca usa Expo push token ou APNS como FCM. |
| Perfil/contato | `contato-comercial.tsx`, `contatoMotorista.ts`, `ContatoProtegido`, `perfil.tsx` | Opt-in e versão do contato comercial; WhatsApp somente pelo endpoint protegido. Telefone pessoal aninhado não é usado. Preferências acessíveis no Perfil. |
| Conta/ambientes | `config.ts`, `api.ts`, `conta.ts`, `login.tsx` | Ambientes separados, HTTPS para staging/production, timeout/rede/401/403/404/409/503. Exclusão 202 aparece como processamento pendente; 409 mantém sessão. Sem estado falso de Firebase apagado. |

Os DTOs privados do perfil próprio continuam sendo consumidos via serviço de
sessão existente; relações minimizadas não são utilizadas para descobrir telefone.
Não foi criada área de rastreamento de dependentes sem comprovação legal.
Não foi criado tema dinâmico; o tema existente foi preservado.

## Commits

| Commit | Entrega |
| --- | --- |
| `85d6968` | Correções de endereço já existentes, preservadas |
| `bf2631f` | Capacidade por turma já existente, preservada |
| `34c55c7` | Editor de rota urbana já existente, preservado |
| `a38c276` | Navegação, catálogo e operação inicial de excursões |
| `154a63c` | Ambientes e exclusão pendente da conta |
| `d371880` | Central de notificações e contato comercial protegido |
| `bda4779` | Paradas privadas e GPS autorizado por viagem |
| `6aea50a` | Solicitações e análise de embarques públicos |
| `0fffad3` | Reservas, convites e prévias de excursões |
| `6765738` | Rascunhos, encerramento de push e testes de integração |
| `e05a95d` | Início autorizado de viagens pela área de rotas |

O commit deste relatório é identificado no histórico local pelo título.
Ao encerrar esta entrega,
`main` fica 12 commits à frente de `origin/main`: três preservados e nove novos.

## Testes e revisão

- `npm run check`: arquitetura aprovada, TypeScript aprovado e **90 testes aprovados**.
- `tests/frontend-regressions.cjs` preservado e ampliado para o contrato de exclusão.
- `tests/integracao-modulos.cjs`: tabs, catálogo/filtros, favoritos, pedido por
  data/sentido, convites seguros, operação/versionamento, isolamento de ambientes,
  TTL GPS, paradas privadas, notificações, WhatsApp protegido, FCM/permissões,
  troca de sessão e respostas tardias, papel passageiro e persistência de ordem.
- Os testes anteriores continuam cobrindo autenticação/expiração, polling,
  background/rede, ausência de sessão, timeout, cancelamento e respostas inválidas.
- `git diff --check`: sem erro de whitespace na revisão.
- Exportação local Android com Metro/Hermes concluída em `.expo/verification-android`;
  é verificação de empacotamento JavaScript, não compilação de APK nem execução nativa.
- `adb devices -l`: lista vazia. Nenhum teste de interface em aparelho/emulador foi feito.

Na revisão foram corrigidos o endpoint GPS legado com resposta 410, logs de dados
privados no mapa, posição antiga mantida após falha, expectativa antiga de DELETE
200 e perda silenciosa de rascunho na atualização de versão concorrente. As
verificações automatizadas finais não detectaram regressões; isso não comprova
ausência de regressões em execução real.

## Issues

Progresso, hashes, testes e limites registrados nas issues do frontend
**#16, #19, #20, #26, #27, #28, #29, #30, #31, #32 e #33**. Nenhuma foi fechada
ou teve aceite externo marcado. Backend #46/#47/#48 e webapp #14 continuam sendo
dependências de integração, sem alterações nesses repositórios.

## Pendências para aceite real

1. Confirmar URL HTTPS de homologação isolada e preencher
   `EXPO_PUBLIC_APP_ENV=staging` e `EXPO_PUBLIC_API_URL_STAGING`. O `.env` existente
   foi preservado e seu domínio não foi presumido como homologação. Ver
   [ambientes-mobile.md](ambientes-mobile.md).
2. Definir a página real de inscrição do webapp em `EXPO_PUBLIC_CONVITE_WEB_URL`,
   confirmar o fragmento esperado e realizar cadastro/consulta/cancelamento E2E.
3. Configurar o arquivo Android Firebase do ambiente de testes por
   `GOOGLE_SERVICES_JSON` (caminho local), aplicar config plugins em development
   build e recompilar o aplicativo nativo. O diretório Android existente não foi
   regenerado e não foi criado APK/EAS. Sem essa etapa, não prometer registro FCM
   no binário já instalado. Não usar credenciais Admin no bundle.
4. Push iOS precisa de integração FCM nativa; este incremento não implementa a
   conversão APNS/FCM. A central in-app funciona independentemente dessa etapa.
5. Validar push Android real: foreground/background/app fechado, renovação,
   logout e troca de conta. Servidor FCM/worker permanece desativado; nenhum
   envio foi validado. Logout offline não comprova revogação remota, embora
   tente invalidar o token nativo; a instalação pendente é mantida para retry.
6. Validar navegação, voltar Android, telas pequenas, mapas/pins/arraste,
   múltiplas turmas e IDA/VOLTA, concorrência e autorização em dois dispositivos.
7. Validar GPS real, permissão revogada, rede intermitente, TTL após pausa,
   bateria, cancelamento/finalização com embarcados e reconexão no proxy remoto.
   SSE não foi implementado: o aplicativo usa o fallback de polling previsto
   no contrato. Background GPS não é prometido.
8. Exercitar a jornada completa motorista → rota/excursão → aprovação → execução
   → embarque/desembarque → notificação, junto de passageiro e webapp, contra
   dados de teste. Compilação, mocks e CI não substituem esse aceite.

A instalação do módulo Expo Notifications informou 13 vulnerabilidades no
conjunto de dependências (5 moderadas/8 altas). Não foi executado `npm audit fix`
ou atualização forçada; esse relatório do npm não foi investigado como parte
da integração e não permite atribuir a origem ao módulo instalado.

Nenhuma URL, credencial, serviço de produção ou autorização foi inventada.
