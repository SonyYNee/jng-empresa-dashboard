import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLandingServer } from '../server.js';

test('hospedagem: links diretos, proxy público, mídia e isolamento da dashboard', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jng-landing-'));
  await writeFile(join(directory, 'index.html'), '<h1>JNG</h1>');
  const received = [];
  const upstream = http.createServer((req, res) => {
    received.push({ url: req.url, headers: req.headers });
    res.setHeader('Set-Cookie', 'private=secret');
    if (req.url.startsWith('/media/')) {
      res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-2/10' });
      return res.end(Buffer.from([0, 1, 2]));
    }
    res.setHeader('Content-Type', 'application/json');
    res.end('{"events":[]}');
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const server = createLandingServer({
    directory,
    dashboardOrigin: `http://127.0.0.1:${upstream.address().port}`,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await (await fetch(origin + '/eventos/evento-1')).text(), '<h1>JNG</h1>');
    assert.equal((await fetch(origin + '/assets/missing.js')).status, 404);
    assert.equal((await fetch(origin + '/api/users')).status, 404);
    assert.equal((await fetch(origin + '/api/public/events', { method: 'POST' })).status, 405);
    const events = await fetch(origin + '/api/public/events', {
      headers: { cookie: 'session=private', authorization: 'Bearer private' },
    });
    assert.deepEqual(await events.json(), { events: [] });
    assert.equal(events.headers.get('set-cookie'), null);
    assert.equal(received[0].headers.cookie, undefined);
    assert.equal(received[0].headers.authorization, undefined);
    const media = await fetch(origin + '/media/abc-123.mp4', { headers: { range: 'bytes=0-2' } });
    assert.equal(media.status, 206);
    assert.equal(media.headers.get('content-range'), 'bytes 0-2/10');
    assert.deepEqual(Buffer.from(await media.arrayBuffer()), Buffer.from([0, 1, 2]));
    assert.equal(received[1].headers.range, 'bytes=0-2');
  } finally {
    await Promise.all(
      [server, upstream].map((instance) => new Promise((resolve) => instance.close(resolve))),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
