// Webhook de WhatsApp — permite que las tiendas coticen SIN entrar a la app.
//
// Flujo:
//   1. Llega un pedido nuevo -> se envía plantilla con botones a las tiendas
//      (botones: Tengo / No tengo / Tengo preguntas)
//   2. La tienda toca un botón -> aquí guardamos el estado y le pedimos el dato
//   3. La tienda escribe el precio (o la pregunta) -> se crea la cotización real
//      en part_responses, igual que si lo hubiera hecho desde el portal.
//
// Requiere en Vercel: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WA_VERIFY_TOKEN,
// SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WA_TK = process.env.WHATSAPP_TOKEN    || process.env.WA_TOKEN;
const WA_ID = process.env.WHATSAPP_PHONE_ID || process.env.WA_PHONE_ID;

// Enviar texto libre (permitido: la tienda nos escribió, hay ventana de 24h abierta)
async function sendText(to, body) {
  if (!WA_TK || !WA_ID) { console.warn('[wa-webhook] faltan credenciales'); return; }
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${WA_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TK}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    });
    const j = await r.json();
    if (j.error) console.warn('[wa-webhook] envío falló:', j.error.message);
  } catch (e) { console.error('[wa-webhook] error enviando:', e.message); }
}

// Buscar la tienda por su teléfono (comparando solo dígitos, sin importar formato)
async function findStore(fromDigits) {
  const { data } = await supabase
    .from('profiles')
    .select('id, store_name, store_phone, role')
    .not('store_phone', 'is', null);
  return (data || []).find(p => {
    const d = String(p.store_phone || '').replace(/\D/g, '');
    return d && (d === fromDigits || d.endsWith(fromDigits.slice(-10)) || fromDigits.endsWith(d.slice(-10)));
  }) || null;
}

// Estado de conversación: qué está respondiendo esta tienda ahora mismo
async function getSession(storeId) {
  const { data } = await supabase.from('wa_sessions')
    .select('*').eq('store_id', storeId).order('updated_at', { ascending: false }).limit(1);
  return (data && data[0]) || null;
}
async function setSession(storeId, patch) {
  await supabase.from('wa_sessions').upsert(
    { store_id: storeId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'store_id' }
  );
}

// Crear la cotización (misma tabla y forma que usa el portal)
async function createResponse({ requestId, storeId, type, price, message }) {
  const { error } = await supabase.from('part_responses').insert({
    request_id: requestId, store_id: storeId, response_type: type,
    price: type === 'have' ? price : null, currency: 'USD', message: message || null,
  });
  if (error) { console.warn('[wa-webhook] no se pudo crear la cotización:', error.message); return false; }

  // Avisar al dueño en la app, igual que desde el portal
  const { data: req } = await supabase.from('part_requests')
    .select('owner_id, item_name').eq('id', requestId).maybeSingle();
  const { data: store } = await supabase.from('profiles')
    .select('store_name').eq('id', storeId).maybeSingle();
  if (req?.owner_id) {
    const name = store?.store_name || 'Una tienda';
    const label = type === 'have' ? `${name} tiene el repuesto`
      : type === 'have_questions' ? `${name} respondió con preguntas`
      : `${name} no tiene el repuesto`;
    await supabase.from('notifications').insert({
      user_id: req.owner_id, type: 'part_response',
      title: 'Respuesta a tu solicitud',
      body: `${label}: ${req.item_name}`, link: 'costs',
    });
  }
  return true;
}

