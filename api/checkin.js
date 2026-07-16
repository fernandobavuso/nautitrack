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
      .select('crew_name, crew_role, action, timestamp, task_id')
      .eq('vessel_id', vesselId)
      .order('timestamp', { ascending: false })
      .limit(20);

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

    // Tareas pendientes de esta embarcación (tabla `tasks` real)
    const { data: taskRows } = await supabase
      .from('tasks')
      .select('id, name, system_name, equipment, assigned, status')
      .eq('vessel_id', vesselId)
      .order('created_at');

    const pendingTasks = (taskRows || [])
      .filter(t => t.status !== 'done')
      .map(t => ({
        id: t.id,
        task: t.name || '',
        system: t.system_name || '',
        equipment: t.equipment || '',
        assignedTo: t.assigned || '',
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
    const { vesselId, crewName, crewRole, action, locationNote, notes, taskId, taskName } = req.body;

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
        task_id:       taskId || null,
        notified:      false,
      })
      .select()
      .single();

    if (logError) return res.status(500).json({ error: logError.message });

    // 1.b Si al salir se marcó una tarea, completarla (tabla `tasks`) y registrar en la bitácora (`log_entries`)
    let completedTask = null;
    if (action === 'checkout' && taskId) {
      const { data: taskRow } = await supabase
        .from('tasks')
        .select('id, name, system_id, system_name, equipment, owner_id')
        .eq('id', taskId)
        .single();

      if (taskRow) {
        completedTask = taskRow.name || 'Tarea';

        // Marcar la tarea como completada
        await supabase
          .from('tasks')
          .update({ status: 'done' })
          .eq('id', taskId);

        // Dejar constancia en la bitácora del barco
        await supabase.from('log_entries').insert({
          vessel_id:    vesselId,
          owner_id:     taskRow.owner_id,
          date:         new Date().toISOString().slice(0, 10),
          type:         'Servicio',
          system_id:    taskRow.system_id || null,
          equipment:    taskRow.equipment || null,
          description:  String(notes || '').trim(),
          performed_by: crewName.trim(),
          item:         completedTask,
          photos:       [],
        });
      }
    }

    // 1.c Conectar con la Agenda: mover el estado del turno agendado
    try {
      const { data: v2 } = await supabase.from('vessels').select('owner_id, name').eq('id', vesselId).single();
      if (v2?.owner_id) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: todayShifts } = await supabase
          .from('work_shifts')
          .select('id, person_name, vessel_name, work_status')
          .eq('manager_id', v2.owner_id)
          .eq('shift_date', today);
        const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const cn = norm(crewName);
        const match = (todayShifts || []).find(sh => {
          const pn = norm(sh.person_name);
          const nameOk = pn === cn || pn.includes(cn) || cn.includes(pn);
          const vesselOk = !sh.vessel_name || norm(sh.vessel_name) === norm(v2.name);
          return nameOk && vesselOk;
        });
        if (match) {
          if (action === 'checkin' && match.work_status !== 'Completado') {
            await supabase.from('work_shifts').update({ work_status: 'En proceso' }).eq('id', match.id);
          } else if (action === 'checkout') {
            await supabase.from('work_shifts').update({ work_status: 'Completado' }).eq('id', match.id);
          }
        }
      }
    } catch (e) { /* no romper el check-in si la agenda falla */ }

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
        (taskName ? `\n📋 Tarea: ${taskName}` : '') +
        (action === 'checkout' && notes ? `\n📝 "${notes}"` : (locationNote ? `\n📝 "${locationNote}"` : ''));

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