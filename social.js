export async function initSocial(db, { session, body, json }) {
  await db.exec("CREATE TABLE IF NOT EXISTS company_social (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)");
  const names = {instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',youtube:'YouTube',linkedin:'LinkedIn',x:'X',whatsapp:'WhatsApp'};
  const read = async () => JSON.parse((await db.get('SELECT data FROM company_social WHERE id=1'))?.data || '{}');
  return async (req,res,path) => {
    if (!['/api/social','/api/public/social'].includes(path)) return false;
    if (path === '/api/public/social') {
      if (req.method !== 'GET') { json(res,405,{error:'Método não permitido.'}); return true; }
    } else {
      const user = await session(req);
      if (!user) { json(res,401,{error:'Entre para continuar.'}); return true; }
      if (user.role !== 'owner') { json(res,403,{error:'Somente proprietários podem configurar as redes sociais.'}); return true; }
    }
    if (req.method === 'GET') { json(res,200,{social: await read()}); return true; }
    if (req.method !== 'POST') { json(res,405,{error:'Método não permitido.'}); return true; }
    const input = await body(req);
    const values = {};
    for (const [key,label] of Object.entries(names)) {
      if (input?.[key] != null && typeof input[key] !== 'string') { json(res,400,{error:`Informe um valor válido para ${label}.`}); return true; }
      const value = (input?.[key] || '').trim();
      if (!value) continue;
      if (key === 'whatsapp') {
        const digits = value.replace(/[+\s().-]/g,'');
        if (!/^[1-9]\d{9,14}$/.test(digits)) { json(res,400,{error:'Informe o WhatsApp com código do país e DDD. Exemplo: +55 51 99999-9999.'}); return true; }
        values[key] = digits;
      } else {
        try {
          const url = new URL(value);
          if (value.length > 1000 || url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error();
          values[key] = url.href;
        } catch { json(res,400,{error:`Informe o link completo de ${label}, começando com https://.`}); return true; }
      }
    }
    await db.run('INSERT INTO company_social (id,data) VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [JSON.stringify(values)]);
    json(res,200,{social:values}); return true;
  };
}
