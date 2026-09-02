// /api/checkin.js
// Endpoint público — maneja check-in/out de tripulación via QR
// No requiere auth. Guarda en crew_logs y notifica al dueño por WhatsApp.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://shwdahlvrjgcnzmlygaa.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

// El servidor corre en UTC, pero la operación es en Miami: después de las 8 PM
// locales, toISOString() ya devuelve el día siguiente y los turnos del día no se
// encontrarían. Todas las fechas "de hoy" se calculan en la zona del negocio.
const BIZ_TZ = 'America/New_York';
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BIZ_TZ }).format(new Date());

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
        .select('id, name, role, pin')
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

    // Turnos AGENDADOS para hoy en este barco (aún sin completar): la lavada de
    // John vive aquí, no en `tasks`, y debe poder cerrarse desde el check-out.
    const todayStr = todayLocal();
    const { data: shiftRows } = await supabase
      .from('work_shifts')
      .select('id, person_name, vessel_name, works, description, shift_date, work_status, hours, rate')
      .eq('vessel_name', vessel.name)
      .eq('shift_date', todayStr);

    const todayShifts = (shiftRows || [])
      .filter(s => s.work_status !== 'Completado')
      .map(s => ({
        id: s.id,
        person: s.person_name || '',
        works: (Array.isArray(s.works) && s.works.length)
          ? s.works
          : String(s.description || '').split(' + ').map(x => x.trim()).filter(Boolean),
        date: s.shift_date,
      }));

    // Sin PIN válido no se entrega información operativa: el QR está pegado en el
    // barco y cualquiera podría escanearlo. Solo el nombre del barco y la lista de
    // nombres (para elegir quién eres) son públicos.
    const pin  = String(req.query.pin || '').trim();
    const who  = String(req.query.who || '').trim().toLowerCase();
    const authed = !!pin && (roster || []).some(r =>
      String(r.pin || '') === pin && (!who || String(r.name || '').toLowerCase() === who));

    const publicRoster = (roster || []).map(r => ({ id: r.id, name: r.name, role: r.role }));

    if (!authed) {
      return res.status(200).json({
        vessel: { id: vessel.id, name: vessel.name },
        roster: publicRoster,
        needsPin: true,
      });
    }

    return res.status(200).json({
      vessel: { id: vessel.id, name: vessel.name, type: vessel.type, marina: vessel.marina, captain: vessel.captain },
      recentLogs: lastLogs || [],
      roster: publicRoster,
      pendingTasks,
      todayShifts,
      needsPin: false,
    });
  }

  // POST — registrar check-in o check-out
  if (req.method === 'POST') {
    const { vesselId, crewName, crewRole, action, locationNote, notes, taskId, taskName, pin, logEntry } = req.body;

    // El PIN también se valida al escribir: sin él, cualquiera con el QR podría
    // registrar movimientos o anotar en la bitácora del barco.
    {
      const { data: vOwner } = await supabase.from('vessels').select('owner_id').eq('id', vesselId).single();
      if (!vOwner?.owner_id) return res.status(400).json({ error: 'Embarcación no encontrada' });
      const { data: crewRow } = await supabase
        .from('fleet_crew').select('name, pin').eq('manager_id', vOwner.owner_id);
      const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const ok = (crewRow || []).some(c => String(c.pin || '') === String(pin || '').trim() && norm(c.name) === norm(crewName));
      if (!ok) return res.status(401).json({ error: 'PIN incorrecto' });
    }

    // Anotación directa de bitácora desde el QR (sin check-in/out)
    if (action === 'logbook') {
      const { data: vOwn } = await supabase.from('vessels').select('owner_id, name').eq('id', vesselId).single();
      const le = logEntry || {};
      const { error: lErr } = await supabase.from('log_entries').insert({
        vessel_id:    vesselId,
        owner_id:     vOwn?.owner_id,
        date:         le.date || todayLocal(),
        type:         'Visita',
        visit_types:  Array.isArray(le.visitTypes) && le.visitTypes.length ? le.visitTypes : ['Inspección'],
        description:  String(le.description || '').trim(),
        performed_by: crewName.trim(),
        equipment:    le.equipment || null,
        eng_out:      le.engHours != null && le.engHours !== '' ? Number(le.engHours) : null,
        gen_out:      le.genHours != null && le.genHours !== '' ? Number(le.genHours) : null,
        sk_hours:     le.skHours  != null && le.skHours  !== '' ? Number(le.skHours)  : null,
        fuel_qty:     le.fuelQty  != null && le.fuelQty  !== '' ? Number(le.fuelQty)  : null,
        fuel_unit:    le.fuelUnit || null,
        photos:       [],
        crew_sel:     [],
      });
      if (lErr) return res.status(500).json({ error: lErr.message });

      // Las lecturas actualizan el tablero del barco
      const patch = {};
      if (le.fuelQty !== '' && le.fuelQty != null) patch.fuel = Number(le.fuelQty);
      if (le.fuelUnit) patch.fuel_unit = le.fuelUnit;
      if (le.engHours !== '' && le.engHours != null) patch.engine_hours = Number(le.engHours);
      if (le.genHours !== '' && le.genHours != null) patch.gen_hours = Number(le.genHours);
      if (Object.keys(patch).length) {
        if (le.skHours !== '' && le.skHours != null) {
          const { data: cur } = await supabase.from('vessels').select('details').eq('id', vesselId).single();
          patch.details = { ...(cur?.details || {}), seakeeper_hours: Number(le.skHours) };
        }
        await supabase.from('vessels').update(patch).eq('id', vesselId);
      }
      return res.status(200).json({ ok: true, logged: true });
    }

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
          date:         todayLocal(),
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
    let shiftDone = null;
    try {
      const { data: v2 } = await supabase.from('vessels').select('owner_id, name').eq('id', vesselId).single();
      if (v2?.owner_id) {
        const today = todayLocal();
        // Se busca por BARCO y FECHA, no por manager_id: un co-gestor (p. ej. Joana)
        // crea el turno con SU id, y filtrar por el dueño lo dejaría fuera.
        const { data: todayShifts } = await supabase
          .from('work_shifts')
          .select('id, person_name, vessel_name, work_status, works, description, log_entry_id')
          .eq('vessel_name', v2.name)
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

            // El trabajo agendado (una lavada, por ejemplo) también queda en la
            // bitácora del barco, con los comentarios del check-out. Sin esto, el
            // turno se completaba pero no dejaba rastro en el historial.
            if (!match.log_entry_id) {
              const works = (Array.isArray(match.works) && match.works.length)
                ? match.works
                : String(match.description || '').split(' + ').map(x => x.trim()).filter(Boolean);
              const WORK_TO_VISIT = {
                'Lavada':'Lavada', 'Detailing':'Detailing', 'Limpieza interior':'Limpieza interior',
                'Buceo / Casco':'Buceo / Casco', 'Combustible':'Combustible',
                'Chequeo de sistemas':'Inspección', 'Supervisión':'Supervisión de técnico',
              };
              const vTypes = [...new Set(works.map(w => WORK_TO_VISIT[w]).filter(Boolean))];
              const desc = [
                works.length ? works.join(', ') : null,
                String(notes || '').trim() || null,
                'Registrado desde el check-out (QR)',
              ].filter(Boolean).join(' · ');
              const { data: le } = await supabase.from('log_entries').insert({
                vessel_id:    vesselId,
                owner_id:     v2.owner_id,
                date:         today,
                type:         'Visita',
                visit_types:  vTypes.length ? vTypes : ['Supervisión de técnico'],
                description:  desc,
                performed_by: crewName.trim(),
                photos:       [],
                crew_sel:     [],
              }).select().single();
              if (le?.id) await supabase.from('work_shifts').update({ log_entry_id: le.id }).eq('id', match.id);
            }
            shiftDone = (Array.isArray(match.works) && match.works.length)
              ? match.works.join(', ')
              : String(match.description || '').split(' + ')[0] || null;
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

    // Teléfono de alertas: el del barco si lo definieron; si no, el del perfil del dueño
    let notifyPhone = vessel?.details?.notify_phone;
    if (!notifyPhone) {
      const { data: v3 } = await supabase.from('vessels').select('owner_id').eq('id', vesselId).single();
      if (v3?.owner_id) {
        const { data: prof } = await supabase.from('profiles').select('phone').eq('id', v3.owner_id).maybeSingle();
        notifyPhone = prof?.phone || null;
      }
    }

    // 3. Enviar WhatsApp si hay teléfono configurado
    const WA_TK = process.env.WHATSAPP_TOKEN    || process.env.WA_TOKEN;
    const WA_ID = process.env.WHATSAPP_PHONE_ID || process.env.WA_PHONE_ID;

    if (notifyPhone && WA_TK && WA_ID) {
      // El servidor corre en UTC: sin zona horaria explícita el aviso llegaba con
      // 4 horas de adelanto respecto a la hora real de Miami.
      const now = new Date();
      const TZ = 'America/New_York';
      const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ });
      const dateStr = now.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });

      const actionEmoji = action === 'checkin' ? '✅' : '🔴';
      const actionText  = action === 'checkin' ? 'CHECK-IN'  : 'CHECK-OUT';
      const detail = (action === 'checkout' && notes) ? notes : (locationNote || '');

      const message = `${actionEmoji} *Carive — ${actionText}*\n\n` +
        `👤 ${crewName} (${crewRole || 'Marinero'})\n` +
        `🚢 ${vessel?.name || 'Tu embarcación'}\n` +
        `📍 ${vessel?.marina || ''}\n` +
        `🕐 ${timeStr} · ${dateStr}` +
        (taskName ? `\n📋 Tarea: ${taskName}` : '') +
        (shiftDone ? `\n🧽 Trabajo: ${shiftDone}` : '') +
        (detail ? `\n📝 "${detail}"` : '');

      const to  = notifyPhone.replace(/[^0-9]/g, '');
      const url = `https://graph.facebook.com/v21.0/${WA_ID}/messages`;
      const hdr = { 'Authorization': `Bearer ${WA_TK}`, 'Content-Type': 'application/json' };

      // WhatsApp solo permite texto libre dentro de la ventana de 24h, así que se
      // intenta primero con plantilla aprobada (llega siempre) y si falla, texto libre.
      // Parámetros sin saltos de línea (Meta los rechaza).
      const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 200) || '—';
      const tplParams = [
        clean(vessel?.name || 'Tu embarcación'),                 // {{1}} barco
        clean(action === 'checkin' ? 'Check-in' : 'Check-out'),  // {{2}} movimiento
        clean(crewName),                                         // {{3}} persona
        clean(`${timeStr} · ${dateStr}`),                        // {{4}} hora
        clean([shiftDone, taskName, detail].filter(Boolean).join(' · ') || 'Sin detalle'), // {{5}} detalle
      ];

      let sent = false;
      try {
        const r = await fetch(url, {
          method: 'POST', headers: hdr,
          body: JSON.stringify({
            messaging_product: 'whatsapp', to, type: 'template',
            template: {
              name: 'checkin_aviso',
              language: { code: 'es' },
              components: [{ type: 'body', parameters: tplParams.map(t => ({ type: 'text', text: t })) }],
            },
          }),
        });
        const j = await r.json();
        if (j.error) console.warn('[checkin] plantilla checkin_aviso falló:', j.error.message);
        else sent = true;
      } catch (e) { console.error('[checkin] error plantilla:', e.message); }

      if (!sent) {
        try {
          const r2 = await fetch(url, {
            method: 'POST', headers: hdr,
            body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
          });
          const j2 = await r2.json();
          if (j2.error) console.warn('[checkin] texto libre falló:', j2.error.message);
          else sent = true;
        } catch (e) { console.error('[checkin] error texto:', e.message); }
      }

      if (sent) await supabase.from('crew_logs').update({ notified: true }).eq('id', log.id);
    } else if (notifyPhone) {
      console.warn('[checkin] no hay WHATSAPP_TOKEN/WHATSAPP_PHONE_ID configurados en el entorno');
    }

    return res.status(200).json({ success: true, log, completedTask });
  }

  return res.status(405).end();
}