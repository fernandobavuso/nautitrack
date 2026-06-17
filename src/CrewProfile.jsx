import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const COUNTRY_CODES = [
  {code:"+58",flag:"🇻🇪",name:"Venezuela"},{code:"+1",flag:"🇺🇸",name:"USA/Canadá"},
  {code:"+34",flag:"🇪🇸",name:"España"},{code:"+52",flag:"🇲🇽",name:"México"},
  {code:"+57",flag:"🇨🇴",name:"Colombia"},{code:"+51",flag:"🇵🇪",name:"Perú"},
  {code:"+56",flag:"🇨🇱",name:"Chile"},{code:"+54",flag:"🇦🇷",name:"Argentina"},
  {code:"+55",flag:"🇧🇷",name:"Brasil"},{code:"+593",flag:"🇪🇨",name:"Ecuador"},
  {code:"+507",flag:"🇵🇦",name:"Panamá"},{code:"+53",flag:"🇨🇺",name:"Cuba"},
  {code:"+1809",flag:"🇩🇴",name:"Rep. Dominicana"},{code:"+44",flag:"🇬🇧",name:"Reino Unido"},
  {code:"+33",flag:"🇫🇷",name:"Francia"},{code:"+49",flag:"🇩🇪",name:"Alemania"},
  {code:"+39",flag:"🇮🇹",name:"Italia"},{code:"+351",flag:"🇵🇹",name:"Portugal"},
  {code:"+31",flag:"🇳🇱",name:"Países Bajos"},{code:"+7",flag:"🇷🇺",name:"Rusia"},
  {code:"+86",flag:"🇨🇳",name:"China"},{code:"+81",flag:"🇯🇵",name:"Japón"},
  {code:"+61",flag:"🇦🇺",name:"Australia"},{code:"+27",flag:"🇿🇦",name:"Sudáfrica"},
];

const CREW_ROLES = ["Capitán","Primer Oficial","Marinero","Mecánico","Contramaestre","Cocinero","Marinero de Cubierta","Electrónico","Buceo","Otro"];

const CERT_OPTIONS = [
  "STCW Básico","Licencia de Capitán","Primeros Auxilios Marítimo",
  "Seguridad Contraincendios","Supervivencia en el Mar","Radar ARPA",
  "GMDSS Operador","Buceo","Licencia Costera","Licencia de Pesca","Otro",
];

const LANGUAGES = ["Español","Inglés","Portugués","Francés","Italiano","Alemán","Holandés","Chino","Japonés","Árabe","Ruso"];

const NATIONALITIES = [
  "Venezolana","Estadounidense","Colombiana","Española","Mexicana","Peruana","Chilena","Argentina",
  "Brasileña","Ecuatoriana","Panameña","Cubana","Dominicana","Puertorriqueña","Costarricense",
  "Guatemalteca","Hondureña","Nicaragüense","Salvadoreña","Boliviana","Paraguaya","Uruguaya",
  "Británica","Francesa","Alemana","Italiana","Portuguesa","Holandesa","Belga","Suiza","Austríaca",
  "Sueca","Noruega","Danesa","Finlandesa","Polaca","Checa","Húngara","Rumana","Griega","Turca",
  "Rusa","Ucraniana","Israelí","Árabe Saudí","Emiratí","Libanesa","Egipcia","Marroquí","Nigeriana",
  "Sudafricana","Keniana","Etíope","Ghanesa","Senegalesa","Camerunesa","Angoleña","Mozambiqueña",
  "China","Japonesa","Coreana","India","Paquistaní","Bangladesí","Vietnamita","Tailandesa",
  "Filipina","Indonesia","Malasia","Singapurense","Australiana","Neozelandesa","Canadiense",
  "Jamaicana","Trinitense","Barbadense","Bahameña","Haitiana","Otra",
];

