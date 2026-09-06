// Recordatorios de documentos por vencer.
// Se ejecuta una vez al día (cron de Vercel) y avisa por WhatsApp a 30, 14 y 3 días
// del vencimiento. Cada hito se envía una sola vez: queda registrado en
// manuals.reminders_sent para que un segundo pase del cron no duplique el aviso.
import { createClient } from '@supabase/supabase-js';

const HITOS = [30, 14, 3];
const BIZ_TZ = 'America/New_York';
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BIZ_TZ }).format(new Date());

let _db = null;
const db = () => {
  if (!_db) {
    _db = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
  }
  return _db;
};

async function sendWA(to, body) {
  const TK = process.env.WHATSAPP_TOKEN || process.env.WA_TOKEN;
  const ID = process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!TK || !ID) return { ok: false, error: 'faltan credenciales' };
  const phone = String(to).replace(/[^0-9]/g, '');
  const r = await fetch(`https://graph.facebook.com/v21.0/${ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: phone, type: 'text', text: { body },
    }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, error: j?.error?.message };
}

export default async function handler(req, res) {
  const supabase = db();
  const today = todayLocal();
  const t0 = new Date(today + 'T00:00:00');

  // Documentos con vencimiento en los próximos 30 días (o ya vencidos hoy)
  const limit = new Date(t0.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const { data: docs, error } = await supabase
    .from('vessel_documents')
    .select('id, title, folder, expires_at, vessel_id, owner_id, reminders_sent')
    .not('expires_at', 'is', null)
    .lte('expires_at', limit)
    .gte('expires_at', today);
  if (error) return res.status(500).json({ error: error.message });

  const sent = [];
  for (const d of (docs || [])) {
    const days = Math.round((new Date(d.expires_at + 'T00:00:00') - t0) / 86400000);
    const hito = HITOS.find(h => h === days);
    if (hito == null) continue;

    const already = Array.isArray(d.reminders_sent) ? d.reminders_sent : [];
    if (already.includes(hito)) continue;   // ya se avisó de este hito

    // Teléfono: el del dueño de la cuenta (gestor de flota o dueño del barco)
    const { data: vessel } = await supabase
      .from('vessels').select('name, owner_id, details').eq('id', d.vessel_id).single();
    let phone = vessel?.details?.notify_phone;
    if (!phone) {
      const { data: prof } = await supabase
        .from('profiles').select('phone').eq('id', vessel?.owner_id || d.owner_id).single();
      phone = prof?.phone || null;
    }
    if (!phone) continue;

    const cuando = days === 3 ? 'en 3 días' : days === 14 ? 'en 2 semanas' : 'en 1 mes';
    const fecha = new Date(d.expires_at + 'T00:00:00').toLocaleDateString('en-US');
    const body =
      `*Documento por vencer*\n\n` +
      `${d.title}${d.folder ? ` (${d.folder})` : ''} de *${vessel?.name || 'tu embarcación'}* vence ${cuando}: ${fecha}.\n\n` +
      `Renuévalo antes de esa fecha para mantener el barco en regla.`;

    const r = await sendWA(phone, body);
    if (r.ok) {
      await supabase.from('vessel_documents')
        .update({ reminders_sent: [...already, hito] })
        .eq('id', d.id);
      sent.push({ doc: d.title, days, vessel: vessel?.name });
    }
  }

  return res.status(200).json({ checked: docs?.length || 0, sent });
}
