import { useState, useCallback } from "react";

const DEFAULT_SYSTEMS = [
  { id:"motores",    label:"Motores",                  icon:"🔧", trackHours:true,
    equipment:["Motor Estribor","Motor Babor","Motor Centro","Todos los Motores","Transmisión Estribor","Transmisión Babor","Filtro de Combustible","Filtro de Aceite","Impeller","Correas y Poleas","Heat Exchanger","Turbo Cargador","Inyectores","Mounts de Motor","Termostato"] },
  { id:"generador",  label:"Generador",                icon:"⚡", trackHours:true,
    equipment:["Generador Principal","Generador Secundario","Filtro Combustible Generador","Filtro Aceite Generador","Impeller Generador","Panel Control Generador"] },
  { id:"seakeeper",  label:"Seakeeper / Estabilizador", icon:"🌀", trackHours:true,
    equipment:["Seakeeper Principal","Seakeeper Secundario","Sistema Enfriamiento Seakeeper","Panel Control Seakeeper","Estabilizadores de Aletas"] },
  { id:"casco",      label:"Casco",                    icon:"🚢", trackHours:false,
    equipment:["Casco Fondo","Casco Costados","Cubierta","Superestructura","Antifouling","Ánodos de Zinc","Bocina del Eje","Timón","Espejo de Popa","Plataforma de Baño","Pasamanos","Escotillas","Portillos"] },
  { id:"eje",        label:"Eje y Propela",            icon:"⚙️", trackHours:false,
    equipment:["Eje Estribor","Eje Babor","Propela Estribor","Propela Babor","Cutless Bearing Estribor","Cutless Bearing Babor","Shaft Seal Estribor","Shaft Seal Babor","Acoplamientos","Strut Estribor","Strut Babor"] },
  { id:"electrico",  label:"Sistema Eléctrico",        icon:"🔌", trackHours:false,
    equipment:["Banco Baterías Principal","Banco Baterías Auxiliar","Cargador de Baterías","Inversor","Panel Eléctrico Principal","Shore Power","Cableado General","Luces de Navegación","Luces Internas","Windlass","Bow Thruster","Stern Thruster"] },
  { id:"agua",       label:"Sistema de Agua",          icon:"💧", trackHours:false,
    equipment:["Desalinizadora / Watermaker","Bomba Agua Dulce","Bomba Achique Principal","Bomba Achique Auxiliar","Tanque Agua Potable","Tanque Aguas Negras","Sistema Aguas Grises","Macerador","Filtros de Agua","Calentador de Agua","Inodoros"] },
  { id:"ac",         label:"A/C y Refrigeración",      icon:"❄️", trackHours:false,
    equipment:["A/C Camarote Principal","A/C Camarote 2","A/C Camarote 3","A/C Sala","A/C Puente","Compresor A/C","Evaporador","Condensador","Bomba Agua A/C","Refrigerador Principal","Refrigerador Cockpit","Congelador","Icemaker"] },
  { id:"navegacion", label:"Navegación y Electrónica", icon:"🧭", trackHours:false,
    equipment:["GPS Principal","GPS Secundario","Chartplotter","Radar","Autopiloto","VHF Principal","VHF Portátil","AIS","Depth Sounder","Instrumento de Viento","EPIRB","Compass","Cámara Térmica / FLIR","Sistema de Sonido","Internet / Satélite"] },
  { id:"hidraulico", label:"Sistema Hidráulico",       icon:"🔩", trackHours:false,
    equipment:["Plataforma Hidráulica","Timón Hidráulico","Bomba Hidráulica","Cilindros Hidráulicos","Mangueras Hidráulicas","Depósito Aceite Hidráulico","Davit Hidráulico","Grúa / Crane"] },
  { id:"seguridad",  label:"Equipos de Seguridad",     icon:"🛡️", trackHours:false,
    equipment:["Chalecos Salvavidas","Balsa Salvavidas","Señales Pirotécnicas","Extintores","Sistema Contra Incendio","EPIRB","PLB","Botiquín","Arneses y Líneas de Vida","Bomba Achique Manual"] },
  { id:"velas",      label:"Velas y Jarcia",           icon:"⛵", trackHours:false,
    equipment:["Vela Mayor","Génova","Spinnaker","Foque","Mesana","Botavara","Mástil","Estay de Proa","Estay de Popa","Obenques","Winches","Enrollador de Génova","Enrollador de Mayor"] },
  { id:"cubierta",   label:"Cubierta y Exterior",      icon:"🏠", trackHours:false,
    equipment:["Bimini","Toldo","Cockpit","Flybridge","Teak Cubierta","Teak Cockpit","Pulido y Encerado","Canvas / Fundas","Luces Externas","Ancla Principal","Cadena de Ancla","Windlass / Winch Ancla"] },
  { id:"interior",   label:"Interior y Comodidades",   icon:"🛋️", trackHours:false,
    equipment:["Cocina / Estufa","Horno","Microondas","Sistema de Audio","Televisores","Iluminación LED","Tapicería","Madera Interior","Ventiladores","Escotillas Internas"] },
  { id:"dinghy",     label:"Dinghy / Tender",          icon:"🚤", trackHours:true,
    equipment:["Dinghy / Tender","Motor Fuera de Borda","Davit","Inflador","Reparación y Parches"] },
];

const LOG_COLOR       = { Inspección:"#16a34a", Servicio:"#2563eb", Combustible:"#d97706", Salida:"#7c3aed", Compra:"#0891b2" };
const LOG_TYPES       = ["Inspección","Servicio","Combustible","Salida","Compra"];
const SERVICE_TYPES   = ["Preventivo","Reactivo","Reparación"];
const PAYMENT_METHODS = ["Zelle","Efectivo USD","Efectivo Bs","Pago Móvil","Transferencia","Tarjeta"];
const INTERVALS       = ["Una vez","Diario","Semanal","Quincenal","Mensual","Trimestral","Semestral","Anual","Por horas","Por millas"];
const SEGMENTS        = ["Mecánica","A/C y Refrigeración","Hidráulicos","Eléctrico","Teak / Fibra","Pintura","Electrónica","Grúa / Transporte","Buceo","Gestión","Broker","Surveyor","Otro"];
const STATUS_CFG      = {
  ok:      { label:"Al día",    color:"#16a34a", bg:"#dcfce7", dot:"#16a34a" },
  alert:   { label:"Atención",  color:"#d97706", bg:"#fef3c7", dot:"#d97706" },
  critical:{ label:"Crítico",   color:"#dc2626", bg:"#fee2e2", dot:"#dc2626" },
  overdue: { label:"Vencido",   color:"#dc2626", bg:"#fee2e2" },
  due:     { label:"Por vencer",color:"#d97706", bg:"#fef3c7" },
  done:    { label:"Completado",color:"#16a34a", bg:"#dcfce7" },
};

