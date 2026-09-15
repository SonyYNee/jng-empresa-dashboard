import { company, destinations, faq, pillars } from './data.js';
export const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const fmtDate = (value) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value.length === 10 ? value + 'T12:00:00-03:00' : value));
export const price = (value) =>
  value == null
    ? ''
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const link = (path, values = {}) =>
  path +
  '?' +
  new URLSearchParams(
    Object.fromEntries(Object.entries(values).filter(([, v]) => v != null && v !== '')),
  ).toString();
export const Arrow = '<span aria-hidden="true">↗</span>';
export const Icon = (name) =>
  ({
    shield: '◇',
    road: '≋',
    heart: '♡',
    arrow: '↗',
    pin: '⌖',
    calendar: '▦',
    clock: '◷',
    bus: '▰',
  })[name] || '↗';
export const JNGHeader = (path, featured) =>
  `${featured && new Date(featured.date) - Date.now() < 7 * 864e5 ? `<div class="event-bar" id="event-bar"><a href="/eventos/${featured.slug}">Próximo destaque: ${esc(featured.title)} — conheça o roteiro →</a><button data-dismiss-event aria-label="Fechar destaque">×</button></div>` : ''}<header class="site-header"><a class="brand" href="/" aria-label="JNG — Início"><img src="/assets/logo-wine.png" alt="JNG Operadora de Turismo — Osório RS" width="180" height="100"></a><nav class="desktop-nav" aria-label="Navegação principal">${[
    ['/', 'Início'],
    ['/viagens', 'Viagens'],
    ['/eventos', 'Eventos'],
    ['/rotas', 'Rotas'],
    ['/frota', 'Frota'],
    ['/sobre', 'Sobre'],
    ['/contato', 'Contato'],
  ]
    .map(
      ([href, label]) =>
        `<a href="${href}" ${path === href ? 'aria-current="page"' : ''}>${label}</a>`,
    )
    .join(
      '',
    )}</nav><div class="header-actions"><button class="icon-button" data-social aria-label="Redes sociais da JNG">◎</button><a class="button primary" href="/orcamento" data-track="header_quote">Pedir orçamento ${Arrow}</a><button class="menu-toggle icon-button" aria-label="Abrir menu" aria-expanded="false" aria-controls="mobile-menu">☰</button></div></header><dialog id="mobile-menu" class="mobile-menu"><div class="menu-top"><img src="/assets/logo-wine.png" alt="JNG" width="150" height="84"><button class="icon-button" data-close-menu aria-label="Fechar menu">×</button></div><nav aria-label="Navegação móvel">${[
    ['/', 'Início'],
    ['/viagens', 'Viagens'],
    ['/eventos', 'Próximos eventos'],
    ['/rotas', 'Rotas'],
    ['/frota', 'Frota'],
    ['/orcamento', 'Pedir orçamento'],
    ['/sobre', 'Sobre'],
    ['/contato', 'Contato'],
  ]
    .map(([href, label]) => `<a href="${href}">${label} ${Arrow}</a>`)
    .join('')}</nav></dialog>`;
export const JNGFooter = () =>
  `<footer class="site-footer"><div class="footer-main container"><div><img class="footer-logo" src="/assets/logo-white.png" alt="JNG Operadora de Turismo" width="220" height="123"><p>Osório • Rio Grande do Sul<br>Você escolhe o destino.<br>A gente cuida do caminho.</p></div><div><h3>Explore</h3><a href="/viagens">Viagens</a><a href="/eventos">Eventos</a><a href="/rotas">Rotas</a><a href="/frota">Nossa frota</a></div><div><h3>Vamos conversar</h3><a href="/orcamento">Pedir orçamento</a><a href="/agendar">Agendar viagem</a><a href="/contato">Contato</a><button class="text-button light" data-social>Redes sociais ↗</button></div><div><span class="eyebrow">DESDE 2004</span><h2>Boas histórias<br>começam na estrada.</h2></div></div><div class="footer-bottom container"><small>© ${new Date().getFullYear()} JNG Operadora de Turismo</small><button class="text-button light" data-privacy>Privacidade</button><button class="text-button light" data-credits>Créditos das imagens</button></div></footer>`;
