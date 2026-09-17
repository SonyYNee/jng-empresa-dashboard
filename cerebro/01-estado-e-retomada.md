# Estado e retomada

## Identidade e repositório

- Projeto: **JNG Operadora de Turismo**, empresa de transporte e turismo de Osório, RS.
- Ambiente original: Windows, PowerShell, `C:\Users\SonyYNee\Desktop\JNG EMPRESAA`.
- Repositório: https://github.com/SonyYNee/jng-empresa-dashboard.
- Branch utilizada: `master`.
- Último commit funcional anterior a este cérebro: `1637a4c`, mínimo de quatro caracteres para senhas.
- Dashboard publicada: https://jng-dashboard.vertraweb.app.
- Landing publicada: https://jng-turismo.vertraweb.app.
- Banco de produção: PostgreSQL 17 da Vertra. SQLite é usado em testes e no ambiente local configurado para isso.
- Últimas alterações: correção de `Invalid time value` após login e redução do mínimo de senha para quatro caracteres. Não houve redefinição da senha existente.

## Retomar em outro sistema

1. Instale Git e Node.js compatível com `engines` do `package.json` (mínimo 22.13). A publicação foi verificada em Node 22.18.
2. Clone o repositório e entre na raiz.
3. Leia `AGENTS.md` e este cérebro antes de alterar código.
4. Execute `npm ci` e `npm run install:landing`.
5. Para trabalhar com SQLite local, configure `.env` a partir de `.env.example`, com `DATABASE_PATH=./data/dashboard.sqlite` e `PORT=3000`. Não use `NODE_ENV=production` para um servidor HTTP local.
6. Recupere o backup local consistente e as mídias, se necessário. Não sobrescreva o PostgreSQL de produção com uma cópia local antiga.
7. Execute `npm start` em um terminal e `npm run dev:landing` em outro. Links: http://localhost:3000 e http://localhost:4173.
8. Execute `npm test`, `npm run build:landing` e `npm run format:check`.
9. Para produção, restaure acessos privados em local seguro e confira os recursos atuais na Vertra. Não suponha que uma credencial antiga ainda seja válida.

O `.env` original presente no computador pode conter a conexão de um PostgreSQL antigo que recusou conexão. Ele é preservado como evidência, não recomendado como configuração atual. A conexão usada na publicação está no material privado de produção e nas variáveis da Vertra.

## Recuperação sem GitHub

O backup privado contém uma cópia do código rastreado e um bundle Git. O bundle pode ser clonado com `git clone caminho/arquivo.bundle jng-projeto`. Depois instale as dependências. Não é necessário preservar `node_modules` para reconstruir o projeto.

## Acesso à dashboard

O proprietário existente foi migrado com o hash da senha. O identificador de acesso está nas notas privadas; a senha original não é recuperável a partir do hash. O usuário solicitou ajuda para lembrar o acesso, mas não autorizou nem recebeu uma redefinição de senha naquela conversa. Mudar o mínimo permitido não muda a senha de nenhuma conta.
