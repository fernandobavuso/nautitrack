import { useState, useRef, useEffect } from "react";
import { COUNTRIES, statesOf, suggestCities, countryName } from "./locations.js";
import { useLang } from "./i18n.jsx";

// ─────────────────────────────────────────────────────────────
// Selector de ubicación en cascada: País → Estado → Ciudad
// La ciudad tiene autocompletado según el estado elegido,
// pero permite escribir libremente (por si no está en la lista).
// ─────────────────────────────────────────────────────────────

export default function LocationFields({ country, state, city, onChange, labelStyle, inputStyle }) {
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const boxRef = useRef(null);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setShowSug(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const states = statesOf(country);

  const setCountry = (c) => onChange({ country: c, state: "", city: "" });   // reset cascada
  const setState   = (s) => onChange({ country, state: s, city: "" });
  const setCity    = (c) => onChange({ country, state, city: c });

  const onCityType = (v) => {
    setCity(v);
    if (state) {
      setCitySuggestions(suggestCities(state, v));
      setShowSug(true);
    }
  };

  const lbl = labelStyle || { display:"block", fontSize:12, color:"#475569", fontWeight:600, marginBottom:5 };
  const inp = inputStyle || { width:"100%", padding:"10px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13, boxSizing:"border-box" };

  return (
    <>
      {/* País */}
      <div>
        <label style={lbl}>{L("País", "Country")}</label>
        <select value={country || ""} onChange={e => setCountry(e.target.value)} style={inp}>
          <option value="">{L("Selecciona un país...", "Select a country...")}</option>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{countryName(c.code, lang)}</option>
          ))}
        </select>
      </div>

      {/* Estado / Provincia */}
      <div>
        <label style={lbl}>{L("Estado / Provincia", "State / Province")}</label>
        <select value={state || ""} onChange={e => setState(e.target.value)} style={inp} disabled={!country}>
          <option value="">
            {country ? L("Selecciona un estado...", "Select a state...") : L("Elige un país primero", "Choose a country first")}
          </option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Ciudad con autocompletado */}
      <div style={{position:"relative"}} ref={boxRef}>
        <label style={lbl}>{L("Ciudad", "City")}</label>
        <input
          value={city || ""}
          onChange={e => onCityType(e.target.value)}
          onFocus={() => { if (state) { setCitySuggestions(suggestCities(state, city)); setShowSug(true); } }}
          placeholder={state ? L("Escribe o elige tu ciudad...", "Type or pick your city...") : L("Elige un estado primero", "Choose a state first")}
          disabled={!state}
          style={inp}
          autoComplete="off"
        />
        {showSug && citySuggestions.length > 0 && (
          <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,boxShadow:"0 10px 30px rgba(10,37,64,.12)",zIndex:60,maxHeight:220,overflowY:"auto"}}>
            {citySuggestions.map(c => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setCity(c); setShowSug(false); }}
                style={{display:"block",width:"100%",textAlign:"left",padding:"9px 12px",border:"none",background:"#fff",cursor:"pointer",fontSize:13,color:"#0f172a"}}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {state && (
          <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>
            {L("Si tu ciudad no aparece, escríbela igual.", "If your city isn't listed, type it anyway.")}
          </div>
        )}
      </div>
    </>
  );
}
