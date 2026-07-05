import { useState } from "react";
import CariveLogo from "./CariveLogo";

// Guía de bienvenida para dueños nuevos.
// Aparece la primera vez (3 slides) y luego deja un checklist de primeros pasos.

const SLIDES = [
  {
    title: "Bienvenido a Carive",
    body: "La forma simple de mantener tu embarcación organizada: mantenimiento, bitácora, costos, tripulación y repuestos, todo en un solo lugar.",
  },
  {
    title: "Nunca olvides un servicio",
    body: "Registra tus tareas de mantenimiento por fecha o por horas de motor. Carive te avisa cuándo toca cada servicio, antes de que sea tarde.",
  },
  {
    title: "Tu tripulación y tus repuestos",
    body: "Encuentra capitanes y marineros, publica viajes, y pide repuestos a tiendas de tu zona que compiten por darte el mejor precio.",
  },
];

export default function Onboarding({ onStart }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  return (
    <div style={{position:"fixed",inset:0,background:"linear-gradient(160deg,#0a2540,#061a30)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:420,width:"100%",textAlign:"center",color:"#fff"}}>
        <div style={{width:84,height:84,margin:"0 auto 24px",borderRadius:"50%",background:"rgba(56,189,248,0.12)",border:"1px solid rgba(56,189,248,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <CariveLogo size={44} />
        </div>
        <div style={{fontSize:24,fontWeight:800,marginBottom:12,fontFamily:"'Sora',system-ui,sans-serif"}}>{s.title}</div>
        <div style={{fontSize:15,lineHeight:1.6,color:"#9fb4cc",marginBottom:32}}>{s.body}</div>

        {/* Puntitos de progreso */}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:28}}>
          {SLIDES.map((_,idx)=>(
            <div key={idx} style={{width:idx===i?22:8,height:8,borderRadius:999,background:idx===i?"#38bdf8":"rgba(255,255,255,.25)",transition:".2s"}}/>
          ))}
        </div>

        <button onClick={()=> last ? onStart() : setI(i+1)} style={{width:"100%",padding:"14px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Sora',system-ui,sans-serif"}}>
          {last ? "Agregar mi primera embarcación" : "Siguiente"}
        </button>
        {!last && (
          <button onClick={onStart} style={{marginTop:14,background:"none",border:"none",color:"#7f97b3",fontSize:13,cursor:"pointer"}}>Saltar introducción</button>
        )}
      </div>
    </div>
  );
}

// Checklist de primeros pasos — se muestra en el dashboard hasta completarse.
export function OnboardingChecklist({ vessel, onAddTask, onAddLog, onInviteCrew, onDismiss }) {
  const hasTasks = (vessel?.tasks||[]).length > 0;
  const hasLog = (vessel?.log||[]).length > 0;
  const steps = [
    { done: true, label: "Agregaste tu embarcación", action: null },
    { done: hasTasks, label: "Registra tu primera tarea de mantenimiento", action: onAddTask },
    { done: hasLog, label: "Anota algo en la bitácora", action: onAddLog },
    { done: false, label: "Invita a tu capitán o busca tripulación", action: onInviteCrew },
  ];
  const completed = steps.filter(s=>s.done).length;
  const pct = Math.round((completed/steps.length)*100);

  // Si ya completó las tres acciones principales, no mostrar
  if (hasTasks && hasLog) return null;

  return (
    <div style={{maxWidth:1100,margin:"0 auto 16px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>Primeros pasos</div>
          <div style={{fontSize:12,color:"#64748b"}}>Completa tu configuración para sacarle el máximo a Carive</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#2563eb"}}>{completed}/{steps.length}</div>
          <button onClick={onDismiss} style={{background:"none",border:"none",color:"#cbd5e1",fontSize:11,cursor:"pointer"}}>Ocultar</button>
        </div>
      </div>
      {/* Barra de progreso */}
      <div style={{height:6,background:"#f1f5f9",borderRadius:999,overflow:"hidden",marginBottom:14}}>
        <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#2563eb,#0ea5e9)",borderRadius:999,transition:".3s"}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {steps.map((st,idx)=>(
          <button key={idx} onClick={st.action||undefined} disabled={st.done||!st.action} style={{
            display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,textAlign:"left",width:"100%",
            border:"1px solid",borderColor:st.done?"#bbf7d0":"#e2e8f0",
            background:st.done?"#f0fdf4":"#fff",
            cursor:(st.done||!st.action)?"default":"pointer",
          }}>
            <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
              background:st.done?"#16a34a":"#e2e8f0",color:"#fff",fontSize:13,fontWeight:800}}>{st.done?"✓":idx+1}</div>
            <span style={{fontSize:13,fontWeight:600,color:st.done?"#16a34a":"#334155",textDecoration:st.done?"line-through":"none"}}>{st.label}</span>
            {!st.done&&st.action&&<span style={{marginLeft:"auto",fontSize:18,color:"#cbd5e1"}}>›</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
