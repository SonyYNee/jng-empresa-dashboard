import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

if (!process.env.SQLITE_SOURCE || !process.env.MEDIA_EXPORT_DIR) {
  throw new Error('Defina SQLITE_SOURCE e MEDIA_EXPORT_DIR para preparar as mídias legadas.');
}
const output = resolve(process.env.MEDIA_EXPORT_DIR);
mkdirSync(output, { recursive: true });
const source = new DatabaseSync(process.env.SQLITE_SOURCE, { readOnly: true });
const extensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
let count = 0;
function extract(value) {
  if (Array.isArray(value)) return value.map(extract);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, extract(item)]));
  if (typeof value !== 'string') return value;
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!match || !extensions[match[1]]) return value;
  const bytes = Buffer.from(match[2], 'base64');
  const filename = `${createHash('sha256').update(bytes).digest('hex')}.${extensions[match[1]]}`;
  writeFileSync(join(output, filename), bytes);
  count++;
  return '/media/' + filename;
}
try {
  const updates = [];
  for (const [table, field] of [
    ['vehicles', 'photos'],
    ['company_events', 'data'],
    ['company_trips', 'data'],
  ]) {
    for (const row of source.prepare(`SELECT id, ${field} AS payload FROM ${table}`).all()) {
      const payload = JSON.stringify(extract(JSON.parse(row.payload)));
      if (payload !== row.payload)
        updates.push({
          table,
          field,
          id: row.id,
          payload,
          sourceHash: createHash('sha256').update(row.payload).digest('hex'),
        });
    }
  }
  writeFileSync(join(output, '..', 'media-updates.json'), JSON.stringify(updates));
  console.log(
    `${count} mídias extraídas sem recompressão. Publique os arquivos antes de aplicar media-updates.json ao banco.`,
  );
} finally {
  source.close();
}
