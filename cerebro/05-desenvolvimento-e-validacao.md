# Padrão de desenvolvimento e validação

## Regras do usuário

`AGENTS.md` é a fonte principal e deve ser lido integralmente. Resumo: dois espaços, nunca TAB; preservar lógica ao formatar; código curto compacto; condições complexas legíveis; uma linha em branco entre blocos importantes; sem múltiplas linhas vazias nem espaços finais; uma quebra final; comentários sobre decisões não óbvias; nomes claros; sem abstrações e arquivos desnecessários. Preservar o padrão predominante do módulo. “Consistência > preferência pessoal”.

Prettier: largura 100, aspas simples, ponto e vírgula, trailing comma, LF. `.editorconfig` e `.gitattributes` complementam. O usuário pediu explicitamente `npm run format` e `npm run format:check` e ambos foram executados.

## Forma de colaborar

- Comunicar em português, de forma direta e com atualizações úteis durante tarefas longas.
- Executar o trabalho solicitado, sem parar apenas em propostas.
- Tratar “continue” como retomada do objetivo anterior.
- Distinguir pedido de melhoria visual de autorização para reescrever regras de negócio.
- Não assumir publicação quando o pedido for somente localhost; publicação agora está autorizada para este projeto, mas confirmar o escopo de mudanças futuras pelas instruções do turno.
- Não enviar mensagens reais a clientes/WhatsApp para testar. Preparar o link não é enviar.
- Não inventar resultados de navegador. Nesta sessão, o controle de navegador retornou inventário vazio; a validação usou testes, HTTP, conteúdo remoto e hashes.
- Nunca exibir tokens, senhas, conexão PostgreSQL completa ou chaves privadas em logs ou commits.
- Não copiar a pasta privada para o repositório público.

## Comandos

```sh
npm ci
npm run install:landing
npm start
npm run dev:landing
npm test
npm run build:landing
npm run format
npm run format:check
npm run package:deploy
```

Os dois comandos de servidor rodam em terminais separados. O empacotador atual é PowerShell; em Linux/macOS, adapte a geração ZIP preservando caminhos `/`, ou use um ambiente com PowerShell. Não reintroduza ZIPs com barras invertidas.

## Cobertura existente

Backend: autenticação, bootstrap, persistência, permissões, contas/cargos, troca de senha, datas, frota, custos, manutenção, odômetro, abastecimentos, rotas, exclusão de vínculos, OSRM, proteção de links Maps, eventos, viagens e upload sem perda/Range. PostgreSQL: PGlite verifica schema e semântica; não substitui teste TLS no serviço real.

Landing: renderização de páginas, eventos e galerias, movimento reduzido, wizard e retorno entre etapas, calendário temático, WhatsApp, preenchimento vindo da rota, filtros, seleção de destaques, validação e proxy de produção isolado.

Na publicação foram 26 testes; a correção posterior das datas adicionou mais um. O relatório do snapshot registra a contagem realmente executada na captura atual. Não afirmar “100% testado” ou “perfeito em todos os celulares” com base apenas nisso.

## Windows e edição

Usar UTF-8 explicitamente ao ler/gravar arquivos. Houve risco de caracteres virarem `?` ao passar Unicode por PowerShell/Python; preferir patches ou escapes Unicode em scripts transportados pelo shell. Não interpretar mojibake do console como prova de corrupção sem ler os bytes com UTF-8.

Antes de mover ou apagar pastas, resolver e conferir o caminho absoluto dentro do projeto. Não apagar bancos, certificados, uploads ou originais sob o rótulo de “limpeza”. Buscar arquivos com `rg`, limitando linhas enormes que contêm fontes/imagens base64.
