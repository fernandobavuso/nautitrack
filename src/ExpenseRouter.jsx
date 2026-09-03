import { useState } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { accountHasFleet } from "./plans.jsx";
import PurchaseMeta, { EXPENSE_CATEGORIES } from "./PaymentFields.jsx";

// Modal "Registrar gasto": hace UNA pregunta simple (¿compra del día o gasto fijo?)
// y enruta al lugar correcto. El usuario no tiene que saber la teoría de
// Bitácora vs Costos — solo responde qué tipo de gasto es.
export default function ExpenseRouter({ vessel, vessels, user, onClose, onLogPurchase, onDirectExpense }) {
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const isFleetManager = accountHasFleet(vessels);
  const { t } = useLang();
  const [step, setStep] = useState("choose"); // choose | operational | admin
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Formulario compra operacional (va a bitácora)
  const [op, setOp] = useState({ item:"", amount:"", currency:"USD", payment:"Zelle", date:new Date().toISOString().slice(0,10), by:"", reimbursable:false, isPart:false, brand:"", model2:"", partNum:"", cat:"Repuestos" });
  const [opMeta, setOpMeta]       = useState({});
  const [admMeta, setAdmMeta]     = useState({});
  const [opPhotos, setOpPhotos]   = useState([]);
  const [admPhotos, setAdmPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  // Formulario gasto administrativo (va directo a costos)
  const [adm, setAdm] = useState({ category:"Seguro", description:"", amount:"", currency:"USD", date:new Date().toISOString().slice(0,10), recurring:false, reimbursable:false, by:"", payment:"" });

  // Fotos de factura: mismo balde que la bitácora
  const uploadPhotos = async (files, setter, current) => {
    setUploading(true);
    const uploaded = [...current];
    for (const file of files) {
      const path = `facturas/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2,7)}_${file.name}`;
      const { error } = await supabase.storage.from("bitacora-fotos").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("bitacora-fotos").getPublicUrl(path);
        if (urlData?.publicUrl) uploaded.push(urlData.publicUrl);
      } else { setMsg(L("No se pudo subir una foto: ","Couldn't upload a photo: ")+error.message); }
    }
    setter(uploaded); setUploading(false);
  };

  const PhotoRow = ({ photos, setter }) => (
    <div style={{marginBottom:10}}>
      <label style={lbl}>{L("Fotos de la factura","Invoice photos")}</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {photos.map((ph,i)=>(
          <div key={i} style={{position:"relative"}}>
            <img src={ph} alt="" style={{width:52,height:52,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"}}/>
            <button onClick={()=>setter(photos.filter((_,x)=>x!==i))}
              style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",border:"none",background:"#dc2626",color:"#fff",fontSize:11,lineHeight:1,cursor:"pointer",padding:0}}>×</button>
          </div>
        ))}
        <label style={{width:52,height:52,border:"1.5px dashed #cbd5e1",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#94a3b8",fontSize:20}}>
          {uploading ? "…" : "+"}
          <input type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={e=>{ if(e.target.files?.length) uploadPhotos([...e.target.files], setter, photos); e.target.value=""; }}/>
        </label>
      </div>
    </div>
  );

  const saveOperational = async () => {
    if (!op.item.trim() || !op.amount) { setMsg("Completa qué compraste y el monto"); return; }
    setSaving(true);
    // Se registra como entrada de bitácora tipo Compra (fluye a Costos solo)
    const entry = {
      type:"Compra", item:op.item.trim(), desc:"",
      costUSD: op.currency==="USD"?Number(op.amount):null,
      costBs: op.currency==="VES"?Number(op.amount):null,
      payment: op.payment, date: op.date, performedBy: op.by || null, photos: opPhotos,
      expCategory: op.cat,
      vendor: opMeta.vendor||null, invoiceNumber: opMeta.invoice||null,
      cardBrand: op.payment==="Tarjeta" ? (opMeta.cardBrand||null) : null,
      cardLast4: op.payment==="Tarjeta" ? (opMeta.cardLast4||null) : null,
      cardOwner: op.payment==="Tarjeta" ? (opMeta.cardOwner||null) : null,
      ...(op.isPart ? { brand: op.brand||null, model2: op.model2||null, partNum: op.partNum||null } : {}),
      reimbursable: isFleetManager ? op.reimbursable : false,
    };
    try { await onLogPurchase(entry); onClose(); }
    catch(e){ setMsg("Error: "+e.message); setSaving(false); }
  };

  const saveAdmin = async () => {
    if (!adm.amount) { setMsg("Indica el monto"); return; }
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      vessel_id: vessel.id, owner_id: user.id,
      category: adm.category, description: adm.description,
      amount: Number(adm.amount), currency: adm.currency,
      expense_date: adm.date, recurring: adm.recurring, source:"direct",
      reimbursable: isFleetManager ? adm.reimbursable : false, reimbursed: false,
      purchased_by: adm.by || null, receipt_urls: admPhotos,
      payment_method: adm.payment || null,
      vendor: admMeta.vendor||null, invoice_number: admMeta.invoice||null,
      card_brand: adm.payment==="Tarjeta" ? (admMeta.cardBrand||null) : null,
      card_last4: adm.payment==="Tarjeta" ? (admMeta.cardLast4||null) : null,
      card_owner: adm.payment==="Tarjeta" ? (admMeta.cardOwner||null) : null,
    });
    if (error) { setMsg("Error: "+error.message); setSaving(false); return; }
    onDirectExpense && onDirectExpense();
    onClose();
  };

  return (
    <div style={ov} onClick={onClose}>
      <div style={box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>{t("exp.title")}</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>×</button>
        </div>

        {step==="choose" && (
          <>
            <div style={{fontSize:13,color:"#64748b",marginBottom:18,lineHeight:1.5}}>{t("exp.question")}</div>
            <button onClick={()=>{setStep("operational");setMsg("");}} style={choiceBtn}>
              <div style={{fontSize:22,marginBottom:6}}>🛒</div>
              <div style={{fontSize:15,fontWeight:700,color:"#0a2540"}}>{t("exp.opTitle")}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:4,lineHeight:1.4}}>{t("exp.opBody")}</div>
              <div style={{fontSize:11,color:"#2563eb",fontWeight:600,marginTop:8}}>{t("exp.opGoes")}</div>
            </button>
            <button onClick={()=>{setStep("admin");setMsg("");}} style={{...choiceBtn,marginTop:12}}>
              <div style={{fontSize:22,marginBottom:6}}>📋</div>
              <div style={{fontSize:15,fontWeight:700,color:"#0a2540"}}>{t("exp.admTitle")}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:4,lineHeight:1.4}}>{t("exp.admBody")}</div>
              <div style={{fontSize:11,color:"#2563eb",fontWeight:600,marginTop:8}}>{t("exp.admGoes")}</div>
            </button>
          </>
        )}

        {step==="operational" && (
          <>
            <button onClick={()=>setStep("choose")} style={backBtn}>← Volver</button>
            <div style={{fontSize:12,color:"#0369a1",background:"#f0f9ff",padding:"8px 12px",borderRadius:8,marginBottom:14,lineHeight:1.4}}>{L("Esta compra se registra en la Bitácora y su monto aparecerá solo en Finanzas. No la anotas dos veces.","This purchase is recorded in the Logbook and its amount appears only in Finance. You don't enter it twice.")}</div>
            <label style={lbl}>{L("¿Qué se compró?","What was purchased?")}</label>
            <input value={op.item} onChange={e=>setOp({...op,item:e.target.value})} placeholder={L("Ej: Filtro de aceite, combustible...","e.g. Oil filter, fuel...")} style={inp}/>
            <div style={{marginBottom:10}}><label style={lbl}>{L("Categoría del gasto","Expense category")}</label>
              <select value={op.cat} onChange={e=>setOp({...op,cat:e.target.value})} style={{...inp,width:"100%"}}>
                {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><label style={lbl}>{L("Monto (USD)","Amount (USD)")}</label><input type="number" value={op.amount} onChange={e=>setOp({...op,amount:e.target.value})} placeholder="0" style={inp}/></div>
              <div style={{flex:1}}><label style={lbl}>{L("Pago","Payment")}</label><select value={op.payment} onChange={e=>setOp({...op,payment:e.target.value})} style={inp}><option>Zelle</option><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></div>
            </div>
            <div><label style={lbl}>{L("Fecha","Date")}</label><input type="date" value={op.date} onChange={e=>setOp({...op,date:e.target.value})} style={inp}/></div>
            <div style={{marginBottom:10}}><label style={lbl}>{L("¿Quién lo compró?","Who bought it?")}</label><input value={op.by} onChange={e=>setOp({...op,by:e.target.value})} placeholder={L("Nombre de la persona","Person's name")} style={{...inp,width:"100%"}}/></div>

            <label style={{display:"flex",alignItems:"center",gap:8,background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"8px 10px",marginBottom:10,cursor:"pointer"}}>
              <input type="checkbox" checked={op.isPart} onChange={e=>setOp({...op,isPart:e.target.checked})}/>
              <span style={{fontSize:12,color:"#0369a1",fontWeight:600}}>{L("Es un repuesto — agregar detalle","It's a part — add details")}</span>
            </label>
            {op.isPart && (
              <div style={{background:"#f8fafc",borderRadius:9,padding:"10px 11px",marginBottom:10,display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}><label style={lbl}>{L("Marca","Brand")}</label><input value={op.brand} onChange={e=>setOp({...op,brand:e.target.value})} placeholder="Racor, Fleetguard..." style={{...inp,width:"100%"}}/></div>
                  <div style={{flex:1}}><label style={lbl}>{L("Modelo","Model")}</label><input value={op.model2} onChange={e=>setOp({...op,model2:e.target.value})} style={{...inp,width:"100%"}}/></div>
                </div>
                <div><label style={lbl}>{L("Número de parte","Part number")}</label><input value={op.partNum} onChange={e=>setOp({...op,partNum:e.target.value})} placeholder="FF5052..." style={{...inp,width:"100%"}}/></div>
              </div>
            )}
            <PurchaseMeta value={opMeta} onChange={patch=>setOpMeta(m=>({...m,...patch}))}
              payment={op.payment} providers={(vessels?.[0]?.providers)||[]}
              onOwnerCard={()=>setOp(o=>({...o,reimbursable:false}))}/>
            <div style={{height:10}}/>
            <PhotoRow photos={opPhotos} setter={setOpPhotos}/>
            {isFleetManager && (
              <label style={{display:"flex",alignItems:"center",gap:8,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 10px",margin:"8px 0",cursor:"pointer"}}>
                <input type="checkbox" checked={op.reimbursable} onChange={e=>setOp({...op,reimbursable:e.target.checked})}/>
                <span style={{fontSize:12,color:"#92400e",fontWeight:600}}>{L("Lo pagué yo — cobrar al dueño","I paid it — bill the owner")}</span>
              </label>
            )}
            {msg && <div style={{fontSize:12,color:"#dc2626",marginBottom:10}}>{msg}</div>}
            <button onClick={saveOperational} disabled={saving} style={{...primary,width:"100%",opacity:saving?.6:1}}>{saving?"Guardando...":"Registrar compra"}</button>
          </>
        )}

        {step==="admin" && (
          <>
            <button onClick={()=>setStep("choose")} style={backBtn}>← Volver</button>
            <div style={{fontSize:12,color:"#0369a1",background:"#f0f9ff",padding:"8px 12px",borderRadius:8,marginBottom:14,lineHeight:1.4}}>{L("Este gasto se registra directo en Finanzas. Úsalo para gastos fijos o administrativos del barco.","This expense goes straight to Finance. Use it for fixed or administrative boat costs.")}</div>
            <label style={lbl}>Tipo de gasto</label>
            <select value={adm.category} onChange={e=>setAdm({...adm,category:e.target.value})} style={inp}>
              <option>Seguro</option><option>Marina</option><option>Sueldos</option><option>Matrícula</option><option>Impuestos</option><option>Administrativo</option><option>Otro</option>
            </select>
            <label style={lbl}>{L("Descripción (opcional)","Description (optional)")}</label>
            <input value={adm.description} onChange={e=>setAdm({...adm,description:e.target.value})} placeholder={L("Ej: Seguro anual, mensualidad marina...","e.g. Annual insurance, marina fee...")} style={inp}/>
            <div><label style={lbl}>{L("Monto (USD)","Amount (USD)")}</label><input type="number" value={adm.amount} onChange={e=>setAdm({...adm,amount:e.target.value})} placeholder="0" style={inp}/></div>
            <div style={{marginBottom:10}}><label style={lbl}>{L("Método de pago","Payment method")}</label>
              <select value={adm.payment} onChange={e=>setAdm({...adm,payment:e.target.value})} style={{...inp,width:"100%"}}>
                <option value="">{L("Seleccionar...","Select...")}</option>
                {["Efectivo","Tarjeta","Transferencia","Zelle","PayPal","Cheque","Otro"].map(pm=><option key={pm} value={pm}>{pm}</option>)}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <PurchaseMeta value={admMeta} onChange={patch=>setAdmMeta(m=>({...m,...patch}))}
                payment={adm.payment} providers={(vessels?.[0]?.providers)||[]}
                onOwnerCard={()=>setAdm(a=>({...a,reimbursable:false}))}/>
            </div>
            <div style={{marginBottom:10}}><label style={lbl}>{L("¿Quién lo compró / pagó?","Who bought / paid it?")}</label><input value={adm.by} onChange={e=>setAdm({...adm,by:e.target.value})} placeholder={L("Nombre de la persona","Person's name")} style={{...inp,width:"100%"}}/></div>
            <PhotoRow photos={admPhotos} setter={setAdmPhotos}/>
            <label style={{...lbl,display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:8}}>
              <input type="checkbox" checked={adm.recurring} onChange={e=>setAdm({...adm,recurring:e.target.checked})}/>
              Es un gasto fijo mensual (se repite)
            </label>
            {isFleetManager && (
              <label style={{display:"flex",alignItems:"center",gap:8,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 10px",marginTop:8,cursor:"pointer"}}>
                <input type="checkbox" checked={adm.reimbursable} onChange={e=>setAdm({...adm,reimbursable:e.target.checked})}/>
                <span style={{fontSize:12,color:"#92400e",fontWeight:600}}>{L("Lo pagué yo — cobrar al dueño","I paid it — bill the owner")}</span>
              </label>
            )}
            {msg && <div style={{fontSize:12,color:"#dc2626",margin:"10px 0"}}>{msg}</div>}
            <button onClick={saveAdmin} disabled={saving} style={{...primary,width:"100%",opacity:saving?.6:1,marginTop:10}}>{saving?"Guardando...":"Registrar gasto"}</button>
          </>
        )}
      </div>
    </div>
  );
}

const ov = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:20};
const box = {background:"#fff",borderRadius:18,padding:24,maxWidth:440,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
const choiceBtn = {display:"block",width:"100%",textAlign:"left",padding:"16px 18px",borderRadius:14,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer"};
const backBtn = {background:"none",border:"none",cursor:"pointer",color:"#64748b",fontSize:13,fontWeight:600,marginBottom:12,padding:0};
const lbl = {display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:5,marginTop:10};
const inp = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none",marginBottom:2};
const primary = {padding:"11px 18px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"};
