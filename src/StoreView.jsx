import { useState, useEffect } from "react";
import CariveLogo from "./CariveLogo";
import { supabase } from "./supabase";
import { notify } from "./notifications";
import { loadTiers, computeCommission } from "./commission.jsx";
import LocationPicker from "./LocationPicker.jsx";
import { distanceKm, kmToMi } from "./geo.js";
import StoreOnboarding from "./StoreOnboarding.jsx";
import { useLang } from "./i18n.jsx";

const STORE_CATEGORIES = [
  "Filtros","Aceites y Lubricantes","Correas","Motores","Transmisiones",
  "Eléctrico","Baterías","Electrónica/Navegación","Bombas","Hélices",
  "Refrigeración / A/C","Plomería","Sistemas de combustible","Dirección / Timón",
  "Seguridad","Salvavidas","Ánodos","Pinturas","Fibra de vidrio",
  "Tapicería","Toldos y Lonas","Cabos y Amarres","Ferretería marina",
  "Limpieza","Buceo y Pesca","Otro",
];

// Traducción de categorías (se muestra en inglés, se guarda en español)
const CAT_EN = {
  "Filtros":"Filters","Aceites y Lubricantes":"Oils & Lubricants","Correas":"Belts",
  "Motores":"Engines","Transmisiones":"Transmissions","Eléctrico":"Electrical",
  "Baterías":"Batteries","Electrónica/Navegación":"Electronics/Navigation","Bombas":"Pumps",
  "Hélices":"Propellers","Refrigeración / A/C":"Refrigeration / A/C","Plomería":"Plumbing",
  "Sistemas de combustible":"Fuel Systems","Dirección / Timón":"Steering / Helm",
  "Seguridad":"Safety","Salvavidas":"Life Jackets","Ánodos":"Anodes","Pinturas":"Paints",
  "Fibra de vidrio":"Fiberglass","Tapicería":"Upholstery","Toldos y Lonas":"Canvas & Covers",
  "Cabos y Amarres":"Ropes & Mooring","Ferretería marina":"Marine Hardware",
  "Limpieza":"Cleaning","Buceo y Pesca":"Diving & Fishing","Otro":"Other",
};
const catL = (c, lang) => lang === "en" ? (CAT_EN[c] || c) : c;

