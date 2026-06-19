import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { hasFeature, PremiumLock } from "./plans.jsx";

const CATEGORIES = ["Filtros","Aceites y Lubricantes","Correas","Eléctrico","Seguridad","Limpieza","Ánodos","Impulsores","Otro"];
const UNITS = ["unidad","litros","galones","metros","kit"];

export default function InventoryPage({ vessel, user, setShowProfile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // item en edición o "new"
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all"); // all / low
  const blank = { name:"", category:"Filtros", part_num:"", quantity:"", min_quantity:"", unit:"unidad", location:"", notes:"" };
  const [form, setForm] = useState(blank);

  const allowed = hasFeature(vessel, "inventory");

  useEffect(() => { if (allowed) loadItems(); }, []);

  const loadItems = async () => {
    const { data } = await supabase.from("inventory")
      .select("*").eq("vessel_id", vessel.id).order("name");
    setItems(data||[]);
    setLoading(false);
  };

  const openNew = () => { setForm(blank); setEditing("new"); };
  const openEdit = (it) => {
    setForm({ name:it.name||"", category:it.category||"Filtros", part_num:it.part_num||"", quantity:it.quantity??"", min_quantity:it.min_quantity??"", unit:it.unit||"unidad", location:it.location||"", notes:it.notes||"" });
    setEditing(it.id);
  };

  const save = async () => {
    if (!form.name.trim()) { setMsg("Indica el nombre del repuesto"); setTimeout(()=>setMsg(""),3000); return; }
    const payload = {
      vessel_id:vessel.id, owner_id:user.id,
      name:form.name.trim(), category:form.category, part_num:form.part_num,
      quantity:parseFloat(form.quantity)||0, min_quantity:parseFloat(form.min_quantity)||0,
      unit:form.unit, location:form.location, notes:form.notes, updated_at:new Date().toISOString(),
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
        <button onClick={openNew} style={{padding:"10px 18px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Agregar repuesto
        </button>
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
      </div>

      {loading&&<div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>Cargando...</div>}
      {!loading&&shown.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
          <div style={{fontWeight:600}}>{filter==="low"?"Nada por reponer":"Sin repuestos registrados"}</div>
          <div style={{fontSize:12,marginTop:4}}>{filter==="low"?"Todo en stock":"Agrega los repuestos que tienes a bordo"}</div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {shown.map(it=>{
          const low = Number(it.min_quantity)>0 && Number(it.quantity)<=Number(it.min_quantity);
          return (
            <div key={it.id} style={{background:"#fff",border:`1px solid ${low?"#fecaca":"#e2e8f0"}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{it.name}{low&&<span style={{marginLeft:8,fontSize:10,background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:10,fontWeight:700}}>Reponer</span>}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{it.category}{it.part_num?` · ${it.part_num}`:""}{it.location?` · ${it.location}`:""}</div>
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
              </div>
            </div>
          );
        })}
      </div>

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
            <div style={{marginBottom:10}}>
              <label style={lbl}>Ubicación a bordo</label>
              <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Ej: Pañol de proa, gaveta 2" style={inp}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Notas</label>
              <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Opcional" style={inp}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditing(null)} style={{flex:1,padding:"11px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={save} style={{flex:2,padding:"11px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000}}>{msg}</div>}
    </div>
  );
}

const lbl = {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5};
const inp = {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
const qtyBtn = {width:30,height:30,borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,fontWeight:700,color:"#475569",display:"flex",alignItems:"center",justifyContent:"center"};
const chip = (active) => ({padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"1.5px solid",background:active?"#eff6ff":"#fff",borderColor:active?"#2563eb":"#e2e8f0",color:active?"#2563eb":"#64748b"});
