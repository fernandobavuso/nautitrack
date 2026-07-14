// ─────────────────────────────────────────────────────────────
// Países y estados/provincias de América (enfoque náutico).
// Se usa en los formularios de ubicación de embarcaciones y tiendas.
// ─────────────────────────────────────────────────────────────

export const COUNTRIES = [
  { code: "US", name: "Estados Unidos", nameEn: "United States" },
  { code: "VE", name: "Venezuela",      nameEn: "Venezuela" },
  { code: "PA", name: "Panamá",         nameEn: "Panama" },
  { code: "CO", name: "Colombia",       nameEn: "Colombia" },
  { code: "MX", name: "México",         nameEn: "Mexico" },
  { code: "DO", name: "República Dominicana", nameEn: "Dominican Republic" },
  { code: "PR", name: "Puerto Rico",    nameEn: "Puerto Rico" },
  { code: "BS", name: "Bahamas",        nameEn: "Bahamas" },
  { code: "AW", name: "Aruba",          nameEn: "Aruba" },
  { code: "CW", name: "Curazao",        nameEn: "Curaçao" },
  { code: "TT", name: "Trinidad y Tobago", nameEn: "Trinidad and Tobago" },
  { code: "CR", name: "Costa Rica",     nameEn: "Costa Rica" },
  { code: "BR", name: "Brasil",         nameEn: "Brazil" },
  { code: "AR", name: "Argentina",      nameEn: "Argentina" },
  { code: "CL", name: "Chile",          nameEn: "Chile" },
  { code: "PE", name: "Perú",           nameEn: "Peru" },
  { code: "EC", name: "Ecuador",        nameEn: "Ecuador" },
  { code: "UY", name: "Uruguay",        nameEn: "Uruguay" },
  { code: "GT", name: "Guatemala",      nameEn: "Guatemala" },
  { code: "HN", name: "Honduras",       nameEn: "Honduras" },
  { code: "BZ", name: "Belice",         nameEn: "Belize" },
  { code: "JM", name: "Jamaica",        nameEn: "Jamaica" },
  { code: "KY", name: "Islas Caimán",   nameEn: "Cayman Islands" },
  { code: "CA", name: "Canadá",         nameEn: "Canada" },
];

// Estados / provincias por país
export const STATES = {
  US: [
    "Florida", "Texas", "California", "New York", "North Carolina", "South Carolina",
    "Georgia", "Virginia", "Maryland", "New Jersey", "Massachusetts", "Rhode Island",
    "Connecticut", "Washington", "Louisiana", "Alabama", "Mississippi", "Maine",
    "Michigan", "Illinois", "Hawaii", "Alaska", "Delaware", "New Hampshire",
  ],
  VE: [
    "Anzoátegui", "Nueva Esparta", "Sucre", "Vargas (La Guaira)", "Carabobo",
    "Falcón", "Zulia", "Aragua", "Miranda", "Distrito Capital", "Monagas",
    "Delta Amacuro", "Bolívar", "Lara", "Yaracuy",
  ],
  PA: ["Panamá", "Colón", "Bocas del Toro", "Chiriquí", "Los Santos", "Veraguas", "Guna Yala"],
  CO: ["Bolívar (Cartagena)", "Magdalena (Santa Marta)", "Atlántico", "San Andrés y Providencia", "Valle del Cauca", "Antioquia"],
  MX: ["Quintana Roo", "Baja California Sur", "Baja California", "Jalisco", "Nayarit", "Veracruz", "Yucatán", "Sinaloa", "Guerrero"],
  DO: ["Distrito Nacional", "La Altagracia (Punta Cana)", "Puerto Plata", "Samaná", "La Romana", "San Pedro de Macorís"],
  PR: ["San Juan", "Fajardo", "Ponce", "Salinas", "Cabo Rojo", "Culebra", "Vieques"],
  BS: ["New Providence (Nassau)", "Grand Bahama", "Abaco", "Exuma", "Eleuthera", "Andros", "Bimini"],
  AW: ["Oranjestad", "Noord", "Savaneta"],
  CW: ["Willemstad"],
  TT: ["Puerto España", "Chaguaramas", "Tobago"],
  CR: ["Puntarenas", "Guanacaste", "Limón"],
  BR: ["Rio de Janeiro", "São Paulo", "Santa Catarina", "Bahía", "Pernambuco", "Río Grande del Sur"],
  AR: ["Buenos Aires", "Ciudad de Buenos Aires", "Río Negro", "Chubut", "Santa Fe"],
  CL: ["Valparaíso", "Los Lagos", "Biobío", "Coquimbo", "Magallanes"],
  PE: ["Lima", "Callao", "Piura", "Áncash", "Tumbes"],
  EC: ["Guayas", "Santa Elena", "Manabí", "Galápagos", "Esmeraldas"],
  UY: ["Maldonado (Punta del Este)", "Montevideo", "Canelones", "Colonia", "Rocha"],
  GT: ["Izabal", "Escuintla", "Retalhuleu"],
  HN: ["Islas de la Bahía (Roatán)", "Cortés", "Atlántida"],
  BZ: ["Belice", "Stann Creek", "Toledo"],
  JM: ["Kingston", "St. Ann (Ocho Ríos)", "Montego Bay"],
  KY: ["Gran Caimán", "Caimán Brac", "Pequeño Caimán"],
  CA: ["Columbia Británica", "Ontario", "Quebec", "Nueva Escocia", "Nuevo Brunswick"],
};

