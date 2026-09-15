# JNG — site comercial

Site comercial com catálogo de frota conectado ao painel administrativo. Vite e JavaScript modular. Os formulários de orçamento e agendamento continuam demonstrativos, sem envio.

## Integração de frota

As rotas também são integradas por `/api/public/routes`. Somente rotas com situação **Ativa** aparecem na Home, em Rotas e no contato. O catálogo apresenta origem, destino, paradas, horários, dias, distância e Google Maps. Motorista, vínculo operacional e observações internas não são publicados. Em produção, encaminhar também esse endpoint ao servidor da dashboard. O orçamento recebe origem e destino da rota selecionada.

Execute a dashboard na porta 3000 e este site na porta 4173. O proxy do Vite encaminha `/api/public/fleet` à dashboard. A API pública retorna exclusivamente id, modelo, ano, lugares e até cinco fotos; não expõe placas, dados de usuários, quilometragem ou informações financeiras. Cadastro, edição e exclusão aparecem na landing page ao recarregá-la. A página inicial exibe até três veículos, e `/frota` exibe todos com galeria. Falhas e catálogo vazio têm estados próprios, sem substituir os dados reais por veículos fictícios.

Para produção, encaminhe `/api/public/fleet` ao servidor da dashboard no mesmo domínio do site comercial. A hospedagem estática privada anterior não acessa o banco local; esta integração está disponível no localhost e precisa desse encaminhamento para funcionar online.

## Uso local

`npm install`, depois `npm run dev`. Acesse http://127.0.0.1:4173.

`npm test` verifica seleção de eventos, busca, validação e serviço demonstrativo. `npm run build` gera `dist` com 15 páginas estáticas e metadados individuais. `npm run preview` serve a versão de produção.

## Conteúdo e integração futura

- `src/data.js`: empresa, contatos, eventos, viagens, frota, rotas e imagens. Dados fictícios claramente identificados; nenhum preço ou capacidade inventados.
- `src/services.js`: interface assíncrona para substituir por API no futuro. Formulários retornam `sent: false`; nada é armazenado.
- `src/wizard.js`: orçamento e agendamento com sete etapas e estado apenas em memória.
- `src/road.js`: estrada e ônibus em Three.js. Desativado em mobile e movimento reduzido; imagem alternativa se WebGL falhar.
- `src/style.css`: identidade, estilos responsivos, foco visível e movimento reduzido.
- `scripts/prerender.mjs`: HTML estático por rota e Open Graph. A prévia usa `noindex`; ao publicar comercialmente, configurar origem canônica e imagens OG absolutas, remover bloqueio de indexação e substituir conteúdo demonstrativo.

Antes do lançamento comercial, cadastrar contatos e redes oficiais, veículos/fotos reais, eventos e roteiros confirmados, condições comerciais e conteúdo autorizado. A prévia não confirma reservas nem envia contatos.

## Créditos

Logos oficiais fornecidos pela JNG. Estrada e palco são imagens geradas para esta prévia e não representam frota/eventos reais.

- Florianópolis: R'eyes, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Florianopolis_HLuz_bridge_sunset.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).
- Gramado: Emillie Pinheiro Barros, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Gramado_-_Lago_Negro.JPG), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- Torres: Vinicios de Moura, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Parque_Da_Guarita_4.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Fotografias apresentadas com recorte responsivo. Fontes Montserrat e Barlow Condensed sob SIL Open Font License; licenças em `public/assets/fonts`.
