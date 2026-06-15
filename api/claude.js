export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { messages, model, max_tokens, pdfUrl } = req.body;

    let finalMessages = messages;

    // If pdfUrl provided, fetch PDF server-side and include as document
    if (pdfUrl) {
      try {
        const pdfResp = await fetch(pdfUrl);
        const arrayBuffer = await pdfResp.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Inject PDF into first user message
        const firstMsg = messages[0];
        finalMessages = [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 }
              },
              {
                type: 'text',
                text: Array.isArray(firstMsg.content)
                  ? firstMsg.content.find(c => c.type === 'text')?.text || ''
                  : firstMsg.content
              }
            ]
          },
          ...messages.slice(1)
        ];
      } catch(pdfErr) {
        console.error('PDF fetch error:', pdfErr.message);
        // Continue without PDF
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 2000,
        messages: finalMessages,
      }),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}