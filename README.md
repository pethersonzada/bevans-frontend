# BeVans | Aplicativo Mobile (Frontend)

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)](https://firebase.google.com/)
[![Mapbox](https://img.shields.io/badge/Mapbox-000000?style=for-the-badge&logo=Mapbox&logoColor=white)](https://www.mapbox.com/)


Aplicativo mobile do ecossistema **BeVans**, voltado à organização do transporte escolar e universitário. Oferece experiências específicas para **motoristas** e **passageiros**, com turmas, confirmação de presença, mapas, acompanhamento de viagens e notificações.

**Repositório:** [pethersonzada/bevans-frontend](https://github.com/pethersonzada/bevans-frontend)  
**Demais componentes:** [Backend](https://github.com/pethersonzada/bevans-backend) · [WebApp](https://github.com/pethersonzada/bevans-webapp) · [Agente de suporte](https://github.com/pethersonzada/bevans-agente)

## Tecnologias

- **React Native 0.86.3**, **React 19.2.3** e **TypeScript 6**.
- **Expo SDK 57** e **Expo Router**, com roteamento baseado em arquivos (`src/app`).
- **Firebase Authentication** para autenticação e integração com a API própria.
- **Mapbox** (`@rnmapbox/maps`) para mapas e navegação; `expo-location` para localização.
- **Expo Notifications**, **Expo Secure Store**, **AsyncStorage** e **NetInfo**.

> O Mapbox utiliza código nativo. Para testar os mapas, use um *development build*. O **Expo Go não oferece suporte a `@rnmapbox/maps`**.

## Funcionalidades e fluxos

### Passageiros

- Cadastro/autenticação, ingresso em turmas por código e acompanhamento do pedido de aprovação.
- Confirmação de presença para viagens de ida e/ou volta e escolha de endereços.
- Visualização de informações autorizadas da turma e acompanhamento da van durante viagens ativas.
- Acesso a notificações e preferências relacionadas ao uso do aplicativo.

### Motoristas

- Criação e manutenção de turmas e gestão dos pedidos de ingresso.
- Consulta de confirmações de passageiros e planejamento da viagem.
- Início/encerramento de viagens e interação com o fluxo de navegação e localização.
- Fluxos de excursões e convites documentados e desenvolvidos incrementalmente no projeto.

A disponibilidade de cada fluxo depende da versão do app, dos contratos do backend e da configuração do ambiente. Consulte `docs/` para escopo, validações e limitações das entregas.

## Arquitetura e integração

```text
Telas e navegação (src/app)
          |
Componentes, hooks, contextos e serviços
          |
   src/config/api.ts
          |  Firebase ID token (Bearer)
          v
       API REST BeVans
          |
  PostgreSQL / serviços do backend
```

A função `apiFetch` centraliza chamadas autenticadas, obtém o token do Firebase, tenta renová-lo após HTTP 401 e diferencia erros de rede, timeout, sessão e resposta inválida. A API precisa estar acessível pelo dispositivo físico ou emulador usado nos testes.

## Instalação e execução

### Requisitos

- Node.js e npm compatíveis com as dependências do projeto.
- Android Studio/emulador Android ou aparelho configurado para um build nativo; para iOS, macOS/Xcode.
- Projeto Firebase e token Mapbox para os recursos correspondentes.

```bash
git clone https://github.com/pethersonzada/bevans-frontend.git
cd bevans-frontend
npm ci
npm run start
```

Para desenvolvimento com módulos nativos:

```bash
npm run android
# ou, em ambiente macOS configurado:
npm run ios
```

O script `npm run web` inicia a opção web disponibilizada pelo Expo; o produto principal é mobile.

## Variáveis de ambiente

Crie `.env` local e ajuste a configuração efetivamente utilizada em `src/config/config` e `src/config/firebase`:

```dotenv
EXPO_PUBLIC_API_URL=http://SEU_HOST:8080
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=SEU_TOKEN_PUBLICO_MAPBOX
EXPO_PUBLIC_FIREBASE_API_KEY=SUA_CHAVE_PUBLICA_FIREBASE
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=SEU_DOMINIO
EXPO_PUBLIC_FIREBASE_PROJECT_ID=SEU_PROJETO
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=SEU_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=SEU_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID=SEU_APP_ID
```

`app.config.js` também considera `EXPO_PUBLIC_APP_ENV` e, quando fornecido, `GOOGLE_SERVICES_JSON` para o arquivo de serviços Android. Variáveis `EXPO_PUBLIC_*` são incorporadas à aplicação cliente: **nunca coloque nelas segredos de servidor ou credenciais administrativas**.

## Comandos do projeto

| Comando | Finalidade |
| --- | --- |
| `npm run start` | Inicia o servidor de desenvolvimento Expo. |
| `npm run android` | Executa build nativo para Android. |
| `npm run ios` | Executa build nativo para iOS. |
| `npm run web` | Inicia a versão web do Expo. |
| `npm run architecture` | Valida regras arquiteturais do repositório. |
| `npm run typecheck` | Gera tipos de rotas e executa `tsc --noEmit`. |
| `npm test` | Executa testes com `node --test`. |
| `npm run check` | Executa arquitetura, tipos e testes. |
| `npm run bundle:android` | Exporta bundle Android para verificação. |

Antes de abrir um PR, rode:

```bash
npm run check
```

## Organização relevante

```text
src/
  app/                # telas e roteamento com Expo Router
  components/         # componentes reutilizáveis
  contexts/           # estado/contextos da aplicação
  hooks/              # hooks compartilhados
  services/           # lógica de integração e operações
  config/
    api.ts            # cliente HTTP autenticado
assets/                # ícones, logos e imagens
tests/                 # testes automatizados
scripts/               # verificações e geração de tipos
docs/                  # relatórios e documentação técnica
app.config.js          # configuração Expo e plugins
package.json
```

## Segurança e limites

- Regras de autorização devem ser aplicadas pelo **backend**, não apenas por telas ocultas no aplicativo.
- Use HTTPS em ambientes publicados e restrinja acesso a tokens e serviços externos.
- Funcionalidades de mapa dependem de GPS, permissões, rede e estado da viagem; atualização em tempo real não significa frequência garantida.
- Nunca publique arquivos privados de Firebase Admin, tokens secretos ou `.env` com credenciais.

## Documentação relacionada

- [Documentação existente do frontend](https://github.com/pethersonzada/bevans-frontend/tree/main/docs)
- [API e contratos do backend](https://github.com/pethersonzada/bevans-backend/tree/main/docs)

**Estado da documentação:** elaborado a partir dos arquivos `package.json`, `app.config.js`, `src/config/api.ts` e README do repositório. Recursos em evolução devem ser validados na versão efetivamente implantada.

