// Mi Empresa — gastos internos del negocio (materiales, pagos a terceros como
// limpiezas, transporte...) que NO pertenecen a un barco. Solo para cuentas Flota.
// Guarda en la tabla company_expenses (owner_id, sin vessel_id).
import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { useLang } from "./i18n.jsx";
import { accountHasFleet } from "./plans.jsx";

const CATEGORIES = [
  "Materiales y suministros", "Limpiezas", "Transporte y gasolina",
  "Oficina", "Sueldos", "Marketing", "Seguros", "Impuestos", "Otro",
];
const CAT_COLORS = ["#534AB7","#1D9E75","#D85A30","#378ADD","#D4537E","#BA7517","#639922","#5F5E5A","#94a3b8"];

const money = (n) => "$" + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2});
const monthKey = (d) => String(d||"").slice(0,7);

export default function CompanyPage({ user, vessels }) {
  const { lang } = useLang();
  const L = (es,en)=>lang==="en"?en:es;
  const [rows, setRows]       = useState([]);
  const [vesselExp, setVesselExp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [month, setMonth]     = useState(new Date().toISOString().slice(0,7));
  const [form, setForm] = useState({
    category: CATEGORIES[0], description:"", payee:"", amount:"",
    date: new Date().toISOString().slice(0,10), recurring:false,
  });

  const isFleet = accountHasFleet(vessels);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("company_expenses")
      .select("*").eq("owner_id", user.id).order("expense_date",{ascending:false});
    if (error) { setMsg(L("No se pudieron cargar los gastos: ","Couldn't load expenses: ")+error.message); }
    setRows(data||[]);
    // Gastos por barco del mes visible (para el comparativo)
    const { data: ve } = await supabase.from("expenses")
      .select("vessel_id, amount, expense_date").eq("owner_id", user.id);
    setVesselExp(ve||[]);
    setLoading(false);
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ },[user?.id]);

  // ── Cálculos del mes seleccionado ──────────────────────────────────────────
  const calc = useMemo(()=>{
    const inMonth  = rows.filter(r=>monthKey(r.expense_date)===month);
    const prevKey  = (()=>{ const d=new Date(month+"-15T00:00:00"); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();
    const prev     = rows.filter(r=>monthKey(r.expense_date)===prevKey);
    const total    = inMonth.reduce((a,r)=>a+Number(r.amount||0),0);
    const prevTot  = prev.reduce((a,r)=>a+Number(r.amount||0),0);
    const thirdParty = inMonth.filter(r=>r.payee).reduce((a,r)=>a+Number(r.amount||0),0);
    const delta    = prevTot>0 ? Math.round(((total-prevTot)/prevTot)*100) : null;

    const byCat = {};
    inMonth.forEach(r=>{ byCat[r.category]=(byCat[r.category]||0)+Number(r.amount||0); });
    const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

    const byPayee = {};
    inMonth.filter(r=>r.payee).forEach(r=>{
      const k=r.payee.trim();
      byPayee[k]=byPayee[k]||{total:0,count:0,cats:new Set()};
      byPayee[k].total+=Number(r.amount||0); byPayee[k].count++; byPayee[k].cats.add(r.category);
    });
    const payees = Object.entries(byPayee).sort((a,b)=>b[1].total-a[1].total);

    const byVessel = {};
    vesselExp.filter(e=>monthKey(e.expense_date)===month).forEach(e=>{
      byVessel[e.vessel_id]=(byVessel[e.vessel_id]||0)+Number(e.amount||0);
    });
    return { inMonth, total, thirdParty, delta, cats, payees, byVessel };
  },[rows, vesselExp, month]);

  // Sugerencias de beneficiario: proveedores de la flota + ya usados
  const payeeSuggestions = useMemo(()=>{
    const fromProviders = (vessels?.[0]?.providers||[]).map(p=>p.company||`${p.firstName||""} ${p.lastName||""}`.trim()).filter(Boolean);
    const used = rows.map(r=>r.payee).filter(Boolean);
    return [...new Set([...fromProviders, ...used])].sort();
  },[vessels, rows]);

  const save = async () => {
    if (!form.amount || Number(form.amount)<=0) { setMsg(L("Indica el monto","Enter the amount")); setTimeout(()=>setMsg(""),3000); return; }
    setSaving(true);
    const { error } = await supabase.from("company_expenses").insert({
      owner_id: user.id, category: form.category,
      description: form.description || null, payee: form.payee.trim() || null,
      amount: Number(form.amount), currency: "USD",
      expense_date: form.date, recurring: form.recurring,
    });
    setSaving(false);
    if (error) { setMsg("Error: "+error.message); setTimeout(()=>setMsg(""),4000); return; }
    setCreating(false);
    setForm({ category:CATEGORIES[0], description:"", payee:"", amount:"", date:new Date().toISOString().slice(0,10), recurring:false });
    load();
  };

  const del = async (id) => {
    if (!confirm(L("¿Eliminar este gasto?","Delete this expense?"))) return;
    const { error } = await supabase.from("company_expenses").delete().eq("id", id);
    if (error) { setMsg("Error: "+error.message); setTimeout(()=>setMsg(""),4000); return; }
    setRows(list=>list.filter(r=>r.id!==id));
  };

  if (!isFleet) {
    return <div style={{padding:"40px 20px",textAlign:"center",color:"#64748b",fontSize:14}}>
      {L("Los gastos de empresa están disponibles con el plan Flota.","Company expenses are available with the Fleet plan.")}
    </div>;
  }

  const monthLabel = new Date(month+"-15T00:00:00").toLocaleDateString(lang==="es"?"es":"en-US",{month:"long",year:"numeric"});
  const shiftMonth = (n) => { const d=new Date(month+"-15T00:00:00"); d.setMonth(d.getMonth()+n); setMonth(d.toISOString().slice(0,7)); };
  const maxCat = calc.cats.length ? calc.cats[0][1] : 0;
  const sel = {padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#334155",background:"#fff"};

  return (
    <div style={{padding:"24px 28px",maxWidth:860}}>
      {/* Encabezado */}
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <div style={{flex:1,minWidth:200}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#0f172a"}}>{L("Mi Empresa","My Company")}</h2>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{L("Gastos del negocio, no asignados a barcos","Business expenses, not tied to vessels")}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>shiftMonth(-1)} style={{...sel,cursor:"pointer",padding:"7px 11px"}}>‹</button>
          <div style={{fontSize:13,fontWeight:700,color:"#334155",minWidth:130,textAlign:"center",textTransform:"capitalize"}}>{monthLabel}</div>
          <button onClick={()=>shiftMonth(1)} style={{...sel,cursor:"pointer",padding:"7px 11px"}}>›</button>
        </div>
        <button onClick={()=>setCreating(true)} style={{padding:"9px 15px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          + {L("Gasto de empresa","Company expense")}
        </button>
      </div>

      {msg && <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#dc2626",marginBottom:12}}>{msg}</div>}

      {/* Métricas */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:18}}>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{L("Gastos del mes","Month expenses")}</div>
          <div style={{fontSize:24,fontWeight:800,color:"#0f172a",marginTop:2}}>{money(calc.total)}</div>
        </div>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{L("Pagos a terceros","Third-party payments")}</div>
          <div style={{fontSize:24,fontWeight:800,color:"#0f172a",marginTop:2}}>{money(calc.thirdParty)}</div>
        </div>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{L("vs. mes anterior","vs. last month")}</div>
          <div style={{fontSize:24,fontWeight:800,marginTop:2,color:calc.delta==null?"#94a3b8":calc.delta>0?"#dc2626":"#16a34a"}}>
            {calc.delta==null ? "—" : `${calc.delta>0?"+":""}${calc.delta}%`}
          </div>
        </div>
      </div>

      {loading ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Cargando...","Loading...")}</div> : <>

      {/* Por categoría */}
      {calc.cats.length>0 && (
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:8}}>{L("Por categoría","By category")}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {calc.cats.map(([cat,amt],i)=>(
              <div key={cat}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}>
                  <span style={{color:"#0f172a"}}>{cat}</span>
                  <span style={{color:"#64748b",fontWeight:600}}>{money(amt)}</span>
                </div>
                <div style={{height:6,background:"#f1f5f9",borderRadius:3}}>
                  <div style={{width:`${maxCat?Math.max(4,(amt/maxCat)*100):0}%`,height:6,background:CAT_COLORS[CATEGORIES.indexOf(cat)]||"#94a3b8",borderRadius:3}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* A quién le pagué */}
      {calc.payees.length>0 && (
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:8}}>{L("A quién le pagué","Who I paid")}</div>
          <div style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
            {calc.payees.map(([name,info],i)=>(
              <div key={name} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderBottom:i<calc.payees.length-1?"1px solid #f1f5f9":"none"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:"#eff6ff",color:"#1e40af",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>
                  {name.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:"#0f172a",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>{info.count} {info.count===1?L("pago","payment"):L("pagos","payments")} · {[...info.cats].join(", ")}</div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a",whiteSpace:"nowrap"}}>{money(info.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Costo por barco + empresa */}
      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:8}}>{L("Costo del mes por barco + empresa","Month cost per vessel + company")}</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {(vessels||[]).map(v=>(
            <div key={v.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"8px 11px",background:"#f8fafc",borderRadius:8}}>
              <span style={{color:"#0f172a"}}>{v.name}</span>
              <span style={{color:"#64748b",fontWeight:600}}>{money(calc.byVessel[v.id]||0)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"8px 11px",border:"1.5px solid #bfdbfe",borderRadius:8}}>
            <span style={{color:"#1e40af",fontWeight:700}}>{L("Empresa (no asignado a barcos)","Company (not tied to vessels)")}</span>
            <span style={{color:"#1e40af",fontWeight:700}}>{money(calc.total)}</span>
          </div>
        </div>
      </div>

      {/* Movimientos del mes */}
      <div>
        <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:8}}>{L("Movimientos","Transactions")} · {calc.inMonth.length}</div>
        {calc.inMonth.length===0
          ? <div style={{padding:"30px 12px",textAlign:"center",color:"#94a3b8",fontSize:13,border:"1px dashed #e2e8f0",borderRadius:10}}>
              {L("Sin gastos de empresa este mes. Usa “+ Gasto de empresa” para registrar el primero.","No company expenses this month. Use “+ Company expense” to add the first one.")}
            </div>
          : <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {calc.inMonth.map(r=>(
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#fff",border:"1px solid #f1f5f9",borderRadius:9}}>
                  <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:CAT_COLORS[CATEGORIES.indexOf(r.category)]||"#94a3b8"}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>
                      {r.category}
                      {r.recurring && <span style={{marginLeft:6,fontSize:10,background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"2px 7px"}}>{L("fijo","fixed")}</span>}
                    </div>
                    <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {[r.payee, r.description, new Date(r.expense_date+"T00:00:00").toLocaleDateString("en-US")].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{fontSize:14,fontWeight:800,color:"#0f172a",whiteSpace:"nowrap"}}>{money(r.amount)}</div>
                  <button onClick={()=>del(r.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:15,padding:2}} title={L("Eliminar","Delete")}>×</button>
                </div>
              ))}
            </div>}
      </div>
      </>}

      {/* Modal: nuevo gasto de empresa (no cierra al clic fuera) */}
      {creating && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:14,overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:440,width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{flex:1,fontSize:16,fontWeight:800,color:"#0f172a"}}>{L("Gasto de empresa","Company expense")}</div>
              <button onClick={()=>setCreating(false)} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Categoría","Category")}</label>
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{...sel,width:"100%"}}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("A quién le pagaste (opcional)","Who you paid (optional)")}</label>
                <input list="payees" value={form.payee} onChange={e=>setForm({...form,payee:e.target.value})} placeholder={L("Empresa o persona","Company or person")} style={{...sel,width:"100%",boxSizing:"border-box"}}/>
                <datalist id="payees">{payeeSuggestions.map(p=><option key={p} value={p}/>)}</datalist>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Descripción (opcional)","Description (optional)")}</label>
                <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={L("Guantes, trapos, cera...","Gloves, rags, wax...")} style={{...sel,width:"100%",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Monto (USD)","Amount (USD)")}</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00" style={{...sel,width:"100%",boxSizing:"border-box"}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Fecha","Date")}</label>
                  <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{...sel,width:"100%",boxSizing:"border-box"}}/>
                </div>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})}/>
                <span style={{fontSize:12,color:"#475569"}}>{L("Es un gasto fijo mensual","It's a fixed monthly expense")}</span>
              </label>

              <button onClick={save} disabled={saving} style={{padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:saving?0.6:1}}>
                {saving ? L("Guardando...","Saving...") : L("Guardar gasto","Save expense")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