const INIT_VESSELS = [
  {
    id:1, name:"La Gaviota", type:"Velero 60'", marina:"Puerto La Cruz",
    captain:"Carlos Mendoza", fuel:72, fuelUnit:"gal", engineHours:1243, genHours:342, status:"alert",
    crew:["Carlos Mendoza","José Pérez","María González"],
    customSystems:[],
    profile:{ firstName:"Ricardo", lastName:"Ortega", phone:"305-799-7996", email:"ricardo@theboatingzone.com", marinaAddress:"Marina Puerto La Cruz, Muelle 12, Anzoátegui, Venezuela" },
    subscription:{ plan:"Pro", price:79, currency:"USD", cycle:"Mensual", nextBilling:"2025-07-05", status:"active" },
    providers:[
      {id:1,firstName:"Diego",lastName:"Chico",company:"The Boating Zone",phone:"786-307-6837",email:"diegochico@theboatingzone.com",segment:"Gestión",notes:"",referredBy:""},
      {id:2,firstName:"Ozzy",lastName:"",company:"Ozzy Marine Service",phone:"786-973-7501",email:"ozzymarine@live.com",segment:"Hidráulicos",notes:"",referredBy:"Diego Chico"},
      {id:3,firstName:"Osmani",lastName:"Perez",company:"Omikron",phone:"305-728-9204",email:"",segment:"Teak / Fibra",notes:"Sandblasting y debonding",referredBy:"Diego Chico"},
      {id:4,firstName:"Gary",lastName:"Gail",company:"Quality Air Marine",phone:"754-214-8457",email:"",segment:"A/C y Refrigeración",notes:"",referredBy:"Diego Chico"},
    ],
    details:{manufacturer:"Hatteras",model:"60 Convertible",year:"1998",hullType:"Fibra de vidrio",homePort:"Puerto La Cruz",uscg:"1234567",built:"Wilmington, NC",displacement:"55,000 lbs",grt:"42",nrt:"28",loa:"64'6\"",beam:"18'",draft:"5'2\"",clearanceWindInstrument:"28'",clearanceRadar:"24'",clearanceVHF:"30'",clearanceBimini:"8'6\"",clearanceWindshield:"7'",stbdFuelTank:"300 gal",portFuelTank:"300 gal",lowerFuelTank:"—",freshWater:"120 gal",wasteTank:"40 gal",anchor:"Bruce 66 lbs",anchorRode:"250' cadena 3/8\"",stbdEngine:"Caterpillar 3208 / 375 HP",stbdTransmission:"Twin Disc MG-514",portEngine:"Caterpillar 3208 / 375 HP",portTransmission:"Twin Disc MG-514",propeller:"24x22 cuatro palas (x2)",generator:"Kohler 20kW",dinghy:"Zodiac Pro 310",dinghyOutboard:"Yamaha 15 HP"},
    tasks:[
      {id:1,systemId:"motores",system:"Motores",equipment:"Motor Estribor",name:"Cambio de aceite y filtro",assigned:"Carlos Mendoza",interval:"Trimestral",nextDue:"2025-05-20",status:"overdue",notes:"Usar aceite 15W-40 marino."},
      {id:2,systemId:"casco",system:"Casco",equipment:"Casco Fondo",name:"Pulida y encerado",assigned:"Carlos Mendoza",interval:"Semestral",nextDue:"2025-06-19",status:"due",notes:"Cera marina UV."},
      {id:3,systemId:"agua",system:"Sistema de Agua",equipment:"Desalinizadora / Watermaker",name:"Service semanal watermaker",assigned:"Carlos Mendoza",interval:"Semanal",nextDue:"2025-05-30",status:"overdue",notes:"Flush con agua limpia."},
      {id:4,systemId:"navegacion",system:"Navegación y Electrónica",equipment:"GPS Principal",name:"Actualización de firmware",assigned:"Carlos Mendoza",interval:"Anual",nextDue:"2025-07-20",status:"ok",notes:"garmin.com/marine"},
      {id:5,systemId:"velas",system:"Velas y Jarcia",equipment:"Vela Mayor",name:"Inspección de costuras",assigned:"Carlos Mendoza",interval:"Semestral",nextDue:"2025-08-04",status:"ok",notes:"Revisar puntos de tensión."},
    ],
    log:[
      {id:1,date:"2025-06-05",type:"Servicio",serviceType:"Preventivo",systemId:"casco",equipment:"Casco Fondo",desc:"Pulida de casco. 2 capas de cera UV.",performedBy:"Osmani Perez (Omikron)",equipHours:null,photos:["f1","f2","f3"],fuelQty:null},
      {id:2,date:"2025-06-05",type:"Inspección",systemId:"motores",equipment:"Motor Estribor",desc:"Chequeo semanal. Niveles normales.",performedBy:"Carlos Mendoza",photos:[],fuelQty:null},
      {id:3,date:"2025-06-04",type:"Combustible",desc:"Repostaje Marina PLC.",performedBy:"Carlos Mendoza",photos:[],fuelQty:280,fuelUnit:"gal"},
      {id:4,date:"2025-06-02",type:"Salida",dest:"Mochima",persons:4,ownerAboard:true,crewSel:["Carlos Mendoza"],deptTime:"08:00",arrTime:"18:30",fuelOut:290,fuelIn:210,engineHrsOut:1240,engineHrsIn:1243,genHrsOut:340,genHrsIn:342,salidaClima:"Soleado 10kn",desc:"Sin novedades.",photos:["f1"]},
      {id:5,date:"2025-05-28",type:"Compra",item:"Filtro aceite Fleetguard FF5052",desc:"Repuesto para mantenimiento.",costUSD:45,costBs:null,payment:"Zelle",photos:["f1"]},
    ],
    records:[
      {id:1,date:"2023-03-23",type:"Preventivo",systemId:"eje",equipment:"Running Gear",hours:"N/A",desc:"Shaft seals, cutless bearings, balance hélices",performedBy:"FJ Propellers",cost:10558},
      {id:2,date:"2023-03-23",type:"Preventivo",systemId:"casco",equipment:"Casco Costados",hours:"N/A",desc:"Encerado y pulida",performedBy:"Omikron",cost:1000},
      {id:3,date:"2023-03-23",type:"Reactivo",systemId:"casco",equipment:"Casco Fondo",hours:"N/A",desc:"Sandblasting de fondo",performedBy:"Omikron",cost:4600},
      {id:4,date:"2023-03-23",type:"Reactivo",systemId:"casco",equipment:"Casco",hours:"N/A",desc:"Reparación fibra sala de máquinas",performedBy:"Omikron",cost:3000},
      {id:5,date:"2023-03-23",type:"Reactivo",systemId:"casco",equipment:"Casco",hours:"N/A",desc:"Reparación debonding #1",performedBy:"Omikron",cost:15295},
      {id:6,date:"2023-03-23",type:"Preventivo",systemId:"casco",equipment:"Casco Fondo",hours:"N/A",desc:"Pintura de fondo y propspeed",performedBy:"Omikron",cost:5800},
      {id:7,date:"2023-05-16",type:"Reactivo",systemId:"ac",equipment:"A/C Camarote Principal",hours:"N/A",desc:"Bomba A/C reventada",performedBy:"The Boating Zone",cost:1397},
      {id:8,date:"2023-08-16",type:"Reactivo",systemId:"ac",equipment:"Evaporador",hours:"N/A",desc:"Evaporadores con fuga, bandeja rota",performedBy:"Quality Air Marine",cost:14995},
    ],
    docs:12, alerts:2,
    weather:{temp:29,wind:14,condition:"Parcialmente nublado",icon:"⛅"},
  },
  {
    id:2,name:"Mar Adentro",type:"Yate Motor 48'",marina:"Tucacas",captain:"José Rivas",fuel:38,fuelUnit:"gal",engineHours:887,genHours:210,status:"critical",
    crew:["José Rivas"],customSystems:[],
    profile:{firstName:"Ricardo",lastName:"Ortega",phone:"305-799-7996",email:"ricardo@theboatingzone.com",marinaAddress:"Marina Tucacas, Muelle 3, Falcón, Venezuela"},
    subscription:{plan:"Pro",price:79,currency:"USD",cycle:"Mensual",nextBilling:"2025-07-05",status:"active"},
    providers:[],
    details:{manufacturer:"Bertram",model:"48 Convertible",year:"2002",hullType:"Fibra de vidrio",homePort:"Tucacas",uscg:"7654321",built:"Miami, FL",displacement:"42,000 lbs",grt:"35",nrt:"22",loa:"52'",beam:"16'6\"",draft:"4'8\"",clearanceWindInstrument:"24'",clearanceRadar:"22'",clearanceVHF:"26'",clearanceBimini:"8'",clearanceWindshield:"7'",stbdFuelTank:"250 gal",portFuelTank:"250 gal",lowerFuelTank:"—",freshWater:"100 gal",wasteTank:"35 gal",anchor:"Danforth 44 lbs",anchorRode:"200' cadena 3/8\"",stbdEngine:"Volvo D6 / 370 HP",stbdTransmission:"Volvo IPS",portEngine:"Volvo D6 / 370 HP",portTransmission:"Volvo IPS",propeller:"22x20 (x2)",generator:"Westerbeke 12kW",dinghy:"Caribe 270",dinghyOutboard:"Yamaha 8 HP"},
    tasks:[{id:1,systemId:"motores",system:"Motores",equipment:"Motor Babor",name:"Chequeo semanal",assigned:"José Rivas",interval:"Semanal",nextDue:"2025-06-02",status:"overdue",notes:"Revisar niveles."}],
    log:[{id:1,date:"2025-06-02",type:"Inspección",systemId:"motores",equipment:"Motor Principal",desc:"Sin novedades.",performedBy:"José Rivas",photos:[],fuelQty:null}],
    records:[],docs:7,alerts:1,
    weather:{temp:31,wind:8,condition:"Soleado",icon:"☀️"},
  },
  {
    id:3,name:"Brisa Caribe",type:"Catamarán 55'",marina:"Margarita",captain:"Andrés Torres",fuel:85,fuelUnit:"%",engineHours:562,genHours:89,status:"ok",
    crew:["Andrés Torres","Luis Mata"],customSystems:[],
    profile:{firstName:"Ricardo",lastName:"Ortega",phone:"305-799-7996",email:"ricardo@theboatingzone.com",marinaAddress:"Marina Margarita, Porlamar, Nueva Esparta, Venezuela"},
    subscription:{plan:"Pro",price:79,currency:"USD",cycle:"Mensual",nextBilling:"2025-07-05",status:"active"},
    providers:[],
    details:{manufacturer:"Leopard",model:"55 Catamaran",year:"2018",hullType:"Fibra de vidrio",homePort:"Margarita",uscg:"9876543",built:"Sudáfrica",displacement:"28,000 lbs",grt:"28",nrt:"18",loa:"57'",beam:"27'",draft:"3'9\"",clearanceWindInstrument:"60'",clearanceRadar:"—",clearanceVHF:"62'",clearanceBimini:"10'",clearanceWindshield:"8'",stbdFuelTank:"180 gal",portFuelTank:"180 gal",lowerFuelTank:"—",freshWater:"200 gal",wasteTank:"50 gal",anchor:"Rocna 33 lbs",anchorRode:"300' cadena 5/16\"",stbdEngine:"Yanmar 4JH57 / 57 HP",stbdTransmission:"Yanmar YM-62",portEngine:"Yanmar 4JH57 / 57 HP",portTransmission:"Yanmar YM-62",propeller:"17x12 (x2)",generator:"—",dinghy:"AB 9 AL",dinghyOutboard:"Yamaha 6 HP"},
    tasks:[{id:1,systemId:"velas",system:"Velas y Jarcia",equipment:"Génova",name:"Revisión de enganches",assigned:"Andrés Torres",interval:"Trimestral",nextDue:"2025-07-05",status:"ok",notes:"Todo en orden."}],
    log:[{id:1,date:"2025-06-05",type:"Inspección",systemId:"cubierta",equipment:"Cockpit",desc:"Todo en orden.",performedBy:"Andrés Torres",photos:[],fuelQty:null}],
    records:[],docs:18,alerts:0,
    weather:{temp:27,wind:18,condition:"Viento fresco",icon:"🌬️"},
  },
];

