import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { notify } from "./notifications";

// Búsqueda de tripulación FIJA (capitán/manager/marinero para el barco)
// Dos tabs: "Buscar tripulación" (formulario Airbnb) y "Guardados"

const ROLES = ["Capitán","Primer Oficial","Jefe de Máquinas","Marinero","Mecánico","Electricista","Chef","Camarero","Gerente / Manager"];
const LANGS = ["Español","Inglés","Portugués","Francés","Italiano","Alemán"];
const CERTS = ["STCW","Licencia de Capitán","Primeros Auxilios","Buceo","Radio Operador VHF","Manejo de extintores"];
const CONTRACT_TYPES = ["Fijo / tiempo completo","Por temporada","Medio tiempo","Por proyecto"];

export default function CrewSearch({ vessel, user, onPublished }) {
  const [sub, setSub] = useState("buscar"); // buscar / guardados
  const [saved, setSaved] = useState([]);
  const [msg, setMsg] = useState("");
  const [resultInfo, setResultInfo] = useState(null); // resultado tras publicar
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState(null); // lista de tripulantes que hacen match
  const [searchId, setSearchId] = useState(null); // id de la búsqueda creada
  const [sentTo, setSentTo] = useState({}); // a quién ya se le envió oferta
  const [sortBy, setSortBy] = useState("match"); // match / experiencia

  const cityFromVessel = vessel?.details?.city || vessel?.marina || "";

  const [f, setF] = useState({
    role:"Capitán", city:cityFromVessel, min_age:"", max_age:"",
    gender:"cualquiera", languages:[], min_experience:"", certifications:[],
    contract_type:"Fijo / tiempo completo", liveaboard:false, notes:"",
  });

  useEffect(()=>{ if(sub==="guardados") loadSaved(); }, [sub]);

  const loadSaved = async () => {
    // Tripulantes guardados: propuestas con owner_status='saved' + ofertas guardadas
    const { data: props } = await supabase.from("crew_proposals")
      .select("*, crew:crew_id(*)").eq("owner_id", user.id).eq("owner_status","saved");
    const { data: offers } = await supabase.from("crew_offers")
      .select("*, crew:crew_id(*)").eq("owner_id", user.id).eq("status","saved");
    setSaved([...(props||[]), ...(offers||[])]);
  };

  const toggle = (field, val) => setF(s=>({...s, [field]: s[field].includes(val) ? s[field].filter(x=>x!==val) : [...s[field], val]}));

  // BUSCAR: encuentra tripulantes que hacen match y los MUESTRA (no envía nada)
  const search = async () => {
    if (!f.city.trim()) { setMsg("Indica la ciudad del barco"); setTimeout(()=>setMsg(""),3000); return; }
    setPublishing(true);
    setResults(null);

    const { data: crews } = await supabase.from("profiles").select("*").eq("role","crew");
    const cityL = f.city.toLowerCase().trim();
    const matches = [];

    for (const c of (crews||[])) {
      let score = 0; // puntaje de match para ordenar
      // Rol: principal o secundario (obligatorio si hay perfil de rol)
      const roles = [c.crew_role, c.secondary_role].filter(Boolean).map(r=>r.toLowerCase());
      if (roles.length && !roles.includes(f.role.toLowerCase())) continue;
      if (roles.includes(f.role.toLowerCase())) score += 30;
      // Ciudad OBLIGATORIA
      const zone = (c.work_zone||"").toLowerCase().trim();
      if (cityL && zone && !(zone.includes(cityL) || cityL.includes(zone))) continue;
      if (cityL && !zone) continue;
      score += 20;
      // Idiomas
      if (f.languages.length) {
        const cl = (c.languages||[]).map(x=>x.toLowerCase());
        if (!f.languages.every(l=>cl.includes(l.toLowerCase()))) continue;
        score += 10;
      }
      // Experiencia
      const years = (c.experience||[]).length;
      if (f.min_experience) {
        if (years < parseInt(f.min_experience)) continue;
      }
      score += Math.min(years * 3, 20); // más experiencia, más arriba
      // Certificaciones
      if (f.certifications.length) {
        const cc = (c.certifications||[]).map(x=>(x.name||"").toLowerCase());
        if (!f.certifications.every(cert=>cc.some(x=>x.includes(cert.toLowerCase())))) continue;
        score += 15;
      }
      // Edad
      if ((f.min_age||f.max_age) && c.birth_date) {
        const age = Math.floor((Date.now()-new Date(c.birth_date))/(365.25*24*3600*1000));
        if (f.min_age && age < parseInt(f.min_age)) continue;
        if (f.max_age && age > parseInt(f.max_age)) continue;
      }
      // Género
      if (f.gender!=="cualquiera" && c.gender && c.gender!==f.gender) continue;

      matches.push({ ...c, _score: score, _years: years });
    }

    // Ordenar por mejor match
    matches.sort((a,b)=>b._score-a._score);
    setResults(matches);
    setPublishing(false);
  };

  // ENVIAR OFERTA: a un tripulante específico que el dueño eligió
  const sendOffer = async (crew) => {
    // Crear/asegurar la búsqueda una sola vez
    let sid = searchId;
    if (!sid) {
      const { data: srch, error } = await supabase.from("crew_searches").insert({
        owner_id:user.id, vessel_id:vessel.id, role:f.role, city:f.city.trim(),
        min_age:f.min_age?parseInt(f.min_age):null, max_age:f.max_age?parseInt(f.max_age):null,
        gender:f.gender, languages:f.languages, min_experience:f.min_experience?parseInt(f.min_experience):null,
        certifications:f.certifications, contract_type:f.contract_type, liveaboard:f.liveaboard, notes:f.notes,
        status:"open",
      }).select().single();
      if (error) { setMsg("Error: "+error.message); return; }
      sid = srch.id;
      setSearchId(sid);
    }
    // Crear la propuesta + notificar al tripulante elegido
    const { error: perr } = await supabase.from("crew_proposals").insert({
      search_id:sid, crew_id:crew.id, owner_id:user.id, vessel_id:vessel.id,
      crew_status:"pending", owner_status:"new",
    });
    if (perr && perr.code==="23505") { setMsg("Ya le enviaste oferta a este tripulante"); setTimeout(()=>setMsg(""),3000); return; }
    notify(crew.id, { type:"crew_search", title:"Oferta de trabajo fijo", body:`Un propietario busca ${f.role} en ${f.city}. ¿Te interesa?`, link:"propuestas" });
    setSentTo(prev=>({...prev, [crew.id]:true}));
    setMsg("Oferta enviada. Si le interesa, aparecerá en Posible Tripulación.");
    setTimeout(()=>setMsg(""),3500);
    onPublished && onPublished();
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18,borderBottom:"1px solid #e2e8f0"}}>
        {[{k:"buscar",l:"Buscar tripulación"},{k:"guardados",l:"Guardados"}].map(t=>(
          <button key={t.k} onClick={()=>setSub(t.k)} style={{padding:"10px 16px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:sub===t.k?700:500,color:sub===t.k?"#2563eb":"#64748b",borderBottom:sub===t.k?"2px solid #2563eb":"2px solid transparent",marginBottom:-1}}>{t.l}</button>
        ))}
      </div>

      {sub==="buscar"&&(
        <div style={{maxWidth:680}}>
          <div style={{fontSize:13,color:"#64748b",marginBottom:18}}>Define el perfil que buscas y toca "Buscar tripulación". Verás la lista de tripulantes que hacen match, y podrás enviarles la oferta a los que elijas.</div>

          {/* Rol */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>¿Qué rol buscas?</label>
            <select value={f.role} onChange={e=>setF({...f,role:e.target.value})} style={inp}>
              {ROLES.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Ciudad */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>Ciudad del barco *</label>
            <input value={f.city} onChange={e=>setF({...f,city:e.target.value})} placeholder="Ej: Lechería" style={inp}/>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>El tripulante debe estar en esta ciudad para recibir tu oferta.</div>
          </div>

          {/* Tipo de contrato */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>Tipo de contrato</label>
            <select value={f.contract_type} onChange={e=>setF({...f,contract_type:e.target.value})} style={inp}>
              {CONTRACT_TYPES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Edad + género */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <div style={{flex:1}}>
              <label style={lbl}>Edad mínima</label>
              <input type="number" value={f.min_age} onChange={e=>setF({...f,min_age:e.target.value})} placeholder="Sin mín." style={inp}/>
            </div>
            <div style={{flex:1}}>
              <label style={lbl}>Edad máxima</label>
              <input type="number" value={f.max_age} onChange={e=>setF({...f,max_age:e.target.value})} placeholder="Sin máx." style={inp}/>
            </div>
            <div style={{flex:1}}>
              <label style={lbl}>Género</label>
              <select value={f.gender} onChange={e=>setF({...f,gender:e.target.value})} style={inp}>
                <option value="cualquiera">Cualquiera</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>

          {/* Experiencia */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>Experiencia mínima (años)</label>
            <input type="number" value={f.min_experience} onChange={e=>setF({...f,min_experience:e.target.value})} placeholder="Sin mínimo" style={inp}/>
          </div>

          {/* Idiomas */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>Idiomas requeridos</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {LANGS.map(l=>(
                <button key={l} onClick={()=>toggle("languages",l)} style={chip(f.languages.includes(l))}>{l}</button>
              ))}
            </div>
          </div>

          {/* Certificaciones */}
          <div style={{marginBottom:16}}>
            <label style={lbl}>Certificaciones requeridas</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {CERTS.map(c=>(
                <button key={c} onClick={()=>toggle("certifications",c)} style={chip(f.certifications.includes(c))}>{c}</button>
              ))}
            </div>
          </div>

          {/* Vive a bordo */}
          <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,cursor:"pointer"}}>
            <input type="checkbox" checked={f.liveaboard} onChange={e=>setF({...f,liveaboard:e.target.checked})} style={{width:15,height:15}}/>
            <span style={{fontSize:13,color:"#374151"}}>Debe poder vivir a bordo (liveaboard)</span>
          </label>

          {/* Notas */}
          <div style={{marginBottom:20}}>
            <label style={lbl}>Detalles adicionales</label>
            <textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} rows={3} placeholder="Describe el trabajo, horario, expectativas..." style={{...inp,resize:"vertical"}}/>
          </div>

          <button onClick={search} disabled={publishing} style={{width:"100%",padding:"13px",background:publishing?"#cbd5e1":"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            {publishing?"Buscando...":"Buscar tripulación"}
          </button>

          {/* Resultados de la búsqueda */}
          {results !== null && (
            <div style={{marginTop:24}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:15,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif"}}>
                  {results.length} {results.length===1?"tripulante":"tripulantes"} {results.length===1?"encontrado":"encontrados"}
                </div>
                {results.length>0 && (
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"7px 10px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:12,color:"#1e293b",background:"#fff"}}>
                    <option value="match">Mejor coincidencia</option>
                    <option value="experiencia">Más experiencia</option>
                  </select>
                )}
              </div>

              {results.length===0 && (
                <div style={{textAlign:"center",padding:"36px 20px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#b45309",marginBottom:6}}>No hay tripulantes que coincidan</div>
                  <div style={{fontSize:12,color:"#78350f",lineHeight:1.5}}>Prueba a ampliar los criterios: menos certificaciones obligatorias, rango de edad más amplio, o revisa que la ciudad esté bien escrita.</div>
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[...results].sort((a,b)=> sortBy==="experiencia" ? b._years-a._years : b._score-a._score).map(c=>{
                  const name = c.full_name?.trim() || `${c.first_name||""} ${c.last_name||""}`.trim() || "Tripulante";
                  const sent = sentTo[c.id];
                  const age = c.birth_date ? Math.floor((Date.now()-new Date(c.birth_date))/(365.25*24*3600*1000)) : null;
                  return (
                    <div key={c.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16,display:"flex",gap:14,alignItems:"flex-start"}}>
                      {c.photo_url
                        ? <img src={c.photo_url} style={{width:56,height:56,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
                        : <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:20,flexShrink:0}}>{name[0].toUpperCase()}</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{name}</div>
                        <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>{c.crew_role||"Tripulante"}{c.work_zone?` · ${c.work_zone}`:""}{age?` · ${age} años`:""}</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                          {c._years>0 && <span style={tag}>{c._years} {c._years===1?"experiencia":"experiencias"}</span>}
                          {(c.languages||[]).slice(0,3).map(l=><span key={l} style={tag}>{l}</span>)}
                          {(c.certifications||[]).slice(0,2).map((cert,i)=><span key={i} style={tag}>{cert.name||cert}</span>)}
                        </div>
                      </div>
                      <button onClick={()=>sendOffer(c)} disabled={sent} style={{flexShrink:0,padding:"9px 16px",borderRadius:9,border:"none",fontSize:12,fontWeight:700,cursor:sent?"default":"pointer",background:sent?"#f1f5f9":"linear-gradient(120deg,#2563eb,#0ea5e9)",color:sent?"#94a3b8":"#fff"}}>
                        {sent?"Oferta enviada":"Enviar oferta"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {sub==="guardados"&&(
        <div style={{maxWidth:680}}>
          {saved.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
              <div style={{fontWeight:600}}>No tienes tripulantes guardados</div>
              <div style={{fontSize:12,marginTop:4}}>Guarda candidatos desde "Posible tripulación" para revisarlos después</div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {saved.map(item=>{
              const c = item.crew||{};
              const name = c.full_name?.trim() || `${c.first_name||""} ${c.last_name||""}`.trim() || "Tripulante";
              return (
                <div key={item.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14,display:"flex",gap:12,alignItems:"center"}}>
                  {c.photo_url
                    ? <img src={c.photo_url} style={{width:48,height:48,borderRadius:"50%",objectFit:"cover"}} alt=""/>
                    : <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{name[0].toUpperCase()}</div>}
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{name}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{c.crew_role||""}{c.work_zone?` · ${c.work_zone}`:""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000,maxWidth:340,textAlign:"center"}}>{msg}</div>}
    </div>
  );
}

const lbl = {display:"block",fontSize:12,fontWeight:600,color:"#374151",marginBottom:6};
const inp = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
const chip = (active) => ({padding:"6px 13px",borderRadius:18,fontSize:12,cursor:"pointer",border:"1.5px solid",background:active?"#eff6ff":"#fff",borderColor:active?"#2563eb":"#e2e8f0",color:active?"#2563eb":"#64748b",fontWeight:active?700:400});
