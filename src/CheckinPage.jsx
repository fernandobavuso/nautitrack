// Página pública de QR Check-in / Check-out
// URL: app.carive.co/checkin?v=VESSEL_ID
// No requiere login — se abre al escanear el QR del barco.
//
// Flujo inteligente:
//   1. Elige tu nombre del roster del equipo (o escríbelo si no estás)
//   2. Ves las tareas pendientes del barco
//   3. Check-in → trabajas → Check-out
//   4. Al salir: comentarios OBLIGATORIOS + puedes marcar la tarea completada

import { useState, useEffect } from "react";

const ROLES = ["Capitán", "Primer Oficial", "Jefe de Máquinas", "Mecánico", "Marinero", "Cocinero", "Camarero", "Otro"];

export default function CheckinPage() {
  const params   = new URLSearchParams(window.location.search);
  const vesselId = params.get("v");

  const [vessel,     setVessel]     = useState(null);
  const [roster,     setRoster]     = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  // Formulario
  const [name,     setName]     = useState("");
  const [role,     setRole]     = useState("Marinero");
  const [manual,   setManual]   = useState(false);   // escribir nombre a mano
  const [action,   setAction]   = useState(null);    // "checkin" | "checkout"
  const [taskId,   setTaskId]   = useState("");      // tarea que completó
  const [notes,    setNotes]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [done,     setDone]     = useState(null);
  const [formError,setFormError]= useState("");

  useEffect(() => {
    if (!vesselId) { setError("QR inválido — no se encontró la embarcación."); setLoading(false); return; }
    fetch(`/api/checkin?vesselId=${vesselId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          setVessel(d.vessel);
          setRoster(d.roster || []);
          setTasks(d.pendingTasks || []);
          setRecentLogs(d.recentLogs || []);
          if ((d.roster || []).length === 0) setManual(true);  // sin roster → escribir a mano
        }
        setLoading(false);
      })
      .catch(() => { setError("Error de conexión."); setLoading(false); });
  }, [vesselId]);

  // Al elegir a alguien del roster, tomamos su rol
  const pickPerson = (personName) => {
    setName(personName);
    const p = roster.find(r => r.name === personName);
    if (p?.role) setRole(p.role);
  };

  const submit = async () => {
    setFormError("");
    if (!name.trim()) { setFormError("Elige o escribe tu nombre."); return; }
    if (!action)      { setFormError("Elige si entras o sales."); return; }
    if (action === "checkout" && !notes.trim()) {
      setFormError("Al salir debes escribir qué hiciste.");
      return;
    }

    setSending(true);
    try {
      const resp = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId,
          crewName: name.trim(),
          crewRole: role,
          action,
          notes: notes.trim(),
          taskId: action === "checkout" && taskId ? taskId : null,
        }),
      });
      const d = await resp.json();
      if (d.error) { setFormError(d.error); setSending(false); return; }
      setDone({ action, name: name.trim(), role, time: new Date(), completedTask: d.completedTask });
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    }
    setSending(false);
  };

  // ── Estados de carga / error ──
  if (loading) return <Screen><div style={{color:"#94a3b8"}}>Cargando...</div></Screen>;
  if (error)   return <Screen><div style={{color:"#dc2626",fontWeight:600}}>{error}</div></Screen>;

  // ── Pantalla de confirmación ──
  if (done) {
    const isIn = done.action === "checkin";
    return (
      <Screen>
        <div style={{textAlign:"center",maxWidth:380}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:isIn?"#f0fdf4":"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={isIn?"#16a34a":"#2563eb"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {isIn ? <><path d="M20 6 9 17l-5-5"/></> : <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>}
            </svg>
          </div>

          <div style={{fontSize:22,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif",marginBottom:8}}>
            {isIn ? "Check-in registrado" : "Check-out registrado"}
          </div>

          <div style={{fontSize:14,color:"#64748b",lineHeight:1.6}}>
            <strong style={{color:"#0f172a"}}>{done.name}</strong> · {done.role}<br/>
            {vessel.name}<br/>
            {done.time.toLocaleString("es", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
          </div>

          {done.completedTask && (
            <div style={{marginTop:18,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#15803d"}}>Tarea completada</div>
              <div style={{fontSize:13,color:"#166534",marginTop:2}}>{done.completedTask}</div>
            </div>
          )}

          <div style={{marginTop:24,fontSize:12,color:"#94a3b8"}}>
            Ya puedes cerrar esta página.
          </div>
        </div>
      </Screen>
    );
  }

  // ── Formulario principal ──
  return (
    <Screen align="flex-start">
      <div style={{maxWidth:440,width:"100%",padding:"28px 0 40px"}}>

        {/* Cabecera del barco */}
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.1em",marginBottom:6}}>REGISTRO A BORDO</div>
          <div style={{fontSize:26,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>{vessel.name}</div>
          {vessel.marina && <div style={{fontSize:13,color:"#64748b",marginTop:3}}>{vessel.marina}</div>}
        </div>

        {/* 1. Quién eres */}
        <Card title="¿Quién eres?">
          {!manual && roster.length > 0 ? (
            <>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {roster.map(p => (
                  <button key={p.id} onClick={() => pickPerson(p.name)} style={{
                    display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                    background: name === p.name ? "#eff6ff" : "#fff",
                    border: `1.5px solid ${name === p.name ? "#2563eb" : "#e2e8f0"}`,
                    borderRadius:11, cursor:"pointer", textAlign:"left", width:"100%",
                  }}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#2563eb,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0}}>
                      {p.name.split(" ").filter(Boolean).slice(0,2).map(w => w[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{p.name}</div>
                      <div style={{fontSize:12,color:"#64748b"}}>{p.role}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => { setManual(true); setName(""); }} style={linkBtn}>
                No estoy en la lista
              </button>
            </>
          ) : (
            <>
              <label style={lbl}>Tu nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: John Pérez" style={inp}/>
              <label style={lbl}>Tu rol</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {roster.length > 0 && (
                <button onClick={() => { setManual(false); setName(""); }} style={linkBtn}>
                  Volver a la lista del equipo
                </button>
              )}
            </>
          )}
        </Card>

        {/* 2. Entras o sales */}
        <Card title="¿Entras o sales?">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              { k:"checkin",  l:"Entrar",  sub:"Check-in",  c:"#16a34a", bg:"#f0fdf4", bd:"#bbf7d0" },
              { k:"checkout", l:"Salir",   sub:"Check-out", c:"#2563eb", bg:"#eff6ff", bd:"#bfdbfe" },
            ].map(a => (
              <button key={a.k} onClick={() => setAction(a.k)} style={{
                padding:"16px 12px", borderRadius:12, cursor:"pointer",
                background: action === a.k ? a.bg : "#fff",
                border: `2px solid ${action === a.k ? a.c : "#e2e8f0"}`,
              }}>
                <div style={{fontSize:15,fontWeight:800,color: action === a.k ? a.c : "#64748b"}}>{a.l}</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{a.sub}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* 3. Si sale: tarea + comentarios obligatorios */}
        {action === "checkout" && (
          <Card title="¿Qué hiciste?">
            {tasks.length > 0 && (
              <>
                <label style={lbl}>¿Completaste alguna tarea? (opcional)</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} style={inp}>
                  <option value="">No completé ninguna tarea</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.task}{t.equipment ? ` — ${t.equipment}` : ""}
                    </option>
                  ))}
                </select>
                {taskId && (
                  <div style={{fontSize:11,color:"#15803d",background:"#f0fdf4",padding:"7px 10px",borderRadius:7,marginTop:6}}>
                    Se marcará como completada y quedará en la bitácora del barco.
                  </div>
                )}
              </>
            )}

            <label style={lbl}>Comentarios <span style={{color:"#dc2626"}}>*</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Ej: Lavé el barco completo. El motor de estribor tiene una fuga pequeña de aceite, hay que revisarla."
              style={{...inp, resize:"vertical", fontFamily:"inherit"}}
            />
            <div style={{fontSize:11,color:"#94a3b8",marginTop:4,lineHeight:1.5}}>
              Cuenta qué hiciste y si viste algo que haya que atender. Esto queda en el historial del barco.
            </div>
          </Card>
        )}

        {formError && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",padding:"11px 14px",borderRadius:10,fontSize:13,marginBottom:14}}>
            {formError}
          </div>
        )}

        <button onClick={submit} disabled={sending} style={{
          width:"100%", padding:"15px", borderRadius:12, border:"none", cursor: sending ? "default" : "pointer",
          background: sending ? "#94a3b8" : "linear-gradient(120deg,#2563eb,#0ea5e9)",
          color:"#fff", fontSize:16, fontWeight:700,
        }}>
          {sending ? "Registrando..." : action === "checkout" ? "Registrar salida" : "Registrar entrada"}
        </button>

        {/* Actividad reciente */}
        {recentLogs.length > 0 && (
          <div style={{marginTop:28}}>
            <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>ACTIVIDAD RECIENTE</div>
            {recentLogs.slice(0, 4).map((l, i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f1f5f9",fontSize:12}}>
                <span style={{color:"#475569"}}>
                  <strong style={{color:"#0f172a"}}>{l.crew_name}</strong>
                  <span style={{color: l.action === "checkin" ? "#16a34a" : "#2563eb", marginLeft:6, fontWeight:600}}>
                    {l.action === "checkin" ? "entró" : "salió"}
                  </span>
                </span>
                <span style={{color:"#94a3b8"}}>
                  {new Date(l.timestamp).toLocaleString("es", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </Screen>
  );
}

// ── Componentes de apoyo ──
const Screen = ({ children, align = "center" }) => (
  <div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",alignItems:align,justifyContent:"center",padding:"0 20px"}}>
    {children}
  </div>
);

const Card = ({ title, children }) => (
  <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:18,marginBottom:14}}>
    <div style={{fontSize:14,fontWeight:800,color:"#0a2540",marginBottom:13,fontFamily:"'Sora',system-ui,sans-serif"}}>{title}</div>
    {children}
  </div>
);

const lbl = {display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:5,marginTop:12};
const inp = {width:"100%",padding:"11px 13px",border:"1.5px solid #e2e8f0",borderRadius:9,fontSize:14,color:"#1e293b",boxSizing:"border-box",outline:"none"};
const linkBtn = {background:"none",border:"none",color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer",padding:"10px 0 0",textDecoration:"underline"};
