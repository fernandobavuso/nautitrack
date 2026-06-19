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

    const promptText = `Estás verificando la identidad de un tripulante náutico. ${profilePhotoBase64 ? "La PRIMERA imagen es su foto de perfil. La SEGUNDA imagen es su cédula de identidad (puede ser escaneada o fotografiada)." : "La imagen es su cédula de identidad."}${legalName ? ` El usuario declaró que su nombre completo es: "${legalName}".` : ""}

IMPORTANTE: Las cédulas venezolanas tienen una foto del titular en el lado derecho. Si el documento está escaneado, la foto puede verse en blanco y negro o con baja calidad — aun así cuenta como foto válida. Sé flexible: si hay cualquier rostro visible en el documento, marca face_in_doc como true.

Responde SOLO con JSON válido, sin texto adicional ni backticks:
{
  ${profilePhotoBase64 ? '"face_in_profile": true/false (¿hay un rostro humano en la foto de perfil?),\n  "faces_match": true/false (¿parecen la misma persona la foto de perfil y la foto del documento? Sé razonablemente flexible con calidad/edad/barba),' : ''}
  "face_in_doc": true/false (¿hay algún rostro visible en la cédula, aunque sea escaneada o de baja calidad?),
  "is_official_doc": true/false (¿parece una cédula o documento de identidad oficial?),
  "extracted_name": "nombre completo que aparece en el documento",
  "id_number": "número de cédula",
  "birth_date": "fecha de nacimiento si aparece",
  "expiry_date": "fecha de vencimiento si aparece",
  "country": "país emisor",
  "name_matches": true/false (¿el nombre del documento coincide con el nombre declarado?),
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
    const text = data.content?.[0]?.text || '{}';

    // Limpiar y parsear JSON
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json({ success: true, result });

  } catch (e) {
    console.error('verify-id error:', e);
    return res.status(500).json({ error: e.message });
  }
}
