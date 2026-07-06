import { useState } from "react";
import { supabase } from "./supabase";

// Modal "Registrar gasto": hace UNA pregunta simple (¿compra del día o gasto fijo?)
// y enruta al lugar correcto. El usuario no tiene que saber la teoría de
// Bitácora vs Costos — solo responde qué tipo de gasto es.
export default function ExpenseRouter({ vessel, user, onClose, onLogPurchase, onDirectExpense }) {
  const [step, setStep] = useState("choose"); // choose | operational | admin
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Formulario compra operacional (va a bitácora)
  const [op, setOp] = useState({ item:"", amount:"", currency:"USD", payment:"Zelle", date:new Date().toISOString().slice(0,10), by:"" });
  // Formulario gasto administrativo (va directo a costos)
  const [adm, setAdm] = useState({ category:"Seguro", description:"", amount:"", currency:"USD", date:new Date().toISOString().slice(0,10), recurring:false });

  const saveOperational = async () => {
    if (!op.item.trim() || !op.amount) { setMsg("Completa qué compraste y el monto"); return; }
    setSaving(true);
    // Se registra como entrada de bitácora tipo Compra (fluye a Costos solo)
    const entry = {
      type:"Compra", item:op.item.trim(), desc:"",
      costUSD: op.currency==="USD"?Number(op.amount):null,
      costBs: op.currency==="VES"?Number(op.amount):null,
      payment: op.payment, date: op.date, performedBy: op.by || null, photos:[],
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
    });
    if (error) { setMsg("Error: "+error.message); setSaving(false); return; }
    onDirectExpense && onDirectExpense();
    onClose();
  };

  return (
    <div style={ov} onClick={onClose}>
      <div style={box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>Registrar gasto</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>×</button>
        </div>

        {step==="choose" && (
          <>
            <div style={{fontSize:13,color:"#64748b",marginBottom:18,lineHeight:1.5}}>¿Qué tipo de gasto es? Elige y lo registramos en el lugar correcto.</div>
            <button onClick={()=>{setStep("operational");setMsg("");}} style={choiceBtn}>
              <div style={{fontSize:22,marginBottom:6}}>🛒</div>
              <div style={{fontSize:15,fontWeight:700,color:"#0a2540"}}>Una compra o gasto del barco</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:4,lineHeight:1.4}}>Algo que se compró o se pagó durante la operación: repuestos, combustible, un servicio, reparaciones.</div>
              <div style={{fontSize:11,color:"#2563eb",fontWeight:600,marginTop:8}}>Se registra en la Bitácora →</div>
            </button>
            <button onClick={()=>{setStep("admin");setMsg("");}} style={{...choiceBtn,marginTop:12}}>
              <div style={{fontSize:22,marginBottom:6}}>📋</div>
              <div style={{fontSize:15,fontWeight:700,color:"#0a2540"}}>Un gasto fijo o administrativo</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:4,lineHeight:1.4}}>Gastos que no son compras del día: seguro, marina, sueldos, matrícula, impuestos.</div>
              <div style={{fontSize:11,color:"#2563eb",fontWeight:600,marginTop:8}}>Se registra directo en Finanzas →</div>
            </button>
          </>
        )}

        {step==="operational" && (
          <>
            <button onClick={()=>setStep("choose")} style={backBtn}>← Volver</button>
            <div style={{fontSize:12,color:"#0369a1",background:"#f0f9ff",padding:"8px 12px",borderRadius:8,marginBottom:14,lineHeight:1.4}}>Esta compra se registra en la Bitácora y su monto aparecerá solo en Finanzas. No la anotas dos veces.</div>
            <label style={lbl}>¿Qué se compró?</label>
            <input value={op.item} onChange={e=>setOp({...op,item:e.target.value})} placeholder="Ej: Filtro de aceite, combustible..." style={inp}/>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><label style={lbl}>Monto</label><input type="number" value={op.amount} onChange={e=>setOp({...op,amount:e.target.value})} placeholder="0" style={inp}/></div>
              <div style={{width:90}}><label style={lbl}>Moneda</label><select value={op.currency} onChange={e=>setOp({...op,currency:e.target.value})} style={inp}><option>USD</option><option>VES</option></select></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><label style={lbl}>Pago</label><select value={op.payment} onChange={e=>setOp({...op,payment:e.target.value})} style={inp}><option>Zelle</option><option>Efectivo</option><option>Transferencia</option><option>USDT</option><option>Otro</option></select></div>
              <div style={{flex:1}}><label style={lbl}>Fecha</label><input type="date" value={op.date} onChange={e=>setOp({...op,date:e.target.value})} style={inp}/></div>
            </div>
            {msg && <div style={{fontSize:12,color:"#dc2626",marginBottom:10}}>{msg}</div>}
            <button onClick={saveOperational} disabled={saving} style={{...primary,width:"100%",opacity:saving?.6:1}}>{saving?"Guardando...":"Registrar compra"}</button>
          </>
        )}

        {step==="admin" && (
          <>
            <button onClick={()=>setStep("choose")} style={backBtn}>← Volver</button>
            <div style={{fontSize:12,color:"#0369a1",background:"#f0f9ff",padding:"8px 12px",borderRadius:8,marginBottom:14,lineHeight:1.4}}>Este gasto se registra directo en Finanzas. Úsalo para gastos fijos o administrativos del barco.</div>
            <label style={lbl}>Tipo de gasto</label>
            <select value={adm.category} onChange={e=>setAdm({...adm,category:e.target.value})} style={inp}>
              <option>Seguro</option><option>Marina</option><option>Sueldos</option><option>Matrícula</option><option>Impuestos</option><option>Administrativo</option><option>Otro</option>
            </select>
            <label style={lbl}>Descripción (opcional)</label>
            <input value={adm.description} onChange={e=>setAdm({...adm,description:e.target.value})} placeholder="Ej: Seguro anual, mensualidad marina..." style={inp}/>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><label style={lbl}>Monto</label><input type="number" value={adm.amount} onChange={e=>setAdm({...adm,amount:e.target.value})} placeholder="0" style={inp}/></div>
              <div style={{width:90}}><label style={lbl}>Moneda</label><select value={adm.currency} onChange={e=>setAdm({...adm,currency:e.target.value})} style={inp}><option>USD</option><option>VES</option></select></div>
            </div>
            <label style={{...lbl,display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:8}}>
              <input type="checkbox" checked={adm.recurring} onChange={e=>setAdm({...adm,recurring:e.target.checked})}/>
              Es un gasto fijo mensual (se repite)
            </label>
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
