# Endereços de excursões — 16/11/2026

## Causa e correção

O picker compartilhado atribuía `Ponto marcado no mapa` (ou reutilizava o nome anterior) ao toque/arraste do pin. O planejamento persistia esse texto em `destinoNome`, `origemNome` e `paradas[].nome`. Ao reposicionar uma parada existente, atualizava apenas as coordenadas, deixando o nome anterior.

Excursões agora habilita um resolvedor opcional no picker. Ele reutiliza `expo-location.reverseGeocodeAsync`, já instalado, sem endpoint ou chave novos. Formata apenas componentes retornados: rua, número, bairro, cidade/sub-região e estado. O número não é inferido. Latitude/longitude são sempre as do pin, mesmo que o provedor retorne outras coordenadas.

A descrição fica visível e editável antes de **Usar este ponto**. Durante a consulta, o candidato fica desabilitado; em falha, a confirmação exige uma descrição manual. Digitar cancela a aplicação da resposta pendente. AbortController e sequência de requisições protegem seleção rápida, busca textual, desmontagem e edição manual. A consulta tem limite de dez segundos. Não solicita permissão adicional automaticamente: a geocodificação nativa depende da disponibilidade/permissões do ambiente; quando indisponível, o pin e o caminho manual permanecem disponíveis.

O reposicionamento de parada atualiza nome e coordenadas juntos, preservando ID, horário e instruções. O contrato permanece igual: `destinoNome`, `origemNome`, `paradas[].nome` e respectivos campos de coordenadas. Nenhuma mudança em backend/webapp.

Nomes confirmados retornados pelo servidor são preservados. Listagem e visão geral consultam coordenadas somente para nomes vazios/genéricos antigos. Essa recuperação é de exibição, sem gravação automática; um aviso orienta confirmar no planejamento para persistir. Sem resultado, aparece **Endereço não identificado**, com orientação para revisão. A revisão impede salvar nomes vazios ou o marcador genérico. Os outros consumidores do picker mantêm o comportamento anterior.

## Evidências

- `npm run check`: arquitetura e TypeScript aprovados; **177 testes aprovados**, zero falhas.
- 13 testes de endereços: formatação parcial/completa sem número inventado; seleção e revisão; coordenadas preservadas; falha/offline; concorrência; edição manual; desmontagem; nomes confirmados preservados; recuperação de legado; resposta obsoleta nos detalhes; persistência/reabertura de destino, origem e paradas.
- Persistência testada com serviços reais do frontend e transporte HTTP simulado. Não representa uma execução real do backend ou do geocodificador do aparelho.
- `npm run bundle:android`: exportação concluída em `.expo/ci-android` (ambiente CI/offline, sem dotenv).
- `git diff --check` no escopo desta correção: aprovado. A verificação global aponta espaços finais em alterações preexistentes de `_layout.tsx` e `home-motorista.tsx`, preservadas fora deste trabalho.

## Validação física restante

O Motorola conectado foi informado como homologação com dados de teste. Não foi concluído o ciclo físico de selecionar/salvar/reabrir: o aparelho estava sendo utilizado fora do BeVans durante a inspeção. Nenhuma integração nativa ou persistência remota é declarada aprovada.

Procedimento: no build de desenvolvimento com esta versão JS, abrir uma excursão de teste; selecionar destino/origem/embarque no mapa; conferir o endereço retornado; ajustar a descrição; salvar; sair e reabrir. Conferir nomes e posições. Repetir com dois pins rápidos e sem rede; neste último caso informar descrição manual, reconectar e salvar. Conferir também uma excursão antiga com nome genérico. Não publicar nem modificar viagens reais para este teste.

Alterações paralelas do usuário e os módulos incompletos de Rotas Públicas não fazem parte desta correção. Sem push, deploy ou EAS Build.
