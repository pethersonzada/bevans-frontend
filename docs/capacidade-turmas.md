# Capacidade por turma — contrato incremental

Backend #35, frontend #20. Turmas privadas permanecem privadas.

## API e regras

- POST /turmas exige `capacidade` inteiro positivo, inclusive em rascunho.
- PUT /turmas/{id} aceita capacidade opcional. Ausente/nula preserva valor;
  inteiro positivo menor que aprovados retorna 409. Inválido retorna 400.
- GET /turmas/{id}/vagas, apenas motorista dono: capacidade, ocupados,
  disponiveis, configurada. Ocupados conta vínculos APROVADO ativos, não presenças
  diárias. Capacidade legada nula retorna disponiveis=null, configurada=false.
- Aprovação da última vaga e edição de capacidade usam lock pessimista da mesma
  turma durante toda a transação. Contagem/status/capacidade consultados no banco
  depois do lock; não confiar em entidade carregada na autorização/OSIV.
- Turma legada sem capacidade não recebe nova aprovação (409) até configuração.
  Passageiros já aprovados e demais dados continuam preservados.
- Pedido por código também obtém lock da turma para evitar duplicação concorrente
  nesse fluxo. Não foi introduzido segundo modelo de matrícula.
- Estados existentes continuam PENDENTE/APROVADO/REJEITADO. Cancelamento próprio
  e catálogo público ainda pendentes no restante de #35.

## Migração e recuperação

Script manual incremental: docs/migrations/001-capacidade-turma.sql. Não aplicado
em produção. Backup antes da aplicação; testar em clone/instância PostgreSQL
isolada e registrar versão executada. Não preencher capacidade com número fixo
de veículo nem derivar limite físico apenas da ocupação atual.

Rollback da aplicação é compatível com a coluna nullable e índice adicionais;
preservar ambos e valores já gravados. Não apagar coluna/tabelas/dados. A aplicação
ainda usa Hibernate ddl-auto=update; isto não substitui aplicar/validar constraints
do script. Em ambiente controlado de produção, planejar ddl-auto=validate somente
após inventário de todas as tabelas e aprovação da implantação.

Docker CLI foi encontrado, mas o daemon local não está disponível. Portanto não
foi possível comprovar migração/locks em PostgreSQL neste ambiente. H2 cobre
persistência/transações como teste local; não alegar equivalência PostgreSQL.
O script foi executado em H2 com MODE=PostgreSQL: IDs/relacionamentos e valores
legados preservados, CHECK rejeitou zero, configuração de uma turma preservou outra.

Testes concorrentes em transações independentes confirmam somente uma aprovação
na última vaga, consistência entre redução/aprovação e deduplicação de pedidos
simultâneos por código. Testes HTTP cobrem dono/terceiro, 409 e rejeição de 1.5
sem truncamento. O frontend passou arquitetura, TypeScript e 68 testes.

Leitura agregada usa REPEATABLE_READ e consultas escalares para retornar capacidade
e ocupação consistentes; dados antigos da autorização não definem a contagem.
Atualização de turma e regeneração de convite recarregam entidade sob lock para
evitar que uma alteração concorrente sobrescreva a capacidade persistida.

## Frontend e validação manual pendente

Cadastro e edição têm Quantidade de assentos, sem limite compartilhado entre
turmas. Formulário valida inteiro positivo; backend continua sendo autoridade.
Edição busca ocupação da API e explica redução abaixo de aprovados. Vagas do
rascunho de edição são identificadas como previsão após salvar.

Em development build e API isolada: criar A=12 e B=18, editar A=15, reiniciar app,
aprovar participantes, tentar reduzir abaixo de aprovados, disputar última vaga
em duas sessões e verificar erros 400/403/409. Validar turmas legadas sem limite.
Não fechar #35/#20 sem critérios restantes e PostgreSQL/dispositivo.
