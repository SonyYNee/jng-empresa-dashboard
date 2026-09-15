import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  existsSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
const formats = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
export function initMedia(directory, { session, json }) {
  mkdirSync(directory, { recursive: true });
  const valid = (url) =>
    typeof url === 'string' &&
    /^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp|mp4|webm)$/.test(url) &&
    existsSync(join(directory, url.slice(7)));
  const handler = async (req, res, path) => {
    if (path === '/api/media') {
      if (req.method !== 'POST') {
        json(res, 405, { error: 'Método inválido.' });
        return true;
      }
      if (!['owner', 'manager', 'fleet'].includes((await session(req))?.role)) {
        json(res, 403, { error: 'Acesso restrito.' });
        return true;
      }
      const ext = formats[req.headers['content-type']];
      if (!ext) {
        json(res, 400, { error: 'Use JPG, PNG, GIF, WebP, MP4 ou WebM.' });
        return true;
      }
      const name = randomUUID() + '.' + ext,
        target = join(directory, name);
      try {
        await pipeline(req, createWriteStream(target, { flags: 'wx' }));
        if (!statSync(target).size) throw new Error();
        json(res, 201, { url: '/media/' + name });
      } catch {
        if (existsSync(target)) unlinkSync(target);
        if (!res.destroyed) json(res, 400, { error: 'Falha no upload. Tente novamente.' });
      }
      return true;
    }
    if (!path.startsWith('/media/')) return false;
    if (!['GET', 'HEAD'].includes(req.method) || !valid(path)) {
      json(res, 404, { error: 'Arquivo não encontrado.' });
      return true;
    }
    const file = join(directory, path.slice(7)),
      size = statSync(file).size;
    const mime = Object.entries(formats).find(([, ext]) => file.endsWith('.' + ext))[0];
    let start = 0,
      end = size - 1,
      status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match || Number(match[1]) >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        res.end();
        return true;
      }
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : end;
      if (end < start) {
        res.writeHead(416);
        res.end();
        return true;
      }
      status = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.writeHead(status, {
      'Content-Type': mime,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    if (req.method === 'HEAD') res.end();
    else await pipeline(createReadStream(file, { start, end }), res).catch(() => {});
    return true;
  };
  return { handler, valid };
}
