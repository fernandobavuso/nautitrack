// Utilidades de ubicación para el match tienda ↔ solicitud.
// Sin dependencias externas: ubicación del navegador + base de ciudades conocidas.

// Ciudades frecuentes con coordenadas (respaldo cuando no hay GPS).
// Cubre zonas de Venezuela (Oriente/Caribe) y Sur de Florida. Ampliable.
export const KNOWN_CITIES = [
  // Venezuela
  { name: "Lechería", country: "ve", lat: 10.1857, lng: -64.6957 },
  { name: "Puerto La Cruz", country: "ve", lat: 10.2138, lng: -64.6318 },
  { name: "Barcelona", country: "ve", lat: 10.1340, lng: -64.6836 },
  { name: "El Morro", country: "ve", lat: 10.1900, lng: -64.6600 },
  { name: "Cumaná", country: "ve", lat: 10.4531, lng: -64.1814 },
  { name: "Margarita (Porlamar)", country: "ve", lat: 10.9577, lng: -63.8697 },
  { name: "Pampatar", country: "ve", lat: 10.9990, lng: -63.7960 },
  { name: "Caraballeda", country: "ve", lat: 10.6117, lng: -66.8494 },
  { name: "La Guaira", country: "ve", lat: 10.6017, lng: -66.9317 },
  { name: "Caracas", country: "ve", lat: 10.4806, lng: -66.9036 },
  { name: "Tucacas", country: "ve", lat: 10.7986, lng: -68.3200 },
  { name: "Puerto Cabello", country: "ve", lat: 10.4731, lng: -68.0125 },
  { name: "Maracaibo", country: "ve", lat: 10.6545, lng: -71.6404 },
  { name: "Valencia", country: "ve", lat: 10.1620, lng: -68.0077 },
  // Sur de Florida
  { name: "Miami", country: "us", lat: 25.7617, lng: -80.1918 },
  { name: "Coconut Grove", country: "us", lat: 25.7284, lng: -80.2373 },
  { name: "Coral Gables", country: "us", lat: 25.7215, lng: -80.2684 },
  { name: "Miami Beach", country: "us", lat: 25.7907, lng: -80.1300 },
  { name: "Key Biscayne", country: "us", lat: 25.6937, lng: -80.1626 },
  { name: "Fort Lauderdale", country: "us", lat: 26.1224, lng: -80.1373 },
  { name: "Hollywood, FL", country: "us", lat: 26.0112, lng: -80.1495 },
  { name: "Aventura", country: "us", lat: 25.9565, lng: -80.1390 },
  { name: "Dania Beach", country: "us", lat: 26.0523, lng: -80.1437 },
  { name: "Pompano Beach", country: "us", lat: 26.2379, lng: -80.1248 },
  { name: "Boca Raton", country: "us", lat: 26.3683, lng: -80.1289 },
  { name: "West Palm Beach", country: "us", lat: 26.7153, lng: -80.0534 },
  { name: "Stuart, FL", country: "us", lat: 27.1975, lng: -80.2528 },
  { name: "Naples, FL", country: "us", lat: 26.1420, lng: -81.7948 },
  { name: "Tampa", country: "us", lat: 27.9506, lng: -82.4572 },
  { name: "Key West", country: "us", lat: 24.5551, lng: -81.7800 },
];

// Distancia en km entre dos coordenadas (Haversine)
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null || isNaN(v))) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export const kmToMi = (km) => km * 0.621371;
export const miToKm = (mi) => mi / 0.621371;

// Pedir la ubicación actual del navegador (devuelve {lat, lng} o error)
export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Tu navegador no soporta ubicación")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Buscar coordenadas de una ciudad por nombre (match aproximado)
export function findCityCoords(cityName) {
  const q = (cityName || "").toLowerCase().trim();
  if (!q) return null;
  // Coincidencia por inclusión en ambos sentidos (tolera "Marina de Lechería" ~ "Lechería")
  return KNOWN_CITIES.find(c => {
    const n = c.name.toLowerCase();
    return n.includes(q) || q.includes(n.split(" ")[0]);
  }) || null;
}

// Buscar ciudades por texto (para el selector de respaldo)
export function searchCities(query) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return [];
  return KNOWN_CITIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
}