export const WhatsAppButton = () =>
  `<button class="floating-contact" data-whatsapp data-track="whatsapp" aria-label="Fale com a JNG pelo WhatsApp"><span aria-hidden="true">◌</span><span>Fale com a JNG</span></button><div class="mobile-actions"><a href="/viagens">Ver viagens ↗</a><a href="/orcamento" data-track="mobile_quote">Pedir orçamento ↗</a></div>`;
export const SectionHeader = (eyebrow, title, href = '', action = 'Ver todos') =>
  `<div class="section-heading"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${href ? `<a class="text-link" href="${href}">${action} ${Arrow}</a>` : ''}</div>`;
export const DemoBadge = () => '';
export const Status = (item) => {
  const names = {
    available: 'Consultar disponibilidade',
    'last-seats':
      item.seatsAvailable != null ? `Últimas ${item.seatsAvailable} vagas` : 'Consultar vagas',
    'sold-out': 'Esgotado',
    ended: 'Encerrado',
    'coming-soon': 'Em breve',
  };
  return `<span class="status status-${item.status}">${names[item.status] || 'Consultar disponibilidade'}</span>`;
};
export const EventSpotlight = (event) =>
  !event
    ? ''
    : `<section class="event-spotlight container" aria-labelledby="spotlight-title"><div class="spotlight-image"><img src="${event.poster}" alt="Imagem ilustrativa da campanha ${esc(event.title)}" width="720" height="480"><span class="date-stamp"><b>${new Date(event.date).getDate()}</b>${new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(event.date)).replace('.', '').toUpperCase()}</span></div><div class="spotlight-copy"><p class="eyebrow">PRÓXIMO DESTAQUE • ${esc(event.city)}</p><h2 id="spotlight-title">${esc(event.title)}<br><em>A JNG leva você.</em></h2><p>${esc(event.subtitle)}</p><div class="spotlight-meta"><span>▦ ${fmtDate(event.date)}</span><span>⌖ Saída de Osório · ${esc(event.departure)}</span></div><p class="small muted">${esc(event.venue)}</p>${event.price != null ? `<p>A partir de <strong>${price(event.price)}</strong></p>` : ''}<div class="action-row"><a class="button primary" href="/eventos/${event.slug}" data-track="event_spotlight">Conhecer o evento ${Arrow}</a><a class="text-link" href="${link('/agendar', { event: event.slug })}" data-track="event_booking">Quero ir →</a></div></div></section>`;
export const EventCard = (item) =>
  `<article class="event-card reveal"><a class="card-photo" href="/eventos/${item.slug}" data-track="event_view"><img src="${item.image}" alt="${item.category === 'Shows' ? 'Cena ilustrativa de show' : esc(item.city)}" loading="lazy" width="600" height="400"><span class="image-label">${esc(item.category)}</span><span class="small-date">${fmtDate(item.date)}</span></a><div class="card-body">${Status(item)}<h3><a href="/eventos/${item.slug}">${esc(item.title)}</a></h3><p>${esc(item.city)} · ${esc(item.venue)}</p><p class="small">Saída: ${esc(item.departureLocation)}</p><a class="text-link" href="/eventos/${item.slug}">Ver detalhes ${Arrow}</a></div></article>`;
export const TripCard = (item) =>
  `<article class="trip-card reveal"><a class="card-photo" href="/viagens/${item.slug}" data-track="trip_view"><img src="${item.image}" alt="Paisagem de ${esc(item.destination)}" loading="lazy" width="600" height="450"><span class="image-label">${esc(item.category)}</span></a><div class="card-body"><p class="eyebrow">${esc(item.origin)} → ${esc(item.destination)}</p><h3>${esc(item.title)}</h3><p>${fmtDate(item.departureDate)} · ${esc(item.duration)}</p><p class="small">${esc(item.frequencyLabel || '')}</p>${DemoBadge()}${item.price != null ? `<strong>${price(item.price)}</strong>` : ''}<a class="text-link" href="/viagens/${item.slug}">Ver viagem ${Arrow}</a></div></article>`;
