import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export default function Auth({ onLogin }) {
  const [mode, setMode]           = useState("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [userRole, setUserRole]   = useState("owner"); // 'owner' | 'crew' | 'store'
  const [boatRole, setBoatRole]   = useState("");      // '' | 'dueno' | 'gerente'
  const [hasCrew, setHasCrew]     = useState("");      // '' | 'si' | 'no'
  const [linkContact, setLinkContact] = useState("");  // email o teléfono del tripulante a vincular
  const [ownerContacts, setOwnerContacts] = useState([{ name:"", phone:"" }]); // dueños que reporta el gerente
  const [reportFreq, setReportFreq] = useState("semanal"); // semanal / quincenal / mensual
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  // Clear any error hashes from URL on mount
  useEffect(() => {
    if (window.location.hash.includes("error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { setError("Completa todos los campos"); return; }
    setLoading(true); setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError("Email o contraseña incorrectos"); setLoading(false); return; }
    onLogin(data.user);
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPwd || !firstName || !lastName) { setError("Completa todos los campos"); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirmPwd) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true); setError("");
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    if (data.user) {
      const isManager = userRole==="owner" && boatRole==="gerente";
      const profileData = {
        id: data.user.id, email, full_name: `${firstName} ${lastName}`.trim(), role: userRole,
      };
      if (userRole==="owner") {
        profileData.is_manager = isManager;
        if (isManager) {
          profileData.managed_owners = ownerContacts.filter(o=>o.name.trim()||o.phone.trim());
          profileData.report_freq = reportFreq;
        }
      }
      await supabase.from("profiles").upsert(profileData);
      // Si el dueño indicó un tripulante a vincular, lo guardamos como pendiente para enlazar luego
      if (userRole==="owner" && boatRole==="dueno" && hasCrew==="si" && linkContact.trim()) {
        localStorage.setItem("nt_link_crew", linkContact.trim());
      }
      console.log("[Carive] Cuenta creada con role:", userRole, "manager:", isManager);
      const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
      if (loginData?.user) { onLogin({...loginData.user, role: userRole, full_name: `${firstName} ${lastName}`.trim()}); return; }
      setSuccess("¡Cuenta creada! Ya puedes iniciar sesión.");
    }
    setLoading(false);
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <svg width="52" height="52" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" fill="#0ea5e9" opacity=".15"/>
            <path d="M15 4 L27 24 H3 Z" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinejoin="round"/>
            <line x1="15" y1="4" x2="15" y2="24" stroke="#0ea5e9" strokeWidth="1.4"/>
            <path d="M5 24 Q15 19 25 24" stroke="#0ea5e9" strokeWidth="2" fill="none"/>
          </svg>
          <div style={s.brand}>Carive<span style={{color:"#2563eb"}}>.VZ</span></div>
          <div style={s.tagline}>Gestión inteligente de embarcaciones</div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button onClick={()=>{setMode("login");setError("");setSuccess("");}} style={{...s.tab,borderBottom:mode==="login"?"2px solid #0ea5e9":"2px solid transparent",color:mode==="login"?"#0ea5e9":"#64748b",fontWeight:mode==="login"?600:400}}>
            Iniciar Sesión
          </button>
          <button onClick={()=>{setMode("register");setError("");setSuccess("");}} style={{...s.tab,borderBottom:mode==="register"?"2px solid #0ea5e9":"2px solid transparent",color:mode==="register"?"#0ea5e9":"#64748b",fontWeight:mode==="register"?600:400}}>
            Crear Cuenta
          </button>
        </div>

        {/* Form */}
        <div style={s.form}>
          {mode==="register"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <label style={s.label}>Nombre *</label>
                  <input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Carlos" style={s.input}/>
                </div>
                <div>
                  <label style={s.label}>Apellido *</label>
                  <input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Mendoza" style={s.input}/>
                </div>
              </div>
            </div>
          )}
          {mode==="register"&&(
            <div>
              <label style={s.label}>¿Qué eres?</label>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button type="button" onClick={()=>setUserRole("owner")} style={roleCard(userRole==="owner")}>
                  <div style={{fontSize:13,fontWeight:700,color:userRole==="owner"?"#2563eb":"#0f172a"}}>Barco</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Eres dueño de una embarcación o gerencias una, y quieres organizar todo lo del barco en un solo lugar.</div>
                </button>
                <button type="button" onClick={()=>setUserRole("crew")} style={roleCard(userRole==="crew")}>
                  <div style={{fontSize:13,fontWeight:700,color:userRole==="crew"?"#2563eb":"#0f172a"}}>Tripulante</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Eres capitán, marinero o azafata y quieres abrir tu campo laboral.</div>
                </button>
                <button type="button" onClick={()=>setUserRole("store")} style={roleCard(userRole==="store")}>
                  <div style={{fontSize:13,fontWeight:700,color:userRole==="store"?"#2563eb":"#0f172a"}}>Tienda</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Tienes una tienda de artículos marinos y quieres expandir tu clientela.</div>
                </button>
              </div>

              {/* Sub-flujo BARCO: dueño o gerente */}
              {userRole==="owner"&&(
                <div style={{marginTop:14,padding:14,background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
                  <label style={s.label}>¿Cuál es tu caso?</label>
                  <div style={{display:"flex",gap:8,marginBottom:boatRole?12:0}}>
                    <button type="button" onClick={()=>setBoatRole("dueno")} style={pill(boatRole==="dueno")}>Soy el dueño</button>
                    <button type="button" onClick={()=>setBoatRole("gerente")} style={pill(boatRole==="gerente")}>Soy el gerente</button>
                  </div>

                  {/* DUEÑO → ¿tiene tripulación? */}
                  {boatRole==="dueno"&&(
                    <div>
                      <label style={s.label}>Tripulación</label>
                      <div style={{display:"flex",gap:8,marginBottom:hasCrew?12:0}}>
                        <button type="button" onClick={()=>setHasCrew("si")} style={pill(hasCrew==="si")}>Tengo tripulación</button>
                        <button type="button" onClick={()=>setHasCrew("no")} style={pill(hasCrew==="no")}>No tengo</button>
                      </div>
                      {hasCrew==="si"&&(
                        <div>
                          <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>Vincula a tu tripulante por su email o teléfono. Si aún no tiene cuenta, podrás invitarlo después.</div>
                          <input value={linkContact} onChange={e=>setLinkContact(e.target.value)} placeholder="Email o teléfono del tripulante" style={s.input}/>
                        </div>
                      )}
                      {hasCrew==="no"&&(
                        <div style={{fontSize:11,color:"#2563eb",background:"#eff6ff",padding:"10px 12px",borderRadius:8}}>Dentro de la app puedes conseguir tripulación: publica una búsqueda y te llegarán capitanes que califican en tu zona.</div>
                      )}
                    </div>
                  )}

                  {/* GERENTE → datos de los dueños + frecuencia de reporte */}
                  {boatRole==="gerente"&&(
                    <div>
                      <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Como gerente, gestionas barcos de otros. Agrega los dueños a quienes les reportarás.</div>
                      {ownerContacts.map((oc,i)=>(
                        <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                          <input value={oc.name} onChange={e=>{const n=[...ownerContacts];n[i].name=e.target.value;setOwnerContacts(n);}} placeholder="Nombre del dueño" style={{...s.input,flex:1}}/>
                          <input value={oc.phone} onChange={e=>{const n=[...ownerContacts];n[i].phone=e.target.value;setOwnerContacts(n);}} placeholder="Teléfono" style={{...s.input,flex:1}}/>
                        </div>
                      ))}
                      <button type="button" onClick={()=>setOwnerContacts([...ownerContacts,{name:"",phone:""}])} style={{fontSize:11,color:"#2563eb",background:"none",border:"none",cursor:"pointer",fontWeight:700,padding:"4px 0",marginBottom:10}}>＋ Agregar otro dueño</button>
                      <label style={s.label}>¿Cada cuánto envías reporte al dueño?</label>
                      <select value={reportFreq} onChange={e=>setReportFreq(e.target.value)} style={s.input}>
                        <option value="semanal">Cada semana</option>
                        <option value="quincenal">Cada 15 días</option>
                        <option value="mensual">Una vez al mes</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <label style={s.label}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={s.input}
              onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}/>
          </div>
          <div>
            <label style={s.label}>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={s.input}
              onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}/>
          </div>
          {mode==="register"&&(
            <div>
              <label style={s.label}>Confirmar contraseña</label>
              <input type="password" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)} placeholder="••••••••" style={s.input}
                onKeyDown={e=>e.key==="Enter"&&handleRegister()}/>
            </div>
          )}

          {error   && <div style={s.errorBox}>⚠ {error}</div>}
          {success && <div style={s.successBox}>✓ {success}</div>}

          <button onClick={mode==="login"?handleLogin:handleRegister} disabled={loading}
            style={{...s.btn,opacity:loading?0.7:1}}>
            {loading?"⏳ Cargando...":mode==="login"?"Entrar →":"Crear cuenta →"}
          </button>

          {mode==="login"&&(
            <button style={s.forgotBtn} onClick={async()=>{
              if(!email){setError("Escribe tu email primero");return;}
              await supabase.auth.resetPasswordForEmail(email);
              setSuccess("Te enviamos un link para restablecer tu contraseña.");
            }}>¿Olvidaste tu contraseña?</button>
          )}
        </div>

        {/* Features */}
        <div style={s.footer}>
          <div style={s.featuresGrid}>
            <div style={s.feature}><span style={s.featureText}>Bitácora digital</span></div>
            <div style={s.feature}><span style={s.featureText}>Control de tareas</span></div>
            <div style={s.feature}><span style={s.featureText}>Asistente IA</span></div>
            <div style={s.feature}><span style={s.featureText}>Alertas WhatsApp</span></div>
          </div>
          <div style={{fontSize:11,color:"#cbd5e1",marginTop:12,textAlign:"center",letterSpacing:"0.04em"}}>
            Gestión inteligente · Desde cualquier lugar
          </div>
        </div>
      </div>
    </div>
  );
}

const roleCard = (active) => ({
  padding:"12px 14px",border:"2px solid",borderRadius:10,cursor:"pointer",textAlign:"left",width:"100%",
  borderColor:active?"#2563eb":"#e2e8f0", background:active?"#eff6ff":"#fff",
});
const pill = (active) => ({
  flex:1,padding:"9px",border:"1.5px solid",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,
  borderColor:active?"#2563eb":"#e2e8f0", background:active?"#eff6ff":"#fff", color:active?"#2563eb":"#64748b",
});

const s = {
  root: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#f0f7ff 0%,#e8f4fd 100%)", padding:20, fontFamily:"'Segoe UI',system-ui,sans-serif" },
  card: { background:"#fff", borderRadius:20, padding:"36px 32px", width:"100%", maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,0.1)", border:"1px solid #e2e8f0" },
  logoWrap: { textAlign:"center", marginBottom:24 },
  brand:    { fontSize:26, fontWeight:800, color:"#0f172a", letterSpacing:"-0.5px", marginTop:10 },
  tagline:  { fontSize:12, color:"#64748b", marginTop:4 },
  tabs:     { display:"flex", borderBottom:"1px solid #e2e8f0", marginBottom:24 },
  tab:      { flex:1, padding:"10px 0", background:"none", border:"none", cursor:"pointer", fontSize:14, transition:"all 0.15s" },
  form:     { display:"flex", flexDirection:"column", gap:14 },
  label:    { display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 },
  input:    { width:"100%", padding:"11px 13px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:14, color:"#1e293b", background:"#fff", boxSizing:"border-box", outline:"none" },
  btn:      { padding:"13px", background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)", border:"none", borderRadius:9, color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 },
  forgotBtn:{ background:"none", border:"none", color:"#94a3b8", fontSize:12, cursor:"pointer", textAlign:"center", marginTop:-6 },
  errorBox: { background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#dc2626" },
  successBox:{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#16a34a" },
  footer:   { marginTop:24, paddingTop:20, borderTop:"1px solid #f1f5f9" },
  featuresGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  feature:  { display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"9px 12px", background:"#f8fafc", borderRadius:9, border:"1px solid #e2e8f0" },
  featureIcon: { fontSize:16 },
  featureText: { fontSize:12, color:"#475569", fontWeight:500 },
};