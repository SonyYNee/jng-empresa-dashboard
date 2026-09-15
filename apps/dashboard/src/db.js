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

export function query(text, params = []) {
  if (getSqliteDb()) return Promise.resolve(sqliteExecute(text, params));
  return import('pg').then(({ default: pg }) => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    return pool.query(text, params);
  });
}

export function all(text, params = []) {
  if (getSqliteDb()) return Promise.resolve(sqliteExecute(text, params).rows);
  return import('pg').then(async ({ default: pg }) => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    const res = await pool.query(text, params);
    return res.rows;
  });
}

export function get(text, params = []) {
  if (getSqliteDb()) return Promise.resolve(sqliteExecute(text, params).rows[0] || null);
  return import('pg').then(async ({ default: pg }) => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    const res = await pool.query(text, params);
    return res.rows[0] || null;
  });
}

export function run(text, params = []) {
  if (getSqliteDb()) return Promise.resolve(sqliteExecute(text, params));
  return import('pg').then(({ default: pg }) => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    return pool.query(text, params);
  });
}

export function exec(text) {
  const db = getSqliteDb();
  if (db) {
    db.exec(normalizeSqliteSql(text));
    return { rows: [] };
  }
  return import('pg').then(async ({ default: pg }) => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const stmt of text
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean))
        await client.query(stmt);
      await client.query('COMMIT');
      return { rows: [] };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  });
}

export function transaction(cb) {
  const db = getSqliteDb();
  if (db) {
    db.exec('BEGIN');
    return Promise.resolve().then(async () => {
      try {
        const client = {
          async query(text, params = []) {
            return sqliteExecute(text, params);
          },
          release() {},
        };
        const result = await cb(client);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {}
        throw error;
      }
    });
  }
  return import('pg').then(async ({ default: pg }) => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await cb(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  });
}

export default { query, all, get, run, exec, transaction };
