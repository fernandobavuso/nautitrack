import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { hasFeature, PremiumLock } from "./plans.jsx";

const CATEGORIES = ["Combustible","Mantenimiento","Reparación","Repuestos","Sueldos","Marina","Seguro","Impuestos","Otro"];
const CAT_COLORS = {
  Combustible:"#0ea5e9", Mantenimiento:"#2563eb", "Reparación":"#dc2626",
  Repuestos:"#7c3aed", Sueldos:"#16a34a", Marina:"#d97706",
  Seguro:"#0891b2", Impuestos:"#be185d", Otro:"#64748b",
};

export default function CostsPage({ vessel, user, setShowProfile }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [period, setPeriod] = useState("month"); // month / year / all
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    category:"Combustible", description:"", amount:"", currency:"USD",
    expense_date:new Date().toISOString().slice(0,10), recurring:false,
  });

  const allowed = hasFeature(vessel, "costs");

  useEffect(() => { if (allowed) loadExpenses(); }, []);

  const loadExpenses = async () => {
    const { data } = await supabase.from("expenses")
      .select("*").eq("vessel_id", vessel.id).order("expense_date",{ascending:false});
    setExpenses(data||[]);
    setLoading(false);
  };

  const save = async () => {
    if (!form.amount || isNaN(parseFloat(form.amount))) { setMsg("Indica un monto válido"); setTimeout(()=>setMsg(""),3000); return; }
    const { error } = await supabase.from("expenses").insert({
      vessel_id:vessel.id, owner_id:user.id,
      category:form.category, description:form.description,
      amount:parseFloat(form.amount), currency:form.currency,
      expense_date:form.expense_date, recurring:form.recurring, source:"manual",
    });
    if (error) { setMsg("Error: "+error.message); }
    else {
      setMsg("Gasto registrado");
      setForm({category:"Combustible",description:"",amount:"",currency:"USD",expense_date:new Date().toISOString().slice(0,10),recurring:false});
      setCreating(false); loadExpenses();
    }
    setTimeout(()=>setMsg(""),3000);
  };

  const del = async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    loadExpenses();
  };

  if (!allowed) {
    return <div style={{padding:"40px 20px"}}><PremiumLock feature="Control de Costos" onUpgrade={()=>setShowProfile&&setShowProfile(true)}/></div>;
  }

  // Filtrar por periodo
  const now = new Date();
  const filtered = expenses.filter(e => {
    if (period==="all") return true;
    const d = new Date(e.expense_date);
    if (period==="month") return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    if (period==="year") return d.getFullYear()===now.getFullYear();
    return true;
  });

  // Totales por moneda
  const totalUSD = filtered.filter(e=>e.currency==="USD").reduce((a,e)=>a+Number(e.amount),0);
  const totalVES = filtered.filter(e=>e.currency==="VES").reduce((a,e)=>a+Number(e.amount),0);

  // Desglose por categoría (solo USD para el gráfico, simplificado)
  const byCat = {};
  filtered.forEach(e => { byCat[e.category] = (byCat[e.category]||0) + (e.currency==="USD"?Number(e.amount):0); });
  const catEntries = Object.entries(byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const maxCat = Math.max(...catEntries.map(([,v])=>v), 1);

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:"#0f172a"}}>Costos de {vessel.name}</div>
          <div style={{fontSize:13,color:"#64748b"}}>Cuánto te cuesta tu embarcación. Los gastos que registras en la bitácora aparecen aquí automáticamente.</div>
        </div>
        <button onClick={()=>setCreating(true)} style={{padding:"10px 18px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Registrar gasto
        </button>
      </div>

      {/* Selector de periodo */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[{k:"month",l:"Este mes"},{k:"year",l:"Este año"},{k:"all",l:"Todo"}].map(p=>(
          <button key={p.k} onClick={()=>setPeriod(p.k)} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"1.5px solid",
            background:period===p.k?"#eff6ff":"#fff", borderColor:period===p.k?"#2563eb":"#e2e8f0",
            color:period===p.k?"#2563eb":"#64748b",
          }}>{p.l}</button>
        ))}
      </div>

      {/* Totales */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:6}}>TOTAL EN DÓLARES</div>
          <div style={{fontSize:26,fontWeight:800,color:"#0f172a"}}>$ {totalUSD.toLocaleString("es-VE",{maximumFractionDigits:2})}</div>
        </div>
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:6}}>TOTAL EN BOLÍVARES</div>
          <div style={{fontSize:26,fontWeight:800,color:"#0f172a"}}>Bs. {totalVES.toLocaleString("es-VE",{maximumFractionDigits:2})}</div>
        </div>
      </div>

      {/* Desglose por categoría */}
      {catEntries.length>0&&(
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:14}}>Desglose por categoría (USD)</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {catEntries.map(([cat,val])=>(
              <div key={cat}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                  <span style={{color:"#475569",fontWeight:600}}>{cat}</span>
                  <span style={{color:"#0f172a",fontWeight:700}}>$ {val.toLocaleString("es-VE",{maximumFractionDigits:0})}</span>
                </div>
                <div style={{height:8,background:"#f1f5f9",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(val/maxCat)*100}%`,background:CAT_COLORS[cat]||"#64748b",borderRadius:4}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de gastos */}
      <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Movimientos</div>
      {loading&&<div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>Cargando...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
          <div style={{fontWeight:600}}>Sin gastos en este periodo</div>
          <div style={{fontSize:12,marginTop:4}}>Registra el primer gasto de tu barco</div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(e=>(
          <div key={e.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:4,height:36,borderRadius:2,background:CAT_COLORS[e.category]||"#64748b",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{e.category}{e.recurring?" · fijo mensual":""}{e.source==="log"?<span style={{marginLeft:6,fontSize:9,background:"#eff6ff",color:"#2563eb",padding:"2px 7px",borderRadius:10,fontWeight:700,verticalAlign:"middle"}}>desde bitácora</span>:""}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{e.description||"Sin descripción"} · {new Date(e.expense_date).toLocaleDateString("es-VE")}</div>
            </div>
            <div style={{fontSize:14,fontWeight:800,color:"#0f172a",whiteSpace:"nowrap"}}>
              {e.currency==="USD"?"$":"Bs."} {Number(e.amount).toLocaleString("es-VE",{maximumFractionDigits:2})}
            </div>
            <button onClick={()=>del(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#cbd5e1",fontSize:16}}>×</button>
          </div>
        ))}
      </div>

      {/* Modal registrar gasto */}
      {creating&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={()=>setCreating(false)}>
          <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:420,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:16}}>Registrar gasto</div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>Categoría</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={inp}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>Descripción</label>
              <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Ej: Cambio de aceite motor estribor" style={inp}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div style={{flex:1}}>
                <label style={lbl}>Monto</label>
                <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0" style={inp}/>
              </div>
              <div style={{width:120}}>
                <label style={lbl}>Moneda</label>
                <select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} style={inp}>
                  <option value="USD">Dólares ($)</option>
                  <option value="VES">Bolívares (Bs.)</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>Fecha</label>
              <input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} style={inp}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <input type="checkbox" id="recurring" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})} style={{width:15,height:15}}/>
              <label htmlFor="recurring" style={{fontSize:12,color:"#475569",cursor:"pointer"}}>Es un gasto fijo mensual (sueldo, marina, seguro)</label>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setCreating(false)} style={{flex:1,padding:"11px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancelar</button>
              <button onClick={save} style={{flex:2,padding:"11px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Guardar gasto</button>
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
