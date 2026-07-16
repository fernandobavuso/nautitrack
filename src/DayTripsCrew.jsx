import { useState, useEffect } from "react";
import { useLang } from "./i18n.jsx";
import { supabase } from "./supabase";
import { notify } from "./notifications";

// Panel de Day Trips para el tripulante: ve solicitudes abiertas y se postula
export default function DayTripsCrew({ user, profile }) {
  const { lang } = useLang();
  const L=(es,en)=>lang==="en"?en:es;
  const cl=(v)=>lang==="en"?({"Capitán":"Captain","Marinero":"Deckhand","Camarero":"Steward","Azafata":"Stewardess","Cocinero":"Cook"}[v]||v):v;
  const [trips, setTrips] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyTrip, setApplyTrip] = useState(null);
  const [proposedPay, setProposedPay] = useState("");
  const [proposedCurrency, setProposedCurrency] = useState("USD");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { loadTrips(); loadMyApps(); loadCompleted(); }, []);

  const loadCompleted = async () => {
    // Viajes donde este tripulante fue seleccionado y ya se completaron
    const { data } = await supabase.from("day_trips")
      .select("*, owner:owner_id(full_name)")
      .eq("selected_crew_id", user.id).eq("status","completed")
      .order("trip_date",{ascending:false});
    setCompletedTrips(data||[]);
  };

  const loadTrips = async () => {
    const { data } = await supabase.from("day_trips")
      .select("*, owner:owner_id(full_name)")
      .eq("status","open").order("trip_date",{ascending:true});

    // MATCHING INTELIGENTE: filtrar por rol y zona del tripulante
    const myRoles = [profile?.crew_role, profile?.secondary_role].filter(Boolean).map(r=>r.toLowerCase());
    const myZone = (profile?.work_zone||"").toLowerCase().trim();
    const iAmVerified = (profile?.badges||[]).includes("verified");

    const filtered = (data||[]).filter(trip => {
      // Si el viaje es solo para verificados y el tripulante no lo está, ocultar
      if (trip.only_verified && !iAmVerified) return false;
      // Filtro por rol: el rol buscado debe coincidir con rol principal o secundario
      const roleMatch = myRoles.length===0 || myRoles.includes((trip.crew_role||"").toLowerCase());
      // Filtro por zona: la ciudad del viaje debe coincidir con la zona del tripulante
      const tripCity = (trip.city||"").toLowerCase();
      const zoneMatch = !myZone || !tripCity || tripCity.includes(myZone) || myZone.includes(tripCity);
      return roleMatch && zoneMatch;
    });

    setTrips(filtered);
    setLoading(false);
  };

  const loadMyApps = async () => {
    const { data } = await supabase.from("day_trip_applications")
      .select("*, trip:trip_id(*)").eq("crew_id",user.id);
    setMyApps(data||[]);
  };

  const markCompleted = async (trip) => {
    await supabase.from("day_trips").update({ status:"completed" }).eq("id", trip.id);
    if (trip.owner_id) notify(trip.owner_id, { type:"trip_completed", title:"Viaje marcado como completado", body:`El tripulante marcó como completado el viaje de ${trip.crew_role}. Puedes dejar tu reseña.`, link:"tripulacion" });
    setMsg("Viaje marcado como completado");
    loadMyApps(); loadCompleted();
    setTimeout(()=>setMsg(""),3000);
  };

  const removeApp = async (appId) => {
    if (!confirm("¿Retirar esta postulación?")) return;
    await supabase.from("day_trip_applications").delete().eq("id", appId);
    setMsg("Postulación retirada");
    loadMyApps(); loadCompleted();
    setTimeout(()=>setMsg(""),3000);
  };

  const apply = async () => {
    const { error } = await supabase.from("day_trip_applications").insert({
      trip_id:applyTrip.id, crew_id:user.id,
      proposed_pay: applyTrip.pay_open?proposedPay:null,
      proposed_currency: applyTrip.pay_open?proposedCurrency:null,
      message, status:"pending",
    });
    if (error?.code==="23505") setMsg("⚠️ Ya te postulaste a este viaje");
    else if (error) setMsg("⚠️ Error: "+error.message);
    else {
      setMsg("¡Postulación enviada!"); loadMyApps();
      // Notificar al dueño del viaje
      const myName = profile?.full_name?.trim() || `${profile?.first_name||""} ${profile?.last_name||""}`.trim() || "Un tripulante";
      notify(applyTrip.owner_id, {
        type:"application", title:"Nueva postulación",
        body:`${myName} se postuló para tu viaje de ${applyTrip.crew_role}`,
        link:"tripulacion",
      });
    }
    setApplyTrip(null); setProposedPay(""); setMessage("");
    setTimeout(()=>setMsg(""),4000);
  };

  const appliedIds = myApps.map(a=>a.trip_id);

  if (loading) return <div style={{textAlign:"center",padding:30,color:"#94a3b8"}}>Cargando viajes...</div>;

  return (
    <div>
      {/* Mis postulaciones ACTIVAS */}
      {myApps.filter(a=>a.trip?.status!=="completed").length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:4}}>Activas</div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Salidas que faltan por hacer</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {myApps.filter(a=>a.trip?.status!=="completed").map(a=>{
              const t=a.trip||{};
              const estado = a.status==="accepted"?"Aceptada":a.status==="rejected"?"No seleccionada":"Pendiente";
              const color = a.status==="accepted"?"#16a34a":a.status==="rejected"?"#dc2626":"#d97706";
              const bg = a.status==="accepted"?"#f0fdf4":a.status==="rejected"?"#fff5f5":"#fffbeb";
              const border = a.status==="accepted"?"#bbf7d0":a.status==="rejected"?"#fecaca":"#fde68a";
              return (
                <div key={a.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{t.crew_role||"Viaje"} · {t.vessel_type||""}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{t.trip_date?new Date(t.trip_date).toLocaleDateString("es-VE"):""}{t.city?` · ${t.city}`:""}</div>
                      {a.status==="accepted"&&<div style={{fontSize:11,color:"#16a34a",marginTop:2,fontWeight:600}}>El propietario te contactará. Revisa tus notificaciones.</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap",background:bg,color,border:`1px solid ${border}`}}>{estado}</span>
                      <button onClick={()=>removeApp(a.id)} title="Retirar postulación" style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:11,fontWeight:600}}>Retirar</button>
                    </div>
                  </div>
                  {a.status==="accepted"&&t.status!=="completed"&&(
                    <button onClick={()=>markCompleted(t)} style={{width:"100%",marginTop:10,padding:"8px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,color:"#16a34a",fontSize:12,fontWeight:700,cursor:"pointer"}}>Marcar viaje como completado</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{fontSize:11,color:"#64748b",marginBottom:14}}>{L("Viajes que coinciden con tu rol","Trips matching your role")} ({cl(profile?.crew_role||"—", lang)}) {L("y tu zona","and your area")} ({profile?.work_zone||L("sin zona","no area")}). {L("Postúlate a los que te interesen.","Apply to the ones that interest you.")}</div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {trips.length===0&&(
          <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
            <div style={{fontSize:40,marginBottom:8}}></div>
            <div style={{fontWeight:600}}>{L("No hay viajes disponibles ahora","No trips available right now")}</div>
            <div style={{fontSize:12,marginTop:4}}>{L("Vuelve pronto, se publican seguido","Check back soon, new ones are posted often")}</div>
          </div>
        )}
        {trips.map(trip=>{
          const applied = appliedIds.includes(trip.id);
          return (
            <div key={trip.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{trip.crew_role} · {trip.vessel_type||"Embarcación"}</div>
                  {trip.trip_type&&<div style={{fontSize:11,color:"#2563eb",fontWeight:600}}>{trip.trip_type}</div>}
                  <div style={{fontSize:12,color:"#64748b"}}>{new Date(trip.trip_date).toLocaleDateString("es-VE")}{trip.departure_time?` · ${trip.departure_time}`:""} · {trip.duration}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>{trip.city||"—"}{trip.num_persons?` · ${trip.num_persons} personas`:""}</div>
                  {trip.meeting_point&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Encuentro: {trip.meeting_point}</div>}
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"#16a34a",textAlign:"right",whiteSpace:"nowrap"}}>
                  {trip.pay_open?"Propón":trip.pay_amount}
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
                background:applied?"#f1f5f9":"linear-gradient(120deg,#2563eb,#0ea5e9)",
                color:applied?"#94a3b8":"#fff",fontSize:13,fontWeight:700,
              }}>{applied?"✓ Ya te postulaste":"Postularme"}</button>
            </div>
          );
        })}
      </div>

      {/* Mis viajes completados — reseñar al dueño */}
      {completedTrips.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:4}}>Viajes completados</div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Salidas ya realizadas. Deja tu reseña al propietario.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {completedTrips.map(trip=>(
              <div key={trip.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{trip.crew_role} · {trip.vessel_type||"Embarcación"}</div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>{new Date(trip.trip_date).toLocaleDateString("es-VE")} · {trip.city||"—"}</div>
                <CrewReviewButton trip={trip} user={user} onDone={loadCompleted}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal postularse */}
      {applyTrip&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={()=>setApplyTrip(null)}>
          <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:380,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:4}}>Postularme al viaje</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>{trip_label(applyTrip)}</div>
            {applyTrip.pay_open&&(
              <div style={{marginBottom:12}}>
                <label style={lbl}>¿Cuánto cobras? *</label>
                <div style={{display:"flex",gap:8}}>
                  <select value={proposedCurrency} onChange={e=>setProposedCurrency(e.target.value)} style={{...inp,width:100,flexShrink:0}}>
                    <option value="USD">$ USD</option>
                  </select>
                  <input type="number" value={proposedPay} onChange={e=>setProposedPay(e.target.value)} placeholder="Ej: 60" style={{...inp,flex:1}}/>
                </div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>Indica el monto por el viaje completo</div>
              </div>
            )}
            <label style={lbl}>Mensaje al propietario (opcional)</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder="Preséntate brevemente..." style={{...inp,resize:"vertical",marginBottom:14}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setApplyTrip(null)} style={{flex:1,padding:"10px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={apply} disabled={applyTrip.pay_open&&!proposedPay} style={{flex:2,padding:"10px",background:(applyTrip.pay_open&&!proposedPay)?"#cbd5e1":"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Enviar postulación</button>
            </div>
          </div>
        </div>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000}}>{msg}</div>}
    </div>
  );
}

function trip_label(t){ return `${t.crew_role} · ${new Date(t.trip_date).toLocaleDateString("es-VE")} · ${t.duration}`; }

// Botón + modal para que el tripulante reseñe al dueño/barco
function CrewReviewButton({ trip, user, onDone }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.from("reviews").select("id").eq("trip_id",trip.id).eq("reviewer_id",user.id).maybeSingle()
      .then(({data})=>{ if(data) setDone(true); });
  }, []);

  const submit = async () => {
    if (!rating) return;
    await supabase.from("reviews").insert({
      trip_id:trip.id, reviewer_id:user.id, reviewee_id:trip.owner_id,
      direction:"crew_to_owner", rating, comment,
    });
    notify(trip.owner_id, {
      type:"review", title:"Recibiste una reseña",
      body:`Un tripulante calificó tu viaje con ${rating} estrella${rating>1?"s":""}`,
      link:"tripulacion",
    });
    setDone(true); setOpen(false); onDone&&onDone();
  };

  if (done) return <div style={{textAlign:"center",fontSize:12,color:"#16a34a",fontWeight:600,padding:"6px 0"}}>Reseña enviada</div>;

  return (
    <>
      <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"8px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,color:"#d97706",fontSize:12,fontWeight:700,cursor:"pointer"}}>
        Calificar al propietario / barco
      </button>
      {open&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={()=>setOpen(false)}>
          <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:360,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:14,textAlign:"center"}}>¿Cómo fue tu experiencia con el barco?</div>
            <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:16}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setRating(n)} style={{background:"none",border:"none",cursor:"pointer",fontSize:32,color:n<=rating?"#f59e0b":"#cbd5e1"}}>★</button>
              ))}
            </div>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} placeholder="¿Cómo te trataron? ¿Pagaron lo acordado? (opcional)" style={{...inp,resize:"vertical",marginBottom:14}}/>
            <button onClick={submit} disabled={!rating} style={{width:"100%",padding:"11px",background:rating?"linear-gradient(120deg,#2563eb,#0ea5e9)":"#cbd5e1",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,cursor:rating?"pointer":"default"}}>Enviar reseña</button>
          </div>
        </div>
      )}
    </>
  );
}
const lbl = {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5};
const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
