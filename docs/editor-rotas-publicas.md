# Editor de Rotas Públicas — #26

Área do motorista separada das turmas privadas. Entrada em Home → Rotas Públicas.
Uma turma é escolhida para compartilhar capacidade/vínculos, sem copiar sua
garagem nem publicá-la automaticamente. Cadastro exige origem/destino públicos
confirmados explicitamente com o mesmo EnderecoMapaPicker de passageiros.

Editor permite FIXA/FLEXIVEL, categoria, cidade de operação, dias/horários,
origem/destino e paradas. Toque/pesquisa/correção do pin reutilizam campo único.
Paradas podem ser renomeadas, reposicionadas, removidas e reordenadas por controles
acessíveis. Reposicionar não apaga nome personalizado. Confirmação de gravação
verifica ID/coordenadas/ordem retornados pela API; erros preservam o rascunho.

Dados básicos e paradas usam duas operações: se a segunda falhar, a rota criada
é mantida no contexto e retry usa PUT, evitando criar outra publicação. Isso não
é uma transação distribuída entre as duas requisições: dados básicos podem estar
salvos mesmo quando paradas falham. Reabrir permite conferir o estado do servidor.
Publicar é ação explícita posterior e bloqueada enquanto existem mudanças locais.

Prévia mostra a ordem dos pontos com ligações diretas, não instruções de navegação
viária. FIXA mantém a ordem; FLEXIVEL pode pedir otimização de prévia ao backend.
Prévia não altera automaticamente as paradas persistidas nem inclui pedidos
pendentes. Edição de capacidade usa a tela de turma existente; retorno recarrega
dados salvos. Nada disso implementa o embarque por parada/ponto pedido (#27).

SDK local é 57, preservado. Typecheck agora usa o gerador de typed routes do
próprio Expo CLI instalado (script generate-route-types.cjs), atualizando somente
.expo/types ignorado pelo Git. Não desabilita tipagem nem usa casts de rotas.

Verificação: arquitetura, TypeScript e **72 testes passaram**. Novos testes cobrem
parser por campos permitidos, coordenadas, ordem retornada e criação do rascunho
com confirmação de pontos e envio de paradas. Simulações não provam gestos nativos.
ADB foi iniciado apenas para diagnóstico; `adb devices -l` retornou lista vazia.
Sem teste Android, iOS, GPS/permissões reais ou teste mobile contra API isolada.
Issue #26 permanece aberta para esses critérios e revisão da prévia viária.
