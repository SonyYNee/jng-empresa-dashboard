import pkg from 'pg';
const { Pool } = pkg;
import { parse } from 'url';

const connectionString = process.env.DATABASE_URL || (process.env.PGHOST ? `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'dashboard'}` : null);
if (!connectionString) throw new Error('DATABASE_URL or PGHOST must be set for PostgreSQL connection');

const pool = new Pool({ connectionString, max: 10 });

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
