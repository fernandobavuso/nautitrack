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

    userContent.push({
      type: "text",
      text: legalName ? `El usuario dice que su nombre legal es: "${legalName}". ` + (profilePhotoBase64 ? "Analiza estas dos imágenes." : "Analiza esta cédula.") + ` Verifica si el nombre en el documento coincide con ese nombre declarado. ` : (profilePhotoBase64 ? "Analiza estas dos imágenes." : "Analiza este documento.")
        ? `Analiza estas dos imágenes. La primera es la foto de perfil del usuario. La segunda es su cédula de identidad venezolana.

Por favor responde SOLO con un JSON válido con este formato exacto:
{
  "face_in_profile": true o false (¿hay una cara humana clara en la foto de perfil?),
  "face_in_doc": true o false (¿hay una foto de cara en el documento?),
  "faces_match": true o false (¿la persona en la foto de perfil parece ser la misma que en el documento?),
  "is_official_doc": true o false (¿parece un documento de identidad oficial?),
  "extracted_name": "nombre completo tal como aparece en el documento",
  "id_number": "número de cédula o pasaporte",
  "birth_date": "fecha de nacimiento si aparece",
  "expiry_date": "fecha de vencimiento si aparece",
  "country": "país emisor del documento",
  "notes": "cualquier observación relevante en español"
}`
        : `Analiza este documento de identidad (cédula o pasaporte).

Por favor responde SOLO con un JSON válido con este formato exacto:
{
  "face_in_doc": true o false (¿hay una foto de cara en el documento?),
  "is_official_doc": true o false (¿parece un documento de identidad oficial?),
  "extracted_name": "nombre completo tal como aparece en el documento",
  "id_number": "número de cédula o pasaporte",
  "birth_date": "fecha de nacimiento si aparece",
  "expiry_date": "fecha de vencimiento si aparece",
  "country": "país emisor del documento",
  "notes": "cualquier observación relevante en español"
}`
    });

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
