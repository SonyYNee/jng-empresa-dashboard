import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readMapsLink, isCoordinatePoint } from '../public/maps-link.js';

test('coordenadas não são importadas como endereços', () => {
  assert.equal(isCoordinatePoint('-29.876423, -50.258078'), true);
  assert.equal(isCoordinatePoint('R. Lateral BR-101, 2872 - Osório'), false);
  const parsed = readMapsLink(
    'https://www.google.com/maps/dir/?api=1&origin=Osorio&destination=Torres&waypoints=-29.876423,-50.258078',
  );
  assert.equal(parsed.requiresAddresses, true);
  assert.deepEqual(parsed.stops, ['']);
  assert.equal(parsed.origin, 'Osorio');
});
import { resolveMapsLink } from '../src/routes.js';

test('redirecionamentos de links curtos são limitados ao Maps', async () => {
  const parsed = await resolveMapsLink(
    'https://maps.app.goo.gl/exemplo',
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://www.google.com/maps/dir/A/B/C/' },
      }),
  );
  assert.equal(parsed.origin, 'A');
  assert.deepEqual(parsed.stops, ['B']);
  assert.equal(parsed.destination, 'C');
  let calls = 0;
  await resolveMapsLink('https://maps.app.goo.gl/exemplo', async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
  });
  assert.equal(calls, 1);
  calls = 0;
  await resolveMapsLink('https://maps.app.goo.gl/exemplo', async () => {
    calls++;
    return new Response(null, {
      status: 302,
      headers: { location: 'https://maps.app.goo.gl/exemplo' },
    });
  });
  assert.equal(calls, 4);
});

test('links Maps: pontos legíveis, links curtos e rejeição de outros destinos', () => {
  const parsed = readMapsLink(
    'https://www.google.com/maps/dir/?api=1&origin=S%C3%A3o+Paulo&destination=Santos&waypoints=Diadema%7CS%C3%A3o+Bernardo',
  );
  assert.equal(parsed.origin, 'São Paulo');
  assert.equal(parsed.destination, 'Santos');
  assert.deepEqual(parsed.stops, ['Diadema', 'São Bernardo']);
  const path = readMapsLink(
    'https://www.google.com.br/maps/dir/S%C3%A3o+Paulo/Diadema/Santos/@-23,-46,10z/data=!4m2',
  );
  assert.equal(path.origin, 'São Paulo');
  assert.deepEqual(path.stops, ['Diadema']);
  assert.equal(path.destination, 'Santos');
  assert.equal(readMapsLink('https://maps.app.goo.gl/exemplo').short, true);
  assert.equal(readMapsLink('https://goo.gl/maps/exemplo').origin, '');
  for (const link of [
    'javascript:alert(1)',
    'https://google.com.evil.example/maps/dir/a/b',
    'https://www.google.com/url?q=https://evil.example',
    'https://user:password@google.com/maps/dir/a/b',
    'http://google.com/maps',
    'https://127.0.0.1/maps',
    'https://goo.gl/qualquer-link',
  ])
    assert.throws(() => readMapsLink(link));
});

