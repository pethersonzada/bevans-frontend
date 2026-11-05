# BeVans - Documentação Técnica do Frontend

Aplicativo mobile (**React Native + Expo**) para gestão de transporte escolar e universitário por van, conectando motoristas e passageiros em tempo real.

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)](https://firebase.google.com/)
[![Mapbox](https://img.shields.io/badge/Mapbox-000000?style=for-the-badge&logo=Mapbox&logoColor=white)](https://www.mapbox.com/)

> ⚠️ **Aviso de Propriedade Intelectual:** Este repositório é de uso estritamente pessoal e acadêmico, mantido no GitHub apenas para controle de versão do projeto **BeVans**. A cópia, distribuição, comercialização ou uso não autorizado do código-fonte por terceiros é expressamente proibida.
> 

## 1. Visão Geral

### 1.1 O que é
O **BeVans** é um app mobile que organiza o transporte por van de alunos. Ele resolve três problemas principais:

* **Gestão de Presença:** Passageiros confirmam presença (*Ida / Volta / Ambos / Não Vou*) e escolhem o endereço de embarque.
* **Otimização de Rotas:** O backend devolve a ordem otimizada (`/rota/otimizar`) e o app desenha a rota com navegação *turn-by-turn* via **Mapbox**.
* **Radar da Van:** A posição do motorista é enviada a cada ~2 s e consultada pelos passageiros a cada 10 s.

### 1.2 Perfis de usuário
* **PASSAGEIRO (ALUNO):** Entra em uma turma por código de convite, cadastra endereços, confirma presença e acompanha a van.
* **MOTORISTA:** Cria turmas/rotas, define origem (garagem) e destino, aprova solicitações, gerencia passageiros e conduz a viagem no mapa.

### 1.3 Stack
| Camada | Tecnologia |
| :--- | :--- |
| **Framework** | React Native + Expo (SDK com Expo Router) |
| **Linguagem** | TypeScript |
| **Autenticação** | Firebase Authentication (e-mail/senha) |
| **Mapas e Rotas** | `@rnmapbox/maps` + Mapbox Directions API |
| **Localização** | `expo-location` |
| **Persistência local** | `@react-native-async-storage/async-storage` |
| **Conectividade** | `@react-native-community/netinfo` |
| **Backend** | API REST própria (Bearer token Firebase) |

## 2. Pré-requisitos e Instalação

### 2.1 Requisitos
* Node.js 18+ e npm/yarn
* Expo CLI / EAS CLI
* Conta Firebase (Authentication habilitado)
* Conta Mapbox (Token público)
* **Atenção:** O `@rnmapbox/maps` é um módulo nativo e **não funciona no Expo Go**. Utilize *development builds* (`expo run:android` / `expo run:ios` ou EAS Build).

### 2.2 Dependências Principais
```bash
npx expo install expo-router expo-location expo-clipboard \
  react-native-safe-area-context @expo/vector-icons \
  @react-native-async-storage/async-storage \
  @react-native-community/netinfo

npm install firebase @rnmapbox/maps react-native-masked-text
```

### 2.3 Variáveis de Ambiente (`.env`)
```env
EXPO_PUBLIC_API_URL=https://sua-api.exemplo.com
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxxxxxxxxxxx

EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

## 3. Exemplo de Uso Prático

### Consumindo a API com autenticação injetada
```typescript
import { apiFetch } from '../config/api';

type Turma = {
  id: string;
  nome: string;
  turno: string;
};

async function buscarTurmas(motoristaId: string): Promise<Turma[]> {
  const res = await apiFetch(`/turmas/motorista/${motoristaId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Turma[];
}
```

---
