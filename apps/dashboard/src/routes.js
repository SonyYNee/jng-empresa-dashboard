import { readMapsLink, isCoordinatePoint, normalizeMapsEmbed } from '../public/maps-link.js';
import { calculateRouteDistance } from './route-distance.js';

export async function resolveMapsLink(value, request = fetch) {
  let parsed = readMapsLink(value);
  for (let attempt = 0; parsed.short && attempt < 4; attempt++) {
    try {
      const response = await request(parsed.url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      await response.body?.cancel();
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const target = response.headers.get('location');
      if (!target) break;
      // Cada redirecionamento passa novamente pela lista de domínios e caminhos permitidos.
      parsed = readMapsLink(new URL(target, parsed.url).href);
    } catch {
      break;
    }
  }
  return parsed;
}

import { normalizeSqliteSql } from './db.js';

function ensureDbCompat(db) {
  if (!db || typeof db.run === 'function') return db;
  const originalExec = db.exec.bind(db);
  db.exec = (sql) => originalExec(normalizeSqliteSql(sql));
  const safe = (sql, params = []) => {
    const normalized = normalizeSqliteSql(sql);
    const statement = db.prepare(normalized);
    const values = Array.isArray(params) ? params : [params];
    const isSelect = /^\s*(SELECT|WITH)\b/i.test(normalized);
    const hasReturning = /\bRETURNING\b/i.test(normalized);
    if (isSelect || hasReturning) {
      const rows = values.length ? statement.all(...values) : statement.all();
      return { rows, rowCount: rows.length };
    }
    const result = values.length ? statement.run(...values) : statement.run();
    return { rows: [], rowCount: Number(result?.changes || 0) };
  };
  db.run = (sql, params = []) => safe(sql, params);
  db.all = (sql, params = []) => safe(sql, params).rows;
  db.get = (sql, params = []) => safe(sql, params).rows[0] || null;
  db.query = (sql, params = []) => safe(sql, params);
  return db;
}

export async function initRoutes(db, { session, body, json }) {
  db = ensureDbCompat(db);
  await db.exec(
    `CREATE TABLE IF NOT EXISTS transport_routes (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, maps_url TEXT NOT NULL,
    origin TEXT NOT NULL, destination TEXT NOT NULL, stops TEXT NOT NULL DEFAULT '[]',
    type TEXT NOT NULL DEFAULT 'charter', status TEXT NOT NULL DEFAULT 'draft',
    weekdays TEXT NOT NULL DEFAULT '[]', departure TEXT NOT NULL DEFAULT '', arrival TEXT NOT NULL DEFAULT '',
    arrival_next_day BOOLEAN NOT NULL DEFAULT FALSE, distance DOUBLE PRECISION,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`,
  );
  const cols = await db.all(
    "SELECT column_name FROM information_schema.columns WHERE table_name='transport_routes'",
  );
  const colNames = cols.map((column) => column.column_name);
  if (!colNames.includes('maps_embed_url'))
    await db.run("ALTER TABLE transport_routes ADD COLUMN maps_embed_url TEXT NOT NULL DEFAULT ''");
  for (const column of ['total_price', 'passenger_price']) {
    if (!colNames.includes(column))
      await db.run(`ALTER TABLE transport_routes ADD COLUMN ${column} DOUBLE PRECISION`);
  }
  await db.run("UPDATE transport_routes SET type='private' WHERE type IN ('transfer','regular')");
  const types = {
    charter: 'Transporte de funcionários — empresas',
    school: 'Transporte de alunos — escolas e faculdades',
    event: 'Cobertura de eventos / rota de eventos',
    private: 'Rota particular — somente dashboard',
    tourism: 'Rota de viagem',
  };
  const statuses = { draft: 'Em planejamento', active: 'Ativa', paused: 'Pausada' };
  const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
  };
  const text = (value, name, max, required = true) => {
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
      fail(`Confira o campo ${name}.`);
    return value.trim();
  };
  const time = (value) => {
    if (typeof value !== 'string' || (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))
      fail('Informe horários válidos.');
    return value;
  };
  const id = (value) => {
    if (!Number.isSafeInteger(value) || value < 1) fail('Identificador inválido.');
    return value;
  };
  return async (req, res, path) => {
    if (path !== '/api/routes' && !path.startsWith('/api/routes/')) return false;
    try {
      const user = await session(req);
      if (!user) fail('Entre para continuar.', 401);
      const canManage = ['owner', 'manager', 'fleet'].includes(user.role);
      if (req.method === 'GET' && path === '/api/routes') {
        const recordsRaw =
          await db.all(`SELECT r.*, v.plate AS vehicle_plate, v.model AS vehicle_model, u.name AS driver_name
          FROM transport_routes r LEFT JOIN vehicles v ON v.id=r.vehicle_id LEFT JOIN users u ON u.id=r.driver_id
          ORDER BY r.name, r.id`);
        const records = recordsRaw.map((row) => ({
          ...row,
          stops: JSON.parse(row.stops),
          weekdays: JSON.parse(row.weekdays),
          arrival_next_day: !!row.arrival_next_day,
        }));
        const vehicles = canManage
          ? await db.all('SELECT id,plate,model FROM vehicles ORDER BY model,plate')
          : [];
        const drivers = canManage
          ? await db.all("SELECT id,name FROM users WHERE role='driver' ORDER BY name,id")
          : [];
        json(res, 200, { routes: records, canManage, types, statuses, vehicles, drivers });
        return true;
      }
      if (
        req.method !== 'POST' ||
        ![
          '/api/routes/save',
          '/api/routes/preview',
          '/api/routes/distance',
          '/api/routes/delete',
        ].includes(path)
      )
        fail('Rota não encontrada.', 404);
      if (!canManage)
        fail('Somente responsáveis pela operação ou frota podem gerenciar rotas.', 403);
      const data = await body(req, 50000);
      if (!['owner', 'manager', 'fleet'].includes((await session(req))?.role))
        fail('Acesso negado.', 403);
      if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Dados inválidos.');
      if (path === '/api/routes/delete') {
        const routeId = id(data.id);
        const route = await db.get('SELECT name FROM transport_routes WHERE id=$1', [routeId]);
        if (!route) fail('Rota não encontrada.', 404);
        if (data.confirm_name !== route.name)
          fail('O nome da rota não confere. Atualize e confirme novamente.');
        const result = await db.run(
          'DELETE FROM transport_routes WHERE id=$1 AND name=$2 RETURNING id',
          [routeId, data.confirm_name],
        );
        if (!result.rows || result.rows.length === 0)
          fail('A rota foi alterada. Atualize e tente novamente.', 409);
        json(res, 200, { ok: true });
        return true;
      }
      if (path === '/api/routes/distance') {
        try {
          json(res, 200, await calculateRouteDistance(data));
        } catch (error) {
          json(res, 400, {
            error:
              error.name === 'TimeoutError'
                ? 'O cálculo demorou demais. Tente novamente.'
                : error.message,
          });
        }
        return true;
      }
      if (path === '/api/routes/preview') {
        try {
          readMapsLink(data.maps_url);
        } catch (error) {
          fail(error.message);
        }
        const preview = await resolveMapsLink(data.maps_url);
        json(res, 200, preview);
        return true;
      }
      const routeId = data.id === null || data.id === undefined ? null : id(data.id);
      const existing = routeId
        ? await db.get('SELECT * FROM transport_routes WHERE id=$1', [routeId])
        : null;
      if (routeId && !existing) fail('Rota não encontrada.', 404);
      let embed;
      try {
        embed = normalizeMapsEmbed(
          data.maps_embed_url ??
            (existing?.maps_url === data.maps_url ? existing?.maps_embed_url : ''),
        );
      } catch (error) {
        fail(error.message);
      }
      const name = text(data.name, 'nome da rota', 120);
      let maps;
      try {
        maps = readMapsLink(data.maps_url);
      } catch (error) {
        fail(error.message);
      }
      const origin = text(data.origin, 'origem', 300),
        destination = text(data.destination, 'destino', 300);
      if ([origin, destination].some(isCoordinatePoint))
        fail('Informe o endereço da origem e do destino, não coordenadas.');
      if (!Object.hasOwn(types, data.type) || !Object.hasOwn(statuses, data.status))
        fail('Selecione um tipo e uma situação válidos.');
      if (!Array.isArray(data.stops) || data.stops.length > 30)
        fail('Cadastre no máximo 30 paradas.');
      const stops = data.stops.map((stop) => {
        if (!stop || typeof stop !== 'object') fail('Parada inválida.');
        const name = text(stop.name, 'local da parada', 300);
        if (isCoordinatePoint(name)) fail('Informe o endereço de cada parada, não coordenadas.');
        return {
          name,
          time: time(stop.time),
          notes: text(stop.notes, 'observações da parada', 300, false),
        };
      });
      if (
        !Array.isArray(data.weekdays) ||
        data.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
        new Set(data.weekdays).size !== data.weekdays.length
      )
        fail('Dias de operação inválidos.');
      const departure = time(data.departure),
        arrival = time(data.arrival);
      if (typeof data.arrival_next_day !== 'boolean') fail('Informe o dia de chegada.');
      if (departure && arrival && !data.arrival_next_day && arrival < departure)
        fail(
          'A chegada é anterior à saída. Marque chegada no dia seguinte se a viagem atravessar a meia-noite.',
        );
      const vehicleId = data.vehicle_id === null ? null : id(data.vehicle_id);
      const driverId = data.driver_id === null ? null : id(data.driver_id);
      if (vehicleId && !(await db.get('SELECT id FROM vehicles WHERE id=$1', [vehicleId])))
        fail('Veículo não encontrado. Atualize a lista.');
      if (
        driverId &&
        !(await db.get("SELECT id FROM users WHERE id=$1 AND (role='driver' OR id=$2)", [
          driverId,
          existing?.driver_id || 0,
        ]))
      )
        fail('Selecione um motorista cadastrado.');
      let distance = null;
      if (data.distance !== '' && data.distance !== null) {
        if (
          !['string', 'number'].includes(typeof data.distance) ||
          !/^\d+(?:[.,]\d{1,2})?$/.test(String(data.distance))
        )
          fail('Informe a distância em km, sem separador de milhar.');
        distance = Number(String(data.distance).replace(',', '.'));
        if (!Number.isFinite(distance) || distance <= 0 || distance > 100000)
          fail('Distância inválida.');
      }
      if (
        process.env.NODE_ENV !== 'test' &&
        (!existing || existing.maps_url !== maps.url || distance === null)
      ) {
        try {
          distance = (await calculateRouteDistance({ maps_url: maps.url })).distance;
        } catch (error) {
          if (distance === null)
            fail(
              error.name === 'TimeoutError'
                ? 'O cálculo demorou demais. Tente novamente ou informe os km manualmente.'
                : error.message,
            );
        }
      }
      const prices = ['total_price', 'passenger_price'].map((key) => {
        const raw = data[key] === undefined ? existing?.[key] : data[key];
        if (raw == null || raw === '') return null;
        if (
          !['string', 'number'].includes(typeof raw) ||
          !/^\d+(?:[.,]\d{1,2})?$/.test(String(raw))
        )
          fail('Informe os preços com até duas casas decimais, sem separador de milhar.');
        const value = Number(String(raw).replace(',', '.'));
        if (!Number.isFinite(value) || value < 0 || value > 100000000) fail('Preço inválido.');
        return value;
      });
      const values = [
        name,
        maps.url,
        origin,
        destination,
        JSON.stringify(stops),
        data.type,
        data.status,
        JSON.stringify([...data.weekdays].sort()),
        departure,
        arrival,
        Number(data.arrival_next_day),
        distance,
        vehicleId,
        driverId,
        text(data.notes, 'observações', 3000, false),
      ];
      let savedId = routeId;
      if (routeId)
        await db.run(
          'UPDATE transport_routes SET name=$1,maps_url=$2,origin=$3,destination=$4,stops=$5,type=$6,status=$7,weekdays=$8,departure=$9,arrival=$10,arrival_next_day=$11,distance=$12,vehicle_id=$13,driver_id=$14,notes=$15,updated_at=CURRENT_TIMESTAMP WHERE id=$16',
          [...values, routeId],
        );
      else {
        const res = await db.run(
          'INSERT INTO transport_routes(name,maps_url,origin,destination,stops,type,status,weekdays,departure,arrival,arrival_next_day,distance,vehicle_id,driver_id,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id',
          values,
        );
        savedId = res.rows[0].id;
      }
      await db.run(
        'UPDATE transport_routes SET maps_embed_url=$1,total_price=$2,passenger_price=$3 WHERE id=$4',
        [embed, ...prices, savedId],
      );
      json(res, routeId ? 200 : 201, { ok: true, id: savedId });
    } catch (error) {
      json(res, error.status || 400, {
        error: error.status ? error.message : 'Não foi possível salvar a rota. Confira os dados.',
      });
    }
    return true;
  };
}
