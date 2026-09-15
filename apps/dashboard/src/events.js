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

export async function initEvents(db, { session, body, json, validPhoto }) {
  db = ensureDbCompat(db);
  await db.exec(
    'CREATE TABLE IF NOT EXISTS company_events (id SERIAL PRIMARY KEY, data TEXT NOT NULL)',
  );
  const project = (row) => ({ ...JSON.parse(row.data), id: row.id, slug: `evento-${row.id}` });
  return async (req, res, path) => {
    if (!['/api/events', '/api/events/delete', '/api/public/events'].includes(path)) return false;
    const reply = (status, value) => {
      json(res, status, value);
      return true;
    };
    const publicView = path === '/api/public/events';
    if (!publicView) {
      const user = await session(req);
      if (!user) return reply(401, { error: 'Entre para continuar.' });
      if (!['owner', 'manager'].includes(user.role))
        return reply(403, { error: 'Somente proprietários e gerentes podem gerenciar eventos.' });
    }
    if (req.method === 'GET' && path !== '/api/events/delete') {
      const rows = await db.all('SELECT * FROM company_events ORDER BY id DESC');
      const events = [];
      for (const row of rows) {
        const e = project(row);
        if (!publicView) {
          events.push(e);
        } else {
          if (
            e.published &&
            (!e.route_id ||
              (await db.get('SELECT type FROM transport_routes WHERE id=$1', [e.route_id]))
                ?.type !== 'private')
          )
            events.push(e);
        }
      }
      return reply(200, { events });
    }
    if (req.method !== 'POST' || publicView) return reply(405, { error: 'Método não permitido.' });
    const input = await body(req, 110000000);
    if (!input || typeof input !== 'object') return reply(400, { error: 'Dados inválidos.' });
    const id = Number(input.id);
    const existing = id ? await db.get('SELECT * FROM company_events WHERE id=$1', [id]) : null;
    if (input.id && (!Number.isSafeInteger(id) || !existing))
      return reply(404, { error: 'Evento não encontrado.' });
    if (path === '/api/events/delete') {
      if (!existing || input.confirmTitle !== project(existing).title)
        return reply(400, { error: 'Confirme o evento a excluir.' });
      await db.run('DELETE FROM company_events WHERE id=$1', [id]);
      return reply(200, { ok: true });
    }
    const event = { route_id: null, stops: [] };
    if (input.route_id) {
      const routeId = Number(input.route_id);
      if (!Number.isSafeInteger(routeId))
        return reply(400, { error: 'Selecione uma rota válida.' });
      const route = await db.get('SELECT * FROM transport_routes WHERE id=$1', [routeId]);
      if (!route || route.type === 'private')
        return reply(400, { error: 'Selecione uma rota cadastrada que não seja particular.' });
      event.route_id = route.id;
      event.origin = route.origin;
      event.destination = route.destination;
      event.stops = JSON.parse(route.stops).map((stop) => ({ name: stop.name, time: stop.time }));
      event.maps_url = route.maps_url;
    }
    for (const [key, max] of Object.entries({
      title: 120,
      subtitle: 2000,
      city: 120,
      venue: 300,
      category: 60,
      departureLocation: 300,
      departure: 5,
      returnTime: 80,
      vehicle: 120,
      policies: 3000,
    })) {
      if (input[key] != null && typeof input[key] !== 'string')
        return reply(400, { error: 'Preencha os campos corretamente.' });
      event[key] = (input[key] || '').trim();
      if (event[key].length > max) return reply(400, { error: `O campo ${key} excedeu o limite.` });
    }
    if (!event.title || !event.city || !event.venue)
      return reply(400, { error: 'Informe nome, cidade e local do evento.' });
    for (const key of ['date', 'endDate']) {
      if (
        typeof input[key] !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input[key]) ||
        !Number.isFinite(Date.parse(input[key] + '-03:00'))
      )
        return reply(400, { error: 'Informe as datas e horários do evento.' });
      event[key] = input[key] + '-03:00';
    }
    if (event.endDate < event.date)
      return reply(400, { error: 'O término não pode ser anterior ao início.' });
    if (event.departure && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.departure))
      return reply(400, { error: 'Horário de saída inválido.' });
    for (const key of ['price', 'seatsAvailable']) {
      const value = input[key];
      event[key] = value === '' || value == null ? null : Number(value);
      if (
        event[key] !== null &&
        (!Number.isFinite(event[key]) ||
          event[key] < 0 ||
          event[key] > 1000000 ||
          (key === 'seatsAvailable' && !Number.isInteger(event[key])))
      )
        return reply(400, { error: 'Confira o valor e a quantidade de vagas.' });
    }
    if (!['available', 'last-seats', 'sold-out', 'coming-soon', 'ended'].includes(input.status))
      return reply(400, { error: 'Selecione uma situação válida.' });
    event.status = input.status;
    event.published = input.published === true;
    event.featured = input.featured === true;
    if (typeof input.included !== 'string' || input.included.length > 3000)
      return reply(400, { error: 'Confira os itens inclusos.' });
    event.included = input.included
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const photos = input.photos ?? (input.image ? [input.image] : []);
    if (!Array.isArray(photos) || photos.some((photo) => !photo || !validPhoto(photo)))
      return reply(400, { error: 'Arquivo inválido. Envie a mídia novamente.' });
    event.photos = photos;
    event.image = photos[0] || '/assets/event-stage.png';
    event.poster = event.image;
    event.vehicle_id = null;
    if (input.vehicle_id) {
      const vehicleId = Number(input.vehicle_id);
      if (!Number.isSafeInteger(vehicleId))
        return reply(400, { error: 'Selecione um veículo válido.' });
      const vehicle = await db.get('SELECT id,model FROM vehicles WHERE id=$1', [vehicleId]);
      if (!vehicle) return reply(400, { error: 'Veículo não encontrado. Atualize a lista.' });
      event.vehicle_id = vehicle.id;
      event.vehicle = vehicle.model;
    }
    if (existing)
      await db.run('UPDATE company_events SET data=$1 WHERE id=$2', [JSON.stringify(event), id]);
    else {
      const res = await db.run('INSERT INTO company_events(data) VALUES ($1) RETURNING id', [
        JSON.stringify(event),
      ]);
      event.id = res.rows ? res.rows[0].id : null;
    }
    return reply(200, { id: id || event.id });
  };
}
