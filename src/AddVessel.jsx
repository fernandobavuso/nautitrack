import { useState } from "react";

const VESSEL_TYPES = [
  "Yate Motor","Velero","Catamarán","Lancha","Bote de Pesca",
  "Barco de Trabajo","Yate de Vela","Otro"
];

const MARINAS_VZ = [
  "Puerto La Cruz","Margarita / Porlamar","Tucacas","Los Roques",
  "La Guaira","Caraballeda","Chichiriviche","Cumaná","Mochima","Otra"
];

export default function AddVessel({ onAdd, onSkip }) {
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm]     = useState({
    name:"", type:"", marina:"", captain:"",
    fuel:0, fuelUnit:"gal", engineHours:0, genHours:0,
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await onAdd({
        name:         form.name,
        type:         form.type || "Yate Motor",
        marina:       form.marina || "",
        captain:      form.captain || "",
        fuel:         parseFloat(form.fuel) || 0,
        fuel_unit:    form.fuelUnit,
        engine_hours: parseFloat(form.engineHours) || 0,
        gen_hours:    parseFloat(form.genHours) || 0,
        status:       "ok",
        details:      {},
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
          <svg width="40" height="40" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" fill="#0ea5e9" opacity=".15"/>
            <path d="M15 4 L27 24 H3 Z" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinejoin="round"/>
            <line x1="15" y1="4" x2="15" y2="24" stroke="#0ea5e9" strokeWidth="1.4"/>
            <path d="M5 24 Q15 19 25 24" stroke="#0ea5e9" strokeWidth="2" fill="none"/>
          </svg>
          <div style={s.headerText}>
            <div style={s.title}>Agrega tu primera embarcación</div>
            <div style={s.subtitle}>Puedes editar todos los detalles después</div>
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

        {/* Step 2 — Location & crew */}
        {step===2&&(
          <div style={s.form}>
            <div style={s.stepTitle}>📍 Ubicación y capitán</div>

            <div>
              <label style={s.label}>Marina / Puerto base</label>
              <select value={form.marina} onChange={e=>set("marina",e.target.value)} style={s.input}>
                <option value="">Seleccionar...</option>
                {MARINAS_VZ.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
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

        {/* Step 3 — Readings */}
        {step===3&&(
          <div style={s.form}>
            <div style={s.stepTitle}>⚙️ Lecturas actuales <span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>(opcional)</span></div>

            <div>
              <label style={s.label}>Combustible actual</label>
              <div style={{display:"flex",gap:8}}>
                <select value={form.fuelUnit} onChange={e=>set("fuelUnit",e.target.value)} style={{...s.input,width:90}}>
                  {["gal","lts","%"].map(u=><option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" value={form.fuel} onChange={e=>set("fuel",e.target.value)}
                  placeholder="0" style={{...s.input,flex:1}}/>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={s.label}>Horas de motor</label>
                <input type="number" value={form.engineHours} onChange={e=>set("engineHours",e.target.value)}
                  placeholder="0" style={s.input}/>
              </div>
              <div>
                <label style={s.label}>Horas de generador</label>
                <input type="number" value={form.genHours} onChange={e=>set("genHours",e.target.value)}
                  placeholder="0" style={s.input}/>
              </div>
            </div>

            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#15803d"}}>
              ✓ Puedes completar todos los detalles técnicos después en "Mi Embarcación"
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
        <button onClick={onSkip} style={s.skipBtn}>Saltar por ahora</button>
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
  btn:       {padding:"12px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"},
  btnOutline:{padding:"12px 16px",border:"1.5px solid #e2e8f0",borderRadius:9,background:"#fff",color:"#475569",fontSize:14,fontWeight:500,cursor:"pointer"},
  skipBtn:   {display:"block",width:"100%",marginTop:16,background:"none",border:"none",color:"#94a3b8",fontSize:12,cursor:"pointer",textAlign:"center"},
};