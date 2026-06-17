// Vista completa del perfil de tripulación
// Incluye: perfil, certificaciones, historial, badges, búsqueda de barco

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const CREW_ROLES = ["Capitán","Primer Oficial","Marinero","Mecánico","Contramaestre","Cocinero","Marinero de Cubierta","Otro"];

const CERT_OPTIONS = [
  "STCW Básico","Licencia de Capitán","Primeros Auxilios Marítimo",
  "Seguridad Contraincendios","Supervivencia en el Mar","Radar ARPA",
  "GMDSS Operador","Buceo","Licencia Costera","Licencia de Pesca",
];

const BADGE_DEFS = [
  { id:"100h",    icon:"⚡", label:"100h de Motor",    desc:"100+ horas de motor registradas" },
  { id:"500h",    icon:"🔥", label:"500h de Motor",    desc:"500+ horas de motor registradas" },
  { id:"5years",  icon:"⭐", label:"5 Años de Exp.",   desc:"5+ años de experiencia" },
  { id:"10years", icon:"🏆", label:"10 Años de Exp.",  desc:"10+ años de experiencia" },
  { id:"3boats",  icon:"🚢", label:"3 Barcos",         desc:"Ha trabajado en 3+ embarcaciones" },
  { id:"stcw",    icon:"📜", label:"STCW Certificado", desc:"Tiene certificación STCW vigente" },
];

