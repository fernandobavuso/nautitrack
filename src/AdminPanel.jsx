import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { activateSubscription } from "./subscriptions.jsx";
import { notify } from "./notifications.js";
import { distanceKm, kmToMi } from "./geo.js";

// Panel de administrador (solo visible para los correos en ADMIN_EMAILS)
// Tablero de ingresos: comisiones por venta + activación de planes

export const ADMIN_EMAILS = [
  "fernandobavuso@gmail.com",  // TODO Fernando: ajusta/añade tus correos de admin
];

export function isAdmin(user) {
  return user?.email && ADMIN_EMAILS.map(e=>e.toLowerCase()).includes(user.email.toLowerCase());
}

export default function AdminPanel({ user, onClose }) {
  const [tab, setTab] = useState("pedidos");
  const [sales, setSales] = useState([]);
  const [stores, setStores] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [pending, setPending] = useState([]);
  const [openRequests, setOpenRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    // Ventas ganadas (con comisión) = subasta cerrada
    const { data: won } = await supabase.from("part_responses")
      .select("*, store:store_id(store_name,store_city), request:request_id(item_name,city)")
      .eq("is_winner", true).order("confirmed_at",{ascending:false});
    setSales(won||[]);
    // Tiendas
    const { data: st } = await supabase.from("profiles").select("*").eq("role","store");
    setStores(st||[]);
    // Embarcaciones (para activar planes)
    const { data: vs } = await supabase.from("vessels").select("id,name,details,owner_id");
    setVessels(vs||[]);
    // Pagos pendientes de verificar
    const { data: pr } = await supabase.from("payment_requests")
      .select("*, owner:owner_id(full_name,email), vessel:vessel_id(name,details,owner_id)")
      .eq("status","pending").order("created_at",{ascending:false});
    setPending(pr||[]);
    // Pedidos de repuestos abiertos (para notificar a tiendas)
    const { data: reqs } = await supabase.from("part_requests")
      .select("*, owner:owner_id(full_name)")
      .eq("status","open").order("created_at",{ascending:false});
    setOpenRequests(reqs||[]);
    setLoading(false);
  };

  // Tiendas que califican para un pedido (por categoría y distancia/nacional)
  const matchingStores = (req) => {
    return stores.filter(st => {
      const cats = (st.store_categories||[]).map(c=>c.toLowerCase());
      const catMatch = cats.length===0 || cats.includes((req.category||"").toLowerCase());
      if (!catMatch) return false;
      if (st.store_ships_nationwide) return true;
      if (st.store_lat!=null && req.req_lat!=null) {
        const d = distanceKm(st.store_lat, st.store_lng, req.req_lat, req.req_lng);
        return d!=null && d <= (st.store_radius_km||50);
      }
      return true; // sin coordenadas, no filtramos
    });
  };

  // Generar link de WhatsApp para notificar a una tienda de un pedido
  const waLink = (store, req) => {
    const phone = (store.store_phone||"").replace(/[^0-9]/g,"");
    const msg = `Hola ${store.store_name}, tienes un nuevo pedido en Carive:\n\n📦 ${req.item_name}\n📍 ${req.city||"—"}\n${req.category?`Categoría: ${req.category}\n`:""}${req.part_num?`Ref: ${req.part_num}\n`:""}\nEntra a la app para cotizar: ${window.location.origin}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  // Ver el comprobante (link temporal firmado, bucket privado)
  const viewProof = async (path) => {
    if (!path) return;
    const { data } = await supabase.storage.from("comprobantes").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  // Aprobar un pago: activa el plan + marca la solicitud como aprobada
  const approvePayment = async (req) => {
    if (!req.vessel) { setMsg("No se encontró la embarcación"); return; }
    if (!confirm(`¿Aprobar el pago de ${req.owner?.email||"este cliente"} y activar el plan ${req.plan}?`)) return;
    const vesselObj = { id: req.vessel_id, owner_id: req.vessel.owner_id || req.owner_id, details: req.vessel.details || {} };
    await activateSubscription(vesselObj, req.plan, req.billing_period, { method: req.method, amount: req.amount, currency: req.currency, reference: req.reference });
    await supabase.from("payment_requests").update({ status:"approved", reviewed_at:new Date().toISOString(), reviewed_by:user.id }).eq("id", req.id);
    // notificar al cliente
    try { notify(req.owner_id, { type:"plan_activated", title:"¡Tu plan está activo!", body:`Confirmamos tu pago. El plan ${req.plan} ya está activo en ${req.vessel?.name||"tu barco"}.`, link:"" }); } catch(e){}
    setMsg(`Plan ${req.plan} activado para ${req.owner?.email||"cliente"}`);
    setTimeout(()=>setMsg(""),3000);
    loadAll();
  };

  const rejectPayment = async (req) => {
    if (!confirm("¿Rechazar este reporte de pago? El cliente no recibirá el plan.")) return;
    await supabase.from("payment_requests").update({ status:"rejected", reviewed_at:new Date().toISOString(), reviewed_by:user.id }).eq("id", req.id);
    try { notify(req.owner_id, { type:"plan_rejected", title:"Problema con tu pago", body:`No pudimos verificar tu pago del plan ${req.plan}. Contáctanos por WhatsApp para resolverlo.`, link:"" }); } catch(e){}
    setMsg("Pago rechazado");
    setTimeout(()=>setMsg(""),3000);
    loadAll();
  };

  // Activar plan a una embarcación (con periodo y vencimiento)
  const setPlan = async (vessel, plan, period="monthly") => {
    await activateSubscription(vessel, plan, period, { method:"manual" });
    setMsg(plan==="free" ? `${vessel.name}: plan cancelado` : `${vessel.name}: ${plan} activado (${period==="yearly"?"1 año":"1 mes"})`);
    setTimeout(()=>setMsg(""),3000);
    loadAll();
  };

  if (loading) return <Overlay onClose={onClose}><div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>Cargando...</div></Overlay>;

  // Totales de comisión (solo USD para el tablero)
  const totalCommission = sales.filter(s=>s.commission_amount).reduce((a,s)=>a+Number(s.commission_amount),0);
  const totalSales = sales.filter(s=>s.sale_amount&&s.currency==="USD").reduce((a,s)=>a+Number(s.sale_amount),0);

  // Comisión acumulada por tienda
  const byStore = {};
  sales.forEach(s => {
    if (!s.commission_amount) return;
    const id = s.store_id;
    if (!byStore[id]) byStore[id] = { name:s.store?.store_name||"Tienda", city:s.store?.store_city||"", total:0, count:0 };
    byStore[id].total += Number(s.commission_amount);
    byStore[id].count++;
  });
  const storeComm = Object.values(byStore).sort((a,b)=>b.total-a.total);

  return (
    <Overlay onClose={onClose}>
      <div style={{padding:"18px 22px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:17,fontWeight:800,color:"#0f172a"}}>Panel de Administrador</div>
          <div style={{fontSize:12,color:"#64748b"}}>Ingresos, comisiones y planes</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
      </div>

      <div style={{display:"flex",gap:6,padding:"12px 22px 0",borderBottom:"1px solid #e2e8f0"}}>
        {[{k:"pedidos",l:"Pedidos → Tiendas"},{k:"pendientes",l:"Pagos pendientes"},{k:"ingresos",l:"Ingresos"},{k:"tiendas",l:"Comisiones por tienda"},{k:"planes",l:"Planes"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 14px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?700:500,color:tab===t.k?"#2563eb":"#64748b",borderBottom:tab===t.k?"2px solid #2563eb":"2px solid transparent",marginBottom:-1}}>{t.l}</button>
        ))}
      </div>

      <div style={{padding:22,overflowY:"auto"}}>
        {/* INGRESOS */}
        {tab==="pedidos"&&(
          <div>
            <div style={{background:"#eff6ff",border:"1px solid #bae6fd",borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:12,color:"#0369a1",lineHeight:1.5}}>
              Cuando un dueño publica un pedido, notifica por WhatsApp a las tiendas que califican (por categoría y cercanía). Un clic abre el WhatsApp con el mensaje listo.
            </div>
            {openRequests.length===0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:"#94a3b8"}}>
                <div style={{fontWeight:600}}>No hay pedidos abiertos</div>
                <div style={{fontSize:12,marginTop:4}}>Cuando un dueño pida un repuesto, aparecerá aquí para notificar a las tiendas.</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {openRequests.map(req=>{
                  const matches = matchingStores(req);
                  return (
                    <div key={req.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:12}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:700,color:"#0a2540"}}>{req.item_name}</div>
                          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>
                            {req.category} · {req.city||"sin ubicación"} · pedido por {req.owner?.full_name||"—"}
                            {req.urgent&&<span style={{marginLeft:6,background:"#fef2f2",color:"#dc2626",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20}}>URGENTE</span>}
                          </div>
                        </div>
                        <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(req.created_at).toLocaleDateString("es")}</div>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8}}>{matches.length} tienda{matches.length!==1?"s":""} calific{matches.length!==1?"an":"a"}</div>
                      {matches.length===0 ? (
                        <div style={{fontSize:12,color:"#94a3b8",fontStyle:"italic"}}>Ninguna tienda registrada califica para este pedido (por categoría o distancia).</div>
                      ) : (
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {matches.map(st=>{
                            const dist = (st.store_lat!=null&&req.req_lat!=null)?distanceKm(st.store_lat,st.store_lng,req.req_lat,req.req_lng):null;
                            const hasPhone = (st.store_phone||"").replace(/[^0-9]/g,"").length>=7;
                            return (
                              <div key={st.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",background:"#f8fafc",borderRadius:9}}>
                                <div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{st.store_name||"Tienda"}</div>
                                  <div style={{fontSize:11,color:"#94a3b8"}}>
                                    {st.store_city||"—"}
                                    {dist!=null&&` · a ${Math.round(kmToMi(dist))} mi`}
                                    {st.store_ships_nationwide&&" · envío nacional"}
                                    {!hasPhone&&" · ⚠ sin WhatsApp"}
                                  </div>
                                </div>
                                {hasPhone ? (
                                  <a href={waLink(st,req)} target="_blank" rel="noreferrer" style={{padding:"7px 14px",background:"linear-gradient(135deg,#16a34a,#22c55e)",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap"}}>Notificar por WhatsApp</a>
                                ) : (
                                  <span style={{fontSize:11,color:"#94a3b8"}}>Sin número</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab==="pendientes"&&(
          <div>
            {pending.length===0 ? (
              <div style={{textAlign:"center",padding:"40px 20px",color:"#94a3b8"}}>
                <div style={{fontWeight:600}}>No hay pagos pendientes de verificar</div>
                <div style={{fontSize:12,marginTop:4}}>Cuando un cliente reporte un pago, aparecerá aquí para que lo apruebes.</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {pending.map(req=>(
                  <div key={req.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#0a2540"}}>Plan {req.plan} · {req.billing_period==="yearly"?"Anual":"Mensual"}</div>
                        <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{req.owner?.full_name||req.owner?.email||"Cliente"} · Barco: {req.vessel?.name||"—"}</div>
                        <div style={{fontSize:12,color:"#475569",marginTop:6}}>
                          <strong>${req.amount} {req.currency}</strong> · vía {req.method}
                          {req.reference?<span> · Ref: {req.reference}</span>:""}
                        </div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Reportado el {new Date(req.created_at).toLocaleString("es-VE")}</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"stretch"}}>
                        {req.proof_url && <button onClick={()=>viewProof(req.proof_url)} style={{padding:"7px 14px",border:"1.5px solid #2563eb",background:"#fff",color:"#2563eb",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>Ver comprobante</button>}
                        <button onClick={()=>approvePayment(req)} style={{padding:"7px 14px",border:"none",background:"linear-gradient(120deg,#16a34a,#22c55e)",color:"#fff",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>Aprobar y activar</button>
                        <button onClick={()=>rejectPayment(req)} style={{padding:"7px 14px",border:"1px solid #fecaca",background:"#fff",color:"#dc2626",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Rechazar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==="ingresos"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
              <Stat label="COMISIONES GANADAS (USD)" value={`$ ${totalCommission.toLocaleString("es-VE",{maximumFractionDigits:2})}`} accent="#16a34a"/>
              <Stat label="VOLUMEN DE VENTAS (USD)" value={`$ ${totalSales.toLocaleString("es-VE",{maximumFractionDigits:0})}`}/>
              <Stat label="VENTAS CERRADAS" value={sales.length}/>
            </div>

            <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Ventas recientes</div>
            {sales.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>Aún no hay ventas cerradas</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sales.map(s=>(
                <div key={s.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{s.request?.item_name||"Repuesto"}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{s.store?.store_name||"Tienda"}{s.confirmed_at?` · ${new Date(s.confirmed_at).toLocaleDateString("es-VE")}`:""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#16a34a"}}>+${s.commission_amount||0}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>venta ${s.sale_amount||0} · {s.commission_rate||0}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMISIONES POR TIENDA */}
        {tab==="tiendas"&&(
          <div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Comisiones acumuladas que cada tienda te debe. Cóbralas junto con su suscripción mensual.</div>
            {storeComm.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>Sin comisiones aún</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {storeComm.map((st,i)=>(
                <div key={i} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{st.name}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{st.city}{st.city?" · ":""}{st.count} venta{st.count!==1?"s":""}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:"#16a34a"}}>$ {st.total.toLocaleString("es-VE",{maximumFractionDigits:2})}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PLANES */}
        {tab==="planes"&&(
          <div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Activa o cambia el plan de cada embarcación cuando un cliente te pague.</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {vessels.map(v=>{
                const sub = v.details?._subscription || {};
                const plan = sub.plan || "free";
                const exp = sub.expires_at ? new Date(sub.expires_at) : null;
                const expired = exp && exp.getTime() < Date.now();
                const effectivePlan = expired ? "free" : plan;
                return (
                  <div key={v.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{v.name}</div>
                      <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:effectivePlan==="free"?"#f1f5f9":"#dcfce7",color:effectivePlan==="free"?"#64748b":"#16a34a"}}>{effectivePlan==="free"?"Gratis":effectivePlan==="pro"?"Pro":"Flota"}</span>
                    </div>
                    {exp&&plan!=="free"&&(
                      <div style={{fontSize:11,color:expired?"#dc2626":"#64748b",marginBottom:10}}>
                        {expired?`Venció el ${exp.toLocaleDateString("es-VE")}`:`Vence el ${exp.toLocaleDateString("es-VE")}`}
                      </div>
                    )}
                    <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:6}}>ACTIVAR / RENOVAR</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                      <button onClick={()=>setPlan(v,"pro","monthly")} style={planBtn}>Pro · 1 mes</button>
                      <button onClick={()=>setPlan(v,"pro","yearly")} style={planBtn}>Pro · 1 año</button>
                      <button onClick={()=>setPlan(v,"fleet","monthly")} style={planBtn}>Flota · 1 mes</button>
                      <button onClick={()=>setPlan(v,"fleet","yearly")} style={planBtn}>Flota · 1 año</button>
                    </div>
                    <button onClick={()=>setPlan(v,"free")} style={{width:"100%",padding:"6px",borderRadius:7,border:"1px solid #fecaca",background:"#fff",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer"}}>Cancelar a Gratis</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:4000}}>{msg}</div>}
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2600,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:680,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16}}>
      <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:accent||"#0f172a"}}>{value}</div>
    </div>
  );
}

const planBtn = { padding:"7px", borderRadius:7, border:"1px solid #e2e8f0", background:"#fff", color:"#2563eb", fontSize:11, fontWeight:700, cursor:"pointer" };
