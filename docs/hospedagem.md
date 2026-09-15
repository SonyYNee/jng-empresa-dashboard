# Hospedagem na Vertra Cloud

## Aplicações

| Serviço    | Endereço                             | Recurso                                |
| ---------- | ------------------------------------ | -------------------------------------- |
| Dashboard  | https://jng-dashboard.vertraweb.app  | `1b98fb57-da05-4c5c-b429-0dadfbbbbd4f` |
| Landing    | https://jng-turismo.vertraweb.app    | `7edf8c9c-8ad6-40a7-8757-f936d513eb9e` |
| PostgreSQL | Acesso privado da aplicação, com TLS | `f7de5a85-7524-413a-951c-d85862d7e571` |

A dashboard usa PostgreSQL 17. A landing consulta somente as APIs públicas e as mídias pela dashboard; não recebe credenciais do banco nem encaminha cookies de usuários. Os dois servidores têm `/healthz` para verificação. A saúde da dashboard inclui uma consulta ao PostgreSQL.

## Configuração

Na dashboard, configure `NODE_ENV=production`, `PORT=80`, `APP_ORIGIN`, `DATABASE_URL` e `PGSSL=true`. Os caminhos `PGSSLROOTCERT`, `PGSSLCERT` e `PGSSLKEY` apontam para os certificados privados instalados na aplicação. A conexão verifica o certificado do servidor e usa um pool compartilhado com no máximo cinco conexões. Não defina `DATABASE_PATH` em produção.

Na landing, configure `NODE_ENV=production`, `PORT=80` e `DASHBOARD_ORIGIN=https://jng-dashboard.vertraweb.app`.

As credenciais reais ficam nas variáveis da Vertra e nos arquivos privados de certificado. Nunca as adicione ao Git. Os usuários existentes foram migrados; o primeiro acesso não precisa ser recriado. Sessões locais não são migradas: faça login novamente.

## Preparar atualização

Na raiz do projeto:

```sh
npm ci
npm run install:landing
npm test
npm run build:landing
npm run format:check
npm run package:deploy
```

Os dois ZIPs são gerados em `artifacts/`, com caminhos compatíveis com Linux. O pacote da dashboard contém o servidor e sua interface. O pacote da landing contém o servidor de produção e o build pronto; não usa Vite em produção.

Antes de atualizar, crie snapshots na Vertra. Os pacotes de código não incluem dados nem certificados. Preserve `data/media/` e `certs/` da aplicação ao atualizar; faça backup desses diretórios antes de qualquer substituição de arquivos. `MEDIA_DIR` permite indicar outro diretório persistente, se configurado na hospedagem.

Após o envio, confira as variáveis de ambiente e inicie/reinicie a aplicação. Nesta publicação, as variáveis enviadas na criação só ficaram disponíveis após uma nova inicialização.

## Migração local para PostgreSQL

`deploy/migrate-sqlite.mjs` importa um backup SQLite consistente para um PostgreSQL vazio. Exige `SQLITE_SOURCE`, `DATABASE_URL` e a configuração TLS. O script aborta se encontrar registros no destino e executa a importação em uma transação. Não execute sobre um banco já em uso.

`deploy/extract-media.mjs` extrai mídias antigas embutidas em base64, sem recompressão. Usa `SQLITE_SOURCE` e `MEDIA_EXPORT_DIR` e gera um manifesto de substituições. Publique os arquivos antes de substituir as referências no banco; valide o hash dos registros para não sobrescrever alterações posteriores.

Os testes PostgreSQL locais usam PGlite para conferir schema, IDs, valores decimais e vínculos. A conexão TLS e as consultas também devem ser verificadas no PostgreSQL real após o deploy.
