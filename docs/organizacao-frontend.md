# Organização do frontend

## Responsabilidades

| Diretório | Responsabilidade |
| --- | --- |
| `src/app` | Rotas, layouts de navegação e composição das telas do Expo Router. |
| `src/contexts` | Estado compartilhado e providers; AuthContext deixa de ser descoberto como rota. |
| `src/components` | Apresentação e interação, com contratos de props tipados. |
| `src/hooks` | Ciclo de vida React, foco, atualização e acompanhamento. |
| `src/services` | Comunicação HTTP e regras reutilizáveis, sem dependência de telas ou componentes. |
| `src/types` | Contratos de domínio compartilhados, como Turma e ConfirmacaoPresenca. |
| `src/config` | Inicialização de integrações e camada HTTP comum. |

## Práticas aplicadas neste lote

- AuthContext movido para fora de `app`; importações e testes atualizados. `useAuth`
  falha explicitamente quando usado fora do provider, sem cast de contexto vazio.
- Tipos de turma/presença ficam em `types`; serviço não importa mais tipo definido
  em componente. Home do motorista deixa de derivar seu modelo de props visuais.
- Criação, consulta, atualização, exclusão e regeneração de código de turma usam
  `services/turmas.ts`; removidos `any` e casts de navegação nesses formulários.
- Respostas de turma entram como `unknown` e são verificadas antes de uso: identidade,
  formato e coordenadas finitas. IDs inválidos não geram requisição com fallback.
- Atualizar/excluir aceita resposta HTTP vazia; não exige JSON quando não há retorno.
- Regeneração de código verifica se o retorno pertence à turma pedida. O painel
  descarta respostas tardias após trocar de turma/desmontar e bloqueia envio duplicado.
- Regra automatizada impede que serviços e tipos compartilhados importem rotas,
  componentes, contextos ou hooks. Sem instalação de novas dependências.

## Verificar localmente

```powershell
npm.cmd run check
```

Executa verificação das dependências entre camadas, TypeScript e testes. Comandos
individuais: `npm.cmd run architecture`, `npm.cmd run typecheck`, `npm.cmd test`.

É uma migração incremental: ainda há telas com HTTP embutido, tipos `any` e estilos
que podem ser revisados. Não foi reescrito o app inteiro nem alterada a política de
autorização do backend. Os testes manuais de cadastro/edição/exclusão de turma,
regeneração de código, troca de turma com requisição pendente e navegação após mover
o contexto ficam na bateria final já combinada.
