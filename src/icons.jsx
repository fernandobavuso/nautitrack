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
