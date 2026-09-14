// Totais em centavos; preço por litro em milésimos de real. Volume em litros, distância em km.
export function parseOdometer(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 10000000 ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const text = value.trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) return parseOdometer(Number(text.replaceAll('.', '').replace(',', '.')));
  if (/^\d+(?:[.,]\d{1,2})?$/.test(text)) return parseOdometer(Number(text.replace(',', '.')));
  return NaN;
}
export function maintenanceForecast(records) {
  const months = {};
  for (const record of records) {
    const month = record.date.slice(0, 7);
    const totals = months[month] ||= { planned: 0, actual: 0, count: 0, total: 0 };
    if (record.status === 'planned') { totals.planned += record.amount; totals.count++; }
    else if (record.status === 'done') totals.actual += record.amount;
    totals.total = totals.planned + totals.actual;
  }
  return months;
}
export function fuelSummary(records, capacity, odometer) {
  let anchor = null, litres = 0, distance = 0, consumed = 0;
  for (const row of records) {
    if (anchor) litres += row.litres;
    if (row.full) {
      if (anchor && row.odometer > anchor.odometer && litres > 0) {
        distance += row.odometer - anchor.odometer;
        consumed += litres;
      }
      anchor = row; litres = 0;
    }
  }
  const average = consumed > 0 ? distance / consumed : null;
  let estimated = null, warning = null;
  if (anchor && capacity && (average || odometer === anchor.odometer)) {
    const raw = capacity + litres - (average ? (odometer - anchor.odometer) / average : 0);
    if (raw < 0 || raw > capacity + .1) warning = 'Saldo incompatível com a capacidade. Confira quilometragem e abastecimentos.';
    estimated = Math.max(0, Math.min(capacity, raw));
  }
  return { average, estimated, warning, capacity, distance, consumed, anchorDate: anchor?.date || null };
}

