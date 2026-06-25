import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { useResponsive } from "./useResponsive";
import ChatPanel from "./ChatPanel";
import DayTripsCrew from "./DayTripsCrew";
import NotifPanel from "./NotifPanel";
import { countUnread } from "./notifications";
import { getReputation, Stars } from "./reputation.jsx";

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

const CREW_ROLES = ["Capitán","Primer Oficial","Jefe de Máquinas","Electricista","Marinero","Chef","Camarero","Mecánico","Carpintero","Soldador","Otro"];

const CERT_OPTIONS = [
  "STCW Básico","Licencia de Capitán","Primeros Auxilios Marítimo",
  "Seguridad Contraincendios","Supervivencia en el Mar","Radar ARPA",
  "GMDSS Operador","Buceo","Licencia Costera","Licencia de Pesca","Otro",
];

const LANGUAGES = ["Español","Inglés","Portugués","Francés","Italiano","Alemán","Holandés","Chino","Japonés","Árabe","Ruso"];

const NATIONALITIES = [
  "Venezuela","Estados Unidos","Colombia","España","México","Perú","Chile","Argentina",
  "Brasil","Ecuador","Panamá","Cuba","República Dominicana","Puerto Rico","Costa Rica",
  "Guatemala","Honduras","Nicaragua","El Salvador","Bolivia","Paraguay","Uruguay",
  "Reino Unido","Francia","Alemania","Italia","Portugal","Países Bajos","Bélgica","Suiza","Austria",
  "Suecia","Noruega","Dinamarca","Finlandia","Polonia","República Checa","Hungría","Rumania","Grecia","Turquía",
  "Rusia","Ucrania","Israel","Arabia Saudita","Emiratos Árabes Unidos","Líbano","Egipto","Marruecos","Nigeria",
  "Sudáfrica","Kenia","Etiopía","Ghana","Senegal","Camerún","Angola","Mozambique",
  "China","Japón","Corea del Sur","India","Pakistán","Bangladés","Vietnam","Tailandia",
  "Filipinas","Indonesia","Malasia","Singapur","Australia","Nueva Zelanda","Canadá",
  "Jamaica","Trinidad y Tobago","Barbados","Bahamas","Haití","Otro",
];

