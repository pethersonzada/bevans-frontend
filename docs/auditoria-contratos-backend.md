# Auditoria das chamadas frontend → backend

Inspeção estática em 12/11/2026: frontend local, incluindo alterações ainda não
publicadas, comparado à `main` de `pethersonzada/bevans-backend` no GitHub.
Não houve chamada à API de produção nem teste de integração.

Os quatro controllers lidos da `main` têm o mesmo conteúdo no commit
`1a24bb3c7ae198208c9a0108d889f65623a162a4`:

| Controller | SHA do arquivo (blob) |
| --- | --- |
| UsuarioController | `0d59e1a538c5cbae1bc9ced8a27fbdf87e0d16f3` |
| TurmaController | `78086ccc01d993f0c4dbdaddfc3a009566d6fcc5` |
| EnderecoController | `b3c7bee7e2fb9a7143d4a91c6239cd5f41938186` |
| RotaController | `341e3b4fb6e19d4210dbc3cf79dedaf852a1b2e1` |

Também foram consultados AccessPolicy, SecurityConfig, GlobalExceptionHandler,
TurmaService, ViagemService, EnderecoService, UsuarioService e modelos/DTOs.

## Resultado

As 27 combinações distintas de método/caminho usadas pelo app existem no backend.
Isso não significa compatibilidade integral: há incompatibilidade de autorização
na Home do passageiro e problemas de tratamento de erro/contexto no fluxo de viagem.

### Usuários — 4 chamadas

| Método/caminho | Contrato conferido | Situação |
| --- | --- | --- |
| GET `/usuarios/por-uid/{firebaseUid}` | UID deve corresponder ao token; retorna Usuario | Alinhado estaticamente |
| POST `/usuarios/cadastrar` | Token Firebase, nome/email/UID/telefone/tipo; código para motorista | Alinhado; endereço/coordenadas enviados são ignorados e definidos pelo servidor |
| PUT `/usuarios/{id}/email` | Próprio usuário, JSON `{email}` | Caminho/payload alinhados; sincronização Firebase tem ressalva abaixo |
| DELETE `/usuarios/{id}` | Próprio usuário; backend também exclui Firebase | Caminho alinhado; cliente repete exclusão Firebase desnecessariamente |

### Endereços — 4 chamadas

| Método/caminho | Contrato conferido | Situação |
| --- | --- | --- |
| GET `/enderecos/usuario/{userId}` | Próprio usuário; lista de endereços | Alinhado estaticamente |
| POST `/enderecos/usuario/{userId}` | Próprio usuário; apelido/rua/número/bairro/latitude/longitude | Alinhado estaticamente |
| PUT `/enderecos/{id}` | Endereço próprio; atualização parcial dos campos; coordenadas em par | Alinhado estaticamente |
| DELETE `/enderecos/{id}` | Endereço próprio; sucesso sem corpo | Alinhado; frontend não exige JSON no sucesso |

### Turmas — 11 chamadas

| Método/caminho | Contrato conferido | Situação |
| --- | --- | --- |
| POST `/turmas` | Motorista autenticado igual a motorista.id; nome/turno; rascunho sem percurso permitido | Alinhado estaticamente |
| GET `/turmas/motorista/{motoristaId}` | Motorista consulta apenas seu ID; lista Turma | Alinhado estaticamente |
| GET `/turmas/usuario/{usuarioId}/todas` | Próprio usuário; lista de vínculos aprovados | Alinhado estaticamente |
| PUT `/turmas/{turmaId}` | Dono da turma; nome/turno ou nomes/coordenadas de origem/destino | Alinhado estaticamente |
| DELETE `/turmas/{turmaId}` | Dono da turma; retorna texto; conflito se viagem ativa | Alinhado estaticamente |
| PUT `/turmas/{turmaId}/regenerar-codigo` | Dono da turma; retorna Turma com codigoConvite | Alinhado estaticamente |
| POST `/turmas/entrar/{alunoId}?codigo=...` | Próprio passageiro; sucesso em texto, conflitos em 409 | Alinhado estaticamente |
| GET `/turmas/{turmaId}/passageiros` | Dono da turma; lista id/nome/telefone/status e endereços | Alinhado; serviço backend filtra APROVADO |
| GET `/turmas/{turmaId}/pendentes` | Dono da turma; lista AlunoTurma com aluno | Alinhado estaticamente |
| PUT `/turmas/analisar/{vinculoId}?status=...` | Dono da turma do vínculo; APROVADO/REJEITADO | Alinhado estaticamente |
| DELETE `/turmas/{turmaId}/alunos/{alunoId}` | Dono da turma; retorna texto | Alinhado estaticamente |

