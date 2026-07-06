import { useState } from "react";
import { getBrowserLocation, searchCities } from "./geo.js";

// Selector de ubicación: botón "usar mi ubicación" (GPS del navegador)
// + buscador de ciudades como respaldo. Devuelve {lat, lng, label} via onChange.
export default function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const useMyLocation = async () => {
    setLoading(true); setMsg("");
    try {
      const { lat, lng } = await getBrowserLocation();
      onChange({ lat, lng, label: "Mi ubicación actual" });
      setQuery("Mi ubicación actual");
      setResults([]);
      setMsg("✓ Ubicación detectada");
    } catch (e) {
      setMsg("No pudimos obtener tu ubicación. Búscala por ciudad abajo.");
    }
    setLoading(false);
  };

  const onType = (v) => {
    setQuery(v);
    setResults(searchCities(v));
  };

  const pick = (c) => {
    onChange({ lat: c.lat, lng: c.lng, label: c.name });
    setQuery(c.name);
    setResults([]);
    setMsg("");
  };

  return (
    <div>
      <button type="button" onClick={useMyLocation} disabled={loading} style={{width:"100%",padding:"11px",background:"#eff6ff",border:"1.5px solid #bae6fd",borderRadius:9,color:"#2563eb",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/></svg>
        {loading ? "Detectando..." : "Usar mi ubicación actual"}
      </button>
      <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginBottom:8}}>o busca tu ciudad</div>
      <div style={{position:"relative"}}>
        <input value={query} onChange={e=>onType(e.target.value)} placeholder="Escribe tu ciudad..." style={{width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,boxSizing:"border-box"}}/>
        {results.length>0 && (
          <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,boxShadow:"0 10px 30px rgba(10,37,64,.12)",zIndex:50,overflow:"hidden"}}>
            {results.map((c,i)=>(
              <button key={i} type="button" onClick={()=>pick(c)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 12px",border:"none",background:"#fff",cursor:"pointer",fontSize:13,color:"#0f172a"}}>
                {c.name} <span style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase"}}>{c.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {msg && <div style={{fontSize:11,color:msg.startsWith("✓")?"#16a34a":"#d97706",marginTop:6}}>{msg}</div>}
      {value?.lat && <div style={{fontSize:11,color:"#64748b",marginTop:6}}>📍 Ubicación guardada: {value.label}</div>}
    </div>
  );
}
