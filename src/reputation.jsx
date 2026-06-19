import { supabase } from "./supabase";

// Calcula la reputación (estrellas promedio + total de reseñas) de un usuario
// a partir de las reseñas que ha RECIBIDO (reviewee_id)
export async function getReputation(userId) {
  if (!userId) return { avg: null, count: 0 };
  const { data } = await supabase.from("reviews")
    .select("rating").eq("reviewee_id", userId);
  if (!data || data.length === 0) return { avg: null, count: 0 };
  const sum = data.reduce((a, r) => a + (r.rating || 0), 0);
  return { avg: (sum / data.length), count: data.length };
}

// Calcula reputación para varios usuarios de una vez (eficiente)
// Devuelve un objeto { userId: {avg, count} }
export async function getReputations(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data } = await supabase.from("reviews")
    .select("reviewee_id, rating").in("reviewee_id", ids);
  const map = {};
  (data || []).forEach(r => {
    if (!map[r.reviewee_id]) map[r.reviewee_id] = { sum: 0, count: 0 };
    map[r.reviewee_id].sum += r.rating || 0;
    map[r.reviewee_id].count += 1;
  });
  const result = {};
  ids.forEach(id => {
    const m = map[id];
    result[id] = m ? { avg: m.sum / m.count, count: m.count } : { avg: null, count: 0 };
  });
  return result;
}

// Cuenta viajes completados por un tripulante (como seleccionado en day_trips)
export async function getCompletedTrips(userId) {
  if (!userId) return 0;
  const { count } = await supabase.from("day_trips")
    .select("id", { count: "exact", head: true })
    .eq("selected_crew_id", userId).eq("status", "completed");
  return count || 0;
}

// Componente visual de estrellas (★ tipográfico, sin emoji)
export function Stars({ avg, count, size = 13 }) {
  if (avg == null) {
    return <span style={{ fontSize: size - 1, color: "#94a3b8" }}>Sin reseñas aún</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }}>
        {"★".repeat(Math.round(avg))}{"☆".repeat(5 - Math.round(avg))}
      </span>
      <span style={{ fontSize: size - 2, color: "#64748b", fontWeight: 600 }}>
        {avg.toFixed(1)}{count != null ? ` (${count})` : ""}
      </span>
    </span>
  );
}
