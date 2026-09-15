export function projectTrip(row, now = new Date()) {
  const trip = { ...JSON.parse(row.data), id: row.id, slug: `viagem-${row.id}` };
  const duration = Math.max(
    0,
    Math.round(
      (Date.parse(trip.endDate.slice(0, 10)) - Date.parse(trip.date.slice(0, 10))) / 86400000,
    ),
  );
  let day = trip.date.slice(0, 10);
  if (trip.frequency === 'weekly') {
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    if (day < today) day = today;
    for (let i = 0; i < 8; i++) {
      const d = new Date(day + 'T12:00:00-03:00');
      if (
        trip.weekdays.includes(d.getUTCDay()) &&
        Date.parse(day + trip.date.slice(10)) >= now.getTime()
      )
        break;
      d.setUTCDate(d.getUTCDate() + 1);
      day = d.toISOString().slice(0, 10);
    }
  }
  const back = new Date(day + 'T12:00:00-03:00');
  back.setUTCDate(back.getUTCDate() + duration);
  return {
    ...trip,
    origin: trip.origin || trip.departureLocation,
    destination: trip.city,
    departureDate: day,
    returnDate: back.toISOString().slice(0, 10),
    departure: trip.departure || trip.date.slice(11, 16),
    returnTime: trip.returnTime || trip.endDate.slice(11, 16),
    availableSeats: trip.seatsAvailable,
    duration: trip.duration || `${duration + 1} dia(s)`,
    stops: trip.stops.map((stop) => stop.name),
    frequencyLabel:
      trip.frequency === 'weekly'
        ? 'Toda semana: ' +
          trip.weekdays
            .map((d) => ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d])
            .join(', ')
        : 'Saída em data marcada',
  };
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

export async function initTrips(db, { session, body, json, validPhoto }) {
  db = ensureDbCompat(db);
  await db.exec(
    'CREATE TABLE IF NOT EXISTS company_trips (id SERIAL PRIMARY KEY, data TEXT NOT NULL)',
  );
  const project = (row) => ({ ...JSON.parse(row.data), id: row.id, slug: `viagem-${row.id}` });
  return async (req, res, path) => {
    if (!['/api/trips', '/api/trips/delete', '/api/public/trips'].includes(path)) return false;
    const reply = (status, value) => {
      json(res, status, value);
      return true;
    };
    const publicView = path === '/api/public/trips';
    if (!publicView) {
      const user = await session(req);
      if (!user) return reply(401, { error: 'Entre para continuar.' });
      if (!['owner', 'manager'].includes(user.role))
        return reply(403, { error: 'Somente proprietários e gerentes podem gerenciar viagens.' });
    }
    if (req.method === 'GET' && path !== '/api/trips/delete') {
      const rows = await db.all('SELECT * FROM company_trips ORDER BY id DESC');
      const trips = rows
        .map((row) => (publicView ? projectTrip(row) : project(row)))
        .filter((e) => !publicView || e.published);
      return reply(200, { trips });
    }
    if (req.method !== 'POST' || publicView) return reply(405, { error: 'Método não permitido.' });
    const input = await body(req, 110000000);
    if (!input || typeof input !== 'object') return reply(400, { error: 'Dados inválidos.' });
    const id = Number(input.id);
    const existingRow = id ? await db.get('SELECT * FROM company_trips WHERE id=$1', [id]) : null;
    if (input.id && (!Number.isSafeInteger(id) || !existingRow))
      return reply(404, { error: 'Pacote não encontrado.' });
    if (path === '/api/trips/delete') {
      if (!existingRow || input.confirmTitle !== project(existingRow).title)
        return reply(400, { error: 'Confirme o pacote a excluir.' });
      await db.run('DELETE FROM company_trips WHERE id=$1', [id]);
      return reply(200, { ok: true });
    }
    const event = { route_id: null, stops: [] };
    if (!['weekly', 'once'].includes(input.frequency))
      return reply(400, { error: 'Selecione a frequência das saídas.' });
    event.frequency = input.frequency;
    event.weekdays = input.weekdays || [];
    if (
      !Array.isArray(event.weekdays) ||
      event.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      new Set(event.weekdays).size !== event.weekdays.length ||
      (event.frequency === 'weekly' && !event.weekdays.length)
    )
      return reply(400, { error: 'Selecione os dias da semana em que a viagem acontece.' });
    for (const key of ['program', 'notIncluded']) {
      if (typeof input[key] !== 'string' || input[key].length > 6000)
        return reply(400, { error: 'Confira a programação e os itens não inclusos.' });
      event[key] = input[key].trim();
    }
    if (input.route_id) {
      const routeId = Number(input.route_id);
      if (!Number.isSafeInteger(routeId))
        return reply(400, { error: 'Selecione uma rota válida.' });
      const route = await db.get('SELECT * FROM transport_routes WHERE id=$1', [routeId]);
      if (!route) return reply(400, { error: 'Selecione uma rota cadastrada.' });
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
      return reply(400, { error: 'Informe nome, cidade e local do pacote.' });
    for (const key of ['date', 'endDate']) {
      if (
        typeof input[key] !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input[key]) ||
        !Number.isFinite(Date.parse(input[key] + '-03:00'))
      )
        return reply(400, { error: 'Informe as datas e horários do pacote.' });
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
    event.image = photos[0] || '/assets/road-hero.png';
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
    if (existingRow)
      await db.run('UPDATE company_trips SET data=$1 WHERE id=$2', [JSON.stringify(event), id]);
    else {
      const res = await db.run('INSERT INTO company_trips(data) VALUES ($1) RETURNING id', [
        JSON.stringify(event),
      ]);
      event.id = res.rows[0].id;
    }
    return reply(200, { id: id || event.id });
  };
}
