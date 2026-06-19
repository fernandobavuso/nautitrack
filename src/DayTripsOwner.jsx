import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// Preferencias estilo Uber que el dueño puede activar
const TRIP_PREFERENCES = [
  "Puntualidad estricta","Experiencia en pesca","Sabe cocinar a bordo",
  "Buen trato con niños","Habla inglés","No fumador","Experiencia en buceo",
  "Conoce la zona","Maneja lancha auxiliar","Discreto / silencioso",
  "Ayuda con limpieza","Primeros auxilios",
];

const DURATIONS = ["4 horas","6 horas","8 horas","Varios días"];
const TRIP_ROLES = ["Capitán","Primer Oficial","Marinero","Chef","Camarero","Mecánico"];
const SLEEP_OPTIONS = ["El tripulante regresa a casa cada noche","El tripulante duerme a bordo"];

// ── PANEL DAY TRIPS PARA EL DUEÑO ──
export default function DayTripsOwner({ vessel, user }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    vessel_label:"mi_embarcacion", crew_role:"Marinero", trip_date:"", end_date:"",
    duration:"8 horas", sleep_option:"El tripulante regresa a casa cada noche",
    num_persons:"", pay_amount:"", pay_open:false, pay_period:"por día",
    other_vessel_brand:"", other_vessel_type:"", other_vessel_length:"",
    preferences:[], notes:"",
  });

  useEffect(() => { loadTrips(); }, []);

  const loadTrips = async () => {
    const { data } = await supabase.from("day_trips")
      .select("*, applications:day_trip_applications(*, crew:crew_id(full_name,photo_url,crew_role,badges))")
      .eq("owner_id", user.id).order("created_at",{ascending:false});
    setTrips(data||[]);
    setLoading(false);
  };

  const togglePref = (p) => setForm(f=>({...f, preferences: f.preferences.includes(p)?f.preferences.filter(x=>x!==p):[...f.preferences,p]}));

  const publishTrip = async () => {
    if (!form.trip_date) { setMsg("Indica la fecha del viaje"); setTimeout(()=>setMsg(""),3000); return; }
    if (form.duration==="Varios días" && !form.end_date) { setMsg("Indica la fecha de fin del viaje"); setTimeout(()=>setMsg(""),3000); return; }
    if (!form.pay_open && !form.pay_amount) { setMsg("Indica la paga o marca 'abierto a propuestas'"); setTimeout(()=>setMsg(""),3000); return; }
    const isOther = form.vessel_label==="otra";
    const { error } = await supabase.from("day_trips").insert({
      owner_id:user.id,
      vessel_id: isOther?null:vessel.id,
      vessel_label: form.vessel_label,
      vessel_type: isOther?`${form.other_vessel_brand} ${form.other_vessel_type} ${form.other_vessel_length?form.other_vessel_length+" pies":""}`.trim()||"Otra embarcación":vessel.type,
      crew_role: form.crew_role, trip_date: form.trip_date,
      duration: form.duration==="Varios días"?`Varios días (${form.sleep_option})`:form.duration,
      num_persons: form.num_persons?parseInt(form.num_persons):null,
      city: vessel.details?.city||vessel.marina||"",
      pay_amount: form.pay_open?null:`${form.pay_amount} ${form.pay_period}`,
      pay_open: form.pay_open,
      preferences: form.preferences, notes: form.notes, status:"open",
    });
    if (error) { setMsg("Error: "+error.message); }
    else {
      setMsg("¡Solicitud publicada! Les llegará a los tripulantes");
      setForm({vessel_label:"mi_embarcacion",crew_role:"Marinero",trip_date:"",end_date:"",duration:"8 horas",sleep_option:"El tripulante regresa a casa cada noche",num_persons:"",pay_amount:"",pay_open:false,pay_period:"por día",other_vessel_brand:"",other_vessel_type:"",other_vessel_length:"",preferences:[],notes:""});
      setCreating(false); loadTrips();
    }
    setTimeout(()=>setMsg(""),4000);
  };

  const acceptApplication = async (trip, app) => {
    await supabase.from("day_trip_applications").update({status:"accepted"}).eq("id", app.id);
    await supabase.from("day_trips").update({status:"filled", selected_crew_id:app.crew_id}).eq("id", trip.id);
    setMsg("Tripulante seleccionado");
    setTimeout(()=>setMsg(""),3000);
    loadTrips(); setSelectedTrip(null);
  };

  const markCompleted = async (trip) => {
    await supabase.from("day_trips").update({status:"completed"}).eq("id", trip.id);
    setMsg("Viaje completado. Ya puedes dejar tu reseña");
    setTimeout(()=>setMsg(""),3000);
    loadTrips();
  };

  if (loading) return <div style={{textAlign:"center",padding:30,color:"#94a3b8"}}>Cargando...</div>;

  return (
    <div>
      {!creating ? (
        <button onClick={()=>setCreating(true)} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:16}}>
          ＋ Solicitar Tripulante para un Viaje
        </button>
      ) : (
        <div style={{background:"#fff",border:"1.5px solid #bfdbfe",borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1d4ed8",marginBottom:14}}>Nueva solicitud de tripulante</div>

          <label style={lbl}>¿Para cuál embarcación?</label>
          <select value={form.vessel_label} onChange={e=>setForm({...form,vessel_label:e.target.value})} style={inp}>
            <option value="mi_embarcacion">Mi embarcación ({vessel.name})</option>
            <option value="otra">Otra embarcación</option>
          </select>

          {/* Datos de otra embarcación */}
          {form.vessel_label==="otra"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10,padding:12,background:"#f8fafc",borderRadius:8}}>
              <div>
                <label style={lbl}>Marca</label>
                <input value={form.other_vessel_brand} onChange={e=>setForm({...form,other_vessel_brand:e.target.value})} placeholder="Sea Ray" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <input value={form.other_vessel_type} onChange={e=>setForm({...form,other_vessel_type:e.target.value})} placeholder="Yate Motor" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Eslora (pies)</label>
                <input value={form.other_vessel_length} onChange={e=>setForm({...form,other_vessel_length:e.target.value})} placeholder="48" style={inp}/>
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
            <div>
              <label style={lbl}>Rol buscado</label>
              <select value={form.crew_role} onChange={e=>setForm({...form,crew_role:e.target.value})} style={inp}>
                {TRIP_ROLES.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Duración</label>
              <select value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} style={inp}>
                {DURATIONS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{form.duration==="Varios días"?"Fecha de inicio":"Fecha del viaje"}</label>
              <input type="date" value={form.trip_date} onChange={e=>setForm({...form,trip_date:e.target.value})} style={inp}/>
            </div>
            {form.duration==="Varios días"&&(
              <div>
                <label style={lbl}>Fecha de fin</label>
                <input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} style={inp}/>
              </div>
            )}
            <div>
              <label style={lbl}>N° de personas a bordo</label>
              <input type="number" value={form.num_persons} onChange={e=>setForm({...form,num_persons:e.target.value})} placeholder="Ej: 6" style={inp}/>
            </div>
          </div>

          {/* Opción de pernocta solo si es varios días */}
          {form.duration==="Varios días"&&(
            <div style={{marginTop:10}}>
              <label style={lbl}>¿Dónde duerme el tripulante?</label>
              <select value={form.sleep_option} onChange={e=>setForm({...form,sleep_option:e.target.value})} style={inp}>
                {SLEEP_OPTIONS.map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Paga */}
          <div style={{marginTop:10}}>
            <label style={lbl}>Paga</label>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <input type="checkbox" id="payopen" checked={form.pay_open} onChange={e=>setForm({...form,pay_open:e.target.checked})} style={{width:15,height:15}}/>
              <label htmlFor="payopen" style={{fontSize:12,color:"#475569",cursor:"pointer"}}>Abierto a propuestas (que el tripulante diga cuánto cobra)</label>
            </div>
            {!form.pay_open&&(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={form.pay_amount} onChange={e=>setForm({...form,pay_amount:e.target.value})} placeholder="Ej: $50, Bs. 2000" style={{...inp,flex:1}}/>
                <span style={{fontSize:13,color:"#64748b",whiteSpace:"nowrap"}}>
                  {form.duration==="Varios días"?"por día":`por ${form.duration}`}
                </span>
              </div>
            )}
          </div>

          {/* Preferencias estilo Uber */}
          <div style={{marginTop:14}}>
            <label style={lbl}>Mis expectativas (opcional)</label>
            <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>Como pedir un Uber — marca lo que esperas del tripulante</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {TRIP_PREFERENCES.map(p=>(
                <button key={p} onClick={()=>togglePref(p)} style={{
                  padding:"5px 11px",border:"1.5px solid",borderRadius:16,fontSize:11,cursor:"pointer",
                  background:form.preferences.includes(p)?"#eff6ff":"#f8fafc",
                  borderColor:form.preferences.includes(p)?"#2563eb":"#e2e8f0",
                  color:form.preferences.includes(p)?"#2563eb":"#64748b",
                  fontWeight:form.preferences.includes(p)?700:400,
                }}>{p}</button>
              ))}
            </div>
          </div>

          <div style={{marginTop:12}}>
            <label style={lbl}>Notas adicionales</label>
            <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} placeholder="Ej: Salida de pesca temprano, traer protección solar..." style={{...inp,resize:"vertical"}}/>
          </div>

          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={()=>setCreating(false)} style={{flex:1,padding:"10px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
            <button onClick={publishTrip} style={{flex:2,padding:"10px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Publicar solicitud</button>
          </div>
        </div>
      )}

      {/* Lista de mis solicitudes */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {trips.length===0&&!creating&&(
          <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
            <div style={{fontSize:36,marginBottom:6}}></div>
            <div style={{fontWeight:600,fontSize:13}}>Sin solicitudes de viaje</div>
          </div>
        )}
        {trips.map(trip=>{
          const apps = trip.applications||[];
          const pending = apps.filter(a=>a.status==="pending");
          return (
            <div key={trip.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{trip.crew_role} · {trip.duration}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>{new Date(trip.trip_date).toLocaleDateString("es-VE")} · {trip.city||"—"}</div>
                  <div style={{fontSize:12,color:"#16a34a",fontWeight:600,marginTop:2}}>{trip.pay_open?"Paga: abierta a propuestas":`Paga: ${trip.pay_amount}`}</div>
                </div>
                <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap",
                  background:trip.status==="open"?"#eff6ff":trip.status==="filled"?"#fffbeb":trip.status==="completed"?"#f0fdf4":"#f1f5f9",
                  color:trip.status==="open"?"#2563eb":trip.status==="filled"?"#d97706":trip.status==="completed"?"#16a34a":"#94a3b8"}}>
                  {trip.status==="open"?"Abierta":trip.status==="filled"?"Asignada":trip.status==="completed"?"Completada":"Cerrada"}
                </span>
              </div>
              {trip.preferences?.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  {trip.preferences.map(p=><span key={p} style={{fontSize:10,padding:"2px 8px",background:"#f1f5f9",borderRadius:12,color:"#64748b"}}>{p}</span>)}
                </div>
              )}
              {trip.status==="open"&&(
                <button onClick={()=>setSelectedTrip(trip)} style={{width:"100%",padding:"8px",background:pending.length?"#eff6ff":"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,color:pending.length?"#2563eb":"#94a3b8",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  {pending.length?`Ver ${pending.length} postulación${pending.length>1?"es":""}`:"Sin postulaciones aún"}
                </button>
              )}
              {trip.status==="filled"&&(
                <button onClick={()=>markCompleted(trip)} style={{width:"100%",padding:"8px",background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  Marcar viaje como completado
                </button>
              )}
              {trip.status==="completed"&&(
                <ReviewButton trip={trip} user={user} onDone={loadTrips}/>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal postulaciones */}
      {selectedTrip&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1500,padding:16}} onClick={()=>setSelectedTrip(null)}>
          <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:440,maxHeight:"80vh",overflowY:"auto",padding:20}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>Postulaciones</div>
              <button onClick={()=>setSelectedTrip(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(selectedTrip.applications||[]).filter(a=>a.status==="pending").map(app=>(
                <div key={app.id} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    {app.crew?.photo_url
                      ? <img src={app.crew.photo_url} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover"}} alt=""/>
                      : <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{(app.crew?.full_name||"?")[0]}</div>
                    }
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{app.crew?.full_name}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{app.crew?.crew_role}</div>
                    </div>
                    {(app.crew?.badges||[]).includes("verified")&&<span title="Verificado"></span>}
                  </div>
                  {app.proposed_pay&&<div style={{fontSize:12,color:"#16a34a",marginBottom:4}}>Propone: {app.proposed_pay}</div>}
                  {app.message&&<div style={{fontSize:12,color:"#475569",marginBottom:8}}>{app.message}</div>}
                  <button onClick={()=>acceptApplication(selectedTrip,app)} style={{width:"100%",padding:"7px",background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Seleccionar</button>
                </div>
              ))}
              {(selectedTrip.applications||[]).filter(a=>a.status==="pending").length===0&&(
                <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:13}}>Sin postulaciones todavía</div>
              )}
            </div>
          </div>
        </div>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000}}>{msg}</div>}
    </div>
  );
}

// Botón + modal para dejar reseña
function ReviewButton({ trip, user, onDone }) {
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
      trip_id:trip.id, reviewer_id:user.id, reviewee_id:trip.selected_crew_id,
      direction:"owner_to_crew", rating, comment,
    });
    setDone(true); setOpen(false); onDone&&onDone();
  };

  if (done) return <div style={{textAlign:"center",fontSize:12,color:"#16a34a",fontWeight:600,padding:"6px 0"}}>Reseña enviada</div>;

  return (
    <>
      <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"8px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,color:"#d97706",fontSize:12,fontWeight:700,cursor:"pointer"}}>
        ★ Calificar al tripulante
      </button>
      {open&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={()=>setOpen(false)}>
          <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:360,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:14,textAlign:"center"}}>¿Cómo te fue con el tripulante?</div>
            <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:16}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setRating(n)} style={{background:"none",border:"none",cursor:"pointer",fontSize:32,opacity:n<=rating?1:0.3}}>★</button>
              ))}
            </div>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} placeholder="¿Cómo fue tu experiencia? (opcional)" style={{...inp,resize:"vertical",marginBottom:14}}/>
            <button onClick={submit} disabled={!rating} style={{width:"100%",padding:"11px",background:rating?"linear-gradient(135deg,#1d4ed8,#0ea5e9)":"#cbd5e1",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,cursor:rating?"pointer":"default"}}>Enviar reseña</button>
          </div>
        </div>
      )}
    </>
  );
}

const lbl = {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5};
const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
