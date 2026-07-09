import { useState } from "react";
import CariveLogo from "./CariveLogo";

const VESSEL_TYPES = [
  "Yate Motor","Velero","Catamarán","Lancha","Bote de Pesca",
  "Barco de Trabajo","Yate de Vela","Otro"
];

export default function AddVessel({ onAdd, onSkip, isOnboarding }) {
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm]     = useState({
    name:"", type:"",
    marinaName:"", city:"", country:"Venezuela",
    captain:"",
    brand:"", model:"", lengthFt:"",
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      // Build marina string for weather: "MarinaName, City, Country"
      const marinaParts = [form.marinaName, form.city, form.country].filter(Boolean);
      const marinaStr   = marinaParts.join(", ");

      await onAdd({
        name:         form.name,
        type:         form.type || "Yate Motor",
        marina:       marinaStr,
        captain:      form.captain || "",
        fuel:         0,
        fuel_unit:    "gal",
        engine_hours: 0,
        gen_hours:    0,
        status:       "ok",
        details: {
          city:      form.city || "",
          state:     "",
          country:   form.country || "Venezuela",
          _profile: {
            brand:     form.brand || "",
            model:     form.model || "",
            lengthFt:  form.lengthFt || "",
            city:      form.city || "",
            state:     "",
            country:   form.country || "Venezuela",
          }
        },
        crew:         [],
        motors:       [],
        generators:   [],
        custom_systems: [],
        providers:    [],
      });
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <CariveLogo size={44} />
          <div style={s.headerText}>
            <div style={s.title}>{isOnboarding ? "Configura tu embarcación" : "Agrega tu primera embarcación"}</div>
            <div style={s.subtitle}>{isOnboarding ? "Un último paso y tu panel estará listo. Puedes editar todo después." : "Puedes editar todos los detalles después"}</div>
          </div>
        </div>

        {/* Progress */}
        <div style={s.progress}>
          {[1,2,3].map(i=>(
            <div key={i} style={{...s.progressDot, background:step>=i?"#0ea5e9":"#e2e8f0"}}/>
          ))}
        </div>

        {/* Step 1 — Basic info */}
        {step===1&&(
          <div style={s.form}>
            <div style={s.stepTitle}>📋 Información básica</div>

            <div>
              <label style={s.label}>Nombre de la embarcación *</label>
              <input value={form.name} onChange={e=>set("name",e.target.value)}
                placeholder="Ej: La Gaviota" style={s.input} autoFocus/>
            </div>

            <div>
              <label style={s.label}>Tipo de embarcación</label>
              <div style={s.chipGrid}>
                {VESSEL_TYPES.map(t=>(
                  <button key={t} onClick={()=>set("type",t)} style={{
                    ...s.chip,
                    background:form.type===t?"#eff6ff":"#f8fafc",
                    borderColor:form.type===t?"#2563eb":"#e2e8f0",
                    color:form.type===t?"#2563eb":"#64748b",
                    fontWeight:form.type===t?600:400,
                  }}>{t}</button>
                ))}
              </div>
            </div>

            <button onClick={()=>form.name.trim()&&setStep(2)} style={{...s.btn,opacity:form.name.trim()?1:0.5}}>
              Siguiente →
            </button>
          </div>
        )}

        {/* Step 2 — Marca, modelo, eslora */}
        {step===2&&(
          <div style={s.form}>
            <div style={s.stepTitle}>🛥️ Datos del barco</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={s.label}>Marca</label>
                <input value={form.brand} onChange={e=>set("brand",e.target.value)}
                  placeholder="Ej: Sea Ray" style={s.input}/>
              </div>
              <div>
                <label style={s.label}>Modelo</label>
                <input value={form.model} onChange={e=>set("model",e.target.value)}
                  placeholder="Ej: 65L" style={s.input}/>
              </div>
            </div>

            <div>
              <label style={s.label}>Eslora (pies)</label>
              <input type="number" value={form.lengthFt} onChange={e=>set("lengthFt",e.target.value)}
                placeholder="Ej: 65" style={s.input}/>
            </div>

            <div>
              <label style={s.label}>Nombre del Capitán</label>
              <input value={form.captain} onChange={e=>set("captain",e.target.value)}
                placeholder="Ej: Carlos Mendoza" style={s.input}/>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setStep(1)} style={s.btnOutline}>← Atrás</button>
              <button onClick={()=>setStep(3)} style={{...s.btn,flex:1}}>Siguiente →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Marina y ubicación */}
        {step===3&&(
          <div style={s.form}>
            <div style={s.stepTitle}>📍 Ubicación del barco</div>

            <div>
              <label style={s.label}>Nombre de la marina / puerto base</label>
              <input value={form.marinaName} onChange={e=>set("marinaName",e.target.value)}
                placeholder="Ej: Marina Bahía Redonda" style={s.input}/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={s.label}>Ciudad</label>
                <input value={form.city} onChange={e=>set("city",e.target.value)}
                  placeholder="Ej: Puerto La Cruz" style={s.input}/>
              </div>
              <div>
                <label style={s.label}>País</label>
                <input value={form.country} onChange={e=>set("country",e.target.value)}
                  placeholder="Venezuela" style={s.input}/>
              </div>
            </div>

            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#0369a1"}}>
              📡 Usamos ciudad + país para mostrar el clima en tiempo real de tu embarcación
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setStep(2)} style={s.btnOutline}>← Atrás</button>
              <button onClick={handleAdd} disabled={loading} style={{...s.btn,flex:1,opacity:loading?0.7:1}}>
                {loading?"⏳ Guardando...":"🚢 Crear embarcación"}
              </button>
            </div>
          </div>
        )}

        {/* Skip */}
        <button onClick={onSkip} style={s.skipBtn}>{isOnboarding ? "Explorar la app primero (agregar barco después)" : "Saltar por ahora"}</button>
      </div>
    </div>
  );
}

const s = {
  root:      {minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#f0f7ff,#e8f4fd)",padding:20,fontFamily:"'Segoe UI',system-ui,sans-serif"},
  card:      {background:"#fff",borderRadius:20,padding:"32px 28px",width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,0.1)",border:"1px solid #e2e8f0"},
  header:    {display:"flex",alignItems:"center",gap:14,marginBottom:20},
  headerText:{},
  title:     {fontSize:18,fontWeight:700,color:"#0f172a"},
  subtitle:  {fontSize:12,color:"#64748b",marginTop:2},
  progress:  {display:"flex",gap:6,marginBottom:24},
  progressDot:{height:4,flex:1,borderRadius:4,transition:"background 0.3s"},
  stepTitle: {fontSize:14,fontWeight:700,color:"#0f172a",marginBottom:4},
  form:      {display:"flex",flexDirection:"column",gap:14},
  label:     {display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:5},
  input:     {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"},
  chipGrid:  {display:"flex",flexWrap:"wrap",gap:7,marginTop:4},
  chip:      {padding:"6px 12px",border:"1.5px solid",borderRadius:20,fontSize:12,cursor:"pointer",transition:"all 0.15s"},
  btn:       {padding:"12px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"},
  btnOutline:{padding:"12px 16px",border:"1.5px solid #e2e8f0",borderRadius:9,background:"#fff",color:"#475569",fontSize:14,fontWeight:500,cursor:"pointer"},
  skipBtn:   {display:"block",width:"100%",marginTop:16,background:"none",border:"none",color:"#94a3b8",fontSize:12,cursor:"pointer",textAlign:"center"},
};