// Vista de SOCIO (solo lectura) — para socios de negocio como co-dueños de barcos
// específicos. Ve bitácora (con fotos), tareas, calendario y gastos SOLO de los
// barcos que el gestor le asignó. Sin botones de crear/editar/eliminar; el candado
// real está en los permisos de la base (vessel_partners + políticas de lectura).
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import CalendarPage from "./CalendarPage.jsx";
import { photoUrl, catL } from "./PaymentFields.jsx";
import { docExpiry, systemL } from "./docs.js";
import TripDetail from "./TripDetail.jsx";
import { logTypeL, visitTypeL } from "./App.jsx";

const fmtD = (d) => { if(!d) return "—"; const p=String(d).split("-"); return p.length===3?`${p[1]}/${p[2]}/${p[0]}`:d; };
const chip = (on) => ({padding:"5px 11px",borderRadius:18,cursor:"pointer",fontSize:12,fontWeight:on?700:500,
  border:`1.5px solid ${on?"#0ea5e9":"#e2e8f0"}`,background:on?"#eff6ff":"#fff",color:on?"#0369a1":"#64748b"});
const sel = {padding:"5px 9px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,color:"#334155",background:"#fff"};
const card = {background:"#f8fafc",borderRadius:10,padding:"11px 13px"};
const cardLbl = {fontSize:11,color:"#64748b",fontWeight:600};
const cardVal = {fontSize:22,fontWeight:800,color:"#0f172a",marginTop:2};
const money = (n) => "$" + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2});

