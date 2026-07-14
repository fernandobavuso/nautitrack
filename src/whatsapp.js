// ─────────────────────────────────────────────────────────────
// Envío de WhatsApp desde la app (usa /api/whatsapp)
//
// Las plantillas deben estar APROBADAS en Meta antes de usarse.
// Si una falla, no rompe el flujo — solo lo registra en consola.
// ─────────────────────────────────────────────────────────────

// Plantillas aprobadas en Meta (nombre exacto)
export const WA_TEMPLATES = {
  NUEVO_PEDIDO:   "pedido_tienda_aviso",        // {{1}} tienda, {{2}} producto, {{3}} ciudad, {{4}} distancia (UTILITY)
  PEDIDO_URGENTE: "pedido_urgente_tienda",     // {{1}} tienda, {{2}} producto, {{3}} ciudad
  VENTA_GANADA:   "venta_ganada_tienda",       // {{1}} tienda, {{2}} producto, {{3}} monto, {{4}} cliente
  COTIZACIONES:   "cotizaciones_recibidas_dueno", // {{1}} dueño, {{2}} producto, {{3}} cantidad
  MANTENIMIENTO:  "recordatorio_mantenimiento",   // {{1}} dueño, {{2}} barco, {{3}} tarea, {{4}} vence
  REGISTRO_ABORDO:"registro_abordo",           // {{1}} dueño, {{2}} movimiento, {{3}} barco, {{4}} persona, {{5}} rol, {{6}} hora
  OFERTA_TRABAJO: "oferta_trabajo_tripulante", // {{1}} tripulante, {{2}} rol, {{3}} zona
};

/**
 * Envía un WhatsApp usando una plantilla aprobada.
 * @param {string} to        Número destino (+1 786...)
 * @param {string} template  Nombre de la plantilla (usa WA_TEMPLATES)
 * @param {string[]} params  Valores de {{1}}, {{2}}... en orden
 * @param {string} lang      "es" | "en"
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function sendWhatsApp(to, template, params = [], lang = "es") {
  if (!to) return { ok: false, error: "Sin número destino" };

  try {
    const resp = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, template, params, lang }),
    });
    const data = await resp.json();

    if (!resp.ok || data.error) {
      console.warn("[Carive] WhatsApp no enviado:", data.error || resp.status);
      return { ok: false, error: data.error || "Error al enviar" };
    }
    console.log("[Carive] WhatsApp enviado a", to);
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    console.warn("[Carive] WhatsApp falló:", err.message);
    return { ok: false, error: err.message };
  }
}

// ── Atajos por caso de uso (más legibles desde el código) ──

export const notifyStoreNewOrder = (phone, storeName, product, city, distance) =>
  sendWhatsApp(phone, WA_TEMPLATES.NUEVO_PEDIDO, [storeName, product, city, distance]);

export const notifyStoreUrgent = (phone, storeName, product, city) =>
  sendWhatsApp(phone, WA_TEMPLATES.PEDIDO_URGENTE, [storeName, product, city]);

export const notifyStoreWon = (phone, storeName, product, amount, customer) =>
  sendWhatsApp(phone, WA_TEMPLATES.VENTA_GANADA, [storeName, product, amount, customer]);

export const notifyOwnerQuotes = (phone, ownerName, product, count) =>
  sendWhatsApp(phone, WA_TEMPLATES.COTIZACIONES, [ownerName, product, String(count)]);

export const notifyOwnerCheckin = (phone, ownerName, movement, vessel, person, role, time) =>
  sendWhatsApp(phone, WA_TEMPLATES.REGISTRO_ABORDO, [ownerName, movement, vessel, person, role, time]);
