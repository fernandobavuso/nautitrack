// Sistema central de planes de Carive
// El plan del dueño se guarda en details._subscription.plan ("free" | "pro")
import { useLang } from "./i18n.jsx";

// ─────────────────────────────────────────────────────────────
// ACCESO DE FUNDADOR (modo lanzamiento)
// Mientras esté en true, TODOS los usuarios tienen acceso completo
// (nivel Flota) gratis. El día que quieras empezar a cobrar,
// cambia esto a false y se activa el flujo de pago normal.
export const FOUNDER_ACCESS = false;
// Plan que reciben todos durante el Acceso de Fundador:
const FOUNDER_PLAN = "fleet";
// ─────────────────────────────────────────────────────────────

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
  // Durante el Acceso de Fundador, todos tienen el plan máximo gratis
  if (FOUNDER_ACCESS) return PLANS[FOUNDER_PLAN];
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

// Banner discreto de Acceso de Fundador para el dashboard
export function FounderBanner() {
  if (!FOUNDER_ACCESS) return null;
  const { t } = useLang();
  return (
    <div style={{
      background:"linear-gradient(120deg,#0a2540,#1e3a8a)",
      borderRadius:14, padding:"14px 18px", marginBottom:16,
      display:"flex", alignItems:"center", gap:14, flexWrap:"wrap",
      boxShadow:"0 4px 16px rgba(10,37,64,0.15)"
    }}>
      <div style={{
        flexShrink:0, width:38, height:38, borderRadius:10,
        background:"linear-gradient(120deg,#2563eb,#38bdf8)",
        display:"flex", alignItems:"center", justifyContent:"center"
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21l2.3-7.4-6-4.6h7.6z"/></svg>
      </div>
      <div style={{flex:1, minWidth:220}}>
        <div style={{fontSize:14, fontWeight:800, color:"#fff", fontFamily:"'Sora',system-ui,sans-serif"}}>{t("founder.title")}</div>
        <div style={{fontSize:12, color:"#bfdbfe", lineHeight:1.4, marginTop:2}}>
          {t("founder.body")}
        </div>
      </div>
    </div>
  );
}

// Componente de aviso para features premium bloqueadas
export function PremiumLock({ feature, onUpgrade, plan = "pro" }) {
  const P = PLANS[plan] || PLANS.pro;
  const desc = plan === "fleet"
    ? "Mejora al plan Flota para gestionar varias embarcaciones, tu personal, la agenda de trabajo y los costos consolidados de toda tu flota."
    : "Mejora a Carive Pro para controlar los costos de tu barco, manejar inventario de repuestos, recibir recordatorios inteligentes y generar reportes PDF.";
  return (
    <div style={{textAlign:"center",padding:"40px 24px",maxWidth:420,margin:"0 auto"}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:"#fff",fontSize:18,fontWeight:800}}>{P.name}</div>
      <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:8}}>{feature} es una función {P.name}</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:20,lineHeight:1.5}}>{desc}</div>
      <button onClick={onUpgrade} style={{padding:"11px 24px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
        Ver plan {P.name} · ${P.priceMonthly}/mes
      </button>
    </div>
  );
}
