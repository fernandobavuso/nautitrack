import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { notify } from "./notifications";

// Propuestas de trabajo FIJO que recibe el tripulante
// Marca Interesado / No interesado
export default function CrewProposals({ user, profile }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(()=>{ load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("crew_proposals")
      .select("*, search:search_id(*), owner:owner_id(full_name)")
      .eq("crew_id", user.id).order("created_at",{ascending:false});
    setProposals(data||[]);
    setLoading(false);
  };

  const respond = async (prop, status) => {
    await supabase.from("crew_proposals").update({ crew_status:status }).eq("id", prop.id);
    if (status==="interested") {
      // Avisar al dueño que hay un interesado → aparece en "Posible tripulación"
      const myName = profile?.full_name?.trim() || `${profile?.first_name||""} ${profile?.last_name||""}`.trim() || "Un tripulante";
      notify(prop.owner_id, { type:"crew_interested", title:"Candidato interesado", body:`${myName} está interesado en tu búsqueda de ${prop.search?.role||"tripulación"}.`, link:"tripulacion" });
      setMsg("¡Genial! El propietario verá tu interés y podrá contactarte.");
    } else {
      setMsg("Marcado como no interesado.");
    }
    setTimeout(()=>setMsg(""),4000);
    load();
  };

  if (loading) return <div style={{padding:30,textAlign:"center",color:"#94a3b8"}}>Cargando...</div>;

  const pending = proposals.filter(p=>p.crew_status==="pending");
  const responded = proposals.filter(p=>p.crew_status!=="pending");

  return (
    <div style={{maxWidth:680}}>
      <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:4}}>Propuestas de trabajo</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Propietarios que buscan tripulación fija y tú calificas</div>

      {proposals.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
          <div style={{fontWeight:600}}>Sin propuestas por ahora</div>
          <div style={{fontSize:12,marginTop:4}}>Cuando un propietario busque un perfil como el tuyo en tu ciudad, te avisaremos</div>
        </div>
      )}

      {/* Pendientes de responder */}
      {pending.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Nuevas</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {pending.map(p=>{
              const s = p.search||{};
              return (
                <div key={p.id} style={{background:"#fff",border:"1.5px solid #bfdbfe",borderRadius:14,padding:16}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{s.role||"Tripulación"}</div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>{s.city||""}{s.contract_type?` · ${s.contract_type}`:""}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                    {s.min_experience&&<span style={tag}>{s.min_experience}+ años exp.</span>}
                    {s.liveaboard&&<span style={tag}>Vive a bordo</span>}
                    {(s.languages||[]).map(l=><span key={l} style={tag}>{l}</span>)}
                    {(s.certifications||[]).map(c=><span key={c} style={tag}>{c}</span>)}
                  </div>
                  {s.notes&&<div style={{fontSize:12,color:"#475569",marginBottom:12,background:"#f8fafc",padding:"10px 12px",borderRadius:8}}>{s.notes}</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>respond(p,"not_interested")} style={{flex:1,padding:"10px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:8,color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>No me interesa</button>
                    <button onClick={()=>respond(p,"interested")} style={{flex:2,padding:"10px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Me interesa</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ya respondidas */}
      {responded.length>0&&(
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Respondidas</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {responded.map(p=>{
              const s = p.search||{};
              const interested = p.crew_status==="interested";
              return (
                <div key={p.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{s.role||"Tripulación"}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{s.city||""}</div>
                  </div>
                  <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:interested?"#f0fdf4":"#f1f5f9",color:interested?"#16a34a":"#94a3b8"}}>{interested?"Interesado":"No interesado"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000,maxWidth:340,textAlign:"center"}}>{msg}</div>}
    </div>
  );
}

const tag = {fontSize:10,background:"#eff6ff",color:"#2563eb",padding:"3px 9px",borderRadius:10,fontWeight:600};
