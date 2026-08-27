import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { hasFeature, PremiumLock } from "./plans.jsx";

// Vista consolidada de toda la flota
export default function FleetPage({ vessels, vessel, user, setVesselId, setPage, setShowProfile }) {
  const [showFleetReport, setShowFleetReport] = useState(false);
  const [frFrom, setFrFrom] = useState(()=>{ const d=new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [frTo, setFrTo]     = useState(new Date().toISOString().slice(0,10));
  const [frBusy, setFrBusy] = useState(false);
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const [costs, setCosts] = useState({}); // {vesselId: {usd, ves}}
  const [loading, setLoading] = useState(true);

  // La vista abarca TODA la flota: basta con que alguna embarcación tenga el plan Flota
  const allowed = (vessels || []).some(v => hasFeature(v, "multiFleet")) || hasFeature(vessel, "multiFleet");

  useEffect(() => { if (allowed) loadCosts(); }, []);

  const loadCosts = async () => {
    const ids = vessels.map(v=>v.id);
    if (!ids.length) { setLoading(false); return; }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const { data } = await supabase.from("expenses")
      .select("vessel_id,amount,currency,expense_date").in("vessel_id", ids)
      .gte("expense_date", monthStart);
    const map = {};
    (data||[]).forEach(e => {
      if (!map[e.vessel_id]) map[e.vessel_id] = { usd:0, ves:0 };
      if (e.currency==="USD") map[e.vessel_id].usd += Number(e.amount);
      else map[e.vessel_id].ves += Number(e.amount);
    });
    setCosts(map);
    setLoading(false);
  };

  if (!allowed) {
    return <div style={{padding:"40px 20px"}}><PremiumLock feature="Vista de Flota" plan="fleet" onUpgrade={()=>setShowProfile&&setShowProfile(true)}/></div>;
  }

  // Totales consolidados del mes
  let totalUSD=0, totalVES=0, totalAlerts=0;
  vessels.forEach(v => {
    const c = costs[v.id]||{usd:0,ves:0};
    totalUSD += c.usd; totalVES += c.ves;
    totalAlerts += (v.tasks||[]).filter(t=>t.status==="overdue").length;
  });

  // Próximo servicio por horas/fecha del barco (motores, generador, Seakeeper).
  // Rojo si está vencido, a <=20h o a <=30 días; si no, comentario gris con lo que
  // falta para el más cercano.
  const svcSummary = (v) => {
    const norm = (t)=> typeof t==="number" ? {hours:t} : (t||{});
    const targets = v.serviceTargets || {};
    const mh = v.motorHours || {};
    const items = [];
    Object.entries(targets).forEach(([key, raw]) => {
      const t = norm(raw);
      let cur = null;
      if (key === "Generador") cur = v.genHours;
      else if (key === "Seakeeper") cur = v.seakeeperHours;
      else cur = mh[key] != null ? mh[key] : v.engineHours;   // motores por etiqueta
      if (t.hours!=null && cur!=null) {
        const rem = Math.round((Number(t.hours)-Number(cur))*10)/10;
        if (!isNaN(rem)) items.push({ label:key, kind:"h", rem });
      }
      if (t.date) {
        const today=new Date(); today.setHours(0,0,0,0);
        const days = Math.round((new Date(t.date+"T00:00:00")-today)/86400000);
        items.push({ label:key, kind:"d", rem: days });
      }
    });
    if (!items.length) return null;
    // urgencia: vencido primero, luego el que menos margen tiene (20h ≈ 30d en escala)
    const score = (it)=> it.rem<0 ? -1000+it.rem : (it.kind==="h" ? it.rem/20 : it.rem/30);
    items.sort((a,b)=>score(a)-score(b));
    const w = items[0];
    const lbl = w.label==="Generador" ? L("Generador","Generator") : w.label;
    const fmtH = (n)=>{ const a=Math.abs(n); return Number.isInteger(a)?String(a):a.toFixed(1); };
    if (w.rem < 0) return { color:"#dc2626", text: w.kind==="h"
      ? `⚠ ${lbl}: ${L("servicio vencido","service overdue")} +${fmtH(w.rem)}h`
      : `⚠ ${lbl}: ${L("servicio vencido hace","service overdue by")} ${Math.abs(w.rem)}d` };
    if ((w.kind==="h" && w.rem<=20) || (w.kind==="d" && w.rem<=30)) return { color:"#dc2626", text: w.kind==="h"
      ? `⚠ ${lbl}: ${L("servicio en","service in")} ${fmtH(w.rem)}h`
      : `⚠ ${lbl}: ${L("servicio en","service in")} ${w.rem}d` };
    return { color:"#64748b", text: w.kind==="h"
      ? `${L("Próx. servicio","Next service")}: ${lbl} ${L("en","in")} ${fmtH(w.rem)}h`
      : `${L("Próx. servicio","Next service")}: ${lbl} ${L("en","in")} ${w.rem}d` };
  };

  // ── Reporte de Flota: todos los barcos juntos para planificar ahead ─────────
  const generateFleetReport = async () => {
    setFrBusy(true);
    try {
      const ids = vessels.map(v=>v.id);
      const [{ data: exps }, { data: tks }, { data: logs }] = await Promise.all([
        supabase.from("expenses").select("vessel_id,amount,category,expense_date,reimbursable,reimbursed").in("vessel_id", ids),
        supabase.from("tasks").select("vessel_id,name,system,next_due,status,assigned").in("vessel_id", ids),
        supabase.from("log_entries").select("vessel_id,date,type,eng_out,eng_in").in("vessel_id", ids),
      ]);
      const fD = new Date(frFrom+"T00:00:00"), tD = new Date(frTo+"T23:59:59");
      const inP = (d)=>{ if(!d) return false; const x=new Date(d+"T00:00:00"); return x>=fD && x<=tD; };
      const fmtD2 = (d)=>{ const p=String(d||"").split("-"); return p.length===3?`${p[1]}/${p[2]}/${p[0]}`:d; };
      const money2 = (n)=>"$"+Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0});
      const today0 = new Date(); today0.setHours(0,0,0,0);
      const r1 = (n)=>Math.round(n*10)/10;

      const rows = vessels.map(v=>{
        const ve = (exps||[]).filter(e=>e.vessel_id===v.id && inP(e.expense_date));
        const vl = (logs||[]).filter(e=>e.vessel_id===v.id && inP(e.date));
        const sal = vl.filter(e=>e.type==="Salida");
        const hrs = sal.reduce((a,e)=>{ const o=Number(e.eng_out),i2=Number(e.eng_in); return (!isNaN(o)&&!isNaN(i2)&&i2>o)?a+(i2-o):a; },0);
        const vt = (tks||[]).filter(t=>t.vessel_id===v.id);
        const over = vt.filter(t=>t.status!=="done"&&t.next_due&&new Date(t.next_due+"T00:00:00")<today0).length;
        const reimb = (exps||[]).filter(e=>e.vessel_id===v.id&&e.reimbursable&&!e.reimbursed).reduce((a,e)=>a+Number(e.amount||0),0);
        const svc = svcSummary(v);
        return { v, total: ve.reduce((a,e)=>a+Number(e.amount||0),0), exps: ve, sal: sal.length, hrs, over, reimb, svc };
      });
      const fleetTotal = rows.reduce((a,r)=>a+r.total,0);
      const byCat = {};
      rows.forEach(r=>r.exps.forEach(e=>{ byCat[e.category||"Otro"]=(byCat[e.category||"Otro"]||0)+Number(e.amount||0); }));
      const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

      // Agenda ahead 60 días: tareas + servicios por fecha
      const in60 = (d)=>{ if(!d) return false; const x=new Date(d+"T00:00:00"); const lim=new Date(today0.getTime()+60*86400000); return x>=today0 && x<=lim; };
      const agenda = [];
      (tks||[]).filter(t=>t.status!=="done"&&in60(t.next_due)).forEach(t=>{
        const vn = vessels.find(v=>v.id===t.vessel_id)?.name||"";
        agenda.push({ date:t.next_due, vessel:vn, what:t.name, who:t.assigned||"—", kind:"Tarea" });
      });
      vessels.forEach(v=>{
        const norm=(x)=>typeof x==="number"?{hours:x}:(x||{});
        Object.entries(v.serviceTargets||{}).forEach(([k,raw])=>{
          const t=norm(raw);
          if (t.date && in60(t.date)) agenda.push({ date:t.date, vessel:v.name, what:`Servicio: ${k}`, who:"—", kind:"Servicio" });
        });
      });
      agenda.sort((a,b)=>String(a.date).localeCompare(String(b.date)));

      const tRow = (r,i)=>`<tr style="background:${i%2?"#f8fafc":"#fff"}">
        <td style="padding:8px 10px;font-weight:700;color:#0f172a;">${r.v.name}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;">${money2(r.total)}</td>
        <td style="padding:8px 10px;text-align:right;color:#64748b;">${r.sal}</td>
        <td style="padding:8px 10px;text-align:right;color:#64748b;">${r1(r.hrs)}h</td>
        <td style="padding:8px 10px;text-align:right;${r.over?"color:#dc2626;font-weight:700;":"color:#64748b;"}">${r.over}</td>
        <td style="padding:8px 10px;text-align:right;color:${r.reimb>0?"#b45309":"#94a3b8"};">${r.reimb>0?money2(r.reimb):"—"}</td>
        <td style="padding:8px 10px;font-size:11px;color:${r.svc?r.svc.color:"#94a3b8"};">${r.svc?r.svc.text.replace("⚠ ",""):L("Sin objetivos","No targets")}</td>
      </tr>`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte de Flota</title><style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff;font-size:13px;line-height:1.5;padding:36px;}
        table{width:100%;border-collapse:collapse;margin-bottom:26px;}
        thead th{background:#0a2540;color:#fff;padding:8px 10px;font-size:11px;text-align:left;}
        thead th.r{text-align:right;}
        @media print{.no-print{display:none!important;}@page{margin:12mm;}body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      </style></head><body>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:4px;">
          <div style="font-size:22px;font-weight:800;color:#0a2540;">Reporte de Flota</div>
          <div style="font-size:13px;color:#64748b;">The Boating Zone · ${vessels.length} ${L("embarcaciones","vessels")}</div>
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:22px;">${L("Período","Period")}: ${fmtD2(frFrom)} — ${fmtD2(frTo)} · ${L("generado","generated")} ${new Date().toLocaleDateString("en-US")}</div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px;">
          <div style="flex:1;min-width:150px;background:#f8fafc;border-radius:10px;padding:12px 14px;">
            <div style="font-size:11px;color:#64748b;font-weight:600;">${L("Gasto total de la flota","Fleet total spend")}</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;">${money2(fleetTotal)}</div>
          </div>
          <div style="flex:1;min-width:150px;background:#f8fafc;border-radius:10px;padding:12px 14px;">
            <div style="font-size:11px;color:#64748b;font-weight:600;">${L("Salidas del período","Trips in period")}</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;">${rows.reduce((a,r)=>a+r.sal,0)}</div>
          </div>
          <div style="flex:1;min-width:150px;background:#f8fafc;border-radius:10px;padding:12px 14px;">
            <div style="font-size:11px;color:#64748b;font-weight:600;">${L("Tareas vencidas (hoy)","Overdue tasks (today)")}</div>
            <div style="font-size:22px;font-weight:800;color:${rows.some(r=>r.over)?"#dc2626":"#16a34a"};">${rows.reduce((a,r)=>a+r.over,0)}</div>
          </div>
        </div>

        <table><thead><tr>
          <th>${L("Barco","Vessel")}</th><th class="r">${L("Gastos","Spend")}</th><th class="r">${L("Salidas","Trips")}</th><th class="r">${L("Horas","Hours")}</th><th class="r">${L("Venc.","Overdue")}</th><th class="r">${L("Por cobrar","To collect")}</th><th>${L("Próx. servicio","Next service")}</th>
        </tr></thead><tbody>${rows.map(tRow).join("")}</tbody></table>

        ${cats.length?`<div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${L("Gasto por categoría","Spend by category")}</div>
        <div style="margin-bottom:26px;">${cats.map(([c,a])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #f1f5f9;"><span>${c}</span><span style="font-weight:700;">${money2(a)}</span></div>`).join("")}</div>`:""}

        <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${L("Agenda de los próximos 60 días","Next 60 days schedule")} · ${agenda.length}</div>
        ${agenda.length===0?`<div style="font-size:12px;color:#94a3b8;">${L("Nada programado en los próximos 60 días.","Nothing scheduled in the next 60 days.")}</div>`
        :`<table><thead><tr><th>${L("Fecha","Date")}</th><th>${L("Barco","Vessel")}</th><th>${L("Qué","What")}</th><th>${L("Asignado","Assigned")}</th></tr></thead><tbody>
          ${agenda.map((a,i)=>`<tr style="background:${i%2?"#f8fafc":"#fff"}">
            <td style="padding:7px 10px;white-space:nowrap;color:#64748b;">${fmtD2(a.date)}</td>
            <td style="padding:7px 10px;font-weight:700;">${a.vessel}</td>
            <td style="padding:7px 10px;">${a.kind==="Servicio"?"🔧 ":""}${a.what}</td>
            <td style="padding:7px 10px;color:#64748b;">${a.who}</td>
          </tr>`).join("")}
        </tbody></table>`}

        <div style="font-size:10px;color:#cbd5e1;margin-top:26px;">Carive · ${L("Las proyecciones de servicio son estimaciones al ritmo registrado.","Service projections are estimates at the recorded pace.")}</div>
        <div class="no-print" style="position:fixed;bottom:18px;right:18px;display:flex;gap:8px;">
          <button onclick="window.print()" style="padding:13px 18px;background:linear-gradient(120deg,#2563eb,#0ea5e9);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ ${L("Imprimir / Guardar PDF","Print / Save PDF")}</button>
          <button onclick="window.close()" style="padding:13px 18px;background:#fff;color:#475569;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;cursor:pointer;">✕</button>
        </div>
      </body></html>`;

      const w = window.open("","_blank");
      if (!w) {
        const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        const a = document.createElement("a");
        a.href = url; a.download = "reporte_flota.html"; a.click();
        URL.revokeObjectURL(url);
      } else { w.document.write(html); w.document.close(); }
    } catch (err) { alert("Error: "+err.message); }
    setFrBusy(false); setShowFleetReport(false);
  };

  const statusInfo = (v) => {
    const overdue = (v.tasks||[]).filter(t=>t.status==="overdue").length;
    const due = (v.tasks||[]).filter(t=>t.status==="due").length;
    if (overdue>0) return { color:"#dc2626", bg:"#fff5f5", label:`${overdue} vencida${overdue>1?"s":""}` };
    if (due>0) return { color:"#d97706", bg:"#fffbeb", label:`${due} por vencer` };
    return { color:"#16a34a", bg:"#f0fdf4", label:"Al día" };
  };

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:16,display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:220}}>
          <div style={{fontSize:20,fontWeight:800,color:"#0f172a"}}>{L("Mi Flota","My Fleet")}</div>
          <div style={{fontSize:13,color:"#64748b"}}>Vista consolidada de tus {vessels.length} embarcacion{vessels.length>1?"es":""}</div>
        </div>
        <button onClick={()=>setShowFleetReport(true)}
          style={{padding:"9px 15px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          📊 {L("Reporte de Flota","Fleet Report")}
        </button>
      </div>

      {/* Modal: período del reporte de flota */}
      {showFleetReport && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:14}}>
          <div style={{background:"#fff",borderRadius:14,padding:18,maxWidth:380,width:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <div style={{flex:1,fontSize:15,fontWeight:800,color:"#0f172a"}}>{L("Reporte de Flota","Fleet Report")}</div>
              <button onClick={()=>setShowFleetReport(false)} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
            </div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>
              {L("Todos los barcos juntos: comparativo del período, gasto por categoría y agenda de los próximos 60 días para planificar.","All vessels together: period comparison, spend by category and the next 60 days schedule for planning.")}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Desde","From")}</label>
                <input type="date" value={frFrom} onChange={e=>setFrFrom(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:"9px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Hasta","To")}</label>
                <input type="date" value={frTo} min={frFrom||undefined} onChange={e=>setFrTo(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:"9px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13}}/>
              </div>
            </div>
            <button onClick={generateFleetReport} disabled={frBusy}
              style={{width:"100%",padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:frBusy?0.6:1}}>
              {frBusy ? L("Generando...","Generating...") : L("Generar","Generate")}
            </button>
          </div>
        </div>
      )}

      {/* Resumen consolidado */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:24}}>
        <div style={card}>
          <div style={cardLbl}>{L("EMBARCACIONES","VESSELS")}</div>
          <div style={cardVal}>{vessels.length}</div>
        </div>
        <div style={card}>
          <div style={cardLbl}>{L("ALERTAS ACTIVAS","ACTIVE ALERTS")}</div>
          <div style={{...cardVal,color:totalAlerts>0?"#dc2626":"#16a34a"}}>{totalAlerts}</div>
        </div>
        <div style={card}>
          <div style={cardLbl}>{L("GASTO MES (USD)","MONTH SPEND (USD)")}</div>
          <div style={cardVal}>$ {totalUSD.toLocaleString("en-US",{maximumFractionDigits:0})}</div>
        </div>
      </div>

      {/* Lista de barcos */}
      <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>{L("Embarcaciones","Vessels")}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {vessels.map(v => {
          const st = statusInfo(v);
          const c = costs[v.id]||{usd:0,ves:0};
          const fuelPct = v.fuelUnit==="%" ? v.fuel : null;
          return (
            <div key={v.id} onClick={()=>{ setVesselId(v.id); setPage("home"); }}
              style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16,cursor:"pointer",transition:"box-shadow 0.15s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>{v.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{v.type||""}{v.marina?` · ${v.marina.split(",")[0]}`:""}</div>
                </div>
                <span style={{padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:"nowrap",background:st.bg,color:st.color}}>{st.label}</span>
              </div>
              {(()=>{ const sv=svcSummary(v); return sv ? (
                <div style={{fontSize:11,fontWeight:sv.color==="#dc2626"?700:500,color:sv.color,marginTop:-4,marginBottom:8}}>{sv.text}</div>
              ) : null; })()}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
                <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{color:"#94a3b8",marginBottom:2}}>{L("Motor","Engine")}</div>
                  <div style={{fontWeight:700,color:"#0f172a"}}>{v.engineHours||0} h</div>
                </div>
                <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{color:"#94a3b8",marginBottom:2}}>{L("Combustible","Fuel")}</div>
                  <div style={{fontWeight:700,color:"#0f172a"}}>{v.fuel||0} {v.fuelUnit||"gal"}</div>
                </div>
                <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px",gridColumn:"1 / -1"}}>
                  <div style={{color:"#94a3b8",marginBottom:2}}>{L("Gasto este mes","Spend this month")}</div>
                  <div style={{fontWeight:700,color:"#0f172a"}}>
                    {c.usd>0?`$ ${c.usd.toLocaleString("en-US",{maximumFractionDigits:0})}`:"Sin gastos"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const card = {background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16};
const cardLbl = {fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:6};
const cardVal = {fontSize:24,fontWeight:800,color:"#0f172a"};
