import { useState } from "react";
import CariveLogo from "./CariveLogo";

// Bienvenida para tiendas de repuestos (primera vez que entran).
// Lenguaje y pasos pensados para un dueño de tienda, no de barco.
const SLIDES = [
  {
    title: "Bienvenido a Carive",
    body: "El portal donde recibes pedidos de repuestos de dueños de embarcaciones cerca de ti y les envías tus cotizaciones.",
  },
  {
    title: "Recibe pedidos que te calzan",
    body: "Cuando un dueño necesita un repuesto de tu categoría y está dentro de tu zona de cobertura, te llega la solicitud. Tú decides a cuáles cotizar.",
  },
  {
    title: "Cotiza y gana ventas",
    body: "Envías tu precio, el cliente elige, y cierras la venta. Todo transparente: verás tus comisiones y tu historial en un solo lugar.",
  },
];

export default function StoreOnboarding({ onStart }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a2540,#0f3a5f)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:440,width:"100%",textAlign:"center",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:28}}>
          <CariveLogo size={52} variant="light" />
        </div>

        <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"32px 26px",marginBottom:24}}>
          <div style={{display:"inline-block",fontSize:11,fontWeight:800,letterSpacing:"0.1em",color:"#7dd3fc",background:"rgba(56,189,248,0.15)",padding:"4px 12px",borderRadius:20,marginBottom:16}}>PORTAL DE TIENDAS</div>
          <div style={{fontSize:24,fontWeight:800,fontFamily:"'Sora',system-ui,sans-serif",marginBottom:12}}>{SLIDES[i].title}</div>
          <div style={{fontSize:15,lineHeight:1.6,color:"#cbd5e1"}}>{SLIDES[i].body}</div>
        </div>

        {/* Puntos */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:24}}>
          {SLIDES.map((_,idx)=>(
            <div key={idx} style={{width:idx===i?24:8,height:8,borderRadius:20,background:idx===i?"#38bdf8":"rgba(255,255,255,0.25)",transition:".2s"}}/>
          ))}
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          {!last && <button onClick={onStart} style={{padding:"12px 20px",background:"none",border:"none",color:"#94a3b8",fontSize:14,fontWeight:600,cursor:"pointer"}}>Saltar</button>}
          <button onClick={()=>last?onStart():setI(i+1)} style={{padding:"12px 28px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            {last ? "Configurar mi tienda" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
