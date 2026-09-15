import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initMedia } from '../src/media.js';
test('upload preserva bytes originais acima de 5 MB e suporta reprodução parcial', async () => {
  const media = initMedia(mkdtempSync(join(tmpdir(), 'jng-media-')), {
    session: async () => ({ role: 'owner' }),
    json: (res, status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    },
  });
  const server = http.createServer((req, res) => media.handler(req, res, req.url));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const bytes = Buffer.alloc(6 * 1024 * 1024, 42);
    const response = await fetch(base + '/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: bytes,
    });
    assert.equal(response.status, 201);
    const { url } = await response.json();
    assert.deepEqual(Buffer.from(await (await fetch(base + url)).arrayBuffer()), bytes);
    const partial = await fetch(base + url, { headers: { Range: 'bytes=10-29' } });
    assert.equal(partial.status, 206);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(10, 30));
  } finally {
    await new Promise((r) => server.close(r));
  }
});
