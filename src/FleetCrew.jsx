import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { IconUser, IconTrash } from "./icons.jsx";

// ─────────────────────────────────────────────────────────────
// Mi Equipo — roster de tripulación del gestor de flota.
//
// A diferencia de la tripulación por barco, esto es el POOL de gente
// de confianza del gestor. No está atado a una embarcación: es "mi gente",
// a quien llamo cuando necesito cubrir cualquier barco de la flota.
// ─────────────────────────────────────────────────────────────

const CREW_ROLES = [
  "Capitán", "Primer Oficial", "Jefe de Máquinas", "Mecánico",
  "Marinero", "Cocinero", "Camarero", "Azafata", "Otro",
];

const ROLE_EN = {
  "Capitán":"Captain", "Primer Oficial":"First Officer", "Jefe de Máquinas":"Chief Engineer",
  "Mecánico":"Mechanic", "Marinero":"Deckhand", "Cocinero":"Cook",
  "Camarero":"Steward", "Azafata":"Stewardess", "Otro":"Other",
};

export default function FleetCrew({ user, onClose }) {
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const rl = (r) => (lang === "en" ? (ROLE_EN[r] || r) : r);

  const [crew, setCrew] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name:"", role:"Capitán", phone:"", email:"", notes:"" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from("fleet_crew")
      .select("*")
      .eq("manager_id", user.id)
      .order("created_at", { ascending: false });
    setCrew(data || []);
    setLoading(false);
  };

  const add = async () => {
    if (!form.name.trim()) { flash(L("Escribe el nombre", "Enter the name")); return; }
    const { error } = await supabase.from("fleet_crew").insert({
      manager_id: user.id,
      name: form.name.trim(),
      role: form.role,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    });
    if (error) { flash("Error: " + error.message); return; }
    setForm({ name:"", role:"Capitán", phone:"", email:"", notes:"" });
    setAdding(false);
    flash(L("Agregado a tu equipo", "Added to your team"));
    load();
  };

  const remove = async (c) => {
    if (!window.confirm(L(`¿Quitar a ${c.name} de tu equipo?`, `Remove ${c.name} from your team?`))) return;
    await supabase.from("fleet_crew").delete().eq("id", c.id);
    flash(L("Quitado del equipo", "Removed from team"));
    load();
  };

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  return (
    <div style={ov} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>

        {/* Cabecera */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 22px",borderBottom:"1px solid #e2e8f0"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>
              {L("Mi Equipo", "My Team")}
            </div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2,lineHeight:1.5}}>
              {L(
                "Tu gente de confianza. No está atada a un barco: llámalos cuando necesites cubrir cualquier embarcación de tu flota.",
                "Your trusted people. Not tied to one boat: call them when you need to cover any vessel in your fleet."
              )}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
        </div>

        <div style={{padding:22,overflowY:"auto"}}>

          {msg && (
            <div style={{background:"#f0fdf4",color:"#15803d",padding:"9px 12px",borderRadius:8,fontSize:12,marginBottom:14}}>{msg}</div>
          )}

          {/* Botón agregar */}
          {!adding && (
            <button onClick={() => setAdding(true)} style={{width:"100%",padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:18}}>
              ＋ {L("Agregar a mi equipo", "Add to my team")}
            </button>
          )}

          {/* Formulario */}
          {adding && (
            <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:16,marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0a2540",marginBottom:12}}>
                {L("Nuevo miembro del equipo", "New team member")}
              </div>

              <label style={lbl}>{L("Nombre", "Name")} *</label>
              <input value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                placeholder={L("Ej: Carlos Mendoza", "e.g. Carlos Mendoza")} style={inp}/>

              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Rol", "Role")}</label>
                  <select value={form.role} onChange={e => setForm({...form, role:e.target.value})} style={inp}>
                    {CREW_ROLES.map(r => <option key={r} value={r}>{rl(r)}</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Teléfono", "Phone")}</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}
                    placeholder="+1 305..." style={inp}/>
                </div>
              </div>

              <label style={lbl}>{L("Email", "Email")}</label>
              <input value={form.email} onChange={e => setForm({...form, email:e.target.value})}
                placeholder="correo@ejemplo.com" style={inp}/>

              <label style={lbl}>{L("Notas", "Notes")}</label>
              <input value={form.notes} onChange={e => setForm({...form, notes:e.target.value})}
                placeholder={L("Ej: Licencia OUPV, disponible fines de semana", "e.g. OUPV license, available weekends")} style={inp}/>

              <div style={{display:"flex",gap:8,marginTop:14}}>
                <button onClick={() => { setAdding(false); setForm({ name:"", role:"Capitán", phone:"", email:"", notes:"" }); }}
                  style={{flex:1,padding:"10px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:9,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {L("Cancelar", "Cancel")}
                </button>
                <button onClick={add}
                  style={{flex:1,padding:"10px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {L("Guardar", "Save")}
                </button>
              </div>
            </div>
          )}

          {/* Lista del equipo */}
          {loading ? (
            <div style={{textAlign:"center",padding:30,color:"#94a3b8",fontSize:13}}>{L("Cargando...", "Loading...")}</div>
          ) : crew.length === 0 ? (
            <div style={{textAlign:"center",padding:"36px 20px",color:"#94a3b8"}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
                <IconUser size={34} color="#cbd5e1"/>
              </div>
              <div style={{fontWeight:600,fontSize:14,color:"#64748b"}}>{L("Aún no tienes equipo", "No team yet")}</div>
              <div style={{fontSize:12,marginTop:4}}>
                {L("Agrega los capitanes y marineros con los que trabajas.", "Add the captains and deckhands you work with.")}
              </div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.06em"}}>
                {crew.length} {crew.length === 1 ? L("PERSONA", "PERSON") : L("PERSONAS", "PEOPLE")}
              </div>
              {crew.map(c => (
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 15px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:12}}>
                  {/* Avatar con iniciales */}
                  <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#2563eb,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,flexShrink:0}}>
                    {c.name.split(" ").filter(Boolean).slice(0,2).map(w => w[0]).join("").toUpperCase()}
                  </div>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{c.name}</div>
                    <div style={{fontSize:12,color:"#64748b",marginTop:1}}>
                      <span style={{color:"#2563eb",fontWeight:600}}>{rl(c.role)}</span>
                      {c.phone && <> · {c.phone}</>}
                    </div>
                    {c.notes && (
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:3,fontStyle:"italic"}}>{c.notes}</div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {c.phone && (
                      <a href={`https://wa.me/${String(c.phone).replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer"
                        title="WhatsApp"
                        style={{display:"flex",padding:7,background:"#f0fdf4",borderRadius:8,textDecoration:"none"}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a">
                          <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"/>
                          <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.2-1.4c1.4.8 3 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.2.8.8-3.1-.2-.3c-.9-1.4-1.3-3-1.3-4.6C3.4 7.3 7.3 3.4 12 3.4s8.6 3.9 8.6 8.6-3.9 8.2-8.6 8.2z"/>
                        </svg>
                      </a>
                    )}
                    <button onClick={() => remove(c)} title={L("Quitar", "Remove")}
                      style={{display:"flex",padding:7,background:"#fef2f2",border:"none",borderRadius:8,cursor:"pointer"}}>
                      <IconTrash size={15} color="#dc2626"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const ov  = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:20};
const box = {background:"#fff",borderRadius:18,maxWidth:560,width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
const lbl = {display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:5,marginTop:10};
const inp = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none"};