export default function PartnerView({ user, onLogout }) {
  const { lang, setLang } = useLang();
  const L = (es,en)=>lang==="en"?en:es;
  const [vessels, setVessels] = useState([]);
  const [vid, setVid]         = useState(null);
  const [tab, setTab]         = useState("resumen");
  const [from, setFrom]       = useState("");        // rango por calendario
  const [to, setTo]           = useState("");
  const [typeF, setTypeF]     = useState("");        // filtro por tipo de entrada
  const [q, setQ]             = useState("");        // buscador
  const [taskF, setTaskF]     = useState("pend");    // pend | all | done
  const [catF, setCatF]       = useState("");
  const [log, setLog]         = useState([]);
  const [tasks, setTasks]     = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [openEntry, setOpenEntry] = useState(null);

  // Barcos a los que este socio tiene acceso (la política de lectura hace el filtro)
  useEffect(()=>{ (async()=>{
    const { data: links } = await supabase.from("vessel_partners")
      .select("vessel_id").eq("partner_id", user.id).eq("status","active");
    const ids = (links||[]).map(l=>l.vessel_id);
    if (!ids.length) { setLoading(false); return; }
    const { data: vs } = await supabase.from("vessels").select("*").in("id", ids).order("name");
    setVessels(vs||[]);
    setVid(vs?.[0]?.id||null);
    setLoading(false);
  })(); },[user.id]);

  // Datos del barco elegido
  useEffect(()=>{ if(!vid) return; (async()=>{
    const [{ data: lg }, { data: tk }, { data: ex }, { data: dc }] = await Promise.all([
      supabase.from("log_entries").select("*").eq("vessel_id", vid).order("date",{ascending:false}),
      supabase.from("tasks").select("*").eq("vessel_id", vid).order("next_due"),
      supabase.from("expenses").select("*").eq("vessel_id", vid).order("expense_date",{ascending:false}),
      supabase.from("vessel_documents").select("*").eq("vessel_id", vid).order("expires_at",{ascending:true,nullsFirst:false}),
    ]);
    setLog(lg||[]); setTasks(tk||[]); setExpenses(ex||[]); setDocs(dc||[]);
  })(); },[vid]);

  // Reporte imprimible de lo que el dueño ve, respetando el rango elegido.
  // No usa el generador del gestor: aquí interesa el resumen que el dueño
  // necesita para sus propios correos, no el expediente técnico completo.
  const buildReport = () => {
    const per = (from||to)
      ? `${from?fmtD(from):"—"} — ${to?fmtD(to):"—"}`
      : L("Todo el historial","All history");
    const esc = (x)=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\n/g,"<br>");
    const totF = expF.reduce((a,e)=>a+Number(e.amount||0),0);
    const byCat = {};
    expF.forEach(e=>{ byCat[e.category||"Otro"]=(byCat[e.category||"Otro"]||0)+Number(e.amount||0); });

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(vessel?.name)}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;font-size:13px;line-height:1.5;padding:36px;background:#fff}
      h1{font-size:22px;color:#0a2540;margin-bottom:2px}
      .sub{color:#64748b;font-size:13px;margin-bottom:22px}
      h2{font-size:14px;color:#0f172a;margin:22px 0 8px;padding-top:14px;border-top:1px solid #e2e8f0}
      table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px}
      th{background:#0a2540;color:#fff;text-align:left;padding:7px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
      td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
      .r{text-align:right;white-space:nowrap}
      .cards{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}
      .card{flex:1;min-width:120px;background:#f8fafc;border-radius:8px;padding:10px 12px}
      .cl{font-size:10px;color:#64748b;font-weight:600}
      .cv{font-size:19px;font-weight:800;color:#0f172a}
      @media print{@page{margin:12mm}body{padding:0}.noprint{display:none}}
    </style></head><body>
      <h1>${esc(vessel?.name)}</h1>
      <div class="sub">${L("Reporte del propietario","Owner report")} · ${per} · ${L("generado","generated")} ${new Date().toLocaleDateString("en-US")}</div>

      <div class="cards">
        <div class="card"><div class="cl">${L("Combustible","Fuel")}</div><div class="cv">${fuelPct!=null?Math.round(fuelPct)+"%":(fuelVal+" "+fuelUnit)}</div></div>
        <div class="card"><div class="cl">${L("Horas motor","Engine hours")}</div><div class="cv">${engineH!=null?engineH+"h":"—"}</div></div>
        <div class="card"><div class="cl">${L("Generador","Generator")}</div><div class="cv">${genH!=null?genH+"h":"—"}</div></div>
        <div class="card"><div class="cl">${L("Gastos del período","Period expenses")}</div><div class="cv">${money(totF)}</div></div>
      </div>

      <h2>${L("Actividad","Activity")} · ${logF.length}</h2>
      ${logF.length? `<table><thead><tr>
          <th>${L("Fecha","Date")}</th><th>${L("Tipo","Type")}</th><th>${L("Detalle","Detail")}</th><th>${L("Realizado por","By")}</th>
        </tr></thead><tbody>${logF.map(e=>`<tr>
          <td style="white-space:nowrap">${fmtD(e.date)}</td>
          <td>${esc(logTypeL(e.type,lang))}${Array.isArray(e.visit_types)&&e.visit_types.length?" · "+esc(e.visit_types.map(v=>visitTypeL(v,lang)).join(", ")):""}</td>
          <td>${e.type==="Salida"
                ? esc(`${e.dest||""} · ${e.persons||"—"}p · ${e.dept_time||"—"} → ${e.arr_time||"—"}`)
                : esc(e.description||e.item||"—")}</td>
          <td style="color:#64748b">${esc(e.performed_by||"—")}</td>
        </tr>`).join("")}</tbody></table>`
        : `<div style="color:#94a3b8">${L("Sin actividad en el período.","No activity in this period.")}</div>`}

      <h2>${L("Tareas","Tasks")} · ${tasksF.length}</h2>
      ${tasksF.length? `<table><thead><tr>
          <th>${L("Tarea","Task")}</th><th>${L("Sistema","System")}</th><th>${L("Vence","Due")}</th><th>${L("Estado","Status")}</th>
        </tr></thead><tbody>${tasksF.map(t=>{const st=tStatus(t);return `<tr>
          <td>${esc(t.name)}</td><td style="color:#64748b">${esc(systemL(t.system,lang)||"—")}</td>
          <td style="white-space:nowrap">${t.next_due?fmtD(t.next_due):"—"}</td>
          <td style="color:${st.bg==="#ef4444"?"#dc2626":"#64748b"}">${esc(st.l)}</td>
        </tr>`;}).join("")}</tbody></table>`
        : `<div style="color:#94a3b8">${L("Sin tareas.","No tasks.")}</div>`}

      <h2>${L("Gastos","Expenses")} · ${money(totF)}</h2>
      ${Object.keys(byCat).length? `<table><thead><tr><th>${L("Categoría","Category")}</th><th class="r">${L("Monto","Amount")}</th></tr></thead>
        <tbody>${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<tr><td>${esc(catL(c,lang))}</td><td class="r"><b>${money(v)}</b></td></tr>`).join("")}
        <tr style="background:#f8fafc"><td><b>${L("TOTAL","TOTAL")}</b></td><td class="r"><b>${money(totF)}</b></td></tr></tbody></table>`
        : `<div style="color:#94a3b8">${L("Sin gastos en el período.","No expenses in this period.")}</div>`}

      <div style="margin-top:24px;font-size:10px;color:#cbd5e1">Carive · ${esc(vessel?.name)}</div>
      <div class="noprint" style="position:fixed;bottom:18px;right:18px">
        <button onclick="window.print()" style="padding:12px 18px;background:linear-gradient(120deg,#2563eb,#0ea5e9);color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer">
          ${L("Imprimir / Guardar PDF","Print / Save PDF")}
        </button>
      </div>
    </body></html>`;
  };

  const openReport = () => {
    const html = buildReport();
    const w = window.open("", "_blank");
    if (!w) {
      const url = URL.createObjectURL(new Blob([html], { type:"text/html" }));
      const a = document.createElement("a");
      a.href = url; a.download = `reporte_${(vessel?.name||"barco").replace(/\s+/g,"_")}.html`; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    w.document.write(html); w.document.close();
  };

  const openDoc = async (d) => {
    if (d.kind === "link") { window.open(d.url, "_blank"); return; }
    if (!d.file_path) return;
    const { data } = await supabase.storage.from("documentos").createSignedUrl(d.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const vessel = vessels.find(v=>v.id===vid);

  // ── Filtrado compartido ────────────────────────────────────────────────────
  const inRange = (d) => {
    const x = String(d||"").slice(0,10);
    if (from && x < from) return false;
    if (to   && x > to)   return false;
    return true;
  };

  const logF = log.filter(e =>
    inRange(e.date) &&
    (!typeF   || e.type === typeF) &&
    (!q || [e.description, e.item, e.dest, e.equipment, e.performed_by]
            .filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()))
  );
  const expF = expenses.filter(e => inRange(e.expense_date) && (!catF || e.category === catF));
  const tasksF = tasks.filter(t =>
    (taskF==="all" ? true : taskF==="done" ? t.status==="done" : t.status!=="done") &&
    (!t.next_due || inRange(t.next_due)));
  const logTypes = [...new Set(log.map(e=>e.type).filter(Boolean))];
  const cats     = [...new Set(expenses.map(e=>e.category).filter(Boolean))].sort();

  // ── Resumen ────────────────────────────────────────────────────────────────
  const num = (x) => { const n = Number(x); return isNaN(n) ? null : n; };
  const normT = (t) => (typeof t === "number" ? { hours: t } : (t || {}));
  const svcNote = (cur, raw) => {
    const t = normT(raw);
    if (t.hours == null || cur == null) return null;
    const rem = Math.round((Number(t.hours) - Number(cur)) * 10) / 10;
    if (isNaN(rem)) return null;
    const f = (n) => { const a = Math.abs(n); return Number.isInteger(a) ? String(a) : a.toFixed(1); };
    if (rem < 0)  return { t: L(`vencido +${f(rem)}h`, `overdue +${f(rem)}h`), c: "#dc2626" };
    if (rem <= 50) return { t: L(`servicio en ${f(rem)}h`, `service in ${f(rem)}h`), c: "#d97706" };
    return { t: L(`servicio en ${f(rem)}h`, `service in ${f(rem)}h`), c: "#94a3b8" };
  };

  const engineH = (() => {
    const mh = Object.values(vessel?.motorHours || vessel?.details?.motor_hours || {}).map(Number).filter(n=>!isNaN(n));
    return mh.length ? Math.max(...mh) : num(vessel?.engine_hours);
  })();
  const genH  = num(vessel?.gen_hours);
  const skH   = num(vessel?.details?.seakeeper_hours);
  const targets = vessel?.details?.service_targets || {};
  const engNote = svcNote(engineH, targets["Motores"] ?? Object.values(targets)[0]);
  const genNote = svcNote(genH, targets["Generador"]);
  const skNote  = svcNote(skH,  targets["Seakeeper"]);

  const fuelVal  = num(vessel?.fuel) || 0;
  const fuelUnit = vessel?.fuel_unit || "gal";
  const tankCap  = (vessel?.details?.fuelTanks || []).reduce((a,t)=>a+(Number(t.capacity)||0), 0);
  const fuelPct  = fuelUnit === "%" ? Math.min(100, fuelVal) : (tankCap > 0 ? Math.min(100, (fuelVal/tankCap)*100) : null);

  const mKey  = new Date().toISOString().slice(0,7);
  const prevK = (()=>{ const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();
  const expMonth = expenses.filter(e=>String(e.expense_date||"").slice(0,7)===mKey);
  const expPrev  = expenses.filter(e=>String(e.expense_date||"").slice(0,7)===prevK);
  const totMonth = expMonth.reduce((a,e)=>a+Number(e.amount||0),0);
  const totPrev  = expPrev.reduce((a,e)=>a+Number(e.amount||0),0);
  const deltaPct = totPrev > 0 ? Math.round(((totMonth-totPrev)/totPrev)*100) : null;

  const salMonth = log.filter(e=>e.type==="Salida" && String(e.date||"").slice(0,7)===mKey);
  const hrsMonth = salMonth.reduce((a,e)=>{ const o=Number(e.eng_out), i=Number(e.eng_in); return (!isNaN(o)&&!isNaN(i)&&i>o)?a+(i-o):a; },0);
  const cph = hrsMonth > 0 ? totMonth/hrsMonth : null;

  const today0 = new Date(); today0.setHours(0,0,0,0);
  const overdue = tasks.filter(t=>t.status!=="done" && t.next_due && new Date(t.next_due+"T00:00:00") < today0);
  const alerts = [
    engNote?.c==="#dc2626" ? L("Motores: servicio vencido","Engines: service overdue") : null,
    genNote?.c==="#dc2626" ? L("Generador: servicio vencido","Generator: service overdue") : null,
    skNote?.c==="#dc2626"  ? L("Seakeeper: servicio vencido","Seakeeper: service overdue") : null,
    overdue.length ? L(`${overdue.length} tarea(s) vencida(s)`,`${overdue.length} overdue task(s)`) : null,
    (fuelPct!=null && fuelPct<25) ? L(`Combustible bajo (${Math.round(fuelPct)}%)`,`Low fuel (${Math.round(fuelPct)}%)`) : null,
  ].filter(Boolean);

  // Estado de tarea calculado con la fecha de hoy (igual que la app del gestor)
  const tStatus = (t) => {
    if (t.status==="done") return { l:L("Completada","Done"), bg:"#64748b", c:"#fff" };
    if (t.next_due) {
      const today=new Date(); today.setHours(0,0,0,0);
      const days=Math.round((new Date(t.next_due+"T00:00:00")-today)/86400000);
      if (days<0)  return { l:L("Vencida","Overdue"), bg:"#ef4444", c:"#fff" };
      if (days<=7) return { l:L("Esta semana","This week"), bg:"#f59e0b", c:"#fff" };
      if (days<=30)return { l:L("Próxima","Upcoming"), bg:"#fde68a", c:"#92400e" };
    }
    return { l:L("Al día","On track"), bg:"#dcfce7", c:"#166534" };
  };

  // Marca de color por tipo (sin emojis: no combinan con el resto de la interfaz)
  const logTypeColor = { Salida:"#0891b2", Compra:"#7c3aed", Combustible:"#0ea5e9", Servicio:"#2563eb", Visita:"#16a34a", Incidente:"#f59e0b" };

  // Vessel con tareas embebidas para que CalendarPage funcione en modo lectura
  const vesselForCal = vessel ? { ...vessel, tasks: tasks.map(t=>({ ...t, nextDue:t.next_due, name:t.name })) } : null;

  const expMonthTotal = totMonth;

  if (loading) return <div style={{padding:60,textAlign:"center",color:"#94a3b8"}}>{L("Cargando...","Loading...")}</div>;

  if (!vessels.length) return (
    <div style={{padding:"60px 20px",textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:700,color:"#334155"}}>{L("Aún no tienes barcos asignados","No vessels assigned yet")}</div>
      <div style={{fontSize:13,color:"#94a3b8",marginTop:6}}>{L("Pide al gestor de la flota que te asigne los barcos.","Ask the fleet manager to assign your vessels.")}</div>
      <button onClick={onLogout} style={{marginTop:16,padding:"9px 18px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",color:"#334155",fontSize:13,cursor:"pointer"}}>{L("Cerrar sesión","Log out")}</button>
    </div>
  );

  const tabBtn = (key,label)=>(
    <button key={key} onClick={()=>setTab(key)}
      style={{padding:"8px 14px",border:"none",borderBottom:tab===key?"2.5px solid #0ea5e9":"2.5px solid transparent",background:"none",fontSize:13,fontWeight:tab===key?700:500,color:tab===key?"#0369a1":"#64748b",cursor:"pointer"}}>
      {label}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"system-ui,-apple-system,sans-serif"}}>
      {/* Barra superior */}
      <div style={{background:"#0a2540",color:"#fff",padding:"12px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontSize:15,fontWeight:800}}>Carive</div>
          <div style={{fontSize:11,opacity:0.75}}>{L("Vista de dueño · solo lectura","Owner view · read only")}</div>
        </div>
        <button onClick={()=>setLang(lang==="es"?"en":"es")} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:7,color:"#fff",fontSize:11,fontWeight:700,padding:"6px 10px",cursor:"pointer"}}>{lang==="es"?"EN":"ES"}</button>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:7,color:"#fff",fontSize:11,fontWeight:600,padding:"6px 10px",cursor:"pointer"}}>{L("Salir","Log out")}</button>
      </div>

      {/* Selector de barcos */}
      <div style={{padding:"12px 18px 0",display:"flex",gap:8,flexWrap:"wrap",maxWidth:900,margin:"0 auto"}}>
        {vessels.map(v=>(
          <button key={v.id} onClick={()=>setVid(v.id)}
            style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${vid===v.id?"#0ea5e9":"#e2e8f0"}`,background:vid===v.id?"#eff6ff":"#fff",color:vid===v.id?"#0369a1":"#475569",fontSize:13,fontWeight:vid===v.id?700:500,cursor:"pointer"}}>
            {v.name}
          </button>
        ))}
      </div>

      {/* Pestañas */}
      <div style={{display:"flex",gap:2,padding:"8px 18px 0",borderBottom:"1px solid #e2e8f0",overflowX:"auto",maxWidth:900,margin:"0 auto"}}>
        {tabBtn("resumen", L("Resumen","Overview"))}
        {tabBtn("log", L("Bitácora","Logbook"))}
        {tabBtn("tasks", L("Tareas","Tasks"))}
        {tabBtn("cal", L("Calendario","Calendar"))}
        {tabBtn("costs", L("Gastos","Expenses"))}
        {tabBtn("docs", L("Documentos","Documents"))}
        {tabBtn("report", L("Reportes","Reports"))}
      </div>

      <div style={{padding:"16px 18px",maxWidth:900,margin:"0 auto"}}>

        {/* RESUMEN */}
        {tab==="resumen" && (
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:10,marginBottom:12}}>
              <div style={card}>
                <div style={cardLbl}>{L("Combustible","Fuel")}</div>
                <div style={cardVal}>{fuelPct!=null ? `${Math.round(fuelPct)}%` : `${fuelVal} ${fuelUnit}`}</div>
                {fuelPct!=null && (
                  <div style={{height:5,background:"#e2e8f0",borderRadius:3,marginTop:5}}>
                    <div style={{width:`${fuelPct}%`,height:5,borderRadius:3,background:fuelPct>50?"#16a34a":fuelPct>25?"#d97706":"#dc2626"}}/>
                  </div>
                )}
              </div>
              <div style={card}>
                <div style={cardLbl}>{L("Horas motor","Engine hours")}</div>
                <div style={cardVal}>{engineH!=null?`${engineH}h`:"—"}</div>
                {engNote && <div style={{fontSize:11,color:engNote.c,marginTop:2,fontWeight:engNote.c==="#94a3b8"?500:700}}>{engNote.t}</div>}
              </div>
              <div style={card}>
                <div style={cardLbl}>{L("Generador","Generator")}</div>
                <div style={cardVal}>{genH!=null?`${genH}h`:"—"}</div>
                {genNote && <div style={{fontSize:11,color:genNote.c,marginTop:2,fontWeight:genNote.c==="#94a3b8"?500:700}}>{genNote.t}</div>}
              </div>
              <div style={card}>
                <div style={cardLbl}>Seakeeper</div>
                <div style={cardVal}>{skH!=null?`${skH}h`:"—"}</div>
                {skNote && <div style={{fontSize:11,color:skNote.c,marginTop:2,fontWeight:skNote.c==="#94a3b8"?500:700}}>{skNote.t}</div>}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:12}}>
              <div style={card}>
                <div style={cardLbl}>{L("Gastos del mes","Month expenses")}</div>
                <div style={cardVal}>{money(totMonth)}</div>
                {deltaPct!=null && <div style={{fontSize:11,marginTop:2,color:deltaPct>0?"#dc2626":"#16a34a"}}>{deltaPct>0?"▲":"▼"} {Math.abs(deltaPct)}% {L("vs. mes anterior","vs. last month")}</div>}
              </div>
              <div style={card}>
                <div style={cardLbl}>{L("Salidas del mes","Trips this month")}</div>
                <div style={cardVal}>{salMonth.length}{hrsMonth>0?` · ${Math.round(hrsMonth*10)/10}h`:""}</div>
                {salMonth.length>0 && hrsMonth>0 && <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{L("promedio","avg")} {Math.round((hrsMonth/salMonth.length)*10)/10}h</div>}
              </div>
              <div style={card}>
                <div style={cardLbl}>{L("Costo por hora","Cost per hour")}</div>
                <div style={cardVal}>{cph!=null?`$${cph.toFixed(0)}/h`:"—"}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{cph!=null?L("gastos ÷ horas del mes","expenses ÷ month hours"):L("sin horas registradas","no hours logged")}</div>
              </div>
            </div>

            {alerts.length>0 && (
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"11px 13px",marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:"#92400e",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>{L("Requiere atención","Needs attention")}</div>
                <div style={{fontSize:12,color:"#b45309"}}>{alerts.join(" · ")}</div>
              </div>
            )}

            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>{L("Última actividad","Latest activity")}</div>
            {log.slice(0,5).length===0
              ? <div style={{fontSize:13,color:"#94a3b8"}}>{L("Sin actividad registrada.","No activity yet.")}</div>
              : <div style={{border:"1px solid #f1f5f9",borderRadius:10,overflow:"hidden"}}>
                  {log.slice(0,5).map((e,i)=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:i<4?"1px solid #f8fafc":"none"}}>
                      <div style={{width:3,alignSelf:"stretch",background:{Salida:"#0891b2",Compra:"#7c3aed",Combustible:"#0ea5e9",Servicio:"#2563eb",Visita:"#16a34a"}[e.type]||"#94a3b8"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{logTypeL(e.type,lang)}{Array.isArray(e.visit_types)&&e.visit_types.length?` · ${e.visit_types.map(v=>visitTypeL(v,lang)).join(", ")}`:""}</div>
                        <div style={{fontSize:11,color:"#94a3b8"}}>{[e.performed_by, fmtD(e.date)].filter(Boolean).join(" · ")}</div>
                      </div>
                    </div>
                  ))}
                </div>}
          </>
        )}

        {/* Filtros */}
        {(tab==="log"||tab==="costs"||tab==="tasks") && (
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={sel} title={L("Desde","From")}/>
              <span style={{fontSize:12,color:"#94a3b8"}}>→</span>
              <input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)} style={sel} title={L("Hasta","To")}/>
              {(from||to) && (
                <button onClick={()=>{setFrom("");setTo("");}} style={{background:"none",border:"none",cursor:"pointer",color:"#2563eb",fontSize:11,fontWeight:700}}>
                  {L("Todo","All")}
                </button>
              )}
            </div>

            {tab==="log" && (
              <>
                <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={sel}>
                  <option value="">{L("Todo tipo","All types")}</option>
                  {logTypes.map(t=><option key={t} value={t}>{logTypeL(t,lang)}</option>)}
                </select>
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder={L("Buscar...","Search...")} style={{...sel,minWidth:130}}/>
              </>
            )}
            {tab==="tasks" && [{k:"pend",l:L("Pendientes","Open")},{k:"done",l:L("Completadas","Done")},{k:"all",l:L("Todas","All")}].map(o=>(
              <button key={o.k} onClick={()=>setTaskF(o.k)} style={chip(taskF===o.k)}>{o.l}</button>
            ))}
            {tab==="costs" && (
              <select value={catF} onChange={e=>setCatF(e.target.value)} style={sel}>
                <option value="">{L("Toda categoría","All categories")}</option>
                {cats.map(c=><option key={c} value={c}>{catL(c,lang)}</option>)}
              </select>
            )}

            <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>
              {tab==="log"   ? `${logF.length} ${L("entradas","entries")}`
               : tab==="tasks" ? `${tasksF.length} ${L("tareas","tasks")}`
               : `${expF.length} · ${money(expF.reduce((a,e)=>a+Number(e.amount||0),0))}`}
            </span>
          </div>
        )}

        {/* BITÁCORA */}
        {tab==="log" && (
          logF.length===0
            ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Sin entradas con esos filtros.","No entries with those filters.")}</div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {logF.map(e=>(
                  <div key={e.id} style={{background:"#fff",border:"1px solid #f1f5f9",borderRadius:10,padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:logTypeColor[e.type]||"#94a3b8",flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{logTypeL(e.type,lang)}</span>
                      <span style={{fontSize:12,color:"#94a3b8"}}>{fmtD(e.date)}</span>
                      {e.performed_by && <span style={{fontSize:11,background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"2px 9px"}}>{e.performed_by}</span>}
                    </div>
                    <div style={{fontSize:13,color:"#334155",marginTop:6,lineHeight:1.5}}>
                      {e.type==="Salida"
                        ? <><span>{`${e.dest||""} · ${e.persons||"—"}p · ${e.dept_time||"—"} → ${e.arr_time||L("Pendiente","Pending")}`}</span>
                            <TripDetail e={e} lang={lang}/></>
                        : e.type==="Compra"
                          ? `${e.item||""} · ${money(e.cost_usd)}`
                          : (openEntry===e.id || (e.description||"").length<=140)
                            ? <span style={{whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{e.description||"—"}</span>
                            : <><span style={{whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{(e.description||"").slice(0,140)}…</span>{" "}
                                <button onClick={()=>setOpenEntry(e.id)} style={{background:"none",border:"none",color:"#2563eb",fontSize:12,cursor:"pointer",padding:0}}>{L("ver todo","show all")}</button>
                              </>}
                      {openEntry===e.id && (e.description||"").length>140 &&
                        <button onClick={()=>setOpenEntry(null)} style={{background:"none",border:"none",color:"#2563eb",fontSize:12,cursor:"pointer",padding:0,marginLeft:6}}>{L("ver menos","show less")}</button>}
                    </div>
                    {e.equipment && <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{L("Equipo:","Equipment:")} {e.equipment}</div>}
                    {Array.isArray(e.photos)&&e.photos.length>0 && (
                      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                        {e.photos.map((ph,i)=>(
                          <a key={i} href={photoUrl(ph)} target="_blank" rel="noreferrer">
                            <img src={photoUrl(ph)} alt="" style={{width:64,height:64,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"}}/>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
        )}

        {/* TAREAS */}
        {tab==="tasks" && (
          tasksF.length===0
            ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Sin tareas.","No tasks.")}</div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {tasksF.map(t=>{
                  const st=tStatus(t);
                  return (
                    <div key={t.id} style={{background:"#fff",border:"1px solid #f1f5f9",borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:180}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{t.name}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                          {[systemL(t.system,lang), t.equipment, t.assigned].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{t.next_due?fmtD(t.next_due):"—"}</div>
                      <span style={{fontSize:11,fontWeight:700,background:st.bg,color:st.c,borderRadius:20,padding:"3px 10px",whiteSpace:"nowrap"}}>{st.l}</span>
                    </div>
                  );
                })}
              </div>
        )}

        {/* CALENDARIO (reutiliza el de la app en modo un-barco) */}
        {tab==="cal" && vesselForCal && (
          <div>
            <CalendarPage vessel={vesselForCal} vessels={[vesselForCal]} isMobile={false}/>
          </div>
        )}

        {/* DOCUMENTOS */}
        {tab==="docs" && (
          docs.filter(d=>d.kind!=="folder").length===0
            ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Sin documentos cargados.","No documents uploaded.")}</div>
            : (()=>{
                const files = docs.filter(d=>d.kind!=="folder");
                const withExp = files.filter(d=>d.expires_at);
                const venc = withExp.filter(d=>docExpiry(d.expires_at,lang)?.days < 0).length;
                const pron = withExp.filter(d=>{const x=docExpiry(d.expires_at,lang); return x && x.days>=0 && x.days<=30;}).length;
                return (
                  <>
                    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                      <div style={{...card,flex:1,minWidth:120}}>
                        <div style={cardLbl}>{L("Documentos","Documents")}</div>
                        <div style={cardVal}>{files.length}</div>
                      </div>
                      <div style={{...card,flex:1,minWidth:120}}>
                        <div style={cardLbl}>{L("Por vencer (30d)","Expiring (30d)")}</div>
                        <div style={{...cardVal,color:pron?"#b45309":"#0f172a"}}>{pron}</div>
                      </div>
                      <div style={{...card,flex:1,minWidth:120}}>
                        <div style={cardLbl}>{L("Vencidos","Expired")}</div>
                        <div style={{...cardVal,color:venc?"#dc2626":"#16a34a"}}>{venc}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {files.map(d=>{
                        const ex = docExpiry(d.expires_at, lang);
                        return (
                          <div key={d.id} style={{background:"#fff",border:"1px solid #f1f5f9",borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                            <div style={{flex:1,minWidth:160}}>
                              <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{d.title}</div>
                              <div style={{fontSize:11,color:"#94a3b8"}}>{[d.folder, d.kind==="link"?L("Link externo","External link"):null].filter(Boolean).join(" · ")||"—"}</div>
                            </div>
                            {ex
                              ? <span style={{fontSize:11,fontWeight:700,background:ex.bg,color:ex.color,borderRadius:20,padding:"4px 11px",whiteSpace:"nowrap"}}>{ex.label}</span>
                              : <span style={{fontSize:11,color:"#cbd5e1",whiteSpace:"nowrap"}}>{L("Sin vencimiento","No expiry")}</span>}
                            <button onClick={()=>openDoc(d)}
                              style={{background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:"#2563eb",whiteSpace:"nowrap",padding:0}}>
                              {d.kind==="link" ? L("Abrir →","Open →") : L("Ver documento →","View document →")}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()
        )}

        {/* REPORTES */}
        {tab==="report" && (
          <div style={{maxWidth:520}}>
            <div style={{fontSize:15,fontWeight:800,color:"#0f172a",marginBottom:4}}>{L("Reporte del propietario","Owner report")}</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:16,lineHeight:1.6}}>
              {L("Genera un documento con la actividad, las tareas y los gastos del barco. Elige el período con las fechas de abajo y se abre listo para imprimir o guardar como PDF.",
                 "Builds a document with the vessel's activity, tasks and expenses. Pick the period below and it opens ready to print or save as PDF.")}
            </div>

            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Desde","From")}</label>
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={sel}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Hasta","To")}</label>
                <input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)} style={sel}/>
              </div>
              {(from||to) && (
                <button onClick={()=>{setFrom("");setTo("");}} style={{alignSelf:"flex-end",background:"none",border:"none",cursor:"pointer",color:"#2563eb",fontSize:11,fontWeight:700,paddingBottom:8}}>
                  {L("Todo","All")}
                </button>
              )}
            </div>

            <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:7}}>{L("Incluye","Includes")}</div>
              <div style={{fontSize:12,color:"#475569",lineHeight:1.9}}>
                • {logF.length} {L("entradas de bitácora","logbook entries")}<br/>
                • {tasksF.length} {L("tareas","tasks")}<br/>
                • {expF.length} {L("gastos","expenses")} · {money(expF.reduce((a,e)=>a+Number(e.amount||0),0))}
              </div>
            </div>

            <button onClick={openReport}
              style={{width:"100%",padding:"12px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              {L("Generar reporte","Generate report")}
            </button>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:10,lineHeight:1.5}}>
              {L("Se abre en una pestaña nueva. Desde ahí puedes imprimir o guardarlo como PDF.",
                 "Opens in a new tab. From there you can print it or save it as PDF.")}
            </div>
          </div>
        )}

        {/* GASTOS */}
        {tab==="costs" && (
          <>
            <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",gap:16,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{L("Este mes","This month")}</div>
                <div style={{fontSize:22,fontWeight:800,color:"#0f172a"}}>{money(expMonthTotal)}</div>
              </div>
              <div>
                <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{L("Movimientos","Transactions")}</div>
                <div style={{fontSize:22,fontWeight:800,color:"#0f172a"}}>{expMonth.length}</div>
              </div>
            </div>
            {expF.length===0
              ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Sin gastos registrados.","No expenses recorded.")}</div>
              : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {expF.map(e=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#fff",border:"1px solid #f1f5f9",borderRadius:9}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{catL(e.category,lang)}</div>
                        <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {[e.description, fmtD(e.expense_date)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{fontSize:14,fontWeight:800,color:"#0f172a",whiteSpace:"nowrap"}}>{money(e.amount)}</div>
                    </div>
                  ))}
                </div>}
          </>
        )}
      </div>
    </div>
  );
}
