import http from 'node:http';
import { initMedia } from './media.js';
import db from './db.js';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initFleet } from './fleet.js';
import { initTrips } from './trips.js';
import { initEvents } from './events.js';
import { initSocial } from './social.js';
import { initRoutes } from './routes.js';
import { isCoordinatePoint } from '../public/maps-link.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(join(root, 'data'), { recursive: true });
const mediaDir = process.env.MEDIA_DIR || join(root, 'data', 'media');
mkdirSync(mediaDir, { recursive: true });

const migrate = async () => {
  await db.exec(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS activity (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), role TEXT);
  CREATE TABLE IF NOT EXISTS vehicles (id SERIAL PRIMARY KEY, plate TEXT NOT NULL UNIQUE, model TEXT NOT NULL, year INTEGER NOT NULL, seats INTEGER NOT NULL, odometer DOUBLE PRECISION NOT NULL, fuel_capacity DOUBLE PRECISION NOT NULL, arla_capacity DOUBLE PRECISION NOT NULL DEFAULT 0, photos TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS refills (id SERIAL PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), kind TEXT NOT NULL, date TEXT NOT NULL, odometer DOUBLE PRECISION NOT NULL, litres DOUBLE PRECISION NOT NULL, price INTEGER NOT NULL, total INTEGER NOT NULL, tank_full INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS maintenance (id SERIAL PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), description TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, recurrence INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS vehicle_entries (id SERIAL PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), kind TEXT NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL);
  `);
  // ensure role and photo columns exist
  const cols = await db.all(
    "SELECT column_name FROM information_schema.columns WHERE table_name='users'",
  );
  const colNames = cols.map((c) => c.column_name);
  if (!colNames.includes('role'))
    await db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
  if (!colNames.includes('photo')) await db.run('ALTER TABLE users ADD COLUMN photo TEXT');
  const activityCols = await db.all(
    "SELECT column_name FROM information_schema.columns WHERE table_name='activity'",
  );
  if (!activityCols.map((c) => c.column_name).includes('role'))
    await db.run('ALTER TABLE activity ADD COLUMN role TEXT');
};
let runtimeDbPath = null;
const roles = {
  owner: 'Proprietário',
  manager: 'Gerente de Operações',
  hr: 'Recursos Humanos',
  fleet: 'Coordenador de Frota',
  driver: 'Motorista',
  member: 'Colaborador',
};
function currentProduction() {
  return process.env.NODE_ENV === 'production';
}
function currentSetupToken() {
  return process.env.SETUP_TOKEN || (currentProduction() ? null : randomBytes(24).toString('hex'));
}
async function ensureRuntimeState() {
  const dbPath = process.env.DATABASE_PATH || '';
  if (runtimeDbPath !== dbPath) {
    runtimeDbPath = dbPath;
    await migrate();
  }
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
const attempts = new Map();
const countUsers = async () => Number((await db.get('SELECT COUNT(*) AS total FROM users')).total);
function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function passwordMatches(password, encoded) {
  const [salt, key] = encoded.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(key, 'hex'));
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
async function body(req, limit = 8192) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > limit) throw new Error('Request too large');
  }
  return JSON.parse(value || '{}');
}
async function session(req) {
  const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return null;
  return await db.get(
    'SELECT users.id, users.name, users.email, users.role, users.photo, users.created_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=$1 AND expires_at>$2',
    [hash(token), Date.now()],
  );
}
function validPhoto(photo, maxBytes = 512 * 1024) {
  if (photo === null) return true;
  if (typeof photo !== 'string') return false;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > maxBytes || bytes.length < 24 || bytes.toString('base64') !== match[2])
    return false;
  return match[1] === 'png'
    ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}
const passwordAttempts = new Map();
await ensureRuntimeState();
const media = await initMedia(mediaDir, { session, json });
const fleetHandler = await initFleet(db, {
  session,
  body,
  json,
  validPhoto: (photo) => media.valid(photo) || validPhoto(photo, 5 * 1024 * 1024),
});
const tripsHandler = await initTrips(db, {
  session,
  body,
  json,
  validPhoto: (photo) => media.valid(photo) || validPhoto(photo, 5 * 1024 * 1024),
});
const eventsHandler = await initEvents(db, {
  session,
  body,
  json,
  validPhoto: (photo) => media.valid(photo) || validPhoto(photo, 5 * 1024 * 1024),
});
const socialHandler = await initSocial(db, { session, body, json });
const routesHandler = await initRoutes(db, { session, body, json });
function cookie(res, token, age, secure = currentProduction()) {
  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`,
  );
}
export const server = http.createServer(async (req, res) => {
  const production = currentProduction();
  const setupToken = currentSetupToken();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  try {
    await ensureRuntimeState();
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz' && req.method === 'GET') {
      await db.get('SELECT 1 AS ready');
      return json(res, 200, { status: 'ok' });
    }
    if (req.method === 'POST') {
      const expected =
        process.env.APP_ORIGIN || `${production ? 'https' : 'http'}://${req.headers.host}`;
      if (req.headers.origin !== expected)
        return json(res, 403, { error: 'Origem da solicitação inválida.' });
    }
    if (await media.handler(req, res, url.pathname)) return;
    if (await tripsHandler(req, res, url.pathname)) return;
    if (await eventsHandler(req, res, url.pathname)) return;
    if (await socialHandler(req, res, url.pathname)) return;
    if (url.pathname === '/api/public/routes') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
      const rows = await db.all(
        "SELECT id,name,maps_url,maps_embed_url,origin,destination,stops,type,weekdays,departure,arrival,arrival_next_day,distance,total_price,passenger_price FROM transport_routes WHERE status='active' AND type!='private' ORDER BY name,id",
      );
      const routes = rows.map((route) => ({
        id: route.id,
        name: route.name,
        maps_url: route.maps_url,
        origin: isCoordinatePoint(route.origin) ? 'Endereço de origem a confirmar' : route.origin,
        destination: isCoordinatePoint(route.destination)
          ? 'Endereço de destino a confirmar'
          : route.destination,
        maps_embed_url: route.maps_embed_url,
        type: route.type,
        weekdays: JSON.parse(route.weekdays),
        departure: route.departure,
        arrival: route.arrival,
        arrival_next_day: !!route.arrival_next_day,
        distance: route.distance,
        total_price: route.total_price,
        passenger_price: route.passenger_price,
        stops: JSON.parse(route.stops).map((stop) => ({
          name: isCoordinatePoint(stop.name) ? 'Endereço da parada a confirmar' : stop.name,
          time: stop.time,
        })),
      }));
      return json(res, 200, { routes });
    }
    if (url.pathname === '/api/public/fleet') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
      const rows = await db.all(
        'SELECT id,model,year,seats,photos FROM vehicles ORDER BY model,id',
      );
      const vehicles = rows.map((vehicle) => ({
        id: vehicle.id,
        model: vehicle.model,
        year: vehicle.year,
        seats: vehicle.seats,
        photos: JSON.parse(vehicle.photos)
          .filter(
            (photo) => (media.valid(photo) || validPhoto(photo, 5 * 1024 * 1024)) && photo !== null,
          )
          .slice(0, 5),
      }));
      return json(res, 200, { vehicles });
    }
    if (req.method === 'GET' && url.pathname === '/api/me') {
      const user = await session(req);
      return json(res, 200, { user, needsSetup: (await countUsers()) === 0, roles });
    }
    if (await fleetHandler(req, res, url.pathname)) return;
    if (await routesHandler(req, res, url.pathname)) return;
    if (url.pathname === '/api/users' || url.pathname === '/api/users/role') {
      const actor = await session(req);
      if (!actor) return json(res, 401, { error: 'Entre para continuar.' });
      if (actor.role !== 'owner')
        return json(res, 403, { error: 'Somente proprietários podem gerenciar usuários.' });
      if (req.method === 'GET' && url.pathname === '/api/users') {
        const users = await db.all(
          'SELECT id,name,email,role,photo,created_at FROM users ORDER BY name,id',
        );
        return json(res, 200, { users, roles });
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
      const data = await body(req);
      if ((await session(req))?.role !== 'owner')
        return json(res, 403, { error: 'Somente proprietários podem gerenciar usuários.' });
      if (!data || typeof data.role !== 'string' || !Object.hasOwn(roles, data.role))
        return json(res, 400, { error: 'Selecione um cargo válido.' });
      if (url.pathname === '/api/users') {
        const name = typeof data.name === 'string' ? data.name.trim() : '';
        const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
        if (
          !name ||
          name.length > 80 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          email.length > 254
        )
          return json(res, 400, { error: 'Informe um nome e um e-mail válidos.' });
        if (
          typeof data.password !== 'string' ||
          data.password.length < 6 ||
          data.password.length > 128
        )
          return json(res, 400, { error: 'A senha deve ter entre 6 e 128 caracteres.' });
        if (await db.get('SELECT id FROM users WHERE email=$1', [email]))
          return json(res, 409, { error: 'Este e-mail já está em uso.' });
        const inserted = await db.run(
          'INSERT INTO users(name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING id',
          [name, email, passwordHash(data.password), data.role],
        );
        return json(res, 201, { ok: true, id: Number(inserted.rows[0].id) });
      }
      if (!Number.isSafeInteger(data.id) || data.id < 1)
        return json(res, 400, { error: 'Usuário inválido.' });
      try {
        await db.transaction(async (client) => {
          const targetRes = await client.query('SELECT id,role FROM users WHERE id=$1', [data.id]);
          const target = targetRes.rows[0];
          if (!target) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
          const ownerCountRes = await client.query(
            "SELECT COUNT(*) AS total FROM users WHERE role='owner'",
          );
          const ownerCount = Number(ownerCountRes.rows[0].total);
          if (target.role === 'owner' && data.role !== 'owner' && ownerCount <= 1)
            throw Object.assign(new Error('A empresa precisa manter pelo menos um proprietário.'), {
              status: 409,
            });
          await client.query('UPDATE users SET role=$1 WHERE id=$2', [data.role, target.id]);
        });
      } catch (error) {
        if (error.status) return json(res, error.status, { error: error.message });
        throw error;
      }
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && ['/api/profile', '/api/password'].includes(url.pathname)) {
      const user = await session(req);
      if (!user) return json(res, 401, { error: 'Entre para continuar.' });
      const data = await body(req, url.pathname === '/api/profile' ? 720_000 : 8192);
      if (Object.hasOwn(data, 'role') || Object.hasOwn(data, 'user_id'))
        return json(res, 403, {
          error: 'O cargo não pode ser alterado nas configurações pessoais.',
        });
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      const changingPassword = url.pathname === '/api/password';
      if (changingPassword || email !== user.email) {
        const now = Date.now();
        for (const [id, value] of passwordAttempts)
          if (value.until < now) passwordAttempts.delete(id);
        const attempt = passwordAttempts.get(user.id) || { count: 0, until: now + 15 * 60_000 };
        if (attempt.count >= 10)
          return json(res, 429, { error: 'Muitas tentativas. Aguarde 15 minutos.' });
        const current = await db.get('SELECT password FROM users WHERE id=$1', [user.id]);
        if (
          typeof data.currentPassword !== 'string' ||
          data.currentPassword.length > 128 ||
          !passwordMatches(data.currentPassword, current.password)
        ) {
          attempt.count++;
          passwordAttempts.set(user.id, attempt);
          return json(res, 400, { error: 'A senha atual está incorreta.' });
        }
        passwordAttempts.delete(user.id);
      }
      if (changingPassword) {
        if (
          typeof data.password !== 'string' ||
          data.password.length < 6 ||
          data.password.length > 128
        )
          return json(res, 400, { error: 'A nova senha deve ter entre 6 e 128 caracteres.' });
        if (data.password !== data.confirmPassword)
          return json(res, 400, { error: 'A confirmação da nova senha não confere.' });
        if (data.password === data.currentPassword)
          return json(res, 400, { error: 'Escolha uma senha diferente da atual.' });
        const password = passwordHash(data.password);
        await db.transaction(async (client) => {
          await client.query('UPDATE users SET password=$1 WHERE id=$2', [password, user.id]);
          await client.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
        });
        cookie(res, '', 0);
        return json(res, 200, { ok: true });
      }
      if (
        typeof data.name !== 'string' ||
        !data.name.trim() ||
        data.name.trim().length > 80 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      )
        return json(res, 400, { error: 'Informe um nome e um e-mail válidos.' });
      if (await db.get('SELECT id FROM users WHERE email=$1 AND id<>$2', [email, user.id]))
        return json(res, 409, { error: 'Este e-mail já está em uso.' });
      const photo = Object.hasOwn(data, 'photo') ? data.photo : user.photo;
      if (!validPhoto(photo))
        return json(res, 400, {
          error: 'Use uma foto JPG ou PNG de até 512 KB após o processamento.',
        });
      await db.run('UPDATE users SET name=$1,email=$2,photo=$3 WHERE id=$4', [
        data.name.trim(),
        email,
        photo,
        user.id,
      ]);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && ['/api/login', '/api/setup'].includes(url.pathname)) {
      const key = req.socket.remoteAddress;
      const now = Date.now();
      for (const [ip, item] of attempts) if (item.until < now) attempts.delete(ip);
      const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
      if (++attempt.count > 10)
        return json(res, 429, { error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
      attempts.set(key, attempt);
      const data = await body(req);
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      const password = typeof data.password === 'string' ? data.password : '';
      if (password.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        return json(res, 400, { error: 'Informe um e-mail e uma senha válidos.' });
      if (url.pathname === '/api/setup') {
        if (
          (await countUsers()) ||
          !setupToken ||
          typeof data.token !== 'string' ||
          hash(data.token) !== hash(setupToken)
        )
          return json(res, 403, { error: 'Configuração inicial indisponível ou código inválido.' });
        if (
          password.length < 6 ||
          typeof data.name !== 'string' ||
          !data.name.trim() ||
          data.name.length > 80
        )
          return json(res, 400, {
            error: 'Informe seu nome e uma senha com pelo menos 6 caracteres.',
          });
        await db.run("INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,'owner')", [
          data.name.trim(),
          email,
          passwordHash(password),
        ]);
      }
      const user = await db.get('SELECT * FROM users WHERE email=$1', [email]);
      if (!user || !passwordMatches(password, user.password))
        return json(res, 401, { error: 'E-mail ou senha incorretos.' });
      attempts.delete(key);
      const token = randomBytes(32).toString('hex');
      await db.run('DELETE FROM sessions WHERE expires_at<=$1', [now]);
      await db.run('INSERT INTO sessions(token,user_id,expires_at) VALUES ($1,$2,$3)', [
        hash(token),
        user.id,
        now + 8 * 3600_000,
      ]);
      await db.run('INSERT INTO activity (user_id,action,role) VALUES ($1,$2,$3)', [
        user.id,
        'Login realizado',
        user.role,
      ]);
      cookie(res, token, 8 * 3600);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      if (token) await db.run('DELETE FROM sessions WHERE token=$1', [hash(token)]);
      cookie(res, '', 0);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/overview') {
      const user = await session(req);
      if (!user) return json(res, 401, { error: 'Entre para continuar.' });
      const teamView = ['owner', 'manager', 'hr'].includes(user.role);
      const activity = await db.all(
        `SELECT activity.action, activity.created_at, activity.role, users.id AS user_id, users.name, users.photo FROM activity JOIN users ON users.id=activity.user_id ${teamView ? '' : 'WHERE activity.user_id=$1'} ORDER BY activity.id DESC LIMIT 10`,
        ...(teamView ? [] : [user.id]),
      );
      const accessesRow = await db.get('SELECT COUNT(*) AS total FROM activity WHERE user_id=$1', [
        user.id,
      ]);
      return json(res, 200, { user, roles, teamView, accesses: accessesRow.total, activity });
    }
    const files = {
      '/viagens': ['index.html', 'text/html'],
      '/trips.js': ['trips.js', 'text/javascript'],
      '/eventos': ['index.html', 'text/html'],
      '/events.js': ['events.js', 'text/javascript'],
      '/redes-sociais': ['index.html', 'text/html'],
      '/social.js': ['social.js', 'text/javascript'],
      '/': ['index.html', 'text/html'],
      '/login': ['index.html', 'text/html'],
      '/visao-geral': ['index.html', 'text/html'],
      '/configuracoes': ['index.html', 'text/html'],
      '/usuarios': ['index.html', 'text/html'],
      '/rotas': ['index.html', 'text/html'],
      '/routes.js': ['routes.js', 'text/javascript'],
      '/maps-link.js': ['maps-link.js', 'text/javascript'],
      '/frota': ['index.html', 'text/html'],
      '/fleet.js': ['fleet.js', 'text/javascript'],
      '/style.css': ['style.css', 'text/css'],
      '/app.js': ['app.js', 'text/javascript'],
    };
    const file = files[url.pathname];
    if (req.method !== 'GET' || !file) return json(res, 404, { error: 'Página não encontrada.' });
    res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8' });
    res.end(readFileSync(join(publicDir, file[0])));
  } catch {
    json(res, 400, { error: 'Não foi possível concluir a solicitação.' });
  }
});
server.requestTimeout = 0;
if (process.env.NODE_ENV !== 'test')
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', async () => {
    await ensureRuntimeState();
    const setupToken = currentSetupToken();
    console.log(`Dashboard: http://localhost:${process.env.PORT || 3000}`);
    if (!(await countUsers()) && setupToken)
      console.log(`Código para criar o primeiro acesso: ${setupToken}`);
  });
