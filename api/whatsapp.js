// ─────────────────────────────────────────────────────────────
// WhatsApp Business API — envío con plantillas aprobadas
//
// Para INICIAR una conversación (avisarle a una tienda que hay un
// pedido), WhatsApp EXIGE una plantilla aprobada. El texto libre solo
// funciona si esa persona te escribió en las últimas 24 horas.
//
// Variables de entorno (en Vercel):
//   WHATSAPP_TOKEN     → token permanente del System User
//   WHATSAPP_PHONE_ID  → ID del número de teléfono
// ─────────────────────────────────────────────────────────────

const GRAPH = "https://graph.facebook.com/v21.0";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const TOKEN    = process.env.WHATSAPP_TOKEN    || process.env.WA_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_ID || process.env.WA_PHONE_ID;

  if (!TOKEN || !PHONE_ID) {
    return res.status(500).json({
      error: "WhatsApp no configurado. Faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en Vercel.",
    });
  }

  const { to, template, lang = "es", params = [], message } = req.body || {};

  if (!to) return res.status(400).json({ error: "Falta el número destino (to)" });

  const toClean = String(to).replace(/[^0-9]/g, "");
  if (toClean.length < 8) return res.status(400).json({ error: "Número destino inválido" });

  let payload;

  if (template) {
    payload = {
      messaging_product: "whatsapp",
      to: toClean,
      type: "template",
      template: {
        name: template,
        language: { code: lang },
        ...(params.length > 0 && {
          components: [
            {
              type: "body",
              parameters: params.map(v => ({ type: "text", text: String(v ?? "—") })),
            },
          ],
        }),
      },
    };
  } else if (message) {
    payload = {
      messaging_product: "whatsapp",
      to: toClean,
      type: "text",
      text: { body: message },
    };
  } else {
    return res.status(400).json({ error: "Debes indicar 'template' o 'message'" });
  }

  try {
    const resp = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();

    if (data.error) {
      return res.status(400).json({
        error: data.error.message,
        code: data.error.code,
        details: data.error.error_data?.details || null,
      });
    }
    return res.status(200).json({ success: true, messageId: data.messages?.[0]?.id, to: toClean });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
