# Validação das correções de sessão, API e presença

## Verificação automatizada

Na raiz do projeto, com dependências instaladas:

```powershell
npm.cmd test
npx.cmd tsc --noEmit
```

Os testes usam o runner do Node, transpilações TypeScript e simulações de hooks,
Firebase, armazenamento e HTTP. Não acessam serviços de produção. Cobrem lógica
e eventos; não substituem testes com React Native, navegação e dispositivos reais.

## Comportamento implementado

- A identidade vem do perfil autenticado por UID Firebase; o ID salvo localmente
  não é usado como identidade nas telas. A restauração consulta o servidor.
- Falha na restauração bloqueia as telas protegidas e oferece nova tentativa ou
  retorno ao login. Abrir o app sem conexão pode exigir essa nova tentativa.
- Logout encerra Firebase e remove apenas dados de sessão, preservando preferências.
- Rotas protegidas exigem sessão; edição/criação de turma e mapa do motorista
  exigem também o papel MOTORISTA. O backend continua responsável pela autorização.
- A API espera o Firebase, usa o token atual e tenta renovar uma vez após 401.
  Um segundo 401 encerra a sessão. Um 403 não encerra a sessão.
- Erros distinguem HTTP, conexão, timeout, cancelamento e resposta inválida.
  Falhas de rede não repetem operações de escrita automaticamente.
- Edição de presença preserva o rascunho durante polling; cancelar restaura a
  confirmação salva. Resultados antigos da Home não substituem buscas mais recentes.

## Bateria manual pendente

Executar em ambiente de teste com passageiro, motorista, duas turmas e endereços.
Todos os itens abaixo permanecem pendentes até execução no aplicativo.

- [ ] Login de passageiro e motorista; fechar/reabrir com sessão persistida.
- [ ] Iniciar sem sessão Firebase, inclusive com dados antigos no armazenamento:
  nenhuma chamada protegida deve usar o ID antigo.
- [ ] Logout seguido de voltar, deep link e reabertura de endereço/turma/mapa:
  nenhuma tela protegida deve permanecer acessível.
- [ ] Passageiro abrindo link de edição/criação de turma ou mapa do motorista:
  acesso bloqueado pela navegação.
- [ ] Trocar de conta e conferir que turmas, endereços e nome pertencem à nova conta.
- [ ] Interromper a rede ao restaurar sessão, carregar Homes e listar/editar
  endereços; conferir erro explícito e recuperação por Tentar novamente.
- [ ] Simular 401 recuperável, 401 persistente e 403; verificar renovação única,
  retorno ao login e preservação de sessão em erro de permissão, respectivamente.
- [ ] Simular resposta vazia, JSON inválido, erro JSON no campo erro/message e timeout.
- [ ] Criar, editar e excluir endereço; criar/editar turma e solicitar entrada por código.
- [ ] Falhar a criação de turma: não exibir mensagem de sucesso nem navegar como
  se a criação tivesse ocorrido.
- [ ] Fazer primeira confirmação e editar uma confirmação existente por mais de
  um ciclo de polling, incluindo status e endereços diferentes.
- [ ] Cancelar edição, salvar com sucesso, falhar o salvamento e trocar de turma
  com requisições pendentes; conferir ausência de rascunho ou resposta da turma anterior.
- [ ] Negar permissão de localização: a Home deve carregar sem esperar pelo GPS.
- [ ] Iniciar/encerrar viagem de teste e conferir chamadas autenticadas no mapa.
- [ ] Cadastro de passageiro e motorista com código válido/inválido: preservar
  o tratamento de conta Firebase quando o backend recusar ou a conexão falhar.

## Desempenho da navegação (análise de 11/11/2026)

Constatações estáticas, sem medição de latência no aparelho ou SQL no servidor:

- Perfil não consulta a API ao montar. O spinner do perfil pertence às ações
  de alteração de conta. A demora relatada ao trocar de aba ainda requer medição.
- O polling antigo da Home do passageiro permanecia montado no perfil e fazia
  status + carga completa (turmas, endereços, confirmação e otimização) a cada 10s.
  Isso representa até 5 chamadas por ciclo inativo ou 6 em viagem, após sucesso
  da consulta de status; não equivale ao número de consultas SQL do Hibernate.
- O foco da Home do motorista dependia da turma selecionada, alterada pela
  própria consulta, disparando outra carga. Selecionar turma também buscava detalhes
  explicitamente, duplicando trabalho com o efeito de foco.

Ajustes locais: polling serializado com cancelamento no blur/segundo plano;
radar usa somente status e, em viagem, localização; confirmação atualiza a cada
30s, sem rebuscar turmas e endereços. Homes reutilizam sua carga bem-sucedida
por 30s, compartilham cargas concorrentes e revalidam após escritas na API.
Puxar para atualizar força uma nova consulta. Não há cache persistido de dados
privados. A frescura local não substitui autorização ou validação do servidor.

O mapa foi extraído para MapaRadarPassageiro, memoizado e desmontado fora da Home.
Não há indicação para dividir todos os elementos visuais em componentes: hooks
de ciclo de vida e serviços de dados reduzem consultas; componentes delimitam
blocos com responsabilidades e custos próprios.

- [ ] Comparar contagem de requisições ao abrir a Home, alternar 10 vezes com Perfil,
  permanecer 60s em Perfil e enviar o app para segundo plano.
- [ ] Conferir ausência de novos ciclos de radar/presença em Perfil e segundo plano;
  uma requisição já recebida pelo servidor pode concluir mesmo após cancelamento.
- [ ] Voltar antes/depois de 30s; editar endereço/turma e voltar imediatamente;
  puxar para atualizar; verificar frescura e ausência de duplicação de carga.
- [ ] Trocar turmas rapidamente em viagem e verificar descarte dos dados anteriores.
- [ ] Usar React Native Profiler e métricas HTTP em build de desenvolvimento e release
  para medir transição Home → Perfil e separar renderização, rede e Mapbox.
- [ ] Correlacionar endpoint e tempo HTTP com quantidade/tempo das consultas SQL no
  backend. Muitos logs Hibernate, isoladamente, não comprovam consulta N+1.

## Escopo das issues

Este lote atende código das issues #2, #3, #4 e #13 e avança #7/#8 nas telas
afetadas. #8 ainda exige revisão visual e de acessibilidade nas demais telas.
Não encerra #9 (isolamento por turma), #18 (posição privada do passageiro) nem
funcionalidades que dependem de novos contratos do backend. A chamada antiga
de otimização na Home do passageiro continua pendente da #18.
