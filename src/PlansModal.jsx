import { useState } from "react";
import { PLANS, FOUNDER_ACCESS } from "./plans.jsx";
import ManualCheckout from "./ManualCheckout.jsx";

// Pantalla de planes con toggle mensual/anual y pago manual
// Props: vessel, user, onClose
export default function PlansModal({ vessel, user, onClose, onReported }) {
  const [yearly, setYearly] = useState(true);
  const [selected, setSelected] = useState(null); // plan elegido para pagar

  const currentPlan = vessel?.details?._subscription?.plan || "free";

  const FEATURE_ROWS = [
    { key:"vessels", label:"Embarcaciones", free:"1", pro:"1", fleet:"Ilimitadas" },
    { key:"tasks", label:"Tareas y mantenimiento", free:true, pro:true, fleet:true },
    { key:"log", label:"Bitácora con fotos", free:true, pro:true, fleet:true },
    { key:"docs", label:"Documentos y manuales", free:true, pro:true, fleet:true },
    { key:"marketplace", label:"Marketplace y Day Trips", free:true, pro:true, fleet:true },
    { key:"costs", label:"Control de costos", free:false, pro:true, fleet:true },
    { key:"inventory", label:"Inventario de repuestos", free:false, pro:true, fleet:true },
    { key:"hourReminders", label:"Recordatorios por horas de motor", free:false, pro:true, fleet:true },
    { key:"pdfReports", label:"Reportes PDF premium", free:false, pro:true, fleet:true },
    { key:"multiFleet", label:"Vista de flota consolidada", free:false, pro:false, fleet:true },
  ];

  const price = (plan) => yearly ? plan.priceYearly : plan.priceMonthly;
  const period = yearly ? "/año" : "/mes";

  const Check = ({ on }) => on
    ? <span style={{color:"#16a34a",fontWeight:800,fontSize:15}}>✓</span>
    : <span style={{color:"#cbd5e1",fontSize:15}}>—</span>;

  // Pantalla de pago de un plan elegido
  if (selected) {
    const plan = PLANS[selected];
    const amount = price(plan);
    return (
      <ManualCheckout
        vessel={vessel}
        user={user}
        planKey={selected}
        period={yearly ? "yearly" : "monthly"}
        onClose={onClose}
        onReported={onReported}
      />
    );
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#0f172a"}}>Planes de Carive</div>
            <div style={{fontSize:12,color:"#64748b"}}>Elige el plan que se ajusta a ti</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
        </div>
        {FOUNDER_ACCESS && (
          <div style={{margin:"16px 24px 0",background:"linear-gradient(120deg,#0a2540,#1e3a8a)",borderRadius:12,padding:"12px 16px"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#fff",fontFamily:"'Sora',system-ui,sans-serif",marginBottom:2}}>Estás en Acceso de Fundador</div>
            <div style={{fontSize:11,color:"#bfdbfe",lineHeight:1.4}}>Ahora mismo tienes todas las funciones desbloqueadas, gratis. Estos son los planes que estarán disponibles más adelante — como fundador tendrás condiciones especiales.</div>
          </div>
        )}

        <div style={{padding:"20px 24px",overflowY:"auto"}}>
          {/* Toggle mensual / anual */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
            <div style={{display:"inline-flex",background:"#f1f5f9",borderRadius:10,padding:4}}>
              <button onClick={()=>setYearly(false)} style={toggleBtn(!yearly)}>Mensual</button>
              <button onClick={()=>setYearly(true)} style={toggleBtn(yearly)}>Anual <span style={{fontSize:10,color:yearly?"#bbf7d0":"#16a34a",fontWeight:700}}>2 meses gratis</span></button>
            </div>
          </div>

          {/* Tarjetas de planes */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:24}}>
            {["free","pro","fleet"].map(key=>{
              const plan = PLANS[key];
              const isCurrent = currentPlan===key;
              const highlight = key==="pro";
              return (
                <div key={key} style={{
                  border:highlight?"2px solid #1d4ed8":"1px solid #e2e8f0",
                  borderRadius:14,padding:20,position:"relative",
                  background:highlight?"#f8fbff":"#fff",
                }}>
                  {highlight&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:"#1d4ed8",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 12px",borderRadius:12}}>MÁS POPULAR</div>}
                  <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{plan.name}</div>
                  <div style={{fontSize:11,color:"#64748b",minHeight:32,marginTop:2}}>{plan.tagline}</div>
                  <div style={{margin:"12px 0"}}>
                    <span style={{fontSize:28,fontWeight:800,color:"#0f172a"}}>${price(plan)}</span>
                    <span style={{fontSize:13,color:"#64748b"}}>{plan.priceMonthly>0?period:""}</span>
                  </div>
                  {isCurrent
                    ? <div style={{padding:"10px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,color:"#16a34a",fontSize:13,fontWeight:700,textAlign:"center"}}>Tu plan actual</div>
                    : key==="free"
                      ? <div style={{padding:"10px",background:"#f8fafc",borderRadius:8,color:"#94a3b8",fontSize:13,fontWeight:600,textAlign:"center"}}>Gratis siempre</div>
                      : <button onClick={()=>setSelected(key)} style={{width:"100%",padding:"10px",background:highlight?"linear-gradient(120deg,#2563eb,#0ea5e9)":"#0f172a",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Elegir {plan.name}</button>
                  }
                </div>
              );
            })}
          </div>

          {/* Tabla comparativa */}
          <div style={{border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",background:"#f8fafc",padding:"10px 14px",fontSize:11,fontWeight:700,color:"#64748b"}}>
              <div>FUNCIÓN</div>
              <div style={{textAlign:"center"}}>Gratis</div>
              <div style={{textAlign:"center"}}>Pro</div>
              <div style={{textAlign:"center"}}>Flota</div>
            </div>
            {FEATURE_ROWS.map((r,i)=>(
              <div key={r.key} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"10px 14px",fontSize:12,borderTop:"1px solid #f1f5f9",alignItems:"center",background:i%2?"#fff":"#fcfcfd"}}>
                <div style={{color:"#475569"}}>{r.label}</div>
                <div style={{textAlign:"center"}}>{typeof r.free==="string"?<span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{r.free}</span>:<Check on={r.free}/>}</div>
                <div style={{textAlign:"center"}}>{typeof r.pro==="string"?<span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{r.pro}</span>:<Check on={r.pro}/>}</div>
                <div style={{textAlign:"center"}}>{typeof r.fleet==="string"?<span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{r.fleet}</span>:<Check on={r.fleet}/>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PayMethod({ title, detail }) {
  return (
    <div style={{border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{title}</div>
      <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{detail}</div>
    </div>
  );
}

const overlay = {position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2500,padding:16};
const box = {background:"#fff",borderRadius:16,width:"100%",maxWidth:720,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"};
const toggleBtn = (active) => ({padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:active?"#fff":"transparent",color:active?"#1d4ed8":"#64748b",boxShadow:active?"0 1px 3px rgba(0,0,0,0.1)":"none",display:"flex",alignItems:"center",gap:6});
