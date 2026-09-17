# Hospedagem e operação

Leia também `docs/hospedagem.md`. Recursos criados em 15/09/2026:

| Recurso    | ID                                     | Link                                     |
| ---------- | -------------------------------------- | ---------------------------------------- |
| Dashboard  | `1b98fb57-da05-4c5c-b429-0dadfbbbbd4f` | https://jng-dashboard.vertraweb.app      |
| Landing    | `7edf8c9c-8ad6-40a7-8757-f936d513eb9e` | https://jng-turismo.vertraweb.app        |
| PostgreSQL | `f7de5a85-7524-413a-951c-d85862d7e571` | Gerenciado na Vertra, sem página pública |

Na criação, o plano existente tinha 2048 MB: 512 para cada app e 1024 para PostgreSQL. Não houve compra de créditos. Esses limites e a validade do plano são temporais: confira o painel antes de mudanças.

## Ambiente

Dashboard: `NODE_ENV=production`, `PORT=80`, `APP_ORIGIN`, `DATABASE_URL`, `PGSSL=true`, `PGSSLROOTCERT`, `PGSSLCERT`, `PGSSLKEY`. Produção não deve ter `DATABASE_PATH`. Certificados incluem CA, certificado cliente e chave privada; `rejectUnauthorized` permanece verdadeiro.

Landing: `NODE_ENV=production`, `PORT=80`, `DASHBOARD_ORIGIN=https://jng-dashboard.vertraweb.app`. Servir com `node server.js`, não Vite dev/preview.

O token Vertra é para operações administrativas, não deve entrar no frontend nem no pacote da landing. Recupere/revalide pelo painel se necessário. A documentação oficial está em https://docs.vertracloud.app; alguns endpoints documentados estavam desatualizados.

## Contratos observados na publicação

Base: `https://api.vertracloud.app`, autenticação Bearer. Confirmar que continuam válidos antes de reutilizar.

- `GET /v1/users/me`: perfil, plano, apps e bancos.
- `GET /v1/apps/status` e `GET /v1/databases/status`: inventário de execução.
- `POST /v1/apps`: multipart com arquivo ZIP, name, main, start, version, memory, subdomain e envs JSON.
- `GET /v1/apps/{id}/envs`; `POST /v1/apps/{id}/envs`: variáveis.
- `POST /v1/apps/{id}/start` e `/restart`: iniciar/reiniciar.
- `GET /v1/apps/{id}/logs`: logs, com cuidado para não imprimir segredos.
- `PUT /v1/apps/{id}/files?path=...`, JSON `{content: ...}`: atualizar arquivo específico. Usado para as correções de datas e senhas.
- `POST /v1/apps/{id}/files/upload?restart=true`: envio de ZIP.
- `POST /v1/databases`: JSON com name, description, type=1 e ram para PostgreSQL.
- `GET /v1/databases/{id}/credentials/certificate`: bundle de certificados.
- `POST /v1/databases/{id}/credentials/reset`: troca a senha. Foi usado no banco recém-criado; não executar novamente em produção sem coordenar as envs da aplicação.
- `POST /v1/users/{resourceId}/snapshots?scope=applications|databases`: snapshot.
- `GET /v1/users/{resourceId}/snapshots/{snapshotId}/download?scope=...`: download do snapshot.

Não confundir reset de credenciais com reset destrutivo de banco. Nunca chamar reset do banco para tentar resolver conexão.

## Migração realizada

Foi criado backup consistente do SQLite, incluindo WAL via API de backup. Importação em transação para destino vazio: 2 usuários, 1 veículo, 2 abastecimentos, 2 manutenções, 1 lançamento financeiro, 3 rotas, 1 configuração social, 1 evento, 1 viagem e 9 atividades. Esses números são históricos; o cliente pode ter alterado os dados depois.

Sessões não foram copiadas. IDs foram preservados e sequências ajustadas. Campo legado `full` virou `tank_full`. Valores booleanos foram convertidos. Mídias locais foram copiadas; imagens base64 antigas foram depois extraídas sem recompressão e referências atualizadas somente após conferir que os registros não tinham mudado.

## Verificação e atualização

Testar `/healthz`, raiz, links diretos, assets, APIs públicas e um arquivo de mídia. As APIs administrativas sem sessão devem retornar 401; a landing não pode funcionar como proxy dessas APIs. Comparar arquivos publicados e hashes de mídia quando houver mudança de upload.

Criar snapshots antes de atualização. Preservar `data/media/` e `certs/`; pacotes de código padrão não incluem esses diretórios privados. Alterações de servidor exigem reinicialização; edição de `public/app.js` foi lida imediatamente, mas o navegador pode precisar de Ctrl+F5.

O GitHub não substitui backup PostgreSQL nem contém uploads reais. Snapshots têm prazo de expiração informado pela Vertra; o material privado deste cérebro inclui as respostas e os downloads disponíveis na data da captura.
