// Diagnóstico de WhatsApp: prueba varias rutas para encontrar el WABA y las plantillas
const GRAPH = "https://graph.facebook.com/v21.0";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const TOKEN    = process.env.WHATSAPP_TOKEN || process.env.WA_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_ID || process.env.WA_PHONE_ID;
  const BUSINESS_ID = "946833512453790";

  if (!TOKEN) return res.status(500).json({ error: "Falta WHATSAPP_TOKEN en Vercel" });

  const call = async (url) => {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      return await r.json();
    } catch (e) { return { error: { message: e.message } }; }
  };

  const out = { phoneId: PHONE_ID };

  // 1. ¿Qué es este token? (a quién pertenece, qué permisos tiene)
  out.tokenInfo = await call(`${GRAPH}/me?fields=id,name`);

  // 2. Los WABAs del negocio (ruta directa desde el Business)
  const wabas = await call(`${GRAPH}/${BUSINESS_ID}/owned_whatsapp_business_accounts?fields=id,name`);
  out.ownedWabas = wabas;

  // 3. También los "client" WABAs (por si está compartido)
  const clientWabas = await call(`${GRAPH}/${BUSINESS_ID}/client_whatsapp_business_accounts?fields=id,name`);
  out.clientWabas = clientWabas;

  // 4. Si encontramos algún WABA, listar sus plantillas
  const wabaId = wabas?.data?.[0]?.id || clientWabas?.data?.[0]?.id;
  out.wabaIdFound = wabaId || null;

  if (wabaId) {
    const tpl = await call(`${GRAPH}/${wabaId}/message_templates?fields=name,language,status,category&limit=50`);
    out.templates = (tpl.data || []).map(t => ({
      name: t.name, language: t.language, status: t.status, category: t.category,
    }));
    if (tpl.error) out.templatesError = tpl.error;

    // También los números de ese WABA (para confirmar que el nuestro está ahí)
    const nums = await call(`${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`);
    out.wabaPhoneNumbers = nums.data || nums.error;
  }

  return res.status(200).json(out);
}
