// /api/verify-id.js
// Verifica cédula y foto de perfil usando Claude Vision
// Compara nombre legal escrito con nombre en el documento
// Extrae nombre, número de cédula, fecha nacimiento del documento

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { profilePhotoBase64, idDocBase64, legalName } = req.body;

  if (!idDocBase64) {
    return res.status(400).json({ error: 'Se requiere imagen del documento' });
  }

  // Detectar tipo de imagen desde los primeros bytes del base64
  const detectMediaType = (b64) => {
    if (!b64) return "image/jpeg";
    if (b64.startsWith("/9j/")) return "image/jpeg";
    if (b64.startsWith("iVBOR")) return "image/png";
    if (b64.startsWith("R0lGOD")) return "image/gif";
    if (b64.startsWith("UklGR")) return "image/webp";
    return "image/jpeg";
  };

  try {
    const messages = [];

    // Si hay foto de perfil, compararla con la cédula
    const userContent = [];

    if (profilePhotoBase64) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: detectMediaType(profilePhotoBase64), data: profilePhotoBase64 }
      });
    }

    userContent.push({
      type: "image",
      source: { type: "base64", media_type: detectMediaType(idDocBase64), data: idDocBase64 }
    });

    const promptText = `Eres un verificador de identidad. ${profilePhotoBase64 ? "Recibes DOS imágenes: (1) foto de perfil de la persona, (2) su cédula de identidad." : "Recibes la imagen de una cédula de identidad."}${legalName ? ` La persona declaró llamarse: "${legalName}".` : ""}

INSTRUCCIONES CLAVE:
- Las cédulas venezolanas SIEMPRE tienen una fotografía del titular en el lado derecho. Búscala ahí. Si la imagen muestra una cédula, ASUME que tiene foto salvo que esté completamente recortada o ilegible. Marca face_in_doc=true si ves cualquier rostro.
- Sé GENEROSO al comparar rostros: la misma persona puede verse distinta por barba, iluminación, edad o calidad del escaneo. Solo marca faces_match=false si claramente son personas diferentes.
- Un escaneo o foto de cédula con los datos visibles (nombre, número, república) ES un documento oficial: is_official_doc=true.

Responde ÚNICAMENTE con este JSON, sin texto antes ni después:
{${profilePhotoBase64 ? '\n  "face_in_profile": true/false,\n  "faces_match": true/false,' : ''}
  "face_in_doc": true/false,
  "is_official_doc": true/false,
  "extracted_name": "nombre completo del documento",
  "id_number": "número de cédula",
  "birth_date": "fecha de nacimiento",
  "expiry_date": "fecha de vencimiento",
  "country": "país",
  "name_matches": true/false,
  "notes": "observación breve en español"
}`;

    userContent.push({ type: "text", text: promptText });

    messages.push({ role: "user", content: userContent });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages,
      }),
    });

    const data = await response.json();

    // Si la API de Anthropic devolvió error
    if (data.error) {
      console.error('Anthropic API error:', JSON.stringify(data.error));
      return res.status(500).json({ error: 'Error del verificador: ' + (data.error.message||'desconocido') });
    }

    const text = data.content?.[0]?.text || '';
    console.log('verify-id IA respuesta cruda:', text);

    // Extraer el JSON aunque venga con texto alrededor
    let result;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch {
      // Buscar el primer bloque { ... } en el texto
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {}
      }
    }

    if (!result) {
      console.error('No se pudo parsear JSON de:', text);
      return res.status(200).json({ success: false, error: 'El verificador no devolvió un resultado legible', raw: text });
    }

    return res.status(200).json({ success: true, result });

  } catch (e) {
    console.error('verify-id error:', e);
    return res.status(500).json({ error: e.message });
  }
}
