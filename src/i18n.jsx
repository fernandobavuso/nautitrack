import { createContext, useContext, useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// Sistema de idioma (i18n) para toda la plataforma.
// Uso: const { t, lang, setLang } = useLang();  →  t("nav.home")
// El diccionario crece por fases. Si falta una clave, muestra el
// texto en español como respaldo (nunca la clave cruda).
// ─────────────────────────────────────────────────────────────

export const DICT = {
  // ─── Común / navegación ───
  "nav.home":        { es: "Inicio",       en: "Home" },
  "nav.fleet":       { es: "Mi Flota",     en: "My Fleet" },
  "nav.operation":   { es: "Operación",    en: "Operations" },
  "nav.tasks":       { es: "Tareas",       en: "Tasks" },
  "nav.calendar":    { es: "Calendario",   en: "Calendar" },
  "nav.log":         { es: "Bitácora",     en: "Logbook" },
  "nav.finance":     { es: "Finanzas",     en: "Finance" },
  "nav.expenses":    { es: "Resumen de gastos", en: "Expense summary" },
  "nav.parts":       { es: "Repuestos",    en: "Parts" },
  "nav.records":     { es: "Records",      en: "Records" },
  "nav.registries":  { es: "Registros",    en: "Records" },
  "nav.docs":        { es: "Documentos",   en: "Documents" },
  "nav.management":  { es: "Gestión",      en: "Management" },
  "nav.providers":   { es: "Proveedores",  en: "Providers" },
  "nav.crew":        { es: "Tripulación",  en: "Crew" },
  "nav.panel":       { es: "Panel",        en: "Panel" },
  "nav.profile":     { es: "Mi Perfil",    en: "My Profile" },
  "nav.vessel":      { es: "Mi Embarcación", en: "My Vessel" },
  "nav.plans":       { es: "Planes y Suscripción", en: "Plans & Subscription" },
  "nav.team":        { es: "Equipo de gestión", en: "Management team" },
  "nav.admin":       { es: "Panel de Administrador", en: "Admin Panel" },
  "nav.logout":      { es: "Cerrar Sesión", en: "Log out" },
  "nav.owner":       { es: "Propietario",  en: "Owner" },

  // ─── Común / acciones ───
  "common.save":     { es: "Guardar",      en: "Save" },
  "common.cancel":   { es: "Cancelar",     en: "Cancel" },
  "common.add":      { es: "Agregar",      en: "Add" },
  "common.edit":     { es: "Editar",       en: "Edit" },
  "common.delete":   { es: "Eliminar",     en: "Delete" },
  "common.close":    { es: "Cerrar",       en: "Close" },
  "common.back":     { es: "Volver",       en: "Back" },
  "common.next":     { es: "Siguiente",    en: "Next" },
  "common.skip":     { es: "Saltar",       en: "Skip" },
  "common.loading":  { es: "Cargando...",  en: "Loading..." },
  "common.search":   { es: "Buscar...",    en: "Search..." },

  // ─── Login / registro ───
  "auth.login":      { es: "Iniciar sesión", en: "Sign in" },
  "auth.register":   { es: "Crear cuenta", en: "Create account" },
  "auth.email":      { es: "Correo electrónico", en: "Email" },
  "auth.password":   { es: "Contraseña",   en: "Password" },
  "auth.firstName":  { es: "Nombre",       en: "First name" },
  "auth.lastName":   { es: "Apellido",     en: "Last name" },
  "auth.noAccount":  { es: "¿No tienes cuenta? Regístrate", en: "No account? Sign up" },
  "auth.hasAccount": { es: "¿Ya tienes cuenta? Inicia sesión", en: "Already have an account? Sign in" },
  "auth.accountType":{ es: "Tipo de cuenta", en: "Account type" },
  "auth.typeBoat":   { es: "Barco",        en: "Boat" },
  "auth.typeCrew":   { es: "Tripulante",   en: "Crew" },
  "auth.typeStore":  { es: "Tienda",       en: "Store" },
  "auth.wrongCreds": { es: "Email o contraseña incorrectos", en: "Wrong email or password" },
  "auth.disabled":   { es: "Esta cuenta está deshabilitada. Contacta al administrador.", en: "This account is disabled. Contact the administrator." },
  "auth.deleted":    { es: "Esta cuenta ya no está disponible. Contacta al administrador.", en: "This account is no longer available. Contact the administrator." },
  "auth.fillAll":    { es: "Completa todos los campos", en: "Fill in all fields" },
  "auth.enter":      { es: "Entrar",         en: "Sign in" },
  "auth.createBtn":  { es: "Crear cuenta",   en: "Create account" },
  "auth.confirmPwd": { es: "Confirmar contraseña", en: "Confirm password" },
  "auth.emailPh":    { es: "tu@email.com",   en: "you@email.com" },
  "auth.tagline":    { es: "Tu flota. Tu mar.", en: "Your fleet. Your sea." },

  // ─── Tareas ───
  "tasks.title":     { es: "Tareas",         en: "Tasks" },
  "tasks.new":       { es: "Nueva tarea",    en: "New task" },
  "tasks.pending":   { es: "Pendiente",      en: "Pending" },
  "tasks.due":       { es: "Por vencer",     en: "Due soon" },
  "tasks.overdue":   { es: "Vencida",        en: "Overdue" },
  "tasks.done":      { es: "Completada",     en: "Completed" },
  "tasks.empty":     { es: "Sin tareas",     en: "No tasks" },
  "tasks.all":       { es: "Todas",          en: "All" },
  "tasks.completed": { es: "Completadas",    en: "Completed" },
  "tasks.onTrack":   { es: "Al día",         en: "On track" },
  "tasks.task":      { es: "Tarea",          en: "Task" },
  "tasks.system":    { es: "Sistema",        en: "System" },
  "tasks.equipment": { es: "Equipo",         en: "Equipment" },
  "tasks.status":    { es: "Estado",         en: "Status" },
  "tasks.assigned":  { es: "Asignado",       en: "Assigned" },
  "tasks.interval":  { es: "Intervalo",      en: "Interval" },
  "tasks.nextDue":   { es: "Próximo Venc.",  en: "Next Due" },
  "tasks.nextDueShort":{ es: "Próx. Venc.",  en: "Next Due" },
  "tasks.notes":     { es: "Notas",          en: "Notes" },
  "tasks.photos":    { es: "Fotos",          en: "Photos" },
  "tasks.noPhotos":  { es: "Sin fotos",      en: "No photos" },
  "tasks.createdBy": { es: "Creada por",     en: "Created by" },
  "tasks.byHours":   { es: "Por horas",      en: "By hours" },
  "tasks.crew":      { es: "Tripulación",    en: "Crew" },
  "tasks.sailor":    { es: "Marinero",       en: "Deckhand" },
  "tasks.other":     { es: "Otro",           en: "Other" },
  "tasks.required":  { es: "Requerido",      en: "Required" },

  // ─── Bitácora ───
  "log.title":       { es: "Bitácora",       en: "Logbook" },
  "log.new":         { es: "Nueva entrada",  en: "New entry" },
  "log.empty":       { es: "Sin entradas en la bitácora", en: "No logbook entries" },
  "log.type":        { es: "Tipo",           en: "Type" },
  "log.date":        { es: "Fecha",          en: "Date" },
  "log.desc":        { es: "Descripción",    en: "Description" },
  "log.by":          { es: "Realizado por",  en: "Performed by" },
  "log.inspection":  { es: "Inspección",     en: "Inspection" },
  "log.service":     { es: "Servicio",       en: "Service" },
  "log.fuel":        { es: "Combustible",    en: "Fuel" },
  "log.departure":   { es: "Salida",         en: "Departure" },
  "log.purchase":    { es: "Compra",         en: "Purchase" },
  "log.item":        { es: "Artículo",       en: "Item" },
  "log.cost":        { es: "Costo",          en: "Cost" },
  "log.payment":     { es: "Pago",           en: "Payment" },
  "log.quantity":    { es: "Cantidad",       en: "Quantity" },

  // ─── Finanzas ───
  "fin.title":       { es: "Finanzas",       en: "Finance" },
  "fin.subtitle":    { es: "El resumen de todo lo que cuesta tu embarcación.", en: "The summary of everything your vessel costs." },
  "fin.register":    { es: "Registrar gasto", en: "Log expense" },
  "fin.total":       { es: "Total",          en: "Total" },
  "fin.empty":       { es: "Sin gastos registrados", en: "No expenses recorded" },
  "fin.thisMonth":   { es: "Este mes",       en: "This month" },
  "fin.thisYear":    { es: "Este año",       en: "This year" },
  "fin.category":    { es: "Categoría",      en: "Category" },
  "fin.amount":      { es: "Monto",          en: "Amount" },
  "fin.fromLog":     { es: "desde bitácora", en: "from logbook" },
  "fin.direct":      { es: "directo",        en: "direct" },

  // ─── Registrar gasto (router) ───
  "exp.title":       { es: "Registrar gasto", en: "Log expense" },
  "exp.question":    { es: "¿Qué tipo de gasto es? Elige y lo registramos en el lugar correcto.", en: "What kind of expense is it? Choose and we'll record it in the right place." },
  "exp.opTitle":     { es: "Una compra o gasto del barco", en: "A boat purchase or expense" },
  "exp.opBody":      { es: "Algo que se compró o se pagó durante la operación: repuestos, combustible, un servicio, reparaciones.", en: "Something bought or paid during operations: parts, fuel, a service, repairs." },
  "exp.opGoes":      { es: "Se registra en la Bitácora →", en: "Recorded in the Logbook →" },
  "exp.admTitle":    { es: "Un gasto fijo o administrativo", en: "A fixed or administrative expense" },
  "exp.admBody":     { es: "Gastos que no son compras del día: seguro, marina, sueldos, matrícula, impuestos.", en: "Expenses that aren't daily purchases: insurance, marina, salaries, registration, taxes." },
  "exp.admGoes":     { es: "Se registra directo en Finanzas →", en: "Recorded directly in Finance →" },

  // ─── Dashboard ───
  "dash.welcome":    { es: "¡Bienvenido a Carive", en: "Welcome to Carive" },
  "dash.addFirst":   { es: "Agrega tu primera embarcación para empezar a gestionar tareas, bitácora, costos y más.", en: "Add your first vessel to start managing tasks, logbook, costs and more." },
  "dash.addVessel":  { es: "Agregar embarcación", en: "Add vessel" },
  "dash.fleetStatus":{ es: "Estado de la Flota", en: "Fleet Status" },
  "dash.vessels":    { es: "embarcaciones", en: "vessels" },
  "dash.alerts":     { es: "Alertas",      en: "Alerts" },
  "dash.noAlerts":   { es: "Sin alertas",  en: "No alerts" },
  "dash.see":        { es: "Ver",          en: "See" },
  "dash.indicators": { es: "Indicadores",  en: "Indicators" },
  "dash.fuel":       { es: "Combustible",  en: "Fuel" },
  "dash.engineHours":{ es: "Horas Motor",  en: "Engine Hours" },

  // ─── Founder banner ───
  "founder.title":   { es: "Acceso de Fundador", en: "Founder Access" },
  "founder.body":    { es: "Disfrutas todas las funciones gratis durante el lanzamiento. Gracias por estar entre los primeros — tendrás condiciones especiales cuando lancemos los planes.", en: "You enjoy all features free during launch. Thanks for being among the first — you'll get special conditions when we launch our plans." },
};

const LangContext = createContext({ lang: "es", setLang: () => {}, t: (k) => k });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("carive_lang") || "es");
  const setLang = useCallback((l) => { localStorage.setItem("carive_lang", l); setLangState(l); }, []);
  const t = useCallback((key, fallback) => {
    const entry = DICT[key];
    if (!entry) return fallback !== undefined ? fallback : key;
    return entry[lang] || entry.es || key;
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