### Rota — 8 chamadas

| Método/caminho | Contrato conferido | Situação |
| --- | --- | --- |
| POST `/rota/confirmar` | Query usuarioId/turmaId/status/enderecoIda/enderecoVolta; próprio passageiro aprovado; sucesso texto | Alinhado estaticamente |
| GET `/rota/minha-confirmacao` | Query usuarioId/turmaId; próprio passageiro aprovado; status e resumos dos endereços | Alinhado estaticamente |
| GET `/rota/status-atual?turmaId=...` | Dono ou passageiro aprovado; ATIVA/INATIVA e sentido quando ativa | Alinhado estaticamente |
| GET `/rota/otimizar?sentido=...&turmaId=...` | Somente motorista dono; IDA/VOLTA case-insensitive; lista PassageiroRotaDTO | Alinhado no mapa do motorista; incompatível na Home do passageiro |
| POST `/rota/localizacao-van` | Query turmaId/latitude/longitude obrigatórios; motorista dono; rota ativa | Caminho correto; frontend tem ramo sem turmaId |
| GET `/rota/localizacao-van?turmaId=...` | Dono ou passageiro aprovado; 404 sem localização/viagem ativa | Alinhado estaticamente |
| POST `/rota/iniciar` | JSON turmaId/sentido; motorista dono; 409 em viagem duplicada | Caminho correto; frontend trata qualquer 400 como possível conflito |
| POST `/rota/encerrar?turmaId=...` | Somente turmaId na query; motorista dono; sucesso texto | Caminho correto; frontend envia dados extras e ignora erro no reinício forçado |

## Pendências verificadas na auditoria inicial

