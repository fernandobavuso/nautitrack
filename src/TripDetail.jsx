import { useState } from "react";

// Detalle de una salida: combustible consumido, horas de uso, tripulación y notas.
// La fila solo cabe el resumen; esto se despliega bajo demanda.
export default function TripDetail({ e, lang }) {
  const [open, setOpen] = useState(false);
  // La app trae los campos en camelCase y la vista de dueño directo de la base en
  // snake_case: se acepta cualquiera de los dos.
  const g = (a, b) => (e[a] !== undefined && e[a] !== null && e[a] !== "" ? e[a] : e[b]);
  const L = (es,en)=>lang==="en"?en:es;
  const n = (x) => { const v = Number(x); return isNaN(v) ? null : v; };
  const maxOf = (x) => {
    if (x == null || x === "") return null;
    if (typeof x === "object") { const v = Object.values(x).map(Number).filter(k=>!isNaN(k)); return v.length?Math.max(...v):null; }
    return n(x);
  };

  const fo = n(g("fuelOut","fuel_out")), fi = n(g("fuelIn","fuel_in"));
  const eo = maxOf(g("engineHrsOut","eng_out")), ei = maxOf(g("engineHrsIn","eng_in"));
  const go = maxOf(g("genHrsOut","gen_out")),    gi = maxOf(g("genHrsIn","gen_in"));
  const r1 = (v) => Math.round(v*10)/10;

  const rows = [];
  if (fo != null || fi != null) {
    const gasto = (fo != null && fi != null && fo >= fi) ? fo - fi : null;
    rows.push([L("Combustible","Fuel"),
      `${fo ?? "—"} → ${fi ?? "—"}${gasto != null ? `  (${L("consumo","used")}: ${r1(gasto)})` : ""}`]);
  }
  if (eo != null || ei != null) {
    const uso = (eo != null && ei != null && ei >= eo) ? ei - eo : null;
    rows.push([L("Horas motor","Engine hours"),
      `${eo ?? "—"} → ${ei ?? "—"}${uso != null ? `  (${r1(uso)}h ${L("de uso","used")})` : ""}`]);
  }
  if (go != null || gi != null) {
    const uso = (go != null && gi != null && gi >= go) ? gi - go : null;
    rows.push([L("Horas generador","Generator hours"),
      `${go ?? "—"} → ${gi ?? "—"}${uso != null ? `  (${r1(uso)}h)` : ""}`]);
  }
  if (g("ownerAboard","owner_aboard")) rows.push([L("Dueño a bordo","Owner aboard"), g("ownerName","owner_name") || L("Sí","Yes")]);
  if (Array.isArray(g("crewSel","crew_sel")) && g("crewSel","crew_sel").length) rows.push([L("Tripulación","Crew"), g("crewSel","crew_sel").join(", ")]);
  if (g("salidaClima","clima")) rows.push([L("Clima","Weather"), g("salidaClima","clima")]);
  if (g("desc","description")) rows.push([L("Notas","Notes"), g("desc","description")]);

  if (!rows.length) return null;

  return (
    <>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"block",width:"100%",textAlign:"center",marginTop:5,background:"none",border:"none",padding:0,color:"#2563eb",fontSize:11,fontWeight:700,cursor:"pointer"}}>
        {open ? L("ocultar detalle","hide details") : L("ver detalle","view details")}
      </button>
      {open && (
        <div style={{marginTop:6,background:"#f8fafc",borderRadius:8,padding:"8px 10px",display:"flex",flexDirection:"column",gap:4}}>
          {rows.map(([k,v],i)=>(
            <div key={i} style={{display:"flex",gap:8,fontSize:11,lineHeight:1.5}}>
              <span style={{color:"#94a3b8",fontWeight:600,minWidth:104,flexShrink:0}}>{k}</span>
              <span style={{color:"#334155",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

