# Limites, pendências e cuidados ao continuar

1. **Contexto completo disponível, não memória infalível.** Preservar fontes brutas não garante que toda conversa antiga, screenshot ou anexo tenha sido gravado pelo cliente. Não prometer contextualização literalmente perfeita. Consulte a cobertura do manifesto.
2. **Backup fora do PC.** A pasta privada local precisa ser copiada para outro dispositivo/local antes da formatação. GitHub contém apenas a parte pública.
3. **Banco local não é produção.** O SQLite preservado é histórico e pode estar defasado. A verdade atual de produção é PostgreSQL. Não importar SQLite sobre um banco com registros.
4. **Compatibilidade local antiga.** O SQLite legado usa `refills.full`; produção usa `tank_full`. O importador converte. Antes de voltar a cadastrar abastecimentos em uma cópia SQLite antiga, verificar a migração desse campo; testes com banco novo não provam compatibilidade de todo banco legado.
5. **Documentação antiga.** `docs/dashboard.md` e `apps/landing/README.md` contêm trechos de estágios iniciais (limites de fotos, SQLite, demonstrações, setup). Este cérebro e o código corrente prevalecem quando houver evidência de atualização posterior. Evitar apagar história silenciosamente.
6. **Conteúdo demonstrativo.** `src/data.js`, prerender, assets e `road.js` incluem material de fases anteriores. Algumas áreas são integradas ao banco; conferir uso real antes de excluir assets ou dizer que nada demonstrativo resta.
7. **Upload sem limite fixo não é infinito.** Capacidade de disco, proxy e plano continuam limitando operações. Não reintroduzir recompressão para mascarar problemas de capacidade.
8. **OSRM gratuito tem limites.** Não garante perfil adequado a ônibus, disponibilidade, rota idêntica ao Google ou informações de trânsito. Endereços devem continuar legíveis mesmo quando coordenadas forem usadas internamente.
9. **Captura visual limitada.** Nesta interação não havia navegador conectado ao CUA. Testes HTTP/jsdom passaram, mas revisão visual em navegadores/dispositivos reais continua importante.
10. **Senhas.** Mínimo quatro por decisão explícita. Hash não é senha recuperável. Não redefinir contas só porque alguém esqueceu; obter autorização para a conta e procedimento específicos.
11. **Segredos antigos no Git.** Arquivos privados foram removidos da árvore atual, mas o histórico pode conter antigas credenciais. O banco novo recebeu credenciais novas. Nunca tornar público o bundle ou os históricos privados sem revisar segredos.
12. **Histórico fora do workspace.** A cópia antiga da landing em Documents foi preservada quando localizada. O código ativo está em `apps/landing`; evitar editar a cópia antiga por engano.
13. **Sem publicação automática garantida.** O fluxo documentado usa pacotes e API da Vertra. Não presumir que todo push no GitHub atualiza as duas aplicações.
14. **Funcionamento após login.** A correção de data foi publicada e testada em função isolada. Para mudanças futuras na visão geral, testar também com dados autenticados reais de PostgreSQL, respeitando a privacidade e sem criar acessos permanentes só para teste.

Na data deste cérebro, o objetivo ativo é preservar a continuidade antes da formatação. Não há pedido para criar novos módulos comerciais, mudar layout aprovado ou migrar novamente a stack.
