// Prueba directa de envío — muestra la respuesta CRUDA de Meta
// Uso: /api/wa-test?to=17862577645
const GRAPH = "https://graph.facebook.com/v21.0";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const TOKEN    = process.env.WHATSAPP_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
  const to = String(req.query.to || "").replace(/[^0-9]/g, "");

  if (!to) return res.status(400).json({ error: "Falta ?to=numero (solo dígitos, con código de país)" });

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: "nuevo_pedido_tienda",
      language: { code: "es" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Marine Supply Co" },
            { type: "text", text: "Filtro de aceite Fleetguard FF5052" },
            { type: "text", text: "Coconut Grove" },
            { type: "text", text: "12 mi" },
          ],
        },
      ],
    },
  };

  const resp = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();

  return res.status(200).json({
    sentTo: to,
    httpStatus: resp.status,
    metaResponse: data,          // ← la respuesta cruda de Meta, con el error exacto
    payloadSent: payload,
  });
}
