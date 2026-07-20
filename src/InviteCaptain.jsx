// Panel para que el dueño invite/gestione capitanes
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export default function InviteCaptain({ vessel, onClose }) {
  const [captains, setCaptains] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [email,    setEmail]    = useState("");
  const [name,     setName]     = useState("");
  const [role,     setRole]     = useState("Capitán");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState(null);

  useEffect(() => { loadCaptains(); }, []);

  const loadCaptains = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("captain_profiles")
      .select("*")
      .eq("vessel_id", vessel.id)
      .order("created_at", { ascending: false });
    setCaptains(data || []);
    setLoading(false);
  };

  const invite = async () => {
    if (!email.trim() || !name.trim()) { setMsg({ type:"error", text:"Completa nombre y email" }); return; }
    setSaving(true); setMsg(null);
    try {
      // Buscar si el usuario ya existe en auth
      const { data: profile } = await supabase
        .from("profiles").select("id").eq("email", email.trim()).single();

      if (!profile) {
        setMsg({ type:"error", text:"Este email no tiene cuenta en Carive. Pídele que se registre primero." });
        setSaving(false); return;
      }

      // Crear captain_profile
      const { error } = await supabase.from("captain_profiles").upsert({
        user_id:   profile.id,
        vessel_id: vessel.id,
        full_name: name.trim(),
        role,
        active: true,
      }, { onConflict: "user_id,vessel_id" });

      if (error) throw error;
      setMsg({ type:"success", text:`✓ ${name} agregado como ${role}` });
      setEmail(""); setName("");
      loadCaptains();
    } catch(e) {
      setMsg({ type:"error", text:"Error: " + e.message });
    }
    setSaving(false);
  };

  const toggleActive = async (c) => {
    await supabase.from("captain_profiles").update({ active: !c.active }).eq("id", c.id);
    loadCaptains();
  };

  const remove = async (c) => {
    if (!confirm(`¿Quitar acceso a ${c.full_name}?`)) return;
    await supabase.from("captain_profiles").delete().eq("id", c.id);
    loadCaptains();
  };

  return (
    <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>👨‍✈️ Tripulación con Acceso</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2}}>{vessel.name}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16}}>✕</button>
        </div>

        <div style={{padding:24}}>
          {/* Formulario de invitación */}
          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:18,marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"#0369a1",marginBottom:12}}>Agregar Capitán o Tripulante</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={s.label}>Nombre completo *</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Diego Chico" style={s.input}/>
              </div>
              <div>
                <label style={s.label}>Rol</label>
                <select value={role} onChange={e=>setRole(e.target.value)} style={s.input}>
                  <option>Capitán</option>
                  <option>Primer Oficial</option>
                  <option>Marinero</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={s.label}>Email (debe tener cuenta en Carive) *</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="capitan@email.com" style={s.input} type="email"/>
            </div>
            {msg&&<div style={{padding:"8px 12px",borderRadius:8,fontSize:12,fontWeight:600,marginBottom:10,background:msg.type==="success"?"#f0fdf4":"#fff5f5",color:msg.type==="success"?"#15803d":"#dc2626"}}>{msg.text}</div>}
            <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>
              💡 La persona debe crear su cuenta en <strong>app.carive.co</strong> primero con ese email.
            </div>
            <button onClick={invite} disabled={saving} style={{...s.btn,opacity:saving?0.6:1}}>
              {saving?"⏳ Guardando...":"＋ Dar acceso"}
            </button>
          </div>

          {/* Lista de capitanes */}
          <div style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:10}}>CON ACCESO ACTUALMENTE</div>
          {loading&&<div style={{textAlign:"center",padding:20,color:"#64748b"}}>⏳ Cargando...</div>}
          {!loading&&captains.length===0&&(
            <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
              <div style={{fontSize:32,marginBottom:8}}>👨‍✈️</div>
              <div>Sin tripulación con acceso aún</div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {captains.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"#fff",border:`1px solid ${c.active?"#bbf7d0":"#e2e8f0"}`,borderRadius:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:c.active?"linear-gradient(120deg,#2563eb,#0ea5e9)":"#e2e8f0",color:c.active?"#fff":"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0}}>
                  {c.full_name?.[0]||"?"}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{c.full_name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{c.role} · {c.active?"🟢 Activo":"⚫ Inactivo"}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>toggleActive(c)} style={{padding:"5px 10px",border:"1px solid #e2e8f0",borderRadius:6,background:"#f8fafc",cursor:"pointer",fontSize:11,color:"#475569"}}>
                    {c.active?"Desactivar":"Activar"}
                  </button>
                  <button onClick={()=>remove(c)} style={{padding:"5px 8px",border:"1px solid #fecaca",borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:"#dc2626"}}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20},
  modal:   {background:"#fff",borderRadius:20,width:"100%",maxWidth:560,boxShadow:"0 30px 80px rgba(0,0,0,0.3)",overflow:"hidden",maxHeight:"90vh",overflowY:"auto"},
  header:  {background:"linear-gradient(135deg,#1e3a5f,#2563eb)",padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"},
  label:   {display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:5},
  input:   {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"},
  btn:     {width:"100%",padding:"10px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"},
};
