export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { to, message, token, phoneNumberId } = req.body;
  
  // Use env vars in production, fallback to body for dev
  const WA_TOKEN   = process.env.WA_TOKEN   || token;
  const WA_PHONE_ID = process.env.WA_PHONE_ID || phoneNumberId;

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace(/[^0-9]/g, ''), // strip non-digits
          type: 'text',
          text: { body: message },
        }),
      }
    );
    const data = await resp.json();
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    res.status(200).json({ success: true, messageId: data.messages?.[0]?.id });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}