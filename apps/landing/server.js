import http from 'node:http';
import https from 'node:https';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicPaths = new Set(
  ['fleet', 'routes', 'social', 'trips', 'events'].map((name) => `/api/public/${name}`),
);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
};

export function createLandingServer({
  dashboardOrigin = process.env.DASHBOARD_ORIGIN,
  directory = fileURLToPath(new URL('./dist/', import.meta.url)),
} = {}) {
  const dashboard = new URL(dashboardOrigin || 'http://127.0.0.1:3000');
  if (
    !['http:', 'https:'].includes(dashboard.protocol) ||
    dashboard.username ||
    dashboard.password
  ) {
    throw new Error('DASHBOARD_ORIGIN must be an HTTP(S) origin without credentials.');
  }
  if (
    process.env.NODE_ENV === 'production' &&
    (!dashboardOrigin || dashboard.protocol !== 'https:')
  ) {
    throw new Error('Production requires an HTTPS DASHBOARD_ORIGIN.');
  }
  const root = resolve(directory);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const fail = (status, message) => {
      if (res.headersSent) return res.destroy();
      res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(message);
    };
    try {
      if (!['GET', 'HEAD'].includes(req.method)) return fail(405, 'Método não permitido.');
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (
        publicPaths.has(pathname) ||
        /^\/media\/[a-f0-9-]+\.(jpg|png|gif|webp|mp4|webm)$/.test(pathname)
      ) {
        // Somente dados públicos e mídias são encaminhados; cookies e credenciais ficam na dashboard.
        const headers = {};
        for (const key of ['range', 'if-range', 'if-none-match', 'if-modified-since']) {
          if (req.headers[key]) headers[key] = req.headers[key];
        }
        const upstream = (dashboard.protocol === 'https:' ? https : http).request(
          new URL(pathname + url.search, dashboard.origin),
          { method: req.method, headers, timeout: 30000 },
          (response) => {
            const forwarded = {};
            for (const key of [
              'content-type',
              'content-length',
              'content-range',
              'accept-ranges',
              'etag',
              'last-modified',
            ]) {
              if (response.headers[key]) forwarded[key] = response.headers[key];
            }
            forwarded['cache-control'] = publicPaths.has(pathname)
              ? 'no-store'
              : 'public, max-age=3600';
            res.writeHead(response.statusCode, forwarded);
            response.on('error', () => res.destroy());
            response.pipe(res);
          },
        );
        upstream.on('timeout', () => upstream.destroy(new Error('Upstream timeout')));
        upstream.on('error', () => fail(502, 'Não foi possível consultar a JNG. Tente novamente.'));
        res.on('close', () => upstream.destroy());
        upstream.end();
        return;
      }
      if (pathname.startsWith('/api/') || pathname.startsWith('/media/'))
        return fail(404, 'Não encontrado.');
      if (pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ status: 'ok' }));
      }
      let target = resolve(root, '.' + pathname);
      if (target !== root && !target.startsWith(root + sep)) return fail(404, 'Não encontrado.');
      let info = await stat(target).catch(() => null);
      if (info?.isDirectory()) {
        target = resolve(target, 'index.html');
        info = await stat(target).catch(() => null);
      }
      if (!info?.isFile()) {
        if (
          !/^\/(?:viagens|eventos|rotas|frota|orcamento|agendar|sobre|contato)(?:\/[^/.]+)?\/?$/.test(
            pathname,
          )
        ) {
          return fail(404, 'Página não encontrada.');
        }
        target = resolve(root, 'index.html');
        info = await stat(target);
      }
      const extension = extname(target);
      res.writeHead(200, {
        'Content-Type': contentTypes[extension] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(target);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch {
      fail(500, 'Não foi possível carregar a página.');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createLandingServer().listen(port, '0.0.0.0', () =>
    console.log(`Landing pronta na porta ${port}`),
  );
}
