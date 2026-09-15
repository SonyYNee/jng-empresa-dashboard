const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const money = (cents) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const number = (value) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
const day = (value) => value.split('-').reverse().join('/');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const input = (label, name, type = 'text', value = '', attrs = '') =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs} required></label>`;
const amountInput = (label, name, value = '') =>
  input(label, name, 'text', value, 'inputmode="decimal" placeholder="0,00"');
const dateInput = (value = today(), future = false) =>
  input('Data', 'date', 'date', value, future ? '' : `max="${today()}"`);
const submit = (label) =>
  `<p class="form-message" role="status"></p><button class="primary" type="submit">${label}</button>`;
const types = { revenue: 'Faturamento', fixed: 'Custo fixo', cost: 'Outro custo' };
function metrics(v) {
  return `<div class="vehicle-metrics"><div><small>Faturamento</small><strong>${money(v.revenue)}</strong></div><div><small>Custos totais</small><strong>${money(v.costs)}</strong></div><div><small>Custos fixos incluídos</small><strong>${money(v.fixed)}</strong></div><div><small>Lucro</small><strong class="${v.profit < 0 ? 'loss' : 'profit'}">${money(v.profit)}</strong></div></div>`;
}
function table(headers, rows, empty = 'Nenhum registro.') {
  return rows.length
    ? `<div class="table-scroll"><table><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    : `<p class="empty-state">${empty}</p>`;
}
async function photoData(file) {
  const response = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.url;
}
export async function showFleet(user, { api, shell }) {
  let state = await api('fleet');
  let activeId = Number(new URLSearchParams(location.search).get('veiculo')) || null;
  let tab = 'summary';
  let maintenanceMonth = today().slice(0, 7);
  const canManage = state.canManage;
  const notice = (node, message, success = false) => {
    node.textContent = message;
    node.className = `form-message ${success ? 'success' : 'error'}`;
  };
  async function refresh(message = '') {
    state = await api('fleet');
    draw(message);
  }
  function base(content) {
    shell(user, 'Frota', content);
  }
  function monthlyMaintenance(v, month) {
    const forecast = v.maintenance_months?.[month] || { planned: 0, actual: 0, count: 0, total: 0 };
    return `<div class="maintenance-forecast"><div><small>Gastos previstos</small><strong>${money(forecast.planned)}</strong><span>${forecast.count} manutenção(ões) a realizar</span></div><div><small>Gastos realizados</small><strong>${money(forecast.actual)}</strong><span>Serviços concluídos</span></div><div><small>Total estimado do mês</small><strong>${money(forecast.total)}</strong><span>Realizados + previstos</span></div></div>`;
  }
  function draw(message = '') {
    const vehicle = state.vehicles.find((v) => v.id === activeId);
    if (activeId && !vehicle) activeId = null;
    history.replaceState({}, '', activeId ? `/frota?veiculo=${activeId}` : '/frota');
    if (vehicle) {
      detail(vehicle, message);
      return;
    }
    base(
      `<div class="page-heading"><div><p class="eyebrow">OPERAÇÃO</p><h1>Frota</h1><p>Veículos, despesas e resultados da transportadora.</p></div>${canManage ? '<button class="primary compact" id="new-vehicle">+ Adicionar veículo</button>' : ''}</div><p class="form-message success" role="status">${esc(message)}</p><p class="hint">Valores acumulados de todos os lançamentos. Custos totais já incluem os custos fixos.</p><div class="fleet-grid">${state.vehicles.map((v) => `<article class="card vehicle-card">${v.photos[0] ? `<img class="vehicle-cover" src="${esc(v.photos[0])}" alt="${esc(v.model)} — ${esc(v.plate)}">` : '<div class="vehicle-placeholder">Sem foto cadastrada</div>'}<div class="vehicle-content"><div class="section-title"><h2>${esc(v.model)}</h2><span class="plate">${esc(v.plate)}</span></div><p class="hint">${v.year} · ${v.seats} lugares · ${number(v.odometer)} km</p>${metrics(v)}<button class="secondary vehicle-open" data-id="${v.id}">${canManage ? '⚙ Gerenciar veículo' : 'Ver veículo'}</button></div></article>`).join('') || '<section class="card"><h2>Nenhum veículo cadastrado</h2><p>Os veículos da empresa aparecerão aqui.</p></section>'}</div>`,
    );
    document.querySelector('#new-vehicle')?.addEventListener('click', () => vehicleForm());
    document.querySelectorAll('.vehicle-open').forEach(
      (button) =>
        (button.onclick = () => {
          activeId = Number(button.dataset.id);
          tab = 'summary';
          draw();
        }),
    );
  }
  function detail(v, message) {
    const tabs = {
      summary: 'Resumo',
      refills: 'Abastecimentos e ARLA',
      maintenance: 'Manutenção',
      finance: 'Financeiro',
      vehicle: 'Dados e fotos',
    };
    base(
      `<a href="/frota" class="text-link fleet-back">← Todos os veículos</a><div class="page-heading"><div><p class="eyebrow">${esc(v.plate)}</p><h1>${esc(v.model)}</h1><p>${v.year} · ${v.seats} lugares · ${number(v.odometer)} km</p></div></div><nav class="fleet-tabs" aria-label="Seções do veículo">${Object.entries(
        tabs,
      )
        .map(
          ([key, label]) =>
            `<button class="secondary ${tab === key ? 'active' : ''}" data-tab="${key}" ${tab === key ? 'aria-current="page"' : ''}>${label}</button>`,
        )
        .join(
          '',
        )}</nav><p id="fleet-message" class="form-message success" role="status">${esc(message)}</p><div id="vehicle-panel"></div>`,
    );
    document.querySelectorAll('[data-tab]').forEach(
      (button) =>
        (button.onclick = () => {
          tab = button.dataset.tab;
          draw();
        }),
    );
    const panel = document.querySelector('#vehicle-panel');
    if (tab === 'summary') {
      panel.innerHTML = `<section class="card">${metrics(v)}<p class="hint">Acumulado de todos os registros. Manutenções agendadas não entram nos custos até serem realizadas.</p></section><div class="fuel-grid">${tank(v.fuel, 'Combustível', v)}${v.arla ? tank(v.arla, 'ARLA', v) : ''}</div><section class="card"><h2>Manutenção · ${day(today()).slice(3)}</h2>${monthlyMaintenance(v, today().slice(0, 7))}<p class="hint">Previsão baseada nas manutenções cadastradas para este mês.</p><h3>Próximas manutenções</h3>${maintenanceTable(v, true)}</section>`;
    } else if (tab === 'refills') refillPanel(v, panel);
    else if (tab === 'maintenance') maintenancePanel(v, panel);
    else if (tab === 'finance') financePanel(v, panel);
    else vehicleForm(v, panel);
  }
  function tank(summary, title, vehicle) {
    return `<section class="card"><h2>${title}</h2><dl><dt>Média de consumo</dt><dd>${summary.average ? `${number(summary.average)} km/L` : 'Aguardando dois abastecimentos completos'}</dd><dt>Saldo estimado a ${number(vehicle.odometer)} km</dt><dd>${summary.estimated === null ? 'Ainda não disponível' : `${number(summary.estimated)} de ${number(summary.capacity)} L`}</dd></dl><p class="hint">${summary.warning ? esc(summary.warning) : 'Estimativa por quilometragem e média histórica, não uma medição do tanque.'}</p><p class="hint">O cálculo usa ciclos entre tanques completos e inclui os abastecimentos parciais. Atualize a quilometragem em Dados e fotos.</p></section>`;
  }
  function bindForm(form, endpoint, prepare = (value) => value, after = refresh) {
    form.onsubmit = async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      const message = form.querySelector('.form-message');
      try {
        const values = prepare(Object.fromEntries(new FormData(form)));
        await api(`fleet/${endpoint}`, { vehicle_id: activeId, ...values });
        await after('Registro salvo com sucesso.');
      } catch (error) {
        notice(message, error.message);
        button.disabled = false;
      }
    };
  }
  function vehicleForm(v = null, panel = null) {
    if (!panel) {
      base(
        '<div class="page-heading"><div><h1>Adicionar veículo</h1><p>Cadastre os dados e as capacidades dos tanques.</p></div><a class="secondary" href="/frota">Voltar à frota</a></div><div id="vehicle-panel"></div>',
      );
      panel = document.querySelector('#vehicle-panel');
    }
    let photos = [...(v?.photos || [])];
    if (!canManage) {
      panel.innerHTML = `<section class="card"><p>${v.seats} lugares · ${v.year} · ${esc(v.plate)}</p><p>Tanque: ${number(v.fuel_capacity)} L · ARLA: ${number(v.arla_capacity)} L</p><div class="vehicle-gallery">${photos.map((src) => `<img src="${esc(src)}" alt="Foto de ${esc(v.model)}">`).join('')}</div></section>`;
      return;
    }
    panel.innerHTML = `<section class="card"><form id="vehicle-form"><div class="form-grid">${input('Modelo do veículo', 'model', 'text', v?.model || '', 'maxlength="120"')}${input('Placa', 'plate', 'text', v?.plate || '', 'maxlength="10" placeholder="ABC1D23"')}${input('Ano', 'year', 'number', v?.year || new Date().getFullYear(), 'min="1900" max="2100"')}${input('Quantidade de lugares', 'seats', 'number', v?.seats || '', 'min="1" max="200"')}${input('Quilometragem atual (km)', 'odometer', 'text', v?.odometer ?? '', 'inputmode="decimal" maxlength="16" placeholder="Ex.: 150.000"')}${input('Capacidade do tanque de combustível (L)', 'fuel_capacity', 'number', v?.fuel_capacity || '', 'min="1" max="5000" step="0.1"')}${input('Capacidade do tanque de ARLA (L)', 'arla_capacity', 'number', v?.arla_capacity || 0, 'min="0" max="1000" step="0.1"')}</div><p class="hint">Informe 0 no ARLA se o veículo não utilizar. A capacidade deve ser a capacidade útil do tanque.</p><label>Fotos do veículo (até 5)<input id="vehicle-photos" type="file" accept="image/png,image/jpeg" multiple></label><p class="hint">Até tamanho original por foto. As imagens são reduzidas para armazenamento.</p><div class="vehicle-gallery" id="photo-gallery"></div>${submit(v ? 'Salvar veículo' : 'Cadastrar veículo')}</form></section>`;
    const form = document.querySelector('#vehicle-form');
    let processing = false;
    const gallery = () => {
      document.querySelector('#photo-gallery').innerHTML = photos
        .map(
          (src, i) =>
            `<div><img src="${esc(src)}" alt="Foto ${i + 1} do veículo"><button type="button" class="secondary" data-remove="${i}">Remover foto ${i + 1}</button></div>`,
        )
        .join('');
      document.querySelectorAll('[data-remove]').forEach(
        (button) =>
          (button.onclick = () => {
            if (processing) return;
            photos.splice(Number(button.dataset.remove), 1);
            gallery();
          }),
      );
    };
    gallery();
    document.querySelector('#vehicle-photos').onchange = async (event) => {
      const files = [...event.target.files];
      const message = form.querySelector('.form-message');
      if (photos.length + files.length > 5) {
        notice(message, 'Cada veículo pode ter no máximo cinco fotos.');
        event.target.value = '';
        return;
      }
      processing = true;
      form.querySelector('[type=submit]').disabled = true;
      event.target.disabled = true;
      try {
        const prepared = [];
        for (const file of files) prepared.push(await photoData(file));
        photos.push(...prepared);
        gallery();
        notice(message, 'Fotos prontas. Salve o veículo para confirmar.', true);
      } catch (error) {
        notice(message, error.message || 'Não foi possível ler a imagem.');
      } finally {
        processing = false;
        form.querySelector('[type=submit]').disabled = false;
        event.target.disabled = false;
        event.target.value = '';
      }
    };
    bindForm(
      form,
      'vehicle',
      (values) => {
        if (processing) throw new Error('Aguarde o processamento das fotos.');
        return { ...values, id: v?.id, photos };
      },
      async (message) => {
        if (!v) activeId = null;
        await refresh(message);
      },
    );
    if (v) {
      const section = document.createElement('section');
      section.className = 'card delete-vehicle-section';
      section.innerHTML = `<h2>Excluir veículo</h2><p class="hint">A exclusão apaga permanentemente o veículo ${esc(v.plate)}, suas fotos, abastecimentos, manutenções e lançamentos financeiros. Esta ação não pode ser desfeita.</p><button type="button" class="secondary danger-button" id="show-delete">Excluir veículo</button><form id="delete-vehicle-form" hidden>${input(`Digite ${esc(v.plate)} para confirmar`, 'confirm_plate', 'text', '', 'autocomplete="off"')}<p class="form-message" role="status"></p><div class="delete-actions"><button class="secondary" id="cancel-delete" type="button">Cancelar</button><button class="secondary danger-button" type="submit">Excluir definitivamente</button></div></form>`;
      panel.append(section);
      const deleteForm = document.querySelector('#delete-vehicle-form');
      const trigger = document.querySelector('#show-delete');
      trigger.onclick = () => {
        deleteForm.hidden = false;
        trigger.hidden = true;
        deleteForm.elements.confirm_plate.focus();
      };
      document.querySelector('#cancel-delete').onclick = () => {
        deleteForm.hidden = true;
        trigger.hidden = false;
        deleteForm.reset();
        trigger.focus();
      };
      bindForm(
        deleteForm,
        'delete',
        (values) => ({
          confirm_plate: values.confirm_plate.trim().toUpperCase().replace(/[-\s]/g, ''),
        }),
        async () => {
          activeId = null;
          await refresh('Veículo e registros excluídos com sucesso.');
        },
      );
    }
  }
  function refillPanel(v, panel) {
    panel.innerHTML = `<div class="fleet-work-grid">${canManage ? `<section class="card"><h2>Registrar abastecimento</h2><form id="refill-form"><label>Produto<select name="kind"><option value="fuel">Combustível</option>${v.arla_capacity > 0 ? '<option value="arla">ARLA</option>' : ''}</select></label>${dateInput()}${input('Quilometragem no abastecimento (km)', 'odometer', 'text', v.odometer, 'inputmode="decimal" maxlength="16" placeholder="Ex.: 150.000"')}${amountInput('Preço por litro (R$)', 'price')}${input('Litros abastecidos', 'litres', 'number', '', 'min="0.001" max="5000" step="0.001"')}<label class="checkbox-label"><input type="checkbox" name="full"> Tanque ficou completo</label><p class="hint" id="refill-total">Total: R$ 0,00</p>${submit('Salvar abastecimento')}</form></section>` : ''}<section class="card"><h2>Histórico de abastecimentos</h2><p class="hint">Registre em ordem de data e quilometragem. Combustível e ARLA têm médias independentes.</p>${table(
      ['Data / produto', 'Km', 'Litros', 'R$/L', 'Total', 'Tanque'],
      v.refills.map(
        (row) =>
          `<tr><td>${day(row.date)}<small class="cell-note">${row.kind === 'fuel' ? 'Combustível' : 'ARLA'}</small></td><td>${number(row.odometer)}</td><td>${number(row.litres)}</td><td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 3 }).format(row.price / 1000)}</td><td>${money(row.total)}</td><td>${row.full ? 'Completo' : 'Parcial'}</td></tr>`,
      ),
    )}</section></div><div class="fuel-grid">${tank(v.fuel, 'Combustível', v)}${v.arla ? tank(v.arla, 'ARLA', v) : ''}</div>`;
    const form = document.querySelector('#refill-form');
    if (!form) return;
    form.oninput = () => {
      const price = Number(form.elements.price.value.replace(',', '.'));
      const litres = Number(form.elements.litres.value);
      document.querySelector('#refill-total').textContent =
        `Total: ${Number.isFinite(price * litres) ? money(Math.round((Math.round(price * 1000) * litres) / 10)) : '—'}`;
    };
    bindForm(form, 'refill', (values) => ({ ...values, full: form.elements.full.checked }));
  }
  function maintenanceTable(v, onlyPlanned = false) {
    const records = v.maintenance.filter((row) => !onlyPlanned || row.status === 'planned');
    return table(
      ['Serviço', 'Data', 'Valor', 'Situação'],
      records.map(
        (row) =>
          `<tr><td>${esc(row.description)}${row.recurrence ? `<small class="cell-note">A cada ${row.recurrence} mês(es)</small>` : ''}</td><td>${day(row.date)}</td><td>${money(row.amount)}</td><td>${row.status === 'done' ? 'Realizada' : row.date < today() ? 'Agendada · vencida' : 'Agendada'}${canManage && row.status === 'planned' && !onlyPlanned ? `<button type="button" class="text-button complete-maintenance" data-id="${row.id}">Registrar realização</button>` : ''}</td></tr>`,
      ),
    );
  }
  function maintenancePanel(v, panel) {
    panel.innerHTML = `<section class="card maintenance-month-card"><div class="section-title"><h2>Previsão mensal de manutenção</h2><label class="month-picker">Mês de referência<input id="maintenance-month" type="month" value="${maintenanceMonth}" required></label></div><div id="monthly-maintenance" aria-live="polite">${monthlyMaintenance(v, maintenanceMonth)}</div><p class="hint">Somamos as manutenções cadastradas para o mês escolhido. Serviços concluídos aparecem em realizados. Recorrências futuras entram quando a próxima data é cadastrada.</p></section><div class="fleet-work-grid">${canManage ? `<section class="card"><h2>Nova manutenção</h2><form id="maintenance-form"><label>Serviço<input name="description" list="maintenance-types" maxlength="120" required placeholder="Ex.: troca de óleo"><datalist id="maintenance-types"><option value="Troca de óleo"><option value="Troca de filtros"><option value="Revisão de freios"><option value="Alinhamento e balanceamento"><option value="Revisão de pneus"><option value="Revisão preventiva"><option value="Inspeção do tacógrafo"><option value="Sistema de arrefecimento"></datalist></label><label>Situação<select name="status"><option value="planned">Agendada</option><option value="done">Já realizada</option></select></label>${dateInput(today(), true)}${amountInput('Valor previsto ou realizado (R$)', 'amount')}<label>Recorrência<select name="recurrence"><option value="0">Sem recorrência</option><option value="1">Mensal</option><option value="3">Trimestral</option><option value="6">Semestral</option><option value="12">Anual</option></select></label><p class="hint">Ao concluir uma manutenção recorrente, a próxima será agendada a partir da data de realização.</p>${submit('Salvar manutenção')}</form></section>` : ''}<section class="card"><h2>Plano e histórico de manutenção</h2><p class="hint">Somente serviços realizados entram nos custos do veículo.</p>${maintenanceTable(v)}<div id="completion-panel"></div></section></div>`;
    document.querySelector('#maintenance-month').onchange = (event) => {
      if (!/^\d{4}-\d{2}$/.test(event.target.value)) {
        event.target.value = maintenanceMonth;
        return;
      }
      maintenanceMonth = event.target.value;
      document.querySelector('#monthly-maintenance').innerHTML = monthlyMaintenance(
        v,
        maintenanceMonth,
      );
    };
    const form = document.querySelector('#maintenance-form');
    if (form) {
      form.elements.status.onchange = () => {
        const done = form.elements.status.value === 'done';
        form.elements.recurrence.disabled = done;
        if (done) {
          form.elements.recurrence.value = '0';
          form.elements.date.max = today();
        } else form.elements.date.removeAttribute('max');
      };
      bindForm(form, 'maintenance', (values) => ({
        ...values,
        recurrence: values.recurrence || 0,
      }));
    }
    document.querySelectorAll('.complete-maintenance').forEach(
      (button) =>
        (button.onclick = () => {
          const row = v.maintenance.find((item) => item.id === Number(button.dataset.id));
          document.querySelector('#completion-panel').innerHTML =
            `<form id="complete-form" class="completion-form"><h3>Concluir: ${esc(row.description)}</h3>${dateInput()}${amountInput('Valor efetivamente pago (R$)', 'amount', (row.amount / 100).toFixed(2).replace('.', ','))}${submit('Confirmar realização')}</form>`;
          bindForm(document.querySelector('#complete-form'), 'maintenance/complete', (values) => ({
            ...values,
            id: row.id,
          }));
          document.querySelector('#complete-form input').focus();
        }),
    );
  }
  function financePanel(v, panel) {
    panel.innerHTML = `<section class="card">${metrics(v)}<p class="hint">Custos totais = abastecimentos + ARLA + manutenções realizadas + custos fixos + outros custos.</p></section><div class="fleet-work-grid finance-work">${canManage ? `<section class="card"><h2>Novo lançamento</h2><form id="entry-form"><label>Tipo<select name="kind"><option value="revenue">Faturamento</option><option value="fixed">Custo fixo</option><option value="cost">Outro custo</option></select></label>${input('Descrição', 'description', 'text', '', 'maxlength="120" placeholder="Ex.: viagem, seguro, IPVA"')}${dateInput()}${amountInput('Valor (R$)', 'amount')}<p class="hint">Lance cada pagamento de custo fixo na data em que ocorreu. Não repita aqui abastecimentos ou manutenções já registrados.</p>${submit('Salvar lançamento')}</form></section>` : ''}<section class="card"><h2>Faturamento e outros custos</h2>${table(
      ['Data', 'Descrição', 'Tipo', 'Valor'],
      v.entries.map(
        (row) =>
          `<tr><td>${day(row.date)}</td><td>${esc(row.description)}</td><td>${types[row.kind]}</td><td>${money(row.amount)}</td></tr>`,
      ),
    )}</section></div>`;
    const form = document.querySelector('#entry-form');
    if (form) bindForm(form, 'entry');
  }
  draw();
}
