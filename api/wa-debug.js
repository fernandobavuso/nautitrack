// Diagnóstico: lista las plantillas reales que existen en Meta
// Uso: GET /api/wa-debug
const GRAPH = "https://graph.facebook.com/v21.0";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const TOKEN    = process.env.WHATSAPP_TOKEN || process.env.WA_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_ID || process.env.WA_PHONE_ID;

  if (!TOKEN || !PHONE_ID) {
    return res.status(500).json({ error: "Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en Vercel" });
  }

  const out = { phoneId: PHONE_ID };

  try {
    // 1. Datos del número → de ahí sacamos el WABA ID
    const rPhone = await fetch(
      `${GRAPH}/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    out.phone = await rPhone.json();

    // 2. El WABA al que pertenece el número
    const rWaba = await fetch(
      `${GRAPH}/${PHONE_ID}?fields=whatsapp_business_account`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const wabaData = await rWaba.json();
    const wabaId = wabaData?.whatsapp_business_account?.id;
    out.wabaId = wabaId || "no encontrado";

    // 3. Las plantillas de ese WABA
    if (wabaId) {
      const rTpl = await fetch(
        `${GRAPH}/${wabaId}/message_templates?fields=name,language,status,category,components&limit=50`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      const tpl = await rTpl.json();
      out.templates = (tpl.data || []).map(t => ({
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
        variables: (t.components || [])
          .filter(c => c.type === "BODY")
          .map(c => (c.text?.match(/\{\{\d+\}\}/g) || []).length)[0] || 0,
      }));
      if (tpl.error) out.templatesError = tpl.error.message;
    }
  } catch (err) {
    out.error = err.message;
  }

  return res.status(200).json(out);
}
