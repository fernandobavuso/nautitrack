import { useState } from "react";
import { supabase } from "./supabase";
import { PLANS } from "./plans.jsx";
import { PAYMENT_METHODS_INFO } from "./paymentInfo.jsx";

// Checkout manual: el cliente ve las instrucciones de pago, paga por fuera,
// y reporta su pago subiendo un comprobante. Queda pendiente hasta que el
// admin lo aprueba en el Panel de Admin.
export default function ManualCheckout({ vessel, user, planKey, period, onClose, onReported }) {
  const plan = PLANS[planKey];
  const price = period === "yearly" ? plan.priceYearly : plan.priceMonthly;
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  const chosen = PAYMENT_METHODS_INFO.find(m => m.id === method);

  const submit = async () => {
    if (!method) { setMsg("Elige un método de pago"); return; }
    setUploading(true);
    try {
      let proofUrl = null, proofPath = null;
      if (proof) {
        const ext = proof.name.split(".").pop();
        proofPath = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("comprobantes").upload(proofPath, proof);
        if (upErr) throw upErr;
        proofUrl = proofPath; // guardamos la ruta; se abre con link firmado
      }
      const { error } = await supabase.from("payment_requests").insert({
        owner_id: user.id, vessel_id: vessel.id,
        plan: planKey, billing_period: period, amount: price,
        currency: chosen?.currency || "USD", method,
        reference: reference.trim() || null, proof_url: proofUrl, status: "pending",
      });
      if (error) throw error;
      setDone(true);
      onReported && onReported();
    } catch (err) {
      setMsg("Error: " + err.message);
    }
    setUploading(false);
  };

  if (done) {
    return (
      <div style={ov} onClick={onClose}>
        <div style={box} onClick={e=>e.stopPropagation()}>
          <div style={{textAlign:"center",padding:"20px 10px"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif",marginBottom:8}}>¡Pago reportado!</div>
            <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,maxWidth:340,margin:"0 auto"}}>
              Recibimos tu reporte de pago del plan <strong>{plan.name}</strong>. Lo verificaremos y activaremos tu plan en breve (normalmente el mismo día). Te avisaremos cuando esté listo.
            </div>
            <button onClick={onClose} style={{...btnPrimary,marginTop:18}}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={ov} onClick={onClose}>
      <div style={box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>Pagar plan {plan.name}</div>
            <div style={{fontSize:13,color:"#64748b"}}>{period==="yearly"?"Anual":"Mensual"} · <strong style={{color:"#2563eb"}}>${price} {chosen?.currency||"USD"}</strong></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>×</button>
        </div>

        {/* Paso 1: elegir método */}
        <div style={{fontSize:12,fontWeight:700,color:"#0a2540",marginBottom:8}}>1. Elige cómo vas a pagar</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          {PAYMENT_METHODS_INFO.map(m => (
            <button key={m.id} onClick={()=>setMethod(m.id)} style={{padding:"10px 12px",borderRadius:10,border:`1.5px solid ${method===m.id?"#2563eb":"#e2e8f0"}`,background:method===m.id?"#eff6ff":"#fff",cursor:"pointer",textAlign:"left"}}>
              <div style={{fontSize:13,fontWeight:700,color:method===m.id?"#2563eb":"#0f172a"}}>{m.name}</div>
              <div style={{fontSize:10,color:"#94a3b8"}}>{m.currency}</div>
            </button>
          ))}
        </div>

        {/* Paso 2: instrucciones del método elegido */}
        {chosen && (
          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:14,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0369a1",marginBottom:6}}>2. Envía ${price} a:</div>
            <div style={{fontSize:14,fontWeight:700,color:"#0a2540",wordBreak:"break-all"}}>{chosen.detail}</div>
            <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{chosen.note}</div>
          </div>
        )}

        {/* Paso 3: reportar el pago */}
        {chosen && (
          <>
            <div style={{fontSize:12,fontWeight:700,color:"#0a2540",marginBottom:8}}>3. Reporta tu pago</div>
            <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Nº de referencia / confirmación (opcional)" style={{...inp,marginBottom:8}}/>
            <label style={{display:"block",marginBottom:14}}>
              <div style={{fontSize:12,color:"#475569",marginBottom:6}}>Sube tu comprobante (captura o recibo)</div>
              <div style={{border:"1.5px dashed #cbd5e1",borderRadius:10,padding:"14px",textAlign:"center",cursor:"pointer",background:"#f8fafc"}}>
                {proof ? <span style={{fontSize:12,color:"#2563eb",fontWeight:600}}>{proof.name}</span> : <span style={{fontSize:12,color:"#94a3b8"}}>Toca para elegir archivo (imagen o PDF)</span>}
                <input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>setProof(e.target.files?.[0]||null)}/>
              </div>
            </label>

            {msg && <div style={{fontSize:12,color:"#dc2626",marginBottom:10}}>{msg}</div>}

            <button onClick={submit} disabled={uploading} style={{...btnPrimary,width:"100%",opacity:uploading?.6:1}}>
              {uploading ? "Enviando..." : "Reportar mi pago"}
            </button>
            <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:8}}>Verificaremos tu pago y activaremos tu plan, normalmente el mismo día.</div>
          </>
        )}
      </div>
    </div>
  );
}

const ov = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:20};
const box = {background:"#fff",borderRadius:18,padding:24,maxWidth:460,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
const btnPrimary = {padding:"11px 18px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"};
const inp = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none"};
