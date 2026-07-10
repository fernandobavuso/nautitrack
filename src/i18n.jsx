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
