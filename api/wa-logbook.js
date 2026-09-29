// Bitácora por WhatsApp — flujo guiado paso a paso, igual que en la app.
// Solo para personal registrado en Personal (fleet_crew) con su teléfono.
// Por ahora únicamente entradas de Visita → Inspección, con una foto opcional.

const WA_TK = process.env.WHATSAPP_TOKEN || process.env.WA_TOKEN;
const WA_ID = process.env.WHATSAPP_PHONE_ID || process.env.WA_PHONE_ID;
const GRAPH = 'https://graph.facebook.com/v21.0';

// Sistemas y equipos: mismos nombres que la app, para que las entradas queden
// idénticas vengan de donde vengan. trackHours marca los que piden lectura.
export const WA_SYSTEMS = [
  { id:'motores',    label:'Motores',                   hours:'motor',
    equipment:['Motor Estribor','Motor Babor','Todos los Motores','Filtro de Combustible','Filtro de Aceite','Impeller','Correas y Poleas','Heat Exchanger','Otro'] },
  { id:'generador',  label:'Generador',                 hours:'generador',
    equipment:['Generador Principal','Filtro de Combustible','Impeller','Correas','Panel de Control','Otro'] },
  { id:'seakeeper',  label:'Seakeeper / Estabilizador', hours:'seakeeper',
    equipment:['Seakeeper','Bomba de Agua','Rodamientos','Panel de Control','Otro'] },
  { id:'casco',      label:'Casco',                     hours:null,
    equipment:['Casco','Obra Viva','Ánodos','Línea de Flotación','Bow Thruster','Otro'] },
  { id:'eje',        label:'Eje y Propela',             hours:null,
    equipment:['Hélices','Ejes','Bocinas','Timones','Otro'] },
  { id:'electrico',  label:'Sistema Eléctrico',         hours:null,
    equipment:['Baterías','Cargador','Inversor','Shore Power','Panel Eléctrico','Bombas de Achique','Otro'] },
  { id:'agua',       label:'Sistema de Agua',           hours:null,
    equipment:['Bomba de Agua Dulce','Calentador','Watermaker','Sanitario','Tanque de Aguas Negras','Otro'] },
  { id:'ac',         label:'A/C y Refrigeración',       hours:null,
    equipment:['A/C Salón','A/C Cabinas','Chiller','Bomba de Agua Salada','Nevera','Otro'] },
  { id:'navegacion', label:'Navegación y Electrónica',  hours:null,
    equipment:['GPS / Plotter','Radar','Piloto Automático','VHF','Sonda','Cámaras','Otro'] },
];

async function send(payload) {
  if (!WA_TK || !WA_ID) { console.warn('[wa-log] faltan credenciales'); return; }
  try {
    const r = await fetch(`${GRAPH}/${WA_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TK}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const j = await r.json();
    if (j.error) console.warn('[wa-log] envío falló:', j.error.message);
  } catch (e) { console.error('[wa-log] error:', e.message); }
}

export const waText = (to, body) => send({ to, type: 'text', text: { body } });

// Hasta 3 botones (límite de WhatsApp)
export const waButtons = (to, body, buttons) => send({
  to, type: 'interactive',
  interactive: {
    type: 'button', body: { text: body },
    action: { buttons: buttons.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
  },
});

// Lista desplegable: hasta 10 opciones (límite de WhatsApp)
export const waList = (to, body, buttonLabel, rows) => send({
  to, type: 'interactive',
  interactive: {
    type: 'list', body: { text: body },
    action: {
      button: buttonLabel.slice(0, 20),
      sections: [{ rows: rows.slice(0, 10).map(r => ({ id: r.id, title: r.title.slice(0, 24), description: (r.desc || '').slice(0, 72) })) }],
    },
  },
});

// Descargar una foto enviada por WhatsApp y subirla al almacenamiento del barco
export async function waPhotoToStorage(db, mediaId, vesselId) {
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${WA_TK}` } }).then(r => r.json());
    if (!meta?.url) return null;
    const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${WA_TK}` } });
    const buf = Buffer.from(await bin.arrayBuffer());
    const ext = (meta.mime_type || 'image/jpeg').split('/')[1].split(';')[0];
    const path = `${vesselId}/whatsapp/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await db.storage.from('bitacora-fotos').upload(path, buf, { contentType: meta.mime_type || 'image/jpeg' });
    if (error) { console.warn('[wa-log] subida de foto falló:', error.message); return null; }
    const { data } = db.storage.from('bitacora-fotos').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) { console.error('[wa-log] foto:', e.message); return null; }
}

// ¿Quién escribe? Solo personal registrado con teléfono en Personal.
export async function findCrew(db, fromDigits) {
  const { data, error } = await db.from('fleet_crew').select('id, name, phone, manager_id').not('phone', 'is', null);
  if (error) console.error('[wa-log] no se pudo leer Personal:', error.message);
  console.log('[wa-log] buscando', fromDigits, 'entre', (data || []).length, 'personas con teléfono:',
    (data || []).map(c => `${c.name}=${String(c.phone || '').replace(/\D/g, '')}`).join(', '));
  const last10 = fromDigits.slice(-10);
  return (data || []).find(c => {
    const d = String(c.phone || '').replace(/\D/g, '');
    return d && (d === fromDigits || d.slice(-10) === last10);
  }) || null;
}

