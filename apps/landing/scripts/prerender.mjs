import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { events, trips, fleet, socials } from '../src/data.js';
import { esc } from '../src/components.js';
const template = await readFile('dist/index.html', 'utf8');
const pages = [
  [
    '/',
    'Você escolhe o destino. A JNG leva você.',
    'Transporte, turismo e fretamento. JNG Operadora de Turismo, Osório RS, desde 2004.',
  ],
  ['/viagens', 'Próximas viagens', 'Explore roteiros demonstrativos saindo de Osório.'],
  ['/eventos', 'Próximos eventos', 'Conheça os eventos e planeje seu embarque com a JNG.'],
  ['/rotas', 'Explore nossas rotas', 'Da serra ao litoral, prepare seu roteiro.'],
  ['/frota', 'Nossa frota', 'Conheça as categorias demonstrativas de transporte.'],
  [
    '/orcamento',
    'Pedir orçamento',
    'Conte sua ideia de viagem em sete passos. Simulação sem envio.',
  ],
  ['/agendar', 'Agendar viagem', 'Organize seu embarque em uma simulação sem reserva real.'],
  ['/sobre', 'Nossa história', 'Desde 2004, de Osório para novas histórias.'],
  ['/contato', 'Vamos conversar', 'Prepare seu contato com a JNG. Canais oficiais a cadastrar.'],
  ...events.map((e) => [
    '/eventos/' + e.slug,
    e.title,
    e.subtitle + ' Evento e data demonstrativos.',
    e.poster,
  ]),
  ...trips.map((t) => [
    '/viagens/' + t.slug,
    t.title,
    `${t.origin} a ${t.destination}. Roteiro demonstrativo, sujeito a confirmação.`,
    t.image,
  ]),
];
for (const [route, title, description, image = '/assets/road-hero.png'] of pages) {
  const metadata = `<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="JNG Operadora de Turismo"><meta property="og:title" content="${esc(title)} | JNG"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image">`;
  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)} | JNG</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${esc(description)}">`,
    )
    .replace('</head>', metadata + '</head>')
    .replace(
      '<div class="initial-loading" role="status">Preparando sua próxima viagem…</div>',
      `<div class="initial-loading" role="status">${esc(title)}</div><noscript><p>${esc(description)} Ative JavaScript para usar a busca e os formulários.</p><a href="/">Início</a></noscript>`,
    );
  const folder = 'dist' + (route === '/' ? '' : route);
  await mkdir(folder, { recursive: true });
  await writeFile(folder + '/index.html', html);
}
await writeFile('dist/404.html', template);
await writeFile('dist/robots.txt', 'User-agent: *\nDisallow: /\n');
for (const item of [...events, ...trips, ...fleet, ...socials]) await access('dist' + item.image);
console.log(`${pages.length} páginas estáticas e imagens verificadas.`);
