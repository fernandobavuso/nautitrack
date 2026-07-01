// Sistema central de planes de Carive
// El plan del dueño se guarda en details._subscription.plan ("free" | "pro")

export const PLANS = {
  free: {
    name: "Gratis",
    priceMonthly: 0, priceYearly: 0,
    maxVessels: 1,
    tagline: "Para empezar a organizar tu barco",
    features: {
      tasks: true, log: true, docs: true, weather: true, marketplace: true,
      costs: false, inventory: false, hourReminders: false, multiFleet: false, pdfReports: false,
    },
  },
  pro: {
    name: "Pro",
    priceMonthly: 25, priceYearly: 250,
    maxVessels: 1,
    tagline: "Control total de tu embarcación",
    features: {
      tasks: true, log: true, docs: true, weather: true, marketplace: true,
      costs: true, inventory: true, hourReminders: true, multiFleet: false, pdfReports: true,
    },
  },
  fleet: {
    name: "Flota",
    priceMonthly: 70, priceYearly: 700,
    maxVessels: 99,
    tagline: "Para managers y empresas con varios barcos",
    features: {
      tasks: true, log: true, docs: true, weather: true, marketplace: true,
      costs: true, inventory: true, hourReminders: true, multiFleet: true, pdfReports: true,
    },
  },
};

// Lee el plan vigente de la embarcación, respetando la fecha de vencimiento.
// Si la suscripción expiró, vuelve a "gratis" automáticamente.
export function getPlan(vessel) {
  const sub = vessel?.details?._subscription;
  const plan = sub?.plan || "free";
  if (plan !== "free" && sub?.expires_at) {
    const expired = new Date(sub.expires_at).getTime() < Date.now();
    if (expired) return PLANS.free;
  }
  return PLANS[plan] || PLANS.free;
}

// ¿La suscripción está por vencer? (dentro de 7 días)
export function isExpiringSoon(vessel) {
  const sub = vessel?.details?._subscription;
  if (!sub || sub.plan==="free" || !sub.expires_at) return false;
  const days = (new Date(sub.expires_at).getTime() - Date.now()) / (1000*60*60*24);
  return days > 0 && days <= 7;
}

// Días restantes de la suscripción (null si no aplica)
export function daysLeft(vessel) {
  const sub = vessel?.details?._subscription;
  if (!sub || sub.plan==="free" || !sub.expires_at) return null;
  return Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / (1000*60*60*24));
}

// ¿El dueño tiene acceso a esta feature?
export function hasFeature(vessel, featureKey) {
  return !!getPlan(vessel).features[featureKey];
}

// Componente de aviso para features premium bloqueadas
export function PremiumLock({ feature, onUpgrade }) {
  return (
    <div style={{textAlign:"center",padding:"40px 24px",maxWidth:420,margin:"0 auto"}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:"#fff",fontSize:24,fontWeight:800}}>Pro</div>
      <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:8}}>{feature} es una función Pro</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:20,lineHeight:1.5}}>
        Mejora a Carive Pro para controlar los costos de tu barco, manejar inventario de repuestos, recibir recordatorios inteligentes y administrar varias embarcaciones.
      </div>
      <button onClick={onUpgrade} style={{padding:"11px 24px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
        Ver planes Pro
      </button>
    </div>
  );
}
