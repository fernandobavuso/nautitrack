import { supabase } from "./supabase";
import { PLANS } from "./plans.jsx";

// Activa o renueva una suscripción de una embarcación.
// Esta es la función que hoy llama el panel de admin (manual) y que
// MAÑANA llamará el webhook de la pasarela de pago (automático).
//
// vessel: la embarcación
// plan: "free" | "pro" | "fleet"
// period: "monthly" | "yearly"
// payInfo: { method, amount, currency, reference } (opcional)
export async function activateSubscription(vessel, plan, period = "monthly", payInfo = {}) {
  const now = new Date();
  let expiresAt = null;
  if (plan !== "free") {
    const exp = new Date(now);
    if (period === "yearly") exp.setFullYear(exp.getFullYear() + 1);
    else exp.setMonth(exp.getMonth() + 1);
    expiresAt = exp.toISOString();
  }
  const sub = {
    plan,
    status: plan === "free" ? "free" : "active",
    period,
    started_at: now.toISOString(),
    expires_at: expiresAt,
  };
  const ownerId = vessel.owner_id;

  // 1) FUENTE DE VERDAD: el plan vive en la CUENTA (perfil del dueño) y cubre toda su flota.
  await supabase.from("profiles").update({ subscription: sub }).eq("id", ownerId);

  // 2) Estamparlo de una vez en TODOS los barcos de esa cuenta (así surte efecto sin recargar).
  const { data: ownerVessels } = await supabase.from("vessels").select("id, details").eq("owner_id", ownerId);
  for (const v of (ownerVessels || [])) {
    const details = { ...(v.details || {}), _subscription: sub };
    await supabase.from("vessels").update({ details }).eq("id", v.id);
  }

  // 3) Historial / ingresos (para el panel de admin).
  const amount = payInfo.amount != null
    ? payInfo.amount
    : (period === "yearly" ? PLANS[plan]?.priceYearly : PLANS[plan]?.priceMonthly) || 0;
  await supabase.from("subscriptions").upsert({
    vessel_id: vessel.id, owner_id: ownerId,
    plan, status: plan === "free" ? "cancelled" : "active",
    billing_period: period, amount, currency: payInfo.currency || "USD",
    method: payInfo.method || "manual",
    started_at: now.toISOString(), expires_at: expiresAt,
  }, { onConflict: "vessel_id" });

  if (plan !== "free" && amount > 0) {
    await supabase.from("payments").insert({
      owner_id: ownerId, vessel_id: vessel.id,
      kind: "subscription", plan, amount, currency: payInfo.currency || "USD",
      method: payInfo.method || "manual", status: "confirmed",
      reference: payInfo.reference || null,
    });
  }

  return { plan, expiresAt };
}

// Verifica si una embarcación tiene la suscripción vencida y, de ser así,
// la baja a gratis en la base de datos (limpieza). Devuelve true si la bajó.
export async function downgradeIfExpired(vessel) {
  const sub = vessel?.details?._subscription;
  if (!sub || sub.plan === "free" || !sub.expires_at) return false;
  if (new Date(sub.expires_at).getTime() >= Date.now()) return false;
  const details = { ...(vessel.details || {}) };
  details._subscription = { ...sub, plan: "free", status: "expired" };
  await supabase.from("vessels").update({ details }).eq("id", vessel.id);
  await supabase.from("subscriptions").update({ status: "expired" }).eq("vessel_id", vessel.id);
  return true;
}
