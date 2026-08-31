// Mi Empresa — gastos internos del negocio (materiales, pagos a terceros como
// limpiezas, transporte...) que NO pertenecen a un barco. Solo para cuentas Flota.
// Guarda en la tabla company_expenses (owner_id, sin vessel_id).
import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { useLang } from "./i18n.jsx";
import { accountHasFleet } from "./plans.jsx";
import PurchaseMeta, { paymentSummary } from "./PaymentFields.jsx";

const CATEGORIES = [
  "Materiales y suministros", "Limpiezas", "Transporte y gasolina",
  "Comidas y representación", "Oficina", "Sueldos", "Marketing", "Seguros", "Impuestos", "Otro",
];
const CAT_COLORS = ["#534AB7","#1D9E75","#D85A30","#C2417A","#378ADD","#D4537E","#BA7517","#639922","#5F5E5A","#94a3b8"];

const money = (n) => "$" + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2});
const monthKey = (d) => String(d||"").slice(0,7);

export default function CompanyPage({ user, vessels }) {
  const { lang } = useLang();
  const L = (es,en)=>lang==="en"?en:es;
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);   // gasto en edición (solo si no está saldado)
  const [showCut, setShowCut]   = useState(false);
  const [copied, setCopied]     = useState("");
  const [splitPct, setSplitPct] = useState(50);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [month, setMonth]     = useState(new Date().toISOString().slice(0,7));
  const [form, setForm] = useState({
    category: CATEGORIES[0], description:"", payee:"", amount:"",
    date: new Date().toISOString().slice(0,10), recurring:false,
    purchased_by:"", payment_method:"", invoice_number:"",
    card_brand:"", card_last4:"", card_owner:"", receipt_urls:[],
  });
  const [uploading, setUploading] = useState(false);
  // Joana y Fernando comparten la MISMA empresa: si el usuario es co-gestor de una
  // flota ajena, los gastos de empresa viven bajo el dueño de esa flota.
  const [effOwner, setEffOwner] = useState(null);

  const isFleet = accountHasFleet(vessels);

  const resolveOwner = async () => {
    const { data } = await supabase.from("fleet_managers")
      .select("fleet_owner_id").eq("manager_id", user.id).eq("status","active").limit(1);
    const oid = data?.[0]?.fleet_owner_id || user.id;
    setEffOwner(oid); return oid;
  };

  const load = async (ownerId) => {
    const oid = ownerId || effOwner || await resolveOwner();
    setLoading(true);
    const { data, error } = await supabase.from("company_expenses")
      .select("*").eq("owner_id", oid).order("expense_date",{ascending:false});
    if (error) { setMsg(L("No se pudieron cargar los gastos: ","Couldn't load expenses: ")+error.message); }
    setRows(data||[]);
    setLoading(false);
  };
  useEffect(()=>{ resolveOwner().then(oid=>load(oid)); /* eslint-disable-next-line */ },[user?.id]);

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

    return { inMonth, total, thirdParty, delta, cats, payees };
  },[rows, month]);

  // Sugerencias de beneficiario: proveedores de la flota + ya usados
  const payeeSuggestions = useMemo(()=>{
    const fromProviders = (vessels?.[0]?.providers||[]).map(p=>p.company||`${p.firstName||""} ${p.lastName||""}`.trim()).filter(Boolean);
    const used = rows.map(r=>r.payee).filter(Boolean);
    return [...new Set([...fromProviders, ...used])].sort();
  },[vessels, rows]);

  const save = async () => {
    if (!form.amount || Number(form.amount)<=0) { setMsg(L("Indica el monto","Enter the amount")); setTimeout(()=>setMsg(""),3000); return; }
    setSaving(true);
    const payload = {
      category: form.category,
      description: form.description || null, payee: form.payee.trim() || null,
      amount: Number(form.amount), currency: "USD",
      expense_date: form.date, recurring: form.recurring,
      purchased_by: form.purchased_by || null,
      payment_method: form.payment_method || null,
      invoice_number: form.invoice_number || null,
      card_brand: form.payment_method==="Tarjeta" ? (form.card_brand||null) : null,
      card_last4: form.payment_method==="Tarjeta" ? (form.card_last4||null) : null,
      card_owner: form.payment_method==="Tarjeta" ? (form.card_owner||null) : null,
      receipt_urls: form.receipt_urls || [],
    };
    let error;
    if (editingId) {
      const res = await supabase.from("company_expenses").update(payload).eq("id", editingId).select();
      error = res.error || ((!res.data || !res.data.length) ? { message: L("no se encontró el gasto","expense not found") } : null);
    } else {
      const res = await supabase.from("company_expenses").insert({ owner_id: effOwner || user.id, ...payload });
      error = res.error;
    }
    setSaving(false);
    if (error) { setMsg("Error: "+error.message); setTimeout(()=>setMsg(""),4000); return; }
    setCreating(false); setEditingId(null);
    setForm({ category:CATEGORIES[0], description:"", payee:"", amount:"", date:new Date().toISOString().slice(0,10), recurring:false, purchased_by:"", payment_method:"", invoice_number:"", card_brand:"", card_last4:"", card_owner:"", receipt_urls:[] });
    load();
  };

  const uploadReceipts = async (files) => {
    setUploading(true);
    const urls = [...(form.receipt_urls||[])];
    for (const file of files) {
      const path = `facturas/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${file.name}`;
      const { error } = await supabase.storage.from("bitacora-fotos").upload(path, file);
      if (!error) {
        const { data: u } = supabase.storage.from("bitacora-fotos").getPublicUrl(path);
        if (u?.publicUrl) urls.push(u.publicUrl);
      } else { setMsg(L("No se pudo subir: ","Upload failed: ")+error.message); setTimeout(()=>setMsg(""),3500); }
    }
    setForm(f=>({ ...f, receipt_urls: urls }));
    setUploading(false);
  };

  const startEdit = (r) => {
    if (r.settled) return;   // lo saldado ya se cuadró con el socio: no se toca
    setForm({
      category: r.category || CATEGORIES[0], description: r.description || "",
      payee: r.payee || "", amount: String(r.amount ?? ""),
      date: r.expense_date, recurring: !!r.recurring,
      purchased_by: r.purchased_by || "", payment_method: r.payment_method || "",
      invoice_number: r.invoice_number || "", card_brand: r.card_brand || "",
      card_last4: r.card_last4 || "", card_owner: r.card_owner || "",
      receipt_urls: r.receipt_urls || [],
    });
    setEditingId(r.id); setCreating(true);
  };

  const toggleSettled = async (exp) => {
    const next = !exp.settled;
    const { data, error } = await supabase.from("company_expenses")
      .update({ settled: next }).eq("id", exp.id).select();
    if (error || !data?.length) { setMsg("Error: "+(error?.message||L("no se pudo actualizar","couldn't update"))); setTimeout(()=>setMsg(""),4000); return; }
    setRows(list=>list.map(x=>x.id===exp.id?{...x,settled:next}:x));
  };

  const markAllSettled = async () => {
    const pend = rows.filter(r=>!r.settled);
    if (!pend.length) return;
    if (!confirm(L(`¿Marcar ${pend.length} gasto(s) como saldados con tu socio?`,`Mark ${pend.length} expense(s) as settled with your partner?`))) return;
    const ids = pend.map(r=>r.id);
    const { error } = await supabase.from("company_expenses").update({ settled: true }).in("id", ids);
    if (error) { setMsg("Error: "+error.message); setTimeout(()=>setMsg(""),4000); return; }
    setRows(list=>list.map(x=>ids.includes(x.id)?{...x,settled:true}:x));
    setShowCut(false);
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
    <div style={{maxWidth:900,margin:"0 auto"}}>
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

      {/* Corte con el socio: todo lo no saldado, sin importar el mes */}
      {(()=>{
        const pend = rows.filter(r=>!r.settled);
        if (!pend.length) return null;
        const tot = pend.reduce((a,r)=>a+Number(r.amount||0),0);
        return (
          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:12,padding:"13px 15px",marginBottom:18,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:170}}>
              <div style={{fontSize:11,color:"#1d4ed8",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase"}}>{L("Por saldar con tu socio","To settle with your partner")}</div>
              <div style={{fontSize:12,color:"#1e40af",marginTop:2}}>{pend.length} {pend.length===1?L("gasto desde el último corte","expense since last settlement"):L("gastos desde el último corte","expenses since last settlement")}</div>
            </div>
            <div style={{fontSize:24,fontWeight:800,color:"#1d4ed8"}}>{money(tot)}</div>
            <button onClick={()=>setShowCut(true)}
              style={{padding:"8px 14px",background:"#1d4ed8",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
              {L("Hacer corte","Settle up")}
            </button>
          </div>
        );
      })()}

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
                      {r.shift_id && <span style={{marginLeft:6,fontSize:10,background:"#eff6ff",color:"#1e40af",borderRadius:20,padding:"2px 7px"}}>{L("agenda","schedule")}</span>}
                    </div>
                    <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {[r.payee, r.description, r.purchased_by?`${L("compró","by")}: ${r.purchased_by}`:null, paymentSummary(r, lang)||null, r.invoice_number?`#${r.invoice_number}`:null, new Date(r.expense_date+"T00:00:00").toLocaleDateString("en-US")].filter(Boolean).join(" · ")}
                    </div>
                    {Array.isArray(r.receipt_urls)&&r.receipt_urls.length>0 && (
                      <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                        {r.receipt_urls.map((ph,i)=>(
                          <a key={i} href={ph} target="_blank" rel="noreferrer"><img src={ph} alt="" style={{width:32,height:32,objectFit:"cover",borderRadius:6,border:"1px solid #e2e8f0"}}/></a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{money(r.amount)}</div>
                    <button onClick={()=>toggleSettled(r)}
                      title={r.settled ? L("Marcar como pendiente","Mark as pending") : L("Marcar como saldado","Mark as settled")}
                      style={{marginTop:3,padding:"2px 8px",borderRadius:20,border:"1px solid",cursor:"pointer",fontSize:10,fontWeight:700,
                        background:r.settled?"#f0fdf4":"#eff6ff",borderColor:r.settled?"#bbf7d0":"#bfdbfe",color:r.settled?"#15803d":"#1d4ed8"}}>
                      {r.settled ? `✓ ${L("Saldado","Settled")}` : L("Por saldar","To settle")}
                    </button>
                  </div>
                  {!r.settled && (
                    <button onClick={()=>startEdit(r)} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:13,padding:2}} title={L("Editar","Edit")}>✎</button>
                  )}
                  <button onClick={()=>del(r.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:15,padding:2}} title={L("Eliminar","Delete")}>×</button>
                </div>
              ))}
            </div>}
      </div>
      </>}

      {/* Modal: corte con el socio */}
      {showCut && (()=>{
        const pend = rows.filter(r=>!r.settled).sort((a,b)=>String(a.expense_date).localeCompare(String(b.expense_date)));
        const tot  = pend.reduce((a,r)=>a+Number(r.amount||0),0);
        const mine = tot*(splitPct/100), theirs = tot-mine;
        const fdate = (d)=>new Date(d+"T00:00:00").toLocaleDateString("en-US");
        const fix = (n)=>Number(n).toFixed(2);

        const plain=[
          `${L("Corte de gastos — The Boating Zone","Expense settlement — The Boating Zone")}`,
          `${L("Generado","Generated")}: ${new Date().toLocaleDateString("en-US")}`,"",
          ...pend.map(r=>`${fdate(r.expense_date)}  ${r.category}  ${[r.payee,r.description].filter(Boolean).join(" · ")||"—"}  $${fix(r.amount)}`),
          "", `${L("TOTAL","TOTAL")}: $${fix(tot)}`,
          `${L("Tu parte","Your share")} (${splitPct}%): $${fix(mine)}`,
          `${L("Parte del socio","Partner's share")} (${100-splitPct}%): $${fix(theirs)}`,
        ].join("\n");
        const tsv=[["Date","Category","Payee","Description","Payment","Invoice #","Bought by","Amount"].join("\t"),
          ...pend.map(r=>[fdate(r.expense_date),r.category,r.payee||"",(r.description||"").replace(/\t/g," "),paymentSummary(r,lang),r.invoice_number||"",r.purchased_by||"",fix(r.amount)].join("\t")),
          "", ["TOTAL","","","",fix(tot)].join("\t")].join("\n");
        const copy=(t,w)=>navigator.clipboard?.writeText(t)
          .then(()=>{setCopied(w);setTimeout(()=>setCopied(""),2000);})
          .catch(()=>{setCopied("err");setTimeout(()=>setCopied(""),2500);});

        return (
          <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:12,overflowY:"auto"}} onClick={()=>setShowCut(false)}>
            <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:640,width:"100%",maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{L("Corte con tu socio","Settle up with your partner")}</div>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{pend.length} {L("gastos","expenses")} · <strong style={{color:"#1d4ed8"}}>{money(tot)}</strong></div>
                </div>
                <button onClick={()=>setShowCut(false)} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
              </div>

              <div style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",marginBottom:12}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#f8fafc"}}>
                    {[L("Fecha","Date"),L("Categoría","Category"),L("Detalle","Detail"),L("Monto","Amount")].map((h,i)=>(
                      <th key={h} style={{textAlign:i===3?"right":"left",padding:"8px 10px",color:"#64748b",fontWeight:700,borderBottom:"1px solid #e2e8f0"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {pend.map(r=>(
                      <tr key={r.id}>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9",whiteSpace:"nowrap"}}>{fdate(r.expense_date)}</td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9"}}>{r.category}</td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9",color:"#475569"}}>{[r.payee,r.description].filter(Boolean).join(" · ")||"—"}</td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9",textAlign:"right",fontWeight:700,whiteSpace:"nowrap"}}>${fix(r.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{background:"#eff6ff"}}>
                      <td colSpan={3} style={{padding:"9px 10px",fontWeight:800,color:"#1e40af"}}>{L("TOTAL","TOTAL")}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontWeight:800,color:"#1d4ed8",whiteSpace:"nowrap"}}>${fix(tot)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{display:"flex",alignItems:"center",gap:10,background:"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:12,flexWrap:"wrap"}}>
                <div style={{fontSize:12,color:"#475569",fontWeight:600}}>{L("División","Split")}</div>
                <input type="number" min="0" max="100" value={splitPct} onChange={e=>setSplitPct(Math.max(0,Math.min(100,Number(e.target.value)||0)))}
                  style={{width:60,padding:"5px 8px",border:"1px solid #e2e8f0",borderRadius:7,fontSize:13,textAlign:"center"}}/>
                <div style={{fontSize:12,color:"#64748b"}}>% {L("tú","you")}</div>
                <div style={{flex:1,minWidth:160,display:"flex",gap:14,justifyContent:"flex-end",fontSize:13}}>
                  <div><span style={{color:"#94a3b8"}}>{L("Tú:","You:")}</span> <strong>${fix(mine)}</strong></div>
                  <div><span style={{color:"#94a3b8"}}>{L("Socio:","Partner:")}</span> <strong>${fix(theirs)}</strong></div>
                </div>
              </div>

              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>copy(tsv,"tsv")} style={{flex:1,minWidth:170,padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {copied==="tsv" ? `✓ ${L("Copiado","Copied")}` : L("Copiar como tabla","Copy as table")}
                </button>
                <button onClick={()=>copy(plain,"plain")} style={{flex:1,minWidth:150,padding:"11px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:9,color:"#334155",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {copied==="plain" ? `✓ ${L("Copiado","Copied")}` : L("Copiar como texto","Copy as text")}
                </button>
              </div>
              {copied==="err" && <div style={{fontSize:11,color:"#dc2626",marginTop:8}}>{L("No se pudo copiar. Selecciona la tabla y copia a mano.","Couldn't copy. Select the table and copy manually.")}</div>}

              <button onClick={markAllSettled}
                style={{width:"100%",marginTop:10,padding:"11px",background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:9,color:"#15803d",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                ✓ {L(`Ya cuadramos — marcar los ${pend.length} como saldados`,`We settled — mark all ${pend.length} as settled`)}
              </button>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:8,lineHeight:1.5}}>
                {L("El corte incluye todo lo no saldado, sin importar el mes. El texto copiado incluye la división entre socios.",
                   "The settlement includes everything unsettled, regardless of month. The copied text includes the partner split.")}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: nuevo gasto de empresa (no cierra al clic fuera) */}
      {creating && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:14,overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:440,width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{flex:1,fontSize:16,fontWeight:800,color:"#0f172a"}}>{editingId ? L("Editar gasto","Edit expense") : L("Gasto de empresa","Company expense")}</div>
              <button onClick={()=>{setCreating(false);setEditingId(null);}} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
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
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Método de pago","Payment method")}</label>
                <select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})} style={{...sel,width:"100%"}}>
                  <option value="">{L("Seleccionar...","Select...")}</option>
                  {["Efectivo","Tarjeta","Transferencia","Zelle","PayPal","Cheque","Otro"].map(pm=><option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
              <PurchaseMeta hideVendor
                value={{ invoice:form.invoice_number, cardBrand:form.card_brand, cardLast4:form.card_last4, cardOwner:form.card_owner }}
                onChange={patch=>setForm(f=>({ ...f,
                  ...(patch.invoice!==undefined?{invoice_number:patch.invoice}:{}),
                  ...(patch.cardBrand!==undefined?{card_brand:patch.cardBrand}:{}),
                  ...(patch.cardLast4!==undefined?{card_last4:patch.cardLast4}:{}),
                  ...(patch.cardOwner!==undefined?{card_owner:patch.cardOwner}:{}),
                }))}
                payment={form.payment_method} providers={(vessels?.[0]?.providers)||[]}/>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("¿Quién lo compró / gastó?","Who bought / spent it?")}</label>
                <input value={form.purchased_by} onChange={e=>setForm({...form,purchased_by:e.target.value})} placeholder={L("Nombre de la persona","Person's name")} style={{...sel,width:"100%",boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Fotos de la factura","Invoice photos")}</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {(form.receipt_urls||[]).map((ph,i)=>(
                    <div key={i} style={{position:"relative"}}>
                      <img src={ph} alt="" style={{width:52,height:52,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"}}/>
                      <button onClick={()=>setForm(f=>({...f,receipt_urls:f.receipt_urls.filter((_,ix)=>ix!==i)}))}
                        style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",border:"none",background:"#dc2626",color:"#fff",fontSize:11,lineHeight:1,cursor:"pointer",padding:0}}>×</button>
                    </div>
                  ))}
                  <label style={{width:52,height:52,border:"1.5px dashed #cbd5e1",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#94a3b8",fontSize:20}}>
                    {uploading ? "…" : "+"}
                    <input type="file" accept="image/*" multiple style={{display:"none"}}
                      onChange={e=>{ if(e.target.files?.length) uploadReceipts([...e.target.files]); e.target.value=""; }}/>
                  </label>
                </div>
              </div>

              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})}/>
                <span style={{fontSize:12,color:"#475569"}}>{L("Es un gasto fijo mensual","It's a fixed monthly expense")}</span>
              </label>

              <button onClick={save} disabled={saving} style={{padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:saving?0.6:1}}>
                {saving ? L("Guardando...","Saving...") : (editingId ? L("Guardar cambios","Save changes") : L("Guardar gasto","Save expense"))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