const BADGE_DEFS = [
  {id:"verified",    icon:"✅", label:"Usuario Certificado",color:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0"},
  {id:"stcw",        icon:"📜", label:"STCW Certificado",   color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe"},
  {id:"5years",      icon:"⭐", label:"5 Años de Exp.",     color:"#d97706", bg:"#fffbeb", border:"#fde68a"},
  {id:"10years",     icon:"🏆", label:"10 Años de Exp.",    color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe"},
  {id:"3boats",      icon:"🚢", label:"3+ Embarcaciones",   color:"#0891b2", bg:"#ecfeff", border:"#a5f3fc"},
  {id:"captain",     icon:"⚓", label:"Capitán Certificado",color:"#be185d", bg:"#fdf2f8", border:"#fbcfe8"},
  {id:"bilingual",   icon:"🌐", label:"Bilingüe",           color:"#059669", bg:"#ecfdf5", border:"#a7f3d0"},
  {id:"passport",    icon:"", label:"Pasaporte Vigente",   color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe"},
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
  const { isMobile, isTablet } = useResponsive();
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [tab,       setTab]       = useState("inicio");
  const [requests,  setRequests]  = useState([]);
  const [myRep, setMyRep] = useState({avg:null,count:0});
  const [completedCount, setCompletedCount] = useState(0);
  const [openApps, setOpenApps] = useState(0);
  const [search,    setSearch]    = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [msg,       setMsg]       = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [verifying, setVerifying]           = useState(false);
  const [verifyResult, setVerifyResult]     = useState(null);
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);
  const [newCert, setNewCert] = useState({name:"",custom_name:"",date:"",expiry:"",doc_url:""});
  const [newExp, setNewExp]   = useState({brand:"",length:"",role:"",period:"",notes:""});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [pendingUpload, setPendingUpload] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [crewWeather, setCrewWeather] = useState(null);
  const [myBoats, setMyBoats] = useState([]);
  const [perfilSub, setPerfilSub] = useState("datos"); // datos / documentos / certs / historial

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const load = async () => { const n = await countUnread(user.id); if (active) setUnreadCount(n); };
    load();
    const interval = setInterval(load, 20000);
    return () => { active = false; clearInterval(interval); };
  }, [user?.id, showNotifPanel]);
  const photoRef  = useRef();
  const docRef    = useRef();

  // Clima según la zona de trabajo del tripulante
  useEffect(() => {
    const zone = profile?.work_zone?.trim();
    if (!zone) { setCrewWeather(null); return; }
    const isLocal = window.location.hostname === "localhost";
    const KEY = "756f12d0c20d29f76808839251369ef7";
    const url = isLocal
      ? `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(zone)}&appid=${KEY}&units=metric&lang=es`
      : `/api/weather?city=${encodeURIComponent(zone)}`;
    fetch(url).then(r=>r.json()).then(data=>{
      if (data.main) {
        const ICONS={"01":"☀️","02":"🌤","03":"⛅","04":"☁️","09":"🌧","10":"🌦","11":"⛈","13":"❄️","50":"🌫"};
        const code=(data.weather?.[0]?.icon||"01").slice(0,2);
        setCrewWeather({ temp:Math.round(data.main.temp), wind:Math.round((data.wind?.speed||0)*1.944), condition:data.weather?.[0]?.description||"", icon:ICONS[code]||"🌤", city:data.name||zone });
      }
    }).catch(()=>{});
  }, [profile?.work_zone]);

  // Barcos donde este tripulante es capitán/gestor asignado
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("captain_profiles").select("*, vessels(*)").eq("user_id", user.id).eq("active", true)
      .then(({ data }) => setMyBoats((data||[]).filter(c=>c.vessels)));
  }, [user?.id]);

  const TABS = [
    {key:"inicio",   icon:"", label:"Inicio"},
    {key:"perfil",   icon:"", label:"Mi Perfil"},
    {key:"pagos",    icon:"", label:"Pagos"},
    {key:"buscar",   icon:"", label:"Buscar Barco"},
    {key:"daytrips", icon:"", label:"Day Trips"},
    {key:"solicitudes",icon:"", label:"Solicitudes"},
  ];

  useEffect(() => { loadProfile(); loadRequests(); loadStats(); }, []);

  const loadStats = async () => {
    setMyRep(await getReputation(user.id));
    const { count: comp } = await supabase.from("day_trips")
      .select("id",{count:"exact",head:true}).eq("selected_crew_id",user.id).eq("status","completed");
    setCompletedCount(comp||0);
    const { count: apps } = await supabase.from("day_trip_applications")
      .select("id",{count:"exact",head:true}).eq("crew_id",user.id).eq("status","pending");
    setOpenApps(apps||0);
  };

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) {
      // Asegurar que los arrays/objetos nunca sean null
      setProfile({
        ...data,
        languages: data.languages||["Español"],
        certifications: data.certifications||[],
        experience: data.experience||[],
        badges: data.badges||[],
        fun_facts: data.fun_facts||{},
        payment_methods: data.payment_methods||{},
        documents: data.documents||[],
        available: data.available||false,
        email: data.email||user.email||"",
      });
    } else {
      setProfile({
        full_name:"", bio:"", phone:"", phone_code:"+58", crew_role:"Capitán",
        certifications:[], experience:[], badges:[], available:false, location:"",
        nationality:"", languages:["Español"], fun_facts:{},
        payment_methods:{}, photo_url:null, id_doc_url:null, passport_url:null, legal_name:'', has_passport:false,
        first_name:"", last_name:"", email: user.email||"", documents:[],
      });
    }
    setLoading(false);
  };

  const loadRequests = async () => {
    const { data } = await supabase.from("connections")
      .select("*, vessel:vessel_id(name,marina,type,city)")
      .eq("crew_id", user.id).order("created_at",{ascending:false});
    setRequests(data||[]);
  };

  const saveProfile = async () => {
    const faltantes = [];
    if (!profile.first_name?.trim())  faltantes.push("Nombre");
    if (!profile.last_name?.trim())   faltantes.push("Apellido");
    if (!profile.phone?.trim())       faltantes.push("Teléfono");
    if (!profile.nationality?.trim()) faltantes.push("País de origen");
    if (!(profile.languages||[]).length) faltantes.push("Idiomas");
    if (!profile.crew_role?.trim())   faltantes.push("Rol principal");
    if (!profile.bio?.trim())         faltantes.push("Bio / CV");

    if (faltantes.length > 0) {
      setMsg("⚠️ Completa estos campos obligatorios: " + faltantes.join(", "));
      setTimeout(()=>setMsg(""),5000);
      return;
    }

    setSaving(true);
    const full_name = `${profile.first_name||""} ${profile.last_name||""}`.trim() || profile.full_name || "";
    const badges = computeBadges(profile, full_name);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, email: profile.email||user.email,
      full_name, ...profile, badges,
    });
    if (error) {
      setMsg("⚠️ No se pudo guardar: " + error.message);
      console.error("[NautiTrack] saveProfile error:", error);
    } else {
      setProfile(p=>({...p, badges, full_name}));
      setMsg("✅ Perfil guardado correctamente");
    }
    setTimeout(()=>setMsg(""),4000);
    setSaving(false);
  };

  const computeBadges = (p, full_name) => {
    const earned = [...(p.badges||[]).filter(b=>["verified","passport"].includes(b))]; // preservar verified y passport
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
    return [...new Set(earned)];
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop();
    const path = `profiles/${user.id}/photo.${ext}`;
    await supabase.storage.from("manuales").upload(path, file, {upsert:true});
    const { data } = supabase.storage.from("manuales").getPublicUrl(path);
    const url = data.publicUrl + "?t=" + Date.now();
    set("photo_url", url);
    await supabase.from("profiles").update({ photo_url: url }).eq("id", user.id);
    setUploadingPhoto(false);
  };

  const uploadDoc = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `profiles/${user.id}/id_doc.${ext}`;
    await supabase.storage.from("manuales").upload(path, file, {upsert:true});
    const { data } = supabase.storage.from("manuales").getPublicUrl(path);
    const url = data.publicUrl + "?t=" + Date.now();
    set("id_doc_url", url);
    // Guardar inmediatamente + agregar a documentos
    const docs = [...(profile.documents||[]).filter(d=>d.type!=="cedula"), {type:"cedula", name:"Documento de Identidad", url, folder:"Identidad", uploaded:new Date().toISOString()}];
    set("documents", docs);
    await supabase.from("profiles").update({ id_doc_url: url, documents: docs }).eq("id", user.id);
    setMsg("✅ Documento subido y guardada");
    setTimeout(()=>setMsg(""),3000);
  };

  const verifyIdentity = async () => {
    if (!profile.id_doc_url) { setMsg("⚠️ Sube tu documento de identidad primero"); setTimeout(()=>setMsg(""),4000); return; }
    if (!profile.photo_url)  { setMsg("⚠️ Sube tu foto de perfil primero"); setTimeout(()=>setMsg(""),4000); return; }
    if (!profile.legal_name?.trim()) { setMsg("⚠️ Escribe tu nombre completo como aparece en el documento"); setTimeout(()=>setMsg(""),4000); return; }
    setVerifying(true); setMsg("");
    try {
      const toBase64 = async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error("No se pudo leer la imagen ("+r.status+")");
        const blob = await r.blob();
        if (blob.size < 100) throw new Error("La imagen está vacía o corrupta");
        return new Promise((res,rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(',')[1]);
          reader.onerror = () => rej(new Error("Error leyendo la imagen"));
          reader.readAsDataURL(blob);
        });
      };

      const idDocBase64        = await toBase64(profile.id_doc_url);
      const profilePhotoBase64 = await toBase64(profile.photo_url);

      const resp = await fetch('/api/verify-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePhotoBase64, idDocBase64, legalName: profile.legal_name }),
      });
      const data = await resp.json();
      console.log("[NautiTrack] verify-id respuesta:", data);

      if (data.error) {
        setMsg("⚠️ Error del verificador: " + data.error);
        setTimeout(()=>setMsg(""),6000);
        setVerifying(false);
        return;
      }

      if (data.success && data.result) {
        setVerifyResult(data.result);
        const passed = data.result.is_official_doc && data.result.face_in_doc &&
          (data.result.faces_match !== false);
        if (passed) {
          const badges = [...new Set([...(profile.badges||[]), "verified"])];
          const updates = {
            badges,
            verified_name: data.result.extracted_name||null,
            id_number: data.result.id_number||null,
          };
          setProfile(p=>({...p, ...updates}));
          await supabase.from("profiles").update(updates).eq("id", user.id);
          setShowVerifyPopup(true);
        } else {
          let razon = "No se pudo verificar. ";
          if (!data.result.face_in_doc) razon += "No se detectó foto en el documento. ";
          if (data.result.faces_match===false) razon += "La foto de perfil no coincide con el documento. ";
          if (!data.result.is_official_doc) razon += "El documento no parece oficial. ";
          setMsg("⚠️ " + razon);
          setTimeout(()=>setMsg(""),6000);
        }
      } else {
        setMsg("⚠️ El verificador no devolvió resultado. Intenta de nuevo.");
        setTimeout(()=>setMsg(""),5000);
      }
    } catch(e) {
      setMsg("⚠️ Error al verificar: " + e.message);
      setTimeout(()=>setMsg(""),6000);
    }
    setVerifying(false);
  };

  // ── Manejo de documentos y carpetas ──
  const uploadDocument = async (file, folder) => {
    if (!file) return;
    const ext = file.name.split(".").pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `profiles/${user.id}/docs/${Date.now()}_${safeName}`;
    await supabase.storage.from("manuales").upload(path, file, {upsert:true});
    const { data } = supabase.storage.from("manuales").getPublicUrl(path);
    const newDoc = { type:"file", name:file.name, url:data.publicUrl, folder:folder||"General", uploaded:new Date().toISOString() };
    const docs = [...(profile.documents||[]), newDoc];
    set("documents", docs);
    await supabase.from("profiles").update({ documents: docs }).eq("id", user.id);
    setMsg("✅ Documento guardado en " + (folder||"General"));
    setTimeout(()=>setMsg(""),3000);
  };

  const deleteDocument = async (idx) => {
    const docs = (profile.documents||[]).filter((_,i)=>i!==idx);
    set("documents", docs);
    await supabase.from("profiles").update({ documents: docs }).eq("id", user.id);
  };

  const addFolder = async (name) => {
    if (!name) return;
    const folders = [...new Set([...(profile.doc_folders||["Identidad","Licencias","Certificados"]), name])];
    set("doc_folders", folders);
    await supabase.from("profiles").update({ doc_folders: folders }).eq("id", user.id);
  };

  const addCertification = async () => {
    if (!newCert.name) { setMsg("⚠️ Selecciona el tipo de certificación"); setTimeout(()=>setMsg(""),3000); return; }
    if (!newCert.doc_url) { setMsg("⚠️ Debes subir el documento de la certificación"); setTimeout(()=>setMsg(""),3000); return; }
    const certs = [...(profile.certifications||[]), newCert];
    set("certifications", certs);
    await supabase.from("profiles").update({ certifications: certs }).eq("id", user.id);
    setNewCert({name:"",custom_name:"",date:"",expiry:"",doc_url:""});
    setMsg("✅ Certificación agregada");
    setTimeout(()=>setMsg(""),3000);
  };

  const deleteCertification = async (i) => {
    const certs = (profile.certifications||[]).filter((_,idx)=>idx!==i);
    set("certifications", certs);
    await supabase.from("profiles").update({ certifications: certs }).eq("id", user.id);
  };

  const addExperience = async () => {
    if (!newExp.brand) { setMsg("⚠️ Indica la marca del barco"); setTimeout(()=>setMsg(""),3000); return; }
    const exps = [...(profile.experience||[]), newExp];
    set("experience", exps);
    await supabase.from("profiles").update({ experience: exps }).eq("id", user.id);
    setNewExp({brand:"",length:"",role:"",period:"",notes:""});
    setMsg("✅ Experiencia agregada");
    setTimeout(()=>setMsg(""),3000);
  };

  const deleteExperience = async (i) => {
    const exps = (profile.experience||[]).filter((_,idx)=>idx!==i);
    set("experience", exps);
    await supabase.from("profiles").update({ experience: exps }).eq("id", user.id);
  };

  const searchVessels = async () => {
    setSearching(true);
    // Buscar por ciudad o tipo (no por nombre, el tripulante no debe buscar por nombre del barco)
    let q = supabase.from("vessels").select("id,name,type,marina,city,captain,brand,model,lengthFt,owner_id");
    if (search.trim()) q = q.or(`city.ilike.%${search}%,type.ilike.%${search}%`);
    const { data } = await q.limit(20);
    setSearchRes(data||[]);
    setSearching(false);
  };

  const sendRequest = async (vessel) => {
    if (!(profile.badges||[]).includes("verified")) {
      setMsg("⚠️ Debes verificar tu identidad antes de aplicar a un barco");
      setTimeout(()=>setMsg(""),5000);
      return;
    }
    const { error } = await supabase.from("connections").insert({
      vessel_id:vessel.id, owner_id:vessel.owner_id||null, crew_id:user.id,
      initiated_by:"crew_applied", status:"pending",
      crew_role: profile.crew_role||"Marinero",
      message:`${profile.first_name||""} aplicó como ${profile.crew_role||"Marinero"}`,
    });
    if (error?.code==="23505") setMsg("⚠️ Ya aplicaste a este barco");
    else if (error) setMsg("⚠️ Error: "+error.message);
    else { setMsg("✅ ¡Aplicación enviada! El dueño la revisará"); loadRequests(); }
    setTimeout(()=>setMsg(""),4000);
  };

  const respondToInvite = async (conn, newStatus) => {
    await supabase.from("connections").update({ status:newStatus }).eq("id", conn.id);
    setMsg(newStatus==="matched"?"✅ ¡Match! Ya puedes chatear con el propietario":"Invitación rechazada");
    setTimeout(()=>setMsg(""),4000);
    loadRequests();
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
      <nav style={{...s.nav, padding:isMobile?"10px 14px":"12px 24px"}}>
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

        {isMobile ? (
          <button onClick={()=>setMobileMenuOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",flexDirection:"column",gap:4}}>
            <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
            <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
            <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
          </button>
        ) : (
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
            <div style={{position:"relative",marginLeft:4}}>
              <span style={{fontSize:18,cursor:"pointer"}} onClick={()=>setShowNotifPanel(true)}>🔔</span>
              {unreadCount>0&&<div style={{position:"absolute",top:-4,right:-4,background:"#dc2626",color:"#fff",fontSize:9,fontWeight:700,minWidth:15,height:15,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{unreadCount}</div>}
            </div>
            <button onClick={onLogout} style={{padding:"5px 10px",background:"none",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:11,color:"#94a3b8",marginLeft:4}}>Salir</button>
          </div>
        )}
      </nav>

      {/* Menú móvil deslizante */}
      {isMobile&&mobileMenuOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:200}} onClick={()=>setMobileMenuOpen(false)}>
          <div style={{position:"absolute",left:0,top:0,bottom:0,width:260,background:"#fff",boxShadow:"2px 0 20px rgba(0,0,0,0.2)",display:"flex",flexDirection:"column",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>Menú</div>
              <button onClick={()=>setMobileMenuOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
            </div>
            <div style={{padding:"12px"}}>
              {TABS.map(t=>(
                <button key={t.key} onClick={()=>{setTab(t.key);setMobileMenuOpen(false);}} style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",textAlign:"left",
                  padding:"12px 14px",border:"none",borderRadius:8,cursor:"pointer",marginBottom:2,
                  background:tab===t.key?"#eff6ff":"transparent",color:tab===t.key?"#2563eb":"#1e293b",
                  fontWeight:tab===t.key?700:500,fontSize:14
                }}>
                  <span>{t.icon} {t.label}</span>
                  {t.key==="solicitudes"&&requests.filter(r=>r.status==="pending").length>0&&(
                    <span style={{background:"#ef4444",color:"#fff",borderRadius:"50%",padding:"1px 6px",fontSize:10}}>
                      {requests.filter(r=>r.status==="pending").length}
                    </span>
                  )}
                </button>
              ))}
              <div style={{borderTop:"1px solid #f1f5f9",marginTop:8,paddingTop:8}}>
                <button onClick={()=>{onLogout();setMobileMenuOpen(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderRadius:8,cursor:"pointer",background:"transparent",color:"#dc2626",fontWeight:600,fontSize:14}}>🚪 Cerrar Sesión</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{...s.content, padding:isMobile?"16px 14px":"24px 28px"}}>

        {/* ── INICIO (dashboard resumido) ── */}
        {tab==="inicio"&&(
          <div style={{maxWidth:760}}>
            {/* Saludo + clima */}
            <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",borderRadius:18,padding:isMobile?"20px":"24px 28px",color:"#fff",marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
                <div>
                  <div style={{fontSize:12,opacity:0.7,marginBottom:4,textTransform:"capitalize"}}>{new Date().toLocaleDateString("es-VE",{weekday:"long",day:"numeric",month:"long"})}</div>
                  <div style={{fontSize:24,fontWeight:800}}>Hola{profile.first_name?`, ${profile.first_name}`:""}</div>
                  <div style={{fontSize:13,opacity:0.85,marginTop:2}}>{(profile.badges||[]).includes("verified")?"Estás listo para navegar":"Completa tu verificación para empezar"}</div>
                </div>
                {crewWeather&&(
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:40,lineHeight:1}}>{crewWeather.icon}</div>
                    <div style={{fontSize:26,fontWeight:800}}>{crewWeather.temp}°</div>
                    <div style={{fontSize:11,opacity:0.8}}>{crewWeather.city}</div>
                    <div style={{fontSize:10,opacity:0.7,textTransform:"capitalize"}}>{crewWeather.condition} · {crewWeather.wind} km/h</div>
                  </div>
                )}
              </div>
            </div>

            {/* Tarjetas de resumen */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:24}}>
              <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16}}>
                <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:6}}>MI REPUTACIÓN</div>
                <Stars avg={myRep.avg} count={myRep.count} size={15}/>
              </div>
              <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16}}>
                <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:6}}>VIAJES COMPLETADOS</div>
                <div style={{fontSize:24,fontWeight:800,color:"#0f172a"}}>{completedCount}</div>
              </div>
              <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16}}>
                <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:6}}>POSTULACIONES ACTIVAS</div>
                <div style={{fontSize:24,fontWeight:800,color:"#0f172a"}}>{openApps}</div>
              </div>
              <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:16}}>
                <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:6}}>ESTADO</div>
                <div style={{fontSize:14,fontWeight:700,color:(profile.badges||[]).includes("verified")?"#16a34a":"#d97706"}}>
                  {(profile.badges||[]).includes("verified")?"Verificado":"Sin verificar"}
                </div>
              </div>
            </div>

            {/* Aviso si no está verificado */}
            {!(profile.badges||[]).includes("verified")&&(
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:14,padding:16,marginBottom:20}}>
                <div style={{fontSize:14,fontWeight:700,color:"#b45309",marginBottom:4}}>Completa tu verificación</div>
                <div style={{fontSize:12,color:"#92400e",marginBottom:10}}>Verifica tu identidad para poder aplicar a barcos y recibir solicitudes de viaje.</div>
                <button onClick={()=>setTab("perfil")} style={{padding:"8px 16px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Ir a Mi Perfil</button>
              </div>
            )}

            {/* Accesos rápidos */}
            <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Accesos rápidos</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:24}}>
              <button onClick={()=>setTab("daytrips")} style={qaBtn}>Ver viajes disponibles (Day Trips)</button>
              <button onClick={()=>setTab("buscar")} style={qaBtn}>Buscar barcos para trabajar</button>
              <button onClick={()=>setTab("perfil")} style={qaBtn}>Editar mi perfil</button>
              <button onClick={()=>setTab("solicitudes")} style={qaBtn}>Ver mis solicitudes</button>
            </div>

            {/* Mis barcos (donde es capitán/gestor fijo) */}
            {myBoats.length>0&&(
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Mis barcos</div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Embarcaciones que gestionas. Toca una para abrir su panel.</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {myBoats.map(b=>(
                    <button key={b.id} onClick={()=>setTab("barco")} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,cursor:"pointer",textAlign:"left",width:"100%"}}>
                      <div style={{width:44,height:44,borderRadius:10,background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:18,flexShrink:0}}>{(b.vessels?.name||"?")[0].toUpperCase()}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{b.vessels?.name}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{b.role} · {b.vessels?.type||""}{b.vessels?.marina?` · ${b.vessels.marina}`:""}</div>
                      </div>
                      <span style={{fontSize:18,color:"#cbd5e1"}}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MI PERFIL ── */}
        {tab==="perfil"&&(
          <div style={{maxWidth:isMobile?"100%":980,margin:"0 auto"}}>
            {/* Sub-pestañas */}
            <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",borderBottom:"1px solid #e2e8f0",paddingBottom:0}}>
              {[{k:"datos",l:"Mi Perfil"},{k:"documentos",l:"Documentos"},{k:"certs",l:"Certificaciones"},{k:"historial",l:"Historial"}].map(st=>(
                <button key={st.k} onClick={()=>setPerfilSub(st.k)} style={{
                  padding:"10px 16px",border:"none",background:"none",cursor:"pointer",fontSize:13,whiteSpace:"nowrap",
                  fontWeight:perfilSub===st.k?700:500, color:perfilSub===st.k?"#2563eb":"#64748b",
                  borderBottom:perfilSub===st.k?"2px solid #2563eb":"2px solid transparent",marginBottom:-1,
                }}>{st.l}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── MI PERFIL: DATOS ── */}
        {tab==="perfil"&&perfilSub==="datos"&&(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"300px 1fr",gap:20}}>

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
                  {(() => {
                    const unlocked = (profile.badges||[]).includes("verified");
                    const isOn = unlocked && profile.available;
                    return (
                      <>
                        <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>
                          {unlocked ? "Activa para que los propietarios te encuentren" : "🔒 Verifica tu identidad con IA para activar"}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div onClick={async ()=>{
                            if (!unlocked) { setMsg("🔒 Primero verifica tu identidad: sube foto, documento, nombre y presiona Verificar identidad"); setTimeout(()=>setMsg(""),5000); return; }
                            const newVal = !profile.available;
                            set("available", newVal);
                            await supabase.from("profiles").update({ available:newVal }).eq("id", user.id);
                          }} style={{
                            width:42,height:24,borderRadius:12,
                            background: isOn ? "#16a34a" : "#cbd5e1",
                            cursor: unlocked ? "pointer" : "not-allowed",
                            position:"relative", transition:"background 0.2s",
                            opacity: unlocked ? 1 : 0.45,
                          }}>
                            <div style={{position:"absolute",top:3,left:isOn?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                          </div>
                          <span style={{fontSize:12,color:isOn?"#16a34a":"#94a3b8",fontWeight:600}}>
                            {!unlocked ? "Bloqueado" : isOn ? "Disponible" : "No disponible"}
                          </span>
                        </div>
                      </>
                    );
                  })()}
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

              {/* Documento de identidad */}
              <div style={s.card}>
                <div style={{fontSize:12,fontWeight:700,color:"#0f172a",marginBottom:4}}>Documento de Identidad</div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Visible para propietarios que te contraten · Genera badge ✅ Verificado</div>
                <input ref={docRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>uploadDoc(e.target.files[0])}/>

                {/* Campo nombre legal */}
                <div style={{marginBottom:10}}>
                  <label style={s.label}>Nombre completo como aparece en el documento *</label>
                  <input value={profile.legal_name||""} onChange={e=>set("legal_name",e.target.value)}
                    placeholder="Ej: Pedro Enrique Aguilar López" style={s.input}/>
                </div>

                {profile.id_doc_url
                  ? <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✅ Documento subido</span>
                        <button onClick={()=>docRef.current.click()} style={{fontSize:10,padding:"3px 8px",border:"1px solid #e2e8f0",borderRadius:5,background:"#f8fafc",cursor:"pointer",color:"#64748b"}}>Cambiar</button>
                      </div>
                      {(profile.badges||[]).includes("verified")
                        ? <div style={{fontSize:11,color:"#16a34a",fontWeight:600,background:"#f0fdf4",padding:"6px 10px",borderRadius:7,border:"1px solid #bbf7d0"}}>✅ Identidad verificada por IA</div>
                        : <button onClick={verifyIdentity} disabled={verifying||!profile.legal_name} style={{width:"100%",padding:"8px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",opacity:(verifying||!profile.legal_name)?0.5:1}}>
                            {verifying?"Verificando...":"Verificar identidad con IA"}
                          </button>
                      }
                      {!profile.legal_name&&<div style={{fontSize:10,color:"#f59e0b"}}>⚠️ Escribe tu nombre legal arriba para verificar</div>}
                      {verifyResult&&(
                        <div style={{fontSize:10,color:"#64748b",background:"#f8fafc",padding:"8px",borderRadius:7,border:"1px solid #e2e8f0"}}>
                          {verifyResult.extracted_name&&<div>Nombre detectado: <strong>{verifyResult.extracted_name}</strong></div>}
                          {verifyResult.id_number&&<div>Documento: <strong>{verifyResult.id_number}</strong></div>}
                          {verifyResult.notes&&<div style={{marginTop:4,color:"#94a3b8"}}>{verifyResult.notes}</div>}
                        </div>
                      )}
                    </div>
                  : <button onClick={()=>docRef.current.click()} style={{width:"100%",padding:"8px",border:"1.5px dashed #cbd5e1",borderRadius:8,background:"#f8fafc",cursor:"pointer",fontSize:11,color:"#64748b",textAlign:"center"}}>
                      📷 Subir foto del documento de identidad
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
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:14}}>Información Personal</div>

                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
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
                  <label style={s.label}>Teléfono *</label>
                  <div style={{display:"flex",gap:6}}>
                    <select value={profile.phone_code||"+58"} onChange={e=>set("phone_code",e.target.value)} style={{...s.input,width:140,flexShrink:0}}>
                      {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code} {c.name}</option>)}
                    </select>
                    <input value={profile.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="4141234567" style={{...s.input,flex:1}}/>
                  </div>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={s.label}>Email</label>
                  <input value={profile.email||user.email||""} onChange={e=>set("email",e.target.value)} style={{...s.input,background:"#f8fafc"}} readOnly/>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>Para cambiar tu email contacta soporte en info@nautitrack.vz</div>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={s.label}>País de origen *</label>
                  <select value={profile.nationality||""} onChange={e=>set("nationality",e.target.value)} style={s.input}>
                    <option value="">Selecciona tu país...</option>
                    {NATIONALITIES.map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={s.label}>Zona de trabajo *</label>
                  <input value={profile.work_zone||""} onChange={e=>set("work_zone",e.target.value)} placeholder="Ej: Lechería, Puerto La Cruz, Margarita" style={s.input}/>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>La ciudad o zona donde trabajas. Recibirás solicitudes de viaje de tu zona.</div>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={s.label}>Idiomas *</label>
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

                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <label style={s.label}>Rol principal *</label>
                    <select value={profile.crew_role||"Capitán"} onChange={e=>set("crew_role",e.target.value)} style={s.input}>
                      {CREW_ROLES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Otros roles</label>
                    <select value={profile.secondary_role||""} onChange={e=>set("secondary_role",e.target.value)} style={s.input}>
                      <option value="">Ninguno</option>
                      {CREW_ROLES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={s.label}>Bio / CV breve *</label>
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
        {tab==="perfil"&&perfilSub==="certs"&&(
          <div style={{maxWidth:700}}>
            {/* Lista de certificaciones guardadas */}
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:4}}>Mis Certificaciones</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Tus certificaciones náuticas con documento de respaldo</div>
              <div style={{fontSize:11,color:"#2563eb",marginBottom:16}}>Las certificaciones visibles (STCW, licencias, primeros auxilios) te hacen más atractivo y te abren mejores oportunidades de trabajo.</div>

              {(profile.certifications||[]).length===0
                ? <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
                    <div style={{fontSize:36,marginBottom:8}}>📜</div>
                    <div style={{fontWeight:600}}>Sin certificaciones aún</div>
                  </div>
                : <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
                    {(profile.certifications||[]).map((cert,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                        <div style={{fontSize:22}}>📜</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{cert.name==="Otro"?cert.custom_name:cert.name}</div>
                          <div style={{fontSize:11,color:"#64748b"}}>
                            {cert.date&&`Emitido: ${cert.date}`}{cert.expiry&&` · Vence: ${cert.expiry}`}
                          </div>
                        </div>
                        {cert.doc_url&&<a href={cert.doc_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#2563eb",fontWeight:600}}>Ver doc</a>}
                        <button onClick={()=>deleteCertification(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:16}}>🗑</button>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Formulario nueva certificación */}
            <div style={{...s.card,marginTop:16,border:"1.5px solid #bfdbfe"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#1d4ed8",marginBottom:14}}>＋ Agregar Certificación</div>
              <div style={{marginBottom:10}}>
                <label style={s.label}>Certificación</label>
                <select value={newCert.name} onChange={e=>setNewCert({...newCert,name:e.target.value})} style={s.input}>
                  <option value="">Seleccionar...</option>
                  {CERT_OPTIONS.map(o=><option key={o}>{o}</option>)}
                </select>
                {newCert.name==="Otro"&&(
                  <input value={newCert.custom_name} onChange={e=>setNewCert({...newCert,custom_name:e.target.value})}
                    placeholder="Especifica la certificación" style={{...s.input,marginTop:6}}/>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <label style={s.label}>Fecha de emisión</label>
                  <input type="date" value={newCert.date} onChange={e=>setNewCert({...newCert,date:e.target.value})} style={s.input}/>
                </div>
                <div>
                  <label style={s.label}>Fecha de vencimiento</label>
                  <input type="date" value={newCert.expiry} onChange={e=>setNewCert({...newCert,expiry:e.target.value})} style={s.input}/>
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={s.label}>Diploma / Certificado *</label>
                {newCert.doc_url
                  ? <div style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✅ Documento cargado</div>
                  : <label style={{display:"block",padding:"8px 12px",border:"1.5px dashed #cbd5e1",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:11,color:"#64748b",textAlign:"center"}}>
                      📎 Subir foto o PDF del certificado (obligatorio)
                      <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={async e=>{
                        const file=e.target.files[0]; if(!file) return;
                        const path=`profiles/${user.id}/cert_${Date.now()}.${file.name.split(".").pop()}`;
                        await supabase.storage.from("manuales").upload(path,file,{upsert:true});
                        const {data:d}=supabase.storage.from("manuales").getPublicUrl(path);
                        setNewCert(nc=>({...nc,doc_url:d.publicUrl}));
                      }}/>
                    </label>
                }
              </div>
              <button onClick={addCertification} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Agregar a mi perfil
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab==="perfil"&&perfilSub==="historial"&&(
          <div style={{maxWidth:700}}>
            {/* Lista de experiencias guardadas */}
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:4}}>🚢 Historial de Embarcaciones</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>Tu experiencia embarcado (el nombre del barco se mantiene privado)</div>

              {(profile.experience||[]).length===0
                ? <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
                    <div style={{fontSize:36,marginBottom:8}}>🚢</div>
                    <div style={{fontWeight:600}}>Sin historial aún</div>
                  </div>
                : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {(profile.experience||[]).map((exp,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                        <div style={{fontSize:22}}>🚢</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{exp.brand} {exp.length&&`· ${exp.length} pies`}</div>
                          <div style={{fontSize:11,color:"#64748b"}}>{exp.role}{exp.period&&` · ${exp.period}`}</div>
                          {exp.notes&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{exp.notes}</div>}
                        </div>
                        <button onClick={()=>deleteExperience(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:16}}>🗑</button>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Formulario nueva experiencia */}
            <div style={{...s.card,marginTop:16,border:"1.5px solid #bfdbfe"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#1d4ed8",marginBottom:14}}>＋ Agregar Experiencia</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <label style={s.label}>Marca del barco</label>
                  <input value={newExp.brand} onChange={e=>setNewExp({...newExp,brand:e.target.value})} placeholder="Ej: Sea Ray" style={s.input}/>
                </div>
                <div>
                  <label style={s.label}>Eslora (pies)</label>
                  <input value={newExp.length} onChange={e=>setNewExp({...newExp,length:e.target.value})} placeholder="Ej: 65" style={s.input}/>
                </div>
                <div>
                  <label style={s.label}>Tu rol</label>
                  <select value={newExp.role} onChange={e=>setNewExp({...newExp,role:e.target.value})} style={s.input}>
                    <option value="">Seleccionar...</option>
                    {CREW_ROLES.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Período</label>
                  <select value={newExp.period} onChange={e=>setNewExp({...newExp,period:e.target.value})} style={s.input}>
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
              <div style={{marginBottom:14}}>
                <label style={s.label}>Notas</label>
                <input value={newExp.notes} onChange={e=>setNewExp({...newExp,notes:e.target.value})} placeholder="Rutas frecuentes, tipo de operación, etc." style={s.input}/>
              </div>
              <button onClick={addExperience} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Agregar a mi perfil
              </button>
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

        {/* ── DOCUMENTOS ── */}
        {tab==="perfil"&&perfilSub==="documentos"&&(
          <div style={{maxWidth:760}}>
            <div style={s.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>Mis Documentos</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Documento de identidad, pasaporte, licencias y certificados · Organiza en carpetas</div>
                  <div style={{fontSize:11,color:"#2563eb",marginTop:4}}>Tener tus documentos al día y visibles le da confianza a los propietarios y acelera tu contratación.</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setNewFolderName("");setShowFolderModal(true);}}
                    style={{padding:"7px 12px",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:12,color:"#475569",fontWeight:600}}>
                    ＋ Carpeta
                  </button>
                  <label style={{padding:"7px 14px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700}}>
                    ⬆ Subir
                    <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>{
                      const f=e.target.files[0];
                      if(f){ setPendingUpload(f); setShowUploadModal(true); }
                    }}/>
                  </label>
                </div>
              </div>

              {/* Carpetas con documentos */}
              {(() => {
                const folders = [...new Set([...(profile.doc_folders||["Identidad","Licencias","Certificados"]), ...((profile.documents||[]).map(d=>d.folder||"General"))])];
                const docs = profile.documents||[];
                if (docs.length===0) return (
                  <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                    <div style={{fontSize:40,marginBottom:8}}>📁</div>
                    <div style={{fontWeight:600}}>Sin documentos</div>
                    <div style={{fontSize:12,marginTop:4}}>Tu documento aparecerá aquí al subirlo · Agrega licencias y certificados</div>
                  </div>
                );
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:16}}>
                    {folders.map(folder=>{
                      const folderDocs = docs.filter(d=>(d.folder||"General")===folder);
                      if (folderDocs.length===0) return null;
                      return (
                        <div key={folder}>
                          <div style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                            📂 {folder} <span style={{color:"#94a3b8",fontWeight:400}}>({folderDocs.length})</span>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
                            {folderDocs.map((doc)=>{
                              const realIdx = docs.indexOf(doc);
                              const isImg = /\.(jpg|jpeg|png|webp|gif)/i.test(doc.url) || doc.url.includes("?t=");
                              return (
                                <div key={realIdx} style={{border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",background:"#fff"}}>
                                  <a href={doc.url} target="_blank" rel="noreferrer">
                                    {isImg
                                      ? <img src={doc.url} style={{width:"100%",height:100,objectFit:"cover"}} alt={doc.name}/>
                                      : <div style={{width:"100%",height:100,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34}}>📄</div>
                                    }
                                  </a>
                                  <div style={{padding:"8px 10px"}}>
                                    <div style={{fontSize:11,fontWeight:600,color:"#0f172a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{doc.name}</div>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                                      <span style={{fontSize:9,color:"#94a3b8"}}>{new Date(doc.uploaded).toLocaleDateString("es-VE")}</span>
                                      {doc.type!=="cedula"&&<button onClick={()=>deleteDocument(realIdx)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:13}}>🗑</button>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── BUSCAR BARCO ── */}
        {tab==="buscar"&&(
          <div style={{maxWidth:600}}>
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:4}}>🔍 Buscar Embarcación</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>Encuentra barcos por ciudad o tipo y aplica directamente</div>

              {!(profile.badges||[]).includes("verified")&&(
                <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#b45309"}}>
                  ⚠️ Necesitas verificar tu identidad antes de aplicar a barcos. Ve a Mi Perfil → sube foto y documento → Verificar identidad.
                </div>
              )}

              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchVessels()}
                  placeholder="Ciudad o tipo (ej: Margarita, Yate Motor)..." style={{...s.input,flex:1}}/>
                <button onClick={searchVessels} disabled={searching}
                  style={{padding:"10px 16px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>
                  {searching?"...":"Buscar"}
                </button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {searchRes.map(v=>{
                  const conn=requests.find(r=>r.vessel_id===v.id);
                  const sent=!!conn;
                  return (
                    <div key={v.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                      <div style={{fontSize:28}}>🚢</div>
                      <div style={{flex:1}}>
                        {/* No mostramos nombre del barco — privacidad del dueño */}
                        <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{v.type}{v.lengthFt?` · ${v.lengthFt} pies`:""}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{v.brand||""} {v.model||""}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>📍 {v.city||"Ubicación reservada"}</div>
                      </div>
                      <button onClick={()=>!sent&&sendRequest(v)} disabled={sent} style={{
                        padding:"8px 14px",border:"none",borderRadius:8,cursor:sent?"default":"pointer",
                        background:sent?"#f1f5f9":"linear-gradient(135deg,#1d4ed8,#0ea5e9)",
                        color:sent?"#94a3b8":"#fff",fontSize:12,fontWeight:700,whiteSpace:"nowrap",
                      }}>{sent?(conn.status==="matched"?"✓ Match":"✓ Aplicado"):"Aplicar"}</button>
                    </div>
                  );
                })}
                {searchRes.length===0&&!searching&&(
                  <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
                    {search?"No se encontraron embarcaciones":"Usa el buscador para ver barcos disponibles"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── DAY TRIPS ── */}
        {tab==="daytrips"&&(
          <div style={{maxWidth:600}}>
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:12}}>Viajes Disponibles</div>
              <DayTripsCrew user={user} profile={profile}/>
            </div>
          </div>
        )}

        {/* ── SOLICITUDES ── */}
        {tab==="solicitudes"&&(
          <div style={{maxWidth:600}}>
            <div style={s.card}>
              <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:16}}>📬 Mis Aplicaciones</div>
              {requests.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:40,marginBottom:12}}>📬</div>
                  <div>Sin aplicaciones aún</div>
                  <div style={{fontSize:12,marginTop:4}}>Ve a "Buscar Barco" para aplicar</div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {requests.map(r=>(
                  <div key={r.id} style={{padding:"12px 16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{r.vessel?.type||"Embarcación"}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>📍 {r.vessel?.city||"—"} · Rol: {r.crew_role}</div>
                        {r.initiated_by==="owner_invited"&&<div style={{fontSize:11,color:"#7c3aed",marginTop:2,fontWeight:600}}>⭐ El dueño te invitó</div>}
                      </div>
                      <span style={{
                        padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap",
                        background:r.status==="matched"?"#f0fdf4":r.status==="rejected"?"#fff5f5":"#fffbeb",
                        color:r.status==="matched"?"#16a34a":r.status==="rejected"?"#dc2626":"#d97706",
                        border:`1px solid ${r.status==="matched"?"#bbf7d0":r.status==="rejected"?"#fecaca":"#fde68a"}`,
                      }}>
                        {r.status==="matched"?"✅ Match":r.status==="rejected"?"❌ Rechazado":"⏳ Pendiente"}
                      </span>
                    </div>
                    {/* Si es invitación del dueño pendiente, botones aceptar/rechazar */}
                    {r.status==="pending"&&r.initiated_by==="owner_invited"&&(
                      <div style={{display:"flex",gap:8,marginTop:10}}>
                        <button onClick={()=>respondToInvite(r,"matched")} style={{flex:1,padding:"8px",background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Aceptar</button>
                        <button onClick={()=>respondToInvite(r,"rejected")} style={{flex:1,padding:"8px",background:"#f1f5f9",border:"none",borderRadius:8,color:"#dc2626",fontSize:12,fontWeight:700,cursor:"pointer"}}>Rechazar</button>
                      </div>
                    )}
                    {/* Si hay match, botón de chat */}
                    {r.status==="matched"&&(
                      <button onClick={()=>setActiveChat(r)} style={{width:"100%",marginTop:10,padding:"8px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,color:"#2563eb",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        💬 Abrir chat con el propietario
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal nueva carpeta */}
        {showFolderModal&&(
          <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={()=>setShowFolderModal(false)}>
            <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:360,width:"100%"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:700,color:"#0f172a",marginBottom:14}}>Nueva carpeta</div>
              <input value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} placeholder="Ej: Licencias de navegación" autoFocus style={{...s.input,marginBottom:16}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowFolderModal(false)} style={{flex:1,padding:"10px",background:"#f1f5f9",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,color:"#475569",fontWeight:600}}>Cancelar</button>
                <button onClick={async()=>{ if(newFolderName.trim()){ await addFolder(newFolderName.trim()); setMsg("✅ Carpeta '"+newFolderName.trim()+"' creada"); setTimeout(()=>setMsg(""),3000);} setShowFolderModal(false);}} style={{flex:1,padding:"10px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,color:"#fff",fontWeight:700}}>Crear</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal subir documento — elegir carpeta */}
        {showUploadModal&&(
          <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={()=>{setShowUploadModal(false);setPendingUpload(null);}}>
            <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:360,width:"100%"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:700,color:"#0f172a",marginBottom:6}}>Guardar documento</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>{pendingUpload?.name}</div>
              <label style={s.label}>Elige la carpeta</label>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {[...new Set([...(profile.doc_folders||["Identidad","Licencias","Certificados"]), "General"])].map(folder=>(
                  <button key={folder} onClick={async()=>{ await uploadDocument(pendingUpload, folder); setShowUploadModal(false); setPendingUpload(null);}}
                    style={{padding:"10px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontSize:13,color:"#1e293b",textAlign:"left",fontWeight:500}}>
                    📂 {folder}
                  </button>
                ))}
              </div>
              <button onClick={()=>{setShowUploadModal(false);setPendingUpload(null);}} style={{width:"100%",padding:"10px",background:"#f1f5f9",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,color:"#475569",fontWeight:600}}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Popup de verificación exitosa */}
        {/* Chat interno */}
        {showNotifPanel&&(
          <NotifPanel user={user} onClose={()=>setShowNotifPanel(false)} onNavigate={(link)=>{ if(link==="daytrips")setTab("daytrips"); }}/>
        )}

        {activeChat&&(
          <ChatPanel connection={activeChat} currentUserId={user.id} otherName="Propietario" onClose={()=>{setActiveChat(null);loadRequests();}}/>
        )}

        {showVerifyPopup&&(
          <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={()=>setShowVerifyPopup(false)}>
            <div style={{background:"#fff",borderRadius:20,padding:"32px 28px",maxWidth:380,textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
              <div style={{width:72,height:72,borderRadius:"50%",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,margin:"0 auto 16px"}}>✅</div>
              <div style={{fontSize:20,fontWeight:800,color:"#16a34a",marginBottom:8}}>¡Identidad Verificada!</div>
              <div style={{fontSize:13,color:"#475569",lineHeight:1.5,marginBottom:6}}>
                Tu documento y foto fueron verificados exitosamente con inteligencia artificial.
              </div>
              {verifyResult?.extracted_name&&(
                <div style={{fontSize:12,color:"#64748b",background:"#f8fafc",borderRadius:10,padding:"10px 14px",margin:"12px 0"}}>
                  <div><strong>{verifyResult.extracted_name}</strong></div>
                  {verifyResult.id_number&&<div style={{marginTop:2}}>{verifyResult.id_number}</div>}
                </div>
              )}
              <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:20,padding:"6px 14px",margin:"8px 0 16px"}}>
                <span>✅</span><span style={{fontSize:12,fontWeight:700,color:"#16a34a"}}>Usuario Certificado</span>
              </div>
              <button onClick={()=>setShowVerifyPopup(false)} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                Entendido
              </button>
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
      {(tab==="perfil"||tab==="pagos")&&(
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

const qaBtn = {padding:"14px 16px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,fontSize:13,fontWeight:600,color:"#1e293b",cursor:"pointer",textAlign:"left"};
