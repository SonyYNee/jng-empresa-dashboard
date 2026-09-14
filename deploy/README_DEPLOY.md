Resumo de deploy para VertraCloud

Observação de limite: não é possível executar chamadas externas a partir deste ambiente; rode os comandos abaixo no seu terminal.

Passos principais (exemplo usando Docker Hub):

1) Build e push da imagem

- Ajuste variáveis e execute:

```bash
# defina seu registro, nome da imagem e tag
export REGISTRY=docker.io
export IMAGE_NAME=SEU_USUARIO/dashboard
export TAG=latest
# faça login se necessário
docker login $REGISTRY
# build e push
./deploy/build_and_push.sh
```

2) Criar projeto e banco gerenciado na VertraCloud

- Acesse o painel da VertraCloud ou use a API da VertraCloud (substitua ${VERTRA_API_KEY}).
- Crie um projeto (ex.: `dashboard`).
- Crie um banco PostgreSQL gerenciado (ex.: `dashboard`) e anote a connection string (DATABASE_URL).

3) Configurar variáveis de ambiente no projeto VertraCloud

- Defina `DATABASE_URL` com a connection string do passo anterior.
- Defina `NODE_ENV=production`, `PORT=3000`, `SETUP_TOKEN` (opcional).

4) Deploy da imagem

- Na VertraCloud, configure o deploy apontando para a imagem que você publicou: `REGISTRY/IMAGE_NAME:TAG`.
- Se a VertraCloud construir a imagem a partir do repositório, configure as variáveis de build e branch.

5) Rodar migrations e seed

- O `server.js` já roda `migrate()` ao iniciar, então, após a app ter acesso ao DB, as tabelas serão criadas.
- Para criar o usuário owner (jngempresa@gmail.com / jngempresa), rode localmente (ou via runner one-off) o script de seed:

```bash
# exemplo local (quando o DB estiver acessível a partir da sua máquina)
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/dashboard"
export IMAGE=REGISTRY/IMAGE_NAME:TAG
./deploy/run_seed.sh
```

Ou (se usando a VertraCloud) rode um comando one-off na plataforma que execute `node scripts/seed.js` com `DATABASE_URL` configurado.

6) Testar

- Acesse a URL da aplicação (configure domínio via painel da VertraCloud) e verifique `/api/me` e páginas públicas.

Segurança:
- Rotacione a sua `VERTRA_API_KEY` após uso.
- Não commit a `.env` com chaves.

Se quiser, eu gero os cURL de exemplo para a API da VertraCloud — envie os endpoints da API (ou me diga para usar placeholders) e eu preencho os exemplos com a sua chave (mas não conseguirei executá-los daqui).

Automação via GitHub Actions

1) Configure os segredos do repositório (Settings → Secrets):

- `DOCKERHUB_USERNAME` — seu usuário Docker Hub
- `DOCKERHUB_TOKEN` — token/password do Docker Hub
- `VERTRA_API_KEY` — sua chave da VertraCloud
- `VERTRA_API_URL` — opcional (se diferente do padrão)

2) Pushe este repositório para GitHub na branch `main`.
O workflow `.github/workflows/deploy-vertra.yml` será executado e tentará:
- construir e publicar a imagem para `docker.io/jngempresa/dashboard:latest`
- chamar a API da VertraCloud (placeholders) para criar projeto, banco, app, domínio e disparar deploy

Nota: o workflow usa endpoints de placeholder para a VertraCloud — confirme os caminhos da API na documentação da VertraCloud e ajuste `.github/workflows/deploy-vertra.yml` conforme necessário.