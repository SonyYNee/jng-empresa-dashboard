import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderWizard } from '../src/wizard.js';
test('orçamento recebe endereços editados, data e passageiros da rota', () => {
  const dom = new JSDOM('<main></main>', {
    url: 'http://localhost/orcamento?route=7&origin=Origem+editada&destination=Destino+editado&date=2099-10-17&passengers=12',
  });
  Object.assign(globalThis, {
    document: dom.window.document,
    location: dom.window.location,
    FormData: dom.window.FormData,
  });
  try {
    renderWizard(document.querySelector('main'), {
      booking: false,
      all: {
        trips: [],
        events: [],
        routes: [
          {
            id: 7,
            name: 'Rota teste',
            type: 'charter',
            origin: 'Original',
            destination: 'Original',
            departure: '08:00',
            stops: [],
          },
        ],
      },
      service: {},
    });
    assert.equal(document.querySelector('[name=origin]').value, 'Origem editada');
    assert.equal(document.querySelector('[name=destination]').value, 'Destino editado');
    const submit = () =>
      document
        .querySelector('form')
        .dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    submit();
    assert.equal(document.querySelector('[name=date]').value, '2099-10-17');
    submit();
    assert.equal(document.querySelector('[name=passengers]').value, '12');
  } finally {
    dom.window.close();
  }
});
