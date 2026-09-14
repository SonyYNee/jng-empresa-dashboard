import { readMapsLink } from '/maps-link.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const field = (label, name, value = '', attrs = '') => `<label>${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
const mapsButton = route => `<a class="secondary maps-button" href="${esc(route.maps_url)}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps ↗</a>`;
const schedule = route => route.weekdays.length ? route.weekdays.map(day => days[day]).join(' · ') : 'Dias a definir';
const times = route => `${route.departure || 'Saída a definir'}${route.arrival ? ` → ${route.arrival}${route.arrival_next_day ? ' (+1 dia)' : ''}` : ''}`;
function itinerary(route) {
  const points = [{ name: route.origin, time: route.departure, notes: 'Origem' }, ...route.stops, { name: route.destination, time: route.arrival, notes: `Destino${route.arrival_next_day ? ' · chegada no dia seguinte' : ''}` }];
  return `<ol class="route-itinerary">${points.map((point, i) => `<li><span class="stop-number">${i + 1}</span><div><strong>${esc(point.name)}</strong>${point.notes ? `<p>${esc(point.notes)}</p>` : ''}</div><time>${esc(point.time || '—')}</time></li>`).join('')}</ol>`;
}
export async function showRoutes(user, { api, shell }) {
  let data = await api('routes');
  let activeId = Number(new URLSearchParams(location.search).get('rota')) || null;
  const message = (node, text, good = false) => { node.textContent = text; node.className = `form-message ${good ? 'success' : 'error'}`; };
  const base = html => shell(user, 'Rotas', html);
  function draw(success = '') {
    const route = data.routes.find(item => item.id === activeId);
    if (!route) activeId = null;
    history.replaceState({}, '', route ? `/rotas?rota=${route.id}` : '/rotas');
    if (route) { detail(route, success); return; }
    base(`<div class="page-heading"><div><p class="eyebrow">PLANEJAMENTO DA OPERAÇÃO</p><h1>Rotas</h1><p>Organize os trajetos, paradas e profissionais de cada operação.</p></div>${data.canManage ? '<button type="button" class="primary compact" id="new-route">+ Criar rota</button>' : ''}</div><p class="form-message success" role="status">${esc(success)}</p><div class="routes-grid">${data.routes.map(route => `<article class="card route-card"><div class="section-title"><span class="eyebrow">ROTA #${route.id} · ${esc(data.types[route.type])}</span><span class="route-status status-${route.status}">${esc(data.statuses[route.status])}</span></div><h2>${esc(route.name)}</h2><div class="route-endpoints"><p><small>Origem</small><strong>${esc(route.origin)}</strong></p><p><small>Destino</small><strong>${esc(route.destination)}</strong></p></div><p class="hint">${route.stops.length} parada(s)${route.distance ? ` · ${esc(route.distance)} km previstos` : ''}</p><div class="route-assignment"><p><span>Operação</span>${esc(schedule(route))}</p><p><span>Horários</span>${esc(times(route))}</p><p><span>Veículo</span>${route.vehicle_id ? `${esc(route.vehicle_model)} · ${esc(route.vehicle_plate)}` : 'Não vinculado'}</p><p><span>Motorista</span>${esc(route.driver_name || 'Não vinculado')}</p></div><div class="route-card-actions"><button class="secondary configure-route" data-id="${route.id}" type="button">${data.canManage ? '⚙ Configurar rota' : 'Ver rota'}</button>${mapsButton(route)}</div></article>`).join('') || '<section class="card"><h2>Nenhuma rota cadastrada</h2><p>Crie o trajeto no Google Maps e cole o link no cadastro da nova rota.</p></section>'}</div>`);
    document.querySelector('#new-route')?.addEventListener('click', () => editor());
    document.querySelectorAll('.configure-route').forEach(button => button.onclick = () => { activeId = Number(button.dataset.id); draw(); });
    if(data.canManage)document.querySelectorAll('.configure-route').forEach(button=>{
      const route=data.routes.find(item=>item.id===Number(button.dataset.id));
      const remove=document.createElement('button');remove.type='button';remove.className='secondary delete-route';remove.textContent='Excluir rota';
      remove.onclick=()=>deleteRoute(route,remove);button.parentElement.append(remove);
    });
  }
  function detail(route, success) {
    base(`<a class="text-link fleet-back" href="/rotas">← Todas as rotas</a><div class="page-heading"><div><p class="eyebrow">ROTA #${route.id} · ${esc(data.types[route.type])}</p><h1>${esc(route.name)}</h1><span class="route-status status-${route.status}">${esc(data.statuses[route.status])}</span></div><div class="route-card-actions">${mapsButton(route)}${data.canManage ? '<button type="button" id="edit-route" class="primary compact">Editar rota</button>' : ''}</div></div><p class="form-message success" role="status">${esc(success)}</p><div class="route-detail-grid"><section class="card"><h2>Itinerário e paradas</h2><p class="hint">Confira o percurso no Google Maps. As paradas cadastradas aqui são o roteiro operacional e não alteram o link original.</p>${itinerary(route)}</section><section class="card"><h2>Configuração da operação</h2><dl><dt>Dias de operação</dt><dd>${esc(schedule(route))}</dd><dt>Horários previstos</dt><dd>${esc(times(route))}</dd><dt>Distância prevista</dt><dd>${route.distance ? `${esc(route.distance)} km` : 'Não informada'}</dd><dt>Rota completa</dt><dd>${route.total_price==null?'Sob consulta':Number(route.total_price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</dd><dt>Por passageiro</dt><dd>${route.passenger_price==null?'Sob consulta':Number(route.passenger_price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</dd><dt>Veículo</dt><dd>${route.vehicle_id ? `<a class="text-link inline-link" href="/frota?veiculo=${route.vehicle_id}">${esc(route.vehicle_model)} · ${esc(route.vehicle_plate)}</a>` : 'Não vinculado'}</dd><dt>Motorista</dt><dd>${esc(route.driver_name || 'Não vinculado')}</dd></dl><h3>Observações da operação</h3><p class="route-notes">${esc(route.notes || 'Nenhuma observação cadastrada.')}</p></section></div>`);
    document.querySelector('#edit-route')?.addEventListener('click', () => editor(route));
    if(data.canManage){const remove=document.createElement('button');remove.type='button';remove.className='secondary delete-route';remove.textContent='Excluir rota';remove.onclick=()=>deleteRoute(route,remove);document.querySelector('#edit-route').after(remove);}
  }
  async function deleteRoute(route,button){
    if(!confirm(`Excluir a rota “${route.name}”?\nEla será removida da dashboard e da landing page. Esta ação não pode ser desfeita.`))return;
    button.disabled=true;button.textContent='Excluindo…';
    let deleted=false;
    try{await api('routes/delete',{id:route.id,confirm_name:route.name});deleted=true;data.routes=data.routes.filter(item=>item.id!==route.id);activeId=null;draw('Rota excluída com sucesso.');}
    catch(error){if(deleted){location.href='/rotas';return;}button.disabled=false;button.textContent='Excluir rota';alert(error.message);}
  }
  function editor(route = null) {
    const r = route || { name: '', maps_url: '', origin: '', destination: '', type: 'charter', status: 'draft', departure: '', arrival: '', arrival_next_day: false, distance: '', vehicle_id: null, driver_id: null, weekdays: [], stops: [], notes: '' };
    let stops = r.stops.map(stop => ({ ...stop }));
    const options = (values, selected) => Object.entries(values).map(([key, label]) => `<option value="${esc(key)}" ${key === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const driverOptions = [...data.drivers];
    if (r.driver_id && !driverOptions.some(driver => driver.id === r.driver_id)) driverOptions.push({ id: r.driver_id, name: `${r.driver_name} (vínculo atual)` });
    base(`<a class="text-link fleet-back" href="${route ? `/rotas?rota=${route.id}` : '/rotas'}">← ${route ? 'Voltar à rota' : 'Todas as rotas'}</a><div class="page-heading"><div><p class="eyebrow">ROTEIRO OPERACIONAL</p><h1>${route ? 'Editar rota' : 'Criar rota'}</h1><p>Traga o trajeto do Maps e complete os detalhes da operação.</p></div></div><form id="route-form"><section class="card route-form-section"><h2>1. Trajeto no Google Maps</h2>${field('Link da rota', 'maps_url', r.maps_url, 'type="url" maxlength="12000" placeholder="https://maps.app.goo.gl/..." required')}<button type="button" id="read-maps" class="secondary read-maps">Ler pontos do link</button><p id="maps-message" class="hint" role="status">Links encurtados podem ser salvos normalmente. Se os pontos não estiverem no endereço do link, preencha origem, destino e paradas abaixo.</p><p class="hint">Revise os pontos extraídos. Os km podem ser calculados gratuitamente pelos pontos do link original. Confira o percurso e preencha os horários.</p></section><section class="card route-form-section"><h2>2. Identificação e percurso</h2><div class="form-grid">${field('Nome da rota', 'name', r.name, 'maxlength="120" placeholder="Ex.: Fretamento — Turno da manhã" required')}<label>Tipo de operação<select name="type">${options(data.types, r.type)}</select></label>${field('Origem', 'origin', r.origin, 'maxlength="300" placeholder="Endereço ou ponto de embarque inicial" required')}${field('Destino', 'destination', r.destination, 'maxlength="300" placeholder="Endereço ou ponto final" required')}<label>Situação<select name="status">${options(data.statuses, r.status)}</select></label>${field('Distância prevista (km)', 'distance', r.distance ?? '', 'inputmode="decimal" placeholder="Opcional. Ex.: 42,5"')}</div><div class="section-title stops-heading"><h3>Paradas intermediárias</h3><button type="button" id="add-stop" class="secondary">+ Adicionar parada</button></div><p class="hint">Informe as paradas na ordem da viagem. Use as setas para reordenar. Até 30 paradas.</p><div id="route-stops"></div></section><section class="card route-form-section"><h2>3. Operação e responsáveis</h2><div class="form-grid">${field('Valor da rota completa (R$)', 'total_price', r.total_price ?? '', 'inputmode="decimal" placeholder="Ex.: 1500,00"')}${field('Valor por passageiro (R$)', 'passenger_price', r.passenger_price ?? '', 'inputmode="decimal" placeholder="Ex.: 48,32"')}</div><p class="hint">Valores independentes. Deixe vazio para exibir sob consulta. Rotas particulares nunca aparecem no site, mesmo ativas.</p><div class="form-grid"><label>Veículo<select name="vehicle_id"><option value="">Definir depois</option>${data.vehicles.map(v => `<option value="${v.id}" ${v.id === r.vehicle_id ? 'selected' : ''}>${esc(v.model)} · ${esc(v.plate)}</option>`).join('')}</select></label><label>Motorista<select name="driver_id"><option value="">Definir depois</option>${driverOptions.map(driver => `<option value="${driver.id}" ${driver.id === r.driver_id ? 'selected' : ''}>${esc(driver.name)}</option>`).join('')}</select></label>${field('Saída prevista', 'departure', r.departure, 'type="time"')}${field('Chegada prevista', 'arrival', r.arrival, 'type="time"')}</div><label class="checkbox-label"><input type="checkbox" name="arrival_next_day" ${r.arrival_next_day ? 'checked' : ''}> Chegada no dia seguinte</label><fieldset class="weekdays"><legend>Dias de operação</legend>${days.map((label, day) => `<label><input type="checkbox" name="weekday" value="${day}" ${r.weekdays.includes(day) ? 'checked' : ''}>${label}</label>`).join('')}</fieldset><p class="hint">Deixe sem dias marcados se a programação ainda não estiver definida.</p><label>Observações<textarea name="notes" rows="4" maxlength="3000" placeholder="Orientações de embarque, referência dos locais e cuidados da operação">${esc(r.notes)}</textarea></label></section><p class="form-message" id="route-save-message" role="status"></p><div class="route-save-actions"><a class="secondary" href="${route ? `/rotas?rota=${route.id}` : '/rotas'}">Cancelar</a><button class="primary compact" type="submit">${route ? 'Salvar alterações' : 'Cadastrar rota'}</button></div></form>`);
    const form = document.querySelector('#route-form');
    const distanceField=form.elements.distance;
    distanceField.parentElement.insertAdjacentHTML('beforeend','<span class="hint">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · OSRM / FOSSGIS · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Corrigir o mapa</a></span>');
    distanceField.insertAdjacentHTML('afterend','<button type="button" class="secondary" id="calculate-distance">Calcular km automaticamente</button><span id="distance-message" class="hint" role="status">Cálculo gratuito pelos pontos do link original. Atualize o link ao mudar o percurso.</span>');
    let distanceRequest=0,distanceTimer;
    const distanceSignature=()=>form.elements.maps_url.value;
    async function updateDistance(){
      collectStops();const signature=distanceSignature(),requestId=++distanceRequest;
      const button=form.querySelector('#calculate-distance'),output=form.querySelector('#distance-message');
      button.disabled=true;output.textContent='Calculando distância…';
      try{const result=await api('routes/distance',{maps_url:form.elements.maps_url.value});
        if(!form.isConnected||requestId!==distanceRequest||signature!==distanceSignature())return;
        distanceField.value=String(result.distance).replace('.',',');output.textContent=`${result.distance.toLocaleString('pt-BR')} km · OSRM / OpenStreetMap · pontos do link original. Pode diferir do Google Maps.`;
      }catch(error){if(form.isConnected&&requestId===distanceRequest)output.textContent=error.message;}
      finally{if(form.isConnected&&requestId===distanceRequest)button.disabled=false;}
    }
    form.querySelector('#calculate-distance').onclick=updateDistance;
    form.addEventListener('input',event=>{if(event.target.name==='maps_url'){
      clearTimeout(distanceTimer);distanceRequest++;distanceField.value='';form.querySelector('#calculate-distance').disabled=false;
      form.querySelector('#distance-message').textContent='Percurso alterado. Atualizando a distância…';
      distanceTimer=setTimeout(()=>{if(form.isConnected&&form.elements.maps_url.value.trim())updateDistance();},1200);
    }});
    function collectStops() {
      stops = [...document.querySelectorAll('.stop-editor')].map(node => ({ name: node.querySelector('[data-field=name]').value, time: node.querySelector('[data-field=time]').value, notes: node.querySelector('[data-field=notes]').value }));
    }
    function renderStops() {
      document.querySelector('#route-stops').innerHTML = stops.map((stop, i) => `<div class="stop-editor"><div class="stop-editor-heading"><strong>Parada ${i + 1}</strong><div class="stop-controls"><button type="button" class="secondary" data-move="${i}" data-direction="-1" aria-label="Mover parada ${i + 1} para cima" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="secondary" data-move="${i}" data-direction="1" aria-label="Mover parada ${i + 1} para baixo" ${i === stops.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="text-button" data-remove-stop="${i}">Remover</button></div></div><div class="form-grid"><label>Local ou endereço<input data-field="name" value="${esc(stop.name)}" maxlength="300" required></label><label>Horário previsto<input data-field="time" value="${esc(stop.time)}" type="time"></label></div><label>Orientações da parada<input data-field="notes" value="${esc(stop.notes)}" maxlength="300" placeholder="Ex.: embarque em frente à portaria"></label></div>`).join('') || '<p class="empty-state">Sem paradas intermediárias. O trajeto vai da origem ao destino.</p>';
      document.querySelector('#add-stop').disabled = stops.length >= 30;
      document.querySelectorAll('[data-move]').forEach(button => button.onclick = () => { collectStops(); const from = Number(button.dataset.move), to = from + Number(button.dataset.direction); [stops[from], stops[to]] = [stops[to], stops[from]]; renderStops(); document.querySelectorAll('.stop-editor')[to].querySelector('input').focus(); });
      document.querySelectorAll('[data-remove-stop]').forEach(button => button.onclick = () => { collectStops(); stops.splice(Number(button.dataset.removeStop), 1); renderStops(); });
    }
    renderStops();
    document.querySelector('#add-stop').onclick = () => { collectStops(); if (stops.length >= 30) return; stops.push({ name: '', time: '', notes: '' }); renderStops(); document.querySelectorAll('.stop-editor input[data-field=name]').item(stops.length - 1).focus(); };
    document.querySelector('#read-maps').onclick = async event => {
      const output = document.querySelector('#maps-message');
      const button = event.currentTarget; button.disabled = true;
      const sourceLink = form.elements.maps_url.value;
      try {
        readMapsLink(sourceLink);
        message(output, 'Lendo os pontos disponíveis no link…', true);
        const parsed = await api('routes/preview', { maps_url: sourceLink });
        if (!form.isConnected || form.elements.maps_url.value !== sourceLink) return;
        if (parsed.requiresAddresses) { message(output, 'O Maps trouxe coordenadas para alguns pontos. Preencha os endereços de origem, destino e paradas antes de salvar. Coordenadas não serão usadas como endereço.'); return; }
        if (!form.isConnected || form.elements.maps_url.value !== sourceLink) return;
        if (!parsed.origin || !parsed.destination) { message(output, 'Link reconhecido. Origem, destino e paradas não estão legíveis neste link; preencha os campos abaixo.', true); return; }
        collectStops();
        if (form.elements.origin.value.trim() || form.elements.destination.value.trim() || stops.length) { message(output, 'Para preservar seu roteiro, a leitura só preenche campos vazios. Limpe origem, destino e paradas se quiser substituí-los pelo link.'); return; }
        if (parsed.stops.length > 30 || [parsed.origin, parsed.destination, ...parsed.stops].some(point => point.length > 300)) throw new Error('O link possui pontos demais ou endereços muito longos. Preencha o roteiro manualmente.');
        form.elements.origin.value = parsed.origin; form.elements.destination.value = parsed.destination;
        stops = parsed.stops.map(name => ({ name, time: '', notes: '' })); renderStops();
        updateDistance();
        message(output, 'Pontos extraídos do endereço do link. Revise os locais e complete os horários antes de salvar.', true);
      } catch (error) { message(output, error.message); }
      finally { button.disabled = false; }
    };
    form.onsubmit = async event => {
      event.preventDefault(); collectStops();
      const button = form.querySelector('[type=submit]'); button.disabled = true;
      const values = Object.fromEntries(new FormData(form));
      const payload = { ...values, id: route?.id || null, stops, weekdays: [...form.querySelectorAll('[name=weekday]:checked')].map(input => Number(input.value)), arrival_next_day: form.elements.arrival_next_day.checked, vehicle_id: values.vehicle_id ? Number(values.vehicle_id) : null, driver_id: values.driver_id ? Number(values.driver_id) : null };
      let saved = false;
      try {
        readMapsLink(payload.maps_url);
        const result = await api('routes/save', payload); saved = true; activeId = result.id;
        data = await api('routes'); draw('Rota salva com sucesso.');
      } catch (error) {
        if (saved) { location.assign(`/rotas?rota=${activeId}`); return; }
        message(document.querySelector('#route-save-message'), error.message); button.disabled = false;
      }
    };
  }
  draw();
}
