import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// Panel donde el dueño de la flota (Fernando) invita a co-gestores
// (ej: su colega de The Boating Zone) con acceso total a todos sus barcos.
export default function FleetManagers({ user, onClose }) {
  const [managers, setManagers] = useState([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("fleet_managers")
      .select("*, manager:manager_id(full_name,email)")
      .eq("fleet_owner_id", user.id).eq("status","active");
    setManagers(data || []);
    setLoading(false);
  };

  const flash = (t) => { setMsg(t); setTimeout(()=>setMsg(""), 4000); };

  const addManager = async () => {
    const em = email.trim().toLowerCase();
    if (!em) { flash("Escribe el correo de tu colega"); return; }
    setAdding(true);
    try {
      // Buscar el perfil por correo
      const { data: prof } = await supabase.from("profiles").select("id,email,full_name").eq("email", em).maybeSingle();
      if (!prof) {
        flash("No hay ninguna cuenta con ese correo. Pídele que se registre primero en Carive y vuelve a intentarlo.");
        setAdding(false);
        return;
      }
      if (prof.id === user.id) { flash("Ese eres tú."); setAdding(false); return; }
      const { error } = await supabase.from("fleet_managers").insert({
        fleet_owner_id: user.id, manager_id: prof.id, manager_email: em, status:"active",
      });
      if (error) {
        if (error.code === "23505") flash("Esa persona ya es co-gestor de tu flota.");
        else flash("Error: " + error.message);
        setAdding(false);
        return;
      }
      // Notificar al colega
      try {
        await supabase.from("app_notifications").insert({
          user_id: prof.id, type:"fleet_access",
          title:"Ahora gestionas una flota",
          body:`${user.full_name || user.email} te dio acceso a gestionar sus barcos en Carive. Vuelve a entrar para verlos.`,
        });
      } catch(e){}
      flash(`${prof.full_name || em} ahora tiene acceso a todos tus barcos.`);
      setEmail("");
      load();
    } catch (err) {
      flash("Error: " + err.message);
    }
    setAdding(false);
  };

  const removeManager = async (m) => {
    if (!confirm(`¿Quitar el acceso de ${m.manager?.full_name || m.manager_email}? Dejará de ver tus barcos.`)) return;
    await supabase.from("fleet_managers").delete().eq("id", m.id);
    flash("Acceso removido");
    load();
  };

  return (
    <div style={ov} onClick={onClose}>
      <div style={box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>Equipo de gestión</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>×</button>
        </div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:18,lineHeight:1.5}}>
          Invita a personas de tu equipo para que gestionen tus barcos contigo. Tendrán <strong>acceso total</strong>: ver y editar todos tus barcos, igual que tú.
        </div>

        {/* Agregar */}
        <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:14,marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,color:"#0369a1",marginBottom:8}}>Agregar a alguien de tu equipo</div>
          <div style={{display:"flex",gap:8}}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={{...inp,flex:1}}/>
            <button onClick={addManager} disabled={adding} style={{...btnPrimary,opacity:adding?.6:1,whiteSpace:"nowrap"}}>{adding?"Agregando...":"Dar acceso"}</button>
          </div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:6}}>La persona debe tener ya una cuenta en Carive con ese correo.</div>
        </div>

        {msg && <div style={{fontSize:12,color:"#0369a1",background:"#f0f9ff",padding:"8px 12px",borderRadius:8,marginBottom:14}}>{msg}</div>}

        {/* Lista */}
        <div style={{fontSize:12,fontWeight:700,color:"#0a2540",marginBottom:8}}>Tu equipo ({managers.length})</div>
        {loading ? <div style={{color:"#94a3b8",fontSize:13,padding:10}}>Cargando...</div> :
         managers.length===0 ? <div style={{color:"#94a3b8",fontSize:13,padding:"10px 0"}}>Aún no has agregado a nadie. Solo tú gestionas tus barcos.</div> :
         <div style={{display:"flex",flexDirection:"column",gap:8}}>
           {managers.map(m=>(
             <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:10}}>
               <div>
                 <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{m.manager?.full_name || m.manager_email}</div>
                 <div style={{fontSize:11,color:"#94a3b8"}}>{m.manager?.email || m.manager_email} · Acceso total</div>
               </div>
               <button onClick={()=>removeManager(m)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12,fontWeight:600}}>Quitar</button>
             </div>
           ))}
         </div>}
      </div>
    </div>
  );
}

const ov = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:20};
const box = {background:"#fff",borderRadius:18,padding:24,maxWidth:460,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
const btnPrimary = {padding:"10px 16px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"};
const inp = {padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none"};