1. **Home do passageiro / otimização (#18).** A chamada existe, mas o papel não é
   autorizado: RotaController exige `driverOfTurma`. Para passageiro normal, o
   resultado esperado é 403. Exibir indisponibilidade não resolve a funcionalidade.
   Não existe nesse controller um endpoint de posição privada do próprio passageiro.

2. **Reinício forçado na Home do motorista.** A resposta do POST de encerramento
   não é conferida antes de limpar estado local e tentar iniciar outra viagem.
   Qualquer 400 na criação é interpretado como possível viagem em andamento,
   embora o backend diferencie argumento inválido (400) de conflito (409).

3. **Contexto obrigatório no GPS.** `enviarLocalizacao` ainda monta uma variante
   sem turmaId quando a referência está vazia. O backend exige turmaId e rejeita
   essa chamada. A fila offline armazena só coordenadas e reaplica a turma atual;
   precisa guardar contexto/identidade ou descartar pontos de outro contexto.

4. **Campos extras em iniciar/encerrar.** motoristaId enviado no início não é usado
   pelo controller; a autorização vem da sessão + turmaId. Encerrar não recebe
   motoristaId nem JSON: esses dados extras são ignorados. Não é um caminho ausente,
   mas o cliente deve enviar somente o contrato necessário.

5. **Conta Firebase.** Exclusão de conta já é feita no Firebase pelo backend e o
   cliente tenta excluí-la de novo. Na troca de e-mail, primeiro altera o backend,
   depois Firebase; uma falha nessa segunda etapa pode deixar os registros diferentes.
   São problemas de coordenação do fluxo, não endpoints inexistentes.

## Fontes e limites

- [UsuarioController](https://github.com/pethersonzada/bevans-backend/blob/1a24bb3c7ae198208c9a0108d889f65623a162a4/src/main/java/com/bevans/controller/UsuarioController.java)
- [TurmaController](https://github.com/pethersonzada/bevans-backend/blob/1a24bb3c7ae198208c9a0108d889f65623a162a4/src/main/java/com/bevans/controller/TurmaController.java)
- [EnderecoController](https://github.com/pethersonzada/bevans-backend/blob/1a24bb3c7ae198208c9a0108d889f65623a162a4/src/main/java/com/bevans/controller/EnderecoController.java)
- [RotaController](https://github.com/pethersonzada/bevans-backend/blob/1a24bb3c7ae198208c9a0108d889f65623a162a4/src/main/java/com/bevans/controller/RotaController.java)

Comparação com código GitHub não comprova qual versão está implantada na URL
EXPO_PUBLIC_API_URL, nem que os fluxos passaram em dispositivo. APIs externas de
mapa/geocodificação e rotas de navegação do Expo não são endpoints desse backend.
A matriz e os achados acima registram o estado anterior às correções abaixo.

## Correções locais após a auditoria — 12/11/2026

- Removido GET /rota/otimizar da Home do passageiro, assim como nomes/avatares de
  terceiros e cálculo de posição baseado na lista do motorista. A Home usa somente
  confirmação própria, turmas autorizadas, status e localização permitidos.
  A posição continua explicitamente indisponível até contrato seguro do backend (#18).
- services/viagens.ts envia apenas turmaId/sentido no início e turmaId na query
  de encerramento. Reinício aguarda sucesso do encerramento. HTTP 400 não oferece
  encerramento forçado; somente 409 leva à confirmação de conflito.
- GPS exige turma válida, usuário do contexto original e viagem ativa; envio serial
  e cancelável ao sair/reinicializar/encerrar. A turma pedida na navegação tem
  precedência sobre outras turmas ativas do motorista.
- Removido replay persistido de GPS: o endpoint armazena a posição atual, não um
  histórico de trajeto. A fila legada sem contexto é apagada. Sem rede, as leituras
  são descartadas; novas leituras voltam a ser enviadas após reconexão.
- Exclusão de conta chama apenas o backend e encerra a sessão local. Não repete
  a exclusão Firebase que UsuarioService já executa.
- E-mail: reautentica e altera Firebase antes do backend, de modo que recusa inicial
  do provedor não altere o banco. Após erro HTTP/rede, consulta o perfil: se o novo
  e-mail já foi salvo, reconhece sucesso; se o antigo está confirmado, tenta compensar
  o Firebase; resultado desconhecido ou compensação recusada gera pendência explícita.
  Salvar novamente o mesmo novo e-mail permite retomar a sincronização sem repetir
  a alteração Firebase nem enviar PUT quando os dois lados já estão alinhados.
- Modais de conta fecham ao concluir com sucesso e bloqueiam operações concorrentes.

`npm.cmd run check` passou: arquitetura, TypeScript e 52 testes automatizados.
Novos testes verificam contratos de viagem, recusa de encerramento, GPS sem
contexto, ausência de replay, exclusão única e cenários de erro/compensação de e-mail.
Nenhuma chamada a serviços de produção foi necessária para esses testes.

### Limites e bateria manual

A alteração de e-mail ainda não é uma transação atômica entre Firebase e PostgreSQL:
sem resposta dos serviços, o cliente só pode indicar pendência, consultar novamente
e permitir recuperação. Garantia completa exige coordenação durável no backend.
O endpoint de GPS não tem identificador de viagem; o cliente restringe o contexto,
mas validação de amostras atrasadas por viagem exigiria evolução do servidor.

- [ ] Passageiro: presença e radar continuam funcionando sem chamadas de otimização
  nem exposição de lista privada; posição não é fabricada.
- [ ] Motorista: HTTP 400 não sugere encerrar; 409 pede confirmação; erro no
  encerramento não inicia outra viagem nem confirma estado local incorreto.
- [ ] GPS: perda/reconexão de rede, troca de conta/turma, saída do mapa, encerramento
  e outra turma ativa não reaplicam pontos antigos no contexto atual.
- [ ] Exclusão de conta: só backend exclui Firebase; erro 409 mantém sessão e explica
  a necessidade de encerrar a viagem.
- [ ] E-mail: provedor recusa, backend recusa, queda de rede antes/depois de salvar,
  falha no readback/compensação e repetição do mesmo novo endereço.
- [ ] Confirmar a versão efetivamente implantada da API em ambiente isolado.

Código ainda local, sem commit/publicação deste lote. Teste manual permanece adiado.
