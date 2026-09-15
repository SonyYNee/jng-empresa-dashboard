export function routeQuoteMessage(route) {
  const clean = (value) =>
    String(value ?? 'A confirmar')
      .replace(/[*_~`]/g, '')
      .trim();
  const money = (value) =>
    value == null
      ? 'Sob consulta'
      : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return [
    '*ORÇAMENTO DE ROTA - JNG*',
    '',
    `*Rota:* ${clean(route.name)}`,
    '',
    '*TRAJETO*',
    `  - Origem: ${clean(route.origin)}`,
    ...(route.stops || []).map(
      (stop, i) =>
        `  - Parada ${i + 1}: ${clean(stop.name)}${stop.time ? ' - ' + clean(stop.time) : ''}`,
    ),
    `  - Destino: ${clean(route.destination)}`,
    '',
    '*OPERAÇÃO*',
    `  - Saída: ${clean(route.departure || 'A confirmar')}`,
    `  - Chegada: ${clean(route.arrival || 'A confirmar')}${route.arrival_next_day ? ' (dia seguinte)' : ''}`,
    `  - Dias: ${route.weekdays?.length ? route.weekdays.map((day) => days[day]).join(', ') : 'Sob consulta'}`,
    route.distance != null ? `  - Distância: ${route.distance} km` : null,
    '',
    '*VALORES INFORMADOS*',
    `  - Rota completa: ${money(route.total_price)}`,
    `  - Por passageiro: ${money(route.passenger_price)}`,
    '',
    '*Percurso no Google Maps:*',
    route.maps_url,
    '',
    'Olá! Gostaria de um orçamento para esta rota. Podemos confirmar a data, a quantidade de passageiros e a disponibilidade?',
  ]
    .filter((line) => line != null)
    .join('\n');
}
export function quoteMessage(data) {
  const clean = (value) =>
    String(value || 'A definir')
      .replace(/[*_~`]/g, '')
      .trim();
  const date = (value) => (value ? value.split('-').reverse().join('/') : 'A definir');
  return [
    '*PEDIDO DE ORÇAMENTO - JNG*',
    '',
    `*Serviço:* ${clean(data.type)}`,
    data.interest ? `*Pacote / evento:* ${clean(data.interest)}` : '',
    '*TRAJETO*',
    `  - Origem: ${clean(data.origin)}`,
    `  - Destino: ${clean(data.destination)}`,
    `  - Embarque: ${clean(data.boarding)}`,
    '',
    '*DATAS E HORÁRIOS*',
    `  - Ida: ${date(data.date)} - ${clean(data.departure)}`,
    `  - Volta: ${date(data.returnDate)} - ${clean(data.returnTime)}`,
    '',
    '*GRUPO E TRANSPORTE*',
    `  - Passageiros: ${clean(data.passengers)}`,
    `  - Veículo: ${clean(data.vehicle || 'Decidir com a equipe')}`,
    '',
    '*CONTATO*',
    `  - Nome: ${clean(data.name)}`,
    `  - Telefone: ${clean(data.phone)}`,
    `  - E-mail: ${clean(data.email)}`,
    '',
    '*DETALHES ADICIONAIS*',
    clean(data.notes || 'Sem observações.'),
    '',
    'Aguardo valores e disponibilidade. Obrigado!',
  ]
    .filter((line) => line !== null)
    .join('\n');
}
export function bindCalendars(form) {
  form.querySelectorAll('input[type=date]').forEach((input) => {
    input.readOnly = true;
    input.style.cursor = 'pointer';
    const open = () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'jng-calendar';
      dialog.setAttribute(
        'aria-label',
        input.name === 'date' ? 'Escolher data de ida' : 'Escolher data de volta',
      );
      let current = new Date(
        (input.value || input.min || new Date().toLocaleDateString('en-CA')) + 'T12:00:00',
      );
      current.setDate(1);
      const draw = () => {
        dialog.replaceChildren();
        const header = document.createElement('div');
        header.className = 'calendar-heading';
        const button = (label, action) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = label;
          b.onclick = action;
          return b;
        };
        header.append(
          button('‹', () => {
            current.setMonth(current.getMonth() - 1);
            draw();
          }),
          document.createTextNode(
            current.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
          ),
          button('›', () => {
            current.setMonth(current.getMonth() + 1);
            draw();
          }),
        );
        dialog.append(header);
        const grid = document.createElement('div');
        grid.className = 'calendar-days';
        ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach((day) => {
          const span = document.createElement('span');
          span.textContent = day;
          grid.append(span);
        });
        for (let i = 0; i < current.getDay(); i++) grid.append(document.createElement('span'));
        const count = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= count; d++) {
          const value = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const b = button(String(d), () => {
            input.value = value;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            dialog.close();
          });
          b.disabled = !!input.min && value < input.min;
          b.setAttribute(
            'aria-label',
            new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' }),
          );
          b.setAttribute('aria-pressed', String(input.value === value));
          grid.append(b);
        }
        dialog.append(grid);
        const actions = document.createElement('div');
        actions.className = 'calendar-actions';
        if (!input.required)
          actions.append(
            button('Sem volta definida', () => {
              input.value = '';
              dialog.close();
            }),
          );
        actions.append(button('Fechar', () => dialog.close()));
        dialog.append(actions);
      };
      draw();
      document.body.append(dialog);
      dialog.addEventListener(
        'close',
        () => {
          dialog.remove();
          input.focus();
        },
        { once: true },
      );
      dialog.showModal();
    };
    input.onclick = (event) => {
      event.preventDefault();
      open();
    };
    input.onkeydown = (event) => {
      if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        open();
      }
    };
  });
}
