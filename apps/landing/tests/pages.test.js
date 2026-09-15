import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { events, trips } from '../src/data.js';
test('todas as páginas renderizam sem cair no estado de erro', async () => {
  for (const path of [
    '/',
    '/viagens',
    '/eventos',
    '/rotas',
    '/frota',
    '/sobre',
    '/contato',
    '/orcamento',
    '/agendar',
    ...events.map((e) => '/eventos/' + e.slug),
    ...trips.map((t) => '/viagens/' + t.slug),
  ]) {
    const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost' + path });
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      location: dom.window.location,
      sessionStorage: dom.window.sessionStorage,
      scrollY: 0,
      addEventListener: () => {},
      matchMedia: () => ({ matches: true }),
      FormData: dom.window.FormData,
    });
    const timer = globalThis.setInterval;
    globalThis.setInterval = () => 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) =>
      new Response(
        JSON.stringify(
          url === '/api/public/routes'
            ? {
                routes: [
                  {
                    id: 1,
                    name: 'Rota <teste>',
                    origin: 'Origem',
                    destination: 'Destino',
                    maps_url: 'https://www.google.com/maps/dir/Origem/Destino',
                    type: 'tourism',
                    weekdays: [1, 3],
                    departure: '23:00',
                    arrival: '01:00',
                    arrival_next_day: true,
                    distance: 42,
                    stops: [{ name: 'Parada <segura>', time: '23:30' }],
                  },
                ],
              }
            : { vehicles: [] },
        ),
      );
    try {
      await import(`../src/app.js?test=${encodeURIComponent(path)}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.ok(document.querySelector('main#main'), path);
      assert.ok(document.querySelector('h1'), path);
      assert.equal(document.querySelector('.error-page'), null, path);
      if (path === '/rotas') {
        assert.match(document.querySelector('#route-preview').textContent, /dia seguinte/);
        assert.equal(document.querySelector('#route-preview teste'), null);
        assert.equal(document.querySelector('#route-quote').elements.destination.value, 'Destino');
        assert.ok(document.querySelector('#route-preview a[href*="google.com/maps"]'));
      }
    } finally {
      globalThis.setInterval = timer;
      globalThis.fetch = originalFetch;
      dom.window.close();
    }
  }
});
test('agendamento preserva veiculo da frota e permite editar retorno', async () => {
  const dom = new JSDOM('<div id="host"></div>', {
    url: 'http://localhost/agendar?vehicle=Sprinter%20416&destination=Torres',
  });
  Object.assign(globalThis, {
    document: dom.window.document,
    location: dom.window.location,
    FormData: dom.window.FormData,
  });
  try {
    const { renderWizard } = await import('../src/wizard.js');
    renderWizard(document.querySelector('#host'), {
      booking: true,
      all: { trips: [], events: [] },
      service: {},
    });
    const submit = () =>
      document
        .querySelector('form')
        .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    submit();
    submit();
    assert.equal(document.querySelector('[name=returnTime]').type, 'time');
    document.querySelector('[name=date]').value = '2099-01-02';
    document.querySelector('[name=returnDate]').value = '2099-01-02';
    document.querySelector('[name=departure]').value = '10:00';
    document.querySelector('[name=returnTime]').value = '09:00';
    submit();
    assert.ok(document.querySelector('#wizard-error').textContent);
    document.querySelector('[name=returnTime]').value = '18:00';
    submit();
    assert.equal(document.querySelector('[name=vehicle]').value, 'Sprinter 416');
    document.querySelector('#wizard-back').click();
    assert.equal(document.querySelector('[name=returnTime]').value, '18:00');
  } finally {
    dom.window.close();
  }
});
test('wizard conserva dados ao voltar, valida datas e conclui sem envio', async () => {
  const dom = new JSDOM('<div id="host"></div>', {
    url: 'http://localhost/orcamento?destination=Torres',
  });
  Object.assign(globalThis, {
    document: dom.window.document,
    location: dom.window.location,
    FormData: dom.window.FormData,
  });
  const { renderWizard } = await import('../src/wizard.js');
  let request;
  renderWizard(document.querySelector('#host'), {
    booking: false,
    all: { trips: [], events: [] },
    service: {
      requestQuote: async (data) => {
        request = structuredClone(data);
        return { sent: false };
      },
    },
  });
  const submit = async () => {
    document
      .querySelector('form')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
  };
  await submit();
  assert.equal(document.querySelector('[name=destination]').value, 'Torres');
  document.querySelector('[name=destination]').value = 'Gramado';
  await submit();
  document.querySelector('#wizard-back').click();
  assert.equal(document.querySelector('[name=destination]').value, 'Gramado');
  await submit();
  document.querySelector('[name=date]').value = '2099-01-02';
  document.querySelector('[name=returnDate]').value = '2099-01-01';
  await submit();
  assert.match(document.querySelector('#wizard-error').textContent, /volta/);
  document.querySelector('[name=returnDate]').value = '2099-01-03';
  await submit();
  await submit();
  for (const [key, value] of Object.entries({
    name: 'Pessoa Exemplo',
    phone: '51999999999',
    email: 'pessoa@example.com',
  }))
    document.querySelector(`[name=${key}]`).value = value;
  await submit();
  await submit();
  await submit();
  assert.equal(request.destination, 'Gramado');
  assert.match(document.querySelector('.wizard-panel').textContent, /O envio/);
  dom.window.close();
});