const BADGE_DEFS = [
  {id:"verified",    icon:"✅", label:"Perfil Verificado",  color:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0"},
  {id:"stcw",        icon:"📜", label:"STCW Certificado",   color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe"},
  {id:"5years",      icon:"⭐", label:"5 Años de Exp.",     color:"#d97706", bg:"#fffbeb", border:"#fde68a"},
  {id:"10years",     icon:"🏆", label:"10 Años de Exp.",    color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe"},
  {id:"3boats",      icon:"🚢", label:"3+ Embarcaciones",   color:"#0891b2", bg:"#ecfeff", border:"#a5f3fc"},
  {id:"captain",     icon:"⚓", label:"Capitán Certificado",color:"#be185d", bg:"#fdf2f8", border:"#fbcfe8"},
  {id:"bilingual",   icon:"🌐", label:"Bilingüe",           color:"#059669", bg:"#ecfdf5", border:"#a7f3d0"},
  {id:"passport",    icon:"🛂", label:"Pasaporte Vigente",   color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe"},
];

const PAYMENT_METHODS = [
  {key:"pagomovil",  label:"Pago Móvil",     fields:[{k:"banco",l:"Banco"},{k:"telefono",l:"Teléfono"},{k:"cedula",l:"Cédula"}]},
  {key:"zelle",      label:"Zelle",          fields:[{k:"email",l:"Email o teléfono"},{k:"nombre",l:"Cuenta a nombre de"}]},
  {key:"usdt",       label:"USDT (Cripto)",  fields:[{k:"red",l:"Red (TRC20, ERC20...)"},{k:"wallet",l:"Wallet address"}]},
  {key:"paypal",     label:"PayPal",         fields:[{k:"email",l:"Email de PayPal"},{k:"nombre",l:"Cuenta a nombre de"}]},
  {key:"transfer",   label:"Transferencia",  fields:[{k:"banco",l:"Banco"},{k:"cuenta",l:"N° de cuenta"},{k:"titular",l:"Cuenta a nombre de"},{k:"email",l:"Email asociado"}]},
  {key:"efectivo",   label:"Efectivo USD",   fields:[{k:"nota",l:"Nota (opcional)"},{k:"nombre",l:"Cuenta a nombre de"}]},
  {key:"otro",       label:"Otro método",    fields:[{k:"descripcion",l:"Descripción"},{k:"datos",l:"Datos de contacto"}]},
];

export default function CrewProfile({ user, onLogout }) {
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [tab,       setTab]       = useState("perfil");
  const [requests,  setRequests]  = useState([]);
  const [search,    setSearch]    = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [msg,       setMsg]       = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [verifying, setVerifying]           = useState(false);
  const [verifyResult, setVerifyResult]     = useState(null);
  const photoRef  = useRef();
  const docRef    = useRef();

  const TABS = [
    {key:"perfil",   icon:"👤", label:"Mi Perfil"},
    {key:"certs",    icon:"📜", label:"Certificaciones"},
    {key:"historial",icon:"🚢", label:"Historial"},
    {key:"pagos",    icon:"💳", label:"Pagos"},
    {key:"buscar",   icon:"🔍", label:"Buscar Barco"},
    {key:"solicitudes",icon:"📬", label:"Solicitudes"},
  ];

  useEffect(() => { loadProfile(); loadRequests(); }, []);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data || {
      full_name:"", bio:"", phone:"", phone_code:"+58", crew_role:"Capitán",
      certifications:[], experience:[], badges:[], available:false, location:"",
      nationality:"Venezolana", languages:["Español"], fun_facts:{},
      payment_methods:{}, photo_url:null, id_doc_url:null, passport_url:null, legal_name:'', has_passport:false,
      first_name:"", last_name:"", email: user.email||"",
    });
    setLoading(false);
  };

  const loadRequests = async () => {
    const { data } = await supabase.from("vessel_requests")
      .select("*, vessel:vessel_id(name,marina,type)")
      .eq("user_id", user.id).order("created_at",{ascending:false});
    setRequests(data||[]);
  };

  const saveProfile = async () => {
    setSaving(true);
    const badges = computeBadges(profile);
    const full_name = `${profile.first_name||""} ${profile.last_name||""}`.trim() || profile.full_name || "";
    await supabase.from("profiles").upsert({
      id: user.id, email: profile.email||user.email,
      full_name, ...profile, badges,
      updated_at: new Date().toISOString(),
    });
    setProfile(p=>({...p, badges, full_name}));
    setMsg("✅ Perfil guardado");
    setTimeout(()=>setMsg(""),3000);
    setSaving(false);
  };

  const computeBadges = (p) => {
    const earned = [];
    const years = (p.experience||[]).length;
    const hasCerts = (p.certifications||[]).some(c=>(c.name||"").includes("STCW"));
    const boats = (p.experience||[]).length;
    const langs = (p.languages||[]).length;
    if (years>=5)  earned.push("5years");
    if (years>=10) earned.push("10years");
    if (boats>=3)  earned.push("3boats");
    if (hasCerts)  earned.push("stcw");
    if ((p.crew_role||"").includes("Capitán")) earned.push("captain");
    if (langs>=2)  earned.push("bilingual");
    if (p.photo_url && full_name) earned.push("verified");
    return earned;
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop();
    const path = `profiles/${user.id}/photo.${ext}`;
    await supabase.storage.from("manuales").upload(path, file, {upsert:true});
    const { data } = supabase.storage.from("manuales").getPublicUrl(path);
    set("photo_url", data.publicUrl);
    setUploadingPhoto(false);
  };

  const uploadDoc = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `profiles/${user.id}/id_doc.${ext}`;
    await supabase.storage.from("manuales").upload(path, file, {upsert:true});
    const { data } = supabase.storage.from("manuales").getPublicUrl(path);
    set("id_doc_url", data.publicUrl);
    setMsg("✅ Documento subido");
    setTimeout(()=>setMsg(""),3000);
  };

  const verifyIdentity = async () => {
    if (!profile.id_doc_url) { setMsg("⚠️ Sube tu cédula primero"); return; }
    setVerifying(true); setMsg("");
    try {
      // Convertir URLs a base64
      const toBase64 = async (url) => {
        const r = await fetch(url);
        const blob = await r.blob();
        return new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      };

      const idDocBase64   = await toBase64(profile.id_doc_url);
      const profilePhotoBase64 = profile.photo_url ? await toBase64(profile.photo_url) : null;

      const resp = await fetch('/api/verify-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePhotoBase64, idDocBase64, legalName: profile.legal_name }),
      });
      const data = await resp.json();
      if (data.success) {
        setVerifyResult(data.result);
        // Si pasa la verificación, agregar badge verified
        const passed = data.result.is_official_doc && data.result.face_in_doc &&
          (!profilePhotoBase64 || data.result.faces_match !== false);
        if (passed) {
          const badges = [...new Set([...(profile.badges||[]), "verified"])];
          set("badges", badges);
          // Guardar datos extraídos de la cédula
          if (data.result.extracted_name) set("verified_name", data.result.extracted_name);
          if (data.result.id_number) set("id_number", data.result.id_number);
          setMsg("✅ Identidad verificada. Badge agregado.");
        } else {
          setMsg("⚠️ No se pudo verificar. Revisa que la foto sea clara y el documento sea válido.");
        }
      }
    } catch(e) {
      setMsg("Error al verificar: " + e.message);
    }
    setVerifying(false);
    setTimeout(()=>setMsg(""),5000);
  };

  const searchVessels = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const { data } = await supabase.from("vessels").select("id,name,type,marina,captain").ilike("name",`%${search}%`).limit(10);
    setSearchRes(data||[]);
    setSearching(false);
  };

  const sendRequest = async (vessel) => {
    const { error } = await supabase.from("vessel_requests").insert({
      vessel_id:vessel.id, user_id:user.id, type:"crew_request", status:"pending",
      role: profile.crew_role||"Marinero",
      message:`${profile.full_name||user.email} solicita unirse como ${profile.crew_role||"Marinero"}`,
    });
    if (error?.code==="23505") setMsg("⚠️ Ya enviaste una solicitud a este barco");
    else { setMsg("✅ Solicitud enviada"); loadRequests(); }
    setTimeout(()=>setMsg(""),4000);
  };

  const set = (k,v) => setProfile(p=>({...p,[k]:v}));
  const setPayment = (method, field, value) => {
    setProfile(p=>({...p, payment_methods:{...p.payment_methods,[method]:{...(p.payment_methods||{})[method],[field]:value}}}));
  };
  const togglePaymentMethod = (key) => {
    const current = profile.payment_methods||{};
    if (current[key]) { const n={...current}; delete n[key]; set("payment_methods",n); }
    else set("payment_methods",{...current,[key]:{}});
  };
  const toggleLang = (lang) => {
    const langs = profile.languages||[];
    if (langs.includes(lang)) set("languages",langs.filter(l=>l!==lang));
    else set("languages",[...langs,lang]);
  };

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f7ff"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:40}}>⚓</div><div style={{color:"#64748b",marginTop:8}}>Cargando perfil...</div></div>
    </div>
  );

  const full_name = `${profile.first_name||""} ${profile.last_name||""}`.trim() || profile.full_name || "";
  const earnedBadges = BADGE_DEFS.filter(b=>(profile.badges||[]).includes(b.id));

  return (
    <div style={s.root}>
      {/* NAV */}
      <nav style={s.nav}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" fill="#0ea5e9" opacity=".15"/>
            <path d="M15 4 L27 24 H3 Z" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinejoin="round"/>
            <line x1="15" y1="4" x2="15" y2="24" stroke="#0ea5e9" strokeWidth="1.4"/>
            <path d="M5 24 Q15 19 25 24" stroke="#0ea5e9" strokeWidth="2" fill="none"/>
          </svg>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:"#0f172a",lineHeight:1}}>NautiTrack</div>
            <div style={{fontSize:10,color:"#64748b"}}>Perfil Tripulación</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              padding:"6px 10px",background:tab===t.key?"#eff6ff":"transparent",
              border:"none",borderRadius:8,cursor:"pointer",fontSize:11,
              color:tab===t.key?"#2563eb":"#64748b",fontWeight:tab===t.key?700:400
            }}>{t.icon} {t.label}
              {t.key==="solicitudes"&&requests.filter(r=>r.status==="pending").length>0&&(
                <span style={{marginLeft:4,background:"#ef4444",color:"#fff",borderRadius:"50%",padding:"1px 5px",fontSize:9}}>
                  {requests.filter(r=>r.status==="pending").length}
                </span>
              )}
            </button>
          ))}
          <button onClick={onLogout} style={{padding:"5px 10px",background:"none",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:11,color:"#94a3b8",marginLeft:4}}>Salir</button>
        </div>
      </nav>

      <div style={s.content}>

        {/* ── MI PERFIL ── */}
        {tab==="perfil"&&(
          <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20}}>

            {/* Columna izquierda — foto + badge */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Foto de perfil */}
              <div style={s.card}>
                <div style={{textAlign:"center"}}>
                  <div style={{position:"relative",display:"inline-block",marginBottom:12}}>
                    {profile.photo_url
                      ? <img src={profile.photo_url} style={{width:100,height:100,borderRadius:"50%",objectFit:"cover",border:"3px solid #0ea5e9"}} alt="foto"/>
                      : <div style={{width:100,height:100,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",color:"#fff",fontSize:32,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>
                          {(full_name||user.email||"?")[0].toUpperCase()}
                        </div>
                    }
                    {uploadingPhoto&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11}}>⏳</div>}
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:"#0f172a"}}>{full_name||"Tu nombre"}</div>
                  <div style={{fontSize:12,color:"#0ea5e9",fontWeight:600,marginTop:2}}>{profile.crew_role||"Capitán"}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{profile.nationality||""}</div>
                  <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>uploadPhoto(e.target.files[0])}/>
                  <button onClick={()=>photoRef.current.click()} style={{marginTop:10,padding:"6px 14px",border:"1.5px solid #e2e8f0",borderRadius:8,background:"#f8fafc",cursor:"pointer",fontSize:11,color:"#475569",fontWeight:600}}>
                    📷 {profile.photo_url?"Cambiar foto":"Subir foto"}
                  </button>
                  <div style={{marginTop:8,fontSize:10,color:"#94a3b8",lineHeight:1.5,textAlign:"center"}}>
                    Foto estilo pasaporte · Fondo blanco · Sin lentes ni gorras
                  </div>
                </div>

                <div style={{marginTop:16,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:"0.08em",marginBottom:4}}>DISPONIBILIDAD DE TRABAJO</div>
                  <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>Requiere foto y cédula para activarse</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div onClick={()=>{
                    if (!profile.photo_url || !profile.id_doc_url) { setMsg("⚠️ Necesitas subir tu foto de perfil y cédula primero"); setTimeout(()=>setMsg(""),4000); return; }
                    set("available",!profile.available);
                  }} style={{
                      width:42,height:24,borderRadius:12,background:profile.available?"#16a34a":"#cbd5e1",
                      cursor:"pointer",position:"relative",transition:"background 0.2s"
                    }}>
                      <div style={{position:"absolute",top:3,left:profile.available?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                    </div>
                    <span style={{fontSize:12,color:profile.available?"#16a34a":"#94a3b8",fontWeight:600}}>
                      {profile.available?"Disponible":"No disponible"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div style={s.card}>
                <div style={{fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:10}}>🏅 Badges</div>
                {earnedBadges.length===0&&<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"10px 0"}}>Completa tu perfil para ganar badges</div>}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {earnedBadges.map(b=>(
                    <div key={b.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:b.bg,border:`1px solid ${b.border}`,borderRadius:8}}>
                      <span style={{fontSize:16}}>{b.icon}</span>
                      <span style={{fontSize:11,fontWeight:700,color:b.color}}>{b.label}</span>
                    </div>
                  ))}
                </div>
                {earnedBadges.length<BADGE_DEFS.length&&(
                  <div style={{marginTop:10,fontSize:10,color:"#94a3b8"}}>
                    {BADGE_DEFS.length-earnedBadges.length} badges por desbloquear
                  </div>
                )}
              </div>

              {/* Cédula de identidad */}
              <div style={s.card}>
                <div style={{fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:4}}>🪪 Cédula de Identidad</div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Visible para propietarios que te contraten · Genera badge ✅ Verificado</div>
                <input ref={docRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>uploadDoc(e.target.files[0])}/>

                {/* Campo nombre legal */}
                <div style={{marginBottom:10}}>
                  <label style={s.label}>Nombre completo como aparece en la cédula *</label>
                  <input value={profile.legal_name||""} onChange={e=>set("legal_name",e.target.value)}
                    placeholder="Ej: Fernando Ignacio Bavuso Larrazabal" style={s.input}/>
                </div>

                {profile.id_doc_url
                  ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✅ Cédula subida</span>
                        <button onClick={()=>docRef.current.click()} style={{fontSize:10,padding:"3px 8px",border:"1px solid #e2e8f0",borderRadius:5,background:"#f8fafc",cursor:"pointer",color:"#64748b"}}>Cambiar</button>
                      </div>
                      {(profile.badges||[]).includes("verified")
                        ? <div style={{fontSize:11,color:"#16a34a",fontWeight:600,background:"#f0fdf4",padding:"6px 10px",borderRadius:7,border:"1px solid #bbf7d0"}}>✅ Identidad verificada por IA</div>
                        : <button onClick={verifyIdentity} disabled={verifying||!profile.legal_name} style={{width:"100%",padding:"8px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",opacity:(verifying||!profile.legal_name)?0.5:1}}>
                            {verifying?"⏳ Verificando...":"🤖 Verificar identidad con IA"}
                          </button>
                      }
                      {!profile.legal_name&&<div style={{fontSize:10,color:"#f59e0b"}}>⚠️ Escribe tu nombre legal arriba para verificar</div>}
                      {verifyResult&&(
                        <div style={{fontSize:10,color:"#64748b",background:"#f8fafc",padding:"8px",borderRadius:7,border:"1px solid #e2e8f0"}}>
                          {verifyResult.extracted_name&&<div>Nombre detectado: <strong>{verifyResult.extracted_name}</strong></div>}
                          {verifyResult.id_number&&<div>Cédula: <strong>{verifyResult.id_number}</strong></div>}
                          {verifyResult.notes&&<div style={{marginTop:4,color:"#94a3b8"}}>{verifyResult.notes}</div>}
                        </div>
                      )}
                    </div>
                  : <button onClick={()=>docRef.current.click()} style={{width:"100%",padding:"8px",border:"1.5px dashed #cbd5e1",borderRadius:8,background:"#f8fafc",cursor:"pointer",fontSize:11,color:"#64748b",textAlign:"center"}}>
                      📷 Subir foto de cédula
                    </button>
                }

                {/* Pasaporte — opcional */}
                <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #f1f5f9"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <input type="checkbox" id="has_passport" checked={profile.has_passport||false} onChange={e=>set("has_passport",e.target.checked)} style={{width:14,height:14,cursor:"pointer"}}/>
                    <label htmlFor="has_passport" style={{fontSize:12,color:"#475569",cursor:"pointer",fontWeight:600}}>
                      Tengo pasaporte vigente <span style={{color:"#94a3b8",fontWeight:400}}>(opcional · genera badge 🛂)</span>
                    </label>
                  </div>
                  {profile.has_passport&&(
                    <div>
                      {profile.passport_url
                        ? <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✅ Pasaporte subido</span>
                            <label style={{fontSize:10,color:"#64748b",cursor:"pointer",border:"1px solid #e2e8f0",padding:"2px 8px",borderRadius:5,background:"#f8fafc"}}>
                              Cambiar
                              <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                                const file=e.target.files[0]; if(!file) return;
                                const path=`profiles/${user.id}/passport.${file.name.split(".").pop()}`;
                                await supabase.storage.from("manuales").upload(path,file,{upsert:true});
                                const {data:d}=supabase.storage.from("manuales").getPublicUrl(path);
                                set("passport_url",d.publicUrl);
                                const badges=[...new Set([...(profile.badges||[]),"passport"])];
                                set("badges",badges);
                                setMsg("✅ Pasaporte subido. Badge 🛂 desbloqueado!");
                                setTimeout(()=>setMsg(""),3000);
                              }}/>
                            </label>
                          </div>
                        : <label style={{display:"block",padding:"8px",border:"1.5px dashed #cbd5e1",borderRadius:8,background:"#f8fafc",cursor:"pointer",fontSize:11,color:"#64748b",textAlign:"center"}}>
                            📷 Subir foto de pasaporte
                            <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                              const file=e.target.files[0]; if(!file) return;
                              const path=`profiles/${user.id}/passport.${file.name.split(".").pop()}`;
                              await supabase.storage.from("manuales").upload(path,file,{upsert:true});
                              const {data:d}=supabase.storage.from("manuales").getPublicUrl(path);
                              set("passport_url",d.publicUrl);
                              const badges=[...new Set([...(profile.badges||[]),"passport"])];
                              set("badges",badges);
                              setMsg("✅ Pasaporte subido. Badge 🛂 desbloqueado!");
                              setTimeout(()=>setMsg(""),3000);
                            }}/>
                          </label>
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha — datos */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Info básica */}
              <div style={s.card}>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:14}}>📋 Información Personal</div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={s.label}>Nombre *</label>
                    <input value={profile.first_name||""} onChange={e=>set("first_name",e.target.value)} placeholder="Carlos" style={s.input}/>
                  </div>
                  <div>
                    <label style={s.label}>Apellido *</label>
                    <input value={profile.last_name||""} onChange={e=>set("last_name",e.target.value)} placeholder="Mendoza" style={s.input}/>
                  </div>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={s.label}>Teléfono</label>
                  <div style={{display:"flex",gap:6}}>
                    <select value={profile.phone_code||"+58"} onChange={e=>set("phone_code",e.target.value)} style={{...s.input,width:140,flexShrink:0}}>
                      {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code} {c.name}</option>)}
                    </select>
                    <input value={profile.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="4141234567" style={{...s.input,flex:1}}/>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={s.label}>Rol principal</label>
                    <select value={profile.crew_role||"Capitán"} onChange={e=>set("crew_role",e.target.value)} style={s.input}>
                      {CREW_ROLES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Nacionalidad</label>
                    <select value={profile.nationality||"Venezolana"} onChange={e=>set("nationality",e.target.value)} style={s.input}>
                      {NATIONALITIES.map(n=><option key={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={s.label}>Email</label>
                  <input value={profile.email||user.email||""} onChange={e=>set("email",e.target.value)} style={{...s.input,background:"#f8fafc"}} readOnly/>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>Para cambiar tu email contacta soporte en info@nautitrack.vz</div>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={s.label}>Idiomas</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                    {LANGUAGES.map(lang=>(
                      <button key={lang} onClick={()=>toggleLang(lang)} style={{
                        padding:"4px 10px",border:"1.5px solid",borderRadius:16,fontSize:11,cursor:"pointer",
                        background:(profile.languages||[]).includes(lang)?"#eff6ff":"#f8fafc",
                        borderColor:(profile.languages||[]).includes(lang)?"#2563eb":"#e2e8f0",
                        color:(profile.languages||[]).includes(lang)?"#2563eb":"#64748b",
                        fontWeight:(profile.languages||[]).includes(lang)?700:400,
                      }}>{lang}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={s.label}>Bio / CV breve</label>
                  <textarea value={profile.bio||""} onChange={e=>set("bio",e.target.value)}
                    placeholder="Capitán con 10 años de experiencia en el oriente venezolano. Especialista en yates de motor de 40-70 pies..."
                    rows={3} style={{...s.input,resize:"vertical"}}/>
                </div>
              </div>

              {/* Dato curioso */}
              <div style={{...s.card,background:"linear-gradient(135deg,#fffbeb,#fff7ed)",border:"1px solid #fde68a"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#92400e",marginBottom:4}}>Dato Curioso</div>
                <div style={{fontSize:11,color:"#b45309",marginBottom:12}}>Comparte cuál es tu playa favorita en el mundo</div>
                <input value={(profile.fun_facts||{}).playa_favorita||""} onChange={e=>setProfile(p=>({...p,fun_facts:{...(p.fun_facts||{}),playa_favorita:e.target.value}}))}
                  placeholder="Ej: Playa Medina, Venezuela" style={{...s.input,borderColor:"#fde68a",background:"#fff"}}/>
              </div>

            </div>
          </div>
        )}

        {/* ── CERTIFICACIONES ── */}
        {tab==="certs"&&(
          <div style={{maxWidth:700}}>
            <div style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>📜 Certificaciones</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Sube el diploma o certificado para cada una</div>
                </div>
                <button onClick={()=>set("certifications",[...(profile.certifications||[]),{name:"",date:"",expiry:"",doc_url:""}])}
                  style={{padding:"7px 14px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700}}>
                  ＋ Agregar
                </button>
              </div>

              {(profile.certifications||[]).length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:8}}>📜</div>
                  <div style={{fontWeight:600}}>Sin certificaciones</div>
                  <div style={{fontSize:12,marginTop:4}}>Agrega tus certificaciones náuticas</div>
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {(profile.certifications||[]).map((cert,i)=>(
                  <div key={i} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:14}}>
                    <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <label style={s.label}>Certificación</label>
                        <select value={cert.name||""} onChange={e=>{const c=[...(profile.certifications||[])];c[i]={...c[i],name:e.target.value};set("certifications",c);}} style={s.input}>
                          <option value="">Seleccionar...</option>
                          {CERT_OPTIONS.map(o=><option key={o}>{o}</option>)}
                        </select>
                        {cert.name==="Otro"&&(
                          <input value={cert.custom_name||""} onChange={e=>{const c=[...(profile.certifications||[])];c[i]={...c[i],custom_name:e.target.value};set("certifications",c);}}
                            placeholder="Especifica la certificación" style={{...s.input,marginTop:6}}/>
                        )}
                      </div>
                      <button onClick={()=>{const c=[...(profile.certifications||[])];c.splice(i,1);set("certifications",c);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:18,padding:"0 4px",marginTop:18}}>✕</button>
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                      <div>
                        <label style={s.label}>Fecha de emisión</label>
                        <input type="date" value={cert.date||""} onChange={e=>{const c=[...(profile.certifications||[])];c[i]={...c[i],date:e.target.value};set("certifications",c);}} style={s.input}/>
                      </div>
                      <div>
                        <label style={s.label}>Fecha de vencimiento</label>
                        <input type="date" value={cert.expiry||""} onChange={e=>{const c=[...(profile.certifications||[])];c[i]={...c[i],expiry:e.target.value};set("certifications",c);}} style={s.input}/>
                      </div>
                    </div>

                    {/* Upload certificado */}
                    <div>
                      <label style={s.label}>Diploma / Certificado</label>
                      {cert.doc_url
                        ? <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <a href={cert.doc_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#2563eb",fontWeight:600}}>✅ Ver documento</a>
                            <span style={{fontSize:10,color:"#94a3b8"}}>·</span>
                            <label style={{fontSize:11,color:"#64748b",cursor:"pointer"}}>
                              Cambiar
                              <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={async e=>{
                                const file=e.target.files[0]; if(!file) return;
                                const path=`profiles/${user.id}/cert_${i}.${file.name.split(".").pop()}`;
                                await supabase.storage.from("manuales").upload(path,file,{upsert:true});
                                const {data:d}=supabase.storage.from("manuales").getPublicUrl(path);
                                const c=[...(profile.certifications||[])];c[i]={...c[i],doc_url:d.publicUrl};set("certifications",c);
                              }}/>
                            </label>
                          </div>
                        : <label style={{display:"block",padding:"8px 12px",border:"1.5px dashed #cbd5e1",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:11,color:"#64748b",textAlign:"center"}}>
                            📎 Subir foto o PDF del certificado
                            <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={async e=>{
                              const file=e.target.files[0]; if(!file) return;
                              const path=`profiles/${user.id}/cert_${i}.${file.name.split(".").pop()}`;
                              await supabase.storage.from("manuales").upload(path,file,{upsert:true});
                              const {data:d}=supabase.storage.from("manuales").getPublicUrl(path);
                              const c=[...(profile.certifications||[])];c[i]={...c[i],doc_url:d.publicUrl};set("certifications",c);
                            }}/>
                          </label>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab==="historial"&&(
          <div style={{maxWidth:700}}>
            <div style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>🚢 Historial de Embarcaciones</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Tu experiencia embarcado (el nombre del barco es privado)</div>
                </div>
                <button onClick={()=>set("experience",[...(profile.experience||[]),{brand:"",length:"",role:"",period:"",notes:""}])}
                  style={{padding:"7px 14px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700}}>
                  ＋ Agregar
                </button>
              </div>

              {(profile.experience||[]).length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:8}}>🚢</div>
                  <div style={{fontWeight:600}}>Sin historial</div>
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {(profile.experience||[]).map((exp,i)=>(
                  <div key={i} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:14}}>
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
                      <button onClick={()=>{const x=[...(profile.experience||[])];x.splice(i,1);set("experience",x);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:16}}>✕</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div>
                        <label style={s.label}>Marca del barco</label>
                        <input value={exp.brand||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],brand:e.target.value};set("experience",x);}}
                          placeholder="Ej: Sea Ray" style={s.input}/>
                      </div>
                      <div>
                        <label style={s.label}>Eslora (pies)</label>
                        <input value={exp.length||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],length:e.target.value};set("experience",x);}}
                          placeholder="Ej: 65" style={s.input}/>
                      </div>
                      <div>
                        <label style={s.label}>Tu rol</label>
                        <select value={exp.role||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],role:e.target.value};set("experience",x);}} style={s.input}>
                          <option value="">Seleccionar...</option>
                          {CREW_ROLES.map(r=><option key={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={s.label}>Período</label>
                        <select value={exp.period||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],period:e.target.value};set("experience",x);}} style={s.input}>
                          <option value="">Seleccionar...</option>
                          <option>Menos de 3 meses</option>
                          <option>3 a 6 meses</option>
                          <option>6 meses a 1 año</option>
                          <option>1 a 2 años</option>
                          <option>2 a 3 años</option>
                          <option>3 a 5 años</option>
                          <option>5 a 10 años</option>
                          <option>Más de 10 años</option>
                        </select>
                      </div>
                    </div>
                    <div style={{marginTop:10}}>
                      <label style={s.label}>Notas</label>
                      <input value={exp.notes||""} onChange={e=>{const x=[...(profile.experience||[])];x[i]={...x[i],notes:e.target.value};set("experience",x);}}
                        placeholder="Rutas frecuentes, tipo de operación, etc." style={s.input}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MÉTODOS DE PAGO ── */}
        {tab==="pagos"&&(
          <div style={{maxWidth:700}}>
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:4}}>💳 Métodos de Pago</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:20}}>Activa los métodos que aceptas y completa tus datos</div>

              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {PAYMENT_METHODS.map(pm=>{
                  const active = !!(profile.payment_methods||{})[pm.key];
                  const data = (profile.payment_methods||{})[pm.key]||{};
                  return (
                    <div key={pm.key} style={{border:`1.5px solid ${active?"#bfdbfe":"#e2e8f0"}`,borderRadius:12,overflow:"hidden"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:active?"#eff6ff":"#f8fafc",cursor:"pointer"}} onClick={()=>togglePaymentMethod(pm.key)}>
  
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:active?"#1d4ed8":"#475569"}}>{pm.label}</div>
                        </div>
                        <div style={{
                          width:36,height:20,borderRadius:10,background:active?"#2563eb":"#cbd5e1",
                          position:"relative",transition:"background 0.2s"
                        }}>
                          <div style={{position:"absolute",top:2,left:active?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                        </div>
                      </div>
                      {active&&(
                        <div style={{padding:"12px 16px",background:"#fff",borderTop:"1px solid #e2e8f0"}}>
                          <div style={{display:"grid",gridTemplateColumns:pm.fields.length>1?"1fr 1fr":"1fr",gap:8}}>
                            {pm.fields.map(f=>(
                              <div key={f.k}>
                                <label style={s.label}>{f.l}</label>
                                <input value={data[f.k]||""} onChange={e=>setPayment(pm.key,f.k,e.target.value)}
                                  placeholder={f.l} style={s.input}/>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── BUSCAR BARCO ── */}
        {tab==="buscar"&&(
          <div style={{maxWidth:600}}>
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:4}}>🔍 Buscar Embarcación</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>Busca el barco donde quieres trabajar y envía una solicitud al propietario</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchVessels()}
                  placeholder="Nombre del barco..." style={{...s.input,flex:1}}/>
                <button onClick={searchVessels} disabled={searching}
                  style={{padding:"10px 16px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
                  {searching?"...":"Buscar"}
                </button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {searchRes.map(v=>{
                  const sent=requests.some(r=>r.vessel_id===v.id);
                  return (
                    <div key={v.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                      <div style={{fontSize:28}}>🚢</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{v.name}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{v.type} · {v.marina}</div>
                      </div>
                      <button onClick={()=>!sent&&sendRequest(v)} style={{
                        padding:"8px 14px",border:"none",borderRadius:8,cursor:sent?"default":"pointer",
                        background:sent?"#f1f5f9":"linear-gradient(135deg,#1d4ed8,#0ea5e9)",
                        color:sent?"#94a3b8":"#fff",fontSize:12,fontWeight:700,
                      }}>{sent?"✓ Enviado":"Solicitar"}</button>
                    </div>
                  );
                })}
                {searchRes.length===0&&search&&!searching&&(
                  <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>No se encontraron embarcaciones</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SOLICITUDES ── */}
        {tab==="solicitudes"&&(
          <div style={{maxWidth:600}}>
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:16}}>📬 Mis Solicitudes</div>
              {requests.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📬</div>
                  <div>Sin solicitudes enviadas</div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {requests.map(r=>(
                  <div key={r.id} style={{padding:"12px 16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{r.vessel?.name}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{r.vessel?.type} · {r.vessel?.marina}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Rol: {r.role}</div>
                    </div>
                    <span style={{
                      padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap",
                      background:r.status==="accepted"?"#f0fdf4":r.status==="rejected"?"#fff5f5":"#fffbeb",
                      color:r.status==="accepted"?"#16a34a":r.status==="rejected"?"#dc2626":"#d97706",
                      border:`1px solid ${r.status==="accepted"?"#bbf7d0":r.status==="rejected"?"#fecaca":"#fde68a"}`,
                    }}>
                      {r.status==="accepted"?"✅ Aceptado":r.status==="rejected"?"❌ Rechazado":"⏳ Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {msg&&(
          <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
            {msg}
          </div>
        )}
      </div>

      {/* Guardar flotante */}
      {(tab==="perfil"||tab==="certs"||tab==="historial"||tab==="pagos")&&(
        <div style={{position:"fixed",bottom:24,right:24,zIndex:100}}>
          <button onClick={saveProfile} disabled={saving} style={{padding:"12px 24px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(29,78,216,0.4)",opacity:saving?0.7:1}}>
            {saving?"⏳ Guardando...":"💾 Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  root:    {minHeight:"100vh",background:"#f0f7ff",fontFamily:"'Segoe UI',system-ui,sans-serif"},
  nav:     {background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
  content: {maxWidth:1100,margin:"0 auto",padding:"24px 28px"},
  card:    {background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  label:   {display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:5},
  input:   {width:"100%",padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"},
};
