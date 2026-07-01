// Página pública de QR Check-in / Check-out
// URL: nautitrack.vercel.app/checkin?v=VESSEL_ID
// No requiere login — accesible desde cualquier celular al escanear QR

import { useState, useEffect } from "react";

export default function CheckinPage() {
  const params   = new URLSearchParams(window.location.search);
  const vesselId = params.get("v");

  const [vessel,    setVessel]    = useState(null);
  const [recentLogs,setRecentLogs]= useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // Form state
  const [name,     setName]     = useState("");
  const [role,     setRole]     = useState("Marinero");
  const [action,   setAction]   = useState(null);   // null | "checkin" | "checkout"
  const [note,     setNote]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [done,     setDone]     = useState(null);   // resultado final

  useEffect(() => {
    if (!vesselId) { setError("QR inválido — no se encontró la embarcación."); setLoading(false); return; }
    fetch(`/api/checkin?vesselId=${vesselId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); }
        else { setVessel(d.vessel); setRecentLogs(d.recentLogs || []); }
        setLoading(false);
      })
      .catch(() => { setError("Error de conexión."); setLoading(false); });
  }, [vesselId]);

  const handleSubmit = async () => {
    if (!name.trim() || !action) return;
    setSending(true);
    try {
      const resp = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId, crewName: name.trim(), crewRole: role,
          action, locationNote: note.trim(), notes: ""
        })
      });
      const data = await resp.json();
      if (data.success) {
        setDone({ action, name: name.trim(), role, time: new Date() });
      } else {
        setError("Error al registrar. Intenta de nuevo.");
      }
    } catch(e) {
      setError("Error de conexión.");
    }
    setSending(false);
  };

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString("es-VE", { hour:"2-digit", minute:"2-digit", hour12:true });
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("es-VE", { weekday:"short", day:"numeric", month:"short" });

  // ── Loading ──
  if (loading) return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={{textAlign:"center", padding:"40px 0", color:"#64748b"}}>
          <div style={{fontSize:32, marginBottom:12}}>⚓</div>
          <div>Cargando...</div>
        </div>
      </div>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={{textAlign:"center", padding:"40px 0"}}>
          <div style={{fontSize:40, marginBottom:12}}>⚠️</div>
          <div style={{fontWeight:700, color:"#dc2626", marginBottom:8}}>QR inválido</div>
          <div style={{fontSize:13, color:"#64748b"}}>{error}</div>
        </div>
      </div>
    </div>
  );

  // ── Éxito ──
  if (done) return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={{textAlign:"center", padding:"20px 0"}}>
          <div style={{fontSize:64, marginBottom:16}}>{done.action==="checkin" ? "✅" : "👋"}</div>
          <div style={{fontSize:22, fontWeight:800, color:"#0f172a", marginBottom:8}}>
            {done.action==="checkin" ? "¡Check-in registrado!" : "¡Check-out registrado!"}
          </div>
          <div style={{fontSize:14, color:"#475569", marginBottom:4}}>
            {done.name} · {done.role}
          </div>
          <div style={{fontSize:13, color:"#94a3b8", marginBottom:24}}>
            {fmtTime(done.time)} · {fmtDate(done.time)}
          </div>
          <div style={{background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:"14px 18px", marginBottom:20}}>
            <div style={{fontSize:13, color:"#15803d", fontWeight:600}}>🚢 {vessel.name}</div>
            <div style={{fontSize:12, color:"#64748b", marginTop:2}}>{vessel.marina}</div>
          </div>
          <div style={{fontSize:12, color:"#94a3b8"}}>
            📱 El propietario fue notificado por WhatsApp
          </div>
          <button onClick={()=>{ setDone(null); setName(""); setNote(""); setAction(null); }}
            style={{...s.btnOutline, marginTop:20, width:"100%"}}>
            Registrar otra persona
          </button>
        </div>
      </div>
    </div>
  );

  // ── Formulario principal ──
  return (
    <div style={s.root}>
      <div style={s.card}>

        {/* Header barco */}
        <div style={s.vesselHeader}>
          <div style={{fontSize:32}}>🚢</div>
          <div>
            <div style={{fontSize:18, fontWeight:800, color:"#fff"}}>{vessel.name}</div>
            <div style={{fontSize:12, color:"rgba(255,255,255,0.8)", marginTop:2}}>
              {vessel.type} · {vessel.marina}
            </div>
          </div>
        </div>

        {/* Logo */}
        <div style={{textAlign:"center", padding:"12px 0 4px", borderBottom:"1px solid #f1f5f9", marginBottom:20}}>
          <span style={{fontSize:11, color:"#94a3b8", letterSpacing:"0.1em"}}>NAUTITRACK.VZ</span>
        </div>

        {/* Nombre */}
        <div style={{marginBottom:14}}>
          <label style={s.label}>Tu nombre completo *</label>
          <input value={name} onChange={e=>setName(e.target.value)}
            placeholder="Ej: Carlos Mendoza"
            style={s.input} autoFocus/>
        </div>

        {/* Rol */}
        <div style={{marginBottom:18}}>
          <label style={s.label}>Tu rol en esta embarcación</label>
          <div style={{display:"flex", gap:8}}>
            {["Capitán","Marinero","Técnico","Invitado"].map(r=>(
              <button key={r} onClick={()=>setRole(r)} style={{
                flex:1, padding:"8px 4px", border:"1.5px solid",
                borderRadius:8, fontSize:12, cursor:"pointer",
                background:   role===r ? "#eff6ff" : "#f8fafc",
                borderColor:  role===r ? "#2563eb" : "#e2e8f0",
                color:        role===r ? "#2563eb" : "#64748b",
                fontWeight:   role===r ? 700 : 400,
              }}>{r}</button>
            ))}
          </div>
        </div>

        {/* Nota opcional */}
        <div style={{marginBottom:20}}>
          <label style={s.label}>Nota <span style={{color:"#94a3b8", fontWeight:400}}>(opcional)</span></label>
          <input value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Ej: Llegué para revisión de motores"
            style={s.input}/>
        </div>

        {/* Botones CHECK-IN / CHECK-OUT */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:8}}>
          <button
            onClick={()=>{ setAction("checkin"); }}
            style={{
              ...s.btnCheckin,
              opacity: action==="checkout" ? 0.4 : 1,
              transform: action==="checkin" ? "scale(1.02)" : "scale(1)",
              boxShadow: action==="checkin" ? "0 4px 20px rgba(22,163,74,0.35)" : "none",
            }}>
            <div style={{fontSize:28, marginBottom:4}}>✅</div>
            <div style={{fontSize:16, fontWeight:800}}>CHECK-IN</div>
            <div style={{fontSize:11, opacity:0.85, marginTop:2}}>Llegué al barco</div>
          </button>
          <button
            onClick={()=>{ setAction("checkout"); }}
            style={{
              ...s.btnCheckout,
              opacity: action==="checkin" ? 0.4 : 1,
              transform: action==="checkout" ? "scale(1.02)" : "scale(1)",
              boxShadow: action==="checkout" ? "0 4px 20px rgba(220,38,38,0.3)" : "none",
            }}>
            <div style={{fontSize:28, marginBottom:4}}>🔴</div>
            <div style={{fontSize:16, fontWeight:800}}>CHECK-OUT</div>
            <div style={{fontSize:11, opacity:0.85, marginTop:2}}>Me voy del barco</div>
          </button>
        </div>

        {/* Confirmar */}
        {action && (
          <button onClick={handleSubmit} disabled={!name.trim() || sending}
            style={{...s.btnConfirm, opacity:(!name.trim()||sending)?0.5:1, marginTop:6}}>
            {sending ? "⏳ Registrando..." : `Confirmar ${action==="checkin"?"CHECK-IN":"CHECK-OUT"} →`}
          </button>
        )}

        {/* Log reciente */}
        {recentLogs.length > 0 && (
          <div style={{marginTop:24}}>
            <div style={{fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", marginBottom:10}}>
              ACTIVIDAD RECIENTE
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {recentLogs.slice(0,5).map((l,i)=>(
                <div key={i} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                  background:"#f8fafc", borderRadius:8, border:"1px solid #f1f5f9"}}>
                  <span style={{fontSize:14}}>{l.action==="checkin"?"✅":"🔴"}</span>
                  <div style={{flex:1}}>
                    <span style={{fontSize:12, fontWeight:600, color:"#1e293b"}}>{l.crew_name}</span>
                    <span style={{fontSize:11, color:"#94a3b8", marginLeft:6}}>{l.crew_role}</span>
                  </div>
                  <div style={{fontSize:11, color:"#94a3b8", textAlign:"right"}}>
                    <div>{fmtTime(l.timestamp)}</div>
                    <div>{fmtDate(l.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{marginTop:20, textAlign:"center", fontSize:11, color:"#cbd5e1"}}>
          Carive · Gestión inteligente de embarcaciones
        </div>
      </div>
    </div>
  );
}

const s = {
  root: { minHeight:"100vh", background:"linear-gradient(135deg,#0f172a,#1e3a5f)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'Segoe UI',system-ui,sans-serif" },
  card: { background:"#fff", borderRadius:20, width:"100%", maxWidth:420, overflow:"hidden", boxShadow:"0 30px 80px rgba(0,0,0,0.4)" },
  vesselHeader: { background:"linear-gradient(120deg,#2563eb,#0ea5e9)", padding:"20px 24px", display:"flex", alignItems:"center", gap:14 },
  label: { display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:6 },
  input: { width:"100%", padding:"11px 14px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:14, color:"#1e293b", background:"#fff", boxSizing:"border-box", outline:"none" },
  btnCheckin:  { padding:"20px 12px", background:"linear-gradient(135deg,#16a34a,#22c55e)", border:"none", borderRadius:12, color:"#fff", cursor:"pointer", transition:"all 0.2s", textAlign:"center" },
  btnCheckout: { padding:"20px 12px", background:"linear-gradient(135deg,#dc2626,#ef4444)", border:"none", borderRadius:12, color:"#fff", cursor:"pointer", transition:"all 0.2s", textAlign:"center" },
  btnConfirm:  { width:"100%", padding:"14px", background:"linear-gradient(120deg,#2563eb,#0ea5e9)", border:"none", borderRadius:10, color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" },
  btnOutline:  { padding:"11px 16px", border:"1.5px solid #e2e8f0", borderRadius:9, background:"#fff", color:"#475569", fontSize:13, fontWeight:500, cursor:"pointer" },
};