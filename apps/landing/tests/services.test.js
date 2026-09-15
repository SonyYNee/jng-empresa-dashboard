import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectFeaturedEvent,
  selectUpcomingEvents,
  filterTrips,
  validatePlan,
  service,
} from '../src/services.js';
test('destaque ignora eventos encerrados e passados e prioriza campanha futura', () => {
  const items = [
    { id: 1, date: '2025-01-01', priority: true },
    { id: 2, date: '2030-02-01', status: 'available' },
    { id: 3, date: '2030-03-01', priority: true },
    { id: 4, date: '2030-04-01', status: 'ended', priority: true },
  ];
  assert.equal(selectFeaturedEvent(items, new Date('2030-01-01')).id, 3);
  assert.deepEqual(
    selectUpcomingEvents(items, new Date('2030-01-01')).map((x) => x.id),
    [2, 3],
  );
  assert.equal(selectFeaturedEvent([], 0), null);
});
test('busca por destino sem acentos combina filtros e preserva vagas desconhecidas', () => {
  const items = [
    {
      origin: 'Osório',
      destination: 'Florianópolis',
      departureDate: '2030-01-01',
      returnDate: '2030-01-02',
      category: 'Praia',
      availableSeats: null,
    },
  ];
  assert.equal(
    filterTrips(items, { origin: 'osorio', destination: 'florianopolis', passengers: 30 }).length,
    1,
  );
  assert.equal(filterTrips(items, { date: '2030-01-02' }).length, 0);
  assert.equal(filterTrips(items, { type: 'Shows' }).length, 0);
});
test('validação impede volta anterior, passageiros inválidos e contato incompleto', () => {
  const base = {
    origin: 'Osório',
    destination: 'Torres',
    date: '2099-01-02',
    returnDate: '2099-01-03',
    passengers: 10,
    name: 'Teste',
    email: 'teste@example.com',
    phone: '51999999999',
  };
  assert.equal(validatePlan(base, true), null);
  for (const change of [
    { returnDate: '2099-01-01' },
    { passengers: 0 },
    { passengers: 1.5 },
    { email: 'invalido' },
    { destination: 'Osorio' },
    { date: '2020-01-01' },
  ])
    assert.ok(validatePlan({ ...base, ...change }, true));
});
test('serviço de demonstração nunca envia nem compartilha estado mutável', async () => {
  const data = { name: 'Exemplo' };
  const result = await service.requestQuote(data);
  assert.equal(result.sent, false);
  result.data.name = 'Alterado';
  assert.equal(data.name, 'Exemplo');
  assert.equal((await service.createBooking(data)).sent, false);
  assert.equal((await service.requestContact(data)).sent, false);
});
