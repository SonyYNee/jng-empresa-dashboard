export function isCoordinatePoint(value) {
  const text = String(value ?? '').trim();
  return /^@?\s*[+-]?\d{1,3}(?:\.\d+)?\s*[,;]\s*[+-]?\d{1,3}(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?z)?\s*$/.test(text)
    || (/\d\s*[°º]/.test(text) && /[NSEWO]/i.test(text));
}
export function normalizeMapsEmbed(value) {
  if(!value)return '';
  if(typeof value!=='string'||value.length>20000)throw new Error('Código de mapa inválido.');
  const source=value.trim().startsWith('<')?value.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]:value.trim();
  let url;try{url=new URL(source?.replaceAll('&amp;','&'));}catch{throw new Error('Cole o código de Incorporar um mapa fornecido pelo Google Maps.');}
  if(url.protocol!=='https:'||url.hostname!=='www.google.com'||url.pathname!=='/maps/embed'||!url.searchParams.get('pb')||url.username||url.password||url.port)throw new Error('Use o código oficial do Google Maps: Compartilhar → Incorporar um mapa.');
  return url.href;
}
export function readMapsLink(value) {
  if (typeof value !== 'string' || value.length > 12000) throw new Error('Informe um link válido do Google Maps.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Cole o link completo do Google Maps, começando com https://.'); }
  const domains = ['www.google.com', 'google.com', 'www.google.com.br', 'google.com.br', 'maps.google.com', 'maps.google.com.br'];
  const short = url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'));
  const normal = domains.includes(url.hostname) && (url.pathname === '/maps' || url.pathname.startsWith('/maps/') || (url.hostname.startsWith('maps.') && url.pathname === '/'));
  if (url.protocol !== 'https:' || url.username || url.password || url.port || (!short && !normal)) throw new Error('Use um link HTTPS do Google Maps (google.com/maps ou maps.app.goo.gl).');
  let origin = '', destination = '', stops = [];
  if (!short && url.searchParams.has('origin') && url.searchParams.has('destination')) {
    origin = url.searchParams.get('origin'); destination = url.searchParams.get('destination');
    stops = (url.searchParams.get('waypoints') || '').split('|').filter(Boolean);
  } else if (!short && url.pathname.startsWith('/maps/dir/')) {
    const segments = url.pathname.slice('/maps/dir/'.length).split('/');
    const points = [];
    for (const segment of segments) {
      if (!segment || segment.startsWith('@') || segment.startsWith('data=') || segment.startsWith('!')) break;
      try { points.push(decodeURIComponent(segment.replaceAll('+', ' '))); } catch { break; }
    }
    if (points.length >= 2) { origin = points[0]; destination = points.at(-1); stops = points.slice(1, -1); }
  }
  const requiresAddresses = [origin, destination, ...stops].some(isCoordinatePoint);
  return { url: url.href, short, origin: isCoordinatePoint(origin) ? '' : origin, destination: isCoordinatePoint(destination) ? '' : destination, stops: stops.map(point => isCoordinatePoint(point) ? '' : point), requiresAddresses };
}
