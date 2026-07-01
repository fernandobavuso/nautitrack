import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import ChatPanel from "./ChatPanel";
import DayTripsOwner from "./DayTripsOwner";
import CrewSearch from "./CrewSearch";
import { notify } from "./notifications";
import { getReputations, Stars } from "./reputation.jsx";

// Panel del dueño para gestionar tripulantes
// Props: vessel (barco actual), user (dueño), onClose
export default function CrewMarketplace({ vessel, user, onClose }) {
  const [tab, setTab] = useState("miequipo");
  const [possibles, setPossibles] = useState([]);
  const [applications, setApplications] = useState([]);
  const [crew, setCrew] = useState([]);
  const [reps, setReps] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedCrew, setSelectedCrew] = useState(null); // perfil expandido
  const [activeChat, setActiveChat] = useState(null);
  const [msg, setMsg] = useState("");
  const [myConnections, setMyConnections] = useState([]);
  const [assignedCrew, setAssignedCrew] = useState([]);
  const [assignForm, setAssignForm] = useState({ email:"", full_name:"", role:"Capitán", phone:"" });
  const [assignMsg, setAssignMsg] = useState("");

  useEffect(() => { loadApplications(); loadConnections(); loadAssigned(); loadPossibles(); }, []);

  const loadPossibles = async () => {
    // Candidatos interesados de búsquedas + ofertas espontáneas, no descartados
    const { data: props } = await supabase.from("crew_proposals")
      .select("*, crew:crew_id(*), search:search_id(role,city)")
      .eq("owner_id", user.id).eq("crew_status","interested").neq("owner_status","declined");
    const { data: offers } = await supabase.from("crew_offers")
      .select("*, crew:crew_id(*)")
      .eq("owner_id", user.id).neq("status","declined");
    const combined = [
      ...(props||[]).map(p=>({...p, kind:"proposal"})),
      ...(offers||[]).map(o=>({...o, kind:"offer"})),
    ];
    setPossibles(combined);
  };

  const updatePossible = async (item, newStatus) => {
    const table = item.kind==="proposal" ? "crew_proposals" : "crew_offers";
    const field = item.kind==="proposal" ? "owner_status" : "status";
    await supabase.from(table).update({ [field]:newStatus }).eq("id", item.id);
    loadPossibles();
  };

  const loadAssigned = async () => {
    const { data } = await supabase.from("captain_profiles").select("*, user:user_id(email)").eq("vessel_id", vessel.id);
    setAssignedCrew(data || []);
  };

  const assignCrew = async () => {
    if (!assignForm.email.trim() || !assignForm.full_name.trim()) { setAssignMsg("Completa nombre y email"); return; }
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", assignForm.email.trim()).maybeSingle();
    if (!prof) { setAssignMsg("⚠️ Ese email no tiene cuenta en Carive. Pídele que se registre primero."); return; }
    const { error } = await supabase.from("captain_profiles").insert({
      user_id:prof.id, vessel_id:vessel.id, full_name:assignForm.full_name.trim(),
      role:assignForm.role, phone:assignForm.phone.trim(), active:true,
    });
    if (error) { setAssignMsg("Error: "+error.message); return; }
    setAssignMsg("✅ Agregado. Al iniciar sesión verá la vista de tripulante de este barco.");
    setAssignForm({ email:"", full_name:"", role:"Capitán", phone:"" });
    loadAssigned();
    setTimeout(()=>setAssignMsg(""),4000);
  };

  const removeAssigned = async (cap) => {
    await supabase.from("captain_profiles").delete().eq("id", cap.id);
    loadAssigned();
  };

  const updateCaptainPerms = async (capId, fields) => {
    await supabase.from("captain_profiles").update(fields).eq("id", capId);
    loadAssigned();
  };

  const loadApplications = async () => {
    // Aplicaciones recibidas para este barco (crew aplicó)
    const { data } = await supabase.from("connections")
      .select("*, crew:crew_id(*)")
      .eq("vessel_id", vessel.id)
      .order("created_at", { ascending: false });
    setApplications(data || []);
    const ar = await getReputations((data||[]).map(a=>a.crew_id));
    setReps(prev=>({...prev, ...ar}));
    setLoading(false);
  };

  const loadConnections = async () => {
    const { data } = await supabase.from("connections")
      .select("*").eq("owner_id", user.id);
    setMyConnections(data || []);
  };

  const searchCrew = async () => {
    setLoading(true);
    // Buscar tripulantes verificados y disponibles
    let q = supabase.from("profiles").select("*")
      .eq("role", "crew").eq("available", true);
    const { data } = await q.limit(50);
    let results = data || [];
    // Filtrar por búsqueda y rol en cliente
    if (search.trim()) {
      const s = search.toLowerCase();
      results = results.filter(c =>
        (c.full_name||"").toLowerCase().includes(s) ||
        (c.bio||"").toLowerCase().includes(s) ||
        (c.nationality||"").toLowerCase().includes(s)
      );
    }
    if (roleFilter) results = results.filter(c => c.crew_role===roleFilter || c.secondary_role===roleFilter);
    setCrew(results);
    const r = await getReputations(results.map(c=>c.id));
    setReps(prev=>({...prev, ...r}));
    setLoading(false);
  };

  // Dueño acepta una aplicación de tripulante → match
  const acceptApplication = async (conn) => {
    await supabase.from("connections").update({ status:"matched", owner_id:user.id }).eq("id", conn.id);
    setMsg("✅ ¡Match! Ya puedes chatear con el tripulante");
    setTimeout(()=>setMsg(""),4000);
    loadApplications();
  };

  const rejectApplication = async (conn) => {
    await supabase.from("connections").update({ status:"rejected" }).eq("id", conn.id);
    setMsg("Aplicación rechazada");
    setTimeout(()=>setMsg(""),3000);
    loadApplications();
  };

  // Dueño invita a un tripulante (desde búsqueda)
  const inviteCrew = async (crewProfile) => {
    const existing = myConnections.find(c => c.crew_id===crewProfile.id && c.vessel_id===vessel.id);
    if (existing) { setMsg("⚠️ Ya tienes una conexión con este tripulante"); setTimeout(()=>setMsg(""),3000); return; }
    const { error } = await supabase.from("connections").insert({
      vessel_id:vessel.id, owner_id:user.id, crew_id:crewProfile.id,
      initiated_by:"owner_invited", status:"pending",
      crew_role:crewProfile.crew_role||"Marinero",
      message:`Interesado en tu perfil para mi ${vessel.type}`,
    });
    if (error?.code==="23505") setMsg("⚠️ Ya invitaste a este tripulante");
    else if (error) setMsg("⚠️ Error: "+error.message);
    else { setMsg("✅ ¡Invitación enviada! El tripulante la revisará"); loadConnections(); }
    setTimeout(()=>setMsg(""),4000);
  };

  const pendingApps = applications.filter(a => a.status==="pending" && a.initiated_by==="crew_applied");
  const matches = applications.filter(a => a.status==="matched");
  const possibleCount = possibles.length;

  const BADGE_ICONS = {verified:"✅",stcw:"📜","5years":"⭐","10years":"🏆","3boats":"🚢",captain:"⚓",bilingual:"🌐",passport:"🛂"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:680,height:"85vh",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>Tripulación</div>
            <div style={{fontSize:11,color:"#64748b"}}>Gestiona aplicaciones y busca tripulantes para {vessel.name}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #e2e8f0",padding:"0 12px"}}>
          {[
            {key:"miequipo",label:"Mi Tripulación"},
            {key:"daytrips",label:"Day Trips"},
            {key:"buscar",label:"Buscar Tripulación"},
            {key:"posibles",label:`Posible Tripulación${possibleCount>0?` (${possibleCount})`:""}`},
            {key:"aplicaciones",label:`Aplicaciones${pendingApps.length>0?` (${pendingApps.length})`:""}`},
            {key:"matches",label:`Matches${matches.length>0?` (${matches.length})`:""}`},
          ].map(t=>(
            <button key={t.key} onClick={()=>{setTab(t.key); if(t.key==="buscar"&&crew.length===0)searchCrew();}} style={{
              padding:"12px 14px",background:"none",border:"none",borderBottom:tab===t.key?"2px solid #0ea5e9":"2px solid transparent",
              cursor:"pointer",fontSize:13,color:tab===t.key?"#0ea5e9":"#64748b",fontWeight:tab===t.key?700:400
            }}>{t.label}</button>
          ))}
        </div>

        {/* Contenido */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 20px",background:"#f8fafc"}}>

          {/* ── APLICACIONES RECIBIDAS ── */}
          {tab==="aplicaciones"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {pendingApps.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:8}}>📥</div>
                  <div style={{fontWeight:600}}>Sin aplicaciones pendientes</div>
                  <div style={{fontSize:12,marginTop:4}}>Cuando un tripulante aplique aparecerá aquí</div>
                </div>
              )}
              {pendingApps.map(app=>(
                <CrewCard key={app.id} crew={app.crew} rep={reps[app.crew_id]} badgeIcons={BADGE_ICONS}
                  onView={()=>setSelectedCrew(app.crew)}
                  actions={
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>acceptApplication(app)} style={{flex:1,padding:"8px",background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Aceptar</button>
                      <button onClick={()=>rejectApplication(app)} style={{flex:1,padding:"8px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#dc2626",fontSize:12,fontWeight:700,cursor:"pointer"}}>Rechazar</button>
                    </div>
                  }/>
              ))}
            </div>
          )}

          {/* ── BUSCAR TRIPULANTES ── */}
          {tab==="buscar"&&(
            <CrewSearch vessel={vessel} user={user} onPublished={loadPossibles}/>
          )}

          {/* ── POSIBLE TRIPULACIÓN ── */}
          {tab==="posibles"&&(
            <div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Capitanes y tripulantes interesados en trabajar contigo. Revisa su perfil, contáctalos o guárdalos para después.</div>
              {possibles.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontWeight:600}}>Sin candidatos por ahora</div>
                  <div style={{fontSize:12,marginTop:4}}>Cuando publiques una búsqueda y alguien se interese, aparecerá aquí</div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {possibles.map(item=>{
                  const c = item.crew||{};
                  const name = c.full_name?.trim() || `${c.first_name||""} ${c.last_name||""}`.trim() || "Tripulante";
                  const saved = (item.owner_status==="saved"||item.status==="saved");
                  return (
                    <div key={item.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16}}>
                      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                        {c.photo_url
                          ? <img src={c.photo_url} style={{width:52,height:52,borderRadius:"50%",objectFit:"cover"}} alt=""/>
                          : <div style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18}}>{name[0].toUpperCase()}</div>}
                        <div style={{flex:1}}>
                          <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{name}</div>
                          <div style={{fontSize:11,color:"#64748b"}}>{c.crew_role||""}{c.work_zone?` · ${c.work_zone}`:""}{item.search?.role?` · busca: ${item.search.role}`:""}</div>
                          {reps[c.id]&&<Stars avg={reps[c.id].avg} count={reps[c.id].count} size={12}/>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setSelectedCrew(c)} style={{flex:1,padding:"8px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:12,fontWeight:700,cursor:"pointer"}}>Ver perfil</button>
                        <button onClick={()=>{ updatePossible(item,"contacted"); inviteCrew(c); }} style={{flex:1,padding:"8px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Contactar</button>
                        <button onClick={()=>updatePossible(item, saved?"new":"saved")} style={{flex:1,padding:"8px",background:saved?"#fef9c3":"#fff",border:"1px solid #e2e8f0",borderRadius:8,color:saved?"#a16207":"#64748b",fontSize:12,fontWeight:700,cursor:"pointer"}}>{saved?"Guardado":"Guardar"}</button>
                        <button onClick={()=>updatePossible(item,"declined")} style={{flex:1,padding:"8px",background:"#fff",border:"1px solid #fecaca",borderRadius:8,color:"#dc2626",fontSize:12,fontWeight:700,cursor:"pointer"}}>Declinar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MATCHES ── */}
          {tab==="matches"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {matches.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:8}}>🤝</div>
                  <div style={{fontWeight:600}}>Sin matches aún</div>
                </div>
              )}
              {matches.map(app=>(
                <CrewCard key={app.id} crew={app.crew} rep={reps[app.crew_id]} badgeIcons={BADGE_ICONS}
                  onView={()=>setSelectedCrew(app.crew)}
                  actions={
                    <button onClick={()=>setActiveChat(app)} style={{width:"100%",padding:"8px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,color:"#2563eb",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      💬 Chatear
                    </button>
                  }/>
              ))}
            </div>
          )}
          {/* ── DAY TRIPS ── */}
          {tab==="daytrips"&&(
            <DayTripsOwner vessel={vessel} user={user}/>
          )}

          {/* ── MI TRIPULACIÓN (asignar capitanes con cuenta) ── */}
          {tab==="miequipo"&&(
            <div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>Asigna capitanes o tripulantes que ya tienen cuenta. Al iniciar sesión verán la vista de este barco.</div>

              {/* Lista de asignados */}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
                {assignedCrew.length===0&&(
                  <div style={{textAlign:"center",padding:"24px 0",color:"#94a3b8"}}>
                    <div style={{fontSize:32,marginBottom:6}}>⚓</div>
                    <div style={{fontWeight:600,fontSize:13}}>Sin tripulación asignada</div>
                  </div>
                )}
                {assignedCrew.map(cap=>(
                  <div key={cap.id} style={{padding:"12px 14px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{(cap.full_name||"?")[0].toUpperCase()}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{cap.full_name}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{cap.role} · {cap.user?.email}</div>
                      </div>
                      <button onClick={()=>removeAssigned(cap)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:16}}>🗑</button>
                    </div>
                    {/* Permisos del capitán */}
                    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #f1f5f9",display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:"#374151"}}>Tope para pedir repuestos</div>
                          <div style={{fontSize:10,color:"#94a3b8"}}>Sobre este monto, te pedirá aprobación</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:13,color:"#64748b"}}>$</span>
                          <input type="number" defaultValue={cap.parts_limit??100} onBlur={e=>updateCaptainPerms(cap.id,{parts_limit:parseFloat(e.target.value)||0})} style={{width:70,padding:"6px 8px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,textAlign:"right"}}/>
                        </div>
                      </div>
                      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                        <input type="checkbox" defaultChecked={cap.can_edit_providers||false} onChange={e=>updateCaptainPerms(cap.id,{can_edit_providers:e.target.checked})} style={{width:15,height:15}}/>
                        <span style={{fontSize:12,color:"#374151"}}>Puede agregar y editar proveedores</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form asignar */}
              <div style={{background:"#fff",border:"1.5px solid #bfdbfe",borderRadius:12,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,color:"#1d4ed8",marginBottom:12}}>Asignar a mi barco</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <input value={assignForm.full_name} onChange={e=>setAssignForm({...assignForm,full_name:e.target.value})} placeholder="Nombre completo" style={{padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13}}/>
                  <select value={assignForm.role} onChange={e=>setAssignForm({...assignForm,role:e.target.value})} style={{padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13}}>
                    {["Capitán","Primer Oficial","Jefe de Máquinas","Electricista","Marinero","Chef","Camarero","Mecánico"].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <input value={assignForm.email} onChange={e=>setAssignForm({...assignForm,email:e.target.value})} placeholder="Email (debe tener cuenta en Carive)" style={{width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,marginBottom:8,boxSizing:"border-box"}}/>
                <input value={assignForm.phone} onChange={e=>setAssignForm({...assignForm,phone:e.target.value})} placeholder="Teléfono (opcional)" style={{width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,marginBottom:12,boxSizing:"border-box"}}/>
                <button onClick={assignCrew} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Asignar</button>
                {assignMsg&&<div style={{fontSize:11,color:assignMsg.startsWith("✅")?"#16a34a":"#dc2626",marginTop:8,textAlign:"center"}}>{assignMsg}</div>}
              </div>
            </div>
          )}
        </div>

        {msg&&(
          <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:10}}>{msg}</div>
        )}
      </div>

      {/* Perfil expandido del tripulante */}
      {selectedCrew&&(
        <CrewProfileDetail crew={selectedCrew} badgeIcons={BADGE_ICONS} onClose={()=>setSelectedCrew(null)}/>
      )}

      {/* Chat */}
      {activeChat&&(
        <ChatPanel connection={activeChat} currentUserId={user.id} otherName={activeChat.crew?.full_name||"Tripulante"} onClose={()=>{setActiveChat(null);loadApplications();}}/>
      )}
    </div>
  );
}

// Tarjeta compacta de tripulante
function CrewCard({ crew, rep, badgeIcons, onView, actions }) {
  if (!crew) return null;
  const badges = crew.badges||[];
  const name = crew.full_name?.trim() || `${crew.first_name||""} ${crew.last_name||""}`.trim() || "Tripulante";
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        {crew.photo_url
          ? <img src={crew.photo_url} style={{width:52,height:52,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
          : <div style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,flexShrink:0}}>{name[0].toUpperCase()}</div>
        }
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{name}</div>
          <div style={{fontSize:12,color:"#0ea5e9",fontWeight:600}}>{crew.crew_role}{crew.secondary_role?` · ${crew.secondary_role}`:""}</div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{crew.nationality}{(crew.languages||[]).length?` · ${(crew.languages||[]).join(", ")}`:""}</div>
          {rep&&<div style={{marginTop:3}}><Stars avg={rep.avg} count={rep.count} size={12}/></div>}
          {badges.length>0&&(
            <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
              {badges.map(b=><span key={b} style={{fontSize:13}} title={b}>{badgeIcons[b]||"🏅"}</span>)}
            </div>
          )}
        </div>
      </div>
      <button onClick={onView} style={{width:"100%",marginTop:10,marginBottom:8,padding:"7px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>Ver perfil completo</button>
      {actions}
    </div>
  );
}

// Modal con el perfil completo del tripulante (sin contacto)
function CrewProfileDetail({ crew, badgeIcons, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1500,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        {/* Header con foto */}
        <div style={{padding:"24px 24px 18px",borderBottom:"1px solid #e2e8f0",textAlign:"center",position:"relative"}}>
          <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
          {crew.photo_url
            ? <img src={crew.photo_url} style={{width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid #0ea5e9",margin:"0 auto"}} alt=""/>
            : <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",color:"#fff",fontSize:30,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>{(crew.full_name||"?")[0].toUpperCase()}</div>
          }
          <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginTop:12}}>{crew.full_name}</div>
          <div style={{fontSize:13,color:"#0ea5e9",fontWeight:600}}>{crew.crew_role}{crew.secondary_role?` · ${crew.secondary_role}`:""}</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{crew.nationality}</div>
          {(crew.badges||[]).length>0&&(
            <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
              {(crew.badges||[]).map(b=><span key={b} style={{fontSize:18}}>{badgeIcons[b]||"🏅"}</span>)}
            </div>
          )}
        </div>

        <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:16}}>
          {/* Idiomas */}
          {(crew.languages||[]).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:"0.06em",marginBottom:6}}>IDIOMAS</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {(crew.languages||[]).map(l=><span key={l} style={{fontSize:12,padding:"3px 10px",background:"#eff6ff",borderRadius:16,color:"#2563eb"}}>{l}</span>)}
              </div>
            </div>
          )}
          {/* Bio */}
          {crew.bio&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:"0.06em",marginBottom:6}}>SOBRE MÍ</div>
              <div style={{fontSize:13,color:"#475569",lineHeight:1.5}}>{crew.bio}</div>
            </div>
          )}
          {/* Experiencia */}
          {(crew.experience||[]).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:"0.06em",marginBottom:6}}>EXPERIENCIA</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {(crew.experience||[]).map((e,i)=>(
                  <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{e.brand} {e.length&&`· ${e.length} pies`}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{e.role}{e.period&&` · ${e.period}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Certificaciones */}
          {(crew.certifications||[]).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:"0.06em",marginBottom:6}}>CERTIFICACIONES</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {(crew.certifications||[]).map((c,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#475569"}}>
                    <span>📜</span><span>{c.name==="Otro"?c.custom_name:c.name}</span>
                    {c.expiry&&<span style={{fontSize:11,color:"#94a3b8"}}>· vence {c.expiry}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Dato curioso */}
          {crew.fun_facts?.playa_favorita&&(
            <div style={{background:"linear-gradient(135deg,#fffbeb,#fff7ed)",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:2}}>Playa favorita</div>
              <div style={{fontSize:13,color:"#b45309"}}>{crew.fun_facts.playa_favorita}</div>
            </div>
          )}

          <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",borderTop:"1px solid #f1f5f9",paddingTop:14}}>
            🔒 El contacto se comparte al hacer match
          </div>
        </div>
      </div>
    </div>
  );
}
