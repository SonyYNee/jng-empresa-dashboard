import { readMapsLink } from '../public/maps-link.js';
const cache = new Map();
let queue = Promise.resolve(),
  lastRequest = 0;
export function extractRouteCoordinates(url) {
  const data = new URL(url).pathname.split('/data=')[1] || '';
  const points = [...data.matchAll(/!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  return points.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90) ? [] : points;
}
export async function calculateRouteDistance(route, { request = fetch } = {}) {
  const link = readMapsLink(route.maps_url),
    key = link.url;
  const operation = queue.then(async () => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 86400000) return { ...cached.result };
    let parsed = link;
    for (let i = 0; parsed.short && i < 4; i++) {
      const r = await request(parsed.url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      await r.body?.cancel();
      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const target = r.headers.get('location');
      if (!target) break;
      parsed = readMapsLink(new URL(target, parsed.url).href);
    }
    const points = extractRouteCoordinates(parsed.url);
    if (points.length < 2)
      throw new Error(
        'O link n\u00e3o cont\u00e9m os pontos para calcular km. Copie a URL completa da rota aberta no Google Maps pelo computador.',
      );
    if (points.length > 32) throw new Error('O c\u00e1lculo suporta at\u00e9 30 paradas.');
    const delay = Math.max(0, 1100 - (Date.now() - lastRequest));
    if (delay) await new Promise((r) => setTimeout(r, delay));
    lastRequest = Date.now();
    const response = await request(
      'https://routing.openstreetmap.de/routed-car/route/v1/driving/' +
        points.map((p) => p.join(',')).join(';') +
        '?overview=false&steps=false&alternatives=false',
      {
        headers: { 'User-Agent': 'JNG-Local-Route-Tester/1.0' },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error('Servi\u00e7o gratuito indispon\u00edvel. Tente novamente mais tarde.');
    const data = await response.json(),
      metres = data.routes?.[0]?.distance;
    if (data.code !== 'Ok' || !Number.isFinite(metres) || metres <= 0)
      throw new Error('Nenhum percurso rodovi\u00e1rio foi encontrado.');
    if (data.waypoints?.some((p) => p.distance > 500))
      throw new Error('Um ponto est\u00e1 longe da malha vi\u00e1ria. Confira o link original.');
    const result = {
      distance: Math.round(metres / 10) / 100,
      source: 'OSRM / OpenStreetMap',
      basis: 'maps_link',
      pointCount: points.length,
      calculatedAt: new Date().toISOString(),
    };
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(key, { time: Date.now(), result });
    return { ...result };
  });
  queue = operation.catch(() => {});
  return operation;
}
