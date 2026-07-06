import { supabase } from "./supabase";

// Genera un token aleatorio corto y legible
function genToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

// Crea una invitación y devuelve el link para compartir.
// kind: 'manager' | 'captain' | 'crew'
export async function createInvitation({ kind, inviter, vessel, invitedEmail, invitedName, roleDetail }) {
  const token = genToken();
  const { error } = await supabase.from("invitations").insert({
    token,
    kind,
    inviter_id: inviter.id,
    inviter_name: inviter.full_name || inviter.email,
    vessel_id: vessel?.id || null,
    vessel_name: vessel?.name || null,
    invited_email: (invitedEmail || "").trim().toLowerCase() || null,
    invited_name: invitedName || null,
    role_detail: roleDetail || null,
    status: "pending",
  });
  if (error) throw error;
  const base = window.location.origin;
  return `${base}/?invite=${token}`;
}

// Lee una invitación por token
export async function getInvitation(token) {
  const { data } = await supabase.from("invitations").select("*").eq("token", token).maybeSingle();
  return data;
}

// Marca una invitación como aceptada y ejecuta la vinculación según el tipo
export async function acceptInvitation(inv, newUser) {
  if (!inv || inv.status === "accepted") return;

  if (inv.kind === "manager") {
    // Vincular al nuevo usuario como co-gestor de la flota del que invitó
    await supabase.from("fleet_managers").insert({
      fleet_owner_id: inv.inviter_id,
      manager_id: newUser.id,
      manager_email: newUser.email,
      status: "active",
    });
  } else if (inv.kind === "captain") {
    // Vincular como capitán del barco
    await supabase.from("connections").insert({
      owner_id: inv.inviter_id,
      crew_id: newUser.id,
      vessel_id: inv.vessel_id,
      role: "captain",
      status: "active",
      initiated_by: "owner_invited",
    });
  } else if (inv.kind === "crew") {
    // Vincular como tripulante del barco
    await supabase.from("connections").insert({
      owner_id: inv.inviter_id,
      crew_id: newUser.id,
      vessel_id: inv.vessel_id,
      role: inv.role_detail || "crew",
      status: "active",
      initiated_by: "owner_invited",
    });
  }

  await supabase.from("invitations").update({
    status: "accepted", accepted_by: newUser.id, accepted_at: new Date().toISOString(),
  }).eq("id", inv.id);
}

// Texto explicativo según el tipo de invitación (para mostrar al que la recibe)
export function invitationCopy(inv) {
  if (!inv) return { title: "", body: "" };
  const who = inv.inviter_name || "Alguien";
  if (inv.kind === "manager") {
    return {
      title: `${who} te invitó a gestionar su flota`,
      body: `Al crear tu cuenta, tendrás acceso para gestionar los barcos de ${who} en Carive: tareas, bitácora, costos y más.`,
    };
  }
  if (inv.kind === "captain") {
    return {
      title: `${who} te invitó como capitán`,
      body: `${who} te asignó como capitán de ${inv.vessel_name || "una embarcación"}. Crea tu cuenta para empezar a operar el barco.`,
    };
  }
  if (inv.kind === "crew") {
    return {
      title: `${who} te invitó como tripulante`,
      body: `${who} te invitó a unirte a la tripulación de ${inv.vessel_name || "una embarcación"}${inv.role_detail?` como ${inv.role_detail}`:""}. Crea tu cuenta para aceptar.`,
    };
  }
  return { title: "Invitación a Carive", body: "Crea tu cuenta para continuar." };
}
