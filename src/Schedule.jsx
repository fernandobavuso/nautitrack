import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { notifySchedule, notifyWeeklySchedule } from "./whatsapp.js";

// ─────────────────────────────────────────────────────────────
// Agenda — horario de trabajo del equipo de flota.
// Reemplaza el Excel de turnos: fecha, persona, barco, trabajo,
// horas, tarifa, total (horas × tarifa), estado y estado de pago.
// Solo para gestores de flota (plan flota).
// ─────────────────────────────────────────────────────────────

const WORK_TYPES  = ["Lavada","Detailing","Chequeo de sistemas","Limpieza interior","Buceo / Casco","Combustible","Supervisión","Reparación","Otro"];
const WORK_STATUS = ["Agendado","En proceso","Completado"];
const PAY_STATUS  = ["Pendiente","Pagado"];
const DAYS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const DAYS_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const WS_COLOR = { "Agendado":"#d97706", "En proceso":"#2563eb", "Completado":"#16a34a" };
const PS_COLOR = { "Pendiente":"#dc2626", "Pagado":"#16a34a" };

export default function Schedule({ user, vessels = [], onClose }) {
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const dayName = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return (lang === "en" ? DAYS_EN : DAYS_ES)[d.getDay()] || "";
  };

  const today = new Date().toISOString().slice(0, 10);
  const [shifts, setShifts]   = useState([]);
  const [team, setTeam]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [filterPerson, setFilterPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [form, setForm] = useState({ date: today, personName:"", vesselName:"", works:[], notes:"", hours:"", rate:"" });
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [{ data: sh }, { data: tm }] = await Promise.all([
      supabase.from("work_shifts").select("*").eq("manager_id", user.id).order("shift_date", { ascending: true }),
      supabase.from("fleet_crew").select("id,name,rate,phone").eq("manager_id", user.id).order("name"),
    ]);
    setShifts(sh || []); setTeam(tm || []); setLoading(false);
  };

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const pickPerson = (name) => {
    const p = team.find(t => t.name === name);
    setForm(f => ({ ...f, personName: name, rate: (p && p.rate != null) ? String(p.rate) : f.rate }));
  };

  const add = async () => {
    if (!form.personName.trim()) { flash(L("Elige la persona", "Pick the person")); return; }
    if (!form.date)              { flash(L("Elige la fecha", "Pick the date")); return; }
    const row = {
      manager_id:  user.id,
      person_name: form.personName.trim(),
      vessel_name: form.vesselName || null,
      shift_date:  form.date,
      description: form.works.length ? form.works.join(" + ") : null,
      notes:       form.notes.trim() || null,
      hours:       form.hours !== "" ? Number(form.hours) : null,
      rate:        form.rate  !== "" ? Number(form.rate)  : null,
      work_status:    "Agendado",
      payment_status: "Pendiente",
    };
    const { data, error } = await supabase.from("work_shifts").insert(row).select().single();
    if (error) { flash("Error: " + error.message); return; }
    setShifts(s => [...s, data].sort((a, b) => (a.shift_date > b.shift_date ? 1 : -1)));
    setForm({ date: today, personName:"", vesselName:"", works:[], notes:"", hours:"", rate:"" });
    setAdding(false);
    flash(L("Turno agendado", "Shift scheduled"));
  };

  const updateShift = async (id, patch) => {
    setShifts(s => s.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from("work_shifts").update(patch).eq("id", id);
  };

  const removeShift = async (id) => {
    if (!window.confirm(L("¿Eliminar este turno?", "Delete this shift?"))) return;
    setShifts(s => s.filter(x => x.id !== id));
    await supabase.from("work_shifts").delete().eq("id", id);
  };

  const sendSchedule = async (personName) => {
    const p = team.find(t => t.name === personName);
    if (!p || !p.phone) { flash(L("Esa persona no tiene teléfono en Personal", "That person has no phone in Staff")); return; }
    const upcoming = shifts
      .filter(x => x.person_name === personName && x.shift_date >= today)
      .sort((a, b) => (a.shift_date > b.shift_date ? 1 : -1));
    if (upcoming.length === 0) { flash(L("No hay turnos próximos para esa persona", "No upcoming shifts for that person")); return; }
    // Descripción corta de un turno (sin saltos de línea: WhatsApp los rechaza)
    const shiftText = (x, withDate) => {
      const parts = [];
      if (withDate) parts.push(new Date(x.shift_date + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es", { weekday:"short", day:"numeric", month:"short" }));
      else          parts.push(new Date(x.shift_date + "T00:00:00").toLocaleDateString(lang === "en" ? "en-US" : "es", { day:"numeric", month:"short" }));
      if (x.vessel_name) parts.push(x.vessel_name);
      if (x.description) parts.push(x.description);
      if (x.hours)       parts.push(`${x.hours}h`);
      return parts.join(" ").replace(/\s{4,}/g, "   ").trim();
    };

    // Preferido: horario semanal (una línea por día, Lun..Dom) — los 7 días próximos
    const start = new Date(today + "T00:00:00");
    const monday = new Date(start); monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const dayShifts = upcoming.filter(x => x.shift_date === key);
      days.push(dayShifts.length ? dayShifts.map(x => shiftText(x, false)).join(" + ") : L("Libre", "Off"));
    }
    let r = await notifyWeeklySchedule(p.phone, personName, days);
    if (r.ok) {
      flash(L("Horario enviado (formato semanal)", "Schedule sent (weekly format)"));
      return;
    }
    // Si la plantilla semanal falla, avisar por qué y usar la de una sola línea
    console.warn("[Carive] horario_semanal falló:", r.error, "| params:", [personName, ...days]);
    const weeklyErr = r.error || "?";
    const list = upcoming.map(x => shiftText(x, true)).join("  |  ").replace(/\s{4,}/g, "   ").trim();
    r = await notifySchedule(p.phone, personName, list);
    flash(r.ok
      ? L(`Enviado en formato simple. El semanal falló: ${weeklyErr}`, `Sent in simple format. Weekly failed: ${weeklyErr}`)
      : L("No se pudo enviar: ", "Could not send: ") + (r.error || ""));
  };

  const addDays = (dateStr, n) => {
    const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Repetir UN turno hacia las próximas N semanas
  const repeatShift = async (sh, weeks = 1) => {
    const rows = [];
    for (let w = 1; w <= weeks; w++) {
      rows.push({
        manager_id: user.id, person_name: sh.person_name, vessel_name: sh.vessel_name,
        shift_date: addDays(sh.shift_date, 7 * w), description: sh.description, notes: sh.notes,
        hours: sh.hours, rate: sh.rate, work_status: "Agendado", payment_status: "Pendiente",
      });
    }
    const { data, error } = await supabase.from("work_shifts").insert(rows).select();
    if (error) { flash("Error: " + error.message); return; }
    setShifts(x => [...x, ...(data || [])].sort((a, b) => (a.shift_date > b.shift_date ? 1 : -1)));
    flash(L(`Repetido ${weeks} semana(s)`, `Repeated ${weeks} week(s)`));
  };

  // Repetir TODOS los turnos filtrados hacia las próximas N semanas (armar la quincena de un tap)
  const repeatAll = async (weeks) => {
    if (filtered.length === 0) { flash(L("No hay turnos para repetir", "No shifts to repeat")); return; }
    const rows = [];
    filtered.forEach(sh => {
      for (let w = 1; w <= weeks; w++) {
        rows.push({
          manager_id: user.id, person_name: sh.person_name, vessel_name: sh.vessel_name,
          shift_date: addDays(sh.shift_date, 7 * w), description: sh.description, notes: sh.notes,
          hours: sh.hours, rate: sh.rate, work_status: "Agendado", payment_status: "Pendiente",
        });
      }
    });
    const { data, error } = await supabase.from("work_shifts").insert(rows).select();
    if (error) { flash("Error: " + error.message); return; }
    setShifts(x => [...x, ...(data || [])].sort((a, b) => (a.shift_date > b.shift_date ? 1 : -1)));
    setRepeatOpen(false);
    flash(L(`${rows.length} turnos creados`, `${rows.length} shifts created`));
  };

  // Exportar a CSV (mismas columnas que la hoja de cálculo)
  const exportCSV = () => {
    if (filtered.length === 0) { flash(L("No hay turnos para exportar", "Nothing to export")); return; }
    const head = ["Fecha","Día","Persona","Barco","Trabajo","Notas","Horas","Tarifa","Total","Estado","Pago"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map(s => [
      s.shift_date, dayName(s.shift_date), s.person_name, s.vessel_name || "", s.description || "", s.notes || "",
      Number(s.hours) || 0, Number(s.rate) || 0, total(s).toFixed(2),
      s.work_status || "", s.payment_status || "",
    ].map(esc).join(","));
    const totalRow = ["","","","","","", totalHours, "", grandTotal.toFixed(2), "", ""].map(esc).join(",");
    const csv = "\uFEFF" + [head.map(esc).join(","), ...rows, totalRow].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda_${filterPerson ? filterPerson.replace(/\s+/g, "_") + "_" : ""}${today}.csv`;
    a.click(); URL.revokeObjectURL(url);
    flash(L("CSV descargado", "CSV downloaded"));
  };

  const total  = (s) => (Number(s.hours) || 0) * (Number(s.rate) || 0);
  const filtered = shifts.filter(s => {
    if (filterPerson && s.person_name !== filterPerson) return false;
    if (from && s.shift_date < from) return false;
    if (to   && s.shift_date > to)   return false;
    return true;
  });
  const grandTotal = filtered.reduce((a, s) => a + total(s), 0);
  const totalHours = filtered.reduce((a, s) => a + (Number(s.hours) || 0), 0);
  const byPerson = {};
  filtered.forEach(s => {
    const k = s.person_name;
    if (!byPerson[k]) byPerson[k] = { hours: 0, total: 0 };
    byPerson[k].hours += Number(s.hours) || 0;
    byPerson[k].total += total(s);
  });

  const people = team.map(t => t.name);

  return (
    <div style={ov} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>

        {/* Cabecera */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 22px",borderBottom:"1px solid #e2e8f0"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>{L("Agenda de trabajo", "Work schedule")}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2,lineHeight:1.5}}>
              {L("Programa los turnos de tu equipo: fecha, barco, trabajo, horas y pago.", "Plan your team's shifts: date, boat, work, hours and pay.")}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
        </div>

        <div style={{padding:22,overflowY:"auto"}}>
          {msg && <div style={{background:"#f0fdf4",color:"#15803d",padding:"9px 12px",borderRadius:8,fontSize:12,marginBottom:14}}>{msg}</div>}

          {/* Botón agregar */}
          {!adding && (
            <button onClick={() => setAdding(true)} style={{width:"100%",padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:16}}>
              ＋ {L("Agendar turno", "Schedule shift")}
            </button>
          )}

          {/* Formulario */}
          {adding && (
            <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0a2540",marginBottom:12}}>{L("Nuevo turno", "New shift")}</div>

              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Fecha", "Date")} *</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} style={inp}/>
                  {form.date && <div style={{fontSize:11,color:"#64748b",marginTop:3}}>{dayName(form.date)}</div>}
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Persona", "Person")} *</label>
                  <select value={form.personName} onChange={e => pickPerson(e.target.value)} style={inp}>
                    <option value="">{L("Elegir...", "Choose...")}</option>
                    {people.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Barco", "Vessel")}</label>
                  <select value={form.vesselName} onChange={e => setForm({...form, vesselName:e.target.value})} style={inp}>
                    <option value="">{L("Elegir...", "Choose...")}</option>
                    {vessels.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Trabajo (puedes elegir varios)", "Work (pick one or more)")}</label>
                  {form.works.length > 0 && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6}}>
                      {form.works.map(w => (
                        <span key={w} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#eff6ff",color:"#1e40af",border:"1px solid #bfdbfe",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:600}}>
                          {w}
                          <button type="button" onClick={()=>setForm(f=>({...f,works:f.works.filter(x=>x!==w)}))} style={{background:"none",border:"none",color:"#1e40af",cursor:"pointer",fontSize:15,lineHeight:1,padding:0}}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select value="" onChange={e=>{const v=e.target.value; if(v&&!form.works.includes(v)) setForm(f=>({...f,works:[...f.works,v]})); e.target.value="";}} style={inp}>
                    <option value="">{form.works.length ? L("＋ Agregar otro...","＋ Add another...") : L("Elegir...","Choose...")}</option>
                    {WORK_TYPES.filter(w=>!form.works.includes(w)).map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>

              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Horas", "Hours")}</label>
                  <input type="number" value={form.hours} onChange={e => setForm({...form, hours:e.target.value})} placeholder="Ej: 5" style={inp}/>
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Tarifa/hora ($)", "Rate/hr ($)")}</label>
                  <input type="number" value={form.rate} onChange={e => setForm({...form, rate:e.target.value})} placeholder="Ej: 25" style={inp}/>
                </div>
              </div>

              <div>
                <label style={lbl}>{L("Notas (opcional)", "Notes (optional)")}</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={2}
                  placeholder={L("Ej: llevar cera nueva, el dueño llega a las 3pm...", "e.g. bring new wax, owner arrives at 3pm...")}
                  style={{...inp, resize:"vertical", fontFamily:"inherit"}}/>
              </div>

              {(form.hours && form.rate) ? (
                <div style={{marginTop:10,padding:"8px 12px",background:"#eff6ff",borderRadius:8,fontSize:13,color:"#1e40af",fontWeight:700}}>
                  {L("Total", "Total")}: ${((Number(form.hours)||0)*(Number(form.rate)||0)).toLocaleString("en-US",{maximumFractionDigits:2})}
                  <span style={{fontWeight:400,color:"#64748b"}}> ({form.hours}h × ${form.rate})</span>
                </div>
              ) : null}

              <div style={{display:"flex",gap:8,marginTop:14}}>
                <button onClick={() => { setAdding(false); }} style={{flex:1,padding:"10px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:9,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>{L("Cancelar", "Cancel")}</button>
                <button onClick={add} style={{flex:1,padding:"10px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{L("Agendar", "Schedule")}</button>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)} style={{...inp,flex:1,minWidth:120,marginTop:0}}>
              <option value="">{L("Todas las personas", "All people")}</option>
              {people.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} title={L("Desde","From")} style={{...inp,width:140,marginTop:0}}/>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} title={L("Hasta","To")} style={{...inp,width:140,marginTop:0}}/>
          </div>

          {filterPerson && (
            <button onClick={() => sendSchedule(filterPerson)} style={{width:"100%",padding:"10px",background:"#f0fdf4",border:"1.5px solid #16a34a",borderRadius:9,color:"#15803d",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:14}}>
              📱 {L(`Enviar horario a ${filterPerson}`, `Send schedule to ${filterPerson}`)}
            </button>
          )}

          {/* Acciones sobre lo filtrado */}
          {filtered.length > 0 && (
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={() => setRepeatOpen(o => !o)} style={actBtn}>🔁 {L("Repetir","Repeat")}</button>
              <button onClick={exportCSV} style={actBtn}>⬇️ {L("Exportar CSV","Export CSV")}</button>
            </div>
          )}

          {/* Panel de repetición */}
          {repeatOpen && (
            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0369a1",marginBottom:4}}>{L("Repetir estos turnos","Repeat these shifts")}</div>
              <div style={{fontSize:12,color:"#0c4a6e",lineHeight:1.5,marginBottom:10}}>
                {L(`Se copiarán los ${filtered.length} turnos mostrados a las próximas semanas, mismo día de la semana.`,
                   `The ${filtered.length} shifts shown will be copied to the coming weeks, same weekday.`)}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("¿Cuántas semanas?","How many weeks?")}</label>
                  <select value={repeatWeeks} onChange={e => setRepeatWeeks(Number(e.target.value))} style={inp}>
                    <option value={1}>{L("1 semana","1 week")}</option>
                    <option value={2}>{L("2 semanas (quincena)","2 weeks")}</option>
                    <option value={3}>{L("3 semanas","3 weeks")}</option>
                    <option value={4}>{L("4 semanas (mes)","4 weeks")}</option>
                  </select>
                </div>
                <button onClick={() => repeatAll(repeatWeeks)} style={{padding:"10px 18px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                  {L("Crear","Create")}
                </button>
              </div>
            </div>
          )}

          {/* Resumen de totales */}
          {filtered.length > 0 && (
            <div style={{background:"#0a2540",borderRadius:12,padding:"14px 16px",marginBottom:14,color:"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,opacity:.7,fontWeight:700,letterSpacing:"0.05em"}}>{L("TOTAL DEL PERÍODO", "PERIOD TOTAL")}</div>
                  <div style={{fontSize:24,fontWeight:800,marginTop:2}}>${grandTotal.toLocaleString("en-US",{maximumFractionDigits:2})}</div>
                </div>
                <div style={{textAlign:"right",fontSize:12,opacity:.85}}>
                  <div>{totalHours} {L("horas","hours")}</div>
                  <div>{filtered.length} {L("turnos","shifts")}</div>
                </div>
              </div>
              {Object.keys(byPerson).length > 1 && (
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.15)",fontSize:12}}>
                  {Object.entries(byPerson).map(([name, d]) => (
                    <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",opacity:.9}}>
                      <span>{name} · {d.hours}h</span>
                      <span style={{fontWeight:700}}>${d.total.toLocaleString("en-US",{maximumFractionDigits:2})}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lista de turnos */}
          {loading ? (
            <div style={{textAlign:"center",padding:30,color:"#94a3b8",fontSize:13}}>{L("Cargando...", "Loading...")}</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:"center",padding:"36px 20px",color:"#94a3b8"}}>
              <div style={{fontSize:34,marginBottom:8}}>🗓️</div>
              <div style={{fontWeight:600,fontSize:14,color:"#64748b"}}>{L("No hay turnos", "No shifts")}</div>
              <div style={{fontSize:12,marginTop:4}}>{L("Agenda el primer turno de tu equipo.", "Schedule your team's first shift.")}</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filtered.map(s => (
                <div key={s.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"13px 15px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{s.person_name}</div>
                      <div style={{fontSize:12,color:"#64748b",marginTop:1}}>
                        {new Date(s.shift_date+"T00:00:00").toLocaleDateString(lang==="en"?"en-US":"es",{day:"numeric",month:"short"})} · {dayName(s.shift_date)}
                        {s.vessel_name && <> · <span style={{color:"#2563eb",fontWeight:600}}>{s.vessel_name}</span></>}
                      </div>
                      {s.description && <div style={{fontSize:12,color:"#475569",marginTop:3}}>{s.description}</div>}
                      {s.notes && <div style={{fontSize:11,color:"#94a3b8",marginTop:2,fontStyle:"italic"}}>{s.notes}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>${total(s).toLocaleString("en-US",{maximumFractionDigits:2})}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{Number(s.hours)||0}h × ${Number(s.rate)||0}</div>
                    </div>
                  </div>
                  {/* Estados editables */}
                  <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
                    <select value={s.work_status||"Agendado"} onChange={e => updateShift(s.id,{work_status:e.target.value})}
                      style={{fontSize:11,fontWeight:700,padding:"4px 8px",borderRadius:20,border:"none",cursor:"pointer",color:"#fff",background:WS_COLOR[s.work_status]||"#d97706"}}>
                      {WORK_STATUS.map(w => <option key={w} value={w} style={{color:"#0f172a",background:"#fff"}}>{w}</option>)}
                    </select>
                    <select value={s.payment_status||"Pendiente"} onChange={e => updateShift(s.id,{payment_status:e.target.value})}
                      style={{fontSize:11,fontWeight:700,padding:"4px 8px",borderRadius:20,border:`1.5px solid ${PS_COLOR[s.payment_status]||"#dc2626"}`,cursor:"pointer",color:PS_COLOR[s.payment_status]||"#dc2626",background:"#fff"}}>
                      {PAY_STATUS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={() => repeatShift(s, 1)} title={L("Repetir la próxima semana","Repeat next week")} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#2563eb",fontSize:12,fontWeight:600}}>🔁 {L("Repetir","Repeat")}</button>
                    <button onClick={() => removeShift(s.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:14}}>{L("Eliminar","Delete")}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ov  = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:20};
const box = {background:"#fff",borderRadius:18,maxWidth:640,width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
const actBtn = {flex:1,padding:"9px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:9,color:"#475569",fontSize:13,fontWeight:700,cursor:"pointer"};
const lbl = {display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:5,marginTop:10};
const inp = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none"};
