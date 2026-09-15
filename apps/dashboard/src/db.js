import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
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

function getSqliteDb() {
  if (!process.env.DATABASE_PATH) return null;
  const key = '__jng_sqlite_db__';
  const db = globalThis[key];
  if (!db || db.__path !== process.env.DATABASE_PATH) {
    const next = new DatabaseSync(process.env.DATABASE_PATH);
    next.__path = process.env.DATABASE_PATH;
    globalThis[key] = next;
    return next;
  }
  return db;
}

export function normalizeSqliteSql(sql) {
  let value = String(sql);
  value = value.replace(/\bSERIAL\b/gi, 'INTEGER');
  value = value.replace(/\bBIGINT\b/gi, 'INTEGER');
  value = value.replace(/\bTIMESTAMPTZ\b/gi, 'TEXT');
  value = value.replace(/\bDOUBLE PRECISION\b/gi, 'REAL');
  value = value.replace(/\bBOOLEAN\b/gi, 'INTEGER');
  value = value.replace(/\bUUID\b/gi, 'TEXT');
  value = value.replace(/\bDEFAULT\s+now\s*\(\s*\)/gi, 'DEFAULT CURRENT_TIMESTAMP');
  value = value.replace(/\$(\d+)/g, () => '?');
  return value;
}

function sqliteTableColumns(tableName) {
  const db = getSqliteDb();
  const table = String(tableName).replace(/[^A-Za-z0-9_]/g, '');
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.map((row) => ({ column_name: row.name }));
}

function sqliteExecute(text, params = []) {
  const db = getSqliteDb();
  if (!db) throw new Error('DATABASE_PATH is required for SQLite execution.');
  const normalized = normalizeSqliteSql(text);
  const infoMatch =
    /^\s*SELECT\s+column_name\s+FROM\s+information_schema\.columns\s+WHERE\s+table_name\s*=\s*['\"]?([A-Za-z0-9_]+)['\"]?/i.exec(
      normalized,
    );
  if (infoMatch) return { rows: sqliteTableColumns(infoMatch[1]), rowCount: 0 };
  const values = Array.isArray(params) ? params : [params];
  const statement = db.prepare(normalized);
  const useReturning = /\bRETURNING\b/i.test(normalized);
  const useSelect = /^\s*(SELECT|WITH)\b/i.test(normalized);
  if (useSelect || useReturning) {
    const rows = values.length ? statement.all(...values) : statement.all();
    return { rows, rowCount: rows.length };
  }
  const result = values.length ? statement.run(...values) : statement.run();
  return { rows: [], rowCount: Number(result?.changes || 0) };
}

let pool;

async function getPool() {
  if (!pool) {
    pool = import('pg').then(({ default: pg }) => {
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL.');
      const ssl = process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined;
      if (ssl) {
        for (const [name, variable] of Object.entries({
          ca: 'PGSSLROOTCERT',
          cert: 'PGSSLCERT',
          key: 'PGSSLKEY',
        })) {
          if (process.env[variable]) ssl[name] = fs.readFileSync(process.env[variable], 'utf8');
        }
      }
      const instance = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl,
        max: 5,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
      });
      instance.on('error', (error) => console.error('PostgreSQL pool error:', error.code));
      return instance;
    });
  }
  return pool;
}

export async function query(text, params = []) {
  if (getSqliteDb()) return sqliteExecute(text, params);
  return (await getPool()).query(text, params);
}

export async function all(text, params = []) {
  return (await query(text, params)).rows;
}

export async function get(text, params = []) {
  return (await query(text, params)).rows[0] || null;
}

export const run = query;

export function exec(text) {
  const sqlite = getSqliteDb();
  if (sqlite) {
    sqlite.exec(normalizeSqliteSql(text));
    return { rows: [] };
  }
  return transaction((client) => client.query(text));
}

export async function transaction(callback) {
  const sqlite = getSqliteDb();
  const client = sqlite
    ? { query: async (text, params = []) => sqliteExecute(text, params), release() {} }
    : await (await getPool()).connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function close() {
  if (pool) await (await pool).end();
  pool = undefined;
}

export default { query, all, get, run, exec, transaction, close };
