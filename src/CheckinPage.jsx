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
  const [pin,      setPin]      = useState("");      // PIN de 4 dígitos
  const [authed,   setAuthed]   = useState(false);   // pasó el PIN
  const [pinError, setPinError] = useState("");
  const [mode,     setMode]     = useState(null);    // "movimiento" | "bitacora"
  const [logForm,  setLogForm]  = useState({ visitTypes:[], description:"", equipment:"", engHours:"", genHours:"", skHours:"", fuelQty:"", fuelUnit:"gal" });

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

  const verifyPin = async () => {
    if (!name.trim()) { setPinError(L("Elige tu nombre primero","Pick your name first")); return; }
    if (pin.length !== 4) { setPinError(L("El PIN son 4 dígitos","The PIN is 4 digits")); return; }
    setPinError("");
    const r = await fetch(`/api/checkin?vesselId=${vesselId}&pin=${encodeURIComponent(pin)}&who=${encodeURIComponent(name.trim())}`).then(x=>x.json());
    if (r.needsPin) { setPinError(L("PIN incorrecto","Wrong PIN")); return; }
    setVessel(r.vessel); setTasks(r.pendingTasks||[]); setShiftsToday(r.todayShifts||[]); setRecentLogs(r.recentLogs||[]);
    setAuthed(true);
  };

  const submitLog = async () => {
    if (!logForm.description.trim()) { setFormError(L("Escribe qué se hizo","Describe what was done")); return; }
    if (!logForm.visitTypes.length)  { setFormError(L("Elige al menos un tipo de trabajo","Pick at least one work type")); return; }
    setSending(true);
    try {
      const resp = await fetch("/api/checkin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vesselId, crewName: name.trim(), crewRole: role, action: "logbook", pin, logEntry: logForm }),
      });
      const d = await resp.json();
      if (d.error) { setFormError(d.error); setSending(false); return; }
      setDone({ action:"logbook", name:name.trim(), role, time:new Date() });
    } catch { setFormError(L("Error de conexión. Intenta de nuevo.","Connection error. Try again.")); }
    setSending(false);
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
          pin,
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
            {done.action==="logbook" ? (lang==="es"?"Anotado en la bitácora":"Saved to logbook")
              : isIn ? (lang==="es"?"Check-in registrado":"Check-in recorded") : (lang==="es"?"Check-out registrado":"Check-out recorded")}
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

        {/* 1.b PIN — sin él no se ve nada del barco */}
        {name.trim() && !authed && (
          <Card title={L("Tu PIN","Your PIN")}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>
              {L(`Hola ${name.trim()}. Escribe tu PIN de 4 dígitos para continuar.`,`Hi ${name.trim()}. Enter your 4-digit PIN to continue.`)}
            </div>
            <input value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/g,"").slice(0,4));setPinError("");}}
              inputMode="numeric" maxLength={4} placeholder="0000" autoFocus
              style={{...inp,fontSize:28,letterSpacing:"0.5em",textAlign:"center",fontWeight:700,padding:"14px"}}/>
            {pinError && <div style={{fontSize:12,color:"#dc2626",marginTop:8}}>{pinError}</div>}
            <button onClick={verifyPin} disabled={pin.length!==4}
              style={{width:"100%",marginTop:12,padding:"14px",background:pin.length===4?"linear-gradient(120deg,#2563eb,#0ea5e9)":"#e2e8f0",
                border:"none",borderRadius:11,color:pin.length===4?"#fff":"#94a3b8",fontSize:15,fontWeight:700,cursor:pin.length===4?"pointer":"default"}}>
              {L("Entrar","Continue")}
            </button>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:10,lineHeight:1.5}}>
              {L("¿No tienes PIN? Pídeselo al gestor de la flota.","No PIN? Ask your fleet manager for one.")}
            </div>
          </Card>
        )}

        {/* 1.c Qué vienes a hacer */}
        {authed && !mode && (
          <Card title={L("¿Qué vas a hacer?","What are you doing?")}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>setMode("movimiento")} style={{display:"block",width:"100%",textAlign:"left",padding:"16px",borderRadius:12,border:"1.5px solid #bbf7d0",background:"#f0fdf4",cursor:"pointer"}}>
                <div style={{fontSize:15,fontWeight:800,color:"#15803d"}}>{L("Check-in / Check-out","Check-in / Check-out")}</div>
                <div style={{fontSize:12,color:"#166534",marginTop:2}}>{L("Registrar tu entrada o salida del barco","Log your arrival or departure")}</div>
              </button>
              <button onClick={()=>setMode("bitacora")} style={{display:"block",width:"100%",textAlign:"left",padding:"16px",borderRadius:12,border:"1.5px solid #bfdbfe",background:"#eff6ff",cursor:"pointer"}}>
                <div style={{fontSize:15,fontWeight:800,color:"#1e40af"}}>{L("Anotar en la bitácora","Add a logbook entry")}</div>
                <div style={{fontSize:12,color:"#1d4ed8",marginTop:2}}>{L("Inspección, lavada, combustible, lo que hiciste","Inspection, wash, fuel, whatever you did")}</div>
              </button>
            </div>
          </Card>
        )}

        {/* 2. Entras o sales */}
        {authed && mode==="movimiento" && (<Card title="¿Entras o sales?">
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
        </Card>)}

        {/* Trabajo agendado hoy para esta persona en este barco */}
        {authed && (() => {
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
        {authed && mode==="movimiento" && action === "checkin" && tasks.length > 0 && (
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
        {authed && mode==="movimiento" && action === "checkout" && (
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

        {/* Modo BITÁCORA: formulario simplificado */}
        {authed && mode==="bitacora" && (
          <Card title={L("Anotar en la bitácora","Logbook entry")}>
            <label style={lbl}>{L("¿Qué tipo de trabajo?","What kind of work?")}</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {["Inspección","Lavada","Detailing","Limpieza interior","Buceo / Casco","Combustible","Supervisión de técnico"].map(w=>{
                const on=logForm.visitTypes.includes(w);
                return (
                  <button key={w} onClick={()=>setLogForm(f=>({...f,visitTypes:on?f.visitTypes.filter(x=>x!==w):[...f.visitTypes,w]}))}
                    style={{padding:"8px 13px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:on?700:500,
                      border:`1.5px solid ${on?"#2563eb":"#e2e8f0"}`,background:on?"#eff6ff":"#fff",color:on?"#1e40af":"#64748b"}}>
                    {on?"✓ ":""}{w}
                  </button>
                );
              })}
            </div>

            <label style={lbl}>{L("¿Qué hiciste? ¿Viste algo que atender?","What did you do? Anything to flag?")}</label>
            <textarea value={logForm.description} onChange={e=>setLogForm(f=>({...f,description:e.target.value}))}
              rows={4} placeholder={L("Revisé filtros, todo en orden. El ánodo de estribor está gastado.","Checked filters, all good. Starboard anode is worn.")}
              style={{...inp,resize:"vertical",fontFamily:"inherit"}}/>

            <label style={lbl}>{L("Equipo o sistema (opcional)","Equipment or system (optional)")}</label>
            <input value={logForm.equipment} onChange={e=>setLogForm(f=>({...f,equipment:e.target.value}))}
              placeholder={L("Motores, Generador, Cubierta...","Engines, Generator, Deck...")} style={inp}/>

            <div style={{background:"#f8fafc",borderRadius:10,padding:"12px",marginTop:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:8}}>{L("Lecturas (opcional)","Readings (optional)")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><label style={{...lbl,fontSize:11}}>{L("Horas motor","Engine hours")}</label>
                  <input type="number" value={logForm.engHours} onChange={e=>setLogForm(f=>({...f,engHours:e.target.value}))} style={inp}/></div>
                <div><label style={{...lbl,fontSize:11}}>{L("Horas generador","Generator hours")}</label>
                  <input type="number" value={logForm.genHours} onChange={e=>setLogForm(f=>({...f,genHours:e.target.value}))} style={inp}/></div>
                <div><label style={{...lbl,fontSize:11}}>Seakeeper</label>
                  <input type="number" value={logForm.skHours} onChange={e=>setLogForm(f=>({...f,skHours:e.target.value}))} style={inp}/></div>
                <div><label style={{...lbl,fontSize:11}}>{L("Combustible","Fuel")}</label>
                  <div style={{display:"flex",gap:5}}>
                    <input type="number" value={logForm.fuelQty} onChange={e=>setLogForm(f=>({...f,fuelQty:e.target.value}))} style={{...inp,flex:1}}/>
                    <select value={logForm.fuelUnit} onChange={e=>setLogForm(f=>({...f,fuelUnit:e.target.value}))} style={{...inp,width:70}}>
                      {["gal","lts","%"].map(u=><option key={u} value={u}>{u}</option>)}
                    </select>
                  </div></div>
              </div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:7}}>
                {L("Lo que anotes aquí actualiza el tablero del barco.","What you enter here updates the vessel dashboard.")}
              </div>
            </div>
          </Card>
        )}

        {formError && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",padding:"11px 14px",borderRadius:10,fontSize:13,marginBottom:14}}>
            {formError}
          </div>
        )}

        {authed && mode && <button onClick={mode==="bitacora"?submitLog:submit} disabled={sending} style={{
          width:"100%", padding:"15px", borderRadius:12, border:"none", cursor: sending ? "default" : "pointer",
          background: sending ? "#94a3b8" : "linear-gradient(120deg,#2563eb,#0ea5e9)",
          color:"#fff", fontSize:16, fontWeight:700,
        }}>
          {sending ? "Registrando..." : action === "checkout" ? "Registrar salida" : "Registrar entrada"}
        </button>}

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