// Los barcos del gestor al que pertenece esta persona
export async function crewVessels(db, managerId) {
  const { data: own } = await db.from('vessels').select('id, name, owner_id').eq('owner_id', managerId).order('name');
  if (own && own.length) return own;
  // Si el manager es co-gestor, los barcos son del dueño de la flota
  const { data: fm } = await db.from('fleet_managers')
    .select('fleet_owner_id').eq('manager_id', managerId).eq('status', 'active').limit(1);
  if (!fm?.[0]?.fleet_owner_id) return [];
  const { data } = await db.from('vessels').select('id, name, owner_id').eq('owner_id', fm[0].fleet_owner_id).order('name');
  return data || [];
}

// Estado de la conversación (una por teléfono). Caduca a los 30 minutos.
export async function getLogSession(db, phone) {
  const { data } = await db.from('wa_log_sessions').select('*').eq('phone', phone).maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.updated_at).getTime();
  if (age > 30 * 60 * 1000) { await db.from('wa_log_sessions').delete().eq('phone', phone); return null; }
  return data;
}
export const setLogSession = (db, phone, patch) =>
  db.from('wa_log_sessions').upsert({ phone, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'phone' });
export const clearLogSession = (db, phone) => db.from('wa_log_sessions').delete().eq('phone', phone);

// ── Flujo ────────────────────────────────────────────────────────────────────
// paso: menu → barco → sistema → equipo → descripcion → horas → foto

export async function startLogFlow(db, phone, crew) {
  await setLogSession(db, phone, { step: 'menu', crew_id: crew.id, crew_name: crew.name, data: {} });
  await waButtons(phone, `Hola ${crew.name} 👋\n¿Qué quieres hacer?`, [
    { id: 'log_start', title: 'Anotar inspección' },
    { id: 'log_cancel', title: 'Cancelar' },
  ]);
}

export async function askVessel(db, phone, vessels, sess) {
  await setLogSession(db, phone, { ...sess, step: 'barco' });
  await waList(phone, '¿En qué barco?', 'Ver barcos',
    vessels.map(v => ({ id: `v:${v.id}`, title: v.name })));
}

export async function askSystem(db, phone, sess) {
  await setLogSession(db, phone, { ...sess, step: 'sistema' });
  await waList(phone, '¿Qué sistema inspeccionaste?', 'Ver sistemas',
    WA_SYSTEMS.map(s => ({ id: `s:${s.id}`, title: s.label })));
}

export async function askEquipment(db, phone, sess, sysId) {
  const sys = WA_SYSTEMS.find(s => s.id === sysId);
  const data = { ...(sess.data || {}), system: sys.label, systemId: sys.id };
  await setLogSession(db, phone, { ...sess, step: 'equipo', data });
  await waList(phone, `${sys.label} — ¿qué equipo?`, 'Ver equipos',
    sys.equipment.map((e, i) => ({ id: `e:${i}`, title: e })));
}

export async function askDescription(db, phone, sess, equipment) {
  const data = { ...(sess.data || {}), equipment };
  await setLogSession(db, phone, { ...sess, step: 'descripcion', data });
  await waText(phone, '¿Qué encontraste?\n\nEscríbelo en un mensaje. Si viste algo que haya que atender, ponlo aquí.');
}

// Las horas solo se piden para los sistemas que las llevan, igual que en la app
export async function askHoursOrPhoto(db, phone, sess) {
  const sys = WA_SYSTEMS.find(s => s.id === sess.data?.systemId);
  if (sys?.hours) {
    await setLogSession(db, phone, { ...sess, step: 'horas' });
    const label = sys.hours === 'motor' ? 'del motor' : sys.hours === 'generador' ? 'del generador' : 'del Seakeeper';
    await waText(phone, `¿Horas ${label}? ⚙️\n\nEscribe solo el número. Si no las tienes a mano, escribe "omitir".`);
    return;
  }
  await askPhoto(db, phone, sess);
}

export async function askPhoto(db, phone, sess) {
  await setLogSession(db, phone, { ...sess, step: 'foto' });
  await waButtons(phone, '¿Quieres agregar una foto?\n\nMándala ahora, o toca Omitir.', [
    { id: 'log_skipphoto', title: 'Omitir' },
  ]);
}

// Guardar la entrada, con el mismo formato que crea la app
export async function saveLogEntry(db, phone, sess, photoUrl) {
  const d = sess.data || {};
  const { data: v } = await db.from('vessels').select('owner_id, name, details').eq('id', d.vesselId).single();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

  const { error } = await db.from('log_entries').insert({
    vessel_id: d.vesselId,
    owner_id: v?.owner_id,
    date: today,
    type: 'Visita',
    visit_types: ['Inspección'],
    system_id: d.systemId || null,
    equipment: d.equipment || null,
    description: (d.description || '').trim(),
    performed_by: sess.crew_name,
    eng_out: d.motorHours != null ? d.motorHours : null,
    gen_out: d.genHours != null ? d.genHours : null,
    sk_hours: d.skHours != null ? d.skHours : null,
    photos: photoUrl ? [photoUrl] : [],
    crew_sel: [],
  });
  if (error) { console.error('[wa-log] no se guardó:', error.message); return { ok: false, error: error.message }; }

  // Las lecturas actualizan el tablero del barco, igual que desde la app
  const patch = {};
  if (d.motorHours != null) patch.engine_hours = d.motorHours;
  if (d.genHours != null)   patch.gen_hours = d.genHours;
  if (d.skHours != null)    patch.details = { ...(v?.details || {}), seakeeper_hours: d.skHours };
  if (Object.keys(patch).length) await db.from('vessels').update(patch).eq('id', d.vesselId);

  return { ok: true, vesselName: v?.name || '' };
}
