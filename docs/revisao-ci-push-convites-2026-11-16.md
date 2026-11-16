# Revisão de CI, push Android e convites

Execução local: **15/11/2026**, America/Sao_Paulo. O nome deste arquivo foi mantido
com a data solicitada no pedido. Base inicial conferida: `b490d41`, `main` limpa
e igual à referência local `origin/main`. Não houve troca/merge de branches,
push, deploy, EAS Build, APK, execução do backend ou alteração no webapp/backend.

## Diagnóstico inicial e fontes

Foram lidas integralmente as issues #7, #32 e #16 e seus comentários. A inspeção
confirmou que já existiam 110 testes, central in-app, registro Android, convites
com fragmento e tratamento básico de compartilhamento; esses módulos foram
aproveitados. Contratos reais consultados por leitura no GitHub:

- [Notificações e dispositivos](https://github.com/pethersonzada/bevans-backend/blob/main/docs/notificacoes-api.md).
- [Convites de excursão](https://github.com/pethersonzada/bevans-backend/blob/main/docs/excursoes-convites-api.md).

Problemas identificados e cobertos pelas correções/regressões:

1. Não havia workflow do frontend. A configuração Expo também importava
   `dotenv/config` sem respeitar a flag usada para exportar sem `.env`.
2. Registro, renovação e logout usavam caminhos separados, permitindo corrida
   entre um POST de dispositivo e sua revogação. A renovação só era observada
   enquanto a tela de preferências estivesse aberta.
3. IDs de instalação antigos não tinham dono do token nativo persistido. Era
   necessário migrar esse caso sem transferir token entre contas, o que o backend
   proíbe inclusive depois de uma revogação.
4. Revogação manual falhando na rede não garantia tentativa independente de
   invalidar o token nativo; ações tardias e limpeza pendente precisavam de trava.
5. Abertura usava o identificador da entrega do sistema, em vez do ID do aviso,
   e não consultava o recurso de destino antes de navegar. Registro de dispositivo
   aceitava HTTP 2xx sem confirmar a instalação ativa no DTO da resposta.
6. Na central, a pausa de polling por rede podia manter carregamento indefinido
   sem erro em uma abertura offline. Preferências com erro bloqueavam o histórico.
7. O convite ficava apenas no estado do editor e se perdia ao sair da tela. A
   tentativa seguinte não revalidava revogação/expiração e poderia emitir outro
   token após um resultado desconhecido de criação.

## #7 — CI implementado

Workflow `.github/workflows/frontend.yml` em push para `main` e pull requests
destinados à `main`. Node 22 compatível com o engine do React Native instalado,
`npm ci`, cache npm pelo lockfile, `npm run check` e `npm run bundle:android`.
Permissão somente `contents: read`, checkout sem persistir credenciais, Actions
fixadas por SHA, timeout e cancelamento de execução anterior da mesma referência.

O job não usa `pull_request_target`, secrets, deploy, artifacts públicos, EAS ou
compilação nativa. Exporta com `EXPO_NO_DOTENV=1` e `EXPO_OFFLINE=1`; o carregamento
explícito de dotenv no `app.config.js` agora respeita essa configuração. O fluxo
normal de desenvolvimento continua carregando `.env`. Instruções locais em
[ci-frontend.md](ci-frontend.md).

**Não há aprovação remota observada do novo workflow:** ele permanece local,
pois não foi feito push. Branch protection e configurações remotas não mudaram.

## #32 — Notificações e Android

- Fila única para registro, renovação e revogação; ativação concorrente é
  compartilhada, e token inalterado não gera escritas duplicadas indevidas.
- Sessão e geração verificadas antes/depois das operações assíncronas. Logout
  cancela ativações/renovações antigas, aguarda a operação em voo e tenta revogar
  antes de encerrar Firebase. Logout repetido é agrupado. Não encerra uma nova
  identidade Firebase que tenha surgido durante a limpeza.
- Identificador de instalação por usuário, consentimento e dono do token são
  metadados locais; o token FCM bruto não é salvo em AsyncStorage pelo código.
  O SDK nativo gerencia seu próprio token. IDs antigos sem dono passam por rotação.
- Revogação remota tem timeout de cinco segundos. Falha remota preserva o ID para
  nova tentativa autenticada pelo titular, mas ainda tenta invalidar o token nativo.
  Falha nativa mantém marca de limpeza pendente; outra conta não é preparada para
  push enquanto essa limpeza não concluir. Não há transferência de IDs/tokens.
- Canal Android `operacional`/Viagens, visibilidade privada na tela bloqueada e
  defaultChannel no plugin. Permissão pedida somente após ação explícita.
- Renovação observada no ciclo autenticado, inclusive fora das preferências,
  na retomada do app e reconexão; lê o token nativo atual, sem reutilizar conteúdo
  de um evento antigo. Não solicita permissão novamente para renovar.
- Permissão revogada em uma instalação consentida remove consentimento e tenta
  revogar o registro. Preferência informativa/operacional da conta continua
  separada da permissão deste aparelho. A central não depende de push autorizado.
- DTO do POST deve confirmar o mesmo `instalacaoId`, ID válido e `ativo=true`.
  Não se apresenta registro confirmado se a resposta estiver divergente.
- Abertura deduplicada por `notificacaoId`, isolada por conta e ignorada após
  desmontagem. A última resposta nativa é limpa ao trocar de conta. O payload não
  decide ID de viagem, rota, URL nem autorização: a central busca o aviso próprio
  e consulta o destino autorizado antes de navegar. Aviso histórico mantém o ID
  daquela execução, sem saltar para uma viagem atual diferente.
- Feed com leitura/não leitura, feedback, contexto em linguagem humana, preferências
  independentes e atualização de contador após leitura/recebimento. Offline tem
  mensagem explícita, preserva informações anteriores como potencialmente antigas
  e não fica somente em spinner. Voltar continua disponível. Ações de rede aguardam
  reconexão; revogação do aparelho continua acessível para tentativa de limpeza.
- Novas ações da central usam áreas mínimas de 48 e estados de acessibilidade.

Nenhum worker/FCM foi habilitado no backend e não houve envio real. A proteção
de conteúdo de push depende também do contrato: mensagem genérica e somente
`notificacaoId`, sem residências, nomes de menores, JWT ou credenciais na tela
bloqueada. O aplicativo não registra esses segredos em logs.

## #16 — Convites e futura inscrição web

O aplicativo continua usando POST/GET/DELETE de convites existentes. A página
operacional de inscrição permanece responsabilidade do **webapp #14**.

- Cache apenas em memória, vinculado à sessão Firebase, com um convite recém-gerado
  por excursão. Sair e voltar à tela recupera o link enquanto o processo e a sessão
  permanecerem abertos; logout/troca de conta elimina segredos e respostas tardias.
- Emissão concorrente compartilha a mesma requisição. A página HTTPS configurada
  é validada antes de emitir; não é inventado domínio/IP nem criada credencial local.
- Reutilização/cópia/compartilhamento reconsultam excursão e metadados do convite.
  Revogado, expirado, removido, partida ocorrida ou excursão indisponível não libera
  link. Falha transitória de leitura preserva a única cópia do token em memória.
- O token vai apenas no fragmento da URL. Não é enviado na query/path da API,
  persistido em AsyncStorage ou incluído em listagens. A listagem é normalizada
  para metadados permitidos, mesmo que uma resposta acrescente campos inesperados.
- Copiar é ação explícita para o clipboard do sistema. Compartilhamento cancelado
  ou falho não afirma envio: há mensagem de convite criado/pendente e retry sem
  emitir outro token. `sharedAction` também não é prova de entrega ao destinatário.
- Revogação confirmada esquece o segredo correspondente. A lista distingue
  Emitido/Expirado/Revogado, informa quando o link não é recuperável na sessão e
  permite atualizar metadados manualmente.
- Timeout/falha após POST com resultado desconhecido bloqueia repetição automática.
  O motorista deve conferir e revogar convites sem link; uma nova emissão exige
  revisão/confirmação explícita. Como o backend guarda somente hash e não oferece
  idempotência de emissão por chave, o frontend não consegue reconstruir um token
  cuja resposta nunca chegou. Esse limite não foi ocultado por um sucesso fictício.

`EXPO_PUBLIC_CONVITE_WEB_URL` precisa conter a **página HTTPS operacional real**,
sem query ou fragmento prévios. Até sua definição e validação junto ao webapp,
a UI informa a dependência e não emite tokens sem destino configurado. Nenhuma
segunda página web ou credencial individual de inscrição foi criada no aplicativo.

## Arquivos alterados

| Responsabilidade | Arquivos |
| --- | --- |
| CI | `.github/workflows/frontend.yml`, `package.json`, `app.config.js`, `docs/ci-frontend.md`, `tests/ci-config.cjs` |
| Push/sessão | `src/services/push.ts`, `src/services/aberturaPush.ts`, `src/contexts/AuthContext.tsx`, `src/components/AberturaPush.tsx`, `src/components/PreferenciaPush.tsx` |
| Central | `src/services/notificacoes.ts`, `src/app/notificacoes.tsx`, `src/components/AtalhoNotificacoes.tsx`, `src/hooks/useNotificacoesRevision.ts` |
| Convites | `src/services/convitesCompartilhamento.ts`, `src/services/excursoes.ts`, `src/app/editar-excursao.tsx`, `src/components/GestaoExcursao.tsx` |
| Regressões | `tests/push-notificacoes.cjs`, `tests/convites-compartilhamento.cjs`, `tests/frontend-regressions.cjs`, `tests/integracao-modulos.cjs`, `tests/excursao-usabilidade.cjs` |

Este relatório também foi adicionado. `.env`, lockfile, configurações EAS,
arquivos nativos, backend e webapp não foram modificados.

## Testes e resultados

- `npm ci --no-audit --no-fund`: instalação reprodutível aprovada, 781 pacotes.
- `npm run check`: arquitetura, TypeScript e **135 testes aprovados** (110 na base).
- `git diff --check` e conferência do diff dos commits locais: aprovados.
- YAML analisado com parser já disponível; eventos, permissão mínima e sequência
  instalar/check/bundle conferidos. Nenhuma ferramenta de CI adicional instalada.
- Exportação Android local com dotenv desativado e modo offline, via
  `npm run bundle:android`, gerou bundle Hermes em `.expo/ci-android`.
- Sem scripts de ESLint/formatação adicionais no projeto; não foram inventados
  resultados nem desabilitadas verificações existentes.

Testes adicionados cobrem registro duplicado, conta mudando durante registro,
logout concorrente, revogação offline, falha de limpeza nativa, migração antiga,
permissão negada/revogada, token inválido/renovado, confirmação do DTO, deduplicação,
aviso de viagem encerrada, destino sem autorização e central offline. Convites
cobrem configuração ausente, emissão concorrente, recuperação, erro após criação,
expiração, revogação, resultado desconhecido, isolamento e metadados sem segredo.
Os testes anteriores de cancelamento/falha de compartilhamento foram preservados.

## Commits funcionais

| Hash | Responsabilidade |
| --- | --- |
| `cc96b40` | Workflow e documentação de CI |
| `7917c88` | Isolamento, registro e revogação Android |
| `6317755` | Central e revalidação de destinos |
| `84d8b54` | Migração antiga e retomada por rede |
| `69083a0` | Recuperação de convites e proteção contra emissão repetida |
| `db8cdea` | Configuração sem dotenv no CI |
| `0213f95` | Confirmação da instalação ativa na resposta |
| `91a207c` | Estado offline sem carregamento indefinido |

O commit do relatório é separado do código. A entrega deixa nove commits locais
à frente de `origin/main`, sem push. Issues #7/#32/#16 recebem progresso, evidências
e pendências, sem fechamento ou marcação de aceite externo.

## Como validar Android em aparelho real

1. Confirmar API HTTPS de homologação, dados/contas de teste e projeto Firebase
   isolado. Configurar variáveis públicas do cliente para o mesmo projeto de teste
   usado pelo backend e pelo Firebase nativo, sem chaves Admin no bundle.
2. Obter o `google-services.json` real da aplicação Android `com.bevans.app` no
   projeto de teste. Definir `GOOGLE_SERVICES_JSON` com seu caminho local, sem
   fabricar arquivo, publicar valores ou inserir o arquivo no workflow.
3. Aplicar os config plugins e recompilar o development build Android. A pasta
   `android/` existente é ignorada pelo Git: preservar customizações locais antes
   de aplicar prebuild. Expo Go e um binário antigo não comprovam os módulos e o
   defaultChannel recém-configurados. Não foram executados prebuild/build/APK aqui.
4. Instalar o build em aparelho com serviços Google compatíveis. Registrar modelo,
   Android, versão/build, ambiente e horário, sem JWT, token FCM ou dados pessoais.
   Validar central antes de permitir push; negar permissão deve manter o histórico.
5. Permitir notificações pela ação explícita. Conferir canal Viagens, permissão
   Android e confirmação do registro. Não copiar token para logs/issues. Rotação
   nativa deve atualizar a mesma instalação do usuário, sem novo prompt indevido.
6. Somente o operador autorizado habilita worker/FCM **na homologação** após configurar
   Firebase Admin real desse projeto. Exercitar eventos operacionais existentes,
   sem inventar eventos. Não ativar `app.push.enabled` ou worker em produção.
7. Receber avisos em foreground, background e app fechado. Conferir lockscreen
   genérica, deduplicação, central, contador, leitura, execução encerrada, recurso
   removido e permissão revogada, sempre com revalidação do destinatário/recurso.
8. Testar conta A → logout online → conta B; repetir com registro/renovação em voo,
   rede offline e reconexão. Conferir novo token/ID para outra conta sem revelar
   seus valores. Em falha de revogação, voltar ao titular e usar Revogar novamente.
9. Testar falha nativa de limpeza: outra conta deve aguardar correção/retry da
   limpeza. Não contornar a proteção por transferência de token ou ID antigo.

## Como verificar o workflow após push manual

Após o usuário realizar push manual autorizado, abrir Actions → Validação do
frontend e conferir evento, branch e SHA. Aguardar instalação, arquitetura/tipos/
testes e bundle terminarem com sucesso; guardar o link da execução. Conferir
também o evento de PR destinado à `main`. Uma falha deve interromper o job.
Não há CI remoto aprovado desta entrega enquanto isso não ocorrer. Tornar o
check obrigatório em branch protection exige configuração remota separada.

## Pendências e riscos restantes

- **Não executados:** FCM real, testes em dispositivos, APK/iOS, EAS, E2E remoto e
  execução remota do novo workflow. Push iOS continua dependência separada.
- Falha de limpeza de um token antigo pode impedir preparar a conta seguinte;
  é uma proteção deliberada, com retry após corrigir configuração/rede nativa.
- Revogação remota offline continua pendente; o código tenta limpeza nativa, mas
  não afirma sucesso quando ela falha. Notificação já entregue ao SO ou envio em
  trânsito não pode ser recolhido com garantia; validar o conteúdo genérico real.
- Tokens de convites se perdem se o processo fechar ou a sessão mudar. O contrato
  permite revogar/emitir outro, não recuperar o segredo do hash. Resultado incerto
  de POST requer revisão manual; idempotência de emissão seria melhoria de backend.
- Um link já copiado/compartilhado está fora da memória controlada pelo aplicativo;
  acesso continua sujeito à expiração/revogação no servidor.
- Webapp #14 precisa implementar/validar a página real, ler o fragmento local e
  enviar `X-Convite` no header. Convite não substitui `X-Inscricao` individual nem
  concede GPS, administração ou informações de terceiros.

As três issues permanecem abertas até as respectivas evidências externas.
