import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fuelSummary, parseOdometer, maintenanceForecast } from '../src/fleet.js';

test('previsão mensal separa agendadas e realizadas por mês e ano', () => {
  const result = maintenanceForecast([
    { date: '2026-09-10', status: 'planned', amount: 4832 },
    { date: '2026-09-20', status: 'planned', amount: 10000 },
    { date: '2026-09-01', status: 'done', amount: 5000 },
    { date: '2026-10-01', status: 'planned', amount: 9000 },
    { date: '2027-09-01', status: 'planned', amount: 3000 },
  ]);
  assert.deepEqual(result['2026-09'], { planned: 14832, actual: 5000, count: 2, total: 19832 });
  assert.equal(result['2026-10'].planned, 9000);
  assert.equal(result['2027-09'].planned, 3000);
  assert.deepEqual(maintenanceForecast([]), {});
});

test('quilometragem acima de 50 mil com formato brasileiro', () => {
  for (const value of ['150000', '150.000', 150000]) assert.equal(parseOdometer(value), 150000);
  assert.equal(parseOdometer('1.250.000'), 1250000);
  assert.equal(parseOdometer('150.000,5'), 150000.5);
  assert.equal(parseOdometer('150000.5'), 150000.5);
  assert.equal(parseOdometer('10.000.000'), 10000000);
  for (const value of ['', '-1', '150.00.0', '10000001', 'abc'])
    assert.ok(Number.isNaN(parseOdometer(value)));
});

test('média entre tanques completos, parciais e estimativas', () => {
  const rows = [
    { full: 1, litres: 80, odometer: 1000, date: '2024-01-01' },
    { full: 0, litres: 20, odometer: 1200 },
    { full: 1, litres: 30, odometer: 1500, date: '2024-01-03' },
  ];
  assert.equal(fuelSummary(rows, 100, 1700).average, 10);
  assert.equal(fuelSummary(rows, 100, 1700).estimated, 80);
  assert.equal(fuelSummary(rows.slice(0, 2), 100, 1200).average, null);
  assert.equal(fuelSummary(rows.slice(0, 2), 100, 1200).estimated, null);
  assert.equal(fuelSummary([], 100, 0).estimated, null);
  assert.ok(fuelSummary(rows, 100, 3000).warning);
});

