# JNG Dashboard

Dashboard em português com login e visão geral. Node.js 22.13+ (recomendado 24), SQLite persistente e CSS simples, sem dependências externas.

## Configurações e equipe

Acesse `/configuracoes` para editar nome, e-mail, foto e senha. A mudança de e-mail exige a senha atual. A troca de senha exige confirmação e encerra todas as sessões da conta. Fotos JPG/PNG de até 5 MB são recortadas centralmente e reduzidas no navegador; o servidor aceita até 512 KB e armazena a foto no SQLite, junto ao perfil.

Cargos: Proprietário (`owner`), Gerente de Operações (`manager`), Recursos Humanos (`hr`), Coordenador de Frota (`fleet`), Motorista (`driver`) e Colaborador (`member`). A conta inicial recebe o cargo de Proprietário. A migração preserva os usuários existentes e atribui esse cargo à primeira conta; as demais recebem Colaborador. A aba `/usuarios` permite que proprietários cadastrem profissionais com nome, e-mail, senha inicial e cargo, e alterem os cargos existentes. Os demais perfis não podem listar nem administrar usuários. As permissões são verificadas no servidor a cada requisição e as mudanças valem nas sessões abertas. A empresa deve manter pelo menos um proprietário. A senha inicial não é enviada por e-mail; o proprietário deve fornecê-la ao profissional por um canal apropriado. Não há edição de cargo nas configurações pessoais.

Proprietário, gerente e RH visualizam os últimos dez acessos da equipe; os demais visualizam os próprios. Cada registro mostra nome e foto atuais, com o cargo registrado no momento do login. Registros anteriores à migração recebem o cargo existente durante a migração. As colunas novas são criadas automaticamente ao iniciar a aplicação.

## Frota

A aba `/frota` cadastra veículos por placa única, modelo, ano, lugares, quilometragem e capacidades de combustível e ARLA. Aceita até cinco fotos JPG/PNG de 5 MB cada, reduzidas no navegador e gravadas no banco. Proprietário, Gerente de Operações e Coordenador de Frota podem cadastrar e editar; demais usuários autenticados podem consultar.

Cada veículo possui resumo, abastecimentos/ARLA, manutenção, financeiro e edição dos dados/fotos. Faturamento e despesas são lançados por data. Os cards mostram totais acumulados: custos incluem combustível, ARLA, manutenção realizada, custos fixos e outros custos; lucro é faturamento menos custos totais. Custos fixos são lançados a cada ocorrência, sem projeção ou cobrança automática. Manutenções agendadas só entram no custo quando concluídas. Recorrências mensais, trimestrais, semestrais e anuais geram a próxima data a partir da realização; dias inexistentes são ajustados ao último dia do mês.

A média em km/L usa distância e litros acumulados entre tanques completos, incluindo os parciais intermediários. O primeiro tanque completo é a referência, e seus litros não entram no ciclo seguinte. Combustível e ARLA têm cálculos independentes. O saldo estimado usa a última referência de tanque cheio, os abastecimentos posteriores e a quilometragem atual; não é leitura de sensor. Sem referência/média suficientes, fica indisponível. Inconsistências com a capacidade são sinalizadas. Atualize a quilometragem em Dados e fotos para recalcular a estimativa. Registre abastecimentos em ordem cronológica; não repita o mesmo produto na mesma quilometragem.

Totais financeiros são gravados em centavos e preços por litro em milésimos de real. Não duplique no financeiro os gastos já registrados em abastecimento ou manutenção.

## Rotas

A aba `/rotas` cadastra trajetos a partir de links HTTPS do Google Maps, com nome, tipo de operação, situação, origem, destino e até 30 paradas intermediárias ordenadas. Cada parada pode ter horário e orientação. Cada rota tem dias de operação, saída/chegada (incluindo dia seguinte), distância manual, veículo, motorista e observações. O card abre seu painel individual e permite editar todos os dados. Proprietário, Gerente de Operações e Coordenador de Frota podem gerenciar; os demais usuários autenticados podem consultar.

“Ler pontos do link” extrai parâmetros de direções e endereços legíveis de URLs. Links encurtados são resolvidos com até quatro redirecionamentos, somente em domínios/caminhos do Maps permitidos, com timeout. Quando os pontos não estiverem legíveis, o preenchimento é manual. O link original é preservado; alterar paradas no painel não modifica o trajeto salvo no Google. Não há cálculo ou atualização automática de distância, trânsito ou horários. Referência de formato: https://developers.google.com/maps/documentation/urls/get-started.

Veículos e motoristas são vinculados aos cadastros existentes. Excluir um veículo remove apenas seu vínculo com a rota, preservando o roteiro. Não há envio automático aos motoristas nem lançamento financeiro automático por rota.

## Iniciar o painel

```sh
npm start
```

Abra http://localhost:3000. No primeiro acesso, preencha nome, e-mail, senha (mínimo 12 caracteres) e o código exibido no terminal. A configuração inicial fecha automaticamente depois da criação do administrador. Não há senha padrão.

## Banco e autenticação

Banco em `data/dashboard.sqlite`, com tabelas users, sessions e activity. Senhas usam scrypt com salt aleatório; sessões de 8 horas usam cookies HttpOnly e tokens armazenados como SHA-256. Inclui validação de origem, consultas parametrizadas e limite de tentativas de login. A visão geral mostra dados reais de acesso, sem indicadores empresariais fictícios.

## Vertra

Configure aplicação Node.js 24, comando `npm start`, arquivo principal `server.js`, porta pela variável `PORT`. Variáveis de produção:

- `NODE_ENV=production`
- `APP_ORIGIN=https://seu-dominio` (origem exata, sem barra final)
- `SETUP_TOKEN`: segredo aleatório para liberar a criação do primeiro administrador; remova após o cadastro.
- `DATABASE_PATH`: caminho em armazenamento persistente, por exemplo `/data/dashboard.sqlite`.

É obrigatório manter o arquivo SQLite em armazenamento persistente e realizar backups. Não publique com o banco em diretório substituído pelos deploys. Esta primeira versão opera em uma instância; se precisar de múltiplas réplicas, migre para PostgreSQL. A chave da API Vertra não faz parte do código.

## Verificar

### Distância automática das rotas

O calculo usa OSRM / OpenStreetMap, sem chave ou API paga, pelos pontos do link original do Google Maps. Atualize o link quando mudar o percurso. Os enderecos continuam visiveis; coordenadas sao usadas apenas internamente. Servico publico para testes leves: cache de 24 horas, fila com limite de uma consulta por segundo e sem garantia de disponibilidade. Nao e perfil especifico de onibus; confira restricoes de circulacao. O percurso e os km podem diferir do Google Maps. Links sem pontos reconheciveis permitem preenchimento manual.

```sh
npm test
```

