import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { hasFeature, PremiumLock } from "./plans.jsx";

// Vista consolidada de toda la flota
export default function FleetPage({ vessels, vessel, user, setVesselId, setPage, setShowProfile }) {
  const [costs, setCosts] = useState({}); // {vesselId: {usd, ves}}
  const [loading, setLoading] = useState(true);

  const allowed = hasFeature(vessel, "multiFleet");

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
    return <div style={{padding:"40px 20px"}}><PremiumLock feature="Vista de Flota" onUpgrade={()=>setShowProfile&&setShowProfile(true)}/></div>;
  }

  // Totales consolidados del mes
  let totalUSD=0, totalVES=0, totalAlerts=0;
  vessels.forEach(v => {
    const c = costs[v.id]||{usd:0,ves:0};
    totalUSD += c.usd; totalVES += c.ves;
    totalAlerts += (v.tasks||[]).filter(t=>t.status==="overdue").length;
  });

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
        <div style={{fontSize:20,fontWeight:800,color:"#0f172a"}}>Mi Flota</div>
        <div style={{fontSize:13,color:"#64748b"}}>Vista consolidada de tus {vessels.length} embarcacion{vessels.length>1?"es":""}</div>
      </div>

      {/* Resumen consolidado */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:24}}>
        <div style={card}>
          <div style={cardLbl}>EMBARCACIONES</div>
          <div style={cardVal}>{vessels.length}</div>
        </div>
        <div style={card}>
          <div style={cardLbl}>ALERTAS ACTIVAS</div>
          <div style={{...cardVal,color:totalAlerts>0?"#dc2626":"#16a34a"}}>{totalAlerts}</div>
        </div>
        <div style={card}>
          <div style={cardLbl}>GASTO MES (USD)</div>
          <div style={cardVal}>$ {totalUSD.toLocaleString("en-US",{maximumFractionDigits:0})}</div>
        </div>
      </div>

      {/* Lista de barcos */}
      <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Embarcaciones</div>
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
                <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{color:"#94a3b8",marginBottom:2}}>Motor</div>
                  <div style={{fontWeight:700,color:"#0f172a"}}>{v.engineHours||0} h</div>
                </div>
                <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{color:"#94a3b8",marginBottom:2}}>Combustible</div>
                  <div style={{fontWeight:700,color:"#0f172a"}}>{v.fuel||0} {v.fuelUnit||"gal"}</div>
                </div>
                <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px",gridColumn:"1 / -1"}}>
                  <div style={{color:"#94a3b8",marginBottom:2}}>Gasto este mes</div>
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
