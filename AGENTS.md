# Padrão de código

Para retomar o contexto deste projeto, leia primeiro `cerebro/LEIA-PRIMEIRO.md` e os documentos indicados ali. Nunca publique `cerebro/privado/`, que contém backups e credenciais.

Estas regras se aplicam à dashboard e à landing page em `apps/landing/`.

- Use 2 espaços por nível de indentação, nunca TAB.
- Preserve a lógica ao formatar. Não renomeie variáveis, extraia funções ou reorganize imports com efeitos colaterais apenas para ajustar a apresentação.
- Observe o padrão predominante do arquivo e do módulo. Consistência tem prioridade sobre preferência pessoal, exceto quando o padrão prejudicar claramente a leitura.
- Mantenha código curto e legível compacto. Não quebre parâmetros, objetos ou JSX simples em várias linhas apenas por estética.
- Divida código complexo em blocos claros. Separe blocos lógicos importantes com uma linha em branco, sem acumular linhas vazias.
- Remova espaços no final das linhas e termine cada arquivo com uma única quebra de linha.
- Use espaços em condições e antes de chaves, como `if (condition) {`. Preserve o padrão existente de aspas e ponto e vírgula.
- Organize objetos maiores por responsabilidade e mantenha condições de negócio complexas fáceis de ler.
- Agrupe imports em bibliotecas externas, componentes internos, hooks/services/utilities, types e styles/assets quando essas categorias existirem. Separe grupos somente quando melhorar a leitura e preserve a ordem necessária à execução.
- Comentários devem explicar decisões, regras e comportamentos não óbvios. Evite comentários que apenas repetem o código.
- Em código novo, prefira nomes claros e específicos a nomes genéricos como `data`, `temp`, `obj` ou `value` quando houver uma alternativa melhor.
- Evite abstrações desnecessárias, funções minúsculas sem propósito e arquivos criados apenas para aumentar a modularização. Mantenha funções relacionadas visualmente próximas.
- Não faça refatorações de comportamento junto de alterações exclusivamente de formatação.

## Verificação

A configuração compartilhada está em `.prettierrc.json` e `.editorconfig`. Execute os comandos na raiz do projeto:

```sh
npm run format
npm run format:check
```

O formatador aplica as regras mecânicas. Revise também a legibilidade, a organização dos blocos e os comentários; essas decisões exigem julgamento e não justificam mudanças na lógica.
