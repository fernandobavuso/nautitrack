import { useState, useEffect } from "react";
import CariveLogo from "./CariveLogo";
import { supabase } from "./supabase";
import { notify } from "./notifications";
import { loadTiers, computeCommission } from "./commission.jsx";
import LocationPicker from "./LocationPicker.jsx";
import { distanceKm, kmToMi } from "./geo.js";

const STORE_CATEGORIES = ["Filtros","Aceites y Lubricantes","Correas","Motores","Eléctrico","Electrónica/Navegación","Bombas","Hélices","Seguridad","Ánodos","Pinturas","Plomería","Tapicería","Ferretería marina","Otro"];

export default function StoreView({ user, onLogout }) {
  const [tab, setTab] = useState("solicitudes");
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [myResponses, setMyResponses] = useState([]);
  const [commissionTiers, setCommissionTiers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [respondTo, setRespondTo] = useState(null);

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
      .select("*, request:request_id(*)").eq("store_id", user.id).order("created_at",{ascending:false});
    setMyResponses(data||[]);
  };

  const toggleCat = (c) => setProfile(p=>({...p, store_categories: (p.store_categories||[]).includes(c) ? p.store_categories.filter(x=>x!==c) : [...(p.store_categories||[]), c]}));

  const respondedIds = myResponses.map(r=>r.request_id);
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

  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      {/* Barra superior */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <CariveLogo size={30} />
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#0f172a",fontFamily:"'Sora',system-ui,sans-serif"}}>Carive</div>
            <div style={{fontSize:10,color:"#64748b"}}>Portal de Tiendas</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:10,padding:4}}>
            {[{k:"solicitudes",l:"Solicitudes"},{k:"respuestas",l:"Mis cotizaciones"},{k:"perfil",l:"Mi tienda"}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"7px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?700:500,background:tab===t.k?"linear-gradient(120deg,#2563eb,#0ea5e9)":"transparent",color:tab===t.k?"#fff":"#64748b"}}>{t.l}</button>
            ))}
          </div>
          <button onClick={onLogout} style={{padding:"7px 12px",background:"none",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:12,color:"#94a3b8",marginLeft:4}}>Salir</button>
        </div>
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"24px 20px"}}>
        {/* Header storefront (solo con perfil completo) */}
        {profileComplete && (
          <div style={{background:"linear-gradient(120deg,#0a2540,#0f3a5f)",borderRadius:18,padding:"22px 24px",color:"#fff",marginBottom:16,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:180,height:180,background:"radial-gradient(circle,rgba(56,189,248,.22),transparent 70%)"}}/>
            <div style={{fontFamily:"'Sora',system-ui,sans-serif",fontSize:22,fontWeight:800,marginBottom:4}}>{profile.store_name}</div>
            <div style={{fontSize:13,opacity:.85}}>{profile.store_city}{profile.store_ships_nationwide?" · Envío nacional":profile.store_radius_km?` · Cobertura ${Math.round(kmToMi(profile.store_radius_km))} mi`:""}</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(56,189,248,.2)",color:"#7dd3fc",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,marginTop:10}}>✓ Tienda activa</div>
          </div>
        )}

        {/* Métricas: pulso del negocio */}
        {profileComplete && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
            {[
              {v:newRequests, l:"Pedidos nuevos", sub:"para ti", hl:true},
              {v:thisMonthWon, l:"Ventas del mes", sub:wonSales>0?`${wonSales} en total`:""},
              {v:quotesSent, l:"Cotizaciones enviadas", sub:""},
              {v:responseRate+"%", l:"Tasa de respuesta", sub:""},
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
            <div style={{fontSize:14,fontWeight:700,color:"#b45309",marginBottom:4}}>Completa tu perfil de tienda</div>
            <div style={{fontSize:12,color:"#92400e",marginBottom:10}}>Indica tu nombre, ciudad y categorías para empezar a recibir solicitudes de repuestos.</div>
            <button onClick={()=>setTab("perfil")} style={{padding:"8px 16px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Completar perfil</button>
          </div>
        )}

        {/* ── SOLICITUDES ── */}
        {tab==="solicitudes"&&(
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#0a2540",marginBottom:12,fontFamily:"'Sora',system-ui,sans-serif"}}>Solicitudes para ti{profile.store_city?` · ${profile.store_city}`:""}</div>
            {requests.length===0&&(
              <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                <div style={{fontWeight:600}}>Sin solicitudes por ahora</div>
                <div style={{fontSize:12,marginTop:4}}>Te avisaremos cuando llegue un pedido de tu categoría</div>
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
                        {r.urgent&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:20}}>URGENTE</span>}
                        {isNew&&!r.urgent&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:20}}>NUEVO</span>}
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
                      ? <div style={{fontSize:12,color:"#16a34a",fontWeight:600,textAlign:"center",background:"#f0fdf4",borderRadius:9,padding:"9px"}}>✓ Ya enviaste tu cotización</div>
                      : <button onClick={()=>setRespondTo(r)} style={{width:"100%",padding:"10px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Enviar cotización</button>
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
            {myResponses.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>Aún no has enviado ninguna cotización</div>}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {myResponses.map(r=>{
                const won = r.is_winner;
                const resolved = r.request?.status==="resolved";
                const st = won ? {bg:"#f0fdf4",c:"#16a34a",l:"✓ GANADA"} : resolved ? {bg:"#f8fafc",c:"#94a3b8",l:"No seleccionada"} : {bg:"#fffbeb",c:"#d97706",l:"⏳ PENDIENTE"};
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
                    {won&&r.sale_amount&&(
                      <div style={{marginTop:12,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#15803d"}}>
                        Venta: ${r.sale_amount}{r.commission_amount!=null?` · Comisión (${r.commission_rate}%): $${r.commission_amount} · Recibes: $${(Number(r.sale_amount)-Number(r.commission_amount)).toFixed(2)}`:""}
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
                <label style={lbl}>Nombre de la tienda *</label>
                <input value={profile.store_name||""} onChange={e=>setProfile({...profile,store_name:e.target.value})} placeholder="Ej: Repuestos Náuticos del Oriente" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Ubicación de la tienda *</label>
                <LocationPicker
                  value={profile.store_lat?{lat:profile.store_lat,lng:profile.store_lng,label:profile.store_city||"Ubicación guardada"}:null}
                  onChange={(loc)=>setProfile({...profile,store_lat:loc.lat,store_lng:loc.lng,store_city:loc.label})}
                />
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={lbl}>Teléfono / WhatsApp</label>
                  <input value={profile.store_phone||""} onChange={e=>setProfile({...profile,store_phone:e.target.value})} placeholder="+1 305..." style={inp}/>
                </div>
                <div style={{flex:1}}>
                  <label style={lbl}>Radio de cobertura</label>
                  <select value={profile.store_radius_km||50} onChange={e=>setProfile({...profile,store_radius_km:Number(e.target.value)})} style={inp}>
                    <option value={15}>Hasta ~10 millas</option>
                    <option value={30}>Hasta ~20 millas</option>
                    <option value={50}>Hasta ~30 millas</option>
                    <option value={80}>Hasta ~50 millas</option>
                    <option value={160}>Hasta ~100 millas</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Dirección (opcional)</label>
                <input value={profile.store_address||""} onChange={e=>setProfile({...profile,store_address:e.target.value})} placeholder="Calle, número..." style={inp}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" id="nationwide" checked={profile.store_ships_nationwide||false} onChange={e=>setProfile({...profile,store_ships_nationwide:e.target.checked})} style={{width:15,height:15}}/>
                <label htmlFor="nationwide" style={{fontSize:12,color:"#475569",cursor:"pointer"}}>Envío a todo el país (recibir solicitudes sin importar la distancia)</label>
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
              <button onClick={saveProfile} style={{padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>Guardar tienda</button>
            </div>

            {/* ── COMISIONES Y TRANSACCIONES ── */}
            <div style={{fontSize:16,fontWeight:800,color:"#0a2540",margin:"28px 0 12px",fontFamily:"'Sora',system-ui,sans-serif"}}>Comisiones y transacciones</div>

            {/* Resumen */}
            {(() => {
              const wins = myResponses.filter(r=>r.is_winner);
              const totalSold = wins.reduce((s,r)=>s+(Number(r.sale_amount)||0),0);
              const totalComm = wins.reduce((s,r)=>s+(Number(r.commission_amount)||0),0);
              const totalNet = totalSold - totalComm;
              return (
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
                  {[
                    {v:`$${totalSold.toFixed(0)}`, l:"Total vendido"},
                    {v:`$${totalComm.toFixed(0)}`, l:"Comisiones pagadas", c:"#dc2626"},
                    {v:`$${totalNet.toFixed(0)}`, l:"Neto recibido", c:"#16a34a"},
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
              <div style={{fontSize:13,fontWeight:700,color:"#0a2540",marginBottom:4}}>Así calculamos tu comisión</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>La comisión se descuenta solo cuando ganas una venta. A mayor monto, menor porcentaje.</div>
              {commissionTiers && (() => {
                const region = (profile.store_country==="us"||(profile.store_city||"").toLowerCase().match(/miami|lauderdale|florida|beach|gables|grove/)) ? "US" : "VE";
                const list = commissionTiers[region] || commissionTiers.VE || [];
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {list.map((t,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:"#f8fafc",borderRadius:8}}>
                        <span style={{fontSize:12,color:"#475569"}}>
                          {t.max==null ? `Ventas de $${t.min.toLocaleString()} en adelante` : `Ventas de $${t.min.toLocaleString()} a $${t.max.toLocaleString()}`}
                        </span>
                        <span style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>{t.rate}%</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{fontSize:10,color:"#94a3b8",marginTop:10}}>Ejemplo: si vendes un repuesto en $300, y tu rango es 6%, la comisión es $18 y recibes $282.</div>
            </div>

            {/* Historial de transacciones ganadas */}
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0a2540",marginBottom:12}}>Historial de ventas</div>
              {myResponses.filter(r=>r.is_winner).length===0 ? (
                <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>Aún no tienes ventas registradas.</div>
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
