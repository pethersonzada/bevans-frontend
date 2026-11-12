# Issue #8 — Estados de carregamento, vazio e erro

Implementação local em 12/11/2026. Validação manual pendente.

## Padrão compartilhado

`AsyncState` distingue `loading`, `empty` e `error`, com título, descrição e ação.
Mantém compatibilidade com `loading` e `onRetry` das telas existentes.
Oferece aparência clara e aparência do mapa, usando as cores do tema.

A ação mostra progresso, bloqueia toques duplicados e volta a ficar disponível
se a tentativa falhar. Botões têm área mínima de 48dp e estados acessíveis;
títulos, mensagens e progresso são expostos ao leitor de tela.

`FormFeedback` mantém erros de formulário na tela com região de anúncio acessível,
sem apagar os dados digitados. Confirmações de sucesso e ações destrutivas
continuam usando os diálogos existentes.

## Telas cobertas neste lote

| Tela/fluxo | Comportamento |
| --- | --- |
| Homes | Carregamento identificado e erro inicial com nova tentativa; dados existentes preservados em falhas de atualização. |
| Turmas do motorista | Vazio explicativo com ação Criar turma. |
| Passageiros e solicitações | Carregamento e erro próprios de cada consulta; falha não aparece como ausência de pessoas/pedidos. Respostas antigas não substituem a turma atual. |
| Home do passageiro | Vínculo vazio com ação de convite; falta de localização tem mensagem em vez de spinner permanente. Falha de endereços é visível. Rota recusada não é descrita como lista vazia ou passageiro não confirmado. |
| Gerenciar endereços | Vazio, erro e progresso explícitos; lista existente continua visível em falha de atualização. Exclusão bloqueia duplicação e remove localmente o item após aceitação do servidor. |
| Editar endereço/turma | Carregamento identificado e nova tentativa para carga; ações de turma ficam desabilitadas quando os dados não estão disponíveis. |
| Login/cadastro | Validação e erros permanecem no formulário; envio repetido bloqueado. Cadastro desabilita edição durante o envio. |
| Cadastro de turma | Erros de criação/finalização permanecem na tela; abrir mapa/finalizar compartilham bloqueio de operação; botão do mapa desabilitado enquanto salva. |
| Busca de endereço | Busca sem resultados é vazia, não erro. Falhas permitem tentar novamente; alterar a busca cancela a resolução anterior e libera o indicador de progresso. |
| Mapa do motorista | Fim de carga sem origem/destino mostra erro, nova tentativa e Voltar ao início. Permissão negada/GPS indisponível deixam de cair em spinner infinito. Nova tentativa limpa a assinatura de GPS anterior. |

Não foram criados contratos de backend. A exibição de indisponibilidade de rota
não resolve a posição privada do passageiro (#18).

## Verificação automatizada

```powershell
npm.cmd test
npx.cmd tsc --noEmit
git diff --check
```

29 testes passam (incluindo os lotes anteriores). Os cinco cenários novos cobrem
estados acessíveis de feedback, bloqueio de toques duplicados, retomada após erro
e listas que distinguem falha/vazio sem descartar os dados existentes.
São testes com serviços e hooks simulados; não verificam layout nativo, GPS ou leitor de tela real.

## Bateria manual pendente

- [ ] Testar carga inicial, vazio, falha HTTP, ausência de rede e recuperação nas Homes, endereços, passageiros e solicitações.
- [ ] Falhar uma atualização com lista preenchida; verificar que os dados existentes e a mensagem de falha continuam visíveis.
- [ ] Trocar turmas enquanto passageiros/solicitações carregam; nenhuma falha ou resposta deve ficar associada à turma anterior.
- [ ] Tocar repetidamente em Tentar novamente e nos envios de login/cadastro/turma; verificar progresso e ausência de duplicação.
- [ ] Validar erros de login/cadastro sem perder os campos preenchidos; testar cadastro recusado e falha de conexão após criar conta Firebase em ambiente isolado.
- [ ] Pesquisar endereço inexistente, simular falha de rede, tentar novamente e alterar a busca durante a resolução do número; o indicador deve encerrar corretamente.
- [ ] Negar localização, desligar GPS e simular ausência de origem/destino ao abrir o mapa; confirmar erro, nova tentativa e retorno ao início.
- [ ] Repetir a tentativa no mapa e sair da tela; verificar que não ficam assinaturas de GPS duplicadas.
- [ ] Conferir VoiceOver/TalkBack, texto ampliado, contraste e áreas de toque nos estados e ações alterados.

A issue permanece aberta até revisão e execução desta bateria.
