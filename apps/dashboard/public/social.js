export async function showSocial(user, { api, shell }) {
  if (user.role !== 'owner') {
    shell(
      user,
      'Redes sociais',
      '<section class="card"><h1>Acesso restrito</h1><p>Somente proprietários podem configurar as redes sociais.</p></section>',
    );
    return;
  }
  const { social } = await api('social');
  const esc = (v) =>
    String(v || '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const fields = [
    ['whatsapp', 'WhatsApp', '+55 51 99999-9999'],
    ['instagram', 'Instagram', 'https://www.instagram.com/suaempresa'],
    ['facebook', 'Facebook', 'https://www.facebook.com/suaempresa'],
    ['tiktok', 'TikTok', 'https://www.tiktok.com/@suaempresa'],
    ['youtube', 'YouTube', 'https://www.youtube.com/@suaempresa'],
    ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/suaempresa'],
    ['x', 'X (Twitter)', 'https://x.com/suaempresa'],
  ];
  shell(
    user,
    'Redes sociais',
    `<div class="page-heading"><div><p class="eyebrow">PRESENÇA DIGITAL</p><h1>Redes sociais</h1><p>Configure os canais oficiais da JNG exibidos no site.</p></div></div><section class="card"><form id="social-form"><div class="settings-grid">${fields.map(([key, label, example]) => `<label>${label}<input name="${key}" type="${key === 'whatsapp' ? 'tel' : 'url'}" maxlength="${key === 'whatsapp' ? 30 : 1000}" placeholder="${example}" value="${esc(social[key])}"></label>`).join('')}</div><p class="hint">WhatsApp: inclua o código do país e o DDD. Nas demais redes, cole o link completo com https://. Deixe o campo vazio para retirar um canal do site.</p><p class="form-message" id="social-message" role="status"></p><button class="primary" type="submit">Salvar redes sociais</button></form></section>`,
  );
  const form = document.querySelector('#social-form');
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    const message = document.querySelector('#social-message');
    button.disabled = true;
    message.textContent = '';
    try {
      await api('social', Object.fromEntries(new FormData(form)));
      message.className = 'form-message success';
      message.textContent = 'Redes sociais atualizadas no site com sucesso.';
    } catch (error) {
      message.className = 'form-message error';
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
