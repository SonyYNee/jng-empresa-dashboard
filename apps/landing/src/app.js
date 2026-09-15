import { selectFeaturedEvent, selectUpcomingEvents } from './services.js';
import { routeQuoteMessage } from './quote-tools.js';
import { service } from './services.js';
import { company, faq } from './data.js';
import {
  JNGHeader,
  JNGFooter,
  WhatsAppButton,
  EventSpotlight,
  EventCard,
  TripCard,
  TripSearch,
  FleetCard,
  SectionHeader,
  Pillars,
  FAQ,
  CTASection,
  PageHeading,
  Empty,
  RouteMap,
  esc,
  link,
  fmtDate,
  Status,
  price,
  DemoBadge,
} from './components.js';
import { renderWizard } from './wizard.js';
const root = document.querySelector('#app');
const path = location.pathname.replace(/\/$/, '') || '/';
let all = {};
function modal(title, content) {
  document.querySelector('#info-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'info-dialog';
  dialog.className = 'info-dialog';
  dialog.setAttribute('aria-labelledby', 'info-dialog-title');
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="info-dialog-title">${title}</h2><button class="icon-button" aria-label="Fechar" data-close>×</button></div>${content}`;
  document.body.append(dialog);
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}
function social() {
  if (company.social.length) {
    modal(
      'Redes sociais da JNG',
      `<div class="action-row">${company.social.map((item) => `<a class="button outline" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.name)} ↗</a>`).join('')}</div>`,
    );
    return;
  }
  modal(
    'Na estrada com a JNG',
    `<p>Acompanhe as novidades e fale com nossa equipe.</p><a class="button primary" href="/contato">Ver formas de contato ↗</a>`,
  );
}
function whatsapp() {
  if (company.whatsapp) {
    window.open(`https://wa.me/${company.whatsapp.replace(/\D/g, '')}`, '_blank', 'noopener');
    return;
  }
  modal(
    'Vamos conversar',
    `<p>O atendimento pelo WhatsApp estará disponível em breve.</p><p>Por enquanto, você pode preparar sua solicitação no formulário.</p><a class="button primary" href="/orcamento">Preparar orçamento ↗</a>`,
  );
}
function frame(content) {
  root.innerHTML =
    JNGHeader(path, all.featured) +
    `<main id="main">${content}</main>` +
    JNGFooter() +
    WhatsAppButton();
  bindGlobal();
}
function home() {
  return `<section class="hero cinematic-hero"><img class="hero-fallback" src="/assets/road-hero.png" alt="Cena ilustrativa de um ônibus na estrada ao pôr do sol" fetchpriority="high" width="1536" height="1024"><div class="hero-shade"></div><div class="hero-copy container"><p class="eyebrow">OSÓRIO, RS • NA ESTRADA DESDE 2004</p><h1>Você escolhe<br>o destino.<br><em>A JNG leva você.</em></h1><p>Transporte e turismo com segurança,<br>experiência e acolhimento.</p><div class="action-row"><a href="/viagens" class="button ivory" data-track="hero_trips">Encontre sua viagem ↗</a><a href="/orcamento" class="button glass" data-track="hero_quote">Pedir orçamento ↗</a></div><a href="#destaque" class="hero-event-link">Ver próximo destaque ↓</a></div><div class="hero-coordinate"><span>29°53′ S · 50°16′ O</span><span>O CAMINHO TAMBÉM É PARTE DA VIAGEM.</span></div><span class="image-disclosure">Cenário ilustrativo</span></section><div id="destaque">${all.featured ? EventSpotlight(all.featured) : `<section class="container section">${Empty('Novas experiências estão chegando.', 'Conheça nossos roteiros e planeje sua próxima viagem.')}</section>`}</div><section class="container search-section">${TripSearch()}</section><section class="container section">${SectionHeader('ENCONTROS QUE VALEM A VIAGEM', 'O próximo bom momento<br>pode estar aqui.', '/eventos', 'Próximos eventos')}<div class="cards-grid">${all.upcoming.length ? all.upcoming.slice(0, 3).map(EventCard).join('') : Empty()}</div></section><section class="section soft"><div class="container">${SectionHeader('SAINDO DE OSÓRIO', 'Um novo destino.<br>Uma boa história.', '/viagens', 'Todas as viagens')}<div class="cards-grid">${all.trips.slice(0, 3).map(TripCard).join('')}</div></div></section><section class="container section routes-home"><div><span class="eyebrow">O SUL É SÓ O COMEÇO</span><h2>Até onde a JNG<br><em>leva você?</em></h2><p>Da serra ao litoral, reúna seu grupo e comece a planejar o caminho.</p><a class="button primary" href="/rotas" data-track="home_routes">Explorar rotas ↗</a><p class="small muted">Conheça as rotas disponíveis e seus pontos de parada.</p></div>${routeCatalog()}</section><section class="section dark-section"><div class="container">${SectionHeader('VIAJAR BEM COMEÇA NO CAMINHO', 'Seu grupo merece<br>uma boa viagem.', '/frota', 'Conhecer a frota')}${fleetCatalog(3)}</div></section><section class="container section story"><div class="story-year">2004<span>ONDE A NOSSA HISTÓRIA COMEÇA</span></div><div><span class="eyebrow">DE OSÓRIO PARA NOVAS HISTÓRIAS</span><h2>Mais de duas décadas<br>colocando pessoas<br><em>em movimento.</em></h2><p>A JNG Operadora de Turismo nasceu em Osório, no Rio Grande do Sul. Desde 2004, sua história se conecta ao transporte de passageiros, ao turismo e ao fretamento.</p><a class="text-link" href="/sobre">Conheça nossa história ↗</a></div></section><section class="container section compact-section">${Pillars()}</section><section class="road-experience section"><div class="container"><div class="section-heading"><div><span class="eyebrow">UM CONVITE PARA PEGAR A ESTRADA</span><h2>A viagem começa<br>antes do embarque.</h2></div><a href="/orcamento" class="text-link">Vamos planejar? ↗</a></div><div class="road-canvas"><img src="/assets/road-hero.png" alt="Ilustração de ônibus em estrada, alternativa à cena 3D" width="1536" height="1024" loading="lazy"><span class="scene-label">JNG • CENÁRIO 3D ILUSTRATIVO</span></div></div></section>${company.social.length ? `<section class="container section">${SectionHeader('ACOMPANHE NOSSAS NOVIDADES', 'Na estrada com a JNG.')}<div class="action-row">${company.social.map((item) => `<a class="button outline" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.name)} ↗</a>`).join('')}</div></section>` : ''}<section class="container section faq-section"><div><span class="eyebrow">ANTES DE ARRUMAR AS MALAS</span><h2>Vamos tirar<br>suas dúvidas?</h2><a href="/contato" class="text-link">Falar com a equipe ↗</a></div>${FAQ()}</section>${CTASection()}`;
}
function listTrips() {
  const filters = Object.fromEntries(new URLSearchParams(location.search));
  return (
    PageHeading(
      'EXPLORE NOVOS CAMINHOS',
      'Próximas viagens.',
      'Da serra ao litoral, encontre um roteiro para começar a planejar.',
    ) +
    `<section class="container">${TripSearch(filters)}<div class="filter-bar"><label>Categoria<select id="trip-type"><option value="">Todas</option>${['Eventos', 'Praia', 'Serra', 'Shows', 'Compras', 'Turismo', 'Excursões'].map((t) => `<option ${filters.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><p>Consulte datas, valores e disponibilidade.</p></div><div class="cards-grid" id="trip-results"></div><p class="small muted" id="trip-result-count" role="status"></p></section>` +
    CTASection()
  );
}
function eventsPage() {
  return (
    PageHeading(
      'A GENTE LEVA VOCÊ AO ENCONTRO',
      'Próximos eventos.',
      'Shows, encontros e boas razões para sair de casa. Encontre seu próximo destino.',
    ) +
    `<section class="container section event-list"><div class="filter-bar"><label>Situação<select id="event-filter"><option value="upcoming">Próximos</option><option value="all">Todos</option><option value="available">Consultar disponibilidade</option><option value="sold-out">Esgotados</option><option value="coming-soon">Em breve</option></select></label></div><div class="cards-grid" id="event-results">${all.upcoming.map(EventCard).join('') || Empty()}</div></section>` +
    CTASection()
  );
}

function eventPhotos(item) {
  const vehicle = all.fleet.find((v) => String(v.id) === String(item.vehicle_id));
  if (!vehicle) return '';
  return `<section class="container transport-section"><div class="transport-card"><div class="transport-copy"><span class="eyebrow">SEU TRANSPORTE · FROTA JNG</span><h2>Conheça o veículo<br><em>da sua viagem.</em></h2><h3>${esc(vehicle.name)}</h3><div class="transport-specs"><span>${esc(vehicle.capacity)} passageiros</span><span>Ano ${esc(vehicle.year)}</span></div><p>Veja os detalhes do veículo selecionado para este evento.</p></div><div class="transport-gallery">${vehicle.photos.length ? `<img id="transport-main" src="${esc(vehicle.photos[0])}" alt="${esc(vehicle.name)} — foto 1"><div class="transport-thumbs">${vehicle.photos.map((src, i) => `<button type="button" data-transport-photo="${i}" aria-label="Ver foto ${i + 1} do veículo" aria-pressed="${i === 0}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>` : '<div class="transport-empty">As fotos deste veículo estarão disponíveis em breve.</div>'}</div></div></section>`;
}
function coverControls(item) {
  const photos = item.photos || [];
  return photos.length > 1
    ? `<div class="cover-controls"><button type="button" id="cover-prev" aria-label="Foto anterior">←</button><span id="cover-count">1 / ${photos.length}</span><button type="button" id="cover-next" aria-label="Próxima foto">→</button><button type="button" id="cover-pause">Pausar</button></div>`
    : '';
}

function detail(item, event = false) {
  if (!item)
    return (
      PageHeading(
        'NÃO ENCONTRADO',
        'Este roteiro não está disponível.',
        'Confira outras opções ou conte seu plano para a JNG.',
      ) + `<section class="container section">${Empty()}</section>`
    );
  const title = event ? item.title : item.destination;
  const href = link('/agendar', event ? { event: item.slug } : { trip: item.slug });
  const ended = event && (item.status === 'ended' || new Date(item.endDate) < Date.now());
  const sold = event && item.status === 'sold-out';
  return `<section class="detail-hero">${/\.(mp4|webm)$/.test(item.image) ? `<video class="event-cover-media" src="${esc(item.image)}" autoplay muted loop playsinline controls></video>` : `<img class="event-cover-media" src="${esc(item.image)}" alt="${esc(title)}" width="1536" height="1024">`}<div class="container"><a href="${event ? '/eventos' : '/viagens'}" class="back light">← ${event ? 'Todos os eventos' : 'Todas as viagens'}</a><p class="eyebrow">${event ? esc(item.city) : `${esc(item.origin)} → ${esc(item.destination)}`}</p><h1>${esc(title)}</h1><p>${fmtDate(event ? item.date : item.departureDate)} · ${event ? esc(item.venue) : esc(item.duration)}</p>${DemoBadge()}</div>${coverControls(item)}<a class="cover-scroll-cue" href="#trip-information">Explore a experiência <span aria-hidden="true">↓</span></a></section><div id="trip-information"></div>${eventPhotos(item)}<section class="container section detail-grid"><div><h2>O melhor da experiência<br>começa no caminho.</h2><p>${event ? esc(item.subtitle) : esc(item.title)}</p>${event ? Status(item) : ''}<div class="info-grid"><div><span>Embarque</span><strong>${event ? esc(item.departureLocation) : esc(item.origin) + ' · ponto a confirmar'}</strong></div><div><span>Saída prevista</span><strong>${esc(item.departure)}</strong></div><div><span>Retorno previsto</span><strong>${esc(item.returnTime)}</strong></div><div><span>Transporte</span><strong>${esc(item.vehicle || 'Veículo a confirmar')}</strong></div></div>${!event ? `<p class="eyebrow">${esc(item.frequencyLabel || '')}</p><h3>Programação do pacote</h3><p class="package-program">${esc(item.program || 'Consulte a programação com a equipe.')}</p><h3>Não incluso</h3><p>${esc(item.notIncluded || 'Consulte a equipe.')}</p>` : ''}<h3>O que está incluso</h3><ul>${item.included.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><h3>${event ? 'Cronograma e embarque' : 'Itinerário e paradas'}</h3><ol class="timeline">${(event && item.route_id ? [item.origin, ...(item.stops || []).map((stop) => `${stop.name}${stop.time ? ' · ' + stop.time : ''}`), item.destination] : event ? [`${item.departure} · saída de ${item.departureLocation}`, `${new Date(item.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · programação`, `${item.returnTime} · retorno`] : item.stops).map((x) => `<li>${esc(x)}</li>`).join('')}</ol><h3>Informações importantes</h3><p>${esc(item.policies || 'Programação, condições comerciais e itens inclusos precisam ser confirmados com a equipe.')}</p><p>A reserva está sujeita à confirmação da equipe.</p><h3>Dúvidas frequentes</h3>${FAQ()}${event ? `<div class="share"><h3>Compartilhe esse plano</h3><button class="button outline" data-share="copy">Copiar link</button><button class="button outline" data-share="whatsapp">WhatsApp</button><button class="button outline" data-share="instagram">Instagram</button><button class="button outline" data-share="facebook">Facebook</button><p id="share-message" role="status"></p></div>` : ''}</div><aside class="booking-card"><span class="eyebrow">${event ? 'A JNG LEVA VOCÊ' : 'COMECE A PLANEJAR'}</span><h2>${sold ? 'Quer saber de novas vagas?' : ended ? 'Novos encontros vêm aí.' : 'Sua próxima história pode ser essa.'}</h2>${item.price != null ? `<p>A partir de <strong>${price(item.price)}</strong></p>` : '<p>Valores e disponibilidade a confirmar.</p>'}${event && item.seatsAvailable != null ? `<p>${item.seatsAvailable} vagas disponíveis.</p>` : ''}${!ended ? `<a href="${sold ? link('/contato', { interest: item.title }) : href}" class="button primary" data-track="${event ? 'event_booking' : 'trip_booking'}">${sold ? 'Avise-me de novas vagas' : event ? 'Garantir minha vaga' : 'Quero viajar'} ↗</a>` : '<a class="button primary" href="/eventos">Ver próximos eventos ↗</a>'}<a class="text-link" href="${link('/orcamento', event ? { event: item.slug } : { destination: item.destination, origin: item.origin })}">Pedir orçamento →</a><small>Confira os detalhes com a equipe antes de confirmar sua viagem.</small>${event ? `<div class="countdown" data-countdown="${item.date}" aria-label="Contagem até o evento"></div>` : ''}</aside></section>`;
}
function routesPage() {
  return (
    PageHeading(
      'DE OSÓRIO PARA O SEU PRÓXIMO PLANO',
      'Até onde a JNG leva você?',
      'Conheça os trajetos disponíveis, horários e pontos de parada para planejar sua viagem.',
    ) +
    `<section class="container route-explorer">${routeCatalog()}<div id="route-preview"></div></section><section class="container section"><h2>Monte sua viagem.</h2><form id="route-quote" class="inline-form"><input type="hidden" name="route" value=""><label>Origem<input name="origin" value="Osório" required></label><label>Destino<input name="destination" required list="route-destinations"></label><label>Passageiros<input name="passengers" type="number" value="1" min="1" max="200" required></label><label>Data<input name="date" type="date" min="${new Date().toLocaleDateString('en-CA')}" required></label><button class="button primary">Solicitar orçamento ↗</button><datalist id="route-destinations">${all.routes.map((r) => `<option>${esc(r.destination)}</option>`).join('')}</datalist></form></section>` +
    CTASection()
  );
}
function fleetCatalog(limit) {
  if (all.fleetUnavailable)
    return '<div class="catalog-disclaimer" role="status">Não foi possível carregar a frota. <button class="text-button text-link" onclick="location.reload()">Tentar novamente</button></div>';
  if (!all.fleet.length)
    return '<p class="catalog-disclaimer">Nossa frota estará disponível aqui em breve.</p>';
  return `<div class="cards-grid">${(limit ? all.fleet.slice(0, limit) : all.fleet).map(FleetCard).join('')}</div>`;
}
function fleetPage() {
  return (
    PageHeading(
      'NOSSA FROTA',
      'Conforto começa<br>antes da estrada.',
      'Uma solução de transporte para cada grupo e cada experiência.',
    ) +
    `<section class="container section"><div class="cards-grid">${all.fleet.map(FleetCard).join('')}</div></section><section class="container section">${Pillars()}</section>` +
    CTASection()
  );
}
function about() {
  return (
    PageHeading(
      'JNG OPERADORA DE TURISMO • OSÓRIO / RS',
      'A nossa história<br>é feita de caminhos.',
      'Desde 2004, transporte de passageiros, turismo e fretamento com identidade gaúcha.',
    ) +
    `<section class="container story section"><div class="story-year">2004<span>MAIS DE DUAS DÉCADAS EM MOVIMENTO</span></div><div><h2>Uma empresa de estrada.<br>Uma história de pessoas.</h2><p>A JNG tem origem em Osório, no litoral norte do Rio Grande do Sul. Sua história formal começou em 2004 e está ligada ao transporte rodoviário de passageiros, ao turismo e ao fretamento.</p><p>Segurança, experiência, acolhimento e movimento são os pilares que orientam a marca e o próximo capítulo dessa história.</p></div></section><section class="container section">${Pillars()}</section><section class="container section"><h2>Histórias de quem viaja.</h2><p>Este espaço está preparado para receber avaliações reais e autorizadas dos passageiros.</p><a class="text-link" href="/contato">Converse com a JNG ↗</a></section>` +
    CTASection()
  );
}
function contact() {
  return (
    PageHeading(
      'A PRÓXIMA CONVERSA PODE VIRAR UMA VIAGEM',
      'Vamos conversar?',
      'Conte seu plano. O primeiro passo pode ser simples.',
    ) +
    `<section class="container section contact-grid"><div><div class="contact-cards"><button class="contact-card" data-whatsapp><span>◌</span><h3>WhatsApp</h3><p>${company.whatsapp || 'Canal oficial a cadastrar'}</p></button><div class="contact-card"><span>↗</span><h3>Telefone</h3><p>${company.phone || 'Número oficial a cadastrar'}</p></div><div class="contact-card"><span>@</span><h3>E-mail</h3><p>${company.email || 'Endereço oficial a cadastrar'}</p></div><div class="contact-card"><span>⌖</span><h3>Osório • RS</h3><p>${company.streetAddress || 'Endereço completo a confirmar'}</p></div></div><h3>De Osório, para o seu destino.</h3>${routeCatalog()}<button class="button outline" data-social>Redes sociais ◎</button></div><form id="contact-form" class="contact-form"><h2>Deixe seu plano<br>no ponto de partida.</h2><p class="small">Prepare sua mensagem para conversar com a equipe.</p><label>Nome<input name="name" autocomplete="name" maxlength="120" required></label><label>Telefone com DDD<input name="phone" type="tel" autocomplete="tel" pattern="[0-9()+ .-]{10,20}" required></label><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Mensagem<textarea name="message" rows="5" maxlength="2000" required>${esc(new URLSearchParams(location.search).get('interest') || '')}</textarea></label><button class="button primary" type="submit">Preparar mensagem ↗</button><p class="form-status" role="status"></p></form></section>`
  );
}
function bindGlobal() {
  document.querySelectorAll('[data-transport-photo]').forEach(
    (button) =>
      (button.onclick = () => {
        const main = document.querySelector('#transport-main');
        main.src = button.querySelector('img').src;
        main.alt = 'Veículo do evento — foto ' + (Number(button.dataset.transportPhoto) + 1);
        document
          .querySelectorAll('[data-transport-photo]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      }),
  );
  const cover = document.querySelector('.detail-hero');
  if (cover) {
    const header = document.querySelector('.site-header'),
      bar = document.querySelector('#event-bar');
    const fitCover = () =>
      cover.style.setProperty(
        '--cover-header-height',
        (header?.getBoundingClientRect().height || 0) +
          (bar?.isConnected ? bar.getBoundingClientRect().height : 0) +
          'px',
      );
    fitCover();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(fitCover);
      if (header) observer.observe(header);
      if (bar) observer.observe(bar);
      window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    }
  }
  const currentEvent =
    all.events.find((e) => path === '/eventos/' + e.slug) ||
    all.trips.find((e) => path === '/viagens/' + e.slug);
  const updateCoverBackground = (src) => {
    if (cover)
      cover.style.setProperty(
        '--cover-photo',
        /\.(mp4|webm)$/.test(src) ? 'none' : 'url(' + JSON.stringify(src) + ')',
      );
  };
  if (currentEvent) updateCoverBackground(currentEvent.image);
  if (cover && currentEvent?.photos?.length > 1) {
    let index = 0,
      paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const photos = currentEvent.photos,
      pause = document.querySelector('#cover-pause');
    const show = (step) => {
      index = (index + step + photos.length) % photos.length;
      const old = cover.querySelector('.event-cover-media');
      const video = /\.(mp4|webm)$/.test(photos[index]);
      const next = document.createElement(video ? 'video' : 'img');
      next.className = 'event-cover-media';
      next.src = photos[index];
      if (video) {
        next.muted = true;
        next.autoplay = true;
        next.loop = true;
        next.playsInline = true;
        next.controls = true;
      } else next.alt = currentEvent.title;
      cover.querySelectorAll('.cover-outgoing').forEach((node) => node.remove());
      old.classList.add('cover-outgoing');
      cover.insertBefore(next, old);
      next.classList.add('cover-entering');
      setTimeout(() => {
        old.remove();
        next.classList.remove('cover-entering');
      }, 1400);
      updateCoverBackground(photos[index]);
      document.querySelector('#cover-count').textContent = index + 1 + ' / ' + photos.length;
    };
    const sync = () => {
      pause.textContent = paused ? 'Reproduzir' : 'Pausar';
      pause.setAttribute('aria-pressed', String(paused));
    };
    sync();
    document.querySelector('#cover-prev').onclick = () => {
      paused = true;
      sync();
      show(-1);
    };
    document.querySelector('#cover-next').onclick = () => {
      paused = true;
      sync();
      show(1);
    };
    pause.onclick = () => {
      paused = !paused;
      sync();
    };
    const timer = setInterval(() => {
      if (!cover.isConnected) {
        clearInterval(timer);
        return;
      }
      if (
        !paused &&
        !document.hidden &&
        !cover.matches(':hover') &&
        !cover.contains(document.activeElement)
      )
        show(1);
    }, 5000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  }

  document.querySelectorAll('[data-social]').forEach((b) => (b.onclick = social));
  document.querySelectorAll('[data-whatsapp]').forEach((b) => (b.onclick = whatsapp));
  const menu = document.querySelector('#mobile-menu'),
    toggle = document.querySelector('.menu-toggle');
  toggle.onclick = () => {
    menu.showModal();
    toggle.setAttribute('aria-expanded', 'true');
  };
  menu.querySelector('[data-close-menu]').onclick = () => menu.close();
  menu.onclose = () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  };
  document.querySelector('[data-privacy]').onclick = () =>
    modal(
      'Privacidade',
      '<p>Formulários funcionam apenas neste navegador, sem enviar dados à JNG. Informações de contato são mantidas somente durante o preenchimento. Não há analytics ou cookies de marketing nesta versão.</p>',
    );
  document.querySelector('[data-credits]').onclick = () =>
    modal(
      'Créditos das imagens',
      '<p>Cenas de estrada e palco: ilustrações ilustrativas; não representam a frota ou eventos reais.</p><p>Fotografias dos destinos: consulte o arquivo de créditos entregue com o projeto. Logos oficiais: JNG. Fontes Barlow Condensed e Montserrat: SIL Open Font License.</p>',
    );
  document.querySelector('[data-dismiss-event]')?.addEventListener('click', () => {
    document.querySelector('#event-bar')?.remove();
    try {
      sessionStorage.setItem('jng-event-dismissed', '1');
    } catch {}
  });
  try {
    if (sessionStorage.getItem('jng-event-dismissed'))
      document.querySelector('#event-bar')?.remove();
  } catch {}
  const header = document.querySelector('.site-header');
  const scroll = () => header.classList.toggle('scrolled', scrollY > 12);
  addEventListener('scroll', scroll, { passive: true });
  scroll();
  document.querySelectorAll('[data-destination]').forEach(
    (button) =>
      (button.onclick = () => {
        document.querySelector('[name=destination]').value = button.dataset.destination;
      }),
  );
  document.querySelector('#trip-search')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (values.returnDate && values.date && values.returnDate < values.date) {
      document.querySelector('#search-error').textContent = 'A volta deve ser após a ida.';
      return;
    }
    location.href = link('/viagens', values);
  });
  document.querySelectorAll('[data-vehicle]').forEach(
    (b) =>
      (b.onclick = () => {
        const v = all.fleet.find((x) => x.id === b.dataset.vehicle);
        modal(
          esc(v.name),
          `<div class="fleet-gallery">${v.photos.length ? v.photos.map((photo, i) => `<img src="${esc(photo)}" alt="${esc(v.name)} — foto ${i + 1}" class="dialog-image">`).join('') : '<p>Fotos deste veículo em breve.</p>'}</div><p><strong>${esc(v.capacity)} passageiros</strong> · Ano ${esc(v.year)}</p><a class="button primary" href="${link('/orcamento', { vehicle: v.name })}">Pedir orçamento ↗</a>`,
        );
      }),
  );
  bindMap();
  document.querySelectorAll('[data-share]').forEach(
    (b) =>
      (b.onclick = async () => {
        const action = b.dataset.share;
        const shareURL = location.href;
        if (action === 'whatsapp' || action === 'facebook') {
          const url =
            action === 'whatsapp'
              ? `https://wa.me/?text=${encodeURIComponent(document.title + ' ' + shareURL)}`
              : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareURL)}`;
          window.open(url, '_blank', 'noopener');
          return;
        }
        try {
          await navigator.clipboard.writeText(shareURL);
          document.querySelector('#share-message').textContent =
            action === 'instagram'
              ? 'Link copiado. Cole no Instagram para compartilhar.'
              : 'Link copiado.';
        } catch {
          document.querySelector('#share-message').textContent =
            'Não foi possível copiar. Use o endereço da barra do navegador.';
        }
      }),
  );
  document.querySelector('#route-quote')?.addEventListener('submit', (e) => {
    e.preventDefault();
    location.href = link('/orcamento', Object.fromEntries(new FormData(e.currentTarget)));
  });
  document.querySelector('#contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await service.requestContact(Object.fromEntries(new FormData(form)));
    form.querySelector('.form-status').textContent = result.sent
      ? 'Mensagem enviada.'
      : 'Mensagem preparada. O envio à JNG ainda não está disponível.';
  });
  const countdown = document.querySelector('[data-countdown]');
  if (countdown) {
    const update = () => {
      const delta = Math.max(0, new Date(countdown.dataset.countdown) - Date.now());
      countdown.innerHTML = `<small>FALTAM</small><b>${Math.floor(delta / 864e5)}d <span>${Math.floor(delta / 36e5) % 24}h ${Math.floor(delta / 6e4) % 60}min</span></b>`;
    };
    update();
    setInterval(update, 60000);
  }
}
function routeCatalog() {
  return all.routesUnavailable
    ? '<p class="catalog-disclaimer" role="status">Não foi possível carregar as rotas. <button class="text-button text-link" data-retry-routes>Tentar novamente</button></p>'
    : RouteMap(all.routes);
}
function bindMap() {
  document
    .querySelectorAll('[data-retry-routes]')
    .forEach((button) => (button.onclick = () => location.reload()));
  const types = {
    charter: 'Transporte de funcionários — empresas',
    school: 'Transporte de alunos — escolas e faculdades',
    event: 'Cobertura de eventos / rota de eventos',
    private: 'Rota particular',
    tourism: 'Rota de viagem',
  };
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  document.querySelectorAll('[data-route]').forEach(
    (button) =>
      (button.onclick = () => {
        const r = all.routes.find((route) => route.id === button.dataset.route);
        if (!r) return;
        document.querySelectorAll('[data-route]').forEach((x) => {
          const selected = x.dataset.route === r.id;
          x.classList.toggle('selected', selected);
          x.setAttribute('aria-pressed', String(selected));
        });
        const target = document.querySelector('#route-preview');
        const routeWhatsApp = company.whatsapp
          ? 'https://wa.me/' +
            company.whatsapp.replace(/\D/g, '') +
            '?text=' +
            encodeURIComponent(routeQuoteMessage(r))
          : link('/contato', { interest: r.name });
        const html = `<span class="eyebrow">${esc(types[r.type] || 'Rota JNG')}</span><h2>${esc(r.name)}</h2><div class="info-grid"><div><span>Saída</span><strong>${esc(r.departure || 'A confirmar')}</strong></div><div><span>Chegada prevista</span><strong>${esc(r.arrival || 'A confirmar')}${r.arrival_next_day ? ' · dia seguinte' : ''}</strong></div><div><span>Dias de operação</span><strong>${r.weekdays.length ? r.weekdays.map((d) => days[d]).join(', ') : 'Sob consulta'}</strong></div>${r.distance != null ? `<div><span>Distância cadastrada</span><strong>${esc(r.distance)} km</strong></div>` : ''}<div><span>Rota completa</span><strong>${r.total_price == null ? 'Sob consulta' : price(r.total_price)}</strong></div><div><span>Por passageiro</span><strong>${r.passenger_price == null ? 'Sob consulta' : price(r.passenger_price)}</strong></div></div><h3>Paradas</h3>${r.stops.length ? `<ol class="timeline">${r.stops.map((stop) => `<li><strong>${esc(stop.name)}</strong>${stop.time ? ` · ${esc(stop.time)}` : ''}</li>`).join('')}</ol>` : '<p>Sem paradas intermediárias cadastradas.</p>'}<div class="action-row"><a class="button outline" href="${esc(r.maps_url)}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps ↗</a><a class="button primary" href="${esc(routeWhatsApp)}" target="_blank" rel="noopener noreferrer" data-track="route_quote">Orçamento para esta rota ↗</a></div>`;
        if (target) {
          target.innerHTML = html;
          const form = document.querySelector('#route-quote');
          if (form) {
            form.elements.origin.value = r.origin;
            form.elements.destination.value = r.destination;
            form.elements.route.value = r.id;
          }
        } else modal(esc(r.name), html);
      }),
  );
  if (document.querySelector('#route-preview')) document.querySelector('[data-route]')?.click();
}
async function start() {
  try {
    try {
      const response = await fetch('/api/public/social', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const { social = {} } = await response.json();
        company.whatsapp = social.whatsapp || null;
        const names = {
          instagram: 'Instagram',
          facebook: 'Facebook',
          tiktok: 'TikTok',
          youtube: 'YouTube',
          linkedin: 'LinkedIn',
          x: 'X',
        };
        company.social = Object.entries(names)
          .filter(([key]) => social[key])
          .map(([key, name]) => ({ name, url: social[key] }));
      }
    } catch {}
    const [featured, upcoming, events, trips, routes, fleet, social] = await Promise.all([
      Promise.resolve(null),
      Promise.resolve([]),
      service.getEvents().catch(() => []),
      service.getTrips().catch(() => []),
      service.getRoutes().catch(() => {
        all.routesUnavailable = true;
        return [];
      }),
      service.getFleet().catch(() => {
        all.fleetUnavailable = true;
        return [];
      }),
      Promise.resolve([]),
    ]);
    all = {
      ...all,
      featured: selectFeaturedEvent(events),
      upcoming: selectUpcomingEvents(events),
      events,
      trips,
      routes,
      fleet,
      social,
    };
    let content;
    if (path === '/') content = home();
    else if (path === '/viagens') content = listTrips();
    else if (path === '/eventos') content = eventsPage();
    else if (path.startsWith('/eventos/'))
      content = detail(
        events.find((e) => e.slug === path.split('/')[2]),
        true,
      );
    else if (path.startsWith('/viagens/'))
      content = detail(trips.find((t) => t.slug === path.split('/')[2]));
    else if (path === '/rotas') content = routesPage();
    else if (path === '/frota') content = fleetPage();
    else if (path === '/sobre') content = about();
    else if (path === '/contato') content = contact();
    else if (['/orcamento', '/agendar'].includes(path))
      content = '<section id="wizard-host" class="container section"></section>';
    else
      content =
        PageHeading(
          '404',
          'Esse caminho ainda não existe.',
          'Volte ao início para encontrar sua próxima viagem.',
        ) +
        '<div class="container section"><a class="button primary" href="/">Voltar ao início ↗</a></div>';
    frame(content);
    if (path === '/viagens') {
      const update = async () => {
        const filters = Object.fromEntries(new URLSearchParams(location.search));
        filters.type = document.querySelector('#trip-type').value;
        const records = await service.getTrips(filters).catch(() => []);
        document.querySelector('#trip-results').innerHTML =
          records.map(TripCard).join('') || Empty();
        document.querySelector('#trip-result-count').textContent =
          `${records.length} roteiro(s) encontrado(s).`;
      };
      document.querySelector('#trip-type').onchange = update;
      await update();
    }
    if (path === '/eventos')
      document.querySelector('#event-filter').onchange = (e) => {
        const value = e.target.value;
        const records =
          value === 'upcoming'
            ? all.upcoming
            : value === 'all'
              ? all.events
              : all.events.filter((x) => x.status === value);
        document.querySelector('#event-results').innerHTML =
          records.map(EventCard).join('') || Empty();
      };
    if (['/orcamento', '/agendar'].includes(path))
      renderWizard(document.querySelector('#wizard-host'), {
        booking: path === '/agendar',
        all,
        service,
      });
    const road = document.querySelector('#road3d');
    if (
      road &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !matchMedia('(max-width: 760px)').matches
    ) {
      const observer = new IntersectionObserver(
        async (entries) => {
          if (entries.some((x) => x.isIntersecting)) {
            observer.disconnect();
            try {
              const { mountRoad } = await import('./road.js');
              mountRoad(road);
            } catch {}
          }
        },
        { rootMargin: '200px' },
      );
      observer.observe(road);
    }
  } catch {
    root.innerHTML = `<main class="container section error-page"><h1>Não conseguimos carregar esta página.</h1><p>Seu próximo caminho continua aqui. Tente novamente.</p><button id="retry" class="button primary">Tentar novamente</button></main>`;
    document.querySelector('#retry').onclick = start;
  }
}
start();