export const FleetCard = (item) =>
  `<article class="fleet-card reveal"><div class="fleet-picture">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" width="600" height="400">` : '<div class="fleet-no-photo">Foto em breve</div>'}</div><div class="card-body"><p class="eyebrow">FROTA JNG · ${esc(item.year)}</p><h3>${esc(item.name)}</h3><p>${esc(item.capacity)} passageiros</p><div class="action-row"><button class="text-link text-button" data-vehicle="${esc(item.id)}">Ver fotos e detalhes ↗</button><a class="text-link" href="${link('/orcamento', { vehicle: item.name })}">Orçamento ↗</a></div></div></article>`;
export const TripSearch = (filters = {}) =>
  `<form class="trip-search" id="trip-search"><div class="search-title"><span class="eyebrow">SEU PRÓXIMO DESTINO</span><h2>Para onde vamos?</h2></div><div class="search-fields"><label>Origem<input name="origin" value="${esc(filters.origin || 'Osório')}" list="destinations" placeholder="De onde você sai?" required></label><label>Destino<input name="destination" value="${esc(filters.destination || '')}" list="destinations" placeholder="Escolha seu destino"></label><label>Ida<input name="date" type="date" value="${esc(filters.date || '')}" min="${new Date().toLocaleDateString('en-CA')}"></label><label>Volta <span class="muted">(opcional)</span><input name="returnDate" type="date" value="${esc(filters.returnDate || '')}"></label><label>Pessoas<input name="passengers" type="number" min="1" max="200" value="${esc(filters.passengers || 1)}" required></label><button class="button primary" type="submit" data-track="trip_search">Buscar ${Arrow}</button></div><datalist id="destinations">${destinations.map((d) => `<option value="${d}">`).join('')}</datalist><div class="search-popular"><span>Explore:</span>${['Gramado', 'Florianópolis', 'Porto Alegre'].map((d) => `<button type="button" data-destination="${d}">${d}</button>`).join('')}<span id="search-error" role="status"></span></div></form>`;
export const FeatureCard = (item) =>
  `<article class="feature-card"><span aria-hidden="true" class="feature-icon">${Icon(item.icon)}</span><h3>${item.title}</h3><p>${item.text}</p></article>`;
export const Pillars = () => `<div class="pillars">${pillars.map(FeatureCard).join('')}</div>`;
export const FAQ = () =>
  `<div class="faq">${faq.map((item) => `<details><summary>${item.q}<span aria-hidden="true">+</span></summary><p>${item.a}</p></details>`).join('')}</div>`;
export const CTASection = () =>
  `<section class="cta-section"><div class="container"><span class="eyebrow">VAMOS COLOCAR SEU PLANO NA ESTRADA?</span><h2>Qual será o seu<br><em>próximo destino?</em></h2><div class="action-row"><a class="button ivory" href="/orcamento" data-track="footer_quote">Pedir orçamento ${Arrow}</a><a class="text-link light" href="/viagens">Encontrar uma viagem →</a></div></div></section>`;
export const PageHeading = (eyebrow, title, text) =>
  `<section class="page-heading container"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${text}</p></section>`;
export const Empty = (
  title = 'Novas viagens estão chegando.',
  description = 'Não encontramos opções para essa busca.',
) =>
  `<div class="empty"><span aria-hidden="true">⌖</span><h2>${title}</h2><p>${description}</p><a href="/orcamento" class="button primary">Planejar minha viagem ${Arrow}</a></div>`;
export const RouteMap = (items) =>
  items.length
    ? `<div class="public-route-list" aria-label="Rotas disponíveis">${items.map((r) => `<button class="public-route-option" data-route="${esc(r.id)}" aria-label="Ver detalhes da rota ${esc(r.name)}"><span class="eyebrow">${esc(r.name)}</span><span class="route-stations">${[{ name: r.origin, label: 'Origem' }, ...r.stops.map((stop, i) => ({ name: stop.name, label: `Parada ${i + 1}` })), { name: r.destination, label: 'Destino' }].map((point, i, points) => `<span class="route-station ${i === points.length - 1 ? 'is-destination' : ''}"><span class="station-marker" aria-hidden="true">${i === points.length - 1 ? '<svg viewBox="0 0 24 24" fill="none"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.8"/></svg>' : ''}</span><span class="station-address" title="${esc(point.name)}"><span class="station-sr-label">${point.label}: </span>${esc(point.name)}</span></span>`).join('')}</span><small>${r.stops.length} parada(s) · Ver detalhes ↗</small></button>`).join('')}</div>`
    : '<p class="catalog-disclaimer">Novas rotas estarão disponíveis em breve.</p>';
export const SocialCard = (item) =>
  `<article class="social-card"><img src="${item.image}" alt="${esc(item.title)}" width="500" height="500" loading="lazy"><div><span>◎</span><h3>${esc(item.title)}</h3><small>Conteúdo ilustrativo</small></div></article>`;
