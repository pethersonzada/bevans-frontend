# Aparência do aplicativo

A preferência no Perfil oferece Sistema, Claro e Escuro. É uma configuração do
aparelho, persistida em `@bevans:aparencia:v1`, independente da conta. Sistema é o
padrão e o fallback para valores inválidos. Falha de leitura mantém o aplicativo
utilizável; falha de escrita preserva a escolha anterior e permite tentar novamente.

`theme.colors` seleciona a paleta ativa, mantendo tokens de espaçamento e tipografia
existentes. `useThemeRevision` assina a mudança com `useSyncExternalStore`. Cada
componente visual usa essa assinatura antes de retornos condicionais. Não há chave
de tema em navegadores ou formulários: a mudança não remonta telas, reinicia GPS,
refaz login ou apaga rascunhos.

Estilos criados fora de componentes usam
`themedStyles(() => StyleSheet.create({...}))`. A fábrica avalia os tokens uma vez
por paleta e mantém as referências em cache. O acesso a uma propriedade do estilo
devolve a versão da paleta atual. O proxy evita repetir as definições e preserva os
consumidores de `ui`, `trip` e `globalStyles`. Não espalhar esse objeto em outro
objeto estático fora do render, pois isso capturaria somente uma paleta.

As superfícies, campos, estados, cabeçalhos, abas, modais e botões seguem tokens.
Cards promocionais preservam a cor `brand` e textos claros. Mapas e painéis de
navegação mantêm sua paleta operacional escura nos dois temas, com marcadores e
contraste próprios. Evitar substituir suas cores operacionais por cores de formulário.

Testes em `tests/aparencia.cjs` cobrem persistência, restauração, valor inválido,
falha de armazenamento, resposta a mudanças do sistema, notificações e cache de
estilos. Os demais testes mantêm seus cenários originais com o tema claro no harness.
Android: seleção Escuro persistiu após force-stop; Sistema acompanhou `uimode`
claro/escuro sem perder o campo Cidade em edição. Evidências em
`docs/evidencias/frontend-2026-11-22/05-*`, `06-*` e `07-*`.

Permanece necessária a bateria visual com fonte ampliada, leitor de tela e iOS,
além do aceite de operação real com duas contas/aparelhos nas respectivas issues.

Na continuação de 23/11, textos auxiliares de operação, rastreamento, datas e avisos
passaram a usar a cor da paleta explicitamente. Placeholder de correção e turno de
cartões selecionados também foram corrigidos após inspeção no Android. Painel
motorista e excursões passageiras foram conferidos em escuro. Os rádios
compartilhados usam `accessibilityState.checked`; Sistema expôs `checked=true` no
Android ao restaurar a preferência. Isso não substitui teste com TalkBack.
