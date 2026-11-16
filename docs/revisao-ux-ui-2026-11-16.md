# Revisão de UX/UI do BeVans — 16/11/2026

Implementação exclusiva em `C:\dev\bevans-frontend`, branch `main`, a partir
de `850b686`. Backend e webapp apenas consultados. Sem push, deploy, EAS Build,
instalação de biblioteca, alteração de endpoint ou substituição de serviço real.

## Diagnóstico e direção visual

O aplicativo já tinha uma linguagem consistente em login, perfil e cards das
turmas: azul `theme.colors.primary`, superfícies claras, cantos arredondados,
Ionicons, títulos fortes e ações com ícones. As funcionalidades recentes usavam
vários `Button` nativos, títulos sem hierarquia, controles consecutivos e links
fora dos grupos. A própria tela inicial tinha dois acessos com sentidos distintos
para notificações: um botão adicionado acima da tela e um sino de solicitações.

A revisão reutiliza tema, Ionicons, seletor de datas, mapas, feedback e serviços.
Não introduz outra identidade visual. Componentes de interface compartilhados:
`Screen`, `Section`, `ActionButton`, `IconButton`, `Field`, `Choice`, `MenuRow`,
`Steps`, `Notice`, `Pagination` e `RemoteLoading`. Ações primárias, secundárias e
destrutivas têm tratamentos distintos; controles têm altura mínima de 48 px,
texto pode quebrar e as páginas usam safe areas e largura máxima de conteúdo.
Campos permanecem com labels visíveis, sem depender apenas do placeholder.

## Organização implementada

| Área | Fluxo e responsabilidade |
| --- | --- |
| Turmas privadas | Aba principal mantém seleção, participantes, solicitações e operação. O botão Configurar da turma abre a nova tela de configurações. |
| Configurações da turma | Dados/capacidade e coleta/trajetos em entradas próprias. Ida e volta continuam independentes na coleta. Passageiro conserva Meu embarque, sem acesso de edição do motorista. |
| Rotas públicas | Listagem dos serviços, estado vazio útil e ação Criar rota pública. A criação começa por identidade, não por uma turma. |
| Cadastro da rota | Dados → Trajeto → Horários → Capacidade. Origem/destino públicos são selecionados explicitamente; paradas mantêm ordem e coordenadas confirmadas. |
| Rota salva | Capacidade, Publicação e Operação separadas. Salvar não publica; alterações não salvas bloqueiam publicação/operação como antes. Prévia solicitada conduz à etapa Trajeto. |
| Catálogo e detalhe | Pesquisa agrupada, categorias selecionáveis, cards, favoritas e horários legíveis. Vínculo com a rota e pedido de embarque continuam ações distintas. |
| Notificações | Sino no cabeçalho de cada papel, com contador de não lidas. Central contém histórico, leitura, estados vazios/offline e destino autorizado. |
| Preferências | Engrenagem dentro da central abre uma tela própria: recebimento da conta e registro/revogação do aparelho separados. Não há atalho de preferências no perfil. |
| Perfil | Identificação, dados pessoais, conta, endereços quando aplicáveis, contato comercial do motorista, segurança, suporte e saída com confirmação. |
| Contato comercial | Tela própria, explicação de privacidade, telefone, disponibilidade e aceite explícito. Feedback de sucesso permanece após recarregar; gravação protegida contra duplo toque. |
| Excursões | Listagem e estados vazios; gestão em Dados, Embarques, Publicação, Convites, Participantes e Execução. |
| Dados de excursão | Seleção de pontos abre sob ação explícita; origem opcional começa recolhida. Datas, capacidade e salvamento continuam com validação real. |
| Publicação da excursão | Resumo da versão salva no servidor, aviso de rascunho e bloqueio da publicação enquanto houver alterações locais pendentes. IDs de paradas confirmados pelo servidor são incorporados após salvar. |
| Participantes/convites | Telas por seção e consultas independentes: falha em uma não bloqueia a outra. Confirmação de reserva, paginação, recuperação/revogação e avisos de validade preservados. |
| Execução da excursão | Início por sentido, encerramento confirmado, prévias e acesso ao controle de embarque. O painel operacional existente e suas regras foram preservados. |

O antigo sino de solicitações do motorista passou a abrir a central geral.
As solicitações de entrada continuam acessíveis em uma entrada contextual da
turma, com seu contador e o mesmo fluxo de aprovação/rejeição. O atalho solto
para Rotas Públicas foi removido da tela de turmas; a aba própria é o acesso.

## Contratos e funcionalidades preservados

Contratos lidos no backend, sem qualquer alteração:

