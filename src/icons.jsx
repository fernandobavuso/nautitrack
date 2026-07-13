// Íconos de línea simples y elegantes, estilo Carive (consistentes con la landing).
// Todos toman color e (size) por props. Trazo limpio, sin relleno.

const base = (size = 20, color = "currentColor") => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
});

export const IconBell = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
);

export const IconFuel = ({ size, color }) => (
  <svg {...base(size, color)}><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.5L18 6"/></svg>
);

export const IconEngine = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
);

export const IconBolt = ({ size, color }) => (
  <svg {...base(size, color)}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

export const IconCalendar = ({ size, color }) => (
  <svg {...base(size, color)}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);

export const IconAlert = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);

export const IconAnchor = ({ size, color }) => (
  <svg {...base(size, color)}><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
);

export const IconWrench = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
);

export const IconChart = ({ size, color }) => (
  <svg {...base(size, color)}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
);

export const IconCalendarDoc = IconCalendar;

export const IconBoat = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M2 20a6 6 0 0 0 12 0 6 6 0 0 0 6 0"/><path d="M4 18l-1-9h18l-2 6"/><path d="M12 3v6"/><path d="M8 9V6a4 4 0 0 1 8 0"/></svg>
);

export const IconBook = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
);

export const IconTrash = ({ size, color }) => (
  <svg {...base(size, color)}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);

export const IconCheck = ({ size, color }) => (
  <svg {...base(size, color)}><polyline points="20 6 9 17 4 12"/></svg>
);

export const IconClose = ({ size, color }) => (
  <svg {...base(size, color)}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

export const IconPlus = ({ size, color }) => (
  <svg {...base(size, color)}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

export const IconClock = ({ size, color }) => (
  <svg {...base(size, color)}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export const IconSearch = ({ size, color }) => (
  <svg {...base(size, color)}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);

export const IconMoney = ({ size, color }) => (
  <svg {...base(size, color)}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);

export const IconShield = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);

export const IconClipboard = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
);

export const IconCheckCircle = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);

// ── Íconos de sistemas del barco ──
export const IconGear = ({ size, color }) => (
  <svg {...base(size, color)}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
export const IconPlug = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/></svg>
);
export const IconDrop = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
);
export const IconSnow = ({ size, color }) => (
  <svg {...base(size, color)}><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
);
export const IconCompass = ({ size, color }) => (
  <svg {...base(size, color)}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
);
export const IconSpiral = ({ size, color }) => (
  <svg {...base(size, color)}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>
);
export const IconSail = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M3 20h18"/><path d="M5 20l7-16v16"/><path d="M12 6l6 14"/></svg>
);
export const IconHome = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
export const IconSofa = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><path d="M3 13a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4H3z"/><line x1="6" y1="21" x2="6" y2="17"/><line x1="18" y1="21" x2="18" y2="17"/></svg>
);
export const IconDinghy = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M2 18a5 5 0 0 0 10 0 5 5 0 0 0 10 0"/><path d="M4 16l2-6h12l2 6"/><line x1="12" y1="4" x2="12" y2="10"/></svg>
);
export const IconBolt2 = ({ size, color }) => (
  <svg {...base(size, color)}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

// Mapa: id de sistema -> componente de ícono
import React from "react";
const SYSTEM_ICON_MAP = {
  motores: IconWrench, generador: IconBolt2, seakeeper: IconSpiral, casco: IconBoat,
  eje: IconGear, electrico: IconPlug, agua: IconDrop, ac: IconSnow,
  navegacion: IconCompass, hidraulico: IconGear, seguridad: IconShield, velas: IconSail,
  cubierta: IconHome, interior: IconSofa, dinghy: IconDinghy,
};
export function SystemIcon({ id, size = 20, color = "#475569" }) {
  const Cmp = SYSTEM_ICON_MAP[id] || IconWrench;
  return <Cmp size={size} color={color} />;
}

export const IconUser = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
export const IconCard = ({ size, color }) => (
  <svg {...base(size, color)}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
);
export const IconLogout = ({ size, color }) => (
  <svg {...base(size, color)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);

// Buzón / bandeja de entrada (para "Mis Aplicaciones")
export const IconInbox = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

// Certificado / diploma
export const IconCertificate = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6"/>
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
);

// Barco / embarcación (historial)
export const IconVessel = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20a2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1"/>
    <path d="M4 18 2 14h20l-2 4"/>
    <path d="M12 3v11"/>
    <path d="M7 14V9a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5"/>
  </svg>
);

// Medalla / logro (badges)
export const IconMedal = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/>
    <path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/>
    <circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/>
  </svg>
);

// Carpeta
export const IconFolder = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
  </svg>
);

// Subir / upload
export const IconUpload = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

// Globo / idiomas
export const IconGlobe = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