export async function initFleet(db, { session, body, json, validPhoto }) {
  await db.exec(`CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY, plate TEXT NOT NULL UNIQUE, model TEXT NOT NULL, year INTEGER NOT NULL,
    seats INTEGER NOT NULL, odometer DOUBLE PRECISION NOT NULL, fuel_capacity DOUBLE PRECISION NOT NULL,
    arla_capacity DOUBLE PRECISION NOT NULL DEFAULT 0, photos TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS refills (
    id SERIAL PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    kind TEXT NOT NULL, date TEXT NOT NULL, odometer DOUBLE PRECISION NOT NULL, litres DOUBLE PRECISION NOT NULL,
    price INTEGER NOT NULL, total INTEGER NOT NULL, tank_full INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS maintenance (
    id SERIAL PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    description TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL,
    status TEXT NOT NULL, recurrence INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS vehicle_entries (
    id SERIAL PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    kind TEXT NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL);`);
  const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
  const num = (value, min, max) => {
    if (typeof value !== 'number' && typeof value !== 'string') fail('Preencha os campos numéricos.');
    if (String(value).trim() === '') fail('Preencha os campos numéricos.');
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) fail('Valor numérico fora do intervalo permitido.');
    return n;
  };
  const integer = (value, min, max) => { const n = num(value, min, max); if (!Number.isInteger(n)) fail('Informe um número inteiro.'); return n; };
  const kilometres = value => { const result = parseOdometer(value); if (!Number.isFinite(result)) fail('Informe a quilometragem entre 0 e 10.000.000 km. Exemplo: 150000 ou 150.000.'); return result; };
  const cents = value => Math.round(num(value, .01, 100000000) * 100);
  const text = (value, max = 120) => { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail('Preencha a descrição corretamente.'); return value.trim(); };
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const date = (value, future = false) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value < '1900-01-01') fail('Informe uma data válida.');
    if (!future && value > today()) fail('Lançamentos realizados não podem ter data futura.');
    return value;
  };
  async function summary(vehicle) {
    const rows = (await db.all('SELECT * FROM refills WHERE vehicle_id=$1 ORDER BY date,odometer,id', [vehicle.id])).map(row => ({ ...row, full: row.tank_full ?? row.full }));
    const entries = await db.all('SELECT * FROM vehicle_entries WHERE vehicle_id=$1 ORDER BY date DESC,id DESC', [vehicle.id]);
    const maintenance = await db.all('SELECT * FROM maintenance WHERE vehicle_id=$1 ORDER BY date,id', [vehicle.id]);
    const revenue = entries.filter(r => r.kind === 'revenue').reduce((sum, r) => sum + r.amount, 0);
    const fixed = entries.filter(r => r.kind === 'fixed').reduce((sum, r) => sum + r.amount, 0);
    const variable = entries.filter(r => r.kind === 'cost').reduce((sum, r) => sum + r.amount, 0) + rows.reduce((sum, r) => sum + r.total, 0) + maintenance.filter(r => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
    return { ...vehicle, photos: JSON.parse(vehicle.photos), revenue, fixed, costs: fixed + variable, profit: revenue - fixed - variable,
      fuel: fuelSummary(rows.filter(r => r.kind === 'fuel'), vehicle.fuel_capacity, vehicle.odometer),
      arla: vehicle.arla_capacity > 0 ? fuelSummary(rows.filter(r => r.kind === 'arla'), vehicle.arla_capacity, vehicle.odometer) : null,
      refills: rows.reverse(), entries, maintenance, maintenance_months: maintenanceForecast(maintenance) };
  }
  return async (req, res, pathname) => {
    if (!pathname.startsWith('/api/fleet')) return false;
    try {
      const user = await session(req);
      if (!user) fail('Entre para continuar.', 401);
      const canManage = ['owner', 'manager', 'fleet'].includes(user.role);
      if (req.method === 'GET' && pathname === '/api/fleet') {
        const vehiclesRaw = await db.all('SELECT * FROM vehicles ORDER BY model,plate');
        const vehicles = await Promise.all(vehiclesRaw.map(v => summary(v)));
        json(res, 200, { canManage, vehicles }); return true;
      }
      if (req.method !== 'POST') fail('Rota não encontrada.', 404);
      if (!canManage) fail('Somente proprietários e responsáveis pela operação ou frota podem fazer alterações.', 403);
      const data = await body(req, 36_000_000);
      if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Dados inválidos.');
      if (!['owner', 'manager', 'fleet'].includes((await session(req))?.role)) fail('Acesso negado.', 403);
      if (pathname === '/api/fleet/vehicle') {
        const id = data.id ? integer(data.id, 1, Number.MAX_SAFE_INTEGER) : null;
        const existing = id ? await db.get('SELECT * FROM vehicles WHERE id=$1', [id]) : null;
        if (id && !existing) fail('Veículo não encontrado.', 404);
        const plate = text(data.plate, 10).toUpperCase().replace(/[-\s]/g, '');
        if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) fail('Informe uma placa válida, como ABC1D23 ou ABC1234.');
        const model = text(data.model);
        const year = integer(data.year, 1900, new Date().getFullYear() + 2);
        const seats = integer(data.seats, 1, 200);
        const odometer = kilometres(data.odometer);
        if (existing && odometer < existing.odometer) fail('A quilometragem não pode ser menor que a atual.');
        const fuel = num(data.fuel_capacity, 1, 5000), arla = num(data.arla_capacity, 0, 1000);
        if (existing?.arla_capacity && !arla && await db.get("SELECT id FROM refills WHERE vehicle_id=$1 AND kind='arla' LIMIT 1", [id])) fail('Mantenha a capacidade do ARLA para preservar os cálculos do histórico.');
        if (!Array.isArray(data.photos) || data.photos.length > 5 || data.photos.some(photo => photo === null || !validPhoto(photo))) fail('Envie até cinco fotos JPG ou PNG válidas.');
        if (await db.get('SELECT id FROM vehicles WHERE plate=$1 AND id<>$2', [plate, id || 0])) fail('Esta placa já está cadastrada.', 409);
        const values = [plate, model, year, seats, odometer, fuel, arla, JSON.stringify(data.photos)];
        if (id) await db.run('UPDATE vehicles SET plate=$1,model=$2,year=$3,seats=$4,odometer=$5,fuel_capacity=$6,arla_capacity=$7,photos=$8 WHERE id=$9', [...values, id]);
        else await db.run('INSERT INTO vehicles(plate,model,year,seats,odometer,fuel_capacity,arla_capacity,photos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', values);
        json(res, id ? 200 : 201, { ok: true }); return true;
      }
      const vehicleId = integer(data.vehicle_id, 1, Number.MAX_SAFE_INTEGER);
      const vehicle = await db.get('SELECT * FROM vehicles WHERE id=$1', [vehicleId]);
      if (!vehicle) fail('Veículo não encontrado.', 404);
      if (pathname === '/api/fleet/delete') {
        if (data.confirm_plate !== vehicle.plate) fail('Digite a placa do veículo para confirmar a exclusão.');
        await db.transaction(async client => {
          await client.query('DELETE FROM refills WHERE vehicle_id=$1', [vehicleId]);
          await client.query('DELETE FROM maintenance WHERE vehicle_id=$1', [vehicleId]);
          await client.query('DELETE FROM vehicle_entries WHERE vehicle_id=$1', [vehicleId]);
          await client.query('DELETE FROM vehicles WHERE id=$1', [vehicleId]);
        });
      } else if (pathname === '/api/fleet/refill') {
        if (!['fuel', 'arla'].includes(data.kind)) fail('Selecione combustível ou ARLA.');
        const capacity = data.kind === 'arla' ? vehicle.arla_capacity : vehicle.fuel_capacity;
        if (!capacity) fail('Este veículo não possui tanque de ARLA cadastrado.');
        const refillDate = date(data.date);
        const odometer = kilometres(data.odometer);
        const litres = num(data.litres, .001, capacity);
        const price = Math.round(num(data.price, .001, 1000) * 1000);
        if (typeof data.full !== 'boolean') fail('Informe se completou o tanque.');
        const previous = await db.get('SELECT * FROM refills WHERE vehicle_id=$1 ORDER BY date DESC,odometer DESC,id DESC LIMIT 1', [vehicleId]);
        if (previous && (refillDate < previous.date || odometer < previous.odometer)) fail('Registre os abastecimentos em ordem de data e quilometragem.');
        const same = await db.get('SELECT id FROM refills WHERE vehicle_id=$1 AND kind=$2 AND odometer=$3', [vehicleId, data.kind, odometer]);
        if (same) fail('Já existe abastecimento desse produto nesta quilometragem.', 409);
        await db.transaction(async client => {
          await client.query('INSERT INTO refills(vehicle_id,kind,date,odometer,litres,price,total,tank_full) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [vehicleId, data.kind, refillDate, odometer, litres, price, Math.round(litres * price / 10), Number(data.full)]);
          await client.query('UPDATE vehicles SET odometer=GREATEST(odometer,$1) WHERE id=$2', [odometer, vehicleId]);
        });
      } else if (pathname === '/api/fleet/entry') {
        if (!['revenue', 'fixed', 'cost'].includes(data.kind)) fail('Tipo de lançamento inválido.');
        await db.run('INSERT INTO vehicle_entries(vehicle_id,kind,description,date,amount) VALUES ($1,$2,$3,$4,$5)', [vehicleId, data.kind, text(data.description), date(data.date), cents(data.amount)]);
      } else if (pathname === '/api/fleet/maintenance') {
        if (!['planned', 'done'].includes(data.status)) fail('Situação inválida.');
        const recurrence = integer(data.recurrence, 0, 120);
        if (data.status === 'done' && recurrence) fail('Para recorrência, cadastre uma manutenção agendada e marque-a como realizada.');
        await db.run('INSERT INTO maintenance(vehicle_id,description,date,amount,status,recurrence) VALUES ($1,$2,$3,$4,$5,$6)', [vehicleId, text(data.description), date(data.date, data.status === 'planned'), cents(data.amount), data.status, recurrence]);
      } else if (pathname === '/api/fleet/maintenance/complete') {
        const record = await db.get('SELECT * FROM maintenance WHERE id=$1 AND vehicle_id=$2', [integer(data.id, 1, Number.MAX_SAFE_INTEGER), vehicleId]);
        if (!record || record.status !== 'planned') fail('Manutenção não encontrada ou já realizada.', 409);
        const completedDate = date(data.date);
        const amount = cents(data.amount);
        await db.transaction(async client => {
          await client.query("UPDATE maintenance SET status='done', date=$1, amount=$2 WHERE id=$3", [completedDate, amount, record.id]);
          if (record.recurrence) {
            const next = new Date(completedDate + 'T12:00:00Z');
            const day = next.getUTCDate(); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + record.recurrence);
            const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(); next.setUTCDate(Math.min(day, last));
            await client.query("INSERT INTO maintenance(vehicle_id,description,date,amount,status,recurrence) VALUES ($1,$2,$3,$4,'planned',$5)", [vehicleId, record.description, next.toISOString().slice(0, 10), amount, record.recurrence]);
          }
        });
      } else fail('Rota não encontrada.', 404);
      json(res, 201, { ok: true });
    } catch (error) { json(res, error.status || 400, { error: error.status ? error.message : 'Não foi possível salvar. Confira os campos e o tamanho das fotos.' }); }
    return true;
  };
}