export default async function handler(req, res) {
  // 1) Verificación del webhook (Meta hace un GET al configurarlo)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Responder rápido a Meta (si tarda, reintenta y duplica)
  res.status(200).json({ received: true });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return;   // acuse de recibo / estado de entrega: ignorar

    const from = String(msg.from || '').replace(/\D/g, '');
    const store = await findStore(from);
    if (!store) {
      await sendText(from, 'Hola. Este número atiende a tiendas registradas en Carive. Si quieres registrar tu tienda, entra a app.carive.co');
      return;
    }

    const session = await getSession(store.id);

    // ── A) La tienda tocó un botón de la plantilla ──────────────────────────
    if (msg.type === 'button' || msg.type === 'interactive') {
      const payload = msg.button?.payload || msg.button?.text
        || msg.interactive?.button_reply?.id || msg.interactive?.button_reply?.title || '';
      const p = String(payload).toLowerCase();
      const requestId = session?.request_id;

      if (!requestId) {
        await sendText(from, 'No encontré a qué pedido corresponde. Abre app.carive.co para responderlo.');
        return;
      }

      const { data: reqRow } = await supabase.from('part_requests')
        .select('item_name, status').eq('id', requestId).maybeSingle();
      if (reqRow?.status && reqRow.status !== 'open') {
        await sendText(from, `Ese pedido ya se cerró (${reqRow.item_name}). Te avisamos cuando llegue otro.`);
        await setSession(store.id, { request_id: null, state: null });
        return;
      }

      if (p.includes('no tengo') || p.includes('dont') || p.includes('no_tengo')) {
        await createResponse({ requestId, storeId: store.id, type: 'dont_have' });
        await setSession(store.id, { request_id: null, state: null });
        await sendText(from, 'Listo, marcamos que no tienes este repuesto. Gracias por responder.');
        return;
      }
      if (p.includes('pregunt') || p.includes('question')) {
        await setSession(store.id, { request_id: requestId, state: 'awaiting_question' });
        await sendText(from, `¿Qué necesitas saber sobre "${reqRow?.item_name || 'el pedido'}"? Escríbelo y se lo hacemos llegar al cliente.`);
        return;
      }
      // Por defecto: tiene el repuesto -> pedir precio
      await setSession(store.id, { request_id: requestId, state: 'awaiting_price' });
      await sendText(from, `Perfecto. ¿En cuánto lo cotizas? Escribe solo el monto en dólares (ejemplo: 45)\n\nPuedes agregar una nota después del precio, ejemplo: 45 entrega mañana`);
      return;
    }

    // ── B) La tienda escribió un texto ──────────────────────────────────────
    if (msg.type === 'text') {
      const text = (msg.text?.body || '').trim();
      const low = text.toLowerCase();

      // Comandos rápidos, funcionen o no dentro de un pedido
      if (['pausa', 'pausar', 'stop', 'baja'].includes(low)) {
        await supabase.from('profiles').update({ store_paused: true }).eq('id', store.id);
        await sendText(from, 'Tu tienda quedó en pausa: no recibirás pedidos nuevos. Escribe ACTIVAR cuando quieras volver.');
        return;
      }
      if (['activar', 'activa', 'volver'].includes(low)) {
        await supabase.from('profiles').update({ store_paused: false }).eq('id', store.id);
        await sendText(from, 'Tu tienda está activa otra vez. Ya puedes recibir pedidos.');
        return;
      }

      if (!session?.request_id || !session?.state) {
        await sendText(from, 'Hola. Cuando llegue un pedido para tu tienda te escribimos por aquí y puedes responder al momento.\n\nComandos: PAUSA para dejar de recibir pedidos, ACTIVAR para volver.');
        return;
      }

      if (session.state === 'awaiting_question') {
        await createResponse({ requestId: session.request_id, storeId: store.id, type: 'have_questions', message: text });
        await setSession(store.id, { request_id: null, state: null });
        await sendText(from, 'Enviamos tu pregunta al cliente. Te avisamos cuando responda.');
        return;
      }

      if (session.state === 'awaiting_price') {
        // Primer número del mensaje = precio; el resto = nota
        const m = text.replace(',', '.').match(/\d+(\.\d+)?/);
        if (!m) {
          await sendText(from, 'No entendí el monto. Escribe solo el número, por ejemplo: 45');
          return;
        }
        const price = parseFloat(m[0]);
        const note = text.replace(m[0], '').replace(/^[\s$.,-]+/, '').trim();
        const ok = await createResponse({
          requestId: session.request_id, storeId: store.id,
          type: 'have', price, message: note || null,
        });
        await setSession(store.id, { request_id: null, state: null });
        await sendText(from, ok
          ? `Cotización enviada: $${price}${note ? ` (${note})` : ''}. Si el cliente te elige, te pasamos su contacto por aquí.`
          : 'No pudimos registrar la cotización. Intenta desde app.carive.co');
        return;
      }
    }
  } catch (e) {
    console.error('[wa-webhook] error:', e.message);
  }
}
