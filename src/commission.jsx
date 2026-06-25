import { supabase } from "./supabase";

// Comisión escalonada por rango de monto. Ventas grandes pagan menor %.
// La paga la tienda (se descuenta de su venta).

// Valores por defecto si no hay tabla cargada (fallback)
const DEFAULT_TIERS = {
  VE: [
    { min: 0,    max: 100,  rate: 8 },
    { min: 100,  max: 500,  rate: 6 },
    { min: 500,  max: 2000, rate: 4 },
    { min: 2000, max: null, rate: 3 },
  ],
  US: [
    { min: 0,    max: 200,  rate: 7 },
    { min: 200,  max: 1000, rate: 5 },
    { min: 1000, max: 5000, rate: 3.5 },
    { min: 5000, max: null, rate: 2.5 },
  ],
};

let cachedTiers = null;

export async function loadTiers() {
  if (cachedTiers) return cachedTiers;
  try {
    const { data } = await supabase.from("commission_tiers").select("*").order("min_amount");
    if (data && data.length) {
      const byRegion = {};
      data.forEach(t => {
        if (!byRegion[t.region]) byRegion[t.region] = [];
        byRegion[t.region].push({ min: Number(t.min_amount), max: t.max_amount==null?null:Number(t.max_amount), rate: Number(t.rate) });
      });
      cachedTiers = byRegion;
      return byRegion;
    }
  } catch (e) {}
  cachedTiers = DEFAULT_TIERS;
  return DEFAULT_TIERS;
}

// Devuelve el % de comisión para un monto y región
export function rateFor(amount, tiers, region = "VE") {
  const list = (tiers && tiers[region]) || DEFAULT_TIERS[region] || DEFAULT_TIERS.VE;
  const a = Number(amount) || 0;
  for (const t of list) {
    if (a >= t.min && (t.max == null || a < t.max)) return t.rate;
  }
  return list[list.length - 1]?.rate || 0;
}

// Calcula comisión y neto para la tienda
export function computeCommission(amount, tiers, region = "VE") {
  const rate = rateFor(amount, tiers, region);
  const commission = Math.round((Number(amount) * rate / 100) * 100) / 100;
  const net = Math.round((Number(amount) - commission) * 100) / 100;
  return { rate, commission, net };
}
