# Validação do frontend

Use Node.js 22, a partir de 22.13, conforme os engines do React Native instalado.

```powershell
npm ci
npm run check
git diff --check
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_OFFLINE = '1'
npm run bundle:android
```

Use um terminal separado para essa verificação ou remova `EXPO_NO_DOTENV` e
`EXPO_OFFLINE` da sessão antes de voltar ao desenvolvimento normal com `.env`.

O workflow `.github/workflows/frontend.yml` executa em push para `main` e PRs
destinados à `main`. Instala o lockfile com `npm ci`, usa cache do npm associado
ao lockfile e interrompe ao falhar arquitetura, TypeScript, testes ou exportação.
O token tem somente `contents: read` e não é persistido no checkout.

A exportação gera apenas JavaScript/Hermes e assets em `.expo/ci-android`.
Não executa Firebase, não envia notificações e não compila APK, inicia backend,
faz deploy ou usa EAS. Nenhuma credencial é necessária. `.env` é ignorado na
exportação de CI; não se publicam bundles nem se enviam artifacts com variáveis.

Depois do push manual autorizado, abra Actions → Validação do frontend,
confira o SHA do commit e aguarde os quatro passos concluírem. Para PRs, confira
também a execução do evento `pull_request`. Falhas devem ser corrigidas, sem
`continue-on-error` ou desativação de testes. Tornar o job obrigatório em branch
protection é uma configuração remota separada, que não foi alterada aqui.

Sem execução remota do novo workflow, só é possível afirmar validação local.

Referências: [setup-node](https://github.com/actions/setup-node/tree/v6),
[checkout](https://github.com/actions/checkout/tree/v6),
[variáveis Expo](https://docs.expo.dev/guides/environment-variables/).