// Ciudades náuticas conocidas por estado (para sugerir al escribir)
export const CITIES = {
  "Florida": [
    "Miami", "Coconut Grove", "Coral Gables", "Key Biscayne", "Miami Beach",
    "Fort Lauderdale", "Hollywood", "Aventura", "Dania Beach", "Pompano Beach",
    "Boca Raton", "West Palm Beach", "Jupiter", "Stuart", "Fort Pierce",
    "Vero Beach", "Melbourne", "Cocoa Beach", "Daytona Beach", "Jacksonville",
    "St. Augustine", "Tampa", "St. Petersburg", "Clearwater", "Sarasota",
    "Naples", "Fort Myers", "Cape Coral", "Punta Gorda", "Marco Island",
    "Key Largo", "Islamorada", "Marathon", "Key West", "Palm Beach",
  ],
  "Texas": ["Galveston", "Corpus Christi", "South Padre Island", "Kemah", "Port Aransas", "Houston"],
  "California": ["San Diego", "Newport Beach", "Marina del Rey", "Long Beach", "Santa Barbara", "San Francisco", "Dana Point"],
  "New York": ["Nueva York", "Montauk", "Sag Harbor", "Greenport", "Port Washington"],
  "North Carolina": ["Wilmington", "Beaufort", "Morehead City", "Wrightsville Beach"],
  "South Carolina": ["Charleston", "Hilton Head", "Myrtle Beach", "Georgetown"],
  "Georgia": ["Savannah", "Brunswick", "St. Simons Island"],
  "Maryland": ["Annapolis", "Baltimore", "Ocean City", "Solomons"],
  "Rhode Island": ["Newport", "Providence", "Bristol"],
  "Massachusetts": ["Boston", "Nantucket", "Martha's Vineyard", "Cape Cod", "New Bedford"],
  "Louisiana": ["Nueva Orleans", "Lafayette", "Venice"],
  "Washington": ["Seattle", "Anacortes", "Bellingham", "Tacoma"],

  "Anzoátegui": ["Lechería", "Puerto La Cruz", "Barcelona", "El Morro", "Guanta"],
  "Nueva Esparta": ["Porlamar", "Pampatar", "Juan Griego", "El Yaque"],
  "Sucre": ["Cumaná", "Carúpano", "Río Caribe", "Mochima"],
  "Vargas (La Guaira)": ["La Guaira", "Caraballeda", "Naiguatá", "Macuto"],
  "Carabobo": ["Puerto Cabello", "Valencia"],
  "Falcón": ["Tucacas", "Chichiriviche", "Coro", "Punto Fijo"],
  "Zulia": ["Maracaibo", "Cabimas"],
  "Distrito Capital": ["Caracas"],
  "Miranda": ["Higuerote", "Río Chico", "Guatire"],

  "Panamá": ["Ciudad de Panamá", "Amador", "Taboga"],
  "Colón": ["Colón", "Portobelo", "Shelter Bay"],
  "Bocas del Toro": ["Bocas del Toro", "Isla Colón"],
  "Guna Yala": ["San Blas", "El Porvenir"],

  "Bolívar (Cartagena)": ["Cartagena", "Islas del Rosario"],
  "Magdalena (Santa Marta)": ["Santa Marta", "Taganga"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],

  "Quintana Roo": ["Cancún", "Cozumel", "Playa del Carmen", "Isla Mujeres", "Puerto Aventuras", "Tulum"],
  "Baja California Sur": ["Cabo San Lucas", "San José del Cabo", "La Paz", "Loreto"],
  "Jalisco": ["Puerto Vallarta"],
  "Nayarit": ["Nuevo Vallarta", "Punta Mita"],

  "La Altagracia (Punta Cana)": ["Punta Cana", "Bávaro", "Cap Cana"],
  "Puerto Plata": ["Puerto Plata", "Sosúa", "Cabarete"],
  "Samaná": ["Samaná", "Las Terrenas"],
  "La Romana": ["La Romana", "Casa de Campo"],

  "San Juan": ["San Juan", "Isla Verde"],
  "Fajardo": ["Fajardo", "Puerto del Rey"],

  "New Providence (Nassau)": ["Nassau", "Paradise Island"],
  "Grand Bahama": ["Freeport", "Lucaya"],
  "Abaco": ["Marsh Harbour", "Hope Town", "Green Turtle Cay"],
  "Exuma": ["George Town", "Staniel Cay"],
  "Bimini": ["Alice Town", "Bimini"],

  "Oranjestad": ["Oranjestad", "Palm Beach"],
  "Willemstad": ["Willemstad", "Spanish Water"],
  "Chaguaramas": ["Chaguaramas", "Puerto España"],
  "Puntarenas": ["Puntarenas", "Quepos", "Golfito"],
  "Guanacaste": ["Papagayo", "Flamingo", "Tamarindo"],
  "Islas de la Bahía (Roatán)": ["Roatán", "Utila", "Guanaja"],
  "Maldonado (Punta del Este)": ["Punta del Este", "Piriápolis", "José Ignacio"],
  "Galápagos": ["Puerto Ayora", "San Cristóbal"],
};

/** Estados de un país */
export const statesOf = (countryCode) => STATES[countryCode] || [];

/** Ciudades sugeridas de un estado */
export const citiesOf = (state) => CITIES[state] || [];

/** Buscar ciudades por texto dentro de un estado (autocompletado) */
export function suggestCities(state, query) {
  const list = citiesOf(state);
  const q = (query || "").toLowerCase().trim();
  if (!q) return list.slice(0, 8);
  return list.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
}

/** Nombre del país por código, según idioma */
export const countryName = (code, lang = "es") => {
  const c = COUNTRIES.find(x => x.code === code);
  if (!c) return code;
  return lang === "en" ? c.nameEn : c.name;
};
