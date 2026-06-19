// Sistema central de permisos de NautiTrack
// Define qué puede hacer cada rol sobre un barco.
// El "rol" aquí es el rol de la persona SOBRE ESTE barco: 'owner' | 'captain' | 'manager'

export const ROLE_OWNER = "owner";
export const ROLE_CAPTAIN = "captain";
export const ROLE_MANAGER = "manager";

// Capacidades posibles en el sistema
// Cada una es true/false según el rol
const PERMISSIONS = {
  owner: {
    viewDashboard: true,
    // Tareas
    viewTasks: true, createTask: true, editTask: true, completeTask: true, deleteTask: true,
    // Bitácora
    viewLog: true, createLog: true, deleteLog: true,
    // Costos y records
    viewCosts: true, viewRecords: true,
    // Repuestos
    viewInventory: true, editInventory: true, requestParts: true,
    partsLimit: Infinity,           // sin tope
    // Documentos
    viewDocs: true, uploadDocs: true, deleteDocs: true,
    // IA y manuales
    useAI: true, viewManuals: true,
    // Proveedores
    viewProviders: true, editProviders: true,
    // Marketplace de tripulación
    viewCrewMarket: true,
    // Administración del barco
    editVessel: true, managePlan: true, manageCaptain: true, generateReports: true, configureSettings: true,
  },
  captain: {
    viewDashboard: true,
    viewTasks: true, createTask: true, editTask: true, completeTask: true, deleteTask: false,
    viewLog: true, createLog: true, deleteLog: false,
    viewCosts: false, viewRecords: false,
    viewInventory: true, editInventory: true, requestParts: true,
    partsLimit: 100,                // tope por defecto, configurable por el dueño
    viewDocs: true, uploadDocs: true, deleteDocs: false,
    useAI: true, viewManuals: true,
    viewProviders: true, editProviders: false,   // el dueño decide si puede editar
    viewCrewMarket: false,
    editVessel: false, managePlan: false, manageCaptain: false, generateReports: false, configureSettings: false,
  },
  manager: {
    // El gestor: casi como el dueño, pero no toca el plan (lo paga el dueño o la empresa)
    viewDashboard: true,
    viewTasks: true, createTask: true, editTask: true, completeTask: true, deleteTask: true,
    viewLog: true, createLog: true, deleteLog: true,
    viewCosts: true, viewRecords: true,
    viewInventory: true, editInventory: true, requestParts: true,
    partsLimit: Infinity,
    viewDocs: true, uploadDocs: true, deleteDocs: true,
    useAI: true, viewManuals: true,
    viewProviders: true, editProviders: true,
    viewCrewMarket: true,
    editVessel: true, managePlan: false, manageCaptain: true, generateReports: true, configureSettings: true,
  },
};

// ¿Puede este rol hacer esta acción?
export function can(role, action) {
  const set = PERMISSIONS[role] || PERMISSIONS.captain;
  return !!set[action];
}

// Tope de gasto en repuestos para este rol (el dueño puede sobreescribir el del capitán)
export function partsLimit(role, overrideLimit) {
  if (role === "captain" && overrideLimit != null && overrideLimit !== "") return Number(overrideLimit);
  const set = PERMISSIONS[role] || PERMISSIONS.captain;
  return set.partsLimit;
}

export default PERMISSIONS;
