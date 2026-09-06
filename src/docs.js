// Estado de vencimiento de un documento: vigente, por vencer o vencido
export function docExpiry(expiresAt, lang="es") {
  if (!expiresAt) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  const d = new Date(String(expiresAt).slice(0,10) + "T00:00:00");
  const days = Math.round((d - t) / 86400000);
  const f = d.toLocaleDateString("en-US");
  if (days < 0)  return { days, label: lang==="en" ? `Expired ${Math.abs(days)}d ago` : `Vencido hace ${Math.abs(days)}d`, bg:"#fef2f2", color:"#dc2626", date:f };
  if (days <= 30) return { days, label: lang==="en" ? `Expires in ${days}d` : `Vence en ${days}d`, bg:"#fffbeb", color:"#b45309", date:f };
  return { days, label: lang==="en" ? `Valid until ${f}` : `Vigente hasta ${f}`, bg:"#f0fdf4", color:"#15803d", date:f };
}

