# Decisões de produto e interface

## Direção geral

O usuário quer uma dashboard profissional para empresa de transporte, ligada a um site comercial. Começou com login, visão geral e CSS simples, expandindo progressivamente. Preservar a identidade JNG, linguagem em português brasileiro e qualidade visual. Evitar recomeçar o projeto, adicionar módulos sem necessidade ou trocar a stack apenas por preferência técnica.

Dashboard e landing são **duas aplicações e dois links diferentes**. Houve pedidos iniciais de deixar online seguidos de correção para localhost apenas; isso foi superado pela autorização explícita de hospedagem na Vertra em setembro de 2026.

## Contas, equipe e configurações

- Configurações pessoais: nome, e-mail, senha e foto de perfil.
- Configurações deixam de ocupar uma aba principal; ficam em botão na parte inferior da sidebar, junto ao perfil.
- Atividade recente deve mostrar nome, foto e cargo de quem entrou.
- Cargos profissionais de transporte: proprietário, gerente de operações, RH, coordenador de frota, motorista e colaborador.
- Proprietários cadastram usuários e gerenciam cargos.
- Atividades da equipe precisam de rolagem interna, sem expandir indefinidamente o layout.
- Mínimo atual de senha: **4 caracteres**, por solicitação expressa do usuário. Limite máximo: 128. Não elevar silenciosamente para 6 ou 12.
- Alteração de senha exige a senha atual e confirmação; encerra sessões anteriores.

## Frota

- Cadastro: modelo, ano, placa, lugares, quilometragem, capacidades de combustível/ARLA e até cinco fotos.
- Quilometragem deve aceitar valores acima de 50 mil e formatos brasileiros, como `150000` e `150.000`.
- Cada veículo tem painel próprio de edição, abastecimentos, ARLA, manutenção e financeiro.
- Abastecimento: preço por litro, quantidade de litros, data, odômetro e indicação de tanque completo. Calcular médias e estimativa restante a partir dos registros; não apresentar estimativa como medição física do tanque.
- Manutenções: descrição, valor, data, status, recorrência e gastos previstos para o mês selecionado.
- Cards: faturamento, custos, custos fixos e lucro por veículo. Não confundir receita com lucro.
- Deve existir exclusão de veículo; vínculos nas rotas são removidos preservando o roteiro.
- Cards compactos em grade de cinco por linha quando houver largura adequada, com adaptação responsiva.
- Foto deve permitir enxergar o veículo inteiro e não parecer uma miniatura ilegível. Usar enquadramento que preserve a imagem e fundo coerente com o tema.
- Frota cadastrada deve abastecer a landing e a preferência de veículo do orçamento.

## Rotas

- Criar a partir de link do Google Maps, com origem, destino, paradas e configuração individual.
- Endereços devem ser legíveis; não apresentar coordenadas como origem/destino/paradas.
- Melhorar o card e mostrar a sequência das paradas de forma clara, com marcadores de origem, intermediários e destino.
- Houve tentativa de mini mapa Google Maps, problemas de enquadramento/rota e discussão sobre API. **Decisão posterior: retirar o mini mapa incorporado.** Não reintroduzir sem pedido.
- Distância automática sem API paga: extração dos pontos do link e OSRM/OpenStreetMap. Deve existir alternativa manual quando não for possível calcular.
- Excluir rota é obrigatório.
- Tipos finais: transporte de funcionários; transporte de alunos; cobertura/rota de eventos; particular; viagens.
- Rota particular não aparece na listagem pública de rotas. Pode ser usada internamente em um pacote de viagem publicado.
- Valor da rota completa e por passageiro são campos separados e aparecem no site quando preenchidos.
- Veículo pode ser vinculado ao trajeto.
- O usuário pediu remoção de blocos redundantes de endereços longos em áreas da landing; preservar a informação útil no contexto correto sem repetir cabeçalhos extensos.

## Eventos

- Aba de cadastro na dashboard com integração pública.
- Selecionar rota deve preencher destino, paradas e endereços automaticamente.
- Selecionar o veículo que fará o transporte.
- Solicitação inicial: até 15 fotos do evento. Depois houve pedido de retirar limite de tamanho de upload para marketing em alta resolução, vídeos e GIFs. Distinguir limite de quantidade de limite de bytes; conferir o validador atual antes de alterar.
- Fotos do evento alternam na capa.
- No conteúdo de transporte do evento, mostrar somente as fotos do veículo selecionado, em galeria alinhada ao tema, com miniaturas e imagem principal.
- Não confundir a remoção da galeria de fotos do evento no corpo com a remoção das fotos usadas na capa.

## Viagens

- Aba própria para pacotes/excursões completos e planejados, incluindo viagens rotineiras.
- Exemplo de intenção: passeios recorrentes nos finais de semana, como visita ao Cristo/Morro Itatiaia.
- Cadastro de frequência única ou semanal, dias, datas, roteiro, itens incluídos/não incluídos e veículo.
- O seletor interno deve incluir rotas particulares.
- Um pacote publicado pode usar rota particular sem publicar essa rota na listagem pública.
- Verificar integração real dashboard → landing; não substituir cadastros por demonstrações.

## Capas, imagens e tema comercial

- Paleta consolidada: vinho/bordô, creme, detalhes dourados e texto de alto contraste; títulos condensados e fortes.
- A animação inicial de estrada/ônibus geométricos foi rejeitada. O usuário pediu transporte e paisagens mais realistas, com sensação cinematográfica.
- Nunca recomprimir ou reduzir agressivamente fotos de marketing no upload. Usuário enfatizou repetidamente fotos, vídeos e GIFs de alta resolução.
- Para veículo: mostrar a foto inteira em um quadro elegante e com galeria de miniaturas nos eventos/viagens.
- Para capas: manter sensação de capa grande, imagem preservada à direita e composição escura à esquerda para texto; evitar cortes bruscos.
- Blur/gradiente escolhido: vinho escuro à esquerda, transição delicada para a foto à direita. Aplicar de forma consistente nas capas.
- Transições do slideshow devem ser suaves, com controles e respeito à preferência de movimento reduzido.
- Capas de detalhes devem ocupar a tela inicial, convidando o cliente a rolar para obter as informações.
- Remover avisos de conteúdo demonstrativo das áreas oficiais visíveis. Existem textos antigos em documentação/prerender que precisam ser conferidos antes de se declarar que todo conteúdo demonstrativo foi eliminado.
- Revisar espaçamentos, selects, botões, calendários, alturas de capas e rolagens internas, especialmente no celular.

## Redes sociais e WhatsApp

- Aba na dashboard para configurar os canais oficiais.
- Orçamento guiado: explicar os tipos de serviço com clareza, calendário temático, origem/destino, datas, passageiros, veículo, contato, horários e observações.
- Preferência de veículo deve listar a frota real e manter “Decidir com a equipe”.
- Ao confirmar, preparar mensagem organizada para o WhatsApp oficial: linhas, seções, negrito e dados legíveis.
- Corrigir caracteres quebrados; não usar emojis que reapresentem o defeito. Não enviar `\\n` como texto literal; usar quebras reais e codificação correta da URL.
- Formulário “Monte sua viagem” na aba rotas leva os dados já preenchidos para o orçamento.
- Botão “Orçamento para esta rota” tem fluxo diferente: pega a rota diretamente e abre o WhatsApp, sem exigir percorrer o wizard.
- Abrir o WhatsApp com mensagem preparada não equivale a enviar a mensagem nem confirmar uma reserva.
