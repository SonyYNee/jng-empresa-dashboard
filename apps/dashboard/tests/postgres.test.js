import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initFleet } from '../src/fleet.js';
import { initRoutes } from '../src/routes.js';
import { initEvents } from '../src/events.js';
import { initTrips } from '../src/trips.js';
import { initSocial } from '../src/social.js';

test('PostgreSQL: inicialização, IDs automáticos, preços decimais e chaves estrangeiras', async () => {
  const postgres = new PGlite();
  const db = {
    exec: (sql) => postgres.exec(sql),
    run: (sql, params) => postgres.query(sql, params),
    all: async (sql, params) => (await postgres.query(sql, params)).rows,
    get: async (sql, params) => (await postgres.query(sql, params)).rows[0],
  };
  try {
    const source = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
    const schema = source.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
    await db.exec(schema);
    const context = {
      session: async () => null,
      json() {},
      body: async () => ({}),
      validPhoto: () => true,
    };
    for (const init of [initFleet, initRoutes, initEvents, initTrips, initSocial])
      await init(db, context);
    const vehicle = await db.get(
      "INSERT INTO vehicles(plate,model,year,seats,odometer,fuel_capacity) VALUES ('TEST123','Van',2026,16,75000,80) RETURNING id",
    );
    assert.equal(vehicle.id, 1);
    const route = await db.get(
      "INSERT INTO transport_routes(name,maps_url,origin,destination,vehicle_id,total_price,passenger_price,arrival_next_day) VALUES ('Teste','https://maps.google.com','Origem','Destino',$1,500.50,48.32,$2) RETURNING *",
      [vehicle.id, 1],
    );
    assert.equal(route.id, 1);
    assert.equal(route.total_price, 500.5);
    assert.equal(route.passenger_price, 48.32);
    assert.equal(route.arrival_next_day, true);
    for (const table of ['company_events', 'company_trips']) {
      assert.equal((await db.get(`INSERT INTO ${table}(data) VALUES ('{}') RETURNING id`)).id, 1);
    }
    await db.run('DELETE FROM vehicles WHERE id=$1', [vehicle.id]);
    assert.equal(
      (await db.get('SELECT vehicle_id FROM transport_routes WHERE id=$1', [route.id])).vehicle_id,
      null,
    );
  } finally {
    await postgres.close();
  }
});
