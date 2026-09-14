import pkg from 'pg';
const { Pool } = pkg;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) process.env[key] = value;
  }
}

let connectionString = process.env.DATABASE_URL || (process.env.PGHOST ? `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'dashboard'}` : null);
if (!connectionString) throw new Error('DATABASE_URL or PGHOST must be set for PostgreSQL connection');
if (connectionString.includes('sslmode=require')) {
  connectionString = connectionString.replace(/[?&]sslmode=require/gi, '');
  if (connectionString.includes('?') === false && connectionString.includes('&') === false) connectionString = connectionString.replace(/\?$/, '');
}

let ssl;
if (connectionString.includes('vertraweb.app') || process.env.PGSSL === 'true') {
  const certPath = path.join(root, 'certs', 'database.crt');
  const keyPath = path.join(root, 'certs', 'database.key');
  ssl = { rejectUnauthorized: false };
  if (fs.existsSync(certPath)) {
    const cert = fs.readFileSync(certPath, 'utf8');
    ssl.ca = cert;
    ssl.cert = cert;
  }
  if (fs.existsSync(keyPath)) ssl.key = fs.readFileSync(keyPath, 'utf8');
}
const pool = new Pool({ connectionString, max: 10, ssl });

export async function query(text, params = []) { const res = await pool.query(text, params); return res; }
export async function all(text, params = []) { const res = await pool.query(text, params); return res.rows; }
export async function get(text, params = []) { const res = await pool.query(text, params); return res.rows[0] || null; }
export async function run(text, params = []) { const res = await pool.query(text, params); return res; }
export async function exec(text) { // execute multiple statements
  const client = await pool.connect();
  try { await client.query('BEGIN'); for (const stmt of text.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) await client.query(stmt); await client.query('COMMIT'); } catch (e) { try { await client.query('ROLLBACK'); } catch {} throw e; } finally { client.release(); }
}
export async function transaction(cb) { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await cb(client); await client.query('COMMIT'); return result; } catch (e) { try { await client.query('ROLLBACK'); } catch {} throw e; } finally { client.release(); } }

export default { query, all, get, run, exec, transaction };
