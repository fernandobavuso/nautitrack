import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { hasFeature, PremiumLock } from "./plans.jsx";
import { findCityCoords, distanceKm } from "./geo.js";
import { useLang } from "./i18n.jsx";
import { notify } from "./notifications";
import { loadTiers, computeCommission } from "./commission.jsx";

const CATEGORIES = ["Filtros","Aceites y Lubricantes","Correas","Eléctrico","Seguridad","Limpieza","Ánodos","Impulsores","Otro"];
const UNITS = ["unidad","litros","galones","metros","kit"];
const LOCATIONS = ["A bordo","Dock box","Storage","Maletero / pañol","Casa","Otro"];

export default function InventoryPage({ vessel, user, setShowProfile, role="owner", captainLimit }) {
  const { t, lang } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // item en edición o "new"
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all"); // all / low / requests
  const [collapsedCats, setCollapsedCats] = useState({}); // categorías plegadas
  const [requesting, setRequesting] = useState(null); // item para pedir o "new"
  const [myRequests, setMyRequests] = useState([]);
  const [commTiers, setCommTiers] = useState(null);

  useEffect(() => { loadTiers().then(setCommTiers); }, []);
  const blank = { name:"", category:"Filtros", brand:"", part_num:"", quantity:"", min_quantity:"", unit:"unidad", location_type:"A bordo", location:"", bought_at:"", notes:"" };
  const [form, setForm] = useState(blank);

  const allowed = hasFeature(vessel, "inventory");

  useEffect(() => { if (allowed) { loadItems(); loadRequests(); } }, []);

  const loadItems = async () => {
    const { data } = await supabase.from("inventory")
      .select("*").eq("vessel_id", vessel.id).order("name");
    setItems(data||[]);
    setLoading(false);
  };

  const loadRequests = async () => {
    const { data } = await supabase.from("part_requests")
      .select("*, responses:part_responses(*, store:store_id(store_name,store_phone,store_city))")
      .eq("owner_id", user.id).order("created_at",{ascending:false});
    setMyRequests(data||[]);
  };

  const closeRequest = async (id) => {
    await supabase.from("part_requests").update({ status:"resolved" }).eq("id", id);
    loadRequests();
  };
  const reopenRequest = async (id) => {
    await supabase.from("part_requests").update({ status:"open" }).eq("id", id);
    loadRequests();
  };

  // Elegir tienda ganadora de la subasta → registra venta + comisión
  const chooseWinner = async (request, response) => {
    const amount = parseFloat(response.price) || 0;
    const region = (request.city||"").toLowerCase().includes("miami") ? "US" : "VE";
    const { rate, commission } = computeCommission(amount, commTiers, region);
    // Marcar la respuesta ganadora con la venta y comisión
    await supabase.from("part_responses").update({
      is_winner:true, sale_status:"selected", sale_amount:amount,
      commission_amount: response.currency==="USD"?commission:null,
      commission_rate: rate, confirmed_at:new Date().toISOString(),
    }).eq("id", response.id);
    // Cerrar la solicitud con su ganador
    await supabase.from("part_requests").update({ status:"resolved", winner_response_id:response.id }).eq("id", request.id);
    // Notificar a la tienda ganadora
    notify(response.store_id, { type:"auction_won", title:"¡Ganaste la venta!", body:`El cliente te eligió para: ${request.item_name}. Coordina la entrega.`, link:"respuestas" });
    loadRequests();
  };

  // Aprobar una solicitud del capitán que superó el tope → se publica a tiendas
  const approveRequest = async (r) => {
    await supabase.from("part_requests").update({ status:"open", approval_status:"approved", needs_approval:false }).eq("id", r.id);
    // Publicar a tiendas que calzan
    const city = r.city||"";
    const { data: stores } = await supabase.from("profiles").select("id,store_categories,store_city,store_ships_nationwide").eq("role","store");
    const cityL = city.toLowerCase();
    (stores||[]).forEach(st => {
      const cats = (st.store_categories||[]).map(c=>c.toLowerCase());
      const catMatch = cats.includes((r.category||"").toLowerCase());
      const stCity = (st.store_city||"").toLowerCase();
      const cityMatch = st.store_ships_nationwide || !stCity || !cityL || stCity.includes(cityL) || cityL.includes(stCity);
      if (catMatch && cityMatch) notify(st.id, { type:"part_request", title:"Nueva solicitud de repuesto", body:`${r.item_name} (${r.category})${city?` en ${city}`:""}`, link:"solicitudes" });
    });
    if (r.requested_by) notify(r.requested_by, { type:"parts_approved", title:"Repuesto aprobado", body:`El dueño aprobó tu solicitud: ${r.item_name}`, link:"inventory" });
    loadRequests();
  };
  const rejectRequest = async (r) => {
    await supabase.from("part_requests").update({ status:"cancelled", approval_status:"rejected" }).eq("id", r.id);
    if (r.requested_by) notify(r.requested_by, { type:"parts_rejected", title:"Repuesto no aprobado", body:`El dueño no aprobó: ${r.item_name}`, link:"inventory" });
    loadRequests();
  };

  const openNew = () => { setForm(blank); setEditing("new"); };
  const openEdit = (it) => {
    setForm({ name:it.name||"", category:it.category||"Filtros", brand:it.brand||"", part_num:it.part_num||"", quantity:it.quantity??"", min_quantity:it.min_quantity??"", unit:it.unit||"unidad", location_type:it.location_type||"A bordo", location:it.location||"", bought_at:it.bought_at||"", notes:it.notes||"" });
    setEditing(it.id);
  };

  const save = async () => {
    if (!form.name.trim()) { setMsg("Indica el nombre del repuesto"); setTimeout(()=>setMsg(""),3000); return; }
    const payload = {
      vessel_id:vessel.id, owner_id:user.id,
      name:form.name.trim(), category:form.category, brand:form.brand, part_num:form.part_num,
      quantity:parseFloat(form.quantity)||0, min_quantity:parseFloat(form.min_quantity)||0,
      unit:form.unit, location_type:form.location_type, location:form.location, bought_at:form.bought_at, notes:form.notes, updated_at:new Date().toISOString(),
    };
    let error;
    if (editing==="new") ({ error } = await supabase.from("inventory").insert(payload));
    else ({ error } = await supabase.from("inventory").update(payload).eq("id", editing));
    if (error) { setMsg("Error: "+error.message); }
    else { setMsg("Guardado"); setEditing(null); loadItems(); }
    setTimeout(()=>setMsg(""),3000);
  };

  const del = async (id) => { await supabase.from("inventory").delete().eq("id", id); loadItems(); };

  // Ajuste rápido de cantidad (+ / -)
  const adjust = async (it, delta) => {
    const newQty = Math.max(0, Number(it.quantity) + delta);
    await supabase.from("inventory").update({ quantity:newQty, updated_at:new Date().toISOString() }).eq("id", it.id);
    setItems(items.map(x=>x.id===it.id?{...x,quantity:newQty}:x));
  };

  if (!allowed) {
    return <div style={{padding:"40px 20px"}}><PremiumLock feature="Inventario de Repuestos" onUpgrade={()=>setShowProfile&&setShowProfile(true)}/></div>;
  }

  const lowItems = items.filter(it => Number(it.min_quantity)>0 && Number(it.quantity)<=Number(it.min_quantity));
  const shown = filter==="low" ? lowItems : items;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:"#0f172a"}}>Repuestos de {vessel.name}</div>
          <div style={{fontSize:13,color:"#64748b"}}>Inventario a bordo y alertas de reposición</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setRequesting("new")} style={{padding:"10px 16px",background:"#fff",border:"1.5px solid #1d4ed8",borderRadius:10,color:"#1d4ed8",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            Pedir repuesto
          </button>
          <button onClick={openNew} style={{padding:"10px 18px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            Agregar repuesto
          </button>
        </div>
      </div>

      {/* Alerta de reposición */}
      {lowItems.length>0&&(
        <div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#dc2626",marginBottom:4}}>Hay {lowItems.length} repuesto{lowItems.length>1?"s":""} por reponer</div>
          <div style={{fontSize:12,color:"#b91c1c"}}>{lowItems.map(i=>i.name).join(", ")}</div>
        </div>
      )}

      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setFilter("all")} style={chip(filter==="all")}>Todos ({items.length})</button>
        <button onClick={()=>setFilter("low")} style={chip(filter==="low")}>Por reponer ({lowItems.length})</button>
        <button onClick={()=>setFilter("requests")} style={chip(filter==="requests")}>Mis pedidos ({myRequests.filter(r=>r.status==="open").length})</button>
      </div>

      {/* ── MIS PEDIDOS ── */}
      {filter==="requests" ? (
        <div>
          {myRequests.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
              <div style={{fontWeight:600}}>No has pedido repuestos</div>
              <div style={{fontSize:12,marginTop:4}}>Usa "Pedir repuesto" para que las tiendas de tu zona te coticen</div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {(() => {
              // Clasificar pedidos por estado
              const clasificar = (r) => {
                if (r.status==="resolved") return "comprado";
                if (r.winner_response_id) return "proceso"; // ya eligió tienda, finiquitando
                return "pendiente";
              };
              const grupos = { pendiente:[], proceso:[], comprado:[] };
              myRequests.forEach(r => { grupos[clasificar(r)].push(r); });
              const secciones = [
                { key:"pendiente", label:lang==="es"?"Pendientes":"Pending", desc:lang==="es"?"Esperando ofertas de tiendas":"Awaiting store offers", color:"#2563eb" },
                { key:"proceso",   label:lang==="es"?"En proceso":"In progress", desc:lang==="es"?"Finiquitando detalles con la tienda":"Finalizing details with the store", color:"#d97706" },
                { key:"comprado",  label:t("parts.purchased"), desc:lang==="es"?"Compras completadas":"Completed purchases", color:"#16a34a" },
              ];
              return secciones.map(sec => grupos[sec.key].length===0 ? null : (
                <div key={sec.key}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:14,fontWeight:700,color:sec.color,fontFamily:"'Sora',system-ui,sans-serif"}}>{sec.label}</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{grupos[sec.key].length} · {sec.desc}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {grupos[sec.key].map(r=>{
              const resolved = r.status==="resolved";
              const pendingApproval = r.status==="pending_approval";
              const resp = r.responses||[];
              return (
                <div key={r.id} style={{background:"#fff",border:`1px solid ${pendingApproval?"#fde68a":"#e2e8f0"}`,borderRadius:12,padding:14,opacity:resolved?0.7:1}}>
                  {pendingApproval&&(
                    <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#b45309",marginBottom:6}}>{r.requested_by_name||"El capitán"} pide aprobación{r.est_amount?` (~$${r.est_amount})`:""}</div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>approveRequest(r)} style={{flex:1,padding:"7px",background:"#16a34a",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Aprobar y publicar</button>
                        <button onClick={()=>rejectRequest(r)} style={{flex:1,padding:"7px",background:"#fff",border:"1px solid #fecaca",borderRadius:7,color:"#dc2626",fontSize:12,fontWeight:700,cursor:"pointer"}}>Rechazar</button>
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:12,marginBottom:resp.length?10:0}}>
                    {r.photo_url&&<img src={r.photo_url} style={{width:54,height:54,borderRadius:8,objectFit:"cover",flexShrink:0}} alt=""/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{r.item_name}{r.urgent&&<span style={{marginLeft:8,fontSize:10,background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:10,fontWeight:700}}>URGENTE</span>}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{r.category}{r.part_num?` · ${r.part_num}`:""}{r.requested_by_name&&r.requested_by_name!=="Dueño"?` · pedido por ${r.requested_by_name}`:""} · {resolved?"Cerrado":pendingApproval?"Esperando tu aprobación":`${resp.length} respuesta${resp.length!==1?"s":""}`}</div>
                    </div>
                    {!pendingApproval&&(resolved
                      ? <button onClick={()=>reopenRequest(r.id)} style={{background:"none",border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#64748b",cursor:"pointer",fontWeight:600,height:"fit-content"}}>Reabrir</button>
                      : <button onClick={()=>closeRequest(r.id)} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#16a34a",cursor:"pointer",fontWeight:700,height:"fit-content"}}>Cerrar</button>
                    )}
                  </div>
                  {/* Subasta: ofertas de tiendas ordenadas por precio */}
                  {resp.length>0&&(() => {
                    const withPrice = resp.filter(x=>x.response_type==="have"&&x.price).sort((a,b)=>parseFloat(a.price)-parseFloat(b.price));
                    const others = resp.filter(x=>x.response_type!=="have"||!x.price);
                    const bestId = withPrice[0]?.id;
                    const ordered = [...withPrice, ...others];
                    return (
                    <div style={{display:"flex",flexDirection:"column",gap:8,borderTop:"1px solid #f1f5f9",paddingTop:10}}>
                      {withPrice.length>1&&!resolved&&<div style={{fontSize:11,color:"#2563eb",fontWeight:700,marginBottom:2}}>{withPrice.length} tiendas compiten por tu compra. La más barata está marcada.</div>}
                      {ordered.map(rp=>{
                        const isBest = rp.id===bestId;
                        const isWinner = rp.is_winner;
                        return (
                        <div key={rp.id} style={{background:isWinner?"#f0fdf4":isBest&&!resolved?"#eff6ff":"#f8fafc",border:isWinner?"1px solid #bbf7d0":isBest&&!resolved?"1px solid #bfdbfe":"1px solid transparent",borderRadius:8,padding:"10px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>
                                {rp.store?.store_name||"Tienda"}{rp.store?.store_city?` · ${rp.store.store_city}`:""}
                                {isBest&&!resolved&&rp.response_type==="have"&&<span style={{marginLeft:6,fontSize:9,background:"#dbeafe",color:"#2563eb",padding:"2px 7px",borderRadius:10,fontWeight:700}}>Mejor precio</span>}
                                {isWinner&&<span style={{marginLeft:6,fontSize:9,background:"#dcfce7",color:"#16a34a",padding:"2px 7px",borderRadius:10,fontWeight:700}}>Elegida</span>}
                              </div>
                              <div style={{fontSize:12,marginTop:2,fontWeight:600,color:rp.response_type==="have"?"#16a34a":rp.response_type==="have_questions"?"#d97706":"#94a3b8"}}>
                                {rp.response_type==="have"?`${rp.currency==="USD"?"$":"Bs."} ${rp.price}`:rp.response_type==="have_questions"?"Disponible, tiene preguntas":"No disponible"}
                              </div>
                              {rp.message&&<div style={{fontSize:12,color:"#475569",marginTop:3}}>{rp.message}</div>}
                            </div>
                            {rp.response_type!=="decline"&&rp.store?.store_phone&&(
                              <a href={`https://wa.me/${rp.store.store_phone.replace(/[^0-9]/g,"")}?text=${encodeURIComponent(`Hola, soy dueño de embarcación en Carive. Te escribo por mi solicitud de: ${r.item_name}`)}`} target="_blank" rel="noreferrer" style={{background:"#fff",border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#16a34a",fontWeight:700,textDecoration:"none",whiteSpace:"nowrap",height:"fit-content"}}>WhatsApp</a>
                            )}
                          </div>
                          {/* Botón elegir ganador (solo si no resuelto y tiene precio) */}
                          {!resolved&&rp.response_type==="have"&&rp.price&&(
                            <button onClick={()=>chooseWinner(r,rp)} style={{width:"100%",marginTop:8,padding:"7px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Elegir esta tienda</button>
                          )}
                        </div>
                      );})}
                    </div>
                    );
                  })()}
                  {resp.length===0&&!resolved&&<div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic"}}>Esperando respuestas de las tiendas...</div>}
                </div>
              );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      ) : (
      <>
      {loading&&<div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>Cargando...</div>}
      {!loading&&shown.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
          <div style={{fontWeight:600}}>{filter==="low"?"Nada por reponer":"Sin repuestos registrados"}</div>
          <div style={{fontSize:12,marginTop:4}}>{filter==="low"?(lang==="es"?"Todo en stock":"All in stock"):t("parts.empty")}</div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {(() => {
          // Agrupar por categoría
          const groups = {};
          shown.forEach(it => {
            const cat = it.category || "Otro";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(it);
          });
          const catNames = Object.keys(groups).sort();
          return catNames.map(cat => {
            const catItems = groups[cat];
            const lowCount = catItems.filter(it=>Number(it.min_quantity)>0 && Number(it.quantity)<=Number(it.min_quantity)).length;
            const collapsed = collapsedCats[cat];
            return (
              <div key={cat} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
                {/* Cabecera de la carpeta/categoría */}
                <button onClick={()=>setCollapsedCats(c=>({...c,[cat]:!c[cat]}))} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#f8fafc",border:"none",borderBottom:collapsed?"none":"1px solid #eef2f7",cursor:"pointer",textAlign:"left"}}>
                  <span style={{fontSize:12,color:"#94a3b8",transform:collapsed?"rotate(-90deg)":"none",transition:".15s"}}>▼</span>
                  <span style={{fontSize:14,fontWeight:700,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>{cat}</span>
                  <span style={{fontSize:11,color:"#94a3b8"}}>{catItems.length} {catItems.length===1?"repuesto":"repuestos"}</span>
                  {lowCount>0 && <span style={{fontSize:10,background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:10,fontWeight:700}}>{lowCount} por reponer</span>}
                </button>
                {/* Items de la categoría */}
                {!collapsed && (
                  <div style={{display:"flex",flexDirection:"column"}}>
                    {catItems.map(it=>{
                      const low = Number(it.min_quantity)>0 && Number(it.quantity)<=Number(it.min_quantity);
                      return (
                        <div key={it.id} style={{padding:"12px 16px",borderBottom:"1px solid #f4f7fa",background:low?"#fff8f8":"#fff"}}>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{it.name}{low&&<span style={{marginLeft:8,fontSize:10,background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:10,fontWeight:700}}>Reponer</span>}</div>
                              <div style={{fontSize:11,color:"#64748b"}}>{it.brand?`${it.brand}`:""}{it.part_num?`${it.brand?" · ":""}${it.part_num}`:""}{it.location_type?` · ${it.location_type}`:""}{it.location?` (${it.location})`:""}</div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <button onClick={()=>adjust(it,-1)} style={qtyBtn}>−</button>
                              <div style={{minWidth:54,textAlign:"center"}}>
                                <div style={{fontSize:15,fontWeight:800,color:low?"#dc2626":"#0f172a"}}>{Number(it.quantity)}</div>
                                <div style={{fontSize:9,color:"#94a3b8"}}>{it.unit}</div>
                              </div>
                              <button onClick={()=>adjust(it,1)} style={qtyBtn}>+</button>
                            </div>
                            <button onClick={()=>openEdit(it)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:13,fontWeight:600}}>Editar</button>
                            <button onClick={()=>{ if(confirm(`¿Eliminar "${it.name}" del inventario?`)) del(it.id); }} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:13,fontWeight:600}}>Eliminar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
      </>
      )}

      {/* Modal crear/editar */}
      {editing&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={()=>setEditing(null)}>
          <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:440,width:"100%",maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{editing==="new"?"Nuevo repuesto":"Editar repuesto"}</div>
              {editing!=="new"&&<button onClick={()=>{del(editing);setEditing(null);}} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12,fontWeight:700}}>Eliminar</button>}
            </div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>Nombre del repuesto *</label>
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej: Filtro de aceite Fleetguard FF5052" style={inp}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div style={{flex:1}}>
                <label style={lbl}>Categoría</label>
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={inp}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>Marca</label>
                <input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})} placeholder="Ej: Fleetguard" style={inp}/>
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>N° de parte</label>
                <input value={form.part_num} onChange={e=>setForm({...form,part_num:e.target.value})} placeholder="FF5052" style={inp}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div style={{flex:1}}>
                <label style={lbl}>Cantidad actual</label>
                <input type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} placeholder="0" style={inp}/>
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>Mínimo (alerta)</label>
                <input type="number" value={form.min_quantity} onChange={e=>setForm({...form,min_quantity:e.target.value})} placeholder="2" style={inp}/>
              </div>
              <div style={{width:110}}>
                <label style={lbl}>Unidad</label>
                <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} style={inp}>
                  {UNITS.map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div style={{width:150}}>
                <label style={lbl}>Ubicación</label>
                <select value={form.location_type} onChange={e=>setForm({...form,location_type:e.target.value})} style={inp}>
                  {LOCATIONS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>Detalle de ubicación</label>
                <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Ej: gaveta 2, lado estribor" style={inp}/>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>¿Dónde se compró?</label>
              <input value={form.bought_at} onChange={e=>setForm({...form,bought_at:e.target.value})} placeholder="Ej: Náutica El Morro, Lechería" style={inp}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Notas</label>
              <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Opcional" style={inp}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:"11px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={save} style={{flex:2,padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {requesting&&(
        <RequestPartModal vessel={vessel} user={user} item={requesting==="new"?null:requesting} role={role} captainLimit={captainLimit} onClose={()=>setRequesting(null)} onDone={()=>{ setRequesting(null); loadRequests(); setFilter("requests"); setMsg("Solicitud publicada. Te avisaremos cuando una tienda responda."); setTimeout(()=>setMsg(""),4000); }}/>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000}}>{msg}</div>}
    </div>
  );
}

const lbl = {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5};
const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
const qtyBtn = {width:30,height:30,borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,fontWeight:700,color:"#475569",display:"flex",alignItems:"center",justifyContent:"center"};
const chip = (active) => ({padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"1.5px solid",background:active?"#eff6ff":"#fff",borderColor:active?"#2563eb":"#e2e8f0",color:active?"#2563eb":"#64748b"});

const REQ_CATEGORIES = ["Filtros","Aceites y Lubricantes","Correas","Motores","Eléctrico","Electrónica/Navegación","Bombas","Hélices","Seguridad","Ánodos","Pinturas","Plomería","Tapicería","Ferretería marina","Otro"];

function RequestPartModal({ vessel, user, item, onClose, onDone, role="owner", captainLimit }) {
  const [form, setForm] = useState({
    item_name: item?.name||"", category: item?.category||"Filtros",
    part_num: item?.part_num||"", description:"", urgent:false, est_amount:"", scope:"city",
  });
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCaptain = role === "captain";
  const limit = captainLimit != null ? Number(captainLimit) : 100;
  const estAmount = parseFloat(form.est_amount) || 0;
  const needsApproval = isCaptain && estAmount > limit;

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `part-requests/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("manuales").upload(path, file, { upsert:true });
      if (!error) {
        const { data } = supabase.storage.from("manuales").getPublicUrl(path);
        setPhotoUrl(data.publicUrl);
      }
    } catch(e) {}
    setUploading(false);
  };

  const submit = async () => {
    if (!form.item_name.trim()) return;
    setSaving(true);
    const city = vessel.details?.city||vessel.marina||"";
    const authorName = user?.full_name || user?.email || (isCaptain?"Capitán":"Dueño");
    // Coordenadas del barco: de sus detalles, o inferidas de su ciudad conocida
    let reqLat = vessel.details?.lat ?? null, reqLng = vessel.details?.lng ?? null;
    if (reqLat==null && city) {
      const match = findCityCoords(city);
      if (match) { reqLat = match.lat; reqLng = match.lng; }
    }
    const { data: inserted, error } = await supabase.from("part_requests").insert({
      owner_id: vessel.owner_id || user.id, vessel_id:vessel.id,
      item_name:form.item_name, category:form.category, part_num:form.part_num,
      description:form.description, photo_url:photoUrl, city, urgent:form.urgent,
      req_lat:reqLat, req_lng:reqLng,
      status: needsApproval ? "pending_approval" : "open",
      requested_by: user.id, requested_by_name: authorName,
      needs_approval: needsApproval, approval_status: needsApproval ? "pending" : null,
      est_amount: estAmount || null,
    }).select().single();
    if (!error) {
      if (needsApproval) {
        // Pedir aprobación al dueño — no se publica a tiendas todavía
        notify(vessel.owner_id, { type:"parts_approval", title:"Aprobación de repuesto", body:`${authorName} quiere pedir ${form.item_name} (~$${estAmount}). Supera el tope de $${limit}.`, link:"inventory" });
      } else {
        // Publicar a tiendas que calzan (por categoría y distancia)
        const { data: stores } = await supabase.from("profiles")
          .select("id,store_categories,store_city,store_ships_nationwide,store_phone,store_lat,store_lng,store_radius_km")
          .eq("role","store");
        const nationalSearch = form.scope === "national";
        let notifiedCount = 0;
        (stores||[]).forEach(st => {
          const cats = (st.store_categories||[]).map(c=>c.toLowerCase());
          const catMatch = cats.includes(form.category.toLowerCase());
          if (!catMatch) return;
          let geoMatch;
          if (nationalSearch || st.store_ships_nationwide) geoMatch = true;
          else if (st.store_lat!=null && reqLat!=null) {
            const d = distanceKm(st.store_lat,st.store_lng,reqLat,reqLng);
            geoMatch = d!=null ? d <= (st.store_radius_km||50) : true;
          } else geoMatch = true;
          if (geoMatch) {
            notify(st.id, { type:"part_request", title:"Nueva solicitud de repuesto", body:`${form.item_name} (${form.category})${city?` en ${city}`:""}`, link:"solicitudes" });
            notifiedCount++;
          }
        });
        // Avisar al admin (Fernando) para reforzar por WhatsApp si quiere
        try {
          const { data: admin } = await supabase.from("profiles").select("id").eq("email","fernandobavuso@gmail.com").maybeSingle();
          if (admin) notify(admin.id, { type:"admin_new_request", title:"Nuevo pedido para tiendas", body:`${form.item_name} en ${city||"—"}. ${notifiedCount} tienda(s) notificada(s). Refuérzalo por WhatsApp desde el Panel.`, link:"" });
        } catch(e){}
      }
    }
    setSaving(false);
    onDone(needsApproval);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:420,width:"100%",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:4}}>Pedir repuesto</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Tu solicitud llegará a las tiendas de esta categoría en tu zona</div>

        <div style={{marginBottom:10}}>
          <label style={lbl}>¿Qué necesitas? *</label>
          <input value={form.item_name} onChange={e=>setForm({...form,item_name:e.target.value})} placeholder="Ej: Filtro de aceite Fleetguard FF5052" style={inp}/>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}>
            <label style={lbl}>Categoría</label>
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={inp}>
              {REQ_CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>N° de parte</label>
            <input value={form.part_num} onChange={e=>setForm({...form,part_num:e.target.value})} placeholder="Opcional" style={inp}/>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <label style={lbl}>Detalles</label>
          <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} placeholder="Marca del motor, año, cantidad que necesitas..." style={{...inp,resize:"vertical"}}/>
        </div>
        <div style={{marginBottom:10}}>
          <label style={lbl}>¿Dónde buscar?</label>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setForm({...form,scope:"city"})} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid",cursor:"pointer",fontSize:12,fontWeight:700,background:form.scope==="city"?"#eff6ff":"#fff",borderColor:form.scope==="city"?"#2563eb":"#e2e8f0",color:form.scope==="city"?"#2563eb":"#64748b"}}>En mi ciudad</button>
            <button onClick={()=>setForm({...form,scope:"national"})} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid",cursor:"pointer",fontSize:12,fontWeight:700,background:form.scope==="national"?"#eff6ff":"#fff",borderColor:form.scope==="national"?"#2563eb":"#e2e8f0",color:form.scope==="national"?"#2563eb":"#64748b"}}>Toda Venezuela</button>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <label style={lbl}>Foto del repuesto (recomendado)</label>
          <label style={{display:"block",border:"2px dashed #bae6fd",borderRadius:10,padding:14,textAlign:"center",background:"#f0f9ff",cursor:"pointer",fontSize:12,color:"#0369a1"}}>
            {uploading?"Subiendo...":photoUrl?"Foto cargada — cambiar":"Toca para subir una foto"}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>uploadPhoto(e.target.files[0])}/>
          </label>
          {photoUrl&&<img src={photoUrl} style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:8,marginTop:8}} alt=""/>}
        </div>
        {isCaptain&&(
          <div style={{marginBottom:10}}>
            <label style={lbl}>Costo estimado (USD)</label>
            <input type="number" value={form.est_amount} onChange={e=>setForm({...form,est_amount:e.target.value})} placeholder="¿Cuánto crees que cuesta?" style={inp}/>
            {needsApproval&&(
              <div style={{marginTop:8,padding:"10px 12px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#b45309"}}>
                Este monto supera tu tope de ${limit}. Al enviarlo, el dueño recibirá tu solicitud para aprobarla antes de publicarla a las tiendas.
              </div>
            )}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"10px 12px",background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8}}>
          <input type="checkbox" id="urgent" checked={form.urgent} onChange={e=>setForm({...form,urgent:e.target.checked})} style={{width:15,height:15}}/>
          <label htmlFor="urgent" style={{fontSize:12,color:"#b91c1c",cursor:"pointer",fontWeight:600}}>Urgente — barco varado o necesito esto ya</label>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"11px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
          <button onClick={submit} disabled={saving||!form.item_name.trim()} style={{flex:2,padding:"11px",background:(saving||!form.item_name.trim())?"#cbd5e1":"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{saving?"Publicando...":needsApproval?"Enviar para aprobación":"Publicar solicitud"}</button>
        </div>
      </div>
    </div>
  );
}
