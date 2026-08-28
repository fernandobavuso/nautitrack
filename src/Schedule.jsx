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
  const [editShift, setEditShift] = useState(null);   // turno en edición
  const [showCut, setShowCut]     = useState(false);
  const [cutCopied, setCutCopied] = useState("");
  const [payingAll, setPayingAll] = useState(false);
  const [filterPerson, setFilterPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [form, setForm] = useState({ date: today, personName:"", vesselName:"", works:[], notes:"", hours:"", rate:"", payMode:"hora" });
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [{ data: sh }, { data: tm }] = await Promise.all([
      supabase.from("work_shifts").select("*").eq("manager_id", user.id).order("shift_date", { ascending: true }),
      supabase.from("fleet_crew").select("id,name,rate,phone").eq("manager_id", user.id).order("name"),
    ]);
    // Los turnos creados desde Tareas (task_id) solo cuentan si la persona está
    // registrada en Personal: la Agenda es del equipo, no del dueño ni de terceros
    // sueltos. Lo agregado directo en la Agenda (sin task_id) se muestra siempre.
    const teamNames = new Set((tm||[]).map(t=>(t.name||"").trim().toLowerCase()));
    const visible = (sh||[]).filter(x => !x.task_id || teamNames.has((x.person_name||"").trim().toLowerCase()));
    setShifts(visible); setTeam(tm || []); setLoading(false);
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
      works:       form.works,
      description: form.works.length ? form.works.join(" + ") : null,
      notes:       form.notes.trim() || null,
      // "hora": horas × tarifa. "flat": el precio va en rate y hours queda vacío
      // (el pago y el gasto de empresa ya calculan: horas×tarifa, o la tarifa sola).
      hours:       form.payMode==="flat" ? null : (form.hours !== "" ? Number(form.hours) : null),
      rate:        form.rate  !== "" ? Number(form.rate)  : null,
      work_status:    "Agendado",
      payment_status: "Pendiente",
    };
    const { data, error } = await supabase.from("work_shifts").insert(row).select().single();
    if (error) { flash("Error: " + error.message); return; }
    setShifts(s => [...s, data].sort((a, b) => (a.shift_date > b.shift_date ? 1 : -1)));
    setForm({ date: today, personName:"", vesselName:"", works:[], notes:"", hours:"", rate:"", payMode:"hora" });
    setAdding(false);
    flash(L("Turno agendado", "Shift scheduled"));
  };

  // Trabajos que cuentan como servicio de limpieza (categoría "Limpiezas");
  // el resto del personal se registra como "Sueldos".
  const CLEAN_WORKS = ["Lavada","Detailing","Limpieza interior","Buceo / Casco"];

  // Trabajos de un turno: el campo works si existe; para turnos viejos (que solo
  // guardaban el texto "Lavada + Detailing" en description) se derivan de ahí.
  const shiftWorks = (sh) =>
    (Array.isArray(sh.works) && sh.works.length)
      ? sh.works
      : String(sh.description||"").split(" + ").map(x=>x.trim()).filter(Boolean);

  // horas × tarifa; si no hay horas (precio fijo), el total es la tarifa sola
  const total  = (s) => (Number(s.hours) > 0 && Number(s.rate) > 0)
    ? Number(s.hours) * Number(s.rate)
    : (Number(s.rate) || 0);

  // Trabajo de agenda → tipo de visita de bitácora (los que tienen equivalente)
  const WORK_TO_VISIT = {
    "Lavada":"Lavada", "Detailing":"Detailing", "Limpieza interior":"Limpieza interior",
    "Buceo / Casco":"Buceo / Casco", "Combustible":"Combustible",
    "Chequeo de sistemas":"Inspección", "Supervisión":"Supervisión de técnico",
  };

  const updateShift = async (id, patch) => {
    const before = shifts.find(x => x.id === id);
    setShifts(s => s.map(x => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from("work_shifts").update(patch).eq("id", id);
    if (error) { flash("Error: " + error.message); return; }

    // Al marcar PAGADO, el turno se vuelve un gasto de la empresa (Mi Empresa).
    // Al volver a Pendiente, se retira ese gasto para no dejar datos falsos.
    if (patch.payment_status === "Pagado" && before?.payment_status !== "Pagado") {
      const sh = { ...before, ...patch };
      const amount = (Number(sh.hours)>0 && Number(sh.rate)>0) ? Number(sh.hours)*Number(sh.rate)
                   : Number(sh.rate)>0 ? Number(sh.rate) : null;
      if (amount === null) {
        flash(L("Pagado. Ponle tarifa (y horas) al turno para registrarlo como gasto de empresa.",
                "Paid. Add a rate (and hours) to the shift to log it as a company expense."));
        return;
      }
      const wlist = shiftWorks(sh);
      const works = wlist.length ? wlist.join(", ") : L("Servicio","Service");
      const isClean = wlist.some(w => CLEAN_WORKS.includes(w));
      // Bajo la empresa compartida: si quien paga es co-gestor, el gasto vive con el
      // dueño de la flota, igual que en Mi Empresa.
      const { data: fm } = await supabase.from("fleet_managers")
        .select("fleet_owner_id").eq("manager_id", user.id).eq("status","active").limit(1);
      const companyOwner = fm?.[0]?.fleet_owner_id || user.id;
      const { error: expErr } = await supabase.from("company_expenses").insert({
        owner_id: companyOwner, shift_id: id,
        category: isClean ? "Limpiezas" : "Sueldos",
        description: `${works}${sh.vessel_name ? ` — ${sh.vessel_name}` : ""}`,
        payee: sh.person_name || null,
        amount, currency: "USD", expense_date: sh.shift_date, recurring: false,
      });
      if (expErr) {
        if (!/duplicate|unique/i.test(expErr.message)) flash("Error: " + expErr.message);
      } else {
        flash(L(`Pagado y registrado en Mi Empresa: $${amount.toFixed(2)}`,
                `Paid and logged in My Company: $${amount.toFixed(2)}`));
      }
    }
    if (patch.payment_status === "Pendiente" && before?.payment_status === "Pagado") {
      await supabase.from("company_expenses").delete().eq("shift_id", id);
    }

    // Al marcar COMPLETADO, el trabajo queda registrado en la bitácora del barco,
    // como si se hubiera anotado directo ahí (Visita con sus tipos, persona y fecha).
    if (patch.work_status === "Completado" && before?.work_status !== "Completado") {
      const sh = { ...before, ...patch };
      const v = vessels.find(x => x.name === sh.vessel_name);
      if (!v) { flash(L("Completado. (No encontré el barco para anotarlo en bitácora)","Done. (Couldn't find the vessel to log it)")); return; }
      if (sh.log_entry_id) return;   // ya tiene su entrada
      const wlist = shiftWorks(sh);
      const vTypes = [...new Set(wlist.map(w=>WORK_TO_VISIT[w]).filter(Boolean))];
      const desc = [
        wlist.length ? wlist.join(", ") : null,
        sh.notes || null,
        L("Registrado desde la Agenda","Logged from the Schedule"),
      ].filter(Boolean).join(" · ");
      const { data: le, error: leErr } = await supabase.from("log_entries").insert({
        vessel_id: v.id, owner_id: v.owner_id,
        date: sh.shift_date, type: "Visita",
        visit_types: vTypes.length ? vTypes : ["Supervisión de técnico"],
        description: desc, performed_by: sh.person_name || null,
        photos: [], crew_sel: [],
      }).select().single();
      if (leErr) { flash(L("Completado, pero no se pudo anotar en bitácora: ","Done, but couldn't log it: ")+leErr.message); return; }
      await supabase.from("work_shifts").update({ log_entry_id: le.id }).eq("id", id);
      setShifts(list=>list.map(x=>x.id===id?{...x,log_entry_id:le.id}:x));
      flash(L(`Completado y anotado en la bitácora de ${v.name}.`,`Done and logged in ${v.name}'s logbook.`));
    }
    if (patch.work_status && patch.work_status !== "Completado" && before?.work_status === "Completado" && before?.log_entry_id) {
      await supabase.from("log_entries").delete().eq("id", before.log_entry_id);
      await supabase.from("work_shifts").update({ log_entry_id: null }).eq("id", id);
      setShifts(list=>list.map(x=>x.id===id?{...x,log_entry_id:null}:x));
    }
  };

  // Corte de nómina: lo pendiente por persona (trabajo completado, pago pendiente)
  const cutRows = (() => {
    const pend = shifts.filter(s => s.payment_status !== "Pagado" && s.work_status === "Completado");
    const by = {};
    pend.forEach(s => {
      const k = s.person_name || "—";
      if (!by[k]) by[k] = { person:k, shifts:[], total:0, hours:0 };
      by[k].shifts.push(s); by[k].total += total(s); by[k].hours += Number(s.hours)||0;
    });
    return Object.values(by).sort((a,b)=>b.total-a.total);
  })();
  const cutTotal = cutRows.reduce((a,r)=>a+r.total,0);

  const payPerson = async (row) => {
    if (!confirm(L(`¿Marcar como pagados los ${row.shifts.length} turnos de ${row.person} ($${row.total.toFixed(2)})?`,
                   `Mark ${row.person}'s ${row.shifts.length} shifts as paid ($${row.total.toFixed(2)})?`))) return;
    setPayingAll(true);
    for (const sh of row.shifts) {
      await updateShift(sh.id, { payment_status: "Pagado" });   // cada uno crea su gasto de empresa
    }
    setPayingAll(false);
    flash(L(`${row.person} queda en cero.`, `${row.person} is settled.`));
  };

  const saveShiftEdit = async () => {
    const e = editShift;
    if (!e.person_name?.trim()) { flash(L("Falta la persona","Person is required")); return; }
    const patch = {
      shift_date: e.shift_date, person_name: e.person_name, vessel_name: e.vessel_name || null,
      works: e.works || [], description: (e.works||[]).length ? (e.works||[]).join(" + ") : null,
      notes: e.notes || null,
      hours: e.payMode==="flat" ? null : (e.hours!==""&&e.hours!=null ? Number(e.hours) : null),
      rate:  e.rate!==""&&e.rate!=null ? Number(e.rate) : null,
    };
    const { data, error } = await supabase.from("work_shifts").update(patch).eq("id", e.id).select();
    if (error || !data?.length) { flash("Error: "+(error?.message||L("no se guardó","not saved"))); return; }
    setShifts(list=>list.map(x=>x.id===e.id?{...x,...data[0]}:x));
    setEditShift(null);
    flash(L("Turno actualizado.","Shift updated."));
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
      if (withDate) parts.push(new Date(x.shift_date + "T00:00:00").toLocaleDateString("en-US", { weekday:"short", day:"numeric", month:"short" }));
      else          parts.push(new Date(x.shift_date + "T00:00:00").toLocaleDateString("en-US", { day:"numeric", month:"short" }));
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
        shift_date: addDays(sh.shift_date, 7 * w), works: sh.works ?? null, description: sh.description, notes: sh.notes,
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
          shift_date: addDays(sh.shift_date, 7 * w), works: sh.works ?? null, description: sh.description, notes: sh.notes,
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

  // horas × tarifa; si no hay horas (precio fijo), el total es la tarifa sola
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
    <div style={ov}>
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

          {/* Corte de nómina: trabajos completados aún sin pagar */}
          {cutRows.length>0 && (
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"13px 15px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:170}}>
                <div style={{fontSize:11,color:"#15803d",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase"}}>{L("Por pagar al equipo","To pay the team")}</div>
                <div style={{fontSize:12,color:"#166534",marginTop:2}}>
                  {cutRows.length} {cutRows.length===1?L("persona","person"):L("personas","people")} · {cutRows.reduce((a,r)=>a+r.shifts.length,0)} {L("turnos completados","completed shifts")}
                </div>
              </div>
              <div style={{fontSize:24,fontWeight:800,color:"#15803d"}}>${cutTotal.toLocaleString("en-US",{maximumFractionDigits:2})}</div>
              <button onClick={()=>setShowCut(true)}
                style={{padding:"8px 14px",background:"#16a34a",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                {L("Hacer corte","Payroll cut")}
              </button>
            </div>
          )}

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

              <div>
                <label style={lbl}>{L("Pago", "Pay")}</label>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  {[{k:"hora",l:L("Por hora","Hourly")},{k:"flat",l:L("Precio fijo","Flat rate")}].map(m=>(
                    <button key={m.k} type="button" onClick={()=>setForm(f=>({...f,payMode:m.k}))}
                      style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${form.payMode===m.k?"#2563eb":"#e2e8f0"}`,background:form.payMode===m.k?"#eff6ff":"#fff",color:form.payMode===m.k?"#1e40af":"#64748b",fontSize:12,fontWeight:form.payMode===m.k?700:500,cursor:"pointer"}}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {form.payMode==="hora" ? (
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
                ) : (
                  <div>
                    <label style={lbl}>{L("Precio por el trabajo ($)", "Price for the job ($)")}</label>
                    <input type="number" value={form.rate} onChange={e => setForm({...form, rate:e.target.value})} placeholder="Ej: 150" style={inp}/>
                  </div>
                )}
              </div>

              <div>
                <label style={lbl}>{L("Notas (opcional)", "Notes (optional)")}</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={2}
                  placeholder={L("Ej: llevar cera nueva, el dueño llega a las 3pm...", "e.g. bring new wax, owner arrives at 3pm...")}
                  style={{...inp, resize:"vertical", fontFamily:"inherit"}}/>
              </div>

              {(form.payMode==="flat" && form.rate) ? (
                <div style={{marginTop:10,padding:"8px 12px",background:"#eff6ff",borderRadius:8,fontSize:13,color:"#1e40af",fontWeight:700}}>
                  {L("Total", "Total")}: ${Number(form.rate).toLocaleString("en-US",{maximumFractionDigits:2})}
                  <span style={{fontWeight:400,color:"#64748b"}}> ({L("precio fijo","flat rate")})</span>
                </div>
              ) : (form.hours && form.rate) ? (
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
                        {new Date(s.shift_date+"T00:00:00").toLocaleDateString("en-US",{day:"numeric",month:"short"})} · {dayName(s.shift_date)}
                        {s.vessel_name && <> · <span style={{color:"#2563eb",fontWeight:600}}>{s.vessel_name}</span></>}
                      </div>
                      {s.description && <div style={{fontSize:12,color:"#475569",marginTop:3}}>{s.description}</div>}
                      {s.notes && <div style={{fontSize:11,color:"#94a3b8",marginTop:2,fontStyle:"italic"}}>{s.notes}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>${total(s).toLocaleString("en-US",{maximumFractionDigits:2})}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{(Number(s.hours)>0) ? `${Number(s.hours)}h × $${Number(s.rate)||0}` : (Number(s.rate)>0 ? `$${Number(s.rate)} ${L("fijo","flat")}` : "—")}</div>
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
                    <button onClick={() => setEditShift({ ...s, works: shiftWorks(s), payMode: (Number(s.hours)>0 ? "hora" : "flat"), hours: s.hours ?? "", rate: s.rate ?? "" })}
                      title={L("Editar turno","Edit shift")}
                      style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#64748b",fontSize:13,fontWeight:600}}>✎ {L("Editar","Edit")}</button>
                    <button onClick={() => repeatShift(s, 1)} title={L("Repetir la próxima semana","Repeat next week")} style={{background:"none",border:"none",cursor:"pointer",color:"#2563eb",fontSize:12,fontWeight:600}}>🔁 {L("Repetir","Repeat")}</button>
                    <button onClick={() => removeShift(s.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:14}}>{L("Eliminar","Delete")}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editar turno */}
      {editShift && (
        <div onClick={e=>e.stopPropagation()} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2100,padding:14,overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:440,width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{flex:1,fontSize:16,fontWeight:800,color:"#0f172a"}}>{L("Editar turno","Edit shift")}</div>
              <button onClick={()=>setEditShift(null)} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Fecha","Date")}</label>
                  <input type="date" value={editShift.shift_date} onChange={e=>setEditShift(x=>({...x,shift_date:e.target.value}))} style={{...inp,width:"100%"}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Persona","Person")}</label>
                  <input list="edit-people" value={editShift.person_name||""} onChange={e=>setEditShift(x=>({...x,person_name:e.target.value}))} style={{...inp,width:"100%"}}/>
                  <datalist id="edit-people">{team.map(t=><option key={t.id} value={t.name}/>)}</datalist>
                </div>
              </div>

              <div>
                <label style={lbl}>{L("Barco","Vessel")}</label>
                <select value={editShift.vessel_name||""} onChange={e=>setEditShift(x=>({...x,vessel_name:e.target.value}))} style={{...inp,width:"100%"}}>
                  <option value="">{L("Sin barco","No vessel")}</option>
                  {vessels.map(v=><option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>

              <div>
                <label style={lbl}>{L("Trabajos","Works")}</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {WORK_TYPES.map(w=>{
                    const on=(editShift.works||[]).includes(w);
                    return (
                      <button key={w} type="button" onClick={()=>setEditShift(x=>({...x,works:on?x.works.filter(y=>y!==w):[...(x.works||[]),w]}))}
                        style={{padding:"6px 11px",borderRadius:18,border:`1.5px solid ${on?"#2563eb":"#e2e8f0"}`,background:on?"#eff6ff":"#fff",color:on?"#1e40af":"#64748b",fontSize:11,fontWeight:on?700:400,cursor:"pointer"}}>
                        {on?"✓ ":""}{w}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={lbl}>{L("Pago","Pay")}</label>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  {[{k:"hora",l:L("Por hora","Hourly")},{k:"flat",l:L("Precio fijo","Flat rate")}].map(m=>(
                    <button key={m.k} type="button" onClick={()=>setEditShift(x=>({...x,payMode:m.k}))}
                      style={{flex:1,padding:"7px",borderRadius:8,border:`1.5px solid ${editShift.payMode===m.k?"#2563eb":"#e2e8f0"}`,background:editShift.payMode===m.k?"#eff6ff":"#fff",color:editShift.payMode===m.k?"#1e40af":"#64748b",fontSize:12,fontWeight:editShift.payMode===m.k?700:500,cursor:"pointer"}}>
                      {m.l}
                    </button>
                  ))}
                </div>
                {editShift.payMode==="hora" ? (
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1}}><label style={lbl}>{L("Horas","Hours")}</label>
                      <input type="number" value={editShift.hours} onChange={e=>setEditShift(x=>({...x,hours:e.target.value}))} style={{...inp,width:"100%"}}/></div>
                    <div style={{flex:1}}><label style={lbl}>{L("Tarifa/hora ($)","Rate/hr ($)")}</label>
                      <input type="number" value={editShift.rate} onChange={e=>setEditShift(x=>({...x,rate:e.target.value}))} style={{...inp,width:"100%"}}/></div>
                  </div>
                ) : (
                  <div><label style={lbl}>{L("Precio por el trabajo ($)","Price for the job ($)")}</label>
                    <input type="number" value={editShift.rate} onChange={e=>setEditShift(x=>({...x,rate:e.target.value}))} style={{...inp,width:"100%"}}/></div>
                )}
              </div>

              <div>
                <label style={lbl}>{L("Notas","Notes")}</label>
                <input value={editShift.notes||""} onChange={e=>setEditShift(x=>({...x,notes:e.target.value}))} style={{...inp,width:"100%"}}/>
              </div>

              {editShift.payment_status==="Pagado" && (
                <div style={{fontSize:11,color:"#b45309",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 10px"}}>
                  {L("Este turno ya está pagado. Si cambias el monto, corrige también el gasto en Mi Empresa.","This shift is already paid. If you change the amount, fix the expense in My Company too.")}
                </div>
              )}

              <button onClick={saveShiftEdit}
                style={{padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                {L("Guardar cambios","Save changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corte de nómina por persona */}
      {showCut && (
        <div onClick={e=>{ e.stopPropagation(); setShowCut(false); }} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2100,padding:14}}>
          <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:560,width:"100%",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{L("Corte de pagos al equipo","Team payroll cut")}</div>
                <div style={{fontSize:12,color:"#64748b",marginTop:2}}>
                  {L("Trabajos completados que aún no se han pagado.","Completed work not yet paid.")}
                </div>
              </div>
              <button onClick={()=>setShowCut(false)} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
              {cutRows.map(row=>(
                <div key={row.person} style={{border:"1px solid #e2e8f0",borderRadius:10,padding:"11px 13px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:150}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{row.person}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>
                        {row.shifts.length} {row.shifts.length===1?L("turno","shift"):L("turnos","shifts")}{row.hours>0?` · ${row.hours}h`:""}
                      </div>
                    </div>
                    <div style={{fontSize:18,fontWeight:800,color:"#0f172a"}}>${row.total.toLocaleString("en-US",{maximumFractionDigits:2})}</div>
                    <button onClick={()=>payPerson(row)} disabled={payingAll}
                      style={{padding:"7px 13px",background:"#16a34a",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",opacity:payingAll?0.6:1}}>
                      ✓ {L("Pagado","Paid")}
                    </button>
                  </div>
                  <div style={{marginTop:7,paddingTop:7,borderTop:"1px dashed #f1f5f9"}}>
                    {row.shifts.map(sh=>(
                      <div key={sh.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",padding:"2px 0"}}>
                        <span>{new Date(sh.shift_date+"T00:00:00").toLocaleDateString("en-US",{day:"numeric",month:"short"})} · {sh.vessel_name} · {shiftWorks(sh).join(", ")||L("Servicio","Service")}</span>
                        <span style={{fontWeight:600}}>${total(sh).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f0fdf4",borderRadius:10,padding:"11px 14px",marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:700,color:"#166534"}}>{L("Total del corte","Cut total")}</span>
              <span style={{fontSize:20,fontWeight:800,color:"#15803d"}}>${cutTotal.toLocaleString("en-US",{maximumFractionDigits:2})}</span>
            </div>

            <button onClick={()=>{
              const txt=[
                `${L("Corte de pagos","Payroll cut")} — ${new Date().toLocaleDateString("en-US")}`,"",
                ...cutRows.map(r=>`${r.person}: $${r.total.toFixed(2)} (${r.shifts.length} ${L("turnos","shifts")})`),
                "", `${L("TOTAL","TOTAL")}: $${cutTotal.toFixed(2)}`,
              ].join("\n");
              navigator.clipboard?.writeText(txt).then(()=>{setCutCopied("y");setTimeout(()=>setCutCopied(""),2000);});
            }} style={{width:"100%",padding:"10px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:9,color:"#334155",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {cutCopied ? `✓ ${L("Copiado","Copied")}` : L("Copiar resumen","Copy summary")}
            </button>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:8,lineHeight:1.5}}>
              {L("Al marcar Pagado, esos turnos salen del corte y se registran como gasto en Mi Empresa.","Marking Paid removes those shifts from the cut and logs them as expenses in My Company.")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ov  = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:20};
const box = {background:"#fff",borderRadius:18,maxWidth:640,width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
const actBtn = {flex:1,padding:"9px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:9,color:"#475569",fontSize:13,fontWeight:700,cursor:"pointer"};
const lbl = {display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:5,marginTop:10};
const inp = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none"};
