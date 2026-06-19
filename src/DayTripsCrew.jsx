import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// Panel de Day Trips para el tripulante: ve solicitudes abiertas y se postula
export default function DayTripsCrew({ user, profile }) {
  const [trips, setTrips] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyTrip, setApplyTrip] = useState(null);
  const [proposedPay, setProposedPay] = useState("");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { loadTrips(); loadMyApps(); }, []);

  const loadTrips = async () => {
    const { data } = await supabase.from("day_trips")
      .select("*, owner:owner_id(full_name)")
      .eq("status","open").order("trip_date",{ascending:true});
    setTrips(data||[]);
    setLoading(false);
  };

  const loadMyApps = async () => {
    const { data } = await supabase.from("day_trip_applications")
      .select("*, trip:trip_id(*)").eq("crew_id",user.id);
    setMyApps(data||[]);
  };

  const apply = async () => {
    const { error } = await supabase.from("day_trip_applications").insert({
      trip_id:applyTrip.id, crew_id:user.id,
      proposed_pay: applyTrip.pay_open?proposedPay:null,
      message, status:"pending",
    });
    if (error?.code==="23505") setMsg("⚠️ Ya te postulaste a este viaje");
    else if (error) setMsg("⚠️ Error: "+error.message);
    else { setMsg("✅ ¡Postulación enviada!"); loadMyApps(); }
    setApplyTrip(null); setProposedPay(""); setMessage("");
    setTimeout(()=>setMsg(""),4000);
  };

  const appliedIds = myApps.map(a=>a.trip_id);

  if (loading) return <div style={{textAlign:"center",padding:30,color:"#94a3b8"}}>Cargando viajes...</div>;

  return (
    <div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:14}}>Viajes disponibles publicados por propietarios. Postúlate a los que te interesen.</div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {trips.length===0&&(
          <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
            <div style={{fontSize:40,marginBottom:8}}>🧭</div>
            <div style={{fontWeight:600}}>No hay viajes disponibles ahora</div>
            <div style={{fontSize:12,marginTop:4}}>Vuelve pronto, se publican seguido</div>
          </div>
        )}
        {trips.map(trip=>{
          const applied = appliedIds.includes(trip.id);
          return (
            <div key={trip.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{trip.crew_role} · {trip.vessel_type||"Embarcación"}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>📅 {new Date(trip.trip_date).toLocaleDateString("es-VE")} · {trip.duration}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>📍 {trip.city||"—"}{trip.num_persons?` · ${trip.num_persons} personas`:""}</div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"#16a34a",textAlign:"right",whiteSpace:"nowrap"}}>
                  {trip.pay_open?"💬 Propón":trip.pay_amount}
                </div>
              </div>
              {trip.preferences?.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4,margin:"8px 0"}}>
                  {trip.preferences.map(p=><span key={p} style={{fontSize:10,padding:"2px 8px",background:"#eff6ff",borderRadius:12,color:"#2563eb"}}>{p}</span>)}
                </div>
              )}
              {trip.notes&&<div style={{fontSize:12,color:"#475569",margin:"6px 0",fontStyle:"italic"}}>"{trip.notes}"</div>}
              <button onClick={()=>!applied&&setApplyTrip(trip)} disabled={applied} style={{
                width:"100%",marginTop:8,padding:"9px",border:"none",borderRadius:8,cursor:applied?"default":"pointer",
                background:applied?"#f1f5f9":"linear-gradient(135deg,#1d4ed8,#0ea5e9)",
                color:applied?"#94a3b8":"#fff",fontSize:13,fontWeight:700,
              }}>{applied?"✓ Ya te postulaste":"Postularme"}</button>
            </div>
          );
        })}
      </div>

      {/* Modal postularse */}
      {applyTrip&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={()=>setApplyTrip(null)}>
          <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:380,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:4}}>Postularme al viaje</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>{trip_label(applyTrip)}</div>
            {applyTrip.pay_open&&(
              <div style={{marginBottom:12}}>
                <label style={lbl}>¿Cuánto cobras? *</label>
                <input value={proposedPay} onChange={e=>setProposedPay(e.target.value)} placeholder="Ej: $60 por el día" style={inp}/>
              </div>
            )}
            <label style={lbl}>Mensaje al propietario (opcional)</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder="Preséntate brevemente..." style={{...inp,resize:"vertical",marginBottom:14}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setApplyTrip(null)} style={{flex:1,padding:"10px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={apply} disabled={applyTrip.pay_open&&!proposedPay} style={{flex:2,padding:"10px",background:(applyTrip.pay_open&&!proposedPay)?"#cbd5e1":"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Enviar postulación</button>
            </div>
          </div>
        </div>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000}}>{msg}</div>}
    </div>
  );
}

function trip_label(t){ return `${t.crew_role} · ${new Date(t.trip_date).toLocaleDateString("es-VE")} · ${t.duration}`; }
const lbl = {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5};
const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
