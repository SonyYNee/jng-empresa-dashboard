# Arquitetura e dados

## Stack e organização

JavaScript com módulos ES, servidor HTTP nativo do Node e interfaces em HTML/CSS/JavaScript. Não é React/Next; não aplicar uma migração de stack por mera disponibilidade de uma skill.

| Caminho                                | Responsabilidade                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/dashboard/src/server.js`         | HTTP, autenticação, usuários, sessões, visão geral, migrations básicas e arquivos públicos |
| `apps/dashboard/src/db.js`             | Adaptador assíncrono SQLite/PostgreSQL, pool, transações e TLS                             |
| `apps/dashboard/src/fleet.js`          | Veículos, abastecimentos, manutenção e financeiro                                          |
| `apps/dashboard/src/routes.js`         | Rotas, vínculos, validação e publicação                                                    |
| `apps/dashboard/src/route-distance.js` | Extração de pontos e cálculo de distância                                                  |
| `apps/dashboard/src/events.js`         | Eventos e projeção pública                                                                 |
| `apps/dashboard/src/trips.js`          | Pacotes, recorrência e projeção pública                                                    |
| `apps/dashboard/src/social.js`         | Canais oficiais                                                                            |
| `apps/dashboard/src/media.js`          | Upload e leitura de mídia, incluindo Range                                                 |
| `apps/dashboard/public/`               | Aplicação da dashboard e seus assets                                                       |
| `apps/dashboard/tests/`                | Testes de backend, datas, PostgreSQL e mídia                                               |
| `apps/landing/src/`                    | Páginas, componentes de template, serviços, orçamento e estilos                            |
| `apps/landing/server.js`               | Servidor de produção: build estático e proxy público                                       |
| `apps/landing/scripts/prerender.mjs`   | Geração de páginas estáticas a partir do build                                             |
| `apps/landing/tests/`                  | Páginas, orçamento, eventos, serviços e hospedagem                                         |
| `deploy/`                              | Pacotes, configurações Vertra e utilitários de migração                                    |
| `data/`                                | SQLite e mídias locais, ignorados pelo Git                                                 |
| `certs/`                               | Certificados privados, ignorados pelo Git                                                  |
| `assets/originais/`                    | Originais preservados da identidade visual                                                 |
| `artifacts/`                           | Pacotes e evidências temporárias, inclusive privadas; não publicar                         |

Os arquivos de configuração na raiz são intencionais: `package.json`, lockfile, `.editorconfig`, Prettier, Git, README e AGENTS. O pedido de “nada avulso” não significa mover arquivos obrigatórios das ferramentas para locais que as quebrem.

## Fluxo de dados

Dashboard → PostgreSQL e diretório de mídia. Landing → seu servidor de produção → APIs públicas/mídias da dashboard. No desenvolvimento, Vite faz o proxy para `127.0.0.1:3000`.

A landing encaminha apenas `/api/public/fleet`, `/api/public/routes`, `/api/public/social`, `/api/public/trips`, `/api/public/events` e nomes de mídia válidos. Não encaminha cookies nem Authorization, não expõe APIs administrativas e permite apenas GET/HEAD. Vídeos preservam `Range`, `Content-Range` e respostas 206.

## Persistência e modelos

- `users`: nome, e-mail, hash scrypt com salt, cargo, foto e criação.
- `sessions`: hash do token, usuário e expiração; cookie HttpOnly, SameSite=Lax e Secure em produção.
- `activity`: usuário, ação, data e cargo registrado no acesso.
- `vehicles`: placa, modelo, ano, lugares, odômetro, capacidades e fotos JSON.
- `refills`: veículo, combustível/ARLA, data, odômetro, litros, preço, total e tanque completo. O SQLite antigo usava `full`; a produção usa `tank_full`. O importador faz essa conversão.
- `maintenance`: veículo, descrição, data, valor, status e recorrência.
- `vehicle_entries`: lançamentos financeiros do veículo.
- `transport_routes`: endereços, paradas JSON, tipo, estado, dias, horários, distância, veículo, motorista, observações, valores e datas.
- `company_social`: registro único com JSON de canais.
- `company_events` e `company_trips`: ID sequencial e JSON de dados.

Valores financeiros de frota usam centavos; preço por litro usa milésimos. Preços de rota são valores decimais, não reinterpretar como centavos. Conferir a conversão no módulo antes de mexer em relatórios.

## Permissões

`owner`, `manager`, `hr`, `fleet`, `driver`, `member`. Proprietário gerencia contas/cargos e redes sociais; proprietário/gerente gerenciam eventos e viagens; proprietário/gerente/coordenador de frota gerenciam frota e rotas. O servidor decide as permissões, não só a visibilidade dos botões. Deve restar pelo menos um proprietário. Confirmar regras particulares no código e nos testes antes de expandir acesso.

## Datas e compatibilidade

PostgreSQL retorna timestamps ISO com fuso e `COUNT` como string; SQLite pode retornar timestamps sem fuso e números nativos. Converter contagens explicitamente para número. Não acrescentar `Z` a uma data que já tenha `Z` ou deslocamento. O formatador da dashboard retorna “Data indisponível” para entrada inválida, em vez de derrubar a tela.

O adaptador deve normalizar SQL somente no caminho SQLite. Preservar `SERIAL`, `TIMESTAMPTZ` e demais tipos no PostgreSQL. Inicialização dos módulos é assíncrona e aguardada antes do uso. Não criar uma tabela de rotas incompleta antes do schema completo do módulo.

## Mídia

Uploads são gravados como arquivos e retornam `/media/...`. Os formatos suportados incluem JPG, PNG, GIF, WebP, MP4 e WebM. Há fluxo de leitura parcial para vídeo. A galeria não deve recomprimir arquivos de marketing por padrão. Fotos de perfil têm regra separada e podem ser reduzidas/recortadas.

Na migração, mídias base64 antigas foram extraídas byte a byte para arquivos com nomes SHA-256. Os JSONs passaram a guardar URLs. Não converter esses arquivos para miniaturas menores como substituição do original.