export default function StoreView({ user, onLogout }) {
  const { t, lang, setLang } = useLang();
  const L=(es,en)=>lang==="en"?en:es;
  const [tab, setTab] = useState("solicitudes");
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [myResponses, setMyResponses] = useState([]);
  const [commissionTiers, setCommissionTiers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [respondTo, setRespondTo] = useState(null);
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem("nt_store_welcomed") !== "1");
  const [showStoreMenu, setShowStoreMenu] = useState(false);

  useEffect(() => { loadProfile(); loadTiers().then(setCommissionTiers); }, []);
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
      store_lat:profile.store_lat, store_lng:profile.store_lng, store_radius_km:profile.store_radius_km||50,
    }).eq("id", user.id);
    setMsg(error?("Error: "+error.message):"Perfil guardado");
    setTimeout(()=>setMsg(""),3000);
  };

  const loadRequests = async () => {
    // Solicitudes abiertas que calzan por categoría y por distancia (radio de cobertura)
    const { data } = await supabase.from("part_requests")
      .select("*, owner:owner_id(full_name)")
      .eq("status","open").order("created_at",{ascending:false});
    const cats = (profile.store_categories||[]).map(c=>c.toLowerCase());
    const nationwide = profile.store_ships_nationwide;
    const sLat = profile.store_lat, sLng = profile.store_lng;
    const radius = profile.store_radius_km || 50;

    const filtered = (data||[]).map(r => {
      const catMatch = cats.length===0 || cats.includes((r.category||"").toLowerCase());
      if (!catMatch) return null;

      // Distancia si ambas partes tienen coordenadas
      let dist = null;
      if (sLat!=null && sLng!=null && r.req_lat!=null && r.req_lng!=null) {
        dist = distanceKm(sLat, sLng, r.req_lat, r.req_lng);
      }

      // Reglas de match:
      // - Si envío nacional: entra todo (de su categoría)
      // - Si hay distancia calculable: entra si está dentro del radio
      // - Si no hay coordenadas (datos viejos): entra por compatibilidad, marcado sin distancia
      let matches;
      if (nationwide) matches = true;
      else if (dist!=null) matches = dist <= radius;
      else matches = true; // sin coordenadas, no filtramos por distancia

      if (!matches) return null;
      return { ...r, _distKm: dist };
    }).filter(Boolean);

    // Ordenar por cercanía (los con distancia primero, más cerca arriba)
    filtered.sort((a,b) => {
      if (a._distKm==null && b._distKm==null) return 0;
      if (a._distKm==null) return 1;
      if (b._distKm==null) return -1;
      return a._distKm - b._distKm;
    });

    setRequests(filtered);
  };

  const loadResponses = async () => {
    const { data } = await supabase.from("part_responses")
      .select("*, request:request_id(*, owner:owner_id(full_name,email), vessel:vessel_id(details))").eq("store_id", user.id).order("created_at",{ascending:false});
    setMyResponses(data||[]);
  };

  const toggleCat = (c) => setProfile(p=>({...p, store_categories: (p.store_categories||[]).includes(c) ? p.store_categories.filter(x=>x!==c) : [...(p.store_categories||[]), c]}));

  const respondedIds = myResponses.map(r=>r.request_id);
  // Iniciales de la tienda para el avatar (ej: "West Marine" -> "WM")
  const storeInitials = (profile?.store_name || user?.email || "T")
    .trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase() || "T";
  const profileComplete = profile?.store_name && profile?.store_city && (profile?.store_categories||[]).length>0;

  // Métricas del negocio
  const newRequests = requests.filter(r => !respondedIds.includes(r.id)).length;
  const wonSales = myResponses.filter(r => r.is_winner).length;
  const thisMonthWon = myResponses.filter(r => {
    if (!r.is_winner || !r.confirmed_at) return false;
    const d = new Date(r.confirmed_at); const now = new Date();
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  }).length;
  const quotesSent = myResponses.length;
  const responseRate = requests.length>0 ? Math.round((myResponses.length/(requests.length+myResponses.length))*100) : 0;

  if (loading) return <div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>Cargando...</div>;

  // Bienvenida la primera vez (tienda nueva)
  if (showWelcome && !profileComplete) return (
    <StoreOnboarding onStart={() => { localStorage.setItem("nt_store_welcomed","1"); setShowWelcome(false); setTab("perfil"); }} />
  );

  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      {/* Barra superior */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <CariveLogo size={30} />
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#0f172a",fontFamily:"'Sora',system-ui,sans-serif"}}>Carive</div>
            <div style={{fontSize:10,color:"#64748b"}}>{t("store.portal")}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:10,padding:4}}>
            {[{k:"solicitudes",l:t("store.requests")},{k:"respuestas",l:t("store.quotes")},{k:"perfil",l:t("store.myStore")}].map(tb=>(
              <button key={tb.k} onClick={()=>setTab(tb.k)} style={{padding:"7px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:tab===tb.k?700:500,background:tab===tb.k?"linear-gradient(120deg,#2563eb,#0ea5e9)":"transparent",color:tab===tb.k?"#fff":"#64748b"}}>{tb.l}</button>
            ))}
          </div>
          <div style={{position:"relative",marginLeft:6}}>
            <button onClick={(e)=>{e.stopPropagation();setShowStoreMenu(v=>!v);}} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer",padding:4}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#2563eb,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,letterSpacing:"0.02em"}}>
                {storeInitials}
              </div>
              <span style={{color:"#94a3b8",fontSize:10}}>▼</span>
            </button>
            {showStoreMenu && (
              <>
                <div style={{position:"fixed",inset:0,zIndex:200}} onClick={()=>setShowStoreMenu(false)}/>
                <div style={{position:"absolute",top:"100%",right:0,marginTop:6,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 12px 32px rgba(10,37,64,.14)",minWidth:210,padding:6,zIndex:210}}>
                  <div style={{padding:"10px 12px 8px",borderBottom:"1px solid #f1f5f9",marginBottom:4}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{profile.store_name||(lang==="es"?"Mi tienda":"My store")}</div>
                    <div style={{fontSize:11,color:"#94a3b8"}}>{profile.store_city||user?.email}</div>
                  </div>
                  <button onMouseDown={()=>{setTab("perfil");setShowStoreMenu(false);}} style={storeMenuItem}>{t("store.myStore")}</button>
                  <button onMouseDown={()=>{setTab("respuestas");setShowStoreMenu(false);}} style={storeMenuItem}>{t("store.quotes")}</button>
                  {/* Idioma */}
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderTop:"1px solid #f1f5f9",marginTop:4}}>
                    <span style={{fontSize:13,color:"#1e293b",flex:1}}>{lang==="es"?"Idioma":"Language"}</span>
                    <div style={{display:"flex",gap:3,background:"#f1f5f9",borderRadius:7,padding:2}}>
                      <button onMouseDown={(e)=>{e.preventDefault();setLang("es");}} style={{padding:"4px 10px",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:700,background:lang==="es"?"#fff":"transparent",color:lang==="es"?"#2563eb":"#64748b"}}>ES</button>
                      <button onMouseDown={(e)=>{e.preventDefault();setLang("en");}} style={{padding:"4px 10px",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:700,background:lang==="en"?"#fff":"transparent",color:lang==="en"?"#2563eb":"#64748b"}}>EN</button>
                    </div>
                  </div>
                  <button onMouseDown={onLogout} style={{...storeMenuItem,color:"#dc2626",borderTop:"1px solid #f1f5f9",marginTop:4}}>{t("store.logout")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"24px 20px"}}>
        {/* Header storefront (solo con perfil completo) */}
        {profileComplete && (
          <div style={{background:"linear-gradient(120deg,#0a2540,#0f3a5f)",borderRadius:18,padding:"22px 24px",color:"#fff",marginBottom:16,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:180,height:180,background:"radial-gradient(circle,rgba(56,189,248,.22),transparent 70%)"}}/>
            <div style={{fontFamily:"'Sora',system-ui,sans-serif",fontSize:22,fontWeight:800,marginBottom:4}}>{profile.store_name}</div>
            <div style={{fontSize:13,opacity:.85}}>{profile.store_city}{profile.store_ships_nationwide?` · ${L("Envío nacional","Nationwide shipping")}`:profile.store_radius_km?` · ${L("Cobertura","Coverage")} ${Math.round(kmToMi(profile.store_radius_km))} mi`:""}</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(56,189,248,.2)",color:"#7dd3fc",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,marginTop:10}}>✓ {t("store.active")}</div>
          </div>
        )}

        {/* Métricas: pulso del negocio */}
        {profileComplete && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
            {[
              {v:newRequests, l:t("store.newOrders"), sub:t("store.forYou"), hl:true},
              {v:thisMonthWon, l:t("store.monthSales"), sub:""},
              {v:quotesSent, l:t("store.quotesSent"), sub:""},
              {v:responseRate+"%", l:t("store.responseRate"), sub:""},
            ].map((m,i)=>(
              <div key={i} style={{background:m.hl?"linear-gradient(120deg,#eff6ff,#e0f2fe)":"#fff",border:`1px solid ${m.hl?"#bae6fd":"#e2e8f0"}`,borderRadius:14,padding:16}}>
                <div style={{fontFamily:"'Sora',system-ui,sans-serif",fontSize:26,fontWeight:800,color:m.hl?"#2563eb":"#0a2540"}}>{m.v}</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:2,fontWeight:500}}>{m.l}</div>
                {m.sub&&<div style={{fontSize:11,color:"#16a34a",fontWeight:700,marginTop:6}}>{m.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Aviso de perfil incompleto */}
        {!profileComplete && tab!=="perfil" && (
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#b45309",marginBottom:4}}>{t("store.completeProfile")}</div>
            <div style={{fontSize:12,color:"#92400e",marginBottom:10}}>{t("store.completeProfileSub")}</div>
            <button onClick={()=>setTab("perfil")} style={{padding:"8px 16px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t("store.completeBtn")}</button>
          </div>
        )}

        {/* ── SOLICITUDES ── */}
        {tab==="solicitudes"&&(
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#0a2540",marginBottom:12,fontFamily:"'Sora',system-ui,sans-serif"}}>{t("store.requestsForYou")}{profile.store_city?` · ${profile.store_city}`:""}</div>
            {requests.length===0&&(
              <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                <div style={{fontWeight:600}}>{t("store.noRequests")}</div>
                <div style={{fontSize:12,marginTop:4}}>{t("store.noRequestsSub")}</div>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {requests.map(r=>{
                const responded = respondedIds.includes(r.id);
                const ageHours = r.created_at ? Math.round((Date.now()-new Date(r.created_at))/3600000) : null;
                const ageLabel = ageHours==null?"":ageHours<1?"hace minutos":ageHours<24?`hace ${ageHours}h`:`hace ${Math.round(ageHours/24)}d`;
                const isNew = ageHours!=null && ageHours < 6;
                return (
                  <div key={r.id} style={{background:"#fff",border:`1px solid ${r.urgent?"#fecaca":"#e2e8f0"}`,borderRadius:16,padding:18,transition:".2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 24px rgba(10,37,64,.08)";e.currentTarget.style.borderColor="#bae6fd";}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=r.urgent?"#fecaca":"#e2e8f0";}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,gap:10}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#eff6ff",color:"#2563eb",fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20}}>{r.category||"Repuesto"}</span>
                      <div style={{display:"flex",gap:6}}>
                        {r.urgent&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:20}}>{t("store.urgent")}</span>}
                        {isNew&&!r.urgent&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:20}}>{t("store.new")}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:14,marginBottom:14}}>
                      {r.photo_url&&<img src={r.photo_url} style={{width:56,height:56,borderRadius:10,objectFit:"cover",flexShrink:0}} alt=""/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:700,color:"#0a2540",marginBottom:6}}>{r.item_name}</div>
                        <div style={{display:"flex",gap:14,fontSize:12,color:"#94a3b8",flexWrap:"wrap"}}>
                          {r.city&&<span>{r.city}</span>}
                          {r._distKm!=null&&<span style={{color:"#2563eb",fontWeight:600}}>a {Math.round(kmToMi(r._distKm))} mi</span>}
                          {ageLabel&&<span>{ageLabel}</span>}
                          {r.part_num&&<span>Ref: {r.part_num}</span>}
                        </div>
                        {r.description&&<div style={{fontSize:12,color:"#475569",marginTop:8}}>{r.description}</div>}
                      </div>
                    </div>
                    {responded
                      ? <div style={{fontSize:12,color:"#16a34a",fontWeight:600,textAlign:"center",background:"#f0fdf4",borderRadius:9,padding:"9px"}}>✓ {t("store.alreadyQuoted")}</div>
                      : <button onClick={()=>setRespondTo(r)} style={{width:"100%",padding:"10px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t("store.sendQuote")}</button>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MIS COTIZACIONES ── */}
        {tab==="respuestas"&&(
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#0a2540",marginBottom:12,fontFamily:"'Sora',system-ui,sans-serif"}}>Mis cotizaciones</div>
            {myResponses.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>{t("store.noQuotes")}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {myResponses.map(r=>{
                const won = r.is_winner;
                const resolved = r.request?.status==="resolved";
                const st = won ? {bg:"#f0fdf4",c:"#16a34a",l:`✓ ${t("store.won")}`} : resolved ? {bg:"#f8fafc",c:"#94a3b8",l:t("store.notChosen")} : {bg:"#fffbeb",c:"#d97706",l:`⏳ ${t("store.pending")}`};
                return (
                  <div key={r.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:18}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:700,color:"#0a2540",marginBottom:6}}>{r.request?.item_name||"Repuesto"}</div>
                        <div style={{display:"flex",gap:14,fontSize:12,color:"#94a3b8",flexWrap:"wrap"}}>
                          <span>{r.request?.category}</span>
                          {r.response_type==="have"&&<span style={{color:"#475569",fontWeight:600}}>Cotizaste ${r.price}</span>}
                          {r.response_type==="have_questions"&&<span>Disponible, con preguntas</span>}
                          {r.response_type==="dont_have"&&<span>No disponible</span>}
                        </div>
                        {r.message&&<div style={{fontSize:12,color:"#94a3b8",marginTop:8,fontStyle:"italic"}}>"{r.message}"</div>}
                      </div>
                      <span style={{fontSize:11,fontWeight:800,padding:"4px 11px",borderRadius:20,background:st.bg,color:st.c,whiteSpace:"nowrap"}}>{st.l}</span>
                    </div>
                    {won&&(
                      <div style={{marginTop:12,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 14px"}}>
                        {r.sale_amount&&(
                          <div style={{fontSize:11,color:"#15803d",marginBottom:10}}>
                            {L("Venta","Sale")}: ${r.sale_amount}{r.commission_amount!=null?` · ${L("Comisión","Commission")} (${r.commission_rate}%): $${r.commission_amount} · ${L("Recibes","You receive")}: $${(Number(r.sale_amount)-Number(r.commission_amount)).toFixed(2)}`:""}
                          </div>
                        )}
                        {/* Contacto del dueño — se revela solo al ganar */}
                        <div style={{borderTop:"1px solid #bbf7d0",paddingTop:10}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#15803d",marginBottom:6}}>{L("Coordina la entrega con el cliente","Coordinate delivery with the customer")}</div>
                          <div style={{fontSize:12,color:"#0f172a",fontWeight:600,marginBottom:8}}>
                            {r.request?.owner?.full_name||L("Cliente","Customer")}
                            {r.request?.city?` · ${r.request.city}`:""}
                          </div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {(r.request?.vessel?.details?._profile?.phone) ? (
                              <a href={`https://wa.me/${String(r.request.vessel.details._profile.phone).replace(/[^0-9]/g,"")}?text=${encodeURIComponent(L(`Hola ${r.request.owner.full_name||""}, soy de ${profile.store_name||"la tienda"} en Carive. Te escribo por tu pedido: ${r.request?.item_name}. ¿Coordinamos la entrega?`,`Hi ${r.request.owner.full_name||""}, I'm from ${profile.store_name||"the store"} on Carive. I'm reaching out about your order: ${r.request?.item_name}. Shall we coordinate delivery?`))}`}
                                 target="_blank" rel="noreferrer"
                                 style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#16a34a,#22c55e)",borderRadius:8,padding:"8px 14px",fontSize:12,color:"#fff",fontWeight:700,textDecoration:"none"}}>
                                WhatsApp
                              </a>
                            ) : (
                              <span style={{fontSize:11,color:"#94a3b8"}}>{L("El cliente no registró teléfono","The customer has no phone on file")}</span>
                            )}
                            {r.request?.owner?.email && (
                              <a href={`mailto:${r.request.owner.email}?subject=${encodeURIComponent(L("Tu pedido en Carive","Your Carive order")+": "+(r.request?.item_name||""))}`}
                                 style={{display:"inline-flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 14px",fontSize:12,color:"#475569",fontWeight:700,textDecoration:"none"}}>
                                Email
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PERFIL DE TIENDA ── */}
        {tab==="perfil"&&(
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:16}}>Mi Tienda</div>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <label style={lbl}>{L("Nombre de la tienda","Store name")} *</label>
                <input value={profile.store_name||""} onChange={e=>setProfile({...profile,store_name:e.target.value})} placeholder="Ej: Repuestos Náuticos del Oriente" style={inp}/>
              </div>
              <div>
                <label style={lbl}>{L("Ubicación de la tienda","Store location")} *</label>
                <LocationPicker
                  value={profile.store_lat?{lat:profile.store_lat,lng:profile.store_lng,label:profile.store_city||"Ubicación guardada"}:null}
                  onChange={(loc)=>setProfile({...profile,store_lat:loc.lat,store_lng:loc.lng,store_city:loc.label})}
                />
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Teléfono / WhatsApp","Phone / WhatsApp")}</label>
                  <input value={profile.store_phone||""} onChange={e=>setProfile({...profile,store_phone:e.target.value})} placeholder="+1 305..." style={inp}/>
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>{L("Radio de cobertura","Coverage radius")}</label>
                  <select value={profile.store_radius_km||50} onChange={e=>setProfile({...profile,store_radius_km:Number(e.target.value)})} style={inp}>
                    <option value={15}>{L("Hasta ~10 millas","Up to ~10 miles")}</option>
                    <option value={30}>{L("Hasta ~20 millas","Up to ~20 miles")}</option>
                    <option value={50}>{L("Hasta ~30 millas","Up to ~30 miles")}</option>
                    <option value={80}>{L("Hasta ~50 millas","Up to ~50 miles")}</option>
                    <option value={160}>{L("Hasta ~100 millas","Up to ~100 miles")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>{L("Dirección (opcional)","Address (optional)")}</label>
                <input value={profile.store_address||""} onChange={e=>setProfile({...profile,store_address:e.target.value})} placeholder="Calle, número..." style={inp}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" id="nationwide" checked={profile.store_ships_nationwide||false} onChange={e=>setProfile({...profile,store_ships_nationwide:e.target.checked})} style={{width:15,height:15}}/>
                <label htmlFor="nationwide" style={{fontSize:12,color:"#475569",cursor:"pointer"}}>{L("Envío a todo el país (recibir solicitudes sin importar la distancia)","Nationwide shipping (receive requests regardless of distance)")}</label>
              </div>
              <div>
                <label style={lbl}>{L("Categorías que manejas","Categories you carry")} *</label>
                <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>{L("Solo recibirás solicitudes de estas categorías","You will only receive requests in these categories")}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {STORE_CATEGORIES.map(c=>(
                    <button key={c} onClick={()=>toggleCat(c)} style={{padding:"5px 11px",border:"1.5px solid",borderRadius:16,fontSize:11,cursor:"pointer",
                      background:(profile.store_categories||[]).includes(c)?"#eff6ff":"#f8fafc",
                      borderColor:(profile.store_categories||[]).includes(c)?"#2563eb":"#e2e8f0",
                      color:(profile.store_categories||[]).includes(c)?"#2563eb":"#64748b",
                      fontWeight:(profile.store_categories||[]).includes(c)?700:400}}>{catL(c, lang)}</button>
                  ))}
                </div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:10,lineHeight:1.5}}>
                  {L("¿No ves tu categoría? Marca ","Don't see your category? Select ")}
                  <strong>{L("Otro","Other")}</strong>
                  {L(" y escríbenos a info@carive.co para agregarla."," and email us at info@carive.co to add it.")}
                </div>
              </div>
              <button onClick={saveProfile} style={{padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>{t("store.saveStore")}</button>
            </div>

            {/* ── COMISIONES Y TRANSACCIONES ── */}
            <div style={{fontSize:16,fontWeight:800,color:"#0a2540",margin:"28px 0 12px",fontFamily:"'Sora',system-ui,sans-serif"}}>{t("store.commissions")}</div>

            {/* Resumen */}
            {(() => {
              const wins = myResponses.filter(r=>r.is_winner);
              const totalSold = wins.reduce((s,r)=>s+(Number(r.sale_amount)||0),0);
              const totalComm = wins.reduce((s,r)=>s+(Number(r.commission_amount)||0),0);
              const totalNet = totalSold - totalComm;
              return (
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
                  {[
                    {v:`$${totalSold.toFixed(0)}`, l:t("store.totalSold")},
                    {v:`$${totalComm.toFixed(0)}`, l:t("store.commPaid"), c:"#dc2626"},
                    {v:`$${totalNet.toFixed(0)}`, l:t("store.netReceived"), c:"#16a34a"},
                  ].map((m,i)=>(
                    <div key={i} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}>
                      <div style={{fontFamily:"'Sora',system-ui,sans-serif",fontSize:22,fontWeight:800,color:m.c||"#0a2540"}}>{m.v}</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{m.l}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tabla de rangos de comisión (transparencia total) */}
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0a2540",marginBottom:4}}>{t("store.howComm")}</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{L("La comisión se descuenta solo cuando ganas una venta. A mayor monto, menor porcentaje.","The commission is only deducted when you win a sale. The higher the amount, the lower the percentage.")}</div>
              {commissionTiers && (() => {
                const region = (profile.store_country==="us"||(profile.store_city||"").toLowerCase().match(/miami|lauderdale|florida|beach|gables|grove/)) ? "US" : "VE";
                const list = commissionTiers[region] || commissionTiers.VE || [];
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {list.map((t,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:"#f8fafc",borderRadius:8}}>
                        <span style={{fontSize:12,color:"#475569"}}>
                          {t.max==null ? `${L("Ventas de","Sales from")} $${t.min.toLocaleString()} ${L("en adelante","and up")}` : `${L("Ventas de","Sales from")} $${t.min.toLocaleString()} ${L("a","to")} $${t.max.toLocaleString()}`}
                        </span>
                        <span style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>{t.rate}%</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{fontSize:10,color:"#94a3b8",marginTop:10}}>{L("Ejemplo: si vendes un repuesto en $300, y tu rango es 6%, la comisión es $18 y recibes $282.","Example: if you sell a part for $300 and your tier is 6%, the commission is $18 and you receive $282.")}</div>
            </div>

            {/* Historial de transacciones ganadas */}
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0a2540",marginBottom:12}}>{t("store.salesHistory")}</div>
              {myResponses.filter(r=>r.is_winner).length===0 ? (
                <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>{t("store.noSales")}</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {myResponses.filter(r=>r.is_winner).map(r=>(
                    <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",background:"#f8fafc",borderRadius:9}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{r.request?.item_name||"Repuesto"}</div>
                        <div style={{fontSize:11,color:"#94a3b8"}}>{r.confirmed_at?new Date(r.confirmed_at).toLocaleDateString("es"):""}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#16a34a"}}>${r.sale_amount||"—"}</div>
                        {r.commission_amount!=null&&<div style={{fontSize:10,color:"#94a3b8"}}>comisión {r.commission_rate}% · recibes ${(Number(r.sale_amount)-Number(r.commission_amount)).toFixed(0)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          <button onClick={submit} disabled={type==="have"&&!price} style={{flex:2,padding:"11px",background:(type==="have"&&!price)?"#cbd5e1":"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Enviar oferta</button>
        </div>
      </div>
    </div>
  );
}

const lbl = {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5};
const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};

const storeMenuItem = {display:"block",width:"100%",textAlign:"left",padding:"9px 12px",border:"none",borderRadius:7,cursor:"pointer",background:"transparent",fontSize:13,color:"#1e293b",fontWeight:500};
