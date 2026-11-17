# Estabilização das rotas para 18/11/2026

## Correções adicionais na PR #47

- O mapa bloqueia pontos obrigatórios inválidos em vez de removê-los silenciosamente.
- Antes da geometria, confere passageiros, quantidade, sentido e identidade da viagem com a operação autorizada. A ordem recebida do roteiro é preservada.
- O fallback de geometria exige a mesma assinatura de coordenadas, destino, ordem e pontos pendentes, além da viagem/turma/sentido já isolados pela branch.
- Os extremos de uma rota pública são carregados antes da validação dos pontos da turma.
- O radar mostra viagem em andamento e localização indisponível quando não há GPS recente da van, mesmo que exista localização do passageiro.
- A busca de estabelecimentos usa geocodificação completa e expande ETE para Escola Técnica Estadual. O pin manual continua necessário para confirmar resultados aproximados.

## Evidências

- `npm ci`: 781 pacotes instalados pelo lockfile, usando `npm.cmd` no Windows.
- `npm run check`: arquitetura, TypeScript e 216 testes aprovados, incluindo testes de serviços e componentes existentes.
- `npm run bundle:android`: exportação concluída em `.expo/ci-android`, com as mesmas variáveis sem credenciais usadas pela CI.
- `git diff --check`: aprovado.
- ADB instalado; `adb devices` não encontrou aparelhos nem emuladores. Não houve teste nativo.
- Chaves locais Mapbox e Geoapify presentes; isso não comprova configuração do aplicativo distribuído.
- Consultas reais Geoapify retornaram HTTP 200. Autocomplete encontrou Praça do Derby, Hospital da Restauração e Terminal Integrado Joana Bezerra. Não encontrou ETE Cícero Dias e trouxe outras instituições para UFPE. Busca completa encontrou Universidade Federal de Pernambuco e Escola Técnica Estadual Cícero Dias pelo nome expandido. Cobertura de outras instituições e cidades permanece sem garantia.

## Contratos e bloqueios

Inspeção somente de leitura do backend `main` em `4a0afa9`: `RotaService.otimizarRota` consulta `OperacaoService.rotaAtiva` antes de qualquer cálculo legado. Esse snapshot inclui os embarques públicos aprovados. O DTO operacional fornece `alunoId`, referência, sentido e contadores; não fornece coordenadas para uma comparação independente ponto a ponto. As coordenadas usadas no mapa vêm do roteiro ativo.

A PR #62 do backend estava aberta como rascunho, sem merge, durante esta validação. A consulta de prévia de rascunho com horário passado e do roteiro salvo após execução depende dessa alteração. Nenhum teste HTTP autenticado de excursão em homologação foi realizado nesta sessão.

Issues #38/#40: correções de cache e reconciliação implementadas; aceite Android pendente. #37: estados e GPS cobertos por regressão; sincronização em duas contas pendente. #41: busca real investigada e corrigida, sem promessa de cobertura completa. #42: ajustes existentes da branch preservados. #39 depende também do backend #62. #43/#44 exigem aceite integrado de publicação, conflitos e FIXA/FLEXÍVEL. #45 permanece pendente por exigir dois Androids. Nenhuma dessas issues deve ser encerrada apenas com esta validação local.

## Checklist nos dois celulares

- [ ] Conferir mesma API e turma nas contas de motorista e passageiro; registrar commit do app e da API.
- [ ] Passageiro selecionar endereços distintos, confirmar IDA/VOLTA/AMBOS, reiniciar app e consultar a confirmação.
- [ ] Motorista iniciar IDA/VOLTA; conferir todos os pontos e a ordem. Visitar ponto, encerrar e iniciar segunda execução no mesmo dia: passageiro deve reaparecer.
- [ ] Repetir com paradas privadas e públicas FIXA/FLEXÍVEL, com e sem embarques aprovados, iniciando pela Home e pela gestão. Conferir extremos próprios e todos os pontos obrigatórios.
- [ ] Excursão: criar, editar, prévia, otimizar, publicar, iniciar/encerrar IDA e VOLTA e consultar roteiro salvo; validar motivos de bloqueio e conflito após integração do backend #62.
- [ ] Radar: início sem GPS, posição recente, expiração após 30 segundos, encerramento, troca de turma, background, rede indisponível e sessão expirada.
- [ ] Buscar escola, ETE, universidade, praça, terminal e hospital; confirmar pin manual, fonte grande, teclado e Safe Area Android.
- [ ] Exercitar falha Mapbox e mais de 25 waypoints: bloqueio explícito, sem eliminar embarques para contornar o limite.

Sem deploy, publicação de APK ou alteração de produção. Merge bloqueado até compatibilidade do backend e aceite integrado.