test('rotas: cadastro, edição, paradas, permissões e exclusão do veículo vinculado', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'jng-routes-test-')), 'test.sqlite');
  process.env.SETUP_TOKEN = 'routes-test';
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
  const list = async () =>
    (await fetch(origin + '/api/routes', { headers: { Cookie: cookie } })).json();
  let database;
  try {
    assert.equal((await fetch(origin + '/api/routes')).status, 401);
    const setup = await post('setup', {
      name: 'Proprietário',
      email: 'owner@example.com',
      password: 'SenhaInicialSegura123',
      token: 'routes-test',
    });
    cookie = setup.headers.get('set-cookie').split(';')[0];
    await post('users', {
      name: 'Motorista',
      email: 'driver@example.com',
      password: 'SenhaInicialSegura123',
      role: 'driver',
    });
    await post('fleet/vehicle', {
      model: 'Ônibus',
      plate: 'ABC1234',
      year: 2024,
      seats: 46,
      odometer: 1000,
      fuel_capacity: 200,
      arla_capacity: 20,
      photos: [],
    });
    const choices = await list();
    assert.equal(choices.canManage, true);
    assert.equal(choices.drivers.length, 1);
    const record = {
      name: 'Turno da manhã',
      maps_url: 'https://maps.app.goo.gl/exemplo',
      origin: 'Terminal Central',
      destination: 'Empresa',
      type: 'charter',
      status: 'draft',
      weekdays: [1, 2, 3, 4, 5],
      departure: '06:00',
      arrival: '07:30',
      arrival_next_day: false,
      distance: '42,5',
      vehicle_id: choices.vehicles[0].id,
      driver_id: choices.drivers[0].id,
      stops: [
        { name: 'Praça', time: '06:20', notes: 'Portaria A' },
        { name: 'Estação', time: '06:45', notes: '' },
      ],
      notes: 'Conferir passageiros.',
    };
    assert.equal((await post('routes/save', record, '')).status, 401);
    assert.equal(
      (await post('routes/save', { ...record, maps_url: 'https://evil.example' })).status,
      400,
    );
    assert.equal((await post('routes/save', { ...record, driver_id: 9999 })).status, 400);
    assert.equal(
      (await post('routes/save', { ...record, stops: Array(31).fill(record.stops[0]) })).status,
      400,
    );
    assert.equal((await post('routes/save', { ...record, arrival: '05:00' })).status, 400);
    const savedResponse = await post('routes/save', record);
    assert.equal(savedResponse.status, 201);
    const { id } = await savedResponse.json();
    assert.equal((await post('routes/save', { ...record, origin: '-29.87,-50.25' })).status, 400);
    assert.equal(
      (
        await post('routes/save', {
          ...record,
          stops: [{ name: '-29.87,-50.25', time: '', notes: '' }],
        })
      ).status,
      400,
    );
    let current = (await list()).routes[0];
    assert.equal(current.id, id);
    assert.deepEqual(current.stops, record.stops);
    assert.equal(current.distance, 42.5);
    assert.equal(current.vehicle_plate, 'ABC1234');
    assert.equal(
      (
        await post('routes/save', {
          ...record,
          id,
          stops: [...record.stops].reverse(),
          status: 'active',
          departure: '23:00',
          arrival: '01:00',
          arrival_next_day: true,
        })
      ).status,
      200,
    );
    current = (await list()).routes[0];
    assert.equal(current.stops[0].name, 'Estação');
    assert.equal(current.status, 'active');
    assert.equal(current.arrival_next_day, true);
    const publicList = async () =>
      (await (await fetch(origin + '/api/public/routes')).json()).routes;
    const published = (await publicList())[0];
    assert.equal(published.id, id);
    assert.deepEqual(Object.keys(published).sort(), [
      'arrival',
      'arrival_next_day',
      'departure',
      'destination',
      'distance',
      'id',
      'maps_embed_url',
      'maps_url',
      'name',
      'origin',
      'passenger_price',
      'stops',
      'total_price',
      'type',
      'weekdays',
    ]);
    assert.deepEqual(Object.keys(published.stops[0]).sort(), ['name', 'time']);
    assert.equal(published.arrival_next_day, true);
    assert.equal(
      (
        await post('routes/save', {
          ...record,
          id,
          status: 'active',
          type: 'private',
          total_price: '1500,00',
          passenger_price: '48,32',
        })
      ).status,
      200,
    );
    assert.equal((await publicList()).length, 0);
    assert.equal((await list()).routes[0].total_price, 1500);
    assert.equal(
      (
        await post('routes/save', {
          ...record,
          id,
          status: 'active',
          type: 'event',
          total_price: '1500',
          passenger_price: '48.32',
        })
      ).status,
      200,
    );
    assert.equal((await publicList())[0].passenger_price, 48.32);
    assert.equal((await post('routes/save', { ...record, id, total_price: '-1' })).status, 400);
    assert.equal(
      (await post('routes/save', { ...record, id, passenger_price: '1.234' })).status,
      400,
    );
    assert.equal((await fetch(origin + '/api/routes')).status, 401);
    for (const status of ['paused', 'draft']) {
      assert.equal((await post('routes/save', { ...record, id, status })).status, 200);
      assert.equal((await publicList()).length, 0);
    }
    await post('routes/save', { ...record, id, status: 'active' });
    assert.equal((await publicList()).length, 1);
    assert.equal((await post('routes/save', { ...record, id: 9999 })).status, 404);
    database = new DatabaseSync(process.env.DATABASE_PATH);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM transport_routes').get().total, 1);
    assert.equal(
      (await post('fleet/delete', { vehicle_id: record.vehicle_id, confirm_plate: 'ABC1234' }))
        .status,
      201,
    );
    current = (await list()).routes[0];
    assert.equal(current.vehicle_id, null);
    assert.equal(current.name, record.name);
    database.prepare("UPDATE users SET role='driver' WHERE email='owner@example.com'").run();
    assert.equal((await post('routes/save', record)).status, 403);
    const restricted = await list();
    assert.equal(restricted.canManage, false);
    assert.deepEqual(restricted.drivers, []);
    assert.equal(restricted.routes.length, 1);
    for (const path of ['/rotas', '/routes.js', '/maps-link.js'])
      assert.equal((await fetch(origin + path)).status, 200);
    const deletion = { id, confirm_name: record.name };
    assert.equal((await post('routes/delete', deletion, '')).status, 401);
    assert.equal((await post('routes/delete', deletion)).status, 403);
    database.prepare("UPDATE users SET role='owner' WHERE email='owner@example.com'").run();
    assert.equal(
      (await post('routes/delete', { ...deletion, confirm_name: 'Outra rota' })).status,
      400,
    );
    assert.equal((await post('routes/delete', deletion)).status, 200);
    assert.equal((await list()).routes.length, 0);
    assert.equal((await publicList()).length, 0);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM users').get().total, 2);
    assert.equal((await post('routes/delete', deletion)).status, 404);
  } finally {
    database?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
