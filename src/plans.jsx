// Sistema central de planes de NautiTrack
// El plan del dueño se guarda en details._subscription.plan ("free" | "pro")

export const PLANS = {
  free: {
    name: "Gratis",
    maxVessels: 1,
    features: {
      tasks: true,
      log: true,
      docs: true,
      weather: true,
      marketplace: true,   // buscar tripulantes y day trips: abierto para dar liquidez
      costs: false,        // PREMIUM
      inventory: false,    // PREMIUM
      hourReminders: false,// PREMIUM
      multiFleet: false,   // PREMIUM
      pdfReports: false,   // PREMIUM
    },
  },
  pro: {
    name: "Pro",
    maxVessels: 99,
    features: {
      tasks: true, log: true, docs: true, weather: true, marketplace: true,
      costs: true, inventory: true, hourReminders: true, multiFleet: true, pdfReports: true,
    },
  },
};

// Lee el plan del dueño desde la embarcación (donde guardamos la suscripción)
export function getPlan(vessel) {
  const plan = vessel?.details?._subscription?.plan || "free";
  return PLANS[plan] || PLANS.free;
}

// ¿El dueño tiene acceso a esta feature?
export function hasFeature(vessel, featureKey) {
  return !!getPlan(vessel).features[featureKey];
}

// Componente de aviso para features premium bloqueadas
export function PremiumLock({ feature, onUpgrade }) {
  return (
    <div style={{textAlign:"center",padding:"40px 24px",maxWidth:420,margin:"0 auto"}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:"#fff",fontSize:24,fontWeight:800}}>Pro</div>
      <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:8}}>{feature} es una función Pro</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:20,lineHeight:1.5}}>
        Mejora a NautiTrack Pro para controlar los costos de tu barco, manejar inventario de repuestos, recibir recordatorios inteligentes y administrar varias embarcaciones.
      </div>
      <button onClick={onUpgrade} style={{padding:"11px 24px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
        Ver planes Pro
      </button>
    </div>
  );
}
