import { esc, fmtDate } from './components.js';
import { serviceTypes, company } from './data.js';
import { quoteMessage, bindCalendars } from './quote-tools.js';
import { validatePlan } from './services.js';
export function renderWizard(host, { booking, all, service }) {
  const params = Object.fromEntries(new URLSearchParams(location.search));
  const route = (all.routes || []).find((r) => String(r.id) === params.route);
  const chosen =
    all.trips.find((x) => x.slug === params.trip) ||
    all.events.find((x) => x.slug === params.event);
  const data = {
    type: params.event ? 'Evento' : 'Excursão',
    origin: 'Osório',
    destination: '',
    date: '',
    returnDate: '',
    passengers: '1',
    name: '',
    phone: '',
    email: '',
    notes: '',
    vehicle: '',
    departure: '',
    returnTime: '',
    boarding: '',
    ...Object.fromEntries(
      Object.entries(params).filter(([k]) =>
        ['origin', 'destination', 'date', 'returnDate', 'passengers', 'vehicle'].includes(k),
      ),
    ),
  };
  if (chosen)
    Object.assign(data, {
      origin: chosen.origin || 'Osório',
      destination: chosen.destination || chosen.city,
      date: chosen.departureDate || chosen.date.slice(0, 10),
      returnDate: chosen.returnDate || chosen.endDate?.slice(0, 10) || '',
      departure: chosen.departure || '',
      boarding: chosen.departureLocation || '',
      returnTime: chosen.returnTime || '',
      interest: chosen.title,
    });
  if (route) {
    data.type =
      { charter: 'Empresa', school: 'Escolar', event: 'Evento', tourism: 'Excursão' }[route.type] ||
      'Grupo';
    data.origin = params.origin || route.origin;
    data.destination = params.destination || route.destination;
    data.departure = route.departure || '';
    data.boarding = data.origin;
    data.interest = route.name;
    data.notes = route.stops?.length
      ? 'Paradas da rota:\n' +
        route.stops
          .map((stop) => '- ' + stop.name + (stop.time ? ' (' + stop.time + ')' : ''))
          .join('\n')
      : '';
  }
  data.returnTime = /^([01]\d|2[0-3]):[0-5]\d/.test(data.returnTime)
    ? data.returnTime.slice(0, 5)
    : '';
  const descriptions = {
    Excursão: 'Passeios e pacotes turísticos com roteiro planejado.',
    Evento: 'Transporte de ida e volta para shows, feiras e encontros.',
    Empresa: 'Transporte de funcionários e compromissos profissionais.',
    Grupo: 'Viagem exclusiva para família, amigos ou uma equipe.',
    Transfer: 'Traslado para aeroporto, hotel ou outro ponto de chegada.',
    Escolar: 'Transporte de alunos para escolas e faculdades.',
    Outro: 'Conte sua ideia e ajudamos a escolher a melhor solução.',
  };
  let step = params.origin && params.destination ? 1 : 0;
  const titles = [
    'Que viagem você precisa?',
    'De onde para onde?',
    'Quando vamos viajar?',
    'Quem vai com você?',
    'Como podemos conversar?',
    'Algum detalhe especial?',
    'Seu plano, pronto para revisar.',
  ];
  const field = (label, name, type = 'text', extra = '') =>
    `<label>${label}<input name="${name}" type="${type}" value="${esc(data[name])}" ${extra}></label>`;
  const summary = () =>
    `<dl class="request-summary">${[
      ['Serviço', data.type],
      ['Roteiro', `${data.origin} → ${data.destination}`],
      ['Ida', data.date ? fmtDate(data.date) : ''],
      ['Volta', data.returnDate ? fmtDate(data.returnDate) : 'Sem volta definida'],
      ['Passageiros', data.passengers],
      ['Veículo', data.vehicle || 'A definir'],
      ['Nome', data.name],
      ['Telefone', data.phone],
      ['E-mail', data.email],
      ['Horário', data.departure || 'A definir'],
      ['Horário de retorno', data.returnTime || 'A definir'],
      ['Embarque', data.boarding || 'A definir'],
      ['Observações', data.notes || 'Nenhuma'],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join('')}</dl>`;
  function draw(focus = false) {
    const sections = [
      `<div class="choice-grid">${serviceTypes.map((x) => `<label class="choice"><input type="radio" name="type" value="${x}" ${data.type === x ? 'checked' : ''}><span><strong>${x}</strong><small>${esc(descriptions[x])}</small></span></label>`).join('')}</div>`,
      field('Origem', 'origin', 'text', 'required maxlength="300"') +
        field('Destino', 'destination', 'text', 'required maxlength="300"') +
        (booking ? field('Ponto de embarque', 'boarding', 'text', 'required maxlength="300"') : ''),
      field(
        'Data de ida',
        'date',
        'date',
        `required min="${new Date().toLocaleDateString('en-CA')}"`,
      ) +
        field('Data de volta (opcional)', 'returnDate', 'date', `min="${esc(data.date)}"`) +
        (booking
          ? field('Horário de saída', 'departure', 'time', 'required') +
            field('Horário de retorno (opcional)', 'returnTime', 'time')
          : ''),
      field('Número de passageiros', 'passengers', 'number', 'min="1" max="200" required') +
        `<label>Preferência de veículo<select name="vehicle"><option value="">Decidir com a equipe</option>${[...new Set([data.vehicle, ...(all.fleet || []).map((v) => v.name)].filter(Boolean))].map((x) => `<option ${data.vehicle === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label><p class="muted small">Capacidade e disponibilidade serão confirmadas pela equipe.</p>`,
      field('Seu nome', 'name', 'text', 'autocomplete="name" required maxlength="120"') +
        field(
          'Telefone com DDD',
          'phone',
          'tel',
          'autocomplete="tel" required pattern="[0-9()+ .-]{10,20}"',
        ) +
        field('E-mail', 'email', 'email', 'autocomplete="email" required maxlength="200"'),
      `<label>O que precisamos saber? (opcional)<textarea name="notes" rows="5" maxlength="2000" placeholder="Paradas, acessibilidade, bagagens ou necessidades do grupo…">${esc(data.notes)}</textarea></label><p class="small muted">Informe apenas os detalhes necessários para a viagem.</p>`,
      summary(),
    ];
    host.innerHTML = `<div class="wizard-layout"><aside class="wizard-intro"><span class="eyebrow">${booking ? 'ORGANIZE SEU EMBARQUE' : 'VAMOS PLANEJAR JUNTOS'}</span><h1>${booking ? 'Seu próximo caminho começa aqui.' : 'Você imagina a viagem.<br><em>A JNG cuida do caminho.</em>'}</h1><p>${booking ? 'Organize os detalhes da viagem antes de falar com a equipe.' : 'Conte sua ideia. Um passo de cada vez.'}</p>${data.interest ? `<p class="wizard-interest">Seu interesse: <strong>${esc(data.interest)}</strong></p>` : ''}<img src="/assets/road-hero.png" alt="Estrada ilustrativa" width="600" height="400"></aside><div class="wizard-panel"><div class="wizard-progress"><span>ETAPA ${step + 1} DE 7</span><span>${Math.round(((step + 1) / 7) * 100)}%</span></div><progress value="${step + 1}" max="7" aria-label="Progresso do formulário"></progress><h2 tabindex="-1" id="step-title">${titles[step]}</h2><form id="wizard-form"><div class="wizard-fields">${sections[step]}</div><p id="wizard-error" role="alert"></p><div class="wizard-actions">${step ? '<button type="button" class="text-button text-link" id="wizard-back">← Voltar</button>' : '<a href="/" class="text-link">← Início</a>'}<button type="submit" class="button primary">${step === 6 ? (booking ? 'Confirmar no WhatsApp' : 'Pedir orçamento no WhatsApp') : 'Continuar'} ↗</button></div><p class="small muted">Prepare seu plano para revisar com a equipe.</p></form></div></div>`;
    const form = host.querySelector('form');
    const save = () => Object.assign(data, Object.fromEntries(new FormData(form)));
    bindCalendars(form);
    form.querySelector('[name=date]')?.addEventListener('change', () => {
      if (form.elements.returnDate) form.elements.returnDate.min = form.elements.date.value;
    });
    host.querySelector('#wizard-back')?.addEventListener('click', () => {
      save();
      step--;
      draw(true);
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      save();
      let error = '';
      if (step === 1 && data.origin.trim().toLowerCase() === data.destination.trim().toLowerCase())
        error = 'Escolha um destino diferente da origem.';
      if (step === 2 && !data.date) error = 'Escolha a data de ida.';
      if (step === 2 && data.returnDate && data.returnDate < data.date)
        error = 'A volta não pode ser anterior à ida.';
      if (
        step === 2 &&
        data.returnDate === data.date &&
        data.returnTime &&
        data.departure &&
        data.returnTime < data.departure
      )
        error = 'O horário de retorno deve ser após a saída.';
      if (step === 4 && data.phone.replace(/\D/g, '').length < 10)
        error = 'Informe telefone com DDD.';
      if (step === 6) error = validatePlan(data, true);
      if (error) {
        host.querySelector('#wizard-error').textContent = error;
        return;
      }
      if (step < 6) {
        step++;
        draw(true);
        return;
      }
      if (company.whatsapp) {
        const url =
          'https://wa.me/' +
          company.whatsapp.replace(/\D/g, '') +
          '?text=' +
          encodeURIComponent(quoteMessage(data));
        window.open(url, '_blank', 'noopener,noreferrer');
        host.querySelector('.wizard-panel').innerHTML =
          `<span class="eyebrow">PRONTO PARA CONVERSAR</span><h2 id="complete-title" tabindex="-1">Seu orçamento está pronto para a equipe.</h2><p>O WhatsApp foi aberto com sua mensagem organizada. Toque em enviar para concluir o contato.</p><a class="button primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir orçamento no WhatsApp ↗</a>${summary()}<button class="button outline" id="edit-plan">Editar meu plano</button>`;
        host.querySelector('#edit-plan').onclick = () => {
          step = 6;
          draw(true);
        };
        host.querySelector('#complete-title').focus();
        return;
      }
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      button.textContent = 'Preparando…';
      try {
        const result = await (booking ? service.createBooking(data) : service.requestQuote(data));
        host.querySelector('.wizard-panel').innerHTML =
          `<span class="eyebrow">PLANO PREPARADO</span><h2 tabindex="-1" id="complete-title">Sua próxima viagem começa com uma boa ideia.</h2><p>${result.sent ? 'Solicitação enviada.' : 'Seu plano está pronto para revisão. O envio à JNG ainda não está disponível; nenhuma reserva foi realizada.'}</p>${summary()}<button class="button outline" id="edit-plan">Editar meu plano</button> <a href="/viagens" class="text-link">Explorar viagens ↗</a>`;
        host.querySelector('#edit-plan').onclick = () => {
          step = 6;
          draw(true);
        };
        host.querySelector('#complete-title').focus();
      } catch {
        button.disabled = false;
        button.textContent = 'Tentar novamente';
        host.querySelector('#wizard-error').textContent =
          'Não foi possível preparar o resumo. Seus dados continuam aqui.';
      }
    };
    if (focus) host.querySelector('#step-title').focus();
  }
  draw();
}
