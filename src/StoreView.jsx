import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { notify } from "./notifications";
import { loadTiers, computeCommission } from "./commission.jsx";

const STORE_CATEGORIES = ["Filtros","Aceites y Lubricantes","Correas","Motores","Eléctrico","Electrónica/Navegación","Bombas","Hélices","Seguridad","Ánodos","Pinturas","Plomería","Tapicería","Ferretería marina","Otro"];

export default function StoreView({ user, onLogout }) {
  const [tab, setTab] = useState("solicitudes");
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [myResponses, setMyResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [respondTo, setRespondTo] = useState(null);

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => { if (profile) { loadRequests(); loadResponses(); } }, [profile]);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data || { id:user.id, store_categories:[], store_city:"", store_name:"" });
    setLoading(false);
  };

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({
      store_name:profile.store_name, store_city:profile.store_city,
      store_categories:profile.store_categories||[], store_phone:profile.store_phone,
      store_ships_nationwide:profile.store_ships_nationwide||false, store_address:profile.store_address,
    }).eq("id", user.id);
    setMsg(error?("Error: "+error.message):"Perfil guardado");
    setTimeout(()=>setMsg(""),3000);
  };

  const loadRequests = async () => {
    // Solicitudes abiertas que calzan con la ciudad y categorías de la tienda
    const { data } = await supabase.from("part_requests")
      .select("*, owner:owner_id(full_name)")
      .eq("status","open").order("created_at",{ascending:false});
    const cats = (profile.store_categories||[]).map(c=>c.toLowerCase());
    const city = (profile.store_city||"").toLowerCase().trim();
    const nationwide = profile.store_ships_nationwide;
    const filtered = (data||[]).filter(r => {
      const catMatch = cats.length===0 || cats.includes((r.category||"").toLowerCase());
      const cityMatch = nationwide || !city || !r.city || r.city.toLowerCase().includes(city) || city.includes(r.city.toLowerCase());
      return catMatch && cityMatch;
    });
    setRequests(filtered);
  };

  const loadResponses = async () => {
    const { data } = await supabase.from("part_responses")
      .select("*, request:request_id(*)").eq("store_id", user.id).order("created_at",{ascending:false});
    setMyResponses(data||[]);
  };

  const toggleCat = (c) => setProfile(p=>({...p, store_categories: (p.store_categories||[]).includes(c) ? p.store_categories.filter(x=>x!==c) : [...(p.store_categories||[]), c]}));

  const respondedIds = myResponses.map(r=>r.request_id);
  const profileComplete = profile?.store_name && profile?.store_city && (profile?.store_categories||[]).length>0;

  if (loading) return <div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>Cargando...</div>;

  return (
    <div style={{minHeight:"100vh",background:"#f0f7ff"}}>
      {/* Barra superior */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none"><path d="M15 4 L27 24 H3 Z" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinejoin="round"/><line x1="15" y1="4" x2="15" y2="24" stroke="#0ea5e9" strokeWidth="1.4"/></svg>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>Carive</div>
            <div style={{fontSize:10,color:"#64748b"}}>Tienda de Repuestos</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{k:"solicitudes",l:"Solicitudes"},{k:"respuestas",l:"Mis respuestas"},{k:"perfil",l:"Mi Tienda"}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?700:500,background:tab===t.k?"#eff6ff":"transparent",color:tab===t.k?"#0ea5e9":"#64748b"}}>{t.l}</button>
          ))}
          <button onClick={onLogout} style={{padding:"6px 12px",background:"none",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:12,color:"#94a3b8"}}>Salir</button>
        </div>
      </div>

      <div style={{maxWidth:760,margin:"0 auto",padding:"24px 20px"}}>
        {/* Aviso de perfil incompleto */}
        {!profileComplete && tab!=="perfil" && (
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#b45309",marginBottom:4}}>Completa tu perfil de tienda</div>
            <div style={{fontSize:12,color:"#92400e",marginBottom:10}}>Indica tu nombre, ciudad y categorías para empezar a recibir solicitudes de repuestos.</div>
            <button onClick={()=>setTab("perfil")} style={{padding:"8px 16px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Completar perfil</button>
          </div>
        )}

        {/* ── SOLICITUDES ── */}
        {tab==="solicitudes"&&(
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:4}}>Solicitudes de repuestos</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Pedidos que coinciden con tus categorías{profile.store_city?` en ${profile.store_city}`:""}</div>
            {requests.length===0&&(
              <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                <div style={{fontWeight:600}}>Sin solicitudes por ahora</div>
                <div style={{fontSize:12,marginTop:4}}>Te avisaremos cuando llegue un pedido de tu categoría</div>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {requests.map(r=>{
                const responded = respondedIds.includes(r.id);
                return (
                  <div key={r.id} style={{background:"#fff",border:`1px solid ${r.urgent?"#fecaca":"#e2e8f0"}`,borderRadius:12,padding:14}}>
                    {r.urgent&&<div style={{display:"inline-block",fontSize:10,background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:10,fontWeight:700,marginBottom:6}}>URGENTE · Barco varado</div>}
                    <div style={{display:"flex",gap:12}}>
                      {r.photo_url&&<img src={r.photo_url} style={{width:60,height:60,borderRadius:8,objectFit:"cover",flexShrink:0}} alt=""/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{r.item_name}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{r.category}{r.part_num?` · ${r.part_num}`:""} · {r.city||""}</div>
                        {r.description&&<div style={{fontSize:12,color:"#475569",marginTop:4}}>{r.description}</div>}
                      </div>
                    </div>
                    {responded
                      ? <div style={{marginTop:10,fontSize:12,color:"#16a34a",fontWeight:600,textAlign:"center"}}>Ya respondiste a esta solicitud</div>
                      : <button onClick={()=>setRespondTo(r)} style={{width:"100%",marginTop:10,padding:"9px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Responder</button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MIS RESPUESTAS ── */}
        {tab==="respuestas"&&(
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:16}}>Mis respuestas</div>
            {myResponses.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>Aún no has respondido a ninguna solicitud</div>}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {myResponses.map(r=>(
                <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{r.request?.item_name||"Repuesto"}</div>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>{r.request?.category}</div>
                  <div style={{fontSize:12,color:"#475569"}}>
                    Tu respuesta: {r.response_type==="have"?`Disponible · ${r.currency==="USD"?"$":"Bs."} ${r.price}`:r.response_type==="have_questions"?"Disponible, con preguntas":"No disponible"}
                  </div>
                  {r.message&&<div style={{fontSize:12,color:"#94a3b8",marginTop:4,fontStyle:"italic"}}>"{r.message}"</div>}
                  {r.is_winner ? (
                    <div style={{marginTop:8,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#16a34a"}}>¡Ganaste esta venta!</div>
                      {r.sale_amount&&<div style={{fontSize:11,color:"#15803d",marginTop:3}}>
                        Venta: ${r.sale_amount}{r.commission_amount!=null?` · Comisión plataforma (${r.commission_rate}%): $${r.commission_amount} · Recibes: $${(Number(r.sale_amount)-Number(r.commission_amount)).toFixed(2)}`:""}
                      </div>}
                    </div>
                  ) : (
                    <div style={{marginTop:6,fontSize:11,fontWeight:700,color:r.request?.status==="resolved"?"#94a3b8":"#d97706"}}>
                      {r.request?.status==="resolved"?"El cliente eligió otra oferta":"Esperando al cliente"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PERFIL DE TIENDA ── */}
        {tab==="perfil"&&(
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:16}}>Mi Tienda</div>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <label style={lbl}>Nombre de la tienda *</label>
                <input value={profile.store_name||""} onChange={e=>setProfile({...profile,store_name:e.target.value})} placeholder="Ej: Repuestos Náuticos del Oriente" style={inp}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={lbl}>Ciudad *</label>
                  <input value={profile.store_city||""} onChange={e=>setProfile({...profile,store_city:e.target.value})} placeholder="Ej: Lechería" style={inp}/>
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>Teléfono / WhatsApp</label>
                  <input value={profile.store_phone||""} onChange={e=>setProfile({...profile,store_phone:e.target.value})} placeholder="+58412..." style={inp}/>
                </div>
              </div>
              <div>
                <label style={lbl}>Dirección</label>
                <input value={profile.store_address||""} onChange={e=>setProfile({...profile,store_address:e.target.value})} placeholder="Opcional" style={inp}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" id="nationwide" checked={profile.store_ships_nationwide||false} onChange={e=>setProfile({...profile,store_ships_nationwide:e.target.checked})} style={{width:15,height:15}}/>
                <label htmlFor="nationwide" style={{fontSize:12,color:"#475569",cursor:"pointer"}}>Envío a toda Venezuela (recibir solicitudes de otras ciudades)</label>
              </div>
              <div>
                <label style={lbl}>Categorías que manejas *</label>
                <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>Solo recibirás solicitudes de estas categorías</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {STORE_CATEGORIES.map(c=>(
                    <button key={c} onClick={()=>toggleCat(c)} style={{padding:"5px 11px",border:"1.5px solid",borderRadius:16,fontSize:11,cursor:"pointer",
                      background:(profile.store_categories||[]).includes(c)?"#eff6ff":"#f8fafc",
                      borderColor:(profile.store_categories||[]).includes(c)?"#2563eb":"#e2e8f0",
                      color:(profile.store_categories||[]).includes(c)?"#2563eb":"#64748b",
                      fontWeight:(profile.store_categories||[]).includes(c)?700:400}}>{c}</button>
                  ))}
                </div>
              </div>
              <button onClick={saveProfile} style={{padding:"11px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>Guardar tienda</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal responder */}
      {respondTo&&(
        <RespondModal request={respondTo} store={profile} user={user} onClose={()=>setRespondTo(null)} onDone={()=>{ setRespondTo(null); loadRequests(); loadResponses(); setMsg("Respuesta enviada"); setTimeout(()=>setMsg(""),3000); }}/>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000}}>{msg}</div>}
    </div>
  );
}

function RespondModal({ request, store, user, onClose, onDone }) {
  const [type, setType] = useState("have");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [message, setMessage] = useState("");
  const [competitors, setCompetitors] = useState(null);
  const [tiers, setTiers] = useState(null);

  useEffect(() => {
    // Cuántas tiendas ya respondieron (a ciegas: solo el número, no sus precios)
    supabase.from("part_responses").select("id",{count:"exact",head:true})
      .eq("request_id", request.id).then(({count})=>setCompetitors(count||0));
    loadTiers().then(setTiers);
  }, []);

  const region = (request.country==="US"||request.city?.toLowerCase().includes("miami")) ? "US" : "VE";
  const est = (price && currency==="USD" && tiers) ? computeCommission(parseFloat(price)||0, tiers, region) : null;

  const submit = async () => {
    if (type==="have" && !price) return;
    const { error } = await supabase.from("part_responses").insert({
      request_id:request.id, store_id:user.id, response_type:type,
      price: type==="have"?price:null, currency, message,
    });
    if (!error) {
      const label = type==="have"?`${store.store_name||"Una tienda"} tiene el repuesto`:type==="have_questions"?`${store.store_name||"Una tienda"} respondió con preguntas`:`${store.store_name||"Una tienda"} no tiene el repuesto`;
      notify(request.owner_id, { type:"part_response", title:"Respuesta a tu solicitud", body:`${label}: ${request.item_name}`, link:"costs" });
    }
    onDone();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:400,width:"100%",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:4}}>Responder solicitud</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{request.item_name}</div>

        {/* Aviso de subasta a ciegas */}
        {competitors!==null&&competitors>0&&(
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#b45309"}}>Compites con {competitors} {competitors===1?"tienda":"tiendas"} más</div>
            <div style={{fontSize:11,color:"#92400e",marginTop:2}}>No ves sus precios. Da tu mejor precio: el dueño elige y la mejor oferta gana.</div>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          {[{k:"have",l:"Sí, tengo el repuesto"},{k:"have_questions",l:"Tengo, pero necesito más info"},{k:"decline",l:"No tengo este repuesto"}].map(o=>(
            <button key={o.k} onClick={()=>setType(o.k)} style={{padding:"10px 14px",border:"1.5px solid",borderRadius:10,cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:600,
              borderColor:type===o.k?"#2563eb":"#e2e8f0", background:type===o.k?"#eff6ff":"#fff", color:type===o.k?"#2563eb":"#475569"}}>{o.l}</button>
          ))}
        </div>

        {type==="have"&&(
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",gap:8}}>
              <select value={currency} onChange={e=>setCurrency(e.target.value)} style={{...inp,width:100,flexShrink:0}}>
                <option value="USD">$ USD</option>
                <option value="VES">Bs.</option>
              </select>
              <input type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Tu mejor precio" style={{...inp,flex:1}}/>
            </div>
            {/* Comisión estimada que verá descontada */}
            {est&&(
              <div style={{marginTop:8,fontSize:11,color:"#64748b",background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                Si ganas: comisión de plataforma {est.rate}% (${est.commission}). Recibes ${est.net}.
              </div>
            )}
          </div>
        )}

        <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} placeholder={type==="have_questions"?"¿Qué necesitas saber? Ej: ¿marca exacta? ¿año del motor?":"Mensaje al cliente (opcional)"} style={{...inp,resize:"vertical",marginBottom:14}}/>

        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={submit} disabled={type==="have"&&!price} style={{flex:2,padding:"11px",background:(type==="have"&&!price)?"#cbd5e1":"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Enviar oferta</button>
        </div>
      </div>
    </div>
  );
}

const lbl = {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5};
const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
