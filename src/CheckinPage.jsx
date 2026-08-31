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
import { useLang } from "./i18n.jsx";

const ROLES = ["Capitán", "Primer Oficial", "Jefe de Máquinas", "Mecánico", "Marinero", "Cocinero", "Camarero", "Otro"];
const ROLE_EN = {"Capitán":"Captain","Primer Oficial":"First Officer","Jefe de Máquinas":"Chief Engineer","Mecánico":"Mechanic","Marinero":"Deckhand","Cocinero":"Cook","Camarero":"Steward","Otro":"Other"};

// Emparejar tareas con la persona (el asignado puede venir como "Nombre (Rol)")
const normName = (s) => (s||"").replace(/\s*\(.*\)\s*$/,"").trim().toLowerCase();
const isMyTask = (t, who) => {
  const a = normName(t.assignedTo), b = normName(who);
  return !!a && !!b && (a===b || a.includes(b) || b.includes(a));
};

export default function CheckinPage() {
  const { lang, setLang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
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
  const [shiftsToday, setShiftsToday] = useState([]); // turnos agendados hoy aquí
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
          setShiftsToday(d.todayShifts || []);
          setRecentLogs(d.recentLogs || []);
          if ((d.roster || []).length === 0) setManual(true);  // sin roster → escribir a mano
        }
        setLoading(false);
      })
      .catch(() => { setError("Error de conexión."); setLoading(false); });
  }, [vesselId]);

  // Pre-seleccionar tarea: al ENTRAR, su tarea asignada; al SALIR, la de su check-in abierto
  useEffect(() => {
    if (!name) return;
    if (action === "checkin") {
      const mt = tasks.filter(t => isMyTask(t, name));
      if (mt.length === 1) setTaskId(String(mt[0].id));
    } else if (action === "checkout") {
      const mine = recentLogs
        .filter(l => normName(l.crew_name) === normName(name))
        .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (mine[0]?.action === "checkin" && mine[0].task_id) setTaskId(String(mine[0].task_id));
      else { const mt = tasks.filter(t => isMyTask(t, name)); if (mt.length === 1) setTaskId(String(mt[0].id)); }
    }
  }, [action, name]);   // eslint-disable-line react-hooks/exhaustive-deps

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
          taskId: taskId || null,
          taskName: taskId ? (tasks.find(t => String(t.id) === String(taskId))?.task || "") : "",
        }),
      });
      const d = await resp.json();
      if (d.error) { setFormError(d.error); setSending(false); return; }
      const tName = taskId ? (tasks.find(t => String(t.id) === String(taskId))?.task || "") : "";
      setDone({ action, name: name.trim(), role, time: new Date(), completedTask: d.completedTask, linkedTask: action === "checkin" ? tName : "" });
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    }
    setSending(false);
  };

  // ── Estados de carga / error ──
  if (loading) return <Screen><div style={{color:"#94a3b8"}}>{L("Cargando...","Loading...")}</div></Screen>;
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
            {isIn ? (lang==="es"?"Check-in registrado":"Check-in recorded") : (lang==="es"?"Check-out registrado":"Check-out recorded")}
          </div>

          <div style={{fontSize:14,color:"#64748b",lineHeight:1.6}}>
            <strong style={{color:"#0f172a"}}>{done.name}</strong> · {done.role}<br/>
            {vessel.name}<br/>
            {done.time.toLocaleString("es", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
          </div>

          {done.completedTask && (
            <div style={{marginTop:18,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#15803d"}}>{L("Tarea completada","Task completed")}</div>
              <div style={{fontSize:13,color:"#166534",marginTop:2}}>{done.completedTask}</div>
            </div>
          )}

          {done.linkedTask && (
            <div style={{marginTop:18,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#1e40af"}}>{L("Vienes a hacer","You're here to do")}</div>
              <div style={{fontSize:13,color:"#1e3a8a",marginTop:2}}>{done.linkedTask}</div>
              <div style={{fontSize:11,color:"#64748b",marginTop:6}}>{L("Al terminar, vuelve a escanear y haz check-out para marcarla completada.","When you're done, scan again and check out to mark it completed.")}</div>
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

        {/* Toggle de idioma (el trabajador elige) */}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <div style={{display:"inline-flex",background:"#f1f5f9",borderRadius:7,padding:2}}>
            <button onClick={()=>setLang("es")} style={{padding:"4px 10px",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:700,background:lang==="es"?"#fff":"transparent",color:lang==="es"?"#2563eb":"#64748b"}}>ES</button>
            <button onClick={()=>setLang("en")} style={{padding:"4px 10px",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:700,background:lang==="en"?"#fff":"transparent",color:lang==="en"?"#2563eb":"#64748b"}}>EN</button>
          </div>
        </div>

        {/* Cabecera del barco */}
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.1em",marginBottom:6}}>{L("REGISTRO A BORDO","ONBOARD CHECK-IN")}</div>
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
              <label style={lbl}>{L("Tu nombre","Your name")}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={L("Ej: John Pérez","e.g. John Perez")} style={inp}/>
              <label style={lbl}>{L("Tu rol","Your role")}</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
                {ROLES.map(r => <option key={r} value={r}>{L(r, ROLE_EN[r]||r)}</option>)}
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
              { k:"checkin",  l:(lang==="es"?"Entrar":"Check in"),  sub:"Check-in",  c:"#16a34a", bg:"#f0fdf4", bd:"#bbf7d0" },
              { k:"checkout", l:(lang==="es"?"Salir":"Check out"),   sub:"Check-out", c:"#2563eb", bg:"#eff6ff", bd:"#bfdbfe" },
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

        {/* Trabajo agendado hoy para esta persona en este barco */}
        {(() => {
          const mine = shiftsToday.filter(sh => {
            const a = normName(sh.person), b = normName(name);
            return !!a && !!b && (a===b || a.includes(b) || b.includes(a));
          });
          if (!mine.length) return null;
          const works = [...new Set(mine.flatMap(sh => sh.works))].join(", ");
          return (
            <Card title={L("Tu trabajo de hoy","Your work today")}>
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:9,padding:"10px 12px",fontSize:13,color:"#1e40af"}}>
                <strong>{works || L("Servicio","Service")}</strong>
                <div style={{fontSize:11,color:"#3b82f6",marginTop:3}}>
                  {action === "checkin"
                    ? L("Al hacer check-in queda 'En proceso' en la agenda.","Checking in marks it 'In progress' in the schedule.")
                    : L("Al hacer check-out se marca como completado y se registra en la bitácora del barco con tus comentarios.","Checking out marks it complete and logs it in the vessel's logbook with your comments.")}
                </div>
              </div>
            </Card>
          );
        })()}

        {/* Si entra: a qué viene (linkea la tarea desde el check-in) */}
        {action === "checkin" && tasks.length > 0 && (
          <Card title="¿A qué vienes?">
            {(() => {
              const myTasks = tasks.filter(t => isMyTask(t, name));
              const list = myTasks.length > 0 ? [...myTasks, ...tasks.filter(t => !isMyTask(t, name))] : tasks;
              return (<>
                {myTasks.length > 0 && (
                  <div style={{fontSize:12,color:"#15803d",background:"#f0fdf4",padding:"7px 10px",borderRadius:7,marginBottom:10}}>
                    Tienes {myTasks.length} tarea(s) asignada(s) en este barco.
                  </div>
                )}
                <label style={lbl}>{L("Tarea (opcional)","Task (optional)")}</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} style={inp}>
                  <option value="">{L("Trabajo general / otra cosa","General work / something else")}</option>
                  {list.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.task}{t.equipment ? ` — ${t.equipment}` : ""}{isMyTask(t, name) ? "  ⭐ asignada a ti" : ""}
                    </option>
                  ))}
                </select>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4,lineHeight:1.5}}>
                  Elige la tarea que vienes a hacer. Al salir la podrás marcar como completada.
                </div>
              </>);
            })()}
          </Card>
        )}

        {/* 3. Si sale: tarea + comentarios obligatorios */}
        {action === "checkout" && (
          <Card title="¿Qué hiciste?">
            {tasks.length > 0 && (
              <>
                <label style={lbl}>{L("¿Completaste alguna tarea? (opcional)","Did you complete a task? (optional)")}</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} style={inp}>
                  <option value="">{L("No completé ninguna tarea","I didn't complete any task")}</option>
                  {[...tasks].sort((a,b) => (isMyTask(b,name)?1:0)-(isMyTask(a,name)?1:0)).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.task}{t.equipment ? ` — ${t.equipment}` : ""}{isMyTask(t,name) ? "  ⭐" : ""}
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
              placeholder={L("Ej: Lavé el barco completo. El motor de estribor tiene una fuga pequeña de aceite, hay que revisarla.","e.g. Washed the whole boat. The starboard engine has a small oil leak that needs checking.")}
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
            <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>{L("ACTIVIDAD RECIENTE","RECENT ACTIVITY")}</div>
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
