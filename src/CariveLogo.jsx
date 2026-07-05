// Logo oficial de Carive — escudo/emblema con vela y ola (opción 7).
// Un solo lugar para todo el sitio. Cambia aquí y cambia en toda la app.

export default function CariveLogo({ size = 32, variant = "color" }) {
  // variant: "color" (degradado azul→cyan) o "light" (para fondos oscuros)
  const gid = `carive-shield-${variant}`;
  const stroke = variant === "light" ? "#38bdf8" : `url(#${gid})`;
  const sail = variant === "light" ? "#38bdf8" : `url(#${gid})`;
  const wave = variant === "light" ? "#7dd3fc" : "#38bdf8";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Escudo */}
      <path d="M24 4 L40 10 V24 C40 34 24 44 24 44 C24 44 8 34 8 24 V10 Z" stroke={stroke} strokeWidth="3" fill="none" strokeLinejoin="round" />
      {/* Vela */}
      <path d="M24 14 L31 30 H17 Z" fill={sail} />
      {/* Ola */}
      <path d="M15 33 Q24 29 33 33" stroke={wave} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