export default function CrewProfile({ user, onLogout, onSwitchToOwner }) {
  const [profile,    setProfile]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [tab,        setTab]        = useState("profile");
  const [vessels,    setVessels]    = useState([]);
  const [requests,   setRequests]   = useState([]);
  const [search,     setSearch]     = useState("");
  const [searchRes,  setSearchRes]  = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [msg,        setMsg]        = useState("");

  useEffect(() => { loadProfile(); loadRequests(); }, []);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data || {
      full_name:"", bio:"", phone:"", crew_role:"Capitán",
      certifications:[], experience:[], badges:[], available:true, location:""
    });
    setLoading(false);
  };

  const loadRequests = async () => {
    const { data } = await supabase.from("vessel_requests")
      .select("*, vessel:vessel_id(name, marina, type)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests(data || []);
  };

  const saveProfile = async () => {
    setSaving(true);
    const badges = computeBadges(profile);
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      ...profile,
      badges,
      updated_at: new Date().toISOString(),
    });
    setProfile(p => ({ ...p, badges }));
    setMsg("✅ Perfil guardado");
    setTimeout(() => setMsg(""), 3000);
    setSaving(false);
  };

  const computeBadges = (p) => {
    const earned = [];
    const years = p.experience?.length || 0;
    const hasCerts = (p.certifications||[]).some(c => c.name?.includes("STCW"));
    const boats = (p.experience||[]).length;
    if (years >= 5)  earned.push("5years");
    if (years >= 10) earned.push("10years");
    if (boats >= 3)  earned.push("3boats");
    if (hasCerts)    earned.push("stcw");
    return earned;
  };

  const searchVessels = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const { data } = await supabase.from("vessels")
      .select("id, name, type, marina, captain")
      .ilike("name", `%${search}%`)
      .limit(10);
    setSearchRes(data || []);
    setSearching(false);
  };

  const sendRequest = async (vessel) => {
    const { error } = await supabase.from("vessel_requests").insert({
      vessel_id: vessel.id,
      user_id:   user.id,
      type:      "crew_request",
      status:    "pending",
      role:      profile.crew_role || "Marinero",
      message:   `${profile.full_name || user.email} solicita unirse como ${profile.crew_role || "Marinero"}`,
    });
    if (error) {
      if (error.code === "23505") setMsg("⚠️ Ya enviaste una solicitud a este barco");
      else setMsg("Error: " + error.message);
    } else {
      setMsg("✅ Solicitud enviada al propietario");
      loadRequests();
    }
    setTimeout(() => setMsg(""), 4000);
  };

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f7ff"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:40}}>⚓</div><div style={{color:"#64748b",marginTop:8}}>Cargando perfil...</div></div>
    </div>
  );

  const badges = BADGE_DEFS.filter(b => (profile.badges||[]).includes(b.id));

  return (
    <div style={s.root}>
      {/* NAV */}
      <nav style={s.nav}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" fill="#0ea5e9" opacity=".15"/>
            <path d="M15 4 L27 24 H3 Z" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinejoin="round"/>
            <line x1="15" y1="4" x2="15" y2="24" stroke="#0ea5e9" strokeWidth="1.4"/>
            <path d="M5 24 Q15 19 25 24" stroke="#0ea5e9" strokeWidth="2" fill="none"/>
          </svg>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:"#0f172a",lineHeight:1}}>NautiTrack</div>
            <div style={{fontSize:10,color:"#64748b"}}>Perfil Tripulación</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {["profile","vessels","requests"].map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"6px 12px",background:tab===t?"#eff6ff":"transparent",
              border:"none",borderRadius:8,cursor:"pointer",fontSize:12,
              color:tab===t?"#2563eb":"#64748b",fontWeight:tab===t?700:400
            }}>
              {t==="profile"?"👤 Mi Perfil":t==="vessels"?"🔍 Buscar Barco":"📬 Solicitudes"}
              {t==="requests"&&requests.filter(r=>r.status==="pending").length>0&&(
                <span style={{marginLeft:4,background:"#ef4444",color:"#fff",borderRadius:"50%",padding:"1px 5px",fontSize:10}}>
                  {requests.filter(r=>r.status==="pending").length}
                </span>
              )}
            </button>
          ))}
          <button onClick={onLogout} style={{padding:"6px 10px",background:"none",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:11,color:"#94a3b8",marginLeft:8}}>
            Salir
          </button>
        </div>
      </nav>

      <div style={s.content}>

        {/* ── PERFIL ── */}
        {tab==="profile" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

            {/* Columna izquierda — info principal */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Card principal */}
              <div style={s.card}>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
                  <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:800,flexShrink:0}}>
                    {(profile.full_name||user.email||"?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontSize:18,fontWeight:800,color:"#0f172a"}}>{profile.full_name||"Tu nombre"}</div>
                    <div style={{fontSize:13,color:"#0ea5e9",fontWeight:600}}>{profile.crew_role||"Capitán"}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{user.email}</div>
                  </div>
                </div>

                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <label style={s.label}>Nombre completo</label>
                      <input value={profile.full_name||""} onChange={e=>set("full_name",e.target.value)} placeholder="Tu nombre" style={s.input}/>
                    </div>
                    <div>
                      <label style={s.label}>Teléfono</label>
                      <input value={profile.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="+58412..." style={s.input}/>
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Rol principal</label>
                    <select value={profile.crew_role||"Capitán"} onChange={e=>set("crew_role",e.target.value)} style={s.input}>
                      {CREW_ROLES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Ubicación</label>
                    <input value={profile.location||""} onChange={e=>set("location",e.target.value)} placeholder="Ej: Puerto La Cruz, Venezuela" style={s.input}/>
                  </div>
                  <div>
                    <label style={s.label}>CV breve / Bio</label>
                    <textarea value={profile.bio||""} onChange={e=>set("bio",e.target.value)}
                      placeholder="Capitán con 10 años de experiencia en el oriente venezolano. Especialista en yates de motor de 40-70 pies..."
                      rows={4} style={{...s.input,resize:"vertical"}}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <input type="checkbox" checked={profile.available||false} onChange={e=>set("available",e.target.checked)} id="avail"/>
                    <label htmlFor="avail" style={{fontSize:13,color:"#475569",cursor:"pointer"}}>
                      🟢 Disponible para trabajo
                    </label>
                  </div>
                </div>
              </div>

              {/* Badges */}
              {badges.length > 0 && (
                <div style={s.card}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:12}}>🏅 Badges Ganados</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {badges.map(b=>(
                      <div key={b.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"linear-gradient(135deg,#fef9c3,#fde68a)",border:"1px solid #f59e0b",borderRadius:20}}>
                        <span style={{fontSize:16}}>{b.icon}</span>
                        <span style={{fontSize:11,fontWeight:700,color:"#92400e"}}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Columna derecha — certificaciones y experiencia */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Certificaciones */}
              <div style={s.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>📜 Certificaciones</div>
                  <button onClick={()=>set("certifications",[...(profile.certifications||[]),{name:"",date:"",expiry:""}])}
                    style={{fontSize:11,padding:"4px 10px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,cursor:"pointer",color:"#2563eb",fontWeight:600}}>
                    ＋ Agregar
                  </button>
                </div>
                {(profile.certifications||[]).length===0 && (
                  <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>Sin certificaciones agregadas</div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(profile.certifications||[]).map((cert,i)=>(
                    <div key={i} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{display:"flex",gap:8,marginBottom:6}}>
                        <select value={cert.name} onChange={e=>{const c=[...(profile.certifications||[])];c[i]={...c[i],name:e.target.value};set("certifications",c);}}
                          style={{...s.input,fontSize:11,padding:"5px 8px",flex:1}}>
                          <option value="">Seleccionar...</option>
                          {CERT_OPTIONS.map(o=><option key={o}>{o}</option>)}
                        </select>
                        <button onClick={()=>{const c=[...(profile.certifications||[])];c.splice(i,1);set("certifications",c);}}
                          style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:14,padding:"0 4px"}}>✕</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        <div>
                          <div style={{fontSize:10,color:"#94a3b8",marginBottom:2}}>Fecha obtención</div>
                          <input type="date" value={cert.date||""} onChange={e=>{const c=[...(profile.certifications||[])];c[i]={...c[i],date:e.target.value};set("certifications",c);}} style={{...s.input,fontSize:11,padding:"5px 8px"}}/>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:"#94a3b8",marginBottom:2}}>Vencimiento</div>
                          <input type="date" value={cert.expiry||""} onChange={e=>{const c=[...(profile.certifications||[])];c[i]={...c[i],expiry:e.target.value};set("certifications",c);}} style={{...s.input,fontSize:11,padding:"5px 8px"}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Experiencia */}
              <div style={s.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>🚢 Historial de Barcos</div>
                  <button onClick={()=>set("experience",[...(profile.experience||[]),{vessel:"",type:"",years:"",role:"",notes:""}])}
                    style={{fontSize:11,padding:"4px 10px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,cursor:"pointer",color:"#2563eb",fontWeight:600}}>
                    ＋ Agregar
                  </button>
                </div>
                {(profile.experience||[]).length===0 && (
                  <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>Sin experiencia agregada</div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(profile.experience||[]).map((exp,i)=>(
                    <div key={i} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{display:"flex",gap:8,marginBottom:6}}>
                        <input value={exp.vessel||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],vessel:e.target.value};set("experience",x);}}
                          placeholder="Nombre del barco" style={{...s.input,fontSize:12,padding:"5px 8px",flex:1}}/>
                        <button onClick={()=>{const x=[...(profile.experience||[])];x.splice(i,1);set("experience",x);}}
                          style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:14,padding:"0 4px"}}>✕</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        <input value={exp.role||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],role:e.target.value};set("experience",x);}}
                          placeholder="Rol (Capitán...)" style={{...s.input,fontSize:11,padding:"5px 8px"}}/>
                        <input value={exp.years||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],years:e.target.value};set("experience",x);}}
                          placeholder="Años / período" style={{...s.input,fontSize:11,padding:"5px 8px"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── BUSCAR BARCO ── */}
        {tab==="vessels" && (
          <div style={{maxWidth:600,margin:"0 auto"}}>
            <div style={s.card}>
              <div style={{fontSize:16,fontWeight:700,color:"#0f172a",marginBottom:4}}>🔍 Buscar Embarcación</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Busca el barco donde quieres trabajar y envía una solicitud al propietario</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&searchVessels()}
                  placeholder="Nombre del barco..." style={{...s.input,flex:1}}/>
                <button onClick={searchVessels} disabled={searching}
                  style={{padding:"10px 16px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
                  {searching?"...":"Buscar"}
                </button>
              </div>

              {searchRes.length===0&&search&&!searching&&(
                <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                  No se encontraron embarcaciones con ese nombre
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {searchRes.map(v=>{
                  const alreadyRequested = requests.some(r=>r.vessel_id===v.id);
                  return (
                    <div key={v.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                      <div style={{fontSize:28}}>🚢</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{v.name}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{v.type} · {v.marina}</div>
                        {v.captain&&<div style={{fontSize:11,color:"#94a3b8"}}>Cap. {v.captain}</div>}
                      </div>
                      <button onClick={()=>!alreadyRequested&&sendRequest(v)} style={{
                        padding:"8px 14px",border:"none",borderRadius:8,cursor:alreadyRequested?"default":"pointer",
                        background:alreadyRequested?"#f1f5f9":"linear-gradient(135deg,#1d4ed8,#0ea5e9)",
                        color:alreadyRequested?"#94a3b8":"#fff",fontSize:12,fontWeight:700,
                      }}>
                        {alreadyRequested?"✓ Enviado":"Solicitar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SOLICITUDES ── */}
        {tab==="requests" && (
          <div style={{maxWidth:600,margin:"0 auto"}}>
            <div style={s.card}>
              <div style={{fontSize:16,fontWeight:700,color:"#0f172a",marginBottom:16}}>📬 Mis Solicitudes</div>
              {requests.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📬</div>
                  Sin solicitudes enviadas
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {requests.map(r=>(
                  <div key={r.id} style={{padding:"12px 16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{r.vessel?.name}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{r.vessel?.type} · {r.vessel?.marina}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Rol solicitado: {r.role}</div>
                      </div>
                      <span style={{
                        padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                        background:r.status==="accepted"?"#f0fdf4":r.status==="rejected"?"#fff5f5":"#fffbeb",
                        color:r.status==="accepted"?"#16a34a":r.status==="rejected"?"#dc2626":"#d97706",
                        border:`1px solid ${r.status==="accepted"?"#bbf7d0":r.status==="rejected"?"#fecaca":"#fde68a"}`,
                      }}>
                        {r.status==="accepted"?"✅ Aceptado":r.status==="rejected"?"❌ Rechazado":"⏳ Pendiente"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {msg&&(
          <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:999}}>
            {msg}
          </div>
        )}
      </div>

      {/* Botón guardar flotante */}
      {tab==="profile"&&(
        <div style={{position:"fixed",bottom:24,right:24}}>
          <button onClick={saveProfile} disabled={saving} style={{padding:"12px 24px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(29,78,216,0.4)",opacity:saving?0.7:1}}>
            {saving?"⏳ Guardando...":"💾 Guardar Perfil"}
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  root:    { minHeight:"100vh", background:"#f0f7ff", fontFamily:"'Segoe UI',system-ui,sans-serif" },
  nav:     { background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 },
  content: { maxWidth:1100, margin:"0 auto", padding:"24px 28px" },
  card:    { background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:"20px 24px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" },
  label:   { display:"block", fontSize:11, fontWeight:600, color:"#374151", marginBottom:5 },
  input:   { width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13, color:"#1e293b", background:"#fff", boxSizing:"border-box", outline:"none" },
};