test('frota: veículos isolados, custos, ARLA, agendamento e permissões', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'jng-fleet-test-')), 'test.sqlite');
  process.env.SETUP_TOKEN = 'fleet-test-token';
  const { server } = await import('../src/server.js');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN = origin;
  let cookie = '';
  const post = (path, data, auth = cookie) =>
    fetch(origin + '/api/' + path, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: auth },
      body: JSON.stringify(data),
    });
  const get = async () =>
    (await fetch(origin + '/api/fleet', { headers: { Cookie: cookie } })).json();
  const save = async (path, data, status = 201) => {
    const response = await post('fleet/' + path, data);
    assert.equal(response.status, status, JSON.stringify(await response.json()));
  };
  try {
    assert.equal((await fetch(origin + '/api/fleet')).status, 401);
    const signup = await post('setup', {
      name: 'Dono',
      email: 'dono@example.com',
      password: 'SenhaSeguraFrota123',
      token: process.env.SETUP_TOKEN,
    });
    cookie = signup.headers.get('set-cookie').split(';')[0];
    const vehicle = {
      plate: 'ABC-1234',
      model: 'Ônibus executivo',
      year: 2024,
      seats: 46,
      odometer: 1000,
      fuel_capacity: 100,
      arla_capacity: 20,
      photos: [],
    };
    await save('vehicle', { ...vehicle, photos: Array(6).fill('x') }, 400);
    const photo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    await save('vehicle', { ...vehicle, photos: Array(5).fill(photo) });
    await save('vehicle', vehicle, 409);
    await save('vehicle', { ...vehicle, plate: 'DEF1G23', arla_capacity: 0, odometer: '150.000' });
    let fleet = await get();
    const first = fleet.vehicles.find((v) => v.plate === 'ABC1234');
    const second = fleet.vehicles.find((v) => v.plate === 'DEF1G23');
    assert.equal(first.photos.length, 5);
    const publicFleet = await (await fetch(origin + '/api/public/fleet')).json();
    assert.equal(publicFleet.vehicles.length, 2);
    const published = publicFleet.vehicles.find((v) => v.id === first.id);
    assert.deepEqual(Object.keys(published).sort(), ['id', 'model', 'photos', 'seats', 'year']);
    assert.equal(published.photos.length, 5);
    assert.equal(published.seats, 46);
    assert.equal((await fetch(origin + '/api/fleet')).status, 401);

    assert.equal(second.odometer, 150000);
    const refill = {
      vehicle_id: first.id,
      kind: 'fuel',
      date: '2024-01-01',
      odometer: 1000,
      litres: 80,
      price: '6,199',
      full: true,
    };
    await save('refill', { ...refill, litres: 101 }, 400);
    await save('refill', refill);
    await save('refill', refill, 409);
    await save('refill', { ...refill, kind: 'arla', litres: 10, price: '4,00' });
    await save('refill', {
      ...refill,
      date: '2024-01-02',
      odometer: 1200,
      litres: 20,
      price: '6,00',
      full: false,
    });
    await save('refill', {
      ...refill,
      date: '2024-01-03',
      odometer: 1500,
      litres: 30,
      price: '6,00',
    });
    await save('refill', {
      ...refill,
      kind: 'arla',
      date: '2024-01-03',
      odometer: 1500,
      litres: 5,
      price: '4,00',
    });
    await save('refill', { ...refill, date: '2024-01-02', odometer: 1200 }, 400);
    await save('refill', { ...refill, vehicle_id: second.id, kind: 'arla' }, 400);
    await save('vehicle', { ...vehicle, id: first.id, odometer: 1700 }, 200);
    await save('entry', {
      vehicle_id: first.id,
      kind: 'revenue',
      date: '2024-01-03',
      description: 'Viagem',
      amount: '2000,00',
    });
    await save('entry', {
      vehicle_id: first.id,
      kind: 'fixed',
      date: '2024-01-03',
      description: 'Seguro',
      amount: '100,00',
    });
    await save(
      'entry',
      {
        vehicle_id: first.id,
        kind: 'cost',
        date: '2024-01-03',
        description: 'Inválido',
        amount: '-10',
      },
      400,
    );
    await save('maintenance', {
      vehicle_id: first.id,
      description: 'Troca de óleo',
      date: '2024-01-31',
      amount: '48,32',
      status: 'planned',
      recurrence: 1,
    });
    fleet = await get();
    let v = fleet.vehicles.find((v) => v.id === first.id);
    assert.equal(v.fuel.average, 10);
    assert.equal(v.fuel.estimated, 80);
    assert.equal(v.arla.average, 100);
    assert.equal(v.arla.estimated, 18);
    assert.equal(v.costs, 95592);
    assert.equal(v.fixed, 10000);
    assert.equal(v.revenue, 200000);
    assert.equal(fleet.vehicles.find((v) => v.id === second.id).costs, 0);
    await save(
      'maintenance/complete',
      { vehicle_id: second.id, id: v.maintenance[0].id, date: '2024-01-31', amount: '48,32' },
      409,
    );
    await save('maintenance/complete', {
      vehicle_id: first.id,
      id: v.maintenance[0].id,
      date: '2024-01-31',
      amount: '48,32',
    });
    await save(
      'maintenance/complete',
      { vehicle_id: first.id, id: v.maintenance[0].id, date: '2024-01-31', amount: '48,32' },
      409,
    );
    fleet = await get();
    v = fleet.vehicles.find((v) => v.id === first.id);
    assert.equal(v.costs, 100424);
    assert.equal(v.profit, 99576);
    assert.deepEqual(v.maintenance_months['2024-01'], {
      planned: 0,
      actual: 4832,
      count: 0,
      total: 4832,
    });
    assert.deepEqual(v.maintenance_months['2024-02'], {
      planned: 4832,
      actual: 0,
      count: 1,
      total: 4832,
    });
    assert.equal(v.maintenance.find((m) => m.status === 'planned').date, '2024-02-29');
    const db = new DatabaseSync(process.env.DATABASE_PATH);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM vehicles').get().total, 2);
    db.prepare("UPDATE users SET role='driver'").run();
    assert.equal((await get()).canManage, false);
    await save(
      'entry',
      {
        vehicle_id: first.id,
        kind: 'revenue',
        description: 'Indevido',
        date: '2024-01-01',
        amount: 10,
      },
      403,
    );
    await save('delete', { vehicle_id: first.id, confirm_plate: first.plate }, 403);
    db.prepare("UPDATE users SET role='owner'").run();
    await save('delete', { vehicle_id: first.id, confirm_plate: 'ERRADA' }, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM vehicles').get().total, 2);
    await save('delete', { vehicle_id: first.id, confirm_plate: first.plate });
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM vehicles').get().total, 1);
    for (const name of ['refills', 'maintenance', 'vehicle_entries'])
      assert.equal(
        db.prepare(`SELECT COUNT(*) AS total FROM ${name} WHERE vehicle_id=?`).get(first.id).total,
        0,
      );
    assert.ok(db.prepare('SELECT id FROM vehicles WHERE id=?').get(second.id));
    await save('delete', { vehicle_id: first.id, confirm_plate: first.plate }, 404);
    db.close();
    for (const path of ['/frota', '/fleet.js'])
      assert.equal((await fetch(origin + path)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