function getAllSystems(vessel) {
  return [...DEFAULT_SYSTEMS, ...(vessel.customSystems || [])];
}
function getEquipmentList(vessel, systemId) {
  const all = getAllSystems(vessel);
  const sys = all.find(s => s.id === systemId);
  if (!sys) return [];
  // merge default + any custom overrides
  const custom = (vessel.customSystems || []).find(s => s.id === systemId);
  const base = custom ? custom.equipment : sys.equipment;
  return [...base, "Otro"];
}
export default function App() {
  const [vessels, setVessels]   = useState(INIT_VESSELS);
  const [vesselId, setVesselId] = useState(1);
  const [page, setPage]         = useState("home");
  const [showVesselMenu, setShowVesselMenu]       = useState(false);
  const [showUserMenu, setShowUserMenu]           = useState(false);
  const [showVesselDetails, setShowVesselDetails] = useState(false);
  const [showProviders, setShowProviders]         = useState(false);
  const [showProfile, setShowProfile]             = useState(false);

  const vessel = vessels.find(v => v.id === vesselId);
  const updateVessel = useCallback((updated) => {
    setVessels(vs => vs.map(v => v.id === updated.id ? updated : v));
  }, []);

  return (
    <div style={s.root} onClick={() => { setShowVesselMenu(false); setShowUserMenu(false); }}>
      <TopNav vessel={vessel} vessels={vessels}
        setVesselId={(id) => { setVesselId(id); setPage("home"); }}
        showVesselMenu={showVesselMenu} setShowVesselMenu={setShowVesselMenu}
        showUserMenu={showUserMenu} setShowUserMenu={setShowUserMenu}
        setShowVesselDetails={setShowVesselDetails}
        setShowProviders={setShowProviders} setShowProfile={setShowProfile}
        page={page} setPage={setPage} />
      <div style={s.body}>
        {page==="home"    && <HomePage    vessel={vessel} setPage={setPage} vessels={vessels} />}
        {page==="tasks"   && <TasksPage   vessel={vessel} updateVessel={updateVessel} />}
        {page==="log"     && <LogPage     vessel={vessel} updateVessel={updateVessel} />}
        {page==="records" && <RecordsPage vessel={vessel} />}
        {page==="docs"    && <DocsPage />}
      </div>
      {showVesselDetails && <VesselDetailsModal vessel={vessel} updateVessel={updateVessel} onClose={() => setShowVesselDetails(false)} />}
      {showProviders     && <ProvidersModal vessel={vessel} updateVessel={updateVessel} onClose={() => setShowProviders(false)} />}
      {showProfile       && <ProfileModal vessel={vessel} updateVessel={updateVessel} onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function TopNav({ vessel,vessels,setVesselId,showVesselMenu,setShowVesselMenu,showUserMenu,setShowUserMenu,setShowVesselDetails,setShowProviders,setShowProfile,page,setPage }) {
  const totalAlerts = vessels.reduce((a,v) => a+v.alerts, 0);
  return (
    <nav style={s.nav} onClick={e => e.stopPropagation()}>
      <div style={s.navLogo} onClick={() => setPage("home")}>
        <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="14" fill="#0ea5e9" opacity=".1"/>
          <path d="M15 4 L27 24 H3 Z" stroke="#0ea5e9" strokeWidth="2" fill="none" strokeLinejoin="round"/>
          <line x1="15" y1="4" x2="15" y2="24" stroke="#0ea5e9" strokeWidth="1.4"/>
          <path d="M5 24 Q15 19 25 24" stroke="#0ea5e9" strokeWidth="2" fill="none"/>
        </svg>
        <div style={s.navBrand}>NautiTrack<span style={{color:"#2563eb"}}>.VZ</span></div>
      </div>
      <div style={s.navLinks}>
        {[{key:"home",label:"🏠 Inicio"},{key:"tasks",label:"☑ Tareas"},{key:"log",label:"📓 Bitácora"},{key:"records",label:"🔧 Records"},{key:"docs",label:"📄 Documentos"}].map(n => (
          <button key={n.key} onClick={() => setPage(n.key)} style={{...s.navLink,color:page===n.key?"#0ea5e9":"#64748b",borderBottom:page===n.key?"2px solid #0ea5e9":"2px solid transparent",fontWeight:page===n.key?600:400}}>{n.label}</button>
        ))}
      </div>
      <div style={s.navRight}>
        <button style={s.provBtn} onClick={() => setShowProviders(true)}>👥 Proveedores</button>
        <div style={{position:"relative"}}>
          <button style={s.vesselSelector} onClick={() => { setShowVesselMenu(!showVesselMenu); setShowUserMenu(false); }}>
            <span style={{...s.dot,background:STATUS_CFG[vessel.status].dot}} />
            <span style={{fontWeight:600,color:"#0f172a",fontSize:12}}>{vessel.name}</span>
            <span style={{color:"#94a3b8",fontSize:10}}>▼</span>
          </button>
          {showVesselMenu && (
            <div style={s.drop}>
              {vessels.map(v => (
                <button key={v.id} onClick={() => { setVesselId(v.id); setShowVesselMenu(false); }} style={{...s.dropItem,background:v.id===vessel.id?"#eff6ff":"#fff"}}>
                  <span style={{...s.dot,background:STATUS_CFG[v.status].dot}} />
                  <div><div style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{v.name}</div><div style={{fontSize:11,color:"#94a3b8"}}>{v.type} · {v.marina}</div></div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={s.bellWrap}>
          <span style={{fontSize:18,cursor:"pointer"}}>🔔</span>
          {totalAlerts > 0 && <div style={s.bellBadge}>{totalAlerts}</div>}
        </div>
        <div style={{position:"relative"}}>
          <button style={s.userBtn} onClick={() => { setShowUserMenu(!showUserMenu); setShowVesselMenu(false); }}>
            <div style={s.navAvatar}>{vessel.profile?.firstName?.[0]||"R"}{vessel.profile?.lastName?.[0]||"O"}</div>
            <div><div style={s.navName}>{vessel.profile?.firstName||"Ricardo"} {vessel.profile?.lastName?.[0]||"O"}.</div><div style={s.navRole}>Propietario</div></div>
            <span style={{color:"#94a3b8",fontSize:10}}>▼</span>
          </button>
          {showUserMenu && (
            <div style={{...s.drop,minWidth:210}}>
              <div style={{padding:"10px 14px 4px",fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:"0.1em"}}>MI CUENTA</div>
              {[
                {icon:"👤",label:"Mi Perfil",       action:() => { setShowProfile(true); setShowUserMenu(false); }},
                {icon:"⚓",label:"Mi Embarcación",  action:() => { setShowVesselDetails(true); setShowUserMenu(false); }},
                {icon:"💳",label:"Suscripción",      action:() => { setShowProfile(true); setShowUserMenu(false); }},
                {icon:"🚪",label:"Cerrar Sesión",    action:() => setShowUserMenu(false)},
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{...s.dropItem,gap:10}}>
                  <span>{item.icon}</span><span style={{fontSize:13,color:"#1e293b"}}>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function HomePage({ vessel, setPage, vessels }) {
  const upcoming = [...vessel.tasks].filter(t => t.status!=="done").sort((a,b) => new Date(a.nextDue)-new Date(b.nextDue)).slice(0,5);
  return (
    <div style={s.home}>
      <div style={s.row}>
        <FleetCard vessels={vessels} vessel={vessel} />
        <AlertsCard vessel={vessel} setPage={setPage} />
        <IndicatorsCard vessel={vessel} />
      </div>
      <div style={s.row}>
        <CalendarCard tasks={upcoming} setPage={setPage} />
        <LogCard vessel={vessel} setPage={setPage} />
      </div>
      <WeatherBar vessel={vessel} />
    </div>
  );
}

function FleetCard({ vessels, vessel }) {
  return (
    <div style={{...s.card,flex:1.2}}>
      <div style={s.cardHdr}><span style={s.cardTitle}>🚢 Estado de la Flota</span><span style={s.cardSub}>{vessels.length} embarcaciones</span></div>
      {vessels.map(v => {
        const od=v.tasks.filter(t=>t.status==="overdue").length, du=v.tasks.filter(t=>t.status==="due").length;
        return (
          <div key={v.id} style={{...s.fleetRow,background:v.id===vessel.id?"#f0f9ff":"#f8fafc",borderColor:v.id===vessel.id?"#bae6fd":"#e2e8f0"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
              <div style={{...s.statusBall,background:STATUS_CFG[v.status].dot,boxShadow:`0 0 8px ${STATUS_CFG[v.status].dot}66`}} />
              <div><div style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{v.name}</div><div style={{fontSize:11,color:"#94a3b8"}}>{v.marina} · Cap. {v.captain.split(" ")[0]}</div></div>
            </div>
            <div style={{display:"flex",gap:5}}>
              {od>0&&<span style={{...s.miniTag,background:"#fee2e2",color:"#dc2626"}}>⚠ {od}v</span>}
              {du>0&&<span style={{...s.miniTag,background:"#fef3c7",color:"#d97706"}}>{du}p</span>}
              {od===0&&du===0&&<span style={{...s.miniTag,background:"#dcfce7",color:"#16a34a"}}>✓</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertsCard({ vessel, setPage }) {
  const od = vessel.tasks.filter(t => t.status==="overdue");
  return (
    <div style={{...s.card,flex:1}}>
      <div style={s.cardHdr}><span style={s.cardTitle}>🚨 Alertas</span><button onClick={() => setPage("tasks")} style={s.linkBtn}>Ver →</button></div>
      {od.length===0
        ? <div style={s.empty}><div style={{fontSize:28}}>✅</div><div style={{color:"#16a34a",fontWeight:600,fontSize:13}}>Sin alertas</div></div>
        : od.map(t => (
          <div key={t.id} style={s.alertRow}>
            <div style={s.alertDot} />
            <div><div style={{fontWeight:600,fontSize:12,color:"#0f172a"}}>{t.name}</div><div style={{fontSize:11,color:"#dc2626"}}>{t.equipment}</div></div>
          </div>
        ))
      }
    </div>
  );
}

function IndicatorsCard({ vessel }) {
  const fc = vessel.fuel>50?"#16a34a":vessel.fuel>25?"#d97706":"#dc2626";
  return (
    <div style={{...s.card,flex:1}}>
      <div style={s.cardHdr}><span style={s.cardTitle}>⚙️ Indicadores</span><span style={s.cardSub}>{vessel.name}</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {icon:"⛽",val:`${vessel.fuel} ${vessel.fuelUnit}`,lbl:"Combustible",color:fc,bar:true},
          {icon:"🔧",val:`${vessel.engineHours}h`,lbl:"Horas Motor",color:"#2563eb",bar:false},
          {icon:"⚡",val:`${vessel.genHours}h`,lbl:"Horas Generador",color:"#7c3aed",bar:false},
          {icon:"📅",val:"20 May",lbl:"Próx. Serv. Motor",color:"#dc2626",bar:false},
        ].map(ind => (
          <div key={ind.lbl} style={s.indBox}>
            <div style={{fontSize:20,marginBottom:4}}>{ind.icon}</div>
            <div style={{fontSize:17,fontWeight:700,color:ind.color}}>{ind.val}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{ind.lbl}</div>
            {ind.bar && <div style={s.indTrack}><div style={{...s.indFill,width:`${Math.min(vessel.fuel,100)}%`,background:ind.color}} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarCard({ tasks, setPage }) {
  return (
    <div style={{...s.card,flex:1.3}}>
      <div style={s.cardHdr}><span style={s.cardTitle}>📅 Próximos Servicios</span><button onClick={() => setPage("tasks")} style={s.linkBtn}>Ver todos →</button></div>
      {tasks.length===0 && <div style={s.empty}><div style={{color:"#94a3b8",fontSize:12}}>Sin tareas pendientes</div></div>}
      {tasks.map(t => {
        const nd=new Date(t.nextDue),today=new Date(),diff=Math.round((nd-today)/(1000*60*60*24));
        const od=diff<0,du=diff>=0&&diff<=14;
        const bc=od?"#dc2626":du?"#d97706":"#16a34a",bg=od?"#fff5f5":du?"#fffbeb":"#f0fdf4";
        return (
          <div key={t.id} style={{...s.calRow,background:bg,borderLeft:`3px solid ${bc}`}}>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{t.name}</div><div style={{fontSize:11,color:"#64748b"}}>{t.system} · {t.equipment}</div></div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,fontWeight:700,color:bc}}>{od?`Vencido ${Math.abs(diff)}d`:`En ${diff}d`}</div>
              <div style={{fontSize:10,color:"#94a3b8"}}>{t.nextDue}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogCard({ vessel, setPage }) {
  return (
    <div style={{...s.card,flex:1}}>
      <div style={s.cardHdr}><span style={s.cardTitle}>📓 Bitácora Reciente</span><button onClick={() => setPage("log")} style={s.linkBtn}>Ver todo →</button></div>
      {vessel.log.slice(0,4).map((e,i) => (
        <div key={i} style={s.logRow}>
          <span style={{...s.logBadge,background:LOG_COLOR[e.type]+"18",color:LOG_COLOR[e.type]}}>{e.type}</span>
          <span style={{fontSize:12,color:"#334155",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {e.type==="Salida"?`${e.dest} · ${e.persons}p`:e.type==="Compra"?e.item:(e.desc||"").slice(0,50)}
          </span>
          <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
            {(e.photos||[]).length>0&&<span style={{fontSize:11}}>📷</span>}
            <span style={{fontSize:10,color:"#94a3b8"}}>{e.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeatherBar({ vessel }) {
  const w = vessel.weather;
  return (
    <div style={{...s.card,display:"flex",alignItems:"center",gap:24,padding:"14px 24px",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <span style={{fontSize:36}}>{w.icon}</span>
        <div><div style={{fontSize:24,fontWeight:700,color:"#0f172a"}}>{w.temp}°C</div><div style={{fontSize:12,color:"#64748b"}}>{w.condition}</div><div style={{fontSize:11,color:"#94a3b8"}}>📍 {vessel.marina}</div></div>
      </div>
      <div style={{width:1,height:44,background:"#e2e8f0"}} />
      <div style={{display:"flex",gap:20,flex:1,flexWrap:"wrap"}}>
        {[["💨",`${w.wind} kn`,"Viento"],["🌊","0.4 m","Oleaje"],["💧","78%","Humedad"],["☀️","UV 7","Índice UV"]].map(([ic,val,lbl]) => (
          <div key={lbl} style={{textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600}}>{ic} {val}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function TasksPage({ vessel, updateVessel }) {
  const [filter, setFilter]     = useState("Todas");
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const FILTERS = ["Todas","Por vencer","Vencidas","Completadas"];
  const filtered = vessel.tasks.filter(t => {
    if (filter==="Vencidas")    return t.status==="overdue";
    if (filter==="Por vencer")  return t.status==="due";
    if (filter==="Completadas") return t.status==="done";
    return true;
  });
  const PILL = { overdue:{bg:"#ef4444",c:"#fff",l:"Vencido"}, due:{bg:"#f59e0b",c:"#fff",l:"Por vencer"}, ok:{bg:"#22c55e",c:"#fff",l:"Al día"}, done:{bg:"#64748b",c:"#fff",l:"Completado"} };
  const allSystems = getAllSystems(vessel);
  const addTask = (task) => { updateVessel({...vessel,tasks:[...vessel.tasks,{...task,id:Date.now()}]}); setShowAdd(false); };
  return (
    <div style={{padding:"24px 28px"}}>
      <div style={s.toolbar}>
        <h2 style={s.toolbarTitle}>Tareas — {vessel.name}</h2>
        <div style={{display:"flex",gap:6,flex:1,alignItems:"center",flexWrap:"wrap"}}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{...s.filterBtn,background:filter===f?"#1e3a5f":"transparent",color:filter===f?"#fff":"#64748b",borderColor:filter===f?"#4a9eff":"#e2e8f0"}}>
              {f}
              <span style={{marginLeft:4,fontSize:10,background:filter===f?"rgba(255,255,255,0.2)":"#e2e8f0",color:filter===f?"#fff":"#64748b",padding:"1px 6px",borderRadius:10}}>
                {f==="Todas"?vessel.tasks.length:f==="Vencidas"?vessel.tasks.filter(t=>t.status==="overdue").length:f==="Por vencer"?vessel.tasks.filter(t=>t.status==="due").length:vessel.tasks.filter(t=>t.status==="done").length}
              </span>
            </button>
          ))}
          <div style={{flex:1}} />
          <button style={s.btnPrimary} onClick={() => setShowAdd(true)}>＋ Agregar Tarea</button>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr style={{background:"#1e3a5f"}}>{["Sistema","Equipo","Tarea","Asignado","Intervalo","Próximo Venc.","Estado","Notas"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0 && <tr><td colSpan={8} style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Sin tareas en esta categoría</td></tr>}
            {filtered.map(task => {
              const p = PILL[task.status]||PILL.ok;
              const sys = allSystems.find(x => x.id===task.systemId);
              return (
                <>
                  <tr key={task.id} style={{...s.trow,background:expanded===task.id?"#f0f7ff":"#fff",cursor:"pointer"}} onClick={() => setExpanded(expanded===task.id?null:task.id)}>
                    <td style={s.td}><span style={{fontSize:14}}>{sys?.icon||"🔧"}</span> {task.system}</td>
                    <td style={s.td}>{task.equipment}</td>
                    <td style={{...s.td,fontWeight:500,color:"#1e293b"}}>{task.name}</td>
                    <td style={{...s.td,color:"#64748b"}}>{task.assigned?.split(" ")[0]}</td>
                    <td style={{...s.td,color:"#64748b"}}>{task.interval}</td>
                    <td style={{...s.td,color:task.status==="overdue"?"#dc2626":"#1e293b",fontWeight:task.status==="overdue"?600:400}}>{task.nextDue}</td>
                    <td style={s.td}><span style={{...s.statusPill,background:p.bg,color:p.c}}>{p.l}</span></td>
                    <td style={{...s.td,color:"#94a3b8",fontSize:12,maxWidth:180}}>{task.notes||"—"}</td>
                  </tr>
                  {expanded===task.id && (
                    <tr key={`e${task.id}`}>
                      <td colSpan={8} style={{padding:0,background:"#f0f7ff",borderBottom:"2px solid #bfdbfe"}}>
                        <div style={{padding:"16px 24px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                          {[{l:"Sistema",v:task.system},{l:"Equipo",v:task.equipment},{l:"Intervalo",v:task.interval},{l:"Próx. Venc.",v:task.nextDue},{l:"Asignado",v:task.assigned},{l:"Estado",v:p.l},{l:"Notas",v:task.notes||"—"},{l:"Fotos",v:(task.photos||[]).length>0?`${task.photos.length} foto(s)`:"Sin fotos"}].map((c,i) => (
                            <div key={i} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px"}}>
                              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:3}}>{c.l}</div>
                              <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{c.v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{padding:"0 24px 16px",display:"flex",gap:8}}>
                          {["Completar","Reprogramar","Editar","Eliminar"].map(a => (
                            <button key={a} style={{padding:"6px 14px",border:"1.5px solid",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",background:a==="Completar"?"#1d4ed8":"#fff",color:a==="Completar"?"#fff":a==="Eliminar"?"#dc2626":"#1e293b",borderColor:a==="Completar"?"#1d4ed8":a==="Eliminar"?"#fecaca":"#e2e8f0"}}>{a}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {showAdd && <AddTaskModal vessel={vessel} updateVessel={updateVessel} onSave={addTask} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddTaskModal({ vessel, updateVessel, onSave, onClose }) {
  const allSystems = getAllSystems(vessel);
  const [systemId, setSystemId]       = useState("");
  const [equipment, setEquipment]     = useState("");
  const [otherEquip, setOtherEquip]   = useState("");
  const [name, setName]               = useState("");
  const [assigned, setAssigned]       = useState(vessel.captain);
  const [interval, setInterval]       = useState("");
  const [nextDue, setNextDue]         = useState("");
  const [notes, setNotes]             = useState("");
  const [errors, setErrors]           = useState({});
  const [showAddSys, setShowAddSys]   = useState(false);
  const [newSysLabel, setNewSysLabel] = useState("");
  const [newSysIcon, setNewSysIcon]   = useState("🔧");
  const [newSysEquip, setNewSysEquip] = useState("");
  const [newSysHours, setNewSysHours] = useState(false);

  const selectedSystem = allSystems.find(s => s.id===systemId);
  const equipList      = systemId ? getEquipmentList(vessel, systemId) : [];
  const providerNames  = vessel.providers.map(p => `${p.firstName} ${p.lastName}`);
  const allAssigned    = [vessel.captain, ...providerNames];

  const addCustomSystem = () => {
    if (!newSysLabel.trim()||!newSysEquip.trim()) return;
    const newSys = { id:`custom_${Date.now()}`, label:newSysLabel.trim(), icon:newSysIcon, trackHours:newSysHours, equipment:newSysEquip.split(",").map(e=>e.trim()).filter(Boolean) };
    updateVessel({...vessel,customSystems:[...(vessel.customSystems||[]),newSys]});
    setSystemId(newSys.id);
    setShowAddSys(false); setNewSysLabel(""); setNewSysIcon("🔧"); setNewSysEquip(""); setNewSysHours(false);
  };

  const saveCustomEquip = (sysId, equipName) => {
    const isDefault = DEFAULT_SYSTEMS.find(s => s.id===sysId);
    if (isDefault) {
      const existing = (vessel.customSystems||[]).find(s => s.id===sysId);
      if (existing) {
        updateVessel({...vessel,customSystems:vessel.customSystems.map(s=>s.id===sysId?{...s,equipment:[...s.equipment,equipName]}:s)});
      } else {
        const base = DEFAULT_SYSTEMS.find(s => s.id===sysId);
        updateVessel({...vessel,customSystems:[...(vessel.customSystems||[]),{...base,equipment:[...base.equipment,equipName]}]});
      }
    } else {
      updateVessel({...vessel,customSystems:(vessel.customSystems||[]).map(s=>s.id===sysId?{...s,equipment:[...s.equipment,equipName]}:s)});
    }
  };

  const validate = () => {
    const e = {};
    if (!systemId) e.system="Requerido";
    if (!equipment) e.equipment="Requerido";
    if (equipment==="Otro"&&!otherEquip.trim()) e.otherEquip="Especifica el equipo";
    if (!name.trim()) e.name="Requerido";
    if (!interval) e.interval="Requerido";
    if (!nextDue) e.nextDue="Requerido";
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const finalEquip = equipment==="Otro"?otherEquip:equipment;
    if (equipment==="Otro"&&otherEquip.trim()) saveCustomEquip(systemId, otherEquip.trim());
    const today=new Date(),nd=new Date(nextDue),diff=Math.round((nd-today)/(1000*60*60*24));
    let status="ok"; if(diff<0)status="overdue"; else if(diff<=14)status="due";
    onSave({systemId,system:selectedSystem?.label||systemId,equipment:finalEquip,name,assigned,interval,nextDue,status,notes,photos:[]});
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:580}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>☑ Nueva Tarea</div>
          <button onClick={onClose} style={s.modalClose}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <label style={s.label}>Sistema <span style={{color:"#dc2626"}}>*</span></label>
              <button onClick={() => setShowAddSys(!showAddSys)} style={{fontSize:11,color:"#2563eb",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>＋ Agregar sistema</button>
            </div>
            {showAddSys && (
              <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:14,marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:12,color:"#0369a1",marginBottom:10}}>Nuevo Sistema</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div><label style={s.label}>Nombre *</label><input value={newSysLabel} onChange={e=>setNewSysLabel(e.target.value)} placeholder="Ej: Sistema de Limpiaparabrisas" style={s.input}/></div>
                  <div><label style={s.label}>Ícono</label><input value={newSysIcon} onChange={e=>setNewSysIcon(e.target.value)} style={{...s.input,width:60}}/></div>
                </div>
                <div style={{marginBottom:10}}><label style={s.label}>Equipos * <span style={{color:"#94a3b8",fontWeight:400}}>(separados por coma)</span></label><input value={newSysEquip} onChange={e=>setNewSysEquip(e.target.value)} placeholder="Motor 1, Motor 2, Panel de control" style={s.input}/></div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <input type="checkbox" checked={newSysHours} onChange={e=>setNewSysHours(e.target.checked)} id="trackHrs"/>
                  <label htmlFor="trackHrs" style={{fontSize:12,color:"#374151"}}>Registrar horas de uso</label>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button style={s.btnOutline} onClick={() => setShowAddSys(false)}>Cancelar</button>
                  <button style={s.btnPrimary} onClick={addCustomSystem}>Guardar Sistema</button>
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {allSystems.map(sys => (
                <button key={sys.id} onClick={() => { setSystemId(sys.id); setEquipment(""); }} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",border:"1.5px solid",borderRadius:8,cursor:"pointer",background:systemId===sys.id?"#eff6ff":"#f8fafc",borderColor:systemId===sys.id?"#2563eb":"#e2e8f0"}}>
                  <span style={{fontSize:16}}>{sys.icon}</span>
                  <span style={{fontSize:11,fontWeight:systemId===sys.id?700:400,color:systemId===sys.id?"#2563eb":"#1e293b",lineHeight:1.3}}>{sys.label}</span>
                  {sys.id.startsWith("custom_")&&<span style={{fontSize:9,color:"#94a3b8",marginLeft:"auto"}}>✎</span>}
                </button>
              ))}
            </div>
            {errors.system&&<div style={s.errMsg}>{errors.system}</div>}
          </div>

          {selectedSystem && (
            <div>
              <label style={s.label}>Equipo <span style={{color:"#dc2626"}}>*</span></label>
              <select value={equipment} onChange={e=>setEquipment(e.target.value)} style={{...s.input,borderColor:errors.equipment?"#dc2626":"#e2e8f0"}}>
                <option value="">Seleccionar equipo...</option>
                {equipList.map(eq=><option key={eq} value={eq}>{eq}</option>)}
              </select>
              {errors.equipment&&<div style={s.errMsg}>{errors.equipment}</div>}
            </div>
          )}

          {equipment==="Otro" && (
            <div>
              <label style={s.label}>Especificar equipo <span style={{color:"#dc2626"}}>*</span></label>
              <input value={otherEquip} onChange={e=>setOtherEquip(e.target.value)} placeholder="Describe el equipo..." style={{...s.input,borderColor:errors.otherEquip?"#dc2626":"#e2e8f0"}}/>
              <div style={{fontSize:11,color:"#64748b",marginTop:3}}>Se guardará para futuras tareas</div>
              {errors.otherEquip&&<div style={s.errMsg}>{errors.otherEquip}</div>}
            </div>
          )}

          <div>
            <label style={s.label}>Nombre de la Tarea <span style={{color:"#dc2626"}}>*</span></label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Cambio de aceite y filtro" style={{...s.input,borderColor:errors.name?"#dc2626":"#e2e8f0"}}/>
            {errors.name&&<div style={s.errMsg}>{errors.name}</div>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={s.label}>Asignado a</label>
              <select value={assigned} onChange={e=>setAssigned(e.target.value)} style={s.input}>
                {allAssigned.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Intervalo <span style={{color:"#dc2626"}}>*</span></label>
              <select value={interval} onChange={e=>setInterval(e.target.value)} style={{...s.input,borderColor:errors.interval?"#dc2626":"#e2e8f0"}}>
                <option value="">Seleccionar...</option>
                {INTERVALS.map(i=><option key={i} value={i}>{i}</option>)}
              </select>
              {errors.interval&&<div style={s.errMsg}>{errors.interval}</div>}
            </div>
          </div>

          <div>
            <label style={s.label}>Próximo Vencimiento <span style={{color:"#dc2626"}}>*</span></label>
            <input type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)} style={{...s.input,borderColor:errors.nextDue?"#dc2626":"#e2e8f0"}}/>
            {errors.nextDue&&<div style={s.errMsg}>{errors.nextDue}</div>}
          </div>

          <div>
            <label style={s.label}>Notas</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observaciones, materiales, instrucciones..." rows={3} style={{...s.input,resize:"vertical"}}/>
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={s.btnOutline} onClick={onClose}>Cancelar</button>
          <button style={s.btnPrimary} onClick={handleSave}>Guardar Tarea</button>
        </div>
      </div>
    </div>
  );
}
function LogPage({ vessel, updateVessel }) {
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filter, setFilter]       = useState("Todos");
  const filtered = filter==="Todos" ? vessel.log : vessel.log.filter(e=>e.type===filter);

  const saveEntry = useCallback((entry) => {
    let updated = {...vessel};
    if (editEntry) {
      updated.log = vessel.log.map(e=>e.id===entry.id?entry:e);
    } else {
      const newEntry = {...entry,id:Date.now()};
      updated.log = [newEntry,...vessel.log];
      if (entry.type==="Combustible"&&entry.fuelQty!=null) {
        updated.fuel = entry.fuelQty;
        updated.fuelUnit = entry.fuelUnit||vessel.fuelUnit;
      }
    }
    updateVessel(updated);
    setShowModal(false); setEditEntry(null);
  }, [vessel, editEntry, updateVessel]);

  return (
    <div style={{padding:"24px 28px"}}>
      <div style={s.toolbar}>
        <h2 style={s.toolbarTitle}>Bitácora — {vessel.name}</h2>
        <div style={{display:"flex",gap:6,flex:1,alignItems:"center",flexWrap:"wrap"}}>
          {["Todos",...LOG_TYPES].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{...s.filterBtn,background:filter===f?"#1e3a5f":"transparent",color:filter===f?"#fff":"#64748b",borderColor:filter===f?"#4a9eff":"#e2e8f0",fontSize:11}}>{f}</button>
          ))}
          <div style={{flex:1}}/>
          <button style={s.btnPrimary} onClick={()=>{setEditEntry(null);setShowModal(true);}}>＋ Nueva Entrada</button>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr style={{background:"#1e3a5f"}}>{["Fecha","Tipo","Descripción / Detalle","Fotos","Realizado por",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={6} style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Sin entradas</td></tr>}
            {filtered.map((e,i)=>(
              <tr key={i} style={s.trow}>
                <td style={{...s.td,color:"#64748b",whiteSpace:"nowrap"}}>{e.date}</td>
                <td style={s.td}><span style={{background:LOG_COLOR[e.type]+"18",color:LOG_COLOR[e.type],padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{e.type}{e.serviceType?` · ${e.serviceType}`:""}</span></td>
                <td style={{...s.td,color:"#334155",maxWidth:360}}>
                  {e.type==="Salida"?`${e.dest||""} · ${e.persons||""}p · ${e.deptTime||"—"} → ${e.arrTime||"Pendiente"}`:e.type==="Compra"?`${e.item||""} · $${e.costUSD||0}`:e.desc||""}
                </td>
                <td style={s.td}>{(e.photos||[]).length>0?`📷 ${e.photos.length}`:"—"}</td>
                <td style={{...s.td,color:"#64748b"}}>{e.performedBy||"—"}</td>
                <td style={s.td}><button onClick={()=>{setEditEntry(e);setShowModal(true);}} style={{...s.btnOutline,padding:"3px 10px",fontSize:11}}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal&&<LogEntryModal vessel={vessel} initial={editEntry} onSave={saveEntry} onClose={()=>{setShowModal(false);setEditEntry(null);}}/>}
    </div>
  );
}

// KEY FIX: LogEntryModal — all state at top, no nested component definitions
function LogEntryModal({ vessel, initial, onSave, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [type,setType]               = useState(initial?.type||"");
  const [date,setDate]               = useState(initial?.date||today);
  const [desc,setDesc]               = useState(initial?.desc||"");
  const [performedBy,setPerformedBy] = useState(initial?.performedBy||"");
  const [photos,setPhotos]           = useState(initial?.photos?.length||0);
  const [errors,setErrors]           = useState({});
  const [showInfo,setShowInfo]       = useState(false);
  const [serviceType,setServiceType] = useState(initial?.serviceType||"");
  const [systemId,setSystemId]       = useState(initial?.systemId||"");
  const [equipment,setEquipment]     = useState(initial?.equipment||"");
  const [otherEquip,setOtherEquip]   = useState("");
  const [equipHours,setEquipHours]   = useState(initial?.equipHours||"");
  const [fuelUnit,setFuelUnit]       = useState(initial?.fuelUnit||vessel.fuelUnit||"gal");
  const [fuelQty,setFuelQty]         = useState(initial?.fuelQty||"");
  const [ownerAboard,setOwnerAboard] = useState(initial?.ownerAboard||false);
  const [crewSel,setCrewSel]         = useState(initial?.crewSel||[]);
  const [persons,setPersons]         = useState(initial?.persons||"");
  const [dest,setDest]               = useState(initial?.dest||"");
  const [deptTime,setDeptTime]       = useState(initial?.deptTime||"");
  const [arrTime,setArrTime]         = useState(initial?.arrTime||"");
  const [fuelOut,setFuelOut]         = useState(initial?.fuelOut||"");
  const [fuelIn,setFuelIn]           = useState(initial?.fuelIn||"");
  const [engOut,setEngOut]           = useState(initial?.engineHrsOut||"");
  const [engIn,setEngIn]             = useState(initial?.engineHrsIn||"");
  const [genOut,setGenOut]           = useState(initial?.genHrsOut||"");
  const [genIn,setGenIn]             = useState(initial?.genHrsIn||"");
  const [clima,setClima]             = useState(initial?.salidaClima||"");
  const [item,setItem]               = useState(initial?.item||"");
  const [costUSD,setCostUSD]         = useState(initial?.costUSD||"");
  const [costBs,setCostBs]           = useState(initial?.costBs||"");
  const [payment,setPayment]         = useState(initial?.payment||"");

  const allSystems    = getAllSystems(vessel);
  const selectedSys   = allSystems.find(s=>s.id===systemId);
  const equipList     = systemId ? getEquipmentList(vessel, systemId) : [];
  const needsHours    = selectedSys?.trackHours && equipment && equipment!=="Otro";
  const provNames     = vessel.providers.map(p=>`${p.firstName} ${p.lastName} (${p.company})`);
  const allPerformed  = [vessel.captain,...provNames];

  const validate = () => {
    const e={};
    if (!type) e.type="Selecciona un tipo";
    if (!date) e.date="Requerido";
    if (type==="Servicio"&&!serviceType) e.serviceType="Requerido";
    if (type==="Servicio"&&!systemId)    e.system="Requerido";
    if (type==="Servicio"&&!equipment)   e.equipment="Requerido";
    if (type==="Combustible"&&!fuelQty)  e.fuelQty="Requerido";
    if (["Inspección","Servicio","Combustible"].includes(type)&&!desc.trim()) e.desc="Descripción requerida";
    if (["Inspección","Servicio"].includes(type)&&photos<1) e.photos="Mínimo 1 foto";
    if (type==="Compra"&&!item.trim()) e.item="Requerido";
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const finalEquip = equipment==="Otro"?otherEquip:equipment;
    const base = {id:initial?.id||Date.now(),date,type,desc,performedBy,photos:Array.from({length:photos},(_,i)=>`foto${i+1}`)};
    let entry = {...base};
    if (type==="Servicio")    entry={...entry,serviceType,systemId,equipment:finalEquip,equipHours:needsHours?equipHours:null};
    if (type==="Combustible") entry={...entry,fuelQty:parseFloat(fuelQty),fuelUnit};
    if (type==="Salida")      entry={...entry,ownerAboard,crewSel,persons,dest,deptTime,arrTime,fuelOut,fuelIn,engineHrsOut:engOut,engineHrsIn:engIn,genHrsOut:genOut,genHrsIn:genIn,salidaClima:clima};
    if (type==="Compra")      entry={...entry,item,costUSD:parseFloat(costUSD)||0,costBs:parseFloat(costBs)||0,payment};
    onSave(entry);
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:580}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>📓 {initial?"Editar":"Nueva"} Entrada</div>
          <button onClick={onClose} style={s.modalClose}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>

          <div>
            <label style={s.label}>Tipo <span style={{color:"#dc2626"}}>*</span></label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
              {LOG_TYPES.map(t=><button key={t} onClick={()=>setType(t)} style={{...s.typeChip,background:type===t?LOG_COLOR[t]+"22":"#f8fafc",borderColor:type===t?LOG_COLOR[t]:"#e2e8f0",color:type===t?LOG_COLOR[t]:"#64748b",fontWeight:type===t?700:400}}>{t}</button>)}
            </div>
            {errors.type&&<div style={s.errMsg}>{errors.type}</div>}
          </div>

          <div>
            <label style={s.label}>Fecha <span style={{color:"#dc2626"}}>*</span></label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={s.input}/>
            {errors.date&&<div style={s.errMsg}>{errors.date}</div>}
          </div>

          {type==="Inspección"&&(<>
            <div>
              <label style={s.label}>Sistema</label>
              <select value={systemId} onChange={e=>{setSystemId(e.target.value);setEquipment("");}} style={s.input}>
                <option value="">Seleccionar sistema...</option>
                {allSystems.map(sys=><option key={sys.id} value={sys.id}>{sys.icon} {sys.label}</option>)}
              </select>
            </div>
            {systemId&&<div><label style={s.label}>Equipo</label><select value={equipment} onChange={e=>setEquipment(e.target.value)} style={s.input}><option value="">Seleccionar...</option>{equipList.map(eq=><option key={eq} value={eq}>{eq}</option>)}</select></div>}
            {equipment==="Otro"&&<div><label style={s.label}>Especificar equipo</label><input value={otherEquip} onChange={e=>setOtherEquip(e.target.value)} placeholder="Nombre del equipo..." style={s.input}/></div>}
            <div>
              <label style={s.label}>Descripción <span style={{color:"#dc2626"}}>*</span></label>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} style={{...s.input,resize:"vertical",borderColor:errors.desc?"#dc2626":"#e2e8f0"}}/>
              {errors.desc&&<div style={s.errMsg}>{errors.desc}</div>}
            </div>
            <div>
              <label style={s.label}>Realizado por</label>
              <select value={performedBy} onChange={e=>setPerformedBy(e.target.value)} style={s.input}>
                <option value="">Seleccionar...</option>
                {allPerformed.map(p=><option key={p} value={p}>{p}</option>)}
                <option value="Otro">Otro</option>
              </select>
            </div>
            <PhotoFld count={photos} setCount={setPhotos} err={errors.photos}/>
          </>)}

          {type==="Servicio"&&(<>
            <div>
              <label style={s.label}>
                Tipo de Servicio <span style={{color:"#dc2626"}}>*</span>{" "}
                <span style={{position:"relative",display:"inline-block"}}>
                  <span style={{cursor:"pointer",color:"#94a3b8",fontSize:12}} onClick={()=>setShowInfo(!showInfo)}>ⓘ</span>
                  {showInfo&&<div style={{position:"absolute",left:0,top:"100%",zIndex:10,background:"#1e293b",color:"#fff",fontSize:11,borderRadius:8,padding:"10px 12px",width:220,lineHeight:1.6,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}><b>Preventivo:</b> Mantenimiento planificado.<br/><b>Reactivo:</b> Respuesta a falla inesperada.<br/><b>Reparación:</b> Arreglo de algo dañado.</div>}
                </span>
              </label>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                {SERVICE_TYPES.map(t=><button key={t} onClick={()=>setServiceType(t)} style={{...s.typeChip,background:serviceType===t?"#2563eb22":"#f8fafc",borderColor:serviceType===t?"#2563eb":"#e2e8f0",color:serviceType===t?"#2563eb":"#64748b",fontWeight:serviceType===t?700:400}}>{t}</button>)}
              </div>
              {errors.serviceType&&<div style={s.errMsg}>{errors.serviceType}</div>}
            </div>
            <div>
              <label style={s.label}>Sistema <span style={{color:"#dc2626"}}>*</span></label>
              <select value={systemId} onChange={e=>{setSystemId(e.target.value);setEquipment("");}} style={{...s.input,borderColor:errors.system?"#dc2626":"#e2e8f0"}}>
                <option value="">Seleccionar sistema...</option>
                {allSystems.map(sys=><option key={sys.id} value={sys.id}>{sys.icon} {sys.label}</option>)}
              </select>
              {errors.system&&<div style={s.errMsg}>{errors.system}</div>}
            </div>
            {systemId&&<div>
              <label style={s.label}>Equipo <span style={{color:"#dc2626"}}>*</span></label>
              <select value={equipment} onChange={e=>setEquipment(e.target.value)} style={{...s.input,borderColor:errors.equipment?"#dc2626":"#e2e8f0"}}>
                <option value="">Seleccionar...</option>
                {equipList.map(eq=><option key={eq} value={eq}>{eq}</option>)}
              </select>
              {errors.equipment&&<div style={s.errMsg}>{errors.equipment}</div>}
            </div>}
            {equipment==="Otro"&&<div><label style={s.label}>Especificar equipo</label><input value={otherEquip} onChange={e=>setOtherEquip(e.target.value)} placeholder="Nombre del equipo..." style={s.input}/><div style={{fontSize:11,color:"#64748b",marginTop:3}}>Se guardará para futuras entradas</div></div>}
            {needsHours&&<div><label style={s.label}>Horas actuales de {equipment}</label><input type="number" value={equipHours} onChange={e=>setEquipHours(e.target.value)} placeholder="Ej: 1245" style={s.input}/></div>}
            <div>
              <label style={s.label}>Descripción <span style={{color:"#dc2626"}}>*</span></label>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} style={{...s.input,resize:"vertical",borderColor:errors.desc?"#dc2626":"#e2e8f0"}}/>
              {errors.desc&&<div style={s.errMsg}>{errors.desc}</div>}
            </div>
            <div>
              <label style={s.label}>Realizado por</label>
              <select value={performedBy} onChange={e=>setPerformedBy(e.target.value)} style={s.input}>
                <option value="">Seleccionar...</option>
                {allPerformed.map(p=><option key={p} value={p}>{p}</option>)}
                <option value="Otro">Otro</option>
              </select>
            </div>
            <PhotoFld count={photos} setCount={setPhotos} err={errors.photos}/>
          </>)}

          {type==="Combustible"&&(<>
            <div>
              <label style={s.label}>Nivel actual de combustible <span style={{color:"#dc2626"}}>*</span></label>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:"0 0 100px"}}><label style={{...s.label,marginBottom:4}}>Unidad</label><select value={fuelUnit} onChange={e=>setFuelUnit(e.target.value)} style={s.input}>{["gal","lts","%"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                <div style={{flex:1}}><label style={{...s.label,marginBottom:4}}>Cantidad</label><input type="number" value={fuelQty} onChange={e=>setFuelQty(e.target.value)} placeholder="Ej: 280" style={{...s.input,borderColor:errors.fuelQty?"#dc2626":"#e2e8f0"}}/>{errors.fuelQty&&<div style={s.errMsg}>{errors.fuelQty}</div>}</div>
              </div>
            </div>
            <div><label style={s.label}>Comentarios</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Proveedor, tipo de combustible..." rows={2} style={{...s.input,resize:"vertical"}}/></div>
            <div><label style={s.label}>Realizado por</label><select value={performedBy} onChange={e=>setPerformedBy(e.target.value)} style={s.input}><option value="">Seleccionar...</option>{allPerformed.map(p=><option key={p} value={p}>{p}</option>)}<option value="Otro">Otro</option></select></div>
          </>)}

          {type==="Salida"&&(<>
            <div style={{background:"#f0f9ff",borderRadius:10,padding:"14px 16px",border:"1px solid #bae6fd"}}>
              <div style={{fontWeight:700,fontSize:12,color:"#0369a1",marginBottom:12}}>🚢 SALIDA</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={s.label}>Destino</label><input value={dest} onChange={e=>setDest(e.target.value)} style={s.input}/></div>
                  <div><label style={s.label}>Clima</label><input value={clima} onChange={e=>setClima(e.target.value)} placeholder="Ej: Soleado, 12kn" style={s.input}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={s.label}>Hora de Salida</label><input type="time" value={deptTime} onChange={e=>setDeptTime(e.target.value)} style={s.input}/></div>
                  <div><label style={s.label}>N° Personas</label><input type="number" value={persons} onChange={e=>setPersons(e.target.value)} style={s.input}/></div>
                </div>
                <div><label style={s.label}>Dueño a bordo</label><div style={{display:"flex",gap:8,marginTop:4}}>{[true,false].map(v=><button key={String(v)} onClick={()=>setOwnerAboard(v)} style={{...s.typeChip,background:ownerAboard===v?"#2563eb22":"#f8fafc",borderColor:ownerAboard===v?"#2563eb":"#e2e8f0",color:ownerAboard===v?"#2563eb":"#64748b",fontWeight:ownerAboard===v?700:400}}>{v?"Sí":"No"}</button>)}</div></div>
                <div><label style={s.label}>Tripulación</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>{vessel.crew.map(c=><button key={c} onClick={()=>setCrewSel(cs=>cs.includes(c)?cs.filter(x=>x!==c):[...cs,c])} style={{...s.typeChip,background:crewSel.includes(c)?"#2563eb22":"#f8fafc",borderColor:crewSel.includes(c)?"#2563eb":"#e2e8f0",color:crewSel.includes(c)?"#2563eb":"#64748b",fontWeight:crewSel.includes(c)?700:400}}>{c}</button>)}</div></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={s.label}>Combustible al salir ({vessel.fuelUnit})</label><input type="number" value={fuelOut} onChange={e=>setFuelOut(e.target.value)} style={s.input}/></div>
                  <div><label style={s.label}>Horas Motor al salir</label><input type="number" value={engOut} onChange={e=>setEngOut(e.target.value)} style={s.input}/></div>
                </div>
                <div><label style={s.label}>Horas Generador al salir</label><input type="number" value={genOut} onChange={e=>setGenOut(e.target.value)} style={s.input}/></div>
              </div>
            </div>
            <div style={{background:"#f0fdf4",borderRadius:10,padding:"14px 16px",border:"1px solid #bbf7d0"}}>
              <div style={{fontWeight:700,fontSize:12,color:"#15803d",marginBottom:12}}>⚓ REGRESO <span style={{fontSize:10,fontWeight:400,color:"#64748b"}}>(puede completarse después)</span></div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={s.label}>Hora de Llegada</label><input type="time" value={arrTime} onChange={e=>setArrTime(e.target.value)} style={s.input}/></div>
                  <div><label style={s.label}>Combustible al regresar ({vessel.fuelUnit})</label><input type="number" value={fuelIn} onChange={e=>setFuelIn(e.target.value)} style={s.input}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={s.label}>Horas Motor al regresar</label><input type="number" value={engIn} onChange={e=>setEngIn(e.target.value)} style={s.input}/></div>
                  <div><label style={s.label}>Horas Generador al regresar</label><input type="number" value={genIn} onChange={e=>setGenIn(e.target.value)} style={s.input}/></div>
                </div>
              </div>
            </div>
            <div><label style={s.label}>Observaciones</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{...s.input,resize:"vertical"}}/></div>
            <PhotoFld count={photos} setCount={setPhotos}/>
          </>)}

          {type==="Compra"&&(<>
            <div><label style={s.label}>Artículo <span style={{color:"#dc2626"}}>*</span></label><input value={item} onChange={e=>setItem(e.target.value)} placeholder="Ej: Filtro aceite Fleetguard FF5052" style={{...s.input,borderColor:errors.item?"#dc2626":"#e2e8f0"}}/>{errors.item&&<div style={s.errMsg}>{errors.item}</div>}</div>
            <div><label style={s.label}>Descripción</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{...s.input,resize:"vertical"}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={s.label}>Costo USD</label><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#64748b"}}>$</span><input type="number" value={costUSD} onChange={e=>setCostUSD(e.target.value)} placeholder="0.00" style={s.input}/></div></div>
              <div><label style={s.label}>Costo Bs</label><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#64748b"}}>Bs</span><input type="number" value={costBs} onChange={e=>setCostBs(e.target.value)} placeholder="0.00" style={s.input}/></div></div>
            </div>
            <div><label style={s.label}>Método de Pago</label><select value={payment} onChange={e=>setPayment(e.target.value)} style={s.input}><option value="">Seleccionar...</option>{PAYMENT_METHODS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
            <PhotoFld count={photos} setCount={setPhotos} label="Foto del recibo"/>
          </>)}

        </div>
        <div style={s.modalFooter}>
          <button style={s.btnOutline} onClick={onClose}>Cancelar</button>
          <button style={s.btnPrimary} onClick={handleSave}>{initial?"Guardar Cambios":"Guardar Entrada"}</button>
        </div>
      </div>
    </div>
  );
}

function PhotoFld({ count, setCount, err, label="Fotos" }) {
  return (
    <div>
      <label style={s.label}>{label} <span style={{color:"#dc2626"}}>*</span> <span style={{color:"#94a3b8",fontWeight:400}}>(mínimo 1)</span></label>
      <div style={{...s.photoUpload,borderColor:err?"#dc2626":"#bae6fd"}}>
        <div style={{fontSize:24,marginBottom:6}}>📷</div>
        <div style={{fontSize:12,color:"#0369a1",fontWeight:600,marginBottom:8}}>Número de fotos a adjuntar</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
          {[1,2,3,4,5,6].map(n=><button key={n} onClick={()=>setCount(n)} style={{padding:"4px 11px",border:"1.5px solid",borderRadius:6,fontSize:12,cursor:"pointer",background:count>=n?"#0ea5e9":"#f8fafc",color:count>=n?"#fff":"#64748b",borderColor:count>=n?"#0ea5e9":"#e2e8f0"}}>{n}</button>)}
        </div>
      </div>
      {err&&<div style={s.errMsg}>{err}</div>}
    </div>
  );
}
function RecordsPage({ vessel }) {
  const [mainFilter,setMainFilter] = useState("Servicio");
  const [subFilter,setSubFilter]   = useState("Todos");
  const [showReport,setShowReport] = useState(false);
  const serviceLog  = vessel.log.filter(e=>e.type==="Servicio");
  const inspLog     = vessel.log.filter(e=>e.type==="Inspección");
  const fuelLog     = vessel.log.filter(e=>e.type==="Combustible");
  const purchaseLog = vessel.log.filter(e=>e.type==="Compra");
  const totalCost   = vessel.records.reduce((a,r)=>a+r.cost,0);
  const totalPurch  = purchaseLog.reduce((a,e)=>a+(e.costUSD||0),0);
  const filteredSvc = subFilter==="Todos"?serviceLog:serviceLog.filter(e=>e.serviceType===subFilter);
  return (
    <div style={{padding:"24px 28px"}}>
      <div style={s.toolbar}>
        <h2 style={s.toolbarTitle}>Records — {vessel.name}</h2>
        <button style={{...s.btnPrimary,background:"#7c3aed"}} onClick={()=>setShowReport(true)}>📊 Generar Reporte</button>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[{label:"Servicios",val:serviceLog.length,color:"#2563eb",key:"Servicio"},{label:"Inspecciones",val:inspLog.length,color:"#16a34a",key:"Inspecciones"},{label:"Combustible",val:fuelLog.length,color:"#d97706",key:"Combustible"},{label:"Compras",val:purchaseLog.length,color:"#0891b2",sub:`$${totalPurch.toFixed(2)}`,key:"Compras"},{label:"Histórico",val:vessel.records.length,color:"#7c3aed",sub:`$${totalCost.toLocaleString("en-US",{minimumFractionDigits:2})}`,key:"Historico"}].map(item=>(
          <div key={item.label} onClick={()=>{setMainFilter(item.key);setSubFilter("Todos");}} style={{padding:"12px 16px",background:mainFilter===item.key?"#eff6ff":"#fff",border:`1.5px solid ${mainFilter===item.key?"#2563eb":"#e2e8f0"}`,borderRadius:10,flex:1,minWidth:110,textAlign:"center",cursor:"pointer"}}>
            <div style={{fontSize:20,fontWeight:700,color:item.color}}>{item.val}</div>
            <div style={{fontSize:12,fontWeight:600,color:"#1e293b",marginTop:2}}>{item.label}</div>
            {item.sub&&<div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{item.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"1px solid #e2e8f0"}}>
        {["Servicio","Inspecciones","Combustible","Compras","Historico"].map(f=>(
          <button key={f} onClick={()=>{setMainFilter(f);setSubFilter("Todos");}} style={{padding:"10px 18px",background:"none",border:"none",borderBottom:mainFilter===f?"2px solid #0ea5e9":"2px solid transparent",cursor:"pointer",fontSize:13,color:mainFilter===f?"#0ea5e9":"#64748b",fontWeight:mainFilter===f?600:400}}>{f}</button>
        ))}
      </div>
      {mainFilter==="Servicio"&&(<>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {["Todos","Preventivo","Reactivo","Reparación"].map(f=><button key={f} onClick={()=>setSubFilter(f)} style={{...s.filterBtn,background:subFilter===f?"#1e3a5f":"transparent",color:subFilter===f?"#fff":"#64748b",borderColor:subFilter===f?"#4a9eff":"#e2e8f0",fontSize:11}}>{f}</button>)}
        </div>
        <RecordTable rows={filteredSvc.map(e=>({Fecha:e.date,Tipo:e.serviceType||"—",Equipo:e.equipment||"—",Descripción:e.desc,"Realizado por":e.performedBy,Fotos:(e.photos||[]).length>0?`📷 ${e.photos.length}`:"—"}))}/>
      </>)}
      {mainFilter==="Inspecciones"&&<RecordTable rows={inspLog.map(e=>({Fecha:e.date,Equipo:e.equipment||"—",Descripción:e.desc,"Realizado por":e.performedBy,Fotos:(e.photos||[]).length>0?`📷 ${e.photos.length}`:"—"}))}/>}
      {mainFilter==="Combustible"&&<RecordTable rows={fuelLog.map(e=>({Fecha:e.date,Cantidad:`${e.fuelQty} ${e.fuelUnit}`,Notas:e.desc||"—","Registrado por":e.performedBy}))}/>}
      {mainFilter==="Compras"&&(<>
        <div style={{marginBottom:12,padding:"10px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,fontSize:13}}>Total: <strong style={{color:"#16a34a"}}>${totalPurch.toFixed(2)} USD</strong></div>
        <RecordTable rows={purchaseLog.map(e=>({Fecha:e.date,Artículo:e.item,Descripción:e.desc||"—",USD:`$${e.costUSD||0}`,Bs:e.costBs?`Bs ${e.costBs}`:"—",Pago:e.payment||"—",Fotos:(e.photos||[]).length>0?`📷 ${e.photos.length}`:"—"}))}/>
      </>)}
      {mainFilter==="Historico"&&(<>
        <div style={{marginBottom:12,padding:"10px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,fontSize:13}}>Costo total histórico: <strong style={{color:"#16a34a"}}>${totalCost.toLocaleString("en-US",{minimumFractionDigits:2})}</strong></div>
        <RecordTable rows={vessel.records.map(r=>({Fecha:r.date,Tipo:r.type,Equipo:r.equipment,Horas:r.hours,Descripción:r.desc,"Realizado por":r.performedBy,Costo:`$${r.cost.toLocaleString("en-US",{minimumFractionDigits:2})}`}))}/>
      </>)}
      {showReport&&<ReportModal vessel={vessel} onClose={()=>setShowReport(false)}/>}
    </div>
  );
}

function RecordTable({ rows }) {
  if (rows.length===0) return <div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Sin registros</div>;
  const cols = Object.keys(rows[0]);
  return (
    <div style={{overflowX:"auto"}}>
      <table style={s.table}>
        <thead><tr style={{background:"#1e3a5f"}}>{cols.map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} style={s.trow}>
              {cols.map((k,j)=><td key={j} style={{...s.td,whiteSpace:k==="Fecha"?"nowrap":"normal",color:k==="Costo"||k==="USD"?"#16a34a":"#475569",fontWeight:k==="Costo"||k==="USD"?600:400,maxWidth:k==="Descripción"?280:"none"}}>{row[k]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportModal({ vessel, onClose }) {
  const [sel,setSel]   = useState([]);
  const [from,setFrom] = useState("");
  const [to,setTo]     = useState("");
  const [gen,setGen]   = useState(false);
  const types=[{key:"costs",icon:"💰",label:"Reporte de Costos",desc:"Compras y mantenimiento"},{key:"salidas",icon:"🚢",label:"Reporte de Salidas",desc:"Todas las salidas"},{key:"fuel",icon:"⛽",label:"Reporte de Combustible",desc:"Historial repostajes"},{key:"service",icon:"🔧",label:"Reporte de Servicios",desc:"Preventivo, reactivo, reparaciones"},{key:"inspect",icon:"🔍",label:"Reporte de Inspecciones",desc:"Todas las inspecciones"},{key:"log",icon:"📓",label:"Bitácora Completa",desc:"Todas las entradas"},{key:"tasks",icon:"☑",label:"Estado de Tareas",desc:"Completadas, pendientes, vencidas"},{key:"sale",icon:"⚓",label:"Reporte para Venta",desc:"Historial completo para compradores"},{key:"insurance",icon:"🛡",label:"Reporte para Seguro",desc:"Mantenimientos y estado"}];
  const toggle=k=>setSel(s=>s.includes(k)?s.filter(x=>x!==k):[...s,k]);
  const totalCost=vessel.records.reduce((a,r)=>a+r.cost,0);
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div><div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>📊 Generar Reporte</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>{vessel.name}</div></div>
          <button onClick={onClose} style={s.modalClose}>✕</button>
        </div>
        {!gen?(
          <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {types.map(r=>(
                <button key={r.key} onClick={()=>toggle(r.key)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",border:"1.5px solid",borderRadius:8,cursor:"pointer",textAlign:"left",background:sel.includes(r.key)?"#eff6ff":"#f8fafc",borderColor:sel.includes(r.key)?"#2563eb":"#e2e8f0"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{r.icon}</span>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:sel.includes(r.key)?"#2563eb":"#1e293b"}}>{r.label}</div><div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{r.desc}</div></div>
                  {sel.includes(r.key)&&<span style={{color:"#2563eb",flexShrink:0}}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={s.label}>Desde</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={s.input}/></div>
              <div><label style={s.label}>Hasta</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={s.input}/></div>
            </div>
          </div>
        ):(
          <div style={{padding:"24px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>📄</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Reporte Listo</div>
            <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:16,textAlign:"left",marginBottom:16}}>
              {[["Embarcación",vessel.name],["Records",vessel.records.length],["Bitácora",vessel.log.length],["Costo total",`$${totalCost.toLocaleString("en-US",{minimumFractionDigits:2})}`]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:"#64748b"}}>{k}</span><span style={{fontWeight:600}}>{v}</span></div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button style={{...s.btnPrimary,background:"#16a34a"}}>⬇ Descargar PDF</button>
              <button style={s.btnPrimary}>📧 Enviar</button>
            </div>
          </div>
        )}
        <div style={s.modalFooter}>
          <button style={s.btnOutline} onClick={onClose}>Cancelar</button>
          {!gen?<button style={{...s.btnPrimary,opacity:sel.length===0?0.5:1}} onClick={()=>sel.length>0&&setGen(true)}>Generar ({sel.length})</button>:<button style={s.btnOutline} onClick={()=>setGen(false)}>← Volver</button>}
        </div>
      </div>
    </div>
  );
}

function DocsPage() {
  return (
    <div style={{padding:"40px 28px",maxWidth:700,margin:"0 auto"}}>
      <h2 style={{fontSize:20,fontWeight:700,color:"#0f172a",marginBottom:8}}>📄 Documentos</h2>
      <p style={{color:"#64748b",fontSize:14,marginBottom:24}}>Almacenamiento seguro de documentos de la embarcación.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {[{icon:"☁️",title:"Google Drive",desc:"Integración directa. Tus archivos siguen en Google — sin costo adicional.",tag:"Recomendado",tagColor:"#16a34a"},{icon:"📁",title:"Almacenamiento interno",desc:"Sube archivos directamente a NautiTrack. Implica costo de servidor.",tag:"En desarrollo",tagColor:"#d97706"}].map(opt=>(
          <div key={opt.title} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:20}}>
            <div style={{fontSize:32,marginBottom:10}}>{opt.icon}</div>
            <div style={{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:6}}>{opt.title}</div>
            <div style={{fontSize:12,color:"#64748b",lineHeight:1.6,marginBottom:12}}>{opt.desc}</div>
            <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:opt.tagColor+"18",color:opt.tagColor}}>{opt.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileModal({ vessel, updateVessel, onClose }) {
  const [tab,setTab]   = useState("profile");
  const [form,setForm] = useState({...vessel.profile});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=()=>{updateVessel({...vessel,profile:form});onClose();};
  const sub=vessel.subscription||{};
  const planFeatures={Basic:["1 embarcación","Bitácora básica","Tareas ilimitadas","Soporte email"],Pro:["Hasta 3 embarcaciones","Bitácora con fotos","Records y reportes","Proveedores","Soporte prioritario"],Fleet:["Embarcaciones ilimitadas","Todo lo de Pro","API access","Reportes automáticos","Gerente de cuenta"]};
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}><div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>👤 Mi Cuenta</div><button onClick={onClose} style={s.modalClose}>✕</button></div>
        <div style={{display:"flex",borderBottom:"1px solid #e2e8f0",padding:"0 24px"}}>
          {[{key:"profile",label:"Mi Perfil"},{key:"subscription",label:"Suscripción"}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{padding:"10px 16px",background:"none",border:"none",borderBottom:tab===t.key?"2px solid #0ea5e9":"2px solid transparent",cursor:"pointer",fontSize:13,color:tab===t.key?"#0ea5e9":"#64748b",fontWeight:tab===t.key?600:400}}>{t.label}</button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {tab==="profile"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:16,padding:16,background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",color:"#fff",fontSize:22,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{(form.firstName?.[0]||"R")}{(form.lastName?.[0]||"O")}</div>
                <div><div style={{fontWeight:700,fontSize:15,color:"#0f172a"}}>{form.firstName} {form.lastName}</div><div style={{fontSize:12,color:"#64748b"}}>{form.email}</div><button style={{...s.btnOutline,padding:"3px 10px",fontSize:11,marginTop:6}}>Cambiar foto</button></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={s.label}>Nombre</label><input value={form.firstName||""} onChange={e=>set("firstName",e.target.value)} style={s.input}/></div>
                <div><label style={s.label}>Apellido</label><input value={form.lastName||""} onChange={e=>set("lastName",e.target.value)} style={s.input}/></div>
              </div>
              <div><label style={s.label}>Teléfono</label><input value={form.phone||""} onChange={e=>set("phone",e.target.value)} style={s.input}/></div>
              <div><label style={s.label}>Email</label><input type="email" value={form.email||""} onChange={e=>set("email",e.target.value)} style={s.input}/></div>
              <div><label style={s.label}>Ubicación de la Marina</label><input value={form.marinaAddress||""} onChange={e=>set("marinaAddress",e.target.value)} style={s.input}/></div>
            </div>
          )}
          {tab==="subscription"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",borderRadius:12,padding:20,color:"#fff"}}>
                <div style={{fontSize:11,opacity:.8,letterSpacing:"0.1em",marginBottom:4}}>PLAN ACTUAL</div>
                <div style={{fontSize:24,fontWeight:800,marginBottom:4}}>{sub.plan||"Pro"}</div>
                <div style={{fontSize:20,fontWeight:700}}>${sub.price||79}<span style={{fontSize:13,opacity:.8}}>/{sub.cycle==="Mensual"?"mes":"año"}</span></div>
                <div style={{fontSize:12,opacity:.8,marginTop:8}}>Próximo cobro: {sub.nextBilling||"—"}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {Object.entries(planFeatures).map(([plan,features])=>(
                  <div key={plan} style={{border:`1.5px solid ${sub.plan===plan?"#0ea5e9":"#e2e8f0"}`,borderRadius:10,padding:"14px 12px",background:sub.plan===plan?"#f0f9ff":"#fff"}}>
                    <div style={{fontWeight:700,fontSize:14,color:sub.plan===plan?"#0369a1":"#0f172a",marginBottom:4}}>{plan}</div>
                    <div style={{fontSize:16,fontWeight:700,marginBottom:10}}>{plan==="Basic"?"$29":plan==="Pro"?"$79":"$149"}<span style={{fontSize:11,color:"#94a3b8"}}>/mes</span></div>
                    {features.map(f=><div key={f} style={{fontSize:11,color:"#64748b",marginBottom:4}}>✓ {f}</div>)}
                    {sub.plan!==plan&&<button style={{...s.btnPrimary,width:"100%",marginTop:10,fontSize:11,padding:"6px"}}>Cambiar</button>}
                    {sub.plan===plan&&<div style={{fontSize:11,color:"#0369a1",fontWeight:600,marginTop:10,textAlign:"center"}}>✓ Plan actual</div>}
                  </div>
                ))}
              </div>
              <div style={{padding:"12px 14px",background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#92400e"}}>
                💡 <strong>Pagos en Venezuela:</strong> Aceptamos Zelle, transferencia USD, pago móvil y efectivo.
              </div>
            </div>
          )}
        </div>
        <div style={s.modalFooter}><button style={s.btnOutline} onClick={onClose}>Cancelar</button>{tab==="profile"&&<button style={s.btnPrimary} onClick={save}>Guardar Cambios</button>}</div>
      </div>
    </div>
  );
}

function VesselDetailsModal({ vessel, updateVessel, onClose }) {
  const d=vessel.details;
  const [crew,setCrew]       = useState(vessel.crew||[]);
  const [newCrew,setNewCrew] = useState("");
  const addCrew=()=>{if(newCrew.trim()){const u=[...crew,newCrew.trim()];setCrew(u);updateVessel({...vessel,crew:u});setNewCrew("");}};
  const rmCrew=(i)=>{const u=crew.filter((_,idx)=>idx!==i);setCrew(u);updateVessel({...vessel,crew:u});};
  const sections=[
    {title:"Información General",fields:[["Fabricante",d.manufacturer],["Modelo",d.model],["Año",d.year],["Tipo de Casco",d.hullType],["Puerto Base",d.homePort],["USCG #",d.uscg],["Construido en",d.built]]},
    {title:"Dimensiones",fields:[["Desplazamiento",d.displacement],["TRB",d.grt],["TRN",d.nrt],["Eslora Total",d.loa],["Manga",d.beam],["Calado",d.draft]]},
    {title:"Espacios Libres",fields:[["Instrumento de Viento",d.clearanceWindInstrument],["Domo de Radar",d.clearanceRadar],["Antena VHF",d.clearanceVHF],["Bimini",d.clearanceBimini],["Parabrisas",d.clearanceWindshield]]},
    {title:"Tanques",fields:[["Combustible Estribor",d.stbdFuelTank],["Combustible Babor",d.portFuelTank],["Combustible Inferior",d.lowerFuelTank],["Agua Potable",d.freshWater],["Aguas Negras",d.wasteTank]]},
    {title:"Fondeo",fields:[["Ancla",d.anchor],["Cadena/Fondeo",d.anchorRode]]},
    {title:"Propulsión",fields:[["Motor Estribor",d.stbdEngine],["Transmisión Estribor",d.stbdTransmission],["Motor Babor",d.portEngine],["Transmisión Babor",d.portTransmission],["Hélices",d.propeller],["Generador",d.generator]]},
    {title:"Dinghy / Tender",fields:[["Dinghy",d.dinghy],["Motor Dinghy",d.dinghyOutboard]]},
  ];
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}><div><div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>⚓ {vessel.name}</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>Detalles de la Embarcación</div></div><button onClick={onClose} style={s.modalClose}>✕</button></div>
        <div style={s.modalBody}>
          {sections.map(sec=>(
            <div key={sec.title} style={{marginBottom:18}}>
              <div style={s.secTitle}>{sec.title}</div>
              {sec.fields.map(([k,v])=><div key={k} style={s.detailRow}><span style={s.detailKey}>{k}</span><span style={s.detailVal}>{v||"—"}</span></div>)}
            </div>
          ))}
          <div style={{marginBottom:18}}>
            <div style={s.secTitle}>Tripulación</div>
            {crew.map((c,i)=>(
              <div key={i} style={{...s.detailRow,alignItems:"center"}}>
                <span style={s.detailVal}>👤 {c}</span>
                <button onClick={()=>rmCrew(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12}}>✕</button>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input value={newCrew} onChange={e=>setNewCrew(e.target.value)} placeholder="Nombre del tripulante..." style={{...s.input,flex:1}}/>
              <button style={s.btnPrimary} onClick={addCrew}>Agregar</button>
            </div>
          </div>
        </div>
        <div style={s.modalFooter}><button style={s.btnOutline} onClick={onClose}>Cerrar</button><button style={s.btnPrimary}>✏️ Editar</button></div>
      </div>
    </div>
  );
}

function ProvidersModal({ vessel, updateVessel, onClose }) {
  const [providers,setProviders] = useState(vessel.providers||[]);
  const [showAdd,setShowAdd]     = useState(false);
  const [form,setForm]           = useState({firstName:"",lastName:"",company:"",phone:"",email:"",segment:"",notes:"",referredBy:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addProvider=()=>{
    if(!form.firstName||!form.company) return;
    const u=[...providers,{...form,id:Date.now()}];
    setProviders(u);updateVessel({...vessel,providers:u});
    setForm({firstName:"",lastName:"",company:"",phone:"",email:"",segment:"",notes:"",referredBy:""});setShowAdd(false);
  };
  const remove=(id)=>{const u=providers.filter(p=>p.id!==id);setProviders(u);updateVessel({...vessel,providers:u});};
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:720}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div><div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>👥 Proveedores</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>Directorio de proveedores y técnicos</div></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}><button style={s.btnPrimary} onClick={()=>setShowAdd(!showAdd)}>＋ Agregar</button><button onClick={onClose} style={s.modalClose}>✕</button></div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
          {showAdd&&(
            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:16,marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:13,color:"#0369a1",marginBottom:12}}>Nuevo Proveedor</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["firstName","Nombre *"],["lastName","Apellido"],["company","Empresa *"],["phone","Teléfono"],["email","Email"],["referredBy","Referido por"]].map(([k,lbl])=>(
                  <div key={k}><label style={s.label}>{lbl}</label><input value={form[k]} onChange={e=>set(k,e.target.value)} style={s.input}/></div>
                ))}
                <div><label style={s.label}>Especialidad</label><select value={form.segment} onChange={e=>set("segment",e.target.value)} style={s.input}><option value="">Seleccionar...</option>{SEGMENTS.map(sg=><option key={sg} value={sg}>{sg}</option>)}</select></div>
                <div style={{gridColumn:"span 2"}}><label style={s.label}>Notas</label><input value={form.notes} onChange={e=>set("notes",e.target.value)} style={s.input}/></div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}><button style={s.btnOutline} onClick={()=>setShowAdd(false)}>Cancelar</button><button style={s.btnPrimary} onClick={addProvider}>Guardar</button></div>
            </div>
          )}
          <table style={s.table}>
            <thead><tr style={{background:"#1e3a5f"}}>{["Nombre","Empresa","Teléfono","Email","Especialidad","Referido por","Notas",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {providers.length===0&&<tr><td colSpan={8} style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Sin proveedores</td></tr>}
              {providers.map(p=>(
                <tr key={p.id} style={s.trow}>
                  <td style={{...s.td,fontWeight:600,color:"#0f172a"}}>{p.firstName} {p.lastName}</td>
                  <td style={s.td}>{p.company}</td>
                  <td style={{...s.td,color:"#2563eb"}}>{p.phone}</td>
                  <td style={{...s.td,fontSize:11}}>{p.email||"—"}</td>
                  <td style={s.td}><span style={{background:"#e0f2fe",color:"#0369a1",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600}}>{p.segment||"—"}</span></td>
                  <td style={{...s.td,color:"#64748b"}}>{p.referredBy||"—"}</td>
                  <td style={{...s.td,color:"#94a3b8",fontSize:11}}>{p.notes||"—"}</td>
                  <td style={s.td}><button onClick={()=>remove(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626"}}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={s.modalFooter}><button style={s.btnOutline} onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}
const s = {
  root:       { minHeight:"100vh", background:"#f0f7ff", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#1e293b", fontSize:13 },
  nav:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", height:56, background:"#fff", borderBottom:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", position:"sticky", top:0, zIndex:20, gap:12 },
  navLogo:    { display:"flex", alignItems:"center", gap:10, cursor:"pointer", flexShrink:0 },
  navBrand:   { fontSize:17, fontWeight:800, color:"#0f172a", letterSpacing:"-0.4px" },
  navLinks:   { display:"flex", gap:0, flex:1, justifyContent:"center" },
  navLink:    { padding:"18px 11px", background:"none", border:"none", cursor:"pointer", fontSize:12, transition:"all 0.15s", whiteSpace:"nowrap" },
  navRight:   { display:"flex", alignItems:"center", gap:10, flexShrink:0 },
  provBtn:    { padding:"5px 11px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#f8fafc", cursor:"pointer", fontSize:12, fontWeight:500, color:"#1e293b", whiteSpace:"nowrap" },
  vesselSelector: { display:"flex", alignItems:"center", gap:7, padding:"5px 10px", border:"1.5px solid #e2e8f0", borderRadius:8, background:"#f8fafc", cursor:"pointer", fontSize:12 },
  dot:        { width:8, height:8, borderRadius:"50%", flexShrink:0 },
  drop:       { position:"absolute", top:"calc(100% + 6px)", right:0, background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, zIndex:30, minWidth:220, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", overflow:"hidden" },
  dropItem:   { display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 14px", border:"none", borderBottom:"1px solid #f1f5f9", cursor:"pointer", textAlign:"left", background:"#fff" },
  userBtn:    { display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:8 },
  bellWrap:   { position:"relative" },
  bellBadge:  { position:"absolute", top:-4, right:-4, background:"#ef4444", color:"#fff", fontSize:9, fontWeight:700, width:16, height:16, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" },
  navAvatar:  { width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)", color:"#fff", fontWeight:700, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center" },
  navName:    { fontSize:12, fontWeight:600, color:"#0f172a" },
  navRole:    { fontSize:10, color:"#94a3b8" },
  body:       { padding:"20px 24px", maxWidth:1440, margin:"0 auto" },
  home:       { display:"flex", flexDirection:"column", gap:16 },
  row:        { display:"flex", gap:16, alignItems:"stretch" },
  card:       { background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 4px rgba(0,0,0,0.05)", flex:1 },
  cardHdr:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 },
  cardTitle:  { fontSize:13, fontWeight:700, color:"#0f172a" },
  cardSub:    { fontSize:11, color:"#94a3b8" },
  linkBtn:    { background:"none", border:"none", color:"#2563eb", fontSize:11, cursor:"pointer", fontWeight:600 },
  fleetRow:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", borderRadius:8, border:"1.5px solid", marginBottom:8 },
  statusBall: { width:10, height:10, borderRadius:"50%", flexShrink:0 },
  miniTag:    { fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:20 },
  alertRow:   { display:"flex", alignItems:"flex-start", gap:10, padding:"8px 10px", background:"#fff5f5", borderRadius:8, border:"1px solid #fecaca", marginBottom:8 },
  alertDot:   { width:6, height:6, borderRadius:"50%", background:"#dc2626", marginTop:4, flexShrink:0 },
  indBox:     { textAlign:"center", padding:"12px 8px", background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0" },
  indTrack:   { width:"100%", height:4, background:"#e2e8f0", borderRadius:4, marginTop:6, overflow:"hidden" },
  indFill:    { height:"100%", borderRadius:4 },
  calRow:     { display:"flex", alignItems:"center", gap:12, padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", marginBottom:6 },
  logRow:     { display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"1px solid #f1f5f9" },
  logBadge:   { fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20, whiteSpace:"nowrap", flexShrink:0 },
  empty:      { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 0", gap:8 },
  toolbar:    { display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" },
  toolbarTitle: { fontSize:16, fontWeight:700, color:"#0f172a", margin:0, marginRight:8 },
  filterBtn:  { display:"flex", alignItems:"center", gap:5, padding:"6px 12px", border:"1.5px solid", borderRadius:6, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.15s" },
  btnPrimary: { padding:"7px 14px", background:"#1d4ed8", border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" },
  btnOutline: { padding:"7px 14px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#fff", color:"#475569", fontSize:12, fontWeight:500, cursor:"pointer" },
  table:      { width:"100%", borderCollapse:"collapse", background:"#fff", borderRadius:10, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" },
  th:         { padding:"10px 14px", textAlign:"left", color:"#93c5fd", fontSize:11, fontWeight:600, letterSpacing:"0.04em", whiteSpace:"nowrap" },
  trow:       { borderBottom:"1px solid #f1f5f9", transition:"background 0.1s" },
  td:         { padding:"11px 14px", color:"#475569", fontSize:13, verticalAlign:"middle" },
  statusPill: { display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 },
  modalOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" },
  modalBox:   { background:"#fff", borderRadius:16, width:"100%", maxWidth:560, maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
  modalHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 24px", borderBottom:"1px solid #e2e8f0", flexShrink:0 },
  modalClose: { background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#94a3b8", width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" },
  modalBody:  { flex:1, overflowY:"auto", padding:"20px 24px" },
  modalFooter: { display:"flex", justifyContent:"flex-end", gap:8, padding:"14px 24px", borderTop:"1px solid #e2e8f0", flexShrink:0 },
  secTitle:   { fontSize:10, fontWeight:700, letterSpacing:"0.12em", color:"#0ea5e9", textTransform:"uppercase", marginBottom:8, paddingBottom:6, borderBottom:"1px solid #e2e8f0" },
  detailRow:  { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #f8fafc" },
  detailKey:  { fontSize:12, color:"#94a3b8" },
  detailVal:  { fontSize:12, fontWeight:600, color:"#1e293b", textAlign:"right" },
  label:      { display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 },
  input:      { width:"100%", padding:"8px 11px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13, color:"#1e293b", background:"#fff", boxSizing:"border-box", outline:"none" },
  errMsg:     { fontSize:11, color:"#dc2626", marginTop:3 },
  typeChip:   { padding:"5px 13px", border:"1.5px solid", borderRadius:20, fontSize:12, cursor:"pointer", transition:"all 0.15s" },
  photoUpload: { border:"2px dashed #bae6fd", borderRadius:10, padding:14, textAlign:"center", background:"#f0f9ff" },
};