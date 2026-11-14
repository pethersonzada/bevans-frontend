# Ambientes remotos do aplicativo

O `.env` existente foi preservado. Não se exige Spring Boot local.

Configure `EXPO_PUBLIC_APP_ENV=development`, `staging` ou `production`.
Preencha a URL no campo correspondente:

- `EXPO_PUBLIC_API_URL_DEVELOPMENT`: API de desenvolvimento, que pode ser remota.
- `EXPO_PUBLIC_API_URL_STAGING`: URL HTTPS da homologação isolada, ainda não confirmada.
- `EXPO_PUBLIC_API_URL_PRODUCTION`: URL HTTPS de produção, somente em build autorizado.

`EXPO_PUBLIC_API_URL` continua compatível exclusivamente com desenvolvimento.
Homologação e produção nunca herdam essa variável. URL ausente/inválida bloqueia
a requisição com mensagem de configuração; não usa domínio ou IP de exemplo.
Reinicie o bundle Expo após mudar variáveis públicas. São incorporadas no build.

`EXPO_PUBLIC_CONVITE_WEB_URL` deve conter a página HTTPS real de inscrição do
webapp, sem query/fragmento, conforme a rota acordada com o webapp #14. Ainda
precisa ser preenchida; o aplicativo não fabrica domínio nem token. O segredo
retornado pela API é anexado ao fragmento local apenas para compartilhar.

Nunca coloque chave Firebase Admin, credenciais PostgreSQL, JWT de usuário ou
token secreto Mapbox de download em `EXPO_PUBLIC_*`. Somente configuração pública
do cliente pertence a essas variáveis.

Exclusão de conta: HTTP 202 registra processamento pendente e encerra a sessão;
não afirma exclusão Firebase concluída. HTTP 409 mantém a sessão e mostra o erro.
HTTP 503 não invalida a sessão Firebase. Nenhum worker remoto é habilitado.

Não foi realizado push, deploy, EAS ou teste com dados de produção.
