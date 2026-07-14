// /api/checkin.js
// Endpoint público — maneja check-in/out de tripulación via QR
// No requiere auth. Guarda en crew_logs y notifica al dueño por WhatsApp.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://shwdahlvrjgcnzmlygaa.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — obtener info del vessel para mostrar en página QR
  if (req.method === 'GET') {
    const { vesselId } = req.query;
    if (!vesselId) return res.status(400).json({ error: 'vesselId requerido' });

    const { data: vessel, error } = await supabase
      .from('vessels')
      .select('id, name, type, marina, captain, details')
      .eq('id', vesselId)
      .single();

    if (error || !vessel) return res.status(404).json({ error: 'Embarcación no encontrada' });

    // Último log para saber si ya hay alguien con checkin activo
    const { data: lastLogs } = await supabase
      .from('crew_logs')
      .select('crew_name, crew_role, action, timestamp')
      .eq('vessel_id', vesselId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Roster del equipo del dueño/gestor (para que elija su nombre en vez de escribirlo)
    const { data: vesselOwner } = await supabase
      .from('vessels').select('owner_id').eq('id', vesselId).single();

    let roster = [];
    if (vesselOwner?.owner_id) {
      const { data: team } = await supabase
        .from('fleet_crew')
        .select('id, name, role')
        .eq('manager_id', vesselOwner.owner_id)
        .order('name');
      roster = team || [];
    }

    // Tareas pendientes de esta embarcación (para que las complete al salir)
    const { data: vesselTasks } = await supabase
      .from('vessels').select('tasks').eq('id', vesselId).single();

    const pendingTasks = (vesselTasks?.tasks || [])
      .filter(t => t.status !== 'done')
      .map(t => ({
        id: t.id,
        task: t.task || t.name || '',
        system: t.system || '',
        equipment: t.equipment || '',
        assignedTo: t.assignedTo || t.assigned || '',
        status: t.status || 'pending',
      }));

    return res.status(200).json({
      vessel: { id: vessel.id, name: vessel.name, type: vessel.type, marina: vessel.marina, captain: vessel.captain },
      recentLogs: lastLogs || [],
      roster,
      pendingTasks,
    });
  }

  // POST — registrar check-in o check-out
  if (req.method === 'POST') {
    const { vesselId, crewName, crewRole, action, locationNote, notes, taskId } = req.body;

    if (!vesselId || !crewName || !action) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (!['checkin', 'checkout'].includes(action)) {
      return res.status(400).json({ error: 'Acción inválida' });
    }
    // Al salir, los comentarios son obligatorios: queremos saber qué se hizo
    if (action === 'checkout' && !String(notes || '').trim()) {
      return res.status(400).json({ error: 'Al hacer check-out debes escribir qué hiciste.' });
    }

    // 1. Guardar en crew_logs
    const { data: log, error: logError } = await supabase
      .from('crew_logs')
      .insert({
        vessel_id:     vesselId,
        crew_name:     crewName.trim(),
        crew_role:     crewRole || 'Marinero',
        action,
        location_note: locationNote || '',
        notes:         notes || '',
        notified:      false,
      })
      .select()
      .single();

    if (logError) return res.status(500).json({ error: logError.message });

    // 1.b Si al salir se marcó una tarea, completarla y dejar constancia en la bitácora
    let completedTask = null;
    if (action === 'checkout' && taskId) {
      const { data: v } = await supabase
        .from('vessels').select('tasks, log').eq('id', vesselId).single();

      const tasks = v?.tasks || [];
      const idx = tasks.findIndex(t => String(t.id) === String(taskId));

      if (idx !== -1) {
        completedTask = tasks[idx].task || tasks[idx].name || 'Tarea';
        tasks[idx] = {
          ...tasks[idx],
          status: 'done',
          completedAt: new Date().toISOString(),
          completedBy: crewName.trim(),
          completionNotes: String(notes || '').trim(),
        };

        // Registrar en la bitácora del barco
        const logEntry = {
          id: Date.now(),
          type: 'Servicio',
          item: completedTask,
          desc: String(notes || '').trim(),
          date: new Date().toISOString().slice(0, 10),
          performedBy: crewName.trim(),
          photos: [],
          fromCheckout: true,
        };

        await supabase
          .from('vessels')
          .update({ tasks, log: [...(v?.log || []), logEntry] })
          .eq('id', vesselId);
      }
    }

    // 2. Obtener datos del vessel y teléfono del dueño
    const { data: vessel } = await supabase
      .from('vessels')
      .select('name, marina, details')
      .eq('id', vesselId)
      .single();

    const notifyPhone = vessel?.details?.notify_phone;

    // 3. Enviar WhatsApp si hay teléfono configurado
    if (notifyPhone && process.env.WA_TOKEN && process.env.WA_PHONE_ID) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateStr = now.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' });

      const actionEmoji = action === 'checkin' ? '✅' : '🔴';
      const actionText  = action === 'checkin' ? 'CHECK-IN'  : 'CHECK-OUT';

      const message = `${actionEmoji} *NautiTrack — ${actionText}*\n\n` +
        `👤 ${crewName} (${crewRole || 'Marinero'})\n` +
        `🚢 ${vessel?.name || 'Tu embarcación'}\n` +
        `📍 ${vessel?.marina || ''}\n` +
        `🕐 ${timeStr} · ${dateStr}` +
        (locationNote ? `\n📝 "${locationNote}"` : '');

      try {
        await fetch(`https://graph.facebook.com/v21.0/${process.env.WA_PHONE_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WA_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: notifyPhone.replace(/[^0-9]/g, ''),
            type: 'text',
            text: { body: message },
          }),
        });

        // Marcar como notificado
        await supabase.from('crew_logs').update({ notified: true }).eq('id', log.id);
      } catch(e) {
        console.error('WhatsApp error:', e);
      }
    }

    return res.status(200).json({ success: true, log, completedTask });
  }

  return res.status(405).end();
}