- [Rotas públicas](https://github.com/pethersonzada/bevans-backend/blob/main/docs/rotas-publicas-api.md).
- [Coleta privada](https://github.com/pethersonzada/bevans-backend/blob/main/docs/turmas-coleta-api.md).
- [Contato comercial](https://github.com/pethersonzada/bevans-backend/blob/main/docs/contato-motorista-api.md).

**Limite de rotas públicas:** a API exige `turmaId` para autorização, vínculos,
capacidade e execução; não permite trocá-lo na edição. A associação aparece na
etapa Capacidade, com seleção explícita de uma turma disponível do motorista.
Nenhuma turma é criada automaticamente. Nome, cidade, pontos e publicação são
da rota. Garagem/endereço privado não são copiados. Sem associação disponível,
a interface explica o impedimento; criação realmente independente exige backend.

Registro/renovação/revogação de push, limpeza nativa, isolamento entre contas,
logout, reconexão e abertura autorizada não tiveram seus serviços modificados.
O pedido de permissão continua dependendo de ação explícita. Preferências de
envio não removem o histórico. A navegação pela central mantém as verificações
do aviso e do recurso antes de marcar leitura e navegar.

Convites mantêm token somente em memória/fragmento, revalidação, validade,
revogação e bloqueio de repetição após resultado desconhecido. A página pública
continua dependência do webapp #14. Não foi implementado formulário de inscrição
nem inventado domínio. Contato comercial continua condicionado a perfil,
consentimento e autorização do servidor, sem aproveitar telefone pessoal.

Nenhum arquivo em `src/services`, `src/config`, lockfile ou dependências foi
alterado por esta revisão. Dados de conta, exclusão, redefinição de senha,
suporte, endereços, mapas e confirmação de saída permanecem disponíveis.

## Arquivos por responsabilidade

| Responsabilidade | Arquivos principais |
| --- | --- |
| Componentes compartilhados | `src/components/ui/Primitives.tsx`, `PontoFormulario.tsx` |
| Turma e tela inicial | `configuracoes-turma.tsx`, `coleta-privada.tsx`, `home-motorista.tsx`, `home-passageiro.tsx`, `(tabs)/home.tsx`, `AtalhosTurma.tsx`, `cards/CardsTurmasMotorista.tsx`, `motorista/HeaderMotorista.tsx` |
| Central e preferências | `notificacoes.tsx`, `configuracoes-notificacoes.tsx`, `AtalhoNotificacoes.tsx`, `PreferenciaPush.tsx` |
| Perfil e contato | `(tabs)/perfil.tsx`, `contato-comercial.tsx`, `ContatoProtegido.tsx` |
| Rotas | `rotas-publicas.tsx`, `editar-rota-publica.tsx`, `detalhe-rota.tsx`, `CatalogoRotas.tsx`, `PedidosRota.tsx` |
| Excursões | `(tabs)/excursoes.tsx`, `editar-excursao.tsx`, `GestaoExcursao.tsx`, `SeletorDataHora.tsx` |
| Proteção de navegação | `src/app/_layout.tsx`: preferências autenticadas e configurações de turma exclusivas de motorista |
| Testes | `tests/ux-navegacao.cjs`, `excursao-usabilidade.cjs`, `frontend-regressions.cjs`, `integracao-modulos.cjs`, `push-notificacoes.cjs`, `helpers/ui.cjs` |

## Validação

- `npm run check`: arquitetura, TypeScript e **151 testes aprovados**, contra
  136 testes antes desta revisão. Sem Firebase ou backend de produção.
- Novas regressões: acesso central → preferências, preferências offline, sino
  com contador, acesso por perfil às configurações da turma, cadastro de rota
  começando pela identidade, rascunho preservado entre etapas, impedimento de
  salvar sem associação, ausência de criação automática de turma, consultas
  independentes da excursão, perfil/saída, consentimento e duplo toque no contato,
  loading offline, mapa opcional explícito e revisão da publicação com dados salvos.
- Testes anteriores de push, convites, mapas, segurança e operação passaram.
  Os adaptadores dos testes foram atualizados para os novos componentes visuais;
  os serviços reais do aplicativo não foram substituídos por mocks.
- `npm run bundle:android`: aprovado com `CI=true`, `EXPO_NO_DOTENV=1` e
  `EXPO_OFFLINE=1`. Hermes/assets em `.expo/ci-android`, sem build de APK/EAS.
- `git diff --check`: aprovado na configuração normal do repositório.
- Revisão React conforme skill `react-best-practices`: hooks no topo, rascunhos
  preservados, limites de sessão mantidos, ações explícitas, travas existentes,
  roles/labels, texto flexível e ausência de dependências adicionais.
- Diagnóstico adicional `tsc --noUnusedLocals` usado para limpar imports das
  telas alteradas; a opção não integra o check atual. Apontou também imports
  preexistentes em `cadastro-endereco.tsx` e `entrar-turma.tsx`, fora deste lote.

### Inspeção visual e seus limites

Renderizados componentes reais com React Native Web/ReactDOM em um harness
local isolado, sem acesso a API/Firebase, e capturados pelo Edge headless com
viewport móvel em 320/390 px e desktop em 1024 px. Foram inspecionadas sete
prévias: perfil, criação de rota, criação de excursão, central offline,
preferências, contato comercial e excursões vazias. As medições não apontaram
transbordamento horizontal nessas larguras; cartões, labels, etapas e botões
quebram texto. Capturas e harness temporários estão em `.expo/ux-*`, ignorados
pelo Git. As prévias têm aviso explícito e dados sintéticos apenas no harness.

Essa inspeção não é execução autenticada nem aprovação visual Android. Mapas,
safe areas nativas, teclado, fontes ampliadas, TalkBack, gestos/retorno Android,
Share Sheet e dados reais ainda precisam de aparelho/development build e contas
de homologação. `adb devices -l` foi consultado: nenhum dispositivo conectado.
Não houve teste físico, envio FCM, inscrição real ou mutação no backend.

## Commits locais e estado da área de trabalho

- `187d26c` — componentes, perfil, configurações de turma e notificações.
- `3387152` — rotas públicas e cadastro por etapas.
- `548c3f4` — excursões e regressões da nova navegação.
- Documentação desta revisão em commit separado.

Alterações de tema (`primaryDark`) e títulos de abas detectadas durante o
trabalho foram preservadas e ficaram fora desses commits. Elas permanecem na
área de trabalho. Nenhum push foi feito; não há CI remoto dos novos commits.
