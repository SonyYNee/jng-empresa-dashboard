# JNG — dashboard e site comercial

## Organização

| Pasta                    | Conteúdo                                              |
| ------------------------ | ----------------------------------------------------- |
| `apps/dashboard/src/`    | Servidor, autenticação, banco e regras dos módulos    |
| `apps/dashboard/public/` | Interface da dashboard: HTML, CSS e JavaScript        |
| `apps/dashboard/tests/`  | Testes da dashboard e das APIs                        |
| `apps/landing/`          | Landing page, seus testes, assets e configuração Vite |
| `assets/originais/`      | Imagens originais de referência, preservadas          |
| `data/`                  | Banco local e mídias cadastradas; não versionar       |
| `certs/`                 | Certificados locais; não versionar                    |
| `deploy/dashboard/`      | Configuração de contêiner da dashboard                |
| `docs/`                  | Documentação funcional e de manutenção                |

Os arquivos na raiz são pontos de entrada necessários às ferramentas: `package.json`, lockfile, `.env`, configurações do Git e do formatador, este guia e `AGENTS.md`. As credenciais permanecem no `.env` local e não devem entrar no repositório.

## Executar localmente

Requer Node.js 22.13 ou superior. Na raiz:

```sh
npm ci
npm run install:landing
npm start
```

Em outro terminal, também na raiz:

```sh
npm run dev:landing
```

- Dashboard: http://localhost:3000
- Landing: http://localhost:4173

A landing usa o proxy Vite para consultar a dashboard local. Preserve o `.env`, `data/` e `certs/` existentes. Execute os comandos pela raiz para manter os caminhos relativos configurados no ambiente.

## Manutenção

```sh
npm test
npm run build:landing
npm run format
npm run format:check
```

`npm test` executa as duas suítes. O build da landing é gerado em `apps/landing/dist/`. Dependências e arquivos gerados ficam fora do versionamento.

As regras de estilo estão em [AGENTS.md](AGENTS.md). A documentação funcional está em [docs/dashboard.md](docs/dashboard.md) e [apps/landing/README.md](apps/landing/README.md).

O Dockerfile da dashboard deve usar a raiz como contexto: `docker build -f deploy/dashboard/Dockerfile .`.

## Produção

- Dashboard: https://jng-dashboard.vertraweb.app
- Landing: https://jng-turismo.vertraweb.app

As aplicações são separadas e a dashboard usa PostgreSQL. Consulte [docs/hospedagem.md](docs/hospedagem.md) para configuração, pacotes, backups e atualizações.
