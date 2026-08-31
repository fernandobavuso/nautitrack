import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { jsPDF } from "jspdf";
import PurchaseMeta, { paymentSummary, photoUrl } from "./PaymentFields.jsx";
import { hasFeature, PremiumLock, accountHasFleet } from "./plans.jsx";

const CATEGORIES = ["Combustible","Consumibles","Mantenimiento","Reparación","Repuestos","Sueldos","Marina","Seguro","Impuestos","Otro"];
const CAT_COLORS = {
  "Consumibles":"#0d9488",
  Combustible:"#0ea5e9", Mantenimiento:"#2563eb", "Reparación":"#dc2626",
  Repuestos:"#7c3aed", Sueldos:"#16a34a", Marina:"#d97706",
  Seguro:"#0891b2", Impuestos:"#be185d", Otro:"#64748b",
};

export default function CostsPage({ vessel, vessels, user, setShowProfile, onRegisterExpense }) {
  const { t, lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [period, setPeriod] = useState("month"); // month / year / all
  const [showHelp, setShowHelp] = useState(true);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    category:"Combustible", description:"", amount:"", currency:"USD",
    expense_date:new Date().toISOString().slice(0,10), recurring:false,
  });

  const allowed = hasFeature(vessel, "costs") || accountHasFleet(vessels);
  const isFleetManager = accountHasFleet(vessels);
  const [showReimb, setShowReimb] = useState(false);
  const [copied, setCopied]       = useState("");
  const [editExp, setEditExp]     = useState(null);   // gasto en edición
  const [uploading, setUploading] = useState(false);
  const [pdfBusy, setPdfBusy]     = useState(false);

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
      reimbursable: isFleetManager ? form.reimbursable : false,
      reimbursed: false,
    });
    if (error) { setMsg("Error: "+error.message); }
    else {
      setMsg("Gasto registrado");
      setForm({category:"Combustible",description:"",amount:"",currency:"USD",expense_date:new Date().toISOString().slice(0,10),recurring:false,reimbursable:false});
      setCreating(false); loadExpenses();
    }
    setTimeout(()=>setMsg(""),3000);
  };

  const del = async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    loadExpenses();
  };

  // Marcar un gasto adelantado como cobrado (o volver a pendiente)
  const uploadReceipts = async (files) => {
    setUploading(true);
    const urls = [...(editExp.receipt_urls||[])];
    for (const file of files) {
      const path = `facturas/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${file.name}`;
      const { error } = await supabase.storage.from("bitacora-fotos").upload(path, file);
      if (!error) {
        const { data: u } = supabase.storage.from("bitacora-fotos").getPublicUrl(path);
        if (u?.publicUrl) urls.push(u.publicUrl);
      } else { setMsg(L("No se pudo subir: ","Upload failed: ")+error.message); setTimeout(()=>setMsg(""),3500); }
    }
    setEditExp(x=>({ ...x, receipt_urls: urls }));
    setUploading(false);
  };

  const saveEdit = async () => {
    const e = editExp;
    if (!e.amount || Number(e.amount)<=0) { setMsg(L("Indica el monto","Enter the amount")); setTimeout(()=>setMsg(""),3000); return; }
    const { data, error } = await supabase.from("expenses").update({
      category: e.category, description: e.description||null, amount: Number(e.amount),
      expense_date: e.expense_date, purchased_by: e.purchased_by||null,
      receipt_urls: e.receipt_urls||[],
      payment_method: e.payment_method||null,
      vendor: e.vendor||null, invoice_number: e.invoice_number||null,
      card_brand: e.payment_method==="Tarjeta"?(e.card_brand||null):null,
      card_last4: e.payment_method==="Tarjeta"?(e.card_last4||null):null,
      card_owner: e.payment_method==="Tarjeta"?(e.card_owner||null):null,
    }).eq("id", e.id).select();
    if (error || !data?.length) { setMsg("Error: "+(error?.message||L("no se guardó","not saved"))); setTimeout(()=>setMsg(""),4000); return; }
    setExpenses(list=>list.map(x=>x.id===e.id?{...x,...data[0]}:x));
    setEditExp(null);
  };

  // PDF con todas las fotos de factura de los gastos pendientes de reembolso,
  // una por página con fecha/categoría/monto, para adjuntar al correo del dueño.
  const exportReceiptsPDF = async (pendList) => {
    const withPhotos = pendList.filter(e=>Array.isArray(e.receipt_urls)&&e.receipt_urls.length);
    if (!withPhotos.length) { setMsg(L("Ninguno de estos gastos tiene fotos.","None of these expenses has photos.")); setTimeout(()=>setMsg(""),3500); return; }
    setPdfBusy(true);
    try {
      const pdf = new jsPDF({ unit:"pt", format:"letter" });
      const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
      let first = true;
      for (const e of withPhotos) {
        for (const raw of e.receipt_urls) {
          const url = photoUrl(raw);
          if (!url) continue;
          const dataUrl = await fetch(url).then(r=>r.blob()).then(b=>new Promise(res=>{
            const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(b);
          })).catch(()=>null);
          if (!dataUrl) continue;
          const img = await new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=dataUrl; });
          if (!img) continue;
          if (!first) pdf.addPage(); first=false;
          pdf.setFontSize(11); pdf.setTextColor(60);
          pdf.text(`${new Date(e.expense_date+"T00:00:00").toLocaleDateString("en-US")}  ·  ${e.category}  ·  $${Number(e.amount).toFixed(2)}${e.purchased_by?`  ·  ${e.purchased_by}`:""}`, 40, 36);
          if (e.description) { pdf.setFontSize(9); pdf.setTextColor(120); pdf.text(String(e.description).slice(0,110), 40, 52); }
          const maxW=W-80, maxH=H-110;
          const r=Math.min(maxW/img.width, maxH/img.height, 1);
          const w=img.width*r, h=img.height*r;
          const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          pdf.addImage(dataUrl, fmt, (W-w)/2, 66, w, h);
        }
      }
      if (first) { setMsg(L("No se pudieron cargar las fotos.","Couldn't load the photos.")); setTimeout(()=>setMsg(""),3500); }
      else pdf.save(`facturas_reembolso_${vessel.name.replace(/\s+/g,"_")}.pdf`);
    } catch (err) {
      setMsg("Error PDF: "+err.message); setTimeout(()=>setMsg(""),4000);
    }
    setPdfBusy(false);
  };

  const toggleReimbursed = async (exp) => {
    const next = !exp.reimbursed;
    const { data, error } = await supabase.from("expenses")
      .update({ reimbursed: next }).eq("id", exp.id).select();
    if (error) { setMsg("Error: " + error.message); setTimeout(()=>setMsg(""),4000); return; }
    if (!data || data.length === 0) { setMsg(L("No se pudo actualizar el gasto","Could not update the expense")); setTimeout(()=>setMsg(""),4000); return; }
    setExpenses(list => list.map(x => x.id===exp.id ? { ...x, reimbursed: next } : x));
    setMsg(next ? L("Marcado como cobrado","Marked as reimbursed") : L("Marcado como pendiente","Marked as pending"));
    setTimeout(()=>setMsg(""),2500);
  };

  // Marcar TODOS los pendientes como cobrados de una vez
  const markAllReimbursed = async () => {
    const pend = expenses.filter(e=>e.reimbursable && !e.reimbursed);
    if (!pend.length) return;
    if (!confirm(L(`¿Marcar ${pend.length} gasto(s) como cobrados?`,`Mark ${pend.length} expense(s) as reimbursed?`))) return;
    const ids = pend.map(e=>e.id);
    const { error } = await supabase.from("expenses").update({ reimbursed: true }).in("id", ids);
    if (error) { setMsg("Error: " + error.message); setTimeout(()=>setMsg(""),4000); return; }
    setExpenses(list => list.map(x => ids.includes(x.id) ? { ...x, reimbursed: true } : x));
    setShowReimb(false);
    setMsg(L("Reembolso saldado","Reimbursement settled"));
    setTimeout(()=>setMsg(""),2500);
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
  const totalUSD = filtered.filter(e=>e.currency!=="VES").reduce((a,e)=>a+Number(e.amount),0);

  // Desglose por categoría (solo USD para el gráfico, simplificado)
  const byCat = {};
  filtered.forEach(e => { byCat[e.category] = (byCat[e.category]||0) + (e.currency==="USD"?Number(e.amount):0); });
  const catEntries = Object.entries(byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const maxCat = Math.max(...catEntries.map(([,v])=>v), 1);

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:"#0f172a",fontFamily:"'Sora',system-ui,sans-serif"}}>{t("fin.title")} — {vessel.name}</div>
          <div style={{fontSize:13,color:"#64748b"}}>{t("fin.subtitle")}</div>
        </div>
        <button onClick={()=>onRegisterExpense?onRegisterExpense():setCreating(true)} style={{padding:"10px 18px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          {t("fin.register")}
        </button>
      </div>

      {/* Panel explicativo: quién anota qué */}
      {showHelp && (
        <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:"14px 16px",marginBottom:16,position:"relative"}}>
          <button onClick={()=>setShowHelp(false)} style={{position:"absolute",top:10,right:12,background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16}}>×</button>
          <div style={{fontSize:13,fontWeight:700,color:"#0369a1",marginBottom:8}}>{L("¿Cómo se llenan los costos?","How are costs recorded?")}</div>
          <div style={{fontSize:12,color:"#475569",lineHeight:1.6}}>
            Hay dos formas de que un gasto llegue aquí, y las dos terminan en esta misma lista:
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{fontSize:9,background:"#eff6ff",color:"#2563eb",padding:"2px 7px",borderRadius:10,fontWeight:700,whiteSpace:"nowrap",marginTop:1}}>desde bitácora</span>
                <span>{L("Cuando el capitán (o quien esté a bordo) registra una ","When the captain (or whoever is aboard) records a ")}<strong>compra</strong> en la Bitácora, ese gasto aparece aquí solo. No hay que anotarlo dos veces.</span>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{fontSize:9,background:"#f1f5f9",color:"#64748b",padding:"2px 7px",borderRadius:10,fontWeight:700,whiteSpace:"nowrap",marginTop:1}}>directo</span>
                <span>{L('Gastos que no son compras del barco (seguro, marina, sueldos...) los registras tú aquí con "Registrar gasto".','Expenses that are not boat purchases (insurance, marina, payroll...) you record here with "Record expense".')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selector de periodo */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[{k:"month",l:t("fin.thisMonth")},{k:"year",l:t("fin.thisYear")},{k:"all",l:t("tasks.all")}].map(p=>(
          <button key={p.k} onClick={()=>setPeriod(p.k)} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"1.5px solid",
            background:period===p.k?"#eff6ff":"#fff", borderColor:period===p.k?"#2563eb":"#e2e8f0",
            color:period===p.k?"#2563eb":"#64748b",
          }}>{p.l}</button>
        ))}
      </div>

      {/* Total */}
      <div style={{marginBottom:20}}>
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:6}}>{L("TOTAL","TOTAL")}</div>
          <div style={{fontSize:26,fontWeight:800,color:"#0f172a"}}>$ {totalUSD.toLocaleString("en-US",{maximumFractionDigits:2})}</div>
        </div>
      </div>

      {/* Desglose por categoría */}
      {catEntries.length>0&&(
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:18,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:14}}>{L("Desglose por categoría (USD)","Breakdown by category (USD)")}</div>
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
      {isFleetManager && (() => {
        const pend = expenses.filter(e=>e.reimbursable && !e.reimbursed);
        const total = pend.reduce((a,e)=>a+Number(e.amount||0),0);
        if (!pend.length) return null;
        return (
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"13px 15px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:170}}>
              <div style={{fontSize:11,color:"#a16207",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase"}}>{L("Pendiente de reembolso","Pending reimbursement")}</div>
              <div style={{fontSize:12,color:"#92400e",marginTop:2}}>{pend.length} {pend.length===1?L("gasto que adelantaste","expense you advanced"):L("gastos que adelantaste","expenses you advanced")}</div>
            </div>
            <div style={{fontSize:24,fontWeight:800,color:"#b45309"}}>${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <button onClick={()=>setShowReimb(true)}
              style={{padding:"8px 14px",background:"#b45309",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
              {L("Ver resumen","View summary")}
            </button>
          </div>
        );
      })()}

      <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>{L("Movimientos","Transactions")}</div>
      {loading&&<div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>{L("Cargando...","Loading...")}</div>}
      {!loading&&filtered.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
          <div style={{fontWeight:600}}>{t("fin.empty")}</div>
          <div style={{fontSize:12,marginTop:4}}>{L("Registra el primer gasto de tu barco","Record your boat's first expense")}</div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(e=>(
          <div key={e.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:4,height:36,borderRadius:2,background:CAT_COLORS[e.category]||"#64748b",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{e.category}{e.recurring?" · fijo mensual":""}{e.source==="log"?<span title="Este gasto viene de una compra registrada en la Bitácora. No se anota dos veces." style={{marginLeft:6,fontSize:9,background:"#eff6ff",color:"#2563eb",padding:"2px 7px",borderRadius:10,fontWeight:700,verticalAlign:"middle",cursor:"help"}}>desde bitácora</span>:""}</div>
              <div style={{fontSize:11,color:"#64748b"}}>
                {[e.description||L("Sin descripción","No description"), e.vendor||null, e.purchased_by ? `${L("compró","bought by")}: ${e.purchased_by}` : null, paymentSummary(e, lang)||null, e.invoice_number?`#${e.invoice_number}`:null, new Date(e.expense_date).toLocaleDateString("en-US")].filter(Boolean).join(" · ")}
              </div>
              {Array.isArray(e.receipt_urls)&&e.receipt_urls.length>0 && (
                <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                  {e.receipt_urls.map((ph,i)=>(
                    <a key={i} href={photoUrl(ph)} target="_blank" rel="noreferrer" title={L("Ver factura","View invoice")}>
                      <img src={photoUrl(ph)} alt="" style={{width:34,height:34,objectFit:"cover",borderRadius:6,border:"1px solid #e2e8f0"}}/>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>
                $ {Number(e.amount).toLocaleString("en-US",{maximumFractionDigits:2})}
              </div>
              {isFleetManager && e.reimbursable && (
                <button onClick={()=>toggleReimbursed(e)}
                  title={e.reimbursed ? L("Marcar como pendiente","Mark as pending") : L("Marcar como cobrado","Mark as reimbursed")}
                  style={{marginTop:3,padding:"2px 8px",borderRadius:20,border:"1px solid",cursor:"pointer",fontSize:10,fontWeight:700,
                    background:e.reimbursed?"#f0fdf4":"#fffbeb",borderColor:e.reimbursed?"#bbf7d0":"#fde68a",color:e.reimbursed?"#15803d":"#92400e"}}>
                  {e.reimbursed ? `✓ ${L("Cobrado","Reimbursed")}` : L("Por cobrar","To bill")}
                </button>
              )}
            </div>
            <button onClick={()=>setEditExp({...e, receipt_urls: e.receipt_urls||[]})} title={L("Editar","Edit")} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:13}}>✎</button>
            <button onClick={()=>del(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#cbd5e1",fontSize:16}}>×</button>
          </div>
        ))}
      </div>

      {/* Editar gasto */}
      {editExp && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2100,padding:14,overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:440,width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{flex:1,fontSize:16,fontWeight:800,color:"#0f172a"}}>{L("Editar gasto","Edit expense")}</div>
              <button onClick={()=>setEditExp(null)} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
            </div>
            {editExp.source==="log" && (
              <div style={{fontSize:11,color:"#0369a1",background:"#f0f9ff",borderRadius:8,padding:"7px 10px",marginBottom:10}}>
                {L("Este gasto viene de la bitácora. Editarlo aquí no cambia la entrada de bitácora.","This expense comes from the logbook. Editing here doesn't change the log entry.")}
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Categoría","Category")}</label>
                <select value={editExp.category} onChange={ev=>setEditExp(x=>({...x,category:ev.target.value}))} style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Descripción","Description")}</label>
                <input value={editExp.description||""} onChange={ev=>setEditExp(x=>({...x,description:ev.target.value}))} style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Monto (USD)","Amount (USD)")}</label>
                  <input type="number" min="0" step="0.01" value={editExp.amount} onChange={ev=>setEditExp(x=>({...x,amount:ev.target.value}))} style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Fecha","Date")}</label>
                  <input type="date" value={editExp.expense_date} onChange={ev=>setEditExp(x=>({...x,expense_date:ev.target.value}))} style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Método de pago","Payment method")}</label>
                <select value={editExp.payment_method||""} onChange={ev=>setEditExp(x=>({...x,payment_method:ev.target.value}))} style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}>
                  <option value="">{L("Seleccionar...","Select...")}</option>
                  {["Efectivo","Tarjeta","Transferencia","Zelle","PayPal","Cheque","Otro"].map(pm=><option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
              <PurchaseMeta
                value={{ vendor:editExp.vendor||"", invoice:editExp.invoice_number||"", cardBrand:editExp.card_brand||"", cardLast4:editExp.card_last4||"", cardOwner:editExp.card_owner||"" }}
                onChange={patch=>setEditExp(x=>({ ...x,
                  ...(patch.vendor!==undefined?{vendor:patch.vendor}:{}),
                  ...(patch.invoice!==undefined?{invoice_number:patch.invoice}:{}),
                  ...(patch.cardBrand!==undefined?{card_brand:patch.cardBrand}:{}),
                  ...(patch.cardLast4!==undefined?{card_last4:patch.cardLast4}:{}),
                  ...(patch.cardOwner!==undefined?{card_owner:patch.cardOwner}:{}),
                }))}
                payment={editExp.payment_method} providers={(vessels?.[0]?.providers)||[]} compact/>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("¿Quién lo compró?","Who bought it?")}</label>
                <input value={editExp.purchased_by||""} onChange={ev=>setEditExp(x=>({...x,purchased_by:ev.target.value}))} style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",display:"block",marginBottom:4}}>{L("Fotos de la factura / repuesto","Invoice / part photos")}</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {(editExp.receipt_urls||[]).map((ph,i)=>(
                    <div key={i} style={{position:"relative"}}>
                      <img src={photoUrl(ph)} alt="" style={{width:56,height:56,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"}}/>
                      <button onClick={()=>setEditExp(x=>({...x,receipt_urls:x.receipt_urls.filter((_,ix)=>ix!==i)}))}
                        style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",border:"none",background:"#dc2626",color:"#fff",fontSize:11,lineHeight:1,cursor:"pointer",padding:0}}>×</button>
                    </div>
                  ))}
                  <label style={{width:56,height:56,border:"1.5px dashed #cbd5e1",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#94a3b8",fontSize:22}}>
                    {uploading ? "…" : "+"}
                    <input type="file" accept="image/*" multiple style={{display:"none"}}
                      onChange={ev=>{ if(ev.target.files?.length) uploadReceipts([...ev.target.files]); ev.target.value=""; }}/>
                  </label>
                </div>
              </div>
              <button onClick={saveEdit} disabled={uploading}
                style={{padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:uploading?0.6:1}}>
                {L("Guardar cambios","Save changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de reembolsos para copiar a QuickBooks */}
      {showReimb && (() => {
        const pend  = expenses.filter(e=>e.reimbursable && !e.reimbursed)
                              .sort((a,b)=>String(a.expense_date).localeCompare(String(b.expense_date)));
        const total = pend.reduce((a,e)=>a+Number(e.amount||0),0);
        const money = (n)=>Number(n).toFixed(2);
        const fdate = (d)=>new Date(d+"T00:00:00").toLocaleDateString("en-US");

        // Texto plano, una línea por gasto
        const plain = [
          `${L("Reembolso","Reimbursement")} — ${vessel.name}`,
          `${L("Generado","Generated")}: ${new Date().toLocaleDateString("en-US")}`,
          "",
          ...pend.map(e=>`${fdate(e.expense_date)}  ${e.category}  ${[e.description||L("Sin descripción","No description"), e.vendor, paymentSummary(e, lang), e.invoice_number?`#${e.invoice_number}`:null].filter(Boolean).join(" · ")}  $${money(e.amount)}`),
          "",
          `${L("TOTAL","TOTAL")}: $${money(total)}`,
        ].join("\n");

        // Formato tabla (pegar en Excel/QuickBooks: columnas separadas por tabulador)
        const tsv = [
          ["Date","Category","Description","Vendor","Payment","Invoice #","Bought by","Amount"].join("\t"),
          ...pend.map(e=>[
            fdate(e.expense_date), e.category, (e.description||"").replace(/\t/g," "),
            e.vendor||"", paymentSummary(e, lang), e.invoice_number||"", e.purchased_by||"",
            money(e.amount),
          ].join("\t")),
        ].join("\n");

        const copy = (text, which) => {
          navigator.clipboard?.writeText(text)
            .then(()=>{ setCopied(which); setTimeout(()=>setCopied(""),2000); })
            .catch(()=>{ setCopied("err"); setTimeout(()=>setCopied(""),2500); });
        };

        return (
          <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:12,overflowY:"auto"}} onClick={()=>setShowReimb(false)}>
            <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:620,width:"100%",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{L("Resumen de reembolso","Reimbursement summary")}</div>
                  <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{vessel.name} · {pend.length} {L("gastos","expenses")} · <strong style={{color:"#b45309"}}>${money(total)}</strong></div>
                </div>
                <button onClick={()=>setShowReimb(false)} style={{background:"none",border:"none",fontSize:20,color:"#94a3b8",cursor:"pointer",lineHeight:1}}>✕</button>
              </div>

              <div style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",marginBottom:12}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#f8fafc"}}>
                    {[L("Fecha","Date"),L("Categoría","Category"),L("Descripción","Description"),L("Monto","Amount")].map(h=>(
                      <th key={h} style={{textAlign:h===L("Monto","Amount")?"right":"left",padding:"8px 10px",color:"#64748b",fontWeight:700,borderBottom:"1px solid #e2e8f0"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {pend.map(e=>(
                      <tr key={e.id}>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9",whiteSpace:"nowrap"}}>{fdate(e.expense_date)}</td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9"}}>{e.category}</td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9",color:"#475569"}}>{e.description||"—"}</td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #f1f5f9",textAlign:"right",fontWeight:700,whiteSpace:"nowrap"}}>${money(e.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{background:"#fffbeb"}}>
                      <td colSpan={3} style={{padding:"9px 10px",fontWeight:800,color:"#92400e"}}>{L("TOTAL","TOTAL")}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontWeight:800,color:"#b45309",whiteSpace:"nowrap"}}>${money(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>copy(tsv,"tsv")} style={{flex:1,minWidth:180,padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {copied==="tsv" ? `✓ ${L("Copiado","Copied")}` : L("Copiar como tabla (Excel/QuickBooks)","Copy as table (Excel/QuickBooks)")}
                </button>
                <button onClick={()=>copy(plain,"plain")} style={{flex:1,minWidth:150,padding:"11px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:9,color:"#334155",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {copied==="plain" ? `✓ ${L("Copiado","Copied")}` : L("Copiar como texto","Copy as text")}
                </button>
                <button onClick={()=>exportReceiptsPDF(pend)} disabled={pdfBusy}
                  style={{flex:1,minWidth:170,padding:"11px",background:"#fff",border:"1.5px solid #fca5a5",borderRadius:9,color:"#b91c1c",fontSize:13,fontWeight:700,cursor:"pointer",opacity:pdfBusy?0.6:1}}>
                  {pdfBusy ? L("Generando...","Generating...") : `📄 ${L("Fotos en PDF","Photos as PDF")}`}
                </button>
              </div>
              {copied==="err" && <div style={{fontSize:11,color:"#dc2626",marginTop:8}}>{L("No se pudo copiar. Selecciona la tabla y copia a mano.","Couldn't copy. Select the table and copy manually.")}</div>}

              <button onClick={markAllReimbursed}
                style={{width:"100%",marginTop:10,padding:"11px",background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:9,color:"#15803d",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                ✓ {L(`Ya me pagaron — marcar los ${pend.length} como cobrados`,`I've been paid — mark all ${pend.length} as reimbursed`)}
              </button>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:10,lineHeight:1.5}}>
                {L("La opción de tabla pega cada dato en su columna. También puedes marcar los gastos uno a uno con su etiqueta 'Por cobrar'.",
                   "The table option pastes each value into its own column. You can also mark expenses one by one with their 'To bill' tag.")}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal registrar gasto */}
      {creating&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}}>
          <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:420,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:16}}>{L("Registrar gasto","Record expense")}</div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>{L("Categoría","Category")}</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={inp}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>{L("Descripción","Description")}</label>
              <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={L("Ej: Cambio de aceite motor estribor","e.g. Starboard engine oil change")} style={inp}/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>{L("Monto (USD)","Amount (USD)")}</label>
              <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0" style={inp}/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={lbl}>{L("Fecha","Date")}</label>
              <input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} style={inp}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" id="recurring" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})} style={{width:15,height:15}}/>
              <label htmlFor="recurring" style={{fontSize:12,color:"#475569",cursor:"pointer"}}>{L("Es un gasto fijo mensual (sueldo, marina, seguro)","It's a fixed monthly expense (payroll, marina, insurance)")}</label>
            </div>

            {isFleetManager && (
            <div style={{display:"flex",alignItems:"center",gap:8,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"9px 11px"}}>
              <input type="checkbox" id="reimbursable" checked={form.reimbursable} onChange={e=>setForm({...form,reimbursable:e.target.checked})} style={{width:15,height:15}}/>
              <label htmlFor="reimbursable" style={{fontSize:12,color:"#92400e",cursor:"pointer",flex:1}}>
                <strong>{L("Lo pagué yo — cobrar al dueño","I paid it — bill the owner")}</strong>
                <div style={{fontSize:11,color:"#a16207",marginTop:2}}>{L("Aparecerá como pendiente de reembolso","It will show as pending reimbursement")}</div>
              </label>
            </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setCreating(false)} style={{flex:1,padding:"11px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>{L("Cancelar","Cancel")}</button>
              <button onClick={save} style={{flex:2,padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{L("Guardar gasto","Save expense")}</button>
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
