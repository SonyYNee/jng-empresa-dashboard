import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { quoteMessage, bindCalendars } from '../src/quote-tools.js';
test('mensagem de orçamento preserva dados e formatação do WhatsApp', () => {
  const message = quoteMessage({
    type: 'Grupo',
    origin: 'Osório',
    destination: 'Gramado',
    date: '2027-02-13',
    passengers: 20,
    name: 'Pessoa',
    phone: '51999999999',
    notes: 'Parada para almoço',
  });
  assert.match(message, /\*PEDIDO DE ORÇAMENTO - JNG\*/);
  assert.match(message, /13\/02\/2027/);
  assert.match(message, /Decidir com a equipe/);
  assert.match(message, /  - Passageiros: 20/);
  assert.match(message, /Parada para almoço/);
  assert.ok(message.includes('\n\n'));
  assert.ok(!message.includes('\\n'));
  assert.equal(decodeURIComponent(encodeURIComponent(message)), message);
});
test('calendário temático bloqueia datas anteriores e seleciona a data', () => {
  const dom = new JSDOM('<form><input type="date" name="date" min="2027-02-10" required></form>');
  Object.assign(globalThis, { document: dom.window.document, Event: dom.window.Event });
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.dispatchEvent(new dom.window.Event('close'));
  };
  try {
    bindCalendars(document.querySelector('form'));
    document.querySelector('input').click();
    const days = [...document.querySelectorAll('.calendar-days button')];
    assert.equal(days[0].disabled, true);
    days.find((b) => b.textContent === '13').click();
    assert.equal(document.querySelector('input').value, '2027-02-13');
    assert.equal(document.querySelector('dialog'), null);
  } finally {
    dom.window.close();
  }
});
