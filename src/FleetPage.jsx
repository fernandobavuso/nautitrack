import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { hasFeature, PremiumLock } from "./plans.jsx";

// Vista consolidada de toda la flota
export default function FleetPage({ vessels, vessel, user, setVesselId, setPage, setShowProfile }) {
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

  const statusInfo = (v) => {
    const overdue = (v.tasks||[]).filter(t=>t.status==="overdue").length;
    const due = (v.tasks||[]).filter(t=>t.status==="due").length;
    if (overdue>0) return { color:"#dc2626", bg:"#fff5f5", label:`${overdue} vencida${overdue>1?"s":""}` };
    if (due>0) return { color:"#d97706", bg:"#fffbeb", label:`${due} por vencer` };
    return { color:"#16a34a", bg:"#f0fdf4", label:"Al día" };
  };

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:800,color:"#0f172a"}}>{L("Mi Flota","My Fleet")}</div>
        <div style={{fontSize:13,color:"#64748b"}}>Vista consolidada de tus {vessels.length} embarcacion{vessels.length>1?"es":""}</div>
      </div>

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
