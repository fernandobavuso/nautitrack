// Vista del Capitán — acceso con cuenta propia
import CariveLogo from "./CariveLogo";
// Puede ver: Dashboard clima, Mis tareas, Bitácora (crear), Manuales/IA, Check-in log
// No puede: editar embarcación, configurar WhatsApp, ver datos financieros, borrar nada

import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useResponsive } from "./useResponsive";

export default function CaptainView({ vessel, user, onLogout }) {
  const { isMobile } = useResponsive();
  const [tab,       setTab]       = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [crewLogs,  setCrewLogs]  = useState([]);
  const [logsLoad,  setLogsLoad]  = useState(false);

  useEffect(() => {
    if (tab === "crew") loadCrewLogs();
  }, [tab]);

  const loadCrewLogs = async () => {
    setLogsLoad(true);
    const { data } = await supabase
      .from("crew_logs")
      .select("*")
      .eq("vessel_id", vessel.id)
      .order("timestamp", { ascending: false })
      .limit(50);
    setCrewLogs(data || []);
    setLogsLoad(false);
  };

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString("es-VE", { hour:"2-digit", minute:"2-digit", hour12:true });
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("es-VE", { weekday:"short", day:"numeric", month:"short" });

  const overdueTasks = (vessel.tasks||[]).filter(t=>t.status==="overdue");
  const dueTasks     = (vessel.tasks||[]).filter(t=>t.status==="due");
  const myTasks      = (vessel.tasks||[]).filter(t=>
    !t.status||t.status==="pending"||t.status==="due"||t.status==="overdue"
  );

  const NAV = [
    { key:"dashboard", icon:"🏠", label:"Inicio" },
    { key:"tasks",     icon:"☑",  label:"Tareas" },
    { key:"log",       icon:"📓", label:"Bitácora" },
    { key:"crew",      icon:"👥", label:"Tripulación" },
    { key:"docs",      icon:"📄", label:"Manuales" },
  ];

  return (
    <div style={s.root}>
      {/* ── NAVBAR ── */}
      <nav style={{...s.nav, padding:isMobile?"10px 14px":"12px 24px"}}>
        <div style={s.navBrand}>
          <CariveLogo size={30} />
          <div>
            <div style={{fontSize:14, fontWeight:800, color:"#0f172a", lineHeight:1}}>Carive</div>
            <div style={{fontSize:10, color:"#64748b"}}>Vista Capitán</div>
          </div>
        </div>

        {isMobile ? (
          <button onClick={()=>setMobileMenuOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",flexDirection:"column",gap:4}}>
            <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
            <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
            <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
          </button>
        ) : (
          <div style={{display:"flex", gap:4}}>
            {NAV.map(n=>(
              <button key={n.key} onClick={()=>setTab(n.key)} style={{
                padding:"6px 12px", background:tab===n.key?"#eff6ff":"transparent",
                border:"none", borderRadius:8, cursor:"pointer",
                fontSize:12, color:tab===n.key?"#2563eb":"#64748b",
                fontWeight:tab===n.key?700:400
              }}>{n.icon} {n.label}</button>
            ))}
            <button onClick={onLogout} style={{padding:"6px 10px", background:"none", border:"1px solid #e2e8f0", borderRadius:8, cursor:"pointer", fontSize:11, color:"#94a3b8", marginLeft:8}}>
              Salir
            </button>
          </div>
        )}
      </nav>

      {/* Menú móvil deslizante */}
      {isMobile&&mobileMenuOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:200}} onClick={()=>setMobileMenuOpen(false)}>
          <div style={{position:"absolute",left:0,top:0,bottom:0,width:260,background:"#fff",boxShadow:"2px 0 20px rgba(0,0,0,0.2)",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>Menú</div>
              <button onClick={()=>setMobileMenuOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
            </div>
            <div style={{padding:"12px"}}>
              {NAV.map(n=>(
                <button key={n.key} onClick={()=>{setTab(n.key);setMobileMenuOpen(false);}} style={{
                  display:"block",width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderRadius:8,cursor:"pointer",marginBottom:2,
                  background:tab===n.key?"#eff6ff":"transparent",color:tab===n.key?"#2563eb":"#1e293b",
                  fontWeight:tab===n.key?700:500,fontSize:14
                }}>{n.icon} {n.label}</button>
              ))}
              <div style={{borderTop:"1px solid #f1f5f9",marginTop:8,paddingTop:8}}>
                <button onClick={()=>{onLogout();setMobileMenuOpen(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderRadius:8,cursor:"pointer",background:"transparent",color:"#dc2626",fontWeight:600,fontSize:14}}>🚪 Cerrar Sesión</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VESSEL BANNER ── */}
      <div style={s.vesselBanner}>
        <div>
          <div style={{fontSize:18, fontWeight:800, color:"#fff"}}>{vessel.name}</div>
          <div style={{fontSize:12, color:"rgba(255,255,255,0.75)", marginTop:2}}>
            {vessel.type} · {vessel.marina}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:11, color:"rgba(255,255,255,0.6)"}}>Capitán</div>
          <div style={{fontSize:13, fontWeight:700, color:"#fff"}}>{vessel.captain || user?.email}</div>
        </div>
      </div>

      <div style={{...s.content, padding:isMobile?"16px 14px":"24px 28px"}}>

        {/* ─── DASHBOARD ─── */}
        {tab==="dashboard"&&(
          <div style={{display:"flex", flexDirection:"column", gap:16}}>

            {/* Alertas */}
            {(overdueTasks.length>0||dueTasks.length>0)&&(
              <div style={{background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:"14px 18px"}}>
                <div style={{fontWeight:700, color:"#c2410c", fontSize:14, marginBottom:8}}>⚠️ Atención requerida</div>
                {overdueTasks.slice(0,3).map(t=>(
                  <div key={t.id} style={{fontSize:12, color:"#9a3412", marginBottom:4}}>
                    🔴 <strong>{t.name}</strong> — venció {t.nextDue}
                  </div>
                ))}
                {dueTasks.slice(0,3).map(t=>(
                  <div key={t.id} style={{fontSize:12, color:"#b45309", marginBottom:4}}>
                    🟡 <strong>{t.name}</strong> — vence pronto
                  </div>
                ))}
              </div>
            )}

            {/* Clima */}
            <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius:14, padding:"18px 22px", color:"#fff"}}>
              <div style={{fontSize:11, opacity:0.7, letterSpacing:"0.08em", marginBottom:6}}>CONDICIONES ACTUALES · {vessel.marina}</div>
              <div style={{display:"flex", alignItems:"center", gap:20}}>
                <div style={{fontSize:44}}>{vessel.weather?.icon||"⛅"}</div>
                <div>
                  <div style={{fontSize:32, fontWeight:800}}>{vessel.weather?.temp||"--"}°C</div>
                  <div style={{fontSize:13, opacity:0.85}}>{vessel.weather?.condition||"--"}</div>
                  <div style={{fontSize:12, opacity:0.7, marginTop:2}}>💨 {vessel.weather?.wind||"--"} km/h</div>
                </div>
              </div>
            </div>

            {/* Stats rápidos */}
            <div style={{display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10}}>
              {[
                { label:"Tareas vencidas", val:overdueTasks.length, color:"#dc2626", bg:"#fff5f5", icon:"🔴" },
                { label:"Por vencer",      val:dueTasks.length,     color:"#d97706", bg:"#fffbeb", icon:"🟡" },
                { label:"Horas motor",     val:vessel.engineHours||0, color:"#2563eb", bg:"#eff6ff", icon:"⚙️" },
              ].map(s2=>(
                <div key={s2.label} style={{background:s2.bg, borderRadius:10, padding:"14px 12px", textAlign:"center"}}>
                  <div style={{fontSize:20}}>{s2.icon}</div>
                  <div style={{fontSize:22, fontWeight:800, color:s2.color}}>{s2.val}</div>
                  <div style={{fontSize:10, color:"#64748b", marginTop:2}}>{s2.label}</div>
                </div>
              ))}
            </div>

            {/* Info embarcación — solo lectura */}
            <div style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 20px"}}>
              <div style={{fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:12}}>🚢 Mi Embarcación</div>
              <div style={{display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8}}>
                {[
                  ["Nombre",    vessel.name],
                  ["Tipo",      vessel.type],
                  ["Marina",    vessel.marina],
                  ["Capitán",   vessel.captain],
                  ["Combustible", `${vessel.fuel||0} ${vessel.fuelUnit||"gal"}`],
                  ["Motor",     `${vessel.engineHours||0} hrs`],
                ].map(([k,v])=>(
                  <div key={k} style={{background:"#f8fafc", borderRadius:8, padding:"8px 12px"}}>
                    <div style={{fontSize:10, color:"#94a3b8", fontWeight:600}}>{k.toUpperCase()}</div>
                    <div style={{fontSize:13, color:"#1e293b", fontWeight:600, marginTop:2}}>{v||"—"}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:10, fontSize:11, color:"#94a3b8", fontStyle:"italic"}}>
                🔒 Solo el propietario puede editar estos datos
              </div>
            </div>
          </div>
        )}

        {/* ─── TAREAS ─── */}
        {tab==="tasks"&&(
          <div>
            <div style={{fontSize:16, fontWeight:700, color:"#0f172a", marginBottom:4}}>☑ Tareas de Mantenimiento</div>
            <div style={{fontSize:12, color:"#64748b", marginBottom:16}}>Solo lectura · Contacta al propietario para agregar tareas</div>
            {myTasks.length===0&&(
              <div style={{textAlign:"center", padding:"60px 0", color:"#94a3b8"}}>
                <div style={{fontSize:40, marginBottom:12}}>✅</div>
                <div style={{fontWeight:600}}>Sin tareas pendientes</div>
              </div>
            )}
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              {myTasks.map(t=>{
                const colors = { overdue:{bg:"#fff5f5",border:"#fecaca",dot:"#dc2626"}, due:{bg:"#fffbeb",border:"#fde68a",dot:"#d97706"}, pending:{bg:"#f8fafc",border:"#e2e8f0",dot:"#94a3b8"} };
                const c = colors[t.status]||colors.pending;
                return (
                  <div key={t.id} style={{background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"flex-start", gap:12}}>
                    <div style={{width:10, height:10, borderRadius:"50%", background:c.dot, marginTop:3, flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:700, color:"#0f172a"}}>{t.name}</div>
                      <div style={{fontSize:11, color:"#64748b", marginTop:2}}>{t.system} · Vence: {t.nextDue||"—"}</div>
                    </div>
                    <div style={{fontSize:11, color:"#94a3b8", textTransform:"uppercase", fontWeight:600}}>
                      {t.status==="overdue"?"Vencida":t.status==="due"?"Pronto":"Pendiente"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── BITÁCORA ─── */}
        {tab==="log"&&(
          <CaptainLogTab vessel={vessel} user={user}/>
        )}

        {/* ─── TRIPULACIÓN / CHECK-IN LOG ─── */}
        {tab==="crew"&&(
          <div>
            <div style={{fontSize:16, fontWeight:700, color:"#0f172a", marginBottom:4}}>👥 Registro de Tripulación</div>
            <div style={{fontSize:12, color:"#64748b", marginBottom:16}}>Historial de check-ins y check-outs</div>

            {logsLoad&&<div style={{textAlign:"center", padding:"40px", color:"#64748b"}}>⏳ Cargando...</div>}
            {!logsLoad&&crewLogs.length===0&&(
              <div style={{textAlign:"center", padding:"60px 0", color:"#94a3b8"}}>
                <div style={{fontSize:40, marginBottom:12}}>👥</div>
                <div style={{fontWeight:600}}>Sin registros aún</div>
                <div style={{fontSize:12, marginTop:6}}>Comparte el QR para que la tripulación haga check-in</div>
              </div>
            )}
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {crewLogs.map(l=>(
                <div key={l.id} style={{display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                  background:l.action==="checkin"?"#f0fdf4":"#fff5f5",
                  border:`1px solid ${l.action==="checkin"?"#bbf7d0":"#fecaca"}`,
                  borderRadius:10}}>
                  <div style={{fontSize:20}}>{l.action==="checkin"?"✅":"🔴"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:700, color:"#0f172a"}}>{l.crew_name}</div>
                    <div style={{fontSize:11, color:"#64748b"}}>{l.crew_role} · {l.action==="checkin"?"Llegó":"Salió"}</div>
                    {l.location_note&&<div style={{fontSize:11, color:"#94a3b8", marginTop:2, fontStyle:"italic"}}>"{l.location_note}"</div>}
                  </div>
                  <div style={{textAlign:"right", fontSize:11, color:"#64748b"}}>
                    <div style={{fontWeight:600}}>{fmtTime(l.timestamp)}</div>
                    <div>{fmtDate(l.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── MANUALES / IA ─── */}
        {tab==="docs"&&(
          <div>
            <div style={{fontSize:16, fontWeight:700, color:"#0f172a", marginBottom:4}}>📄 Manuales y Asistente IA</div>
            <div style={{fontSize:12, color:"#64748b", marginBottom:20}}>Consulta manuales técnicos y pregunta al asistente</div>
            <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius:14, padding:"20px 24px", color:"#fff", textAlign:"center"}}>
              <div style={{fontSize:32, marginBottom:8}}>🤖</div>
              <div style={{fontSize:15, fontWeight:700, marginBottom:6}}>Asistente IA de Manuales</div>
              <div style={{fontSize:12, opacity:0.85, lineHeight:1.6}}>
                Accede a los manuales técnicos desde el menú principal.<br/>
                Pregunta al IA sobre procedimientos, repuestos o mantenimiento.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-componente: Tab de bitácora del capitán ──
function CaptainLogTab({ vessel, user }) {
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,10),
    type: "Servicio",
    desc: "",
    performedBy: "",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    supabase.from("log_entries").select("*")
      .eq("vessel_id", vessel.id)
      .order("date", { ascending:false })
      .limit(30)
      .then(({data})=>{ setEntries(data||[]); setLoading(false); });
  },[vessel.id]);

  const handleSave = async () => {
    if (!form.desc.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("log_entries").insert({
      vessel_id:    vessel.id,
      owner_id:     user.id,
      date:         form.date,
      type:         form.type,
      desc:         form.desc,
      performed_by: form.performedBy || vessel.captain,
    }).select().single();
    if (data) setEntries(e=>[data,...e]);
    setShowForm(false);
    setForm({ date:new Date().toISOString().slice(0,10), type:"Servicio", desc:"", performedBy:"" });
    setSaving(false);
  };

  const TYPES = ["Servicio","Inspección","Salida al Mar","Combustible","Incidente","Otro"];

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <div>
          <div style={{fontSize:16, fontWeight:700, color:"#0f172a"}}>📓 Bitácora</div>
          <div style={{fontSize:12, color:"#64748b"}}>Registra eventos y actividades</div>
        </div>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:"8px 14px", background:"linear-gradient(120deg,#2563eb,#0ea5e9)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer"}}>
          {showForm?"✕ Cancelar":"＋ Nueva entrada"}
        </button>
      </div>

      {showForm&&(
        <div style={{background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:12, padding:18, marginBottom:16}}>
          <div style={{display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10}}>
            <div>
              <label style={s2.label}>Fecha</label>
              <input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={s2.input}/>
            </div>
            <div>
              <label style={s2.label}>Tipo</label>
              <select value={form.type} onChange={e=>set("type",e.target.value)} style={s2.input}>
                {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={s2.label}>Descripción *</label>
            <textarea value={form.desc} onChange={e=>set("desc",e.target.value)}
              placeholder="Describe lo que ocurrió..."
              rows={3} style={{...s2.input, resize:"vertical"}}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={s2.label}>Realizado por</label>
            <input value={form.performedBy} onChange={e=>set("performedBy",e.target.value)}
              placeholder={vessel.captain||"Nombre"} style={s2.input}/>
          </div>
          <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
            <button onClick={handleSave} disabled={!form.desc.trim()||saving}
              style={{padding:"9px 20px", background:"linear-gradient(120deg,#2563eb,#0ea5e9)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", opacity:(!form.desc.trim()||saving)?0.5:1}}>
              {saving?"⏳ Guardando...":"✓ Guardar"}
            </button>
          </div>
        </div>
      )}

      {loading&&<div style={{textAlign:"center", padding:"40px", color:"#64748b"}}>⏳ Cargando bitácora...</div>}
      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {entries.map(e=>(
          <div key={e.id} style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 16px"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4}}>
              <span style={{fontSize:12, fontWeight:700, color:"#2563eb", background:"#eff6ff", padding:"2px 8px", borderRadius:20}}>{e.type}</span>
              <span style={{fontSize:11, color:"#94a3b8"}}>{e.date}</span>
            </div>
            <div style={{fontSize:13, color:"#1e293b", marginTop:6, lineHeight:1.5}}>{e.desc}</div>
            {e.performed_by&&<div style={{fontSize:11, color:"#94a3b8", marginTop:6}}>👤 {e.performed_by}</div>}
          </div>
        ))}
        {!loading&&entries.length===0&&(
          <div style={{textAlign:"center", padding:"60px 0", color:"#94a3b8"}}>
            <div style={{fontSize:40, marginBottom:12}}>📓</div>
            <div style={{fontWeight:600}}>Sin entradas en la bitácora</div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  root:         { minHeight:"100vh", background:"#f0f7ff", fontFamily:"'Segoe UI',system-ui,sans-serif" },
  nav:          { background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 },
  navBrand:     { display:"flex", alignItems:"center", gap:10 },
  vesselBanner: { background:"linear-gradient(135deg,#1e3a5f,#0ea5e9)", padding:"16px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" },
  content:      { maxWidth:900, margin:"0 auto", padding:"24px 28px" },
};
const s2 = {
  label: { display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 },
  input: { width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13, color:"#1e293b", background:"#fff", boxSizing:"border-box", outline:"none" },
};