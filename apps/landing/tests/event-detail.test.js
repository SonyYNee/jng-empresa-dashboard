import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
test('evento real: capa navegavel, movimento reduzido e miniaturas do veiculo', async () => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/eventos/evento-1' });
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
  const originalFetch = globalThis.fetch,
    originalInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  const event = {
    id: 1,
    slug: 'evento-1',
    title: 'Evento com nome longo para conferir os detalhes',
    city: 'Osório',
    venue: 'Endereço completo do evento',
    date: '2099-01-01T10:00:00-03:00',
    endDate: '2099-01-01T22:00:00-03:00',
    status: 'available',
    included: [],
    vehicle_id: 1,
    image: '/media/first.jpg',
    photos: ['/media/first.jpg', '/media/second.jpg'],
  };
  globalThis.fetch = async (url) =>
    new Response(
      JSON.stringify(
        url === '/api/public/events'
          ? { events: [event] }
          : url === '/api/public/fleet'
            ? {
                vehicles: [
                  {
                    id: 1,
                    model: 'Veículo teste',
                    year: 2026,
                    seats: 30,
                    photos: ['/media/bus1.jpg', '/media/bus2.jpg'],
                  },
                ],
              }
            : url === '/api/public/routes'
              ? { routes: [] }
              : { social: {} },
      ),
    );
  try {
    await import('../src/app.js?event-detail-regression');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(document.querySelector('.error-page'), null);
    assert.equal(document.querySelector('#cover-pause').textContent, 'Reproduzir');
    document.querySelector('#cover-next').click();
    assert.match(document.querySelector('.event-cover-media').src, /second.jpg$/);
    assert.equal(document.querySelector('#cover-count').textContent, '2 / 2');
    document.querySelector('#cover-prev').click();
    assert.match(document.querySelector('.event-cover-media').src, /first.jpg$/);
    document.querySelector('[data-transport-photo="1"]').click();
    assert.match(document.querySelector('#transport-main').src, /bus2.jpg$/);
    assert.equal(
      document.querySelector('[data-transport-photo="1"]').getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(document.querySelector('[data-event-gallery]'), null);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setInterval = originalInterval;
    dom.window.close();
  }
});
