// Prueba de envío — con opción de plantilla y diagnóstico de la cuenta
// Uso: /api/wa-test?to=13057997996              → usa nuevo_pedido_tienda
//      /api/wa-test?to=13057997996&t=hello      → usa hello_world (control)
const GRAPH = "https://graph.facebook.com/v21.0";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const TOKEN    = process.env.WHATSAPP_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
  const to = String(req.query.to || "").replace(/[^0-9]/g, "");
  const useHello = req.query.t === "hello";

  if (!to) return res.status(400).json({ error: "Falta ?to=numero" });

  const call = async (url, opts) => {
    const r = await fetch(url, opts);
    return { status: r.status, body: await r.json() };
  };

  const out = { sentTo: to };

  // Estado del número (calidad, límites)
  const info = await call(
    `${GRAPH}/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,name_status`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  out.numberStatus = info.body;

  // Construir el mensaje
  const payload = useHello
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: "hello_world", language: { code: "en_US" } },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "pedido_tienda_aviso",
          language: { code: "es" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: "Marine Supply Co" },
              { type: "text", text: "Filtro de aceite Fleetguard FF5052" },
              { type: "text", text: "Coconut Grove" },
              { type: "text", text: "12 mi" },
            ],
          }],
        },
      };

  out.templateUsed = payload.template.name;

  const sent = await call(`${GRAPH}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  out.sendResult = sent.body;

  return res.status(200).json(out);
}
