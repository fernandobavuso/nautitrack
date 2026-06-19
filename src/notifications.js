import { supabase } from "./supabase";

// Crear una notificación in-app para un usuario
export async function notify(userId, { type, title, body, link }) {
  if (!userId) return;
  try {
    await supabase.from("app_notifications").insert({
      user_id: userId, type, title, body, link, read: false,
    });
  } catch (e) { /* silencioso */ }
}

// Obtener notificaciones de un usuario
export async function getNotifications(userId) {
  if (!userId) return [];
  const { data } = await supabase.from("app_notifications")
    .select("*").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(30);
  return data || [];
}

// Contar no leídas
export async function countUnread(userId) {
  if (!userId) return 0;
  const { count } = await supabase.from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("read", false);
  return count || 0;
}

// Marcar todas como leídas
export async function markAllRead(userId) {
  if (!userId) return;
  await supabase.from("app_notifications").update({ read: true })
    .eq("user_id", userId).eq("read", false);
}
