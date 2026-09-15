import { DatabaseSync } from 'node:sqlite';

if (!process.env.SQLITE_SOURCE || !process.env.DATABASE_URL) {
  throw new Error('Defina SQLITE_SOURCE e DATABASE_URL para migrar um backup local.');
}
if (process.env.DATABASE_PATH)
  throw new Error('Remova DATABASE_PATH antes da migração PostgreSQL.');

// Inicializa o schema sem abrir uma porta HTTP nem copiar sessões locais para produção.
process.env.NODE_ENV = 'test';
await import('../apps/dashboard/src/server.js');
const { default: db } = await import('../apps/dashboard/src/db.js');
const source = new DatabaseSync(process.env.SQLITE_SOURCE, { readOnly: true });
const tables = [
  'users',
  'vehicles',
  'refills',
  'maintenance',
  'vehicle_entries',
  'transport_routes',
  'company_social',
  'company_events',
  'company_trips',
  'activity',
];
try {
  await db.transaction(async (client) => {
    for (const table of [...tables, 'sessions']) {
      const { rows } = await client.query(`SELECT COUNT(*) AS total FROM ${table}`);
      if (Number(rows[0].total))
        throw new Error(`Destino não está vazio: ${table}. Migração cancelada.`);
    }
    for (const table of tables) {
      const { rows: schema } = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
        [table],
      );
      const records = source.prepare(`SELECT * FROM ${table}`).all();
      for (const record of records) {
        if (table === 'refills' && record.tank_full === undefined) record.tank_full = record.full;
        const columns = schema.filter((column) => record[column.column_name] !== undefined);
        const values = columns.map((column) => {
          const value = record[column.column_name];
          return column.data_type === 'boolean' && value !== null ? Boolean(value) : value;
        });
        await client.query(
          `INSERT INTO ${table} (${columns.map((column) => column.column_name).join(',')}) VALUES (${values.map((_, index) => '$' + (index + 1)).join(',')})`,
          values,
        );
      }
      const { rows: sequences } = await client.query(
        "SELECT pg_get_serial_sequence($1, 'id') AS name",
        [table],
      );
      if (sequences[0].name) {
        await client.query(
          `SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${table}), 1), EXISTS(SELECT 1 FROM ${table}))`,
          [sequences[0].name],
        );
      }
      console.log(`${table}: ${records.length} registros migrados`);
    }
  });
} finally {
  source.close();
  await db.close();
}
