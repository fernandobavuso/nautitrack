import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { createInvitation } from "./invitations.jsx";

// Panel donde el dueño de la flota (Fernando) invita a co-gestores
// (ej: su colega de The Boating Zone) con acceso total a todos sus barcos.
export default function FleetManagers({ user, vessels = [], onClose }) {
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const [managers, setManagers] = useState([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [partners, setPartners]   = useState([]);
  const [pendingInv, setPendingInv] = useState([]);
  const [editPartner, setEditPartner] = useState(null);   // {email, vesselIds}
  const [pEmail, setPEmail]       = useState("");
  const [pVessels, setPVessels]   = useState([]);
  const [pAdding, setPAdding]     = useState(false);
  const [pInviteLink, setPInviteLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const loadPartners = async () => {
    const { data, error } = await supabase.from("vessel_partners")
      .select("*").eq("owner_id", user.id).order("partner_email");
    if (error) { console.error("[Carive] socios:", error.message); flash("Error: "+error.message); }
    setPartners(data || []);

    // Socios invitados por link que aún no aceptan: no existen todavía en
    // vessel_partners, pero deben verse como "invitación enviada".
    const { data: inv } = await supabase.from("invitations")
      .select("invited_email, status, role_detail")
      .eq("inviter_id", user.id).eq("kind", "partner").eq("status", "pending");
    setPendingInv(inv || []);
  };

  const load = async () => {
    const { data } = await supabase.from("fleet_managers")
      .select("*, manager:manager_id(full_name,email)")
      .eq("fleet_owner_id", user.id).eq("status","active");
    setManagers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); loadPartners(); }, []);

  const flash = (t) => { setMsg(t); setTimeout(()=>setMsg(""), 4000); };

  const addManager = async () => {
    const em = email.trim().toLowerCase();
    if (!em) { flash("Escribe el correo de tu colega"); return; }
    setAdding(true);
    try {
      // Buscar el perfil por correo
      const { data: prof } = await supabase.from("profiles").select("id,email,full_name").eq("email", em).maybeSingle();

      if (prof) {
        // Ya tiene cuenta: vincular directo
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
      } else {
        // No tiene cuenta: generar link de invitación
        const link = await createInvitation({ kind:"manager", inviter:user, invitedEmail:em });
        setInviteLink(link);
        flash("");
      }
    } catch (err) {
      flash("Error: " + err.message);
    }
    setAdding(false);
  };

  const addPartner = async () => {
    const em = pEmail.trim().toLowerCase();
    if (!em || !em.includes("@")) { flash(L("Escribe un correo válido","Enter a valid email")); return; }
    if (!pVessels.length) { flash(L("Elige al menos un barco","Pick at least one vessel")); return; }
    setPAdding(true); setPInviteLink("");
    try {
      const { data: prof } = await supabase.from("profiles").select("id, full_name").ilike("email", em).maybeSingle();
      if (prof) {
        const rows = pVessels.map(vid => ({ owner_id:user.id, partner_id:prof.id, partner_email:em, vessel_id:vid, status:"active" }));
        const { error } = await supabase.from("vessel_partners").upsert(rows, { onConflict:"partner_id,vessel_id" });
        if (error) throw error;
        flash(L(`${prof.full_name||em} ya puede ver esos barcos (solo lectura).`,`${prof.full_name||em} can now view those vessels (read only).`));
        setPEmail(""); setPVessels([]); loadPartners();
      } else {
        const vnames = vessels.filter(v=>pVessels.includes(v.id)).map(v=>v.name).join(", ");
        const link = await createInvitation({ kind:"partner", inviter:user, invitedEmail:em, roleDetail: JSON.stringify(pVessels), vessel:{ id:null, name:vnames } });
        setPInviteLink(link);
        flash("");
      }
    } catch (err) { flash("Error: " + err.message); }
    setPAdding(false);
  };

  // Cambiar a qué barcos accede un socio ya dado de alta
  const savePartnerVessels = async () => {
    const { email, vesselIds } = editPartner;
    const current = partners.filter(p => p.partner_email === email);
    const partnerId = current[0]?.partner_id || null;
    const currentIds = current.map(p => p.vessel_id);
    const toAdd = vesselIds.filter(id => !currentIds.includes(id));
    const toDel = currentIds.filter(id => !vesselIds.includes(id));
    try {
      if (toDel.length) {
        const { error } = await supabase.from("vessel_partners")
          .delete().eq("owner_id", user.id).eq("partner_email", email).in("vessel_id", toDel);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase.from("vessel_partners").upsert(
          toAdd.map(vid => ({ owner_id:user.id, partner_id:partnerId, partner_email:email, vessel_id:vid, status:"active" })),
          { onConflict:"partner_id,vessel_id" });
        if (error) throw error;
      }
      setEditPartner(null); loadPartners();
      flash(L("Acceso actualizado.","Access updated."));
    } catch (err) { flash("Error: " + err.message); }
  };

  const removePartnerAccess = async (email) => {
    if (!confirm(L(`¿Quitar el acceso de ${email}?`,`Remove ${email}'s access?`))) return;
    await supabase.from("vessel_partners").delete().eq("owner_id", user.id).eq("partner_email", email);
    loadPartners();
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    flash("Link copiado. Compártelo con tu colega por WhatsApp, correo o donde quieras.");
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
          <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>{L("Accesos a la app","App access")}</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>×</button>
        </div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:18,lineHeight:1.5}}>
          Da acceso a la app a otras personas para que gestionen tus barcos contigo. Tendrán <strong>acceso total</strong>: ver y editar todos tus barcos, igual que tú. (Para el personal que solo trabaja en los barcos, usa <strong>{L("Personal","Staff")}</strong>.)
        </div>

        {/* Agregar */}
        <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:14,marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,color:"#0369a1",marginBottom:8}}>{L("Dar acceso a alguien","Give someone access")}</div>
          <div style={{display:"flex",gap:8}}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={{...inp,flex:1}}/>
            <button onClick={addManager} disabled={adding} style={{...btnPrimary,opacity:adding?.6:1,whiteSpace:"nowrap"}}>{adding?"Agregando...":"Dar acceso"}</button>
          </div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:6}}>{L("Si no tiene cuenta, te generamos un link de invitación para enviarle.","If they don't have an account, we'll generate an invite link for you to send.")}</div>
        </div>

        {/* Link de invitación generado */}
        {inviteLink && (
          <div style={{background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:12,padding:14,marginBottom:18}}>
            <div style={{fontSize:12,fontWeight:700,color:"#065f46",marginBottom:6}}>{L("Esta persona aún no tiene cuenta — envíale este link","This person doesn't have an account yet — send them this link")}</div>
            <div style={{fontSize:11,color:"#047857",marginBottom:10,lineHeight:1.5}}>{L("Cuando lo abra y cree su cuenta, quedará automáticamente como co-gestor de tu flota con acceso a todos tus barcos.","When they open it and create their account, they'll automatically become a co-manager of your fleet with access to all your boats.")}</div>
            <div style={{display:"flex",gap:8}}>
              <input readOnly value={inviteLink} style={{...inp,flex:1,fontSize:11,background:"#fff"}} onClick={e=>e.target.select()}/>
              <button onClick={copyLink} style={{...btnPrimary,whiteSpace:"nowrap"}}>{L("Copiar link","Copy link")}</button>
            </div>
            <button onClick={()=>{setInviteLink("");setEmail("");}} style={{background:"none",border:"none",color:"#059669",fontSize:11,fontWeight:600,cursor:"pointer",marginTop:8,padding:0}}>{L("Listo","Done")}</button>
          </div>
        )}

        {msg && <div style={{fontSize:12,color:"#0369a1",background:"#f0f9ff",padding:"8px 12px",borderRadius:8,marginBottom:14}}>{msg}</div>}

        {/* Lista */}
        <div style={{fontSize:12,fontWeight:700,color:"#0a2540",marginBottom:8}}>Con acceso ({managers.length})</div>
        {loading ? <div style={{color:"#94a3b8",fontSize:13,padding:10}}>{L("Cargando...","Loading...")}</div> :
         managers.length===0 ? <div style={{color:"#94a3b8",fontSize:13,padding:"10px 0"}}>{L("Aún no le has dado acceso a nadie. Solo tú gestionas tus barcos.","You haven't given anyone access yet. Only you manage your boats.")}</div> :
         <div style={{display:"flex",flexDirection:"column",gap:8}}>
           {managers.map(m=>(
             <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:10}}>
               <div>
                 <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{m.manager?.full_name || m.manager_email}</div>
                 <div style={{fontSize:11,color:"#94a3b8"}}>{m.manager?.email || m.manager_email} · Acceso total</div>
               </div>
               <button onClick={()=>removeManager(m)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12,fontWeight:600}}>{L("Quitar","Remove")}</button>
             </div>
           ))}
         </div>}

        {/* ── Socios (solo lectura) ─────────────────────────────────────────── */}
        <div style={{borderTop:"1px solid #e2e8f0",marginTop:20,paddingTop:16}}>
          <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{L("Socios (solo lectura)","Partners (read only)")}</div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2,marginBottom:10}}>
            {L("Ven bitácora, tareas, calendario y gastos SOLO de los barcos que elijas. No pueden editar nada.",
               "They see logbook, tasks, calendar and expenses ONLY for the vessels you pick. They can't edit anything.")}
          </div>

          <input value={pEmail} onChange={e=>setPEmail(e.target.value)} placeholder={L("correo del socio","partner's email")} style={{...inp,width:"100%",marginBottom:8}}/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {vessels.map(v=>(
              <button key={v.id} onClick={()=>setPVessels(l=>l.includes(v.id)?l.filter(x=>x!==v.id):[...l,v.id])}
                style={{padding:"6px 12px",borderRadius:18,border:`1.5px solid ${pVessels.includes(v.id)?"#2563eb":"#e2e8f0"}`,background:pVessels.includes(v.id)?"#eff6ff":"#fff",color:pVessels.includes(v.id)?"#1e40af":"#475569",fontSize:12,fontWeight:pVessels.includes(v.id)?700:400,cursor:"pointer"}}>
                {pVessels.includes(v.id)?"✓ ":""}{v.name}
              </button>
            ))}
          </div>
          <button onClick={addPartner} disabled={pAdding} style={{...btnPrimary,width:"100%",opacity:pAdding?0.6:1}}>
            {pAdding ? L("Agregando...","Adding...") : L("Dar acceso de solo lectura","Grant read-only access")}
          </button>

          {pInviteLink && (
            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:"10px 12px",marginTop:10}}>
              <div style={{fontSize:12,color:"#0369a1",fontWeight:600,marginBottom:6}}>
                {L("No tiene cuenta todavía. Compártele este link para que se registre y quede vinculado:","No account yet. Share this link so they sign up and get linked:")}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input readOnly value={pInviteLink} style={{...inp,flex:1,fontSize:11}}/>
                <button onClick={()=>{navigator.clipboard?.writeText(pInviteLink);flash(L("Link copiado","Link copied"));}} style={{...btnPrimary,padding:"8px 12px",fontSize:12}}>{L("Copiar","Copy")}</button>
              </div>
            </div>
          )}

          {pendingInv.length>0 && (
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
              {pendingInv.map(iv=>{
                let ids=[]; try { ids=JSON.parse(iv.role_detail||"[]"); } catch { ids=[]; }
                const names=ids.map(id=>vessels.find(v=>v.id===id)?.name).filter(Boolean).join(", ");
                return (
                  <div key={iv.invited_email} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#92400e"}}>{iv.invited_email}</div>
                      <div style={{fontSize:11,color:"#b45309"}}>{names||"—"} · {L("invitación enviada, aún no acepta","invite sent, not accepted yet")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {partners.length>0 && (
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
              {[...new Set(partners.map(pt=>pt.partner_email))].map(em=>{
                const theirs = partners.filter(pt=>pt.partner_email===em);
                const names = theirs.map(pt=>vessels.find(v=>v.id===pt.vessel_id)?.name).filter(Boolean).join(", ");
                return (
                  <div key={em}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#f8fafc",borderRadius:9}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{em}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{names||L("(barcos por confirmar)","(vessels pending)")} · {theirs[0].status==="active"?L("activo","active"):theirs[0].status}</div>
                    </div>
                    <button onClick={()=>setEditPartner(editPartner?.email===em?null:{email:em,vesselIds:theirs.map(t=>t.vessel_id)})}
                      style={{background:"none",border:"none",cursor:"pointer",color:"#2563eb",fontSize:12,fontWeight:600,marginRight:10}}>
                      {editPartner?.email===em ? L("Cerrar","Close") : L("Editar barcos","Edit vessels")}
                    </button>
                    <button onClick={()=>removePartnerAccess(em)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12,fontWeight:600}}>{L("Quitar","Remove")}</button>
                  </div>
                  {editPartner?.email===em && (
                    <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:9,padding:"11px 12px",marginTop:-2,marginBottom:4}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:7}}>{L("¿A qué barcos puede acceder?","Which vessels can they access?")}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                        {vessels.map(v=>{
                          const on = editPartner.vesselIds.includes(v.id);
                          return (
                            <button key={v.id} onClick={()=>setEditPartner(ep=>({...ep, vesselIds: on ? ep.vesselIds.filter(x=>x!==v.id) : [...ep.vesselIds, v.id]}))}
                              style={{padding:"6px 12px",borderRadius:18,cursor:"pointer",fontSize:12,fontWeight:on?700:400,
                                border:`1.5px solid ${on?"#2563eb":"#e2e8f0"}`,background:on?"#eff6ff":"#fff",color:on?"#1e40af":"#475569"}}>
                              {on?"✓ ":""}{v.name}
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={savePartnerVessels} disabled={!editPartner.vesselIds.length}
                        style={{...btnPrimary,width:"100%",opacity:editPartner.vesselIds.length?1:0.5}}>
                        {L("Guardar cambios","Save changes")}
                      </button>
                      {!editPartner.vesselIds.length && (
                        <div style={{fontSize:11,color:"#b45309",marginTop:6}}>
                          {L("Deja al menos un barco, o usa “Quitar” para revocar el acceso completo.","Keep at least one vessel, or use “Remove” to revoke all access.")}
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ov = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:20};
const box = {background:"#fff",borderRadius:18,padding:24,maxWidth:460,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
const btnPrimary = {padding:"10px 16px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"};
const inp = {padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none"};
