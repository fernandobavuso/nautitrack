import { supabase } from "./supabase";

// Genera un token aleatorio corto y legible
function genToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

// Crea una invitación y devuelve el link para compartir.
// kind: 'manager' | 'captain' | 'crew'
export async function createInvitation({ kind, inviter, vessel, invitedEmail, invitedName, roleDetail }) {
  // El nombre puede no venir cargado en el objeto de sesión: se busca en el perfil.
  let nameOf = inviter?.full_name || inviter?.first_name || null;
  if (!nameOf && inviter?.id) {
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", inviter.id).maybeSingle();
    nameOf = prof?.full_name || null;
  }
  if (nameOf && nameOf.includes("@")) nameOf = null;   // nunca un correo
  const token = genToken();
  const { error } = await supabase.from("invitations").insert({
    token,
    kind,
    inviter_id: inviter.id,
    // Nunca el correo: es dato personal y la invitación puede reenviarse a cualquiera.
    inviter_name: nameOf,
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

  if (inv.kind === "partner") {
    // Socio de solo lectura: vincular a los barcos elegidos por el gestor
    let vesselIds = [];
    try { vesselIds = JSON.parse(inv.role_detail || "[]"); } catch { vesselIds = []; }
    if (vesselIds.length) {
      // Vía RPC: la política de vessel_partners solo deja escribir al dueño, y quien
      // acepta es el invitado. La función corre con permisos elevados y valida el
      // token, así que nadie puede darse acceso a sí mismo sin invitación válida.
      const { error: rpcErr } = await supabase.rpc("accept_partner_invite", {
        p_token: inv.token, p_user: newUser.id,
        p_email: (inv.invited_email || newUser.email || "").toLowerCase(),
      });
      if (rpcErr) console.error("[Carive] no se pudo vincular al socio:", rpcErr.message);
    }
    await supabase.from("invitations").update({ status:"accepted", accepted_by:newUser.id }).eq("token", inv.token);
    return;
  }

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
export function invitationCopy(inv, lang = "es") {
  const en = lang === "en";
  if (!inv) return { title: "", body: "" };
  // Invitaciones viejas pueden traer un correo guardado como nombre: no se muestra.
  const raw = inv.inviter_name || "";
  const who = (!raw || raw.includes("@")) ? (en ? "Someone" : "Alguien") : raw;
  const boat = inv.vessel_name || (en ? "a vessel" : "una embarcación");

  if (inv.kind === "manager") {
    return en ? {
      title: `${who} invited you to manage their fleet`,
      body: `Once you create your account, you'll be able to manage ${who}'s boats in Carive: tasks, logbook, costs and more.`,
    } : {
      title: `${who} te invitó a gestionar su flota`,
      body: `Al crear tu cuenta, tendrás acceso para gestionar los barcos de ${who} en Carive: tareas, bitácora, costos y más.`,
    };
  }
  if (inv.kind === "captain") {
    return en ? {
      title: `${who} invited you as captain`,
      body: `${who} assigned you as captain of ${boat}. Create your account to start operating the vessel.`,
    } : {
      title: `${who} te invitó como capitán`,
      body: `${who} te asignó como capitán de ${boat}. Crea tu cuenta para empezar a operar el barco.`,
    };
  }
  if (inv.kind === "crew") {
    return en ? {
      title: `${who} invited you as crew`,
      body: `${who} invited you to join the crew of ${boat}${inv.role_detail?` as ${inv.role_detail}`:""}. Create your account to accept.`,
    } : {
      title: `${who} te invitó como tripulante`,
      body: `${who} te invitó a unirte a la tripulación de ${boat}${inv.role_detail?` como ${inv.role_detail}`:""}. Crea tu cuenta para aceptar.`,
    };
  }
  if (inv.kind === "partner") {
    return en ? {
      title: `${who} shared their vessels with you`,
      body: `You'll have read-only access to follow the activity, tasks, expenses and documents. Create your account to continue.`,
    } : {
      title: `${who} compartió sus barcos contigo`,
      body: `Tendrás acceso de solo lectura para seguir la actividad, tareas, gastos y documentos. Crea tu cuenta para continuar.`,
    };
  }
  return en
    ? { title: "Carive invitation", body: "Create your account to continue." }
    : { title: "Invitación a Carive", body: "Crea tu cuenta para continuar." };
}
