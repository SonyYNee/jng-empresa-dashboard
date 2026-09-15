import { events, trips, routes, fleet, socials, testimonials } from './data.js';
const normalize = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function selectUpcomingEvents(records, now = Date.now()) {
  return records
    .filter((item) => new Date(item.date).getTime() > now && item.status !== 'ended')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
export function selectFeaturedEvent(records, now = Date.now()) {
  const upcoming = selectUpcomingEvents(records, now);
  return (
    upcoming.find((item) => item.priority) ||
    upcoming.find((item) => item.featured) ||
    upcoming[0] ||
    null
  );
}
export function filterTrips(records, filters = {}) {
  return records.filter(
    (item) =>
      (!filters.origin || normalize(item.origin).includes(normalize(filters.origin))) &&
      (!filters.destination ||
        normalize(item.destination).includes(normalize(filters.destination))) &&
      (!filters.date ||
        item.departureDate === filters.date ||
        (item.frequency === 'weekly' &&
          filters.date >= item.date.slice(0, 10) &&
          item.weekdays.includes(new Date(filters.date + 'T12:00:00-03:00').getUTCDay()))) &&
      (!filters.returnDate || item.returnDate === filters.returnDate) &&
      (!filters.type || item.category === filters.type) &&
      (!filters.passengers ||
        item.availableSeats == null ||
        item.availableSeats >= Number(filters.passengers)),
  );
}
const copy = (data) => structuredClone(data);
export const service = {
  async getFeaturedEvent() {
    return copy(selectFeaturedEvent(events));
  },
  async getUpcomingEvents() {
    return copy(selectUpcomingEvents(events));
  },
  async getEvents() {
    const response = await fetch('/api/public/events', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Eventos indisponíveis');
    const data = await response.json();
    if (!Array.isArray(data.events)) throw new Error('Eventos inválidos');
    return data.events;
  },
  async getTrips(filters = {}) {
    const response = await fetch('/api/public/trips', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Viagens indisponíveis');
    const data = await response.json();
    return filterTrips(data.trips || [], filters);
  },
  async getRoutes() {
    const response = await fetch('/api/public/routes', {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Rotas indisponíveis');
    const data = await response.json();
    if (!Array.isArray(data.routes)) throw new Error('Rotas inválidas');
    return data.routes.map((route) => ({ ...route, id: String(route.id) }));
  },
  async getFleet() {
    const response = await fetch('/api/public/fleet', {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Frota indisponível');
    const data = await response.json();
    if (!Array.isArray(data.vehicles)) throw new Error('Frota inválida');
    return data.vehicles.map((v) => ({
      id: String(v.id),
      name: v.model,
      category: 'Frota JNG',
      year: v.year,
      capacity: v.seats,
      photos: v.photos,
      image: v.photos[0] || null,
      amenities: [],
      use: 'Transporte para sua próxima viagem',
      demo: false,
    }));
  },
  async getSocial() {
    return copy(socials);
  },
  async getTestimonials() {
    return copy(testimonials);
  },
  async requestQuote(data) {
    return { mode: 'demo', sent: false, data: copy(data) };
  },
  async createBooking(data) {
    return { mode: 'demo', sent: false, data: copy(data) };
  },
  async requestContact(data) {
    return { mode: 'demo', sent: false, data: copy(data) };
  },
};
export function validatePlan(data, contact = false) {
  if (!data.origin?.trim() || !data.destination?.trim()) return 'Informe origem e destino.';
  if (normalize(data.origin) === normalize(data.destination))
    return 'Escolha um destino diferente da origem.';
  const today = new Date().toLocaleDateString('en-CA');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '') || data.date < today)
    return 'Escolha uma data de ida a partir de hoje.';
  if (data.returnDate && data.returnDate < data.date) return 'A volta não pode ser anterior à ida.';
  if (
    !Number.isInteger(Number(data.passengers)) ||
    Number(data.passengers) < 1 ||
    Number(data.passengers) > 200
  )
    return 'Informe entre 1 e 200 passageiros.';
  if (
    contact &&
    (!data.name?.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') ||
      (data.phone || '').replace(/\D/g, '').length < 10)
  )
    return 'Confira nome, telefone com DDD e e-mail.';
  return null;
}
