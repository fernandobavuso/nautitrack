import { useState, useCallback, useEffect, useRef } from "react";
import React from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import AddVessel from "./AddVessel";
import Onboarding, { OnboardingChecklist } from "./Onboarding";
import { IconBell, IconFuel, IconEngine, IconBolt, IconCalendar, IconAlert, IconChart, IconBoat, IconBook } from "./icons.jsx";
import QRPanel from "./QRPanel";
import CheckinPage from "./CheckinPage";
import CrewProfile from "./CrewProfile";
import CaptainView from "./CaptainView";
import CrewMarketplace from "./CrewMarketplace";
import NotifPanel from "./NotifPanel";
import CostsPage from "./CostsPage";
import InventoryPage from "./InventoryPage";
import FleetPage from "./FleetPage";
import PlansModal from "./PlansModal";
import StoreView from "./StoreView";
import AdminPanel, { isAdmin } from "./AdminPanel";
import { countUnread } from "./notifications";
import { getPlan, isExpiringSoon, daysLeft } from "./plans.jsx";
import { useResponsive } from "./useResponsive";



// ── WhatsApp Config ───────────────────────────────────────────────────────────
const WA_PHONE_ID = "110569092263550 7".replace(/\s/g,"");
const WA_TOKEN    = "EAAT9nusek5sBRhjr6ndwYzICuQhZCMf4XTGEWUDXmZCjYEz6GZCRyvqYZCIqgFjZBLBzgUPKs7oZAh6X73NZCqPtsLW9upNtGY0YIIbn4esNrarrQzrFsZCZAX7WLsMHx1s2vuhiufMEZA0M9AAJESoW3hkJfikziQ2UMUeMZAJz1TcbZBlpcYkNZB9OEjONyjFvjaA4Mz5hdNZA2804qT9nyDFVSAkuDL81o9OXdlW2XcWTgxbNjyFZBi8055nfNt0c5puepkrhi2hXrOFEdRrNwEc0vy9X6AHhpRxDqQI2u0ZD";

async function sendWhatsApp(to, message) {
  try {
    const resp = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message, token: WA_TOKEN, phoneNumberId: WA_PHONE_ID }),
    });
    const data = await resp.json();
    return data.success ? { ok: true } : { ok: false, error: data.error };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// Iniciales: primera letra del nombre + primera del apellido (ej. "Fernando Bavuso" -> "FB")
function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "?";
  const clean = String(nameOrEmail).trim();
  if (clean.includes("@")) return clean[0].toUpperCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── DATE FORMAT — DD/MM/AAAA (Venezuela) ─────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  if (d.includes("/")) return d; // already formatted
  const [y,m,day] = d.split("-");
  if (!y||!m||!day) return d;
  return `${day}/${m}/${y}`;
}
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

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
const LOG_TYPES       = ["Combustible","Compra","Inspección","Salida","Servicio"];
const SERVICE_TYPES   = ["Preventivo","Reactivo","Reparación"];
const PAYMENT_METHODS = ["Efectivo Bs","Efectivo USD","Pago Móvil","Tarjeta","Transferencia","Zelle"];
const INTERVALS       = ["Una vez","Diario","Semanal","Quincenal","Mensual","Trimestral","Semestral","Anual","Por horas","Por millas"];
const SEGMENTS        = ["A/C y Refrigeración","Broker","Buceo","Eléctrico","Electrónica","Gestión","Grúa / Transporte","Hidráulicos","Mecánica","Pintura","Surveyor","Teak / Fibra","Otro"];

// Helper: get motor/generator labels from vessel propulsion config
function getMotorLabels(vessel) { return vessel.motors || ["Motor Estribor","Motor Babor"]; }
function getGenLabels(vessel)   { return vessel.generators || ["Generador Principal"]; }
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
    motors:["Motor Estribor","Motor Babor"],
    generators:["Generador Principal"],
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
    crew:["José Rivas"],motors:["Motor Estribor","Motor Babor"],generators:["Generador Principal"],customSystems:[],
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
    crew:["Andrés Torres","Luis Mata"],motors:["Motor Estribor","Motor Babor"],generators:[],customSystems:[],
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
  const { isMobile } = useResponsive();
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [vessels, setVessels]         = useState([]);
  const [vesselsLoading, setVesselsLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [vesselId, setVesselId]       = useState(null);
  const [page, setPage]               = useState("home");
  const [showVesselMenu, setShowVesselMenu]       = useState(false);
  const [showUserMenu, setShowUserMenu]           = useState(false);
  const [showVesselDetails, setShowVesselDetails] = useState(false);
  const [showProviders, setShowProviders]         = useState(false);
  const [showProfile, setShowProfile]             = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [addingVessel, setAddingVessel] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("nt_welcomed"));
  const [hideChecklist, setHideChecklist] = useState(() => !!localStorage.getItem("nt_hide_checklist"));
  const [planMsg, setPlanMsg] = useState("");
  const [showQRPanel, setShowQRPanel]             = useState(false);
  const [showCaptainManager, setShowCaptainManager] = useState(false);
  const [showCrewMarket, setShowCrewMarket] = useState(false);
  const [captainProfile, setCaptainProfile]       = useState(null);
  const [captainVessel, setCaptainVessel]         = useState(null);
  const [crewProfile, setCrewProfile]             = useState(null);
  const [storeProfile, setStoreProfile]           = useState(null);

  // ── Supabase helpers ──────────────────────────────────────────────────────
  const fetchTasks = async (vesselId) => {
    const { data } = await supabase.from("tasks").select("*").eq("vessel_id", vesselId).order("created_at");
    return (data || []).map(t => ({
      id: t.id, systemId: t.system_id, system: t.system_name,
      equipment: t.equipment, name: t.name, assigned: t.assigned,
      interval: t.interval, nextDue: t.next_due, status: t.status,
      notes: t.notes, photos: t.photos || [],
      dueHours: t.due_hours, everyHours: t.every_hours,
      createdByName: t.created_by_name, createdByRole: t.created_by_role,
    }));
  };

  const fetchLog = async (vesselId) => {
    const { data } = await supabase.from("log_entries").select("*").eq("vessel_id", vesselId).order("date", { ascending: false });
    return (data || []).map(e => ({
      id: e.id, date: e.date, type: e.type, serviceType: e.service_type,
      systemId: e.system_id, equipment: e.equipment, desc: e.description,
      performedBy: e.performed_by, fuelQty: e.fuel_qty, fuelUnit: e.fuel_unit,
      equipHours: e.equip_hours, photos: e.photos || [],
      brand: e.brand, model2: e.model2, partNum: e.part_num,
      costUSD: e.cost_usd, costBs: e.cost_bs, payment: e.payment,
      item: e.item, dest: e.dest, persons: e.persons,
      ownerAboard: e.owner_aboard, crewSel: e.crew_sel || [],
      deptTime: e.dept_time, arrTime: e.arr_time,
      fuelOut: e.fuel_out, fuelIn: e.fuel_in,
      engineHrsOut: e.eng_out, engineHrsIn: e.eng_in,
      genHrsOut: e.gen_out, genHrsIn: e.gen_in, salidaClima: e.clima,
    }));
  };

  const addTask = useCallback(async (vesselId, ownerId, task) => {
    const { data } = await supabase.from("tasks").insert({
      vessel_id: vesselId, owner_id: ownerId,
      system_id: task.systemId, system_name: task.system,
      equipment: task.equipment, name: task.name,
      assigned: task.assigned, interval: task.interval,
      next_due: task.nextDue, status: task.status,
      notes: task.notes, photos: task.photos || [],
      due_hours: task.dueHours ?? null, every_hours: task.everyHours ?? null,
      created_by: ownerId, created_by_name: user?.full_name || user?.email || "Dueño", created_by_role: "owner",
    }).select().single();
    if (data) {
      const mapped = { ...task, id: data.id };
      setVessels(vs => vs.map(v => v.id === vesselId ? { ...v, tasks: [...(v.tasks||[]), mapped] } : v));
    }
  }, []);

  const addLogEntry = useCallback(async (vesselId, ownerId, entry) => {
    const { data } = await supabase.from("log_entries").insert({
      vessel_id: vesselId, owner_id: ownerId,
      date: entry.date, type: entry.type,
      service_type: entry.serviceType, system_id: entry.systemId,
      equipment: entry.equipment, description: entry.desc,
      performed_by: entry.performedBy, fuel_qty: entry.fuelQty,
      fuel_unit: entry.fuelUnit, equip_hours: entry.equipHours,
      photos: entry.photos || [],
      brand: entry.brand, model2: entry.model2, part_num: entry.partNum,
      cost_usd: entry.costUSD, cost_bs: entry.costBs, payment: entry.payment,
      item: entry.item, dest: entry.dest, persons: entry.persons,
      owner_aboard: entry.ownerAboard, crew_sel: entry.crewSel || [],
      dept_time: entry.deptTime, arr_time: entry.arrTime,
      fuel_out: entry.fuelOut, fuel_in: entry.fuelIn,
      eng_out: entry.engineHrsOut, eng_in: entry.engineHrsIn,
      gen_out: entry.genHrsOut, gen_in: entry.genHrsIn, clima: entry.salidaClima,
    }).select().single();
    if (data) {
      const mapped = { ...entry, id: data.id };
      // Si la entrada tiene costo, registrarlo automáticamente en Costos
      const costUSD = parseFloat(entry.costUSD);
      const costBs = parseFloat(entry.costBs);
      if ((costUSD>0) || (costBs>0)) {
        const cat = entry.type==="Compra" ? "Repuestos"
          : entry.type==="Combustible" ? "Combustible"
          : entry.type==="Servicio" ? "Mantenimiento"
          : entry.type==="Reparación" ? "Reparación" : "Otro";
        const desc = entry.item || entry.equipment || entry.desc || entry.type;
        if (costUSD>0) supabase.from("expenses").insert({ vessel_id:vesselId, owner_id:ownerId, category:cat, description:desc, amount:costUSD, currency:"USD", expense_date:entry.date, source:"log" }).then(()=>{});
        if (costBs>0) supabase.from("expenses").insert({ vessel_id:vesselId, owner_id:ownerId, category:cat, description:desc, amount:costBs, currency:"VES", expense_date:entry.date, source:"log" }).then(()=>{});
      }
      setVessels(vs => vs.map(v => {
        if (v.id !== vesselId) return v;
        let updated = { ...v, log: [mapped, ...(v.log||[])] };
        if (entry.type === "Combustible" && entry.fuelQty != null) {
          updated.fuel = entry.fuelQty;
          updated.fuelUnit = entry.fuelUnit || v.fuelUnit;
        }
        // Si la salida trae horas finales de motor/generador, actualizarlas
        if (entry.type === "Salida") {
          if (entry.engineHrsIn != null && !isNaN(Number(entry.engineHrsIn))) updated.engineHours = Number(entry.engineHrsIn);
          if (entry.genHrsIn != null && !isNaN(Number(entry.genHrsIn))) updated.genHours = Number(entry.genHrsIn);
          // Recalcular estado de tareas por horas de motor
          const eng = Number(updated.engineHours)||0;
          updated.tasks = (updated.tasks||[]).map(t => {
            if (t.interval==="Por horas" && t.dueHours!=null && t.status!=="done") {
              const remaining = Number(t.dueHours) - eng;
              let status="ok"; if(remaining<=0)status="overdue"; else if(remaining<=20)status="due";
              return {...t, status};
            }
            return t;
          });
          // Persistir horas en la BD
          supabase.from("vessels").update({ engine_hours: updated.engineHours, gen_hours: updated.genHours }).eq("id", vesselId).then(()=>{});
        }
        return updated;
      }));
    }
  }, []);

  // All hooks must be before any early returns
  const updateVessel = useCallback(async (updated) => {
    // Update local state immediately
    setVessels(vs => vs.map(v => v.id === updated.id ? updated : v));
    // Build clean Supabase payload — everything lives in details JSONB
    const payload = {
      name:         updated.name         || "",
      type:         updated.type         || "",
      marina:       updated.marina       || "",
      captain:      updated.captain      || "",
      fuel:         updated.fuel         ?? 0,
      fuel_unit:    updated.fuelUnit     || updated.fuel_unit || "gal",
      engine_hours: updated.engineHours  ?? updated.engine_hours ?? 0,
      gen_hours:    updated.genHours     ?? updated.gen_hours    ?? 0,
      status:       updated.status       || "ok",
      photo_url:    updated.photo        || null,
      crew:         updated.crew         || [],
      motors:       updated.motors       || [],
      generators:   updated.generators   || [],
      custom_systems: updated.customSystems || updated.custom_systems || [],
      providers:    updated.providers    || [],
      details: {
        ...(updated.details || {}),
        _profile:      updated.profile      || {},
        _config:       updated.config       || {},
        _subscription: updated.subscription || {},
      },
    };
    // Remove frontend-only keys that don't exist in DB
    delete payload.id;
    delete payload.owner_id;
    const { error } = await supabase.from("vessels").update(payload).eq("id", updated.id);
    if (error) console.error("updateVessel error:", error.message);
  }, []);

  const fetchVessels = useCallback(async (uid) => {
    setVesselsLoading(true);
    try {
      const { data, error } = await supabase.from("vessels").select("*").eq("owner_id", uid).order("created_at", { ascending: true });
      if (error) { console.error("fetchVessels error:", error.message); setVesselsLoading(false); return; }
      const mapped = await Promise.all((data || []).map(async v => {
        const [tasks, log] = await Promise.all([fetchTasks(v.id), fetchLog(v.id)]);
        const d = v.details || {};
        return {
          ...v,
          fuelUnit: v.fuel_unit || "gal",
          engineHours: v.engine_hours || 0,
          genHours: v.gen_hours || 0,
          customSystems: v.custom_systems || [],
          photo: v.photo_url || null,
          profile:      d._profile      || { firstName:"", lastName:"", phone:"", email:"", marinaAddress:"" },
          config:       d._config       || { distUnit:"nm", speedUnit:"kn", fuelUnit:"gal", tempUnit:"C" },
          subscription: d._subscription || { plan:"Pro", price:79, currency:"USD", cycle:"Mensual" },
          details:      d,
          tasks, log,
          records: [],
          alerts: tasks.filter(t => t.status === "overdue").length,
          weather: { temp:29, wind:14, condition:"Parcialmente nublado", icon:"⛅" },
        };
      }));
      setVessels(mapped);
      if (mapped.length > 0) setVesselId(mapped[0].id);
    } catch(e) {
      console.error("fetchVessels catch:", e);
    }
    setVesselsLoading(false);
  }, []);

  const checkIfCaptain = useCallback(async (uid, knownRole) => {
    // Siempre leer el role de profiles (fuente de verdad), con fallback al knownRole
    let role = knownRole;
    const { data: prof, error: profErr } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
    if (prof?.role) role = prof.role;
    console.log("[Carive] checkIfCaptain — uid:", uid, "knownRole:", knownRole, "profileRole:", prof?.role, "finalRole:", role, "profErr:", profErr?.message);

    if (role === "store") {
      setStoreProfile({ role });
      setVesselsLoading(false);
      return true;
    }

    if (role === "crew") {
      const { data: cap } = await supabase.from("captain_profiles").select("*, vessels(*)").eq("user_id", uid).eq("active", true).maybeSingle();
      if (cap) {
        setCaptainProfile(cap);
        const v = cap.vessels;
        if (v) {
          const [tasks, log] = await Promise.all([fetchTasks(v.id), fetchLog(v.id)]);
          setCaptainVessel({ ...v, fuelUnit: v.fuel_unit||"gal", engineHours: v.engine_hours||0, genHours: v.gen_hours||0, tasks, log, weather: { temp:29, wind:14, condition:"Parcialmente nublado", icon:"⛅" } });
        }
      } else {
        setCrewProfile({ role });
        setVesselsLoading(false);
      }
      return true;
    }
    // Owner — buscar si está asignado como capitán a algún barco
    const { data } = await supabase.from("captain_profiles").select("*, vessels(*)").eq("user_id", uid).eq("active", true).maybeSingle();
    if (data) {
      setCaptainProfile(data);
      const v = data.vessels;
      if (v) {
        const [tasks, log] = await Promise.all([fetchTasks(v.id), fetchLog(v.id)]);
        setCaptainVessel({ ...v, fuelUnit: v.fuel_unit||"gal", engineHours: v.engine_hours||0, genHours: v.gen_hours||0, tasks, log, weather: { temp:29, wind:14, condition:"Parcialmente nublado", icon:"⛅" } });
        return true;
      }
    }
    return false;
  }, [fetchTasks, fetchLog]);

  // Contador de notificaciones in-app no leídas (polling cada 20s)
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const load = async () => { const n = await countUnread(user.id); if (active) setUnreadCount(n); };
    load();
    const interval = setInterval(load, 20000);
    return () => { active = false; clearInterval(interval); };
  }, [user?.id, showNotifPanel]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        supabase.from("profiles").select("full_name").eq("id", u.id).single()
          .then(({ data }) => { if (data?.full_name) setUser(prev => ({...prev, full_name: data.full_name})); });
        window.__setUserFullName = (name) => setUser(prev => ({...prev, full_name: name}));
        const isCrew = await checkIfCaptain(u.id, u.role);
        if (!isCrew) await fetchVessels(u.id);
        setCheckingRole(false);
      } else {
        Object.keys(localStorage).filter(k=>k.startsWith("nautitrack_role_")).forEach(k=>localStorage.removeItem(k));
        setVesselsLoading(false);
        setCheckingRole(false);
      }
      setAuthLoading(false);
    });
  }, []);

  const handleAddVessel = async (vesselData) => {
    const { data, error } = await supabase.from("vessels").insert({ ...vesselData, owner_id: user.id }).select().single();
    if (error) {
      console.error("[Carive] Error al crear embarcación:", error);
      alert("No se pudo crear la embarcación: " + error.message + "\n\nSi el problema persiste, avísanos.");
      return;
    }
    if (data) {
      const mapped = {
        ...data,
        fuelUnit: data.fuel_unit || "gal",
        engineHours: data.engine_hours || 0,
        genHours: data.gen_hours || 0,
        customSystems: [],
        tasks: [], log: [], records: [], alerts: 0,
        weather: { temp:29, wind:14, condition:"Parcialmente nublado", icon:"⛅" },
      };
      setVessels(v => [...v, mapped]);
      setVesselId(mapped.id);
      setAddingVessel(false);
    }
  };

  // Intentar agregar barco respetando el límite del plan
  const tryAddVessel = () => {
    const plan = getPlan(vessels.find(v=>v.id===vesselId) || vessels[0]);
    if (vessels.length >= plan.maxVessels) {
      setShowPlans(true);
      return;
    }
    setAddingVessel(true);
  };

  // ── Early returns AFTER all hooks ────────────────────────────────────────────

  // Ruta pública de QR check-in — no requiere auth
  if (window.location.pathname === "/checkin") return <CheckinPage />;

  if (authLoading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f7ff",fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:16}}>⚓</div><div style={{fontSize:14,color:"#64748b"}}>Cargando Carive...</div></div>
    </div>
  );

  if (!user) return <Auth onLogin={async (u) => { setUser(u); setCheckingRole(true); const isCrew = await checkIfCaptain(u.id, u.role); setCheckingRole(false); if (!isCrew) fetchVessels(u.id); }} />;

  // Si el usuario es capitán → mostrar vista de capitán
  if (captainProfile && captainVessel) return (
    <CaptainView
      vessel={captainVessel}
      user={user}
      captainProfile={captainProfile}
      onLogout={async () => { await supabase.auth.signOut(); setUser(null); setCaptainProfile(null); setCaptainVessel(null); }}
    />
  );

  // Mientras se determina el rol, mostrar loading (bloquea AddVessel)
  if (checkingRole || vesselsLoading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f7ff",fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:16}}>🚢</div><div style={{fontSize:14,color:"#64748b"}}>Cargando...</div></div>
    </div>
  );

  // Si es crew sin barco asignado → mostrar perfil crew
  if (storeProfile) return (
    <StoreView user={user} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setVesselsLoading(false); setCheckingRole(true); setStoreProfile(null); setCrewProfile(null); setCaptainProfile(null); setCaptainVessel(null); }}/>
  );

  if (crewProfile && !captainProfile) return (
    <CrewProfile user={user} onLogout={async () => { await supabase.auth.signOut(); setUser(null); setVesselsLoading(false); setCheckingRole(true); setCrewProfile(null); setCaptainProfile(null); setCaptainVessel(null); }}/>
  );

  if (!vesselsLoading && vessels.length === 0 && showWelcome) return (
    <Onboarding onStart={() => { localStorage.setItem("nt_welcomed","1"); setShowWelcome(false); }} />
  );

  if (!vesselsLoading && vessels.length === 0) return (
    <AddVessel onAdd={handleAddVessel} onSkip={() => {
      const demo = INIT_VESSELS.map(v => ({...v, owner_id: user.id}));
      setVessels(demo);
      setVesselId(demo[0].id);
    }}/>
  );

  if (addingVessel) return (
    <AddVessel onAdd={handleAddVessel} onSkip={()=>setAddingVessel(false)}/>
  );

  const vessel = vessels.find(v => v.id === vesselId) || vessels[0];

  return (
    <div style={s.root} onClick={() => { setShowVesselMenu(false); setShowUserMenu(false); }}>
      <TopNav vessel={vessel} vessels={vessels} user={user} tryAddVessel={tryAddVessel} setShowPlans={setShowPlans} setShowAdmin={setShowAdmin} isAdminUser={isAdmin(user)}
        setVesselId={(id) => { setVesselId(id); setPage("home"); }}
        showVesselMenu={showVesselMenu} setShowVesselMenu={setShowVesselMenu}
        showUserMenu={showUserMenu} setShowUserMenu={setShowUserMenu}
        setShowVesselDetails={setShowVesselDetails}
        setShowProviders={setShowProviders} setShowProfile={setShowProfile}
        setShowNotifications={setShowNotifications}
        setShowNotifPanel={setShowNotifPanel}
        unreadCount={unreadCount}
        setShowQRPanel={setShowQRPanel}
        setShowCaptainManager={setShowCaptainManager}
        setShowCrewMarket={setShowCrewMarket}
        page={page} setPage={setPage}
        onLogout={async () => { await supabase.auth.signOut(); setUser(null); setVessels([]); setVesselsLoading(false); setCaptainProfile(null); setCaptainVessel(null); setCrewProfile(null); }}
      />
      <div style={{...s.body, padding:isMobile?"14px 12px":"20px 24px"}}>
        {page==="home" && !hideChecklist && (
          <OnboardingChecklist
            vessel={vessel}
            onAddTask={()=>setPage("tasks")}
            onAddLog={()=>setPage("log")}
            onInviteCrew={()=>setShowCrewMarket(true)}
            onDismiss={()=>{ localStorage.setItem("nt_hide_checklist","1"); setHideChecklist(true); }}
          />
        )}
        {isExpiringSoon(vessel) && (
          <div onClick={()=>setShowPlans(true)} style={{maxWidth:1100,margin:"0 auto 14px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:12,flexWrap:"wrap"}}>
            <div style={{fontSize:13,color:"#92400e"}}>
              <strong>Tu plan {getPlan(vessel).name} vence en {daysLeft(vessel)} día{daysLeft(vessel)!==1?"s":""}.</strong> Renueva para no perder tus funciones premium.
            </div>
            <span style={{fontSize:12,fontWeight:700,color:"#fff",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",padding:"7px 14px",borderRadius:8,whiteSpace:"nowrap"}}>Renovar</span>
          </div>
        )}
        {page==="home"    && <HomePage    vessel={vessel} setPage={setPage} vessels={vessels} updateVessel={updateVessel} />}
        {page==="tasks"   && <TasksPage   vessel={vessel} updateVessel={updateVessel} addTask={(t)=>addTask(vessel.id,user.id,t)} />}
        {page==="log"     && <LogPage     vessel={vessel} updateVessel={updateVessel} addLogEntry={(e)=>addLogEntry(vessel.id,user.id,e)} />}
        {page==="records" && <RecordsPage vessel={vessel} />}
        {page==="docs"    && <DocsPage vessel={vessel} user={user} />}
        {page==="costs"   && <CostsPage vessel={vessel} user={user} setShowProfile={()=>setShowPlans(true)} />}
        {page==="fleet"   && <FleetPage vessels={vessels} vessel={vessel} user={user} setVesselId={setVesselId} setPage={setPage} setShowProfile={()=>setShowPlans(true)} />}
        {page==="inventory" && <InventoryPage vessel={vessel} user={user} setShowProfile={()=>setShowPlans(true)} />}
      </div>
      {showVesselDetails && <VesselDetailsModal vessel={vessel} updateVessel={updateVessel} onClose={() => setShowVesselDetails(false)} />}
      {showProviders     && <ProvidersModal vessel={vessel} updateVessel={updateVessel} onClose={() => setShowProviders(false)} />}
      {showNotifications && <NotificationsModal vessel={vessel} user={user} onClose={() => setShowNotifications(false)} />}
      {showQRPanel && <QRPanel vessel={vessel} onClose={() => setShowQRPanel(false)} />}
      {showCaptainManager && <CaptainManagerModal vessel={vessel} user={user} onClose={() => setShowCaptainManager(false)} />}
      {showCrewMarket && <CrewMarketplace vessel={vessel} user={user} onClose={() => setShowCrewMarket(false)} />}
      {showNotifPanel && <NotifPanel user={user} onClose={()=>setShowNotifPanel(false)} onNavigate={(link)=>{ if(link==="tripulacion")setShowCrewMarket(true); }} />}
      {planMsg && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"12px 20px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:4000,maxWidth:340,textAlign:"center"}}>{planMsg}</div>}
      {showPlans && <PlansModal vessel={vessel} user={user} onClose={()=>setShowPlans(false)} />}
      {showAdmin && <AdminPanel user={user} onClose={()=>setShowAdmin(false)} />}
      {showProfile && <ProfileModal vessel={vessel} updateVessel={updateVessel} user={user} onClose={() => setShowProfile(false)} />}
    </div>
  );
}

const mobileItemStyle = {display:"block",width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderRadius:8,cursor:"pointer",background:"transparent",color:"#1e293b",fontWeight:500,fontSize:14};

function TopNav({ vessel,vessels,user,tryAddVessel,setShowPlans,setShowAdmin,isAdminUser,setVesselId,showVesselMenu,setShowVesselMenu,showUserMenu,setShowUserMenu,setShowVesselDetails,setShowProviders,setShowProfile,setShowNotifications,setShowNotifPanel,unreadCount,setShowQRPanel,setShowCaptainManager,setShowCrewMarket,page,setPage,onLogout }) {
  const { isMobile, isTablet } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const totalAlerts = vessels.reduce((a,v) => a+v.alerts, 0);
  const useHamburger = isMobile || isTablet;

  // ─── Vista móvil/tablet: logo + hamburguesa ───
  if (useHamburger) {
    return (
      <>
        <nav style={{...s.nav, padding:"0 16px", justifyContent:"space-between"}} onClick={e=>e.stopPropagation()}>
          <div style={s.navLogo} onClick={()=>setPage("home")}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" fill="#38bdf8" opacity=".12"/>
              <path d="M16 4 L27 26 H5 Z" stroke="#38bdf8" strokeWidth="2.2" fill="rgba(56,189,248,0.15)" strokeLinejoin="round"/>
              <line x1="16" y1="4" x2="16" y2="26" stroke="#7dd3fc" strokeWidth="1.5"/>
            </svg>
            <div style={s.navBrand}>Carive</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{position:"relative"}}>
              <span style={{cursor:"pointer",display:"flex"}} onClick={()=>setShowNotifPanel(true)}><IconBell size={20} color="#475569"/></span>
              {unreadCount>0&&<div style={s.bellBadge}>{unreadCount}</div>}
            </div>
            <button onClick={()=>setMobileMenuOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",flexDirection:"column",gap:4}}>
              <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
              <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
              <div style={{width:22,height:2.5,background:"#0f172a",borderRadius:2}}/>
            </button>
          </div>
        </nav>

        {/* Overlay + panel deslizante */}
        {mobileMenuOpen&&(
          <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:200}} onClick={()=>setMobileMenuOpen(false)}>
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:280,background:"#fff",boxShadow:"2px 0 20px rgba(0,0,0,0.2)",display:"flex",flexDirection:"column",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
              {/* Header del panel */}
              <div style={{padding:"18px 20px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={s.navBrand}>Carive</div>
                <button onClick={()=>setMobileMenuOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
              </div>

              {/* Perfil del usuario */}
              <div style={{padding:"16px 20px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:12}}>
                <div style={s.navAvatar}>{(user?.full_name||user?.email||"?")[0].toUpperCase()}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#0f172a"}}>{user?.full_name||user?.email||"Mi Cuenta"}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>Propietario</div>
                </div>
              </div>

              {/* Selector de embarcación */}
              <div style={{padding:"12px 20px",borderBottom:"1px solid #f1f5f9"}}>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>EMBARCACIÓN</div>
                {vessels.map(v=>(
                  <button key={v.id} onClick={()=>{setVesselId(v.id);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",border:"none",borderRadius:8,cursor:"pointer",background:v.id===vessel.id?"#eff6ff":"transparent",marginBottom:4,textAlign:"left"}}>
                    <span style={{...s.dot,background:STATUS_CFG[v.status].dot}}/>
                    <div><div style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{v.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{v.type} · {v.marina}</div></div>
                  </button>
                ))}
              </div>

              {/* Navegación */}
              <div style={{padding:"12px 12px",borderBottom:"1px solid #f1f5f9"}}>
                {[...(vessels.length>1?[{key:"fleet",label:"Mi Flota"}]:[]),{key:"home",label:"Inicio"},{key:"tasks",label:"Tareas"},{key:"log",label:"Bitácora"},{key:"records",label:"Records"},{key:"costs",label:"Costos"},{key:"inventory",label:"Repuestos"},{key:"docs",label:"Documentos"}].map(n=>(
                  <button key={n.key} onClick={()=>{setPage(n.key);setMobileMenuOpen(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",border:"none",borderRadius:8,cursor:"pointer",background:page===n.key?"#eff6ff":"transparent",color:page===n.key?"#0ea5e9":"#1e293b",fontWeight:page===n.key?700:500,fontSize:14}}>{n.label}</button>
                ))}
              </div>

              {/* Acciones */}
              <div style={{padding:"12px 12px",borderBottom:"1px solid #f1f5f9"}}>
                <button onClick={()=>{setShowProviders(true);setMobileMenuOpen(false);}} style={mobileItemStyle}>👥 Proveedores</button>
                <button onClick={()=>{setShowCrewMarket(true);setMobileMenuOpen(false);}} style={mobileItemStyle}>Tripulación</button>
                <button onClick={()=>{setShowQRPanel(true);setMobileMenuOpen(false);}} style={mobileItemStyle}>📱 QR Check-in</button>
              </div>

              {/* Cuenta */}
              <div style={{padding:"12px 12px"}}>
                <button onClick={()=>{setShowProfile(true);setMobileMenuOpen(false);}} style={mobileItemStyle}>👤 Mi Perfil</button>
                <button onClick={()=>{setShowVesselDetails(true);setMobileMenuOpen(false);}} style={mobileItemStyle}>⚓ Mi Embarcación</button>
                <button onClick={()=>{onLogout();setMobileMenuOpen(false);}} style={{...mobileItemStyle,color:"#dc2626"}}>🚪 Cerrar Sesión</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ─── Vista desktop/tablet ───
  return (
    <nav style={s.nav} onClick={e => e.stopPropagation()}>
      <div style={s.navLogo} onClick={() => setPage("home")}>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" fill="#38bdf8" opacity=".12"/>
          <path d="M16 4 L27 26 H5 Z" stroke="#38bdf8" strokeWidth="2.2" fill="rgba(56,189,248,0.15)" strokeLinejoin="round"/>
          <line x1="16" y1="4" x2="16" y2="26" stroke="#7dd3fc" strokeWidth="1.5"/>
        </svg>
        <div style={s.navBrand}>Carive</div>
      </div>
      <div style={s.navLinks}>
        {[...(vessels.length>1?[{key:"fleet",label:"Mi Flota"}]:[]),{key:"home",label:"Inicio"},{key:"tasks",label:"Tareas"},{key:"log",label:"Bitácora"},{key:"records",label:"Records"},{key:"costs",label:"Costos"},{key:"inventory",label:"Repuestos"},{key:"docs",label:"Documentos"}].map(n => (
          <button key={n.key} onClick={() => setPage(n.key)} style={{...s.navLink,color:page===n.key?"#0ea5e9":"#64748b",borderBottom:page===n.key?"2px solid #0ea5e9":"2px solid transparent",fontWeight:page===n.key?600:400}}>{n.label}</button>
        ))}
      </div>
      <div style={s.navRight}>
        <button style={s.provBtn} onClick={() => setShowProviders(true)}>Proveedores</button>
        <button style={s.provBtn} onClick={() => setShowCrewMarket(true)}>Tripulación</button>
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
              <button onClick={()=>{setShowVesselMenu(false);tryAddVessel&&tryAddVessel();}} style={{...s.dropItem,color:"#2563eb",fontWeight:700,fontSize:13,borderTop:"1px solid #f1f5f9"}}>
                ＋ Agregar embarcación
              </button>
            </div>
          )}
        </div>
        <div style={s.bellWrap}>
          <span style={{cursor:"pointer",display:"flex"}} onClick={()=>setShowNotifPanel(true)}><IconBell size={19} color="#475569"/></span>
          {unreadCount > 0 && <div style={s.bellBadge}>{unreadCount}</div>}
        </div>
        <div style={{position:"relative"}}>
          <button onClick={()=>setShowQRPanel(true)} style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,color:"#0369a1",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
            📱 QR
          </button>
        </div>
        <div style={{position:"relative"}}>
          <button style={s.userBtn} onClick={(e) => { e.stopPropagation(); setShowVesselMenu(false); setShowUserMenu(v => !v); }}>
            <div style={s.navAvatar}>{getInitials(user?.full_name || user?.email)}</div>
            <div className="nav-username"><div style={s.navName}>{user?.full_name||user?.email||"Mi Cuenta"}</div><div style={s.navRole}>Propietario</div></div>
            <span style={{color:"#94a3b8",fontSize:10}}>▼</span>
          </button>
          {showUserMenu && (
            <>
              <div onClick={(e)=>{e.stopPropagation(); setShowUserMenu(false);}} style={{position:"fixed",inset:0,zIndex:25}}/>
              <div style={{...s.drop,minWidth:210,zIndex:26}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"10px 14px 4px",fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:"0.1em"}}>MI CUENTA</div>
              {[
                {icon:"👤",label:"Mi Perfil",       action:() => { setShowProfile(true); setShowUserMenu(false); }},
                {icon:"⚓",label:"Mi Embarcación",  action:() => { setShowVesselDetails(true); setShowUserMenu(false); }},
                {icon:"💳",label:"Planes y Suscripción", action:() => { setShowPlans(true); setShowUserMenu(false); }},
                ...(isAdminUser?[{icon:"📊",label:"Panel de Administrador", action:() => { setShowAdmin(true); setShowUserMenu(false); }}]:[]),
                {icon:"🚪",label:"Cerrar Sesión",    action:() => { onLogout(); setShowUserMenu(false); }},
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{...s.dropItem,gap:10}}>
                  <span>{item.icon}</span><span style={{fontSize:13,color:"#1e293b"}}>{item.label}</span>
                </button>
              ))}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function HomePage({ vessel, setPage, vessels, updateVessel }) {
  const { isMobile } = useResponsive();
  const upcoming = [...(vessel.tasks||[])].filter(t => t.status!=="done").sort((a,b) => new Date(a.nextDue)-new Date(b.nextDue)).slice(0,5);
  const rowStyle = { ...s.row, flexDirection: isMobile ? "column" : "row" };
  return (
    <div style={s.home}>
      <div style={rowStyle}>
        <FleetCard vessels={vessels} vessel={vessel} updateVessel={updateVessel} />
        <AlertsCard vessel={vessel} setPage={setPage} />
        <IndicatorsCard vessel={vessel} />
      </div>
      <div style={rowStyle}>
        <CalendarCard tasks={upcoming} setPage={setPage} />
        <LogCard vessel={vessel} setPage={setPage} />
      </div>
      <WeatherBar vessel={vessel} />
    </div>
  );
}

function FleetCard({ vessels, vessel, updateVessel }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState("");

  const startEdit = (v, e) => { e.stopPropagation(); setEditingId(v.id); setEditName(v.name); };
  const saveEdit  = async (v) => {
    if (editName.trim() && editName !== v.name) {
      await updateVessel({...v, name: editName.trim()});
    }
    setEditingId(null);
  };

  return (
    <div style={{...s.card,flex:1.2}}>
      <div style={s.cardHdr}><span style={{...s.cardTitle,display:"flex",alignItems:"center",gap:7}}><IconBoat size={17} color="#2563eb"/> Estado de la Flota</span><span style={s.cardSub}>{vessels.length} embarcaciones</span></div>
      {vessels.map(v => {
        const od=v.tasks.filter(t=>t.status==="overdue").length, du=v.tasks.filter(t=>t.status==="due").length;
        return (
          <div key={v.id} style={{...s.fleetRow,background:v.id===vessel.id?"#f0f9ff":"#f8fafc",borderColor:v.id===vessel.id?"#bae6fd":"#e2e8f0"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
              <div style={{...s.statusBall,background:STATUS_CFG[v.status].dot,boxShadow:`0 0 8px ${STATUS_CFG[v.status].dot}66`}} />
              <div style={{flex:1}}>
                {editingId===v.id
                  ? <input value={editName} onChange={e=>setEditName(e.target.value)} onBlur={()=>saveEdit(v)} onKeyDown={e=>{if(e.key==="Enter")saveEdit(v);if(e.key==="Escape")setEditingId(null);}} autoFocus style={{...s.input,padding:"3px 7px",fontSize:13,width:"100%"}}/>
                  : <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{fontWeight:600,fontSize:13,color:"#0f172a"}}>{v.name}</div>
                      <button onClick={(e)=>startEdit(v,e)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:11,padding:"1px 4px",borderRadius:4}} title="Editar nombre">✎</button>
                    </div>
                }
                <div style={{fontSize:11,color:"#94a3b8"}}>{v.marina} · Cap. {(v.captain||"").split(" ")[0]}</div>
              </div>
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
  const od = (vessel.tasks||[]).filter(t => t.status==="overdue");
  return (
    <div style={{...s.card,flex:1}}>
      <div style={s.cardHdr}><span style={{...s.cardTitle,display:"flex",alignItems:"center",gap:7}}><IconAlert size={17} color="#dc2626"/> Alertas</span><button onClick={() => setPage("tasks")} style={s.linkBtn}>Ver →</button></div>
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
  // Calcular próximo servicio real de las tareas pendientes
  const pendingTasks = (vessel.tasks||[]).filter(t=>t.status!=="done"&&t.nextDue).sort((a,b)=>new Date(a.nextDue)-new Date(b.nextDue));
  const nextService = pendingTasks[0];
  const nextServiceVal = nextService
    ? new Date(nextService.nextDue).toLocaleDateString("es-VE",{day:"numeric",month:"short"})
    : "Ninguno";
  return (
    <div style={{...s.card,flex:1}}>
      <div style={s.cardHdr}><span style={s.cardTitle}>Indicadores</span><span style={s.cardSub}>{vessel.name}</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {Icon:IconFuel,val:`${vessel.fuel} ${vessel.fuelUnit}`,lbl:"Combustible",color:fc,bar:true},
          {Icon:IconEngine,val:`${vessel.engineHours}h`,lbl:"Horas Motor",color:"#2563eb",bar:false},
          {Icon:IconBolt,val:`${vessel.genHours}h`,lbl:"Horas Generador",color:"#7c3aed",bar:false},
          {Icon:IconCalendar,val:nextServiceVal,lbl:nextService?"Próx. Servicio":"Sin servicios",color:nextService?"#dc2626":"#94a3b8",bar:false},
        ].map(ind => (
          <div key={ind.lbl} style={s.indBox}>
            <div style={{marginBottom:6,display:"flex"}}><ind.Icon size={22} color={ind.color}/></div>
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
      <div style={s.cardHdr}><span style={{...s.cardTitle,display:"flex",alignItems:"center",gap:7}}><IconCalendar size={17} color="#2563eb"/> Próximos Servicios</span><button onClick={() => setPage("tasks")} style={s.linkBtn}>Ver todos →</button></div>
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
              <div style={{fontSize:10,color:"#94a3b8"}}>{fmtDate(t.nextDue)}</div>
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
      <div style={s.cardHdr}><span style={{...s.cardTitle,display:"flex",alignItems:"center",gap:7}}><IconBook size={17} color="#2563eb"/> Bitácora Reciente</span><button onClick={() => setPage("log")} style={s.linkBtn}>Ver todo →</button></div>
      {(vessel.log||[]).slice(0,4).map((e,i) => (
        <div key={i} style={s.logRow}>
          <span style={{...s.logBadge,background:LOG_COLOR[e.type]+"18",color:LOG_COLOR[e.type]}}>{e.type}</span>
          <span style={{fontSize:12,color:"#334155",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {e.type==="Salida"?`${e.dest} · ${e.persons}p`:e.type==="Compra"?e.item:(e.desc||"").slice(0,50)}
          </span>
          <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
            {(e.photos||[]).length>0&&<span style={{fontSize:11}}>📷</span>}
            <span style={{fontSize:10,color:"#94a3b8"}}>{fmtDate(e.date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeatherBar({ vessel }) {
  const [weather, setWeather]   = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading]   = useState(true);

  const ICONS = {"01":"☀️","02":"⛅","03":"☁️","04":"☁️","09":"🌧","10":"🌦","11":"⛈","13":"❄️","50":"🌫"};
  const DAYS  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  useEffect(() => {
    const city    = vessel.details?.city    || "";
    const state   = vessel.details?.state   || "";
    const country = vessel.details?.country || "";
    // Normalize country and state for OpenWeatherMap
    const COUNTRY_CODES = {"venezuela":"VE","estados unidos":"US","usa":"US","united states":"US","colombia":"CO","panama":"PA","mexico":"MX","españa":"ES","spain":"ES","france":"FR","brazil":"BR","brasil":"BR","argentina":"AR","peru":"PE","chile":"CL","ecuador":"EC","cuba":"CU","dominican republic":"DO","república dominicana":"DO"};
    const STATE_CODES = {"florida":"FL","california":"CA","texas":"TX","new york":"NY","miami":"FL","new jersey":"NJ","georgia":"GA","north carolina":"NC","south carolina":"SC","virginia":"VA","maryland":"MD"};
    const countryNorm = COUNTRY_CODES[country.toLowerCase()] || country;
    const stateNorm   = STATE_CODES[state.toLowerCase()]   || state;
    const query   = [city, stateNorm, countryNorm].filter(Boolean).join(",") || vessel.marina || "Caracas";
    const isLocal = window.location.hostname === "localhost";
    const KEY     = "756f12d0c20d29f76808839251369ef7";

    const currentUrl = isLocal
      ? `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${KEY}&units=metric&lang=es`
      : `/api/weather?city=${encodeURIComponent(query)}`;

    const forecastUrl = isLocal
      ? `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(query)}&appid=${KEY}&units=metric&lang=es&cnt=40`
      : `/api/forecast?city=${encodeURIComponent(query)}`;

    // Current weather
    fetch(currentUrl).then(r=>r.json()).then(data => {
      if (data.main) {
        const code = (data.weather?.[0]?.icon||"01").slice(0,2);
        setWeather({
          temp:      Math.round(data.main.temp),
          feels:     Math.round(data.main.feels_like),
          humidity:  data.main.humidity,
          wind:      Math.round((data.wind?.speed||0)*1.944),
          condition: data.weather?.[0]?.description || "",
          icon:      ICONS[code] || "🌤",
          city:      data.name || query,
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // 5-day forecast — group by day, take midday reading
    fetch(forecastUrl).then(r=>r.json()).then(data => {
      if (!data.list) return;
      const byDay = {};
      data.list.forEach(item => {
        const d = new Date(item.dt * 1000);
        const key = d.toDateString();
        const hour = d.getHours();
        // prefer midday reading (12-15h), otherwise take first
        if (!byDay[key] || (hour >= 12 && hour <= 15)) {
          byDay[key] = {
            day:  DAYS[d.getDay()],
            icon: ICONS[(item.weather?.[0]?.icon||"01").slice(0,2)] || "🌤",
            high: Math.round(item.main.temp_max),
            low:  Math.round(item.main.temp_min),
            desc: item.weather?.[0]?.description || "",
          };
        }
      });
      // skip today, take next 5
      const days = Object.values(byDay).slice(1, 6);
      setForecast(days);
    }).catch(() => {});
  }, [vessel.details?.city, vessel.details?.state, vessel.details?.country, vessel.marina]);

  const w = weather || { temp:"—", wind:"—", humidity:"—", condition: loading?"Cargando...":"Sin datos", icon:"🌤", city: vessel.marina||"" };

  return (
    <div style={{...s.card,display:"flex",alignItems:"center",gap:0,padding:"14px 20px",flexWrap:"nowrap",overflow:"hidden"}}>
      {/* Current weather */}
      <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0,minWidth:160}}>
        <span style={{fontSize:34}}>{loading?"⏳":w.icon}</span>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:"#0f172a",lineHeight:1}}>{w.temp}{weather?"°C":""}</div>
          <div style={{fontSize:11,color:"#64748b",textTransform:"capitalize",marginTop:2}}>{w.condition}</div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>📍 {w.city}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{width:1,height:44,background:"#e2e8f0",flexShrink:0,margin:"0 16px"}}/>

      {/* Current stats */}
      <div style={{display:"flex",gap:16,flexShrink:0}}>
        {[
          ["💨", weather?`${w.wind} kn`:"—", "Viento"],
          ["💧", weather?`${w.humidity}%`:"—", "Humedad"],
          ["🌡", weather?`${w.feels}°C`:"—", "Sensación"],
        ].map(([ic,val,lbl]) => (
          <div key={lbl} style={{textAlign:"center"}}>
            <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{ic} {val}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Divider */}
      {forecast.length>0&&<div style={{width:1,height:44,background:"#e2e8f0",flexShrink:0,margin:"0 16px"}}/>}

      {/* 5-day forecast */}
      {forecast.length>0&&(
        <div style={{display:"flex",gap:10,flex:1,justifyContent:"space-around",minWidth:0}}>
          {forecast.map((d,i)=>(
            <div key={i} style={{textAlign:"center",flexShrink:0}}>
              <div style={{fontSize:10,fontWeight:700,color:"#64748b",marginBottom:2}}>{d.day}</div>
              <div style={{fontSize:18,lineHeight:1,marginBottom:2}}>{d.icon}</div>
              <div style={{fontSize:11,fontWeight:700,color:"#0f172a"}}>{d.high}°</div>
              <div style={{fontSize:10,color:"#94a3b8"}}>{d.low}°</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function TasksPage({ vessel, updateVessel, addTask }) {
  const [filter, setFilter]     = useState("Todas");
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const FILTERS = ["Todas","Por vencer","Vencidas","Completadas"];
  const filtered = (vessel.tasks||[]).filter(t => {
    if (filter==="Vencidas")    return t.status==="overdue";
    if (filter==="Por vencer")  return t.status==="due";
    if (filter==="Completadas") return t.status==="done";
    return true;
  });
  const PILL = { overdue:{bg:"#ef4444",c:"#fff",l:"Vencido"}, due:{bg:"#f59e0b",c:"#fff",l:"Por vencer"}, ok:{bg:"#22c55e",c:"#fff",l:"Al día"}, done:{bg:"#64748b",c:"#fff",l:"Completado"} };
  const allSystems = getAllSystems(vessel);
  const handleAddTask = (task) => { addTask(task); setShowAdd(false); };
  return (
    <div style={{padding:"24px 28px"}}>
      <div style={s.toolbar}>
        <h2 style={s.toolbarTitle}>Tareas — {vessel.name}</h2>
        <div style={{display:"flex",gap:6,flex:1,alignItems:"center",flexWrap:"wrap"}}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{...s.filterBtn,background:filter===f?"#1e3a5f":"transparent",color:filter===f?"#fff":"#64748b",borderColor:filter===f?"#4a9eff":"#e2e8f0"}}>
              {f}
              <span style={{marginLeft:4,fontSize:10,background:filter===f?"rgba(255,255,255,0.2)":"#e2e8f0",color:filter===f?"#fff":"#64748b",padding:"1px 6px",borderRadius:10}}>
                {f==="Todas"?(vessel.tasks||[]).length:f==="Vencidas"?(vessel.tasks||[]).filter(t=>t.status==="overdue").length:f==="Por vencer"?(vessel.tasks||[]).filter(t=>t.status==="due").length:(vessel.tasks||[]).filter(t=>t.status==="done").length}
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
                    <td style={{...s.td,color:task.status==="overdue"?"#dc2626":"#1e293b",fontWeight:task.status==="overdue"?600:400}}>{task.interval==="Por horas"?`${task.dueHours} h motor`:fmtDate(task.nextDue)}</td>
                    <td style={s.td}><span style={{...s.statusPill,background:p.bg,color:p.c}}>{p.l}</span></td>
                    <td style={{...s.td,color:"#94a3b8",fontSize:12,maxWidth:180}}>{task.notes||"—"}</td>
                  </tr>
                  {expanded===task.id && (
                    <tr key={`e${task.id}`}>
                      <td colSpan={8} style={{padding:0,background:"#f0f7ff",borderBottom:"2px solid #bfdbfe"}}>
                        <div style={{padding:"16px 24px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                          {[{l:"Sistema",v:task.system},{l:"Equipo",v:task.equipment},{l:"Intervalo",v:task.interval},{l:"Próx. Venc.",v:task.nextDue},{l:"Asignado",v:task.assigned},{l:"Estado",v:p.l},{l:"Notas",v:task.notes||"—"},{l:"Fotos",v:(task.photos||[]).length>0?`${task.photos.length} foto(s)`:"Sin fotos"},{l:"Creada por",v:task.createdByName?`${task.createdByName}${task.createdByRole==="captain"?" (Capitán)":""}`:"—"}].map((c,i) => (
                            <div key={i} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px"}}>
                              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginBottom:3}}>{c.l}</div>
                              <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{c.v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{padding:"0 24px 16px",display:"flex",gap:8}}>
                          <button onClick={()=>{
                            const updated={...vessel,tasks:(vessel.tasks||[]).map(t=>t.id===task.id?{...t,status:"done"}:t)};
                            updateVessel(updated);setExpanded(null);
                          }} style={{padding:"7px 16px",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",color:"#fff"}}>Completar</button>
                          <button onClick={()=>{
                            const nd=prompt("Nueva fecha (AAAA-MM-DD):",task.nextDue);
                            if(nd){const updated={...vessel,tasks:(vessel.tasks||[]).map(t=>t.id===task.id?{...t,nextDue:nd,status:"ok"}:t)};updateVessel(updated);}
                          }} style={{padding:"7px 14px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",background:"#fff",color:"#1e293b"}}>Reprogramar</button>
                          <button onClick={()=>{
                            if(confirm("¿Eliminar esta tarea?")){const updated={...vessel,tasks:(vessel.tasks||[]).filter(t=>t.id!==task.id)};updateVessel(updated);setExpanded(null);}
                          }} style={{padding:"7px 14px",border:"1.5px solid #fecaca",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",background:"#fff",color:"#dc2626"}}>Eliminar</button>
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
      {showAdd && <AddTaskModal vessel={vessel} updateVessel={updateVessel} onSave={handleAddTask} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddTaskModal({ vessel: vesselProp, updateVessel, onSave, onClose }) {
  const vesselRef = useRef(vesselProp);
  const vessel = vesselRef.current;
  const allSystems = getAllSystems(vessel);
  const [systemId, setSystemId]       = useState("");
  const [equipment, setEquipment]     = useState("");
  const [otherEquip, setOtherEquip]   = useState("");
  const [name, setName]               = useState("");
  const [assigned, setAssigned]       = useState(vessel.captain||vessel.captain||'');
  const [interval, setInterval]       = useState("");
  const [nextDue, setNextDue]         = useState("");
  const [dueHours, setDueHours]       = useState("");      // horas de motor a las que toca
  const [everyHours, setEveryHours]   = useState("");      // cada cuántas horas se repite
  const [notes, setNotes]             = useState("");
  const [errors, setErrors]           = useState({});
  const [showAddSys, setShowAddSys]   = useState(false);
  const [newSysLabel, setNewSysLabel] = useState("");
  const [newSysIcon, setNewSysIcon]   = useState("🔧");
  const [newSysEquip, setNewSysEquip] = useState("");
  const [newSysHours, setNewSysHours] = useState(false);

  const selectedSystem = allSystems.find(s => s.id===systemId);
  const equipList      = systemId ? getEquipmentList(vessel, systemId) : [];
  const crew2Names     = (vessel.crew2||vessel.crew?.map(c=>typeof c==="string"?{name:c,role:"Marinero"}:c)||[]);
  const allAssigned    = crew2Names.length > 0
    ? crew2Names.map(c=>`${c.name} (${c.role||"Tripulación"})`)
    : vessel.captain ? [vessel.captain] : [];

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
    if (interval==="Por horas") {
      if (!dueHours) e.dueHours="Requerido";
    } else if (!nextDue) e.nextDue="Requerido";
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const finalEquip = equipment==="Otro"?otherEquip:equipment;
    if (equipment==="Otro"&&otherEquip.trim()) saveCustomEquip(systemId, otherEquip.trim());
    if (interval==="Por horas") {
      // Recordatorio por horas de motor
      const currentHours = Number(vessel.engineHours)||0;
      const target = Number(dueHours);
      const remaining = target - currentHours;
      let status="ok"; if(remaining<=0)status="overdue"; else if(remaining<=20)status="due";
      onSave({systemId,system:selectedSystem?.label||systemId,equipment:finalEquip,name,assigned,interval,
        dueHours:target, everyHours:Number(everyHours)||null, nextDue:null, status,notes,photos:[]});
    } else {
      const today=new Date(),nd=new Date(nextDue),diff=Math.round((nd-today)/(1000*60*60*24));
      let status="ok"; if(diff<0)status="overdue"; else if(diff<=14)status="due";
      onSave({systemId,system:selectedSystem?.label||systemId,equipment:finalEquip,name,assigned,interval,nextDue,status,notes,photos:[]});
    }
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:580}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>Nueva Tarea</div>
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
                <option value="">Seleccionar...</option>
                {allAssigned.map(p=><option key={p} value={p}>{p}</option>)}
                <option value="Otro">Otro</option>
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

          {interval==="Por horas" ? (
            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:14}}>
              <div style={{fontSize:11,color:"#0369a1",marginBottom:10,fontWeight:600}}>Motor actual: {Number(vessel.engineHours)||0} horas. El recordatorio se activará según las horas de motor que registres en la bitácora.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={s.label}>Toca a las (horas motor) <span style={{color:"#dc2626"}}>*</span></label>
                  <input type="number" value={dueHours} onChange={e=>setDueHours(e.target.value)} placeholder={`Ej: ${(Number(vessel.engineHours)||0)+100}`} style={{...s.input,borderColor:errors.dueHours?"#dc2626":"#e2e8f0"}}/>
                  {errors.dueHours&&<div style={s.errMsg}>{errors.dueHours}</div>}
                </div>
                <div>
                  <label style={s.label}>Repetir cada (horas)</label>
                  <input type="number" value={everyHours} onChange={e=>setEveryHours(e.target.value)} placeholder="Ej: 100" style={s.input}/>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label style={s.label}>Próximo Vencimiento <span style={{color:"#dc2626"}}>*</span></label>
              <input type="date" value={nextDue} onChange={e=>setNextDue(e.target.value)} style={{...s.input,borderColor:errors.nextDue?"#dc2626":"#e2e8f0"}}/>
              {errors.nextDue&&<div style={s.errMsg}>{errors.nextDue}</div>}
            </div>
          )}

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
function LogPage({ vessel, updateVessel, addLogEntry }) {
  const [showModal, setShowModal]       = useState(false);
  const [editEntry, setEditEntry]       = useState(null);
  const [filter, setFilter]             = useState("Todos");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");

  const filtered = filter==="Todos" ? (vessel.log||[]) : (vessel.log||[]).filter(e=>e.type===filter);

  const saveEntry = useCallback((entry) => {
    if (editEntry) {
      updateVessel({...vessel, log: (vessel.log||[]).map(e => e.id === entry.id ? entry : e)});
    } else {
      addLogEntry(entry);
    }
    setShowModal(false); setEditEntry(null);
  }, [vessel, editEntry, updateVessel, addLogEntry]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    // Delete from Supabase
    await supabase.from("log_entries").delete().eq("id", deleteTarget.id);
    updateVessel({...vessel, log: (vessel.log||[]).filter(e => e.id !== deleteTarget.id)});
    setDeleteTarget(null); setDeleteReason("");
  };

  return (
    <div style={{padding:"24px 28px"}}>
      {/* Delete confirmation modal */}
      {deleteTarget&&(
        <div style={s.modalOverlay} onClick={()=>{setDeleteTarget(null);setDeleteReason("");}}>
          <div style={{...s.modalBox,maxWidth:440}} onClick={e=>e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{fontSize:15,fontWeight:700,color:"#dc2626"}}>🗑 Eliminar Entrada</div>
              <button onClick={()=>{setDeleteTarget(null);setDeleteReason("");}} style={s.modalClose}>✕</button>
            </div>
            <div style={{padding:"20px 24px"}}>
              <div style={{background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:13,color:"#7f1d1d"}}>
                <strong>{deleteTarget.type}</strong> — {deleteTarget.date ? fmtDate(deleteTarget.date) : ""}<br/>
                <span style={{color:"#64748b"}}>{deleteTarget.desc||deleteTarget.item||deleteTarget.dest||""}</span>
              </div>
              <label style={s.label}>Razón de eliminación <span style={{color:"#dc2626"}}>*</span></label>
              <textarea value={deleteReason} onChange={e=>setDeleteReason(e.target.value)}
                placeholder="Ej: Error al ingresar, duplicado, datos incorrectos..."
                rows={3} style={{...s.input,resize:"vertical",marginTop:4}}/>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Esta acción no se puede deshacer.</div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.btnOutline} onClick={()=>{setDeleteTarget(null);setDeleteReason("");}}>Cancelar</button>
              <button style={{...s.btnPrimary,background:"#dc2626",opacity:deleteReason.trim().length<3?0.4:1}}
                onClick={()=>{if(deleteReason.trim().length>=3)confirmDelete();}}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

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
              <tr key={i} style={{...s.trow,":hover":{background:"#f8fafc"}}}>
                <td style={{...s.td,color:"#64748b",whiteSpace:"nowrap"}}>{fmtDate(e.date)}</td>
                <td style={s.td}><span style={{background:LOG_COLOR[e.type]+"18",color:LOG_COLOR[e.type],padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{e.type}{e.serviceType?` · ${e.serviceType}`:""}</span></td>
                <td style={{...s.td,color:"#334155",maxWidth:320}}>
                  {e.type==="Salida"?`${e.dest||""} · ${e.persons||""}p · ${e.deptTime||"—"} → ${e.arrTime||"Pendiente"}`:e.type==="Compra"?`${e.item||""} · $${e.costUSD||0}`:e.desc||""}
                </td>
                <td style={s.td}>{(e.photos||[]).length>0?(
  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
    {(e.photos||[]).slice(0,3).map((p,i)=>(
      <a key={i} href={p.url||p} target="_blank" rel="noreferrer">
        <img src={p.url||p} alt="" style={{width:32,height:32,objectFit:"cover",borderRadius:4,border:"1px solid #e2e8f0"}}/>
      </a>
    ))}
    {(e.photos||[]).length>3&&<span style={{fontSize:10,color:"#64748b",alignSelf:"center"}}>+{(e.photos||[]).length-3}</span>}
  </div>
):"—"}</td>
                <td style={{...s.td,color:"#64748b"}}>{e.performedBy||"—"}</td>
                <td style={{...s.td,display:"flex",gap:6}}>
                  <button onClick={()=>{setEditEntry(e);setShowModal(true);}} style={{...s.btnOutline,padding:"3px 10px",fontSize:11}}>✏️</button>
                  <button onClick={()=>{setDeleteTarget(e);setDeleteReason("");}} style={{padding:"3px 10px",border:"1.5px solid #fecaca",borderRadius:6,background:"#fff",color:"#dc2626",cursor:"pointer",fontSize:11}}>🗑</button>
                </td>
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
function LogEntryModal({ vessel: vesselProp, initial, onSave, onClose }) {
  const vesselRef = useRef(vesselProp);
  const vessel = vesselRef.current;
  const today = todayISO();
  const [type,setType]               = useState(initial?.type||"");
  const [date,setDate]               = useState(initial?.date||today);
  const [desc,setDesc]               = useState(initial?.desc||"");
  const [performedBy,setPerformedBy] = useState(initial?.performedBy||"");
  const [photos,setPhotos]           = useState(initial?.photos||[]);
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
  const [engOut,setEngOut]           = useState(initial?.engineHrsOut||{});
  const [engIn,setEngIn]             = useState(initial?.engineHrsIn||{});
  const [genOut,setGenOut]           = useState(initial?.genHrsOut||{});
  const [genIn,setGenIn]             = useState(initial?.genHrsIn||{});
  const [clima,setClima]             = useState(initial?.salidaClima||"");
  const [item,setItem]               = useState(initial?.item||"");
  const [brand,setBrand]             = useState(initial?.brand||"");
  const [model2,setModel2]           = useState(initial?.model2||"");
  const [partNum,setPartNum]         = useState(initial?.partNum||"");
  const [costUSD,setCostUSD]         = useState(initial?.costUSD||"");
  const [costBs,setCostBs]           = useState(initial?.costBs||"");
  const [payment,setPayment]         = useState(initial?.payment||"");

  const allSystems    = getAllSystems(vessel);
  const selectedSys   = allSystems.find(s=>s.id===systemId);
  const equipList     = systemId ? getEquipmentList(vessel, systemId) : [];
  const needsHours    = selectedSys?.trackHours && equipment && equipment!=="Otro";
  const provNames     = (vessel.providers||[]).map(p=>`${p.firstName} ${p.lastName} (${p.company})`);
  const crew2Names    = (vessel.crew2||vessel.crew?.map(c=>typeof c==="string"?{name:c,role:"Marinero"}:c)||[]);
  const crewOptions   = crew2Names.map(c=>`${c.name} (${c.role||"Tripulación"})`).filter(Boolean);
  // Servicio: crew + providers. Rest: crew only
  const allPerformed  = type==="Servicio"
    ? [...crewOptions, ...provNames, "Otro"].filter(Boolean)
    : [...crewOptions, "Otro"].filter(Boolean);

  const validate = () => {
    const e={};
    if (!type) e.type="Selecciona un tipo";
    if (!date) e.date="Requerido";
    if (type==="Servicio"&&!serviceType) e.serviceType="Requerido";
    if (type==="Servicio"&&!systemId)    e.system="Requerido";
    if (type==="Servicio"&&!equipment)   e.equipment="Requerido";
    if (type==="Combustible"&&!fuelQty)  e.fuelQty="Requerido";
    if (["Inspección","Servicio","Combustible"].includes(type)&&!desc.trim()) e.desc="Descripción requerida";
    // photos optional now — real uploads
    if (type==="Compra"&&!item.trim()) e.item="Requerido";
    setErrors(e); return Object.keys(e).length===0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const finalEquip = equipment==="Otro"?otherEquip:equipment;
    const base = {id:initial?.id||Date.now(),date,type,desc,performedBy,photos:photos||[]};
    let entry = {...base};
    if (type==="Servicio")    entry={...entry,serviceType,systemId,equipment:finalEquip,equipHours:needsHours?equipHours:null};
    if (type==="Combustible") entry={...entry,fuelQty:parseFloat(fuelQty),fuelUnit};
    if (type==="Salida")      entry={...entry,ownerAboard,crewSel,persons,dest,deptTime,arrTime,fuelOut,fuelIn,engineHrsOut:engOut,engineHrsIn:engIn,genHrsOut:genOut,genHrsIn:genIn,salidaClima:clima};
    if (type==="Compra")      entry={...entry,item,brand,model2,partNum,costUSD:parseFloat(costUSD)||0,costBs:parseFloat(costBs)||0,payment:payment};
    // Update engine/gen hours from inspection
    if (type==="Inspección"&&(systemId==="motores"||systemId==="generador")) {
      entry={...entry,engineHrsOut:engOut,genHrsOut:genOut};
    }
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
            {/* Engine/Gen hours for inspection */}
            {(systemId==="motores"||systemId==="generador")&&(
              <div>
                <label style={s.label}>Horas actuales del equipo</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                  {systemId==="motores"&&getMotorLabels(vessel).map(m=>(
                    <div key={m}><label style={{...s.label,fontSize:11,color:"#64748b"}}>{m}</label>
                    <input type="number" value={engOut[m]||""} onChange={e=>setEngOut(v=>({...v,[m]:e.target.value}))} placeholder="Horas" style={s.input}/></div>
                  ))}
                  {systemId==="generador"&&getGenLabels(vessel).map(g=>(
                    <div key={g}><label style={{...s.label,fontSize:11,color:"#64748b"}}>{g}</label>
                    <input type="number" value={genOut[g]||""} onChange={e=>setGenOut(v=>({...v,[g]:e.target.value}))} placeholder="Horas" style={s.input}/></div>
                  ))}
                </div>
                <div style={{fontSize:11,color:"#0369a1",marginTop:4}}>💡 Las horas se actualizarán en el dashboard automáticamente</div>
              </div>
            )}
            <div>
              <label style={s.label}>Realizado por</label>
              <select value={performedBy} onChange={e=>setPerformedBy(e.target.value)} style={s.input}>
                <option value="">Seleccionar...</option>
                {allPerformed.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <PhotoFld photos={photos} setPhotos={setPhotos} err={errors.photos} userId={vessel.owner_id} vesselId={vessel.id}/>
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
            <PhotoFld photos={photos} setPhotos={setPhotos} err={errors.photos} userId={vessel.owner_id} vesselId={vessel.id}/>
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
                <div><label style={s.label}>Tripulación</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>{(vessel.crew||[]).map(c=><button key={c} onClick={()=>setCrewSel(cs=>cs.includes(c)?cs.filter(x=>x!==c):[...cs,c])} style={{...s.typeChip,background:crewSel.includes(c)?"#2563eb22":"#f8fafc",borderColor:crewSel.includes(c)?"#2563eb":"#e2e8f0",color:crewSel.includes(c)?"#2563eb":"#64748b",fontWeight:crewSel.includes(c)?700:400}}>{c}</button>)}</div></div>
                <div>
                  <label style={s.label}>Combustible al salir</label>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{flex:"0 0 90px"}}><label style={{...s.label,marginBottom:4}}>Unidad</label><select value={fuelUnit} onChange={e=>setFuelUnit(e.target.value)} style={s.input}>{["gal","lts","%"].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                    <div style={{flex:1}}><label style={{...s.label,marginBottom:4}}>Cantidad</label><input type="number" value={fuelOut} onChange={e=>setFuelOut(e.target.value)} style={s.input}/></div>
                  </div>
                </div>
                {getMotorLabels(vessel).length>0&&<div>
                  <label style={s.label}>Horas de Motores al salir</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                    {getMotorLabels(vessel).map(m=><div key={m}><label style={{...s.label,fontSize:11,color:"#64748b"}}>{m}</label><input type="number" value={engOut[m]||""} onChange={e=>setEngOut(v=>({...v,[m]:e.target.value}))} placeholder="Ej: 1243" style={s.input}/></div>)}
                  </div>
                </div>}
                {getGenLabels(vessel).length>0&&<div>
                  <label style={s.label}>Horas de Generadores al salir</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                    {getGenLabels(vessel).map(g=><div key={g}><label style={{...s.label,fontSize:11,color:"#64748b"}}>{g}</label><input type="number" value={genOut[g]||""} onChange={e=>setGenOut(v=>({...v,[g]:e.target.value}))} placeholder="Ej: 342" style={s.input}/></div>)}
                  </div>
                </div>}
              </div>
            </div>
            <div style={{background:"#f0fdf4",borderRadius:10,padding:"14px 16px",border:"1px solid #bbf7d0"}}>
              <div style={{fontWeight:700,fontSize:12,color:"#15803d",marginBottom:12}}>⚓ REGRESO <span style={{fontSize:10,fontWeight:400,color:"#64748b"}}>(puede completarse después)</span></div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={s.label}>Hora de Llegada</label><input type="time" value={arrTime} onChange={e=>setArrTime(e.target.value)} style={s.input}/></div>
                  <div><label style={s.label}>Combustible al regresar ({fuelUnit})</label><input type="number" value={fuelIn} onChange={e=>setFuelIn(e.target.value)} style={s.input}/></div>
                </div>
                {getMotorLabels(vessel).length>0&&<div>
                  <label style={s.label}>Horas de Motores al regresar</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                    {getMotorLabels(vessel).map(m=><div key={m}><label style={{...s.label,fontSize:11,color:"#64748b"}}>{m}</label><input type="number" value={engIn[m]||""} onChange={e=>setEngIn(v=>({...v,[m]:e.target.value}))} placeholder="Ej: 1248" style={s.input}/></div>)}
                  </div>
                </div>}
                {getGenLabels(vessel).length>0&&<div>
                  <label style={s.label}>Horas de Generadores al regresar</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                    {getGenLabels(vessel).map(g=><div key={g}><label style={{...s.label,fontSize:11,color:"#64748b"}}>{g}</label><input type="number" value={genIn[g]||""} onChange={e=>setGenIn(v=>({...v,[g]:e.target.value}))} placeholder="Ej: 345" style={s.input}/></div>)}
                  </div>
                </div>}
              </div>
            </div>
            <div><label style={s.label}>Observaciones</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{...s.input,resize:"vertical"}}/></div>
            <PhotoFld photos={photos} setPhotos={setPhotos} userId={vessel.owner_id} vesselId={vessel.id}/>
          </>)}

          {type==="Compra"&&(<>
            <div><label style={s.label}>Descripción <span style={{color:"#dc2626"}}>*</span></label><input value={item} onChange={e=>setItem(e.target.value)} placeholder="Ej: Filtro de aceite marino" style={{...s.input,borderColor:errors.item?"#dc2626":"#e2e8f0"}}/>{errors.item&&<div style={s.errMsg}>{errors.item}</div>}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={s.label}>Marca</label><input value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Ej: Fleetguard" style={s.input}/></div>
              <div><label style={s.label}>Modelo</label><input value={model2} onChange={e=>setModel2(e.target.value)} placeholder="Ej: FF5052" style={s.input}/></div>
            </div>
            <div><label style={s.label}>Número de Parte</label><input value={partNum} onChange={e=>setPartNum(e.target.value)} placeholder="Ej: FF5052-A" style={s.input}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={s.label}>Costo USD</label><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#64748b"}}>$</span><input type="number" value={costUSD} onChange={e=>setCostUSD(e.target.value)} placeholder="0.00" style={s.input}/></div></div>
              <div><label style={s.label}>Costo Bs</label><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#64748b"}}>Bs</span><input type="number" value={costBs} onChange={e=>setCostBs(e.target.value)} placeholder="0.00" style={s.input}/></div></div>
            </div>
            <div><label style={s.label}>Método de Pago</label><select value={payment} onChange={e=>setPayment(e.target.value)} style={s.input}><option value="">Seleccionar...</option>{PAYMENT_METHODS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
            <div><label style={s.label}>Notas adicionales</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="Proveedor, observaciones..." style={{...s.input,resize:"vertical"}}/></div>
            <PhotoFld photos={photos} setPhotos={setPhotos} label="Foto del recibo" userId={vessel.owner_id} vesselId={vessel.id}/>
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

function PhotoFld({ photos, setPhotos, err, label="Fotos", userId, vesselId }) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files||[]);
    if (!files.length) return;
    setUploading(true);
    const uploaded = [...(photos||[])];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${userId||"anon"}/${vesselId||"boat"}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("bitacora-fotos").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("bitacora-fotos").getPublicUrl(path);
        uploaded.push({ url: urlData.publicUrl, path, name: file.name });
      }
    }
    setPhotos(uploaded);
    setUploading(false);
  };

  const removePhoto = async (idx) => {
    const photo = photos[idx];
    if (photo?.path) await supabase.storage.from("bitacora-fotos").remove([photo.path]);
    setPhotos((photos||[]).filter((_,i)=>i!==idx));
  };

  return (
    <div>
      <label style={s.label}>{label} <span style={{color:"#94a3b8",fontWeight:400}}>(opcional)</span></label>
      {/* Preview grid */}
      {(photos||[]).length > 0 && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          {(photos||[]).map((p,i) => (
            <div key={i} style={{position:"relative",width:72,height:72}}>
              <img src={p.url||p} alt="" style={{width:72,height:72,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"}}/>
              <button onClick={()=>removePhoto(i)} style={{position:"absolute",top:-6,right:-6,background:"#dc2626",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {/* Upload button */}
      <label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:`2px dashed ${err?"#dc2626":"#bae6fd"}`,borderRadius:10,cursor:"pointer",background:"#f0f9ff",color:"#0369a1"}}>
        <span style={{fontSize:20}}>{uploading?"⏳":"📷"}</span>
        <div>
          <div style={{fontSize:12,fontWeight:600}}>{uploading?"Subiendo fotos...":"Agregar fotos"}</div>
          <div style={{fontSize:10,color:"#64748b",marginTop:1}}>JPG, PNG, HEIC · Múltiples</div>
        </div>
        <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleFiles} disabled={uploading}/>
      </label>
      {err&&<div style={s.errMsg}>{err}</div>}
    </div>
  );
}
function RecordsPage({ vessel }) {
  const [mainFilter,setMainFilter] = useState("Servicio");
  const [subFilter,setSubFilter]   = useState("Todos");
  const [showReport,setShowReport] = useState(false);
  const serviceLog  = (vessel.log||[]).filter(e=>e.type==="Servicio");
  const inspLog     = (vessel.log||[]).filter(e=>e.type==="Inspección");
  const fuelLog     = (vessel.log||[]).filter(e=>e.type==="Combustible");
  const purchaseLog = (vessel.log||[]).filter(e=>e.type==="Compra");
  const totalCost   = (vessel.records||[]).reduce((a,r)=>a+r.cost,0);
  const totalPurch  = purchaseLog.reduce((a,e)=>a+(e.costUSD||0),0);
  const filteredSvc = subFilter==="Todos"?serviceLog:serviceLog.filter(e=>e.serviceType===subFilter);
  return (
    <div style={{padding:"24px 28px"}}>
      <div style={s.toolbar}>
        <h2 style={s.toolbarTitle}>Records — {vessel.name}</h2>
        <button style={{...s.btnPrimary,background:"#7c3aed"}} onClick={()=>setShowReport(true)}>📊 Generar Reporte</button>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[{label:"Servicios",val:serviceLog.length,color:"#2563eb",key:"Servicio"},{label:"Inspecciones",val:inspLog.length,color:"#16a34a",key:"Inspecciones"},{label:"Combustible",val:fuelLog.length,color:"#d97706",key:"Combustible"},{label:"Compras",val:purchaseLog.length,color:"#0891b2",sub:`$${totalPurch.toFixed(2)}`,key:"Compras"},{label:"Histórico",val:(vessel.records||[]).length,color:"#7c3aed",sub:`$${totalCost.toLocaleString("en-US",{minimumFractionDigits:2})}`,key:"Historico"}].map(item=>(
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
        <RecordTable rows={purchaseLog.map(e=>({Fecha:e.date,Descripción:e.item||"—",Marca:e.brand||"—",Modelo:e.model2||"—","N° Parte":e.partNum||"—",USD:`$${e.costUSD||0}`,Bs:e.costBs?`Bs ${e.costBs}`:"—",Pago:e.payment&&e.payment.startsWith("P:")?"—":e.payment||"—",Fotos:(e.photos||[]).length>0?`📷 ${e.photos.length}`:"—"}))}/>
      </>)}
      {mainFilter==="Historico"&&(<>
        <div style={{marginBottom:12,padding:"10px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,fontSize:13}}>Costo total histórico: <strong style={{color:"#16a34a"}}>${totalCost.toLocaleString("en-US",{minimumFractionDigits:2})}</strong></div>
        <RecordTable rows={(vessel.records||[]).map(r=>({Fecha:r.date,Tipo:r.type,Equipo:r.equipment,Horas:r.hours,Descripción:r.desc,"Realizado por":r.performedBy,Costo:`$${r.cost.toLocaleString("en-US",{minimumFractionDigits:2})}`}))}/>
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

  const REPORT_TYPES = [
    {key:"service", icon:"🔧", label:"Servicios",        desc:"Preventivo, reactivo, reparaciones"},
    {key:"inspect", icon:"🔍", label:"Inspecciones",     desc:"Todas las inspecciones registradas"},
    {key:"fuel",    icon:"⛽", label:"Combustible",      desc:"Historial de repostajes"},
    {key:"salidas", icon:"🚢", label:"Salidas al Mar",   desc:"Destinos, tripulación, horas"},
    {key:"costs",   icon:"💰", label:"Costos y Compras", desc:"Gastos y repuestos comprados"},
    {key:"tasks",   icon:"☑", label:"Estado de Tareas", desc:"Pendientes, vencidas, completadas"},
    {key:"log",     icon:"📓", label:"Bitácora Completa",desc:"Todas las entradas del período"},
    {key:"sale",    icon:"⚓", label:"Para Venta",       desc:"Historial completo para compradores"},
    {key:"insurance",icon:"🛡",label:"Para Seguro",      desc:"Mantenimientos y estado del barco"},
  ];
  const toggle = k => setSel(s => s.includes(k) ? s.filter(x=>x!==k) : [...s,k]);

  const parseInputDate = (d) => {
    if (!d) return null;
    if (d.includes("/")) { const [day,m,y]=d.split("/"); return `${y}-${m.padStart(2,"0")}-${day.padStart(2,"0")}`; }
    return d;
  };
  const filterByDate = (items, dateField) => {
    const f = parseInputDate(from);
    const t = parseInputDate(to);
    if (!f && !t) return items;
    return items.filter(i => {
      const d = i[dateField] || i.date;
      if (!d) return true;
      if (f && d < f) return false;
      if (t && d > t) return false;
      return true;
    });
  };

  const generateHTML = () => {
    const today = new Date().toLocaleDateString("es-VE", {day:"2-digit",month:"2-digit",year:"numeric"});
    const d = vessel.details || {};
    const filteredLog   = filterByDate(vessel.log||[], "date");
    const filteredTasks = vessel.tasks || [];
    const services      = filteredLog.filter(e=>e.type==="Servicio");
    const inspections   = filteredLog.filter(e=>e.type==="Inspección");
    const fuelLog       = filteredLog.filter(e=>e.type==="Combustible");
    const salidas       = filteredLog.filter(e=>e.type==="Salida");
    const compras       = filteredLog.filter(e=>e.type==="Compra");
    const totalCost     = compras.reduce((a,e)=>a+(e.costUSD||0),0);
    const totalFuel     = fuelLog.reduce((a,e)=>a+(parseFloat(e.fuelQty)||0),0);
    const fmtD = (d) => { if(!d)return"—"; const p=d.split("-"); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d; };

    const CSS = `
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff;font-size:13px;line-height:1.5;}
      @media print{.no-print{display:none!important;}@page{margin:0;size:A4;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      table{width:100%;border-collapse:collapse;margin-bottom:32px;border-radius:10px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.07);}
      thead tr{background:linear-gradient(90deg,#1e3a5f,#1d4ed8);}
      th{padding:11px 16px;text-align:left;color:#bfdbfe;font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;}
      td{padding:10px 16px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:12.5px;vertical-align:middle;}
      tr:last-child td{border-bottom:none;}
      tr:hover td{background:#f8fafc;}
      .sec-header{display:flex;align-items:center;gap:10px;margin:36px 0 16px;}
      .sec-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
      .sec-label{font-size:13px;font-weight:700;color:#0f172a;letter-spacing:0.02em;}
      .sec-count{font-size:11px;color:#64748b;margin-top:1px;}
      .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
      .badge-red{background:#fee2e2;color:#dc2626;}
      .badge-yellow{background:#fef3c7;color:#d97706;}
      .badge-green{background:#dcfce7;color:#16a34a;}
      .badge-blue{background:#dbeafe;color:#1d4ed8;}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:16px;}
      .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:36px;}
      .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;text-align:center;}
      .stat-val{font-size:26px;font-weight:800;color:#1e3a8a;line-height:1;}
      .stat-lbl{font-size:11px;color:#64748b;margin-top:6px;font-weight:500;}
      .fuel-bar-wrap{background:#e2e8f0;border-radius:4px;height:6px;margin-top:6px;overflow:hidden;}
      .fuel-bar{height:6px;border-radius:4px;background:linear-gradient(90deg,#0ea5e9,#2563eb);}
      .td-bold{font-weight:600;color:#0f172a;}
      .td-money{font-weight:700;color:#16a34a;}
      .td-date{color:#64748b;white-space:nowrap;}
      .divider{height:1px;background:#f1f5f9;margin:8px 0;}
    `;

    const sectionHeader = (icon, label, count, color="#dbeafe", iconBg="#1d4ed8") =>
      `<div class="sec-header">
        <div class="sec-icon" style="background:${color};color:${iconBg};">${icon}</div>
        <div>
          <div class="sec-label">${label}</div>
          <div class="sec-count">${count}</div>
        </div>
      </div>`;

    let sections = "";

    // ── FUEL ──────────────────────────────────────────────────────────────────
    if (sel.includes("fuel") && fuelLog.length > 0) {
      sections += sectionHeader("⛽","Historial de Combustible",`${fuelLog.length} repostajes · Total acumulado: ${totalFuel.toFixed(0)} ${fuelLog[0]?.fuelUnit||"gal"}`,"#fef3c7","#d97706");
      sections += `<table>
        <thead><tr>
          <th>Fecha</th><th>Cantidad</th><th>Unidad</th><th>Notas / Proveedor</th>
        </tr></thead>
        <tbody>
          ${fuelLog.map((e,i)=>`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td class="td-date">${fmtD(e.date)}</td>
            <td class="td-bold" style="font-size:15px;">${e.fuelQty||"—"}</td>
            <td>${e.fuelUnit||"—"}</td>
            <td style="color:#64748b;">${e.desc||"—"}</td>
          </tr>`).join("")}
          <tr style="background:#fff7ed;border-top:2px solid #f59e0b;">
            <td style="font-weight:700;color:#d97706;padding:12px 16px;">TOTAL</td>
            <td class="td-bold" style="font-size:18px;color:#d97706;">${totalFuel.toFixed(0)}</td>
            <td style="color:#d97706;font-weight:600;">${fuelLog[0]?.fuelUnit||"gal"}</td>
            <td></td>
          </tr>
        </tbody>
      </table>`;
    }

    // ── SERVICES ──────────────────────────────────────────────────────────────
    if (sel.includes("service") && services.length > 0) {
      const prev = services.filter(e=>e.serviceType==="Preventivo").length;
      const reac = services.filter(e=>e.serviceType==="Reactivo").length;
      const rep  = services.filter(e=>e.serviceType==="Reparación").length;
      sections += sectionHeader("🔧","Registro de Servicios",`${services.length} servicios — ${prev} preventivos · ${reac} reactivos · ${rep} reparaciones`,"#dbeafe","#1d4ed8");
      sections += `<table>
        <thead><tr>
          <th>Fecha</th><th>Tipo</th><th>Sistema / Equipo</th><th>Descripción</th><th>Realizado por</th>
        </tr></thead>
        <tbody>
          ${services.map((e,i)=>`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td class="td-date">${fmtD(e.date)}</td>
            <td><span class="badge ${e.serviceType==="Preventivo"?"badge-green":e.serviceType==="Reactivo"?"badge-yellow":"badge-red"}">${e.serviceType||"—"}</span></td>
            <td class="td-bold">${e.equipment||"—"}</td>
            <td style="max-width:280px;">${e.desc||"—"}</td>
            <td style="color:#64748b;">${e.performedBy||"—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    }

    // ── INSPECTIONS ───────────────────────────────────────────────────────────
    if (sel.includes("inspect") && inspections.length > 0) {
      sections += sectionHeader("🔍","Inspecciones Realizadas",`${inspections.length} inspecciones`,"#dcfce7","#16a34a");
      sections += `<table>
        <thead><tr><th>Fecha</th><th>Equipo / Sistema</th><th>Descripción</th><th>Realizado por</th></tr></thead>
        <tbody>
          ${inspections.map((e,i)=>`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td class="td-date">${fmtD(e.date)}</td>
            <td class="td-bold">${e.equipment||"—"}</td>
            <td>${e.desc||"—"}</td>
            <td style="color:#64748b;">${e.performedBy||"—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    }

    // ── SALIDAS ───────────────────────────────────────────────────────────────
    if (sel.includes("salidas") && salidas.length > 0) {
      const totalPersons = salidas.reduce((a,e)=>a+(parseInt(e.persons)||0),0);
      sections += sectionHeader("🚢","Salidas al Mar",`${salidas.length} salidas · ${totalPersons} personas-viaje`,"#ede9fe","#7c3aed");
      sections += `<table>
        <thead><tr><th>Fecha</th><th>Destino</th><th>Personas</th><th>Salida</th><th>Regreso</th><th>Clima</th><th>Dueño</th></tr></thead>
        <tbody>
          ${salidas.map((e,i)=>`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td class="td-date">${fmtD(e.date)}</td>
            <td class="td-bold">${e.dest||"—"}</td>
            <td style="text-align:center;font-weight:600;">${e.persons||"—"}</td>
            <td>${e.deptTime||"—"}</td>
            <td>${e.arrTime||"<span style='color:#d97706'>Pendiente</span>"}</td>
            <td style="color:#64748b;">${e.salidaClima||"—"}</td>
            <td style="text-align:center;">${e.ownerAboard?"<span class='badge badge-green'>Sí</span>":"<span class='badge' style='background:#f1f5f9;color:#64748b;'>No</span>"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    }

    // ── COSTS ─────────────────────────────────────────────────────────────────
    if (sel.includes("costs") && compras.length > 0) {
      sections += sectionHeader("💰","Compras y Gastos",`${compras.length} ítems · Total: $${totalCost.toFixed(2)} USD`,"#dcfce7","#16a34a");
      sections += `<table>
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Marca</th><th>Modelo</th><th>N° Parte</th><th>USD</th><th>Pago</th></tr></thead>
        <tbody>
          ${compras.map((e,i)=>`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td class="td-date">${fmtD(e.date)}</td>
            <td class="td-bold">${e.item||"—"}</td>
            <td style="color:#64748b;">${e.brand||"—"}</td>
            <td style="color:#64748b;">${e.model2||"—"}</td>
            <td style="font-family:monospace;font-size:11px;color:#475569;">${e.partNum||"—"}</td>
            <td class="td-money">$${(e.costUSD||0).toFixed(2)}</td>
            <td><span class="badge badge-blue">${e.payment||"—"}</span></td>
          </tr>`).join("")}
          <tr style="background:#f0fdf4;">
            <td colspan="5" style="font-weight:700;color:#15803d;padding:12px 16px;">TOTAL</td>
            <td class="td-money" style="font-size:16px;">$${totalCost.toFixed(2)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>`;
    }

    // ── TASKS ─────────────────────────────────────────────────────────────────
    if (sel.includes("tasks")) {
      const overdue = filteredTasks.filter(t=>t.status==="overdue");
      const due     = filteredTasks.filter(t=>t.status==="due");
      const ok      = filteredTasks.filter(t=>t.status==="ok");
      sections += sectionHeader("☑","Estado de Mantenimiento",`${filteredTasks.length} tareas programadas`,"#dbeafe","#1d4ed8");
      sections += `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
        <div class="card" style="border-left:4px solid #dc2626;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#dc2626;">${overdue.length}</div>
          <div style="font-size:12px;color:#dc2626;font-weight:600;margin-top:4px;">Vencidas</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Requieren atención inmediata</div>
        </div>
        <div class="card" style="border-left:4px solid #d97706;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#d97706;">${due.length}</div>
          <div style="font-size:12px;color:#d97706;font-weight:600;margin-top:4px;">Por Vencer</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Próximos 14 días</div>
        </div>
        <div class="card" style="border-left:4px solid #16a34a;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#16a34a;">${ok.length}</div>
          <div style="font-size:12px;color:#16a34a;font-weight:600;margin-top:4px;">Al Día</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Sin pendientes</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Sistema</th><th>Equipo</th><th>Tarea</th><th>Intervalo</th><th>Próx. Venc.</th><th>Estado</th></tr></thead>
        <tbody>
          ${filteredTasks.sort((a,b)=>a.status==="overdue"?-1:b.status==="overdue"?1:0).map((t,i)=>`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td style="color:#64748b;">${t.system||"—"}</td>
            <td class="td-bold">${t.equipment||"—"}</td>
            <td>${t.name||"—"}</td>
            <td style="color:#64748b;">${t.interval||"—"}</td>
            <td class="td-date">${fmtD(t.nextDue)}</td>
            <td><span class="badge ${t.status==="overdue"?"badge-red":t.status==="due"?"badge-yellow":"badge-green"}">${t.status==="overdue"?"Vencido":t.status==="due"?"Por vencer":"Al día"}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    }

    // ── FULL LOG ──────────────────────────────────────────────────────────────
    if (sel.includes("log")) {
      sections += sectionHeader("📓","Bitácora Completa",`${filteredLog.length} entradas registradas`,"#f1f5f9","#475569");
      sections += `<table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Realizado por</th></tr></thead>
        <tbody>
          ${filteredLog.map((e,i)=>{
            const typeColors = {Servicio:"badge-blue",Inspección:"badge-green",Combustible:"badge-yellow",Salida:"#ede9fe color:#7c3aed",Compra:"badge-blue"};
            const detail = e.type==="Salida"?`${e.dest||""} · ${e.persons||""}p`:e.type==="Compra"?e.item||"":e.desc||"";
            return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
              <td class="td-date">${fmtD(e.date)}</td>
              <td><span class="badge badge-blue">${e.type}${e.serviceType?` · ${e.serviceType}`:""}</span></td>
              <td class="td-bold">${detail}</td>
              <td style="color:#64748b;">${e.performedBy||"—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
    }

    // ── VESSEL INFO (for sale/insurance) ─────────────────────────────────────
    if (sel.includes("sale") || sel.includes("insurance")) {
      sections += sectionHeader("📋","Información Técnica de la Embarcación","Datos del registro oficial","#f1f5f9","#475569");
      sections += `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div class="card">
          <div style="font-size:11px;font-weight:700;color:#0ea5e9;letter-spacing:0.1em;margin-bottom:12px;">IDENTIFICACIÓN</div>
          ${[["Nombre",vessel.name],["Fabricante",d.manufacturer],["Modelo",d.model],["Año",d.year],["Serial (HIN)",d.hin],["USCG #",d.uscg]].map(([k,v])=>`
            <div class="divider"></div>
            <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;padding:4px 0;">
              <span style="font-size:11px;color:#94a3b8;">${k}</span>
              <span style="font-size:12px;font-weight:600;color:#0f172a;">${v||"—"}</span>
            </div>`).join("")}
        </div>
        <div class="card">
          <div style="font-size:11px;font-weight:700;color:#0ea5e9;letter-spacing:0.1em;margin-bottom:12px;">DIMENSIONES</div>
          ${[["Puerto Base",d.homePort],["Eslora",d.loa],["Manga",d.beam],["Calado",d.draft],["Desplazamiento",d.displacement],["Tipo de Casco",d.hullType]].map(([k,v])=>`
            <div class="divider"></div>
            <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;padding:4px 0;">
              <span style="font-size:11px;color:#94a3b8;">${k}</span>
              <span style="font-size:12px;font-weight:600;color:#0f172a;">${v||"—"}</span>
            </div>`).join("")}
        </div>
      </div>`;
    }

    // ── FULL HTML ─────────────────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reporte — ${vessel.name} — ${today}</title>
  <style>${CSS}</style>
</head>
<body>
  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#0a1628 0%,#1e3a8a 60%,#0ea5e9 100%);padding:40px 56px;color:#fff;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.04);"></div>
    <div style="position:absolute;bottom:-60px;left:200px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.03);"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;">
      <div>
        <div style="font-size:10px;letter-spacing:0.2em;opacity:0.6;margin-bottom:8px;text-transform:uppercase;">Reporte Oficial de Embarcación</div>
        <div style="font-size:32px;font-weight:900;letter-spacing:-1px;margin-bottom:4px;">Carive<span style="color:#38bdf8;">.VZ</span></div>
        <div style="font-size:13px;opacity:0.7;">Gestión inteligente de embarcaciones marinas</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:26px;font-weight:800;margin-bottom:4px;">${vessel.name}</div>
        <div style="font-size:13px;opacity:0.75;margin-bottom:2px;">${vessel.type||""} · ${vessel.marina||""}</div>
        ${vessel.captain?`<div style="font-size:12px;opacity:0.6;">Cap. ${vessel.captain}</div>`:""}
        <div style="font-size:11px;opacity:0.5;margin-top:8px;">Generado: ${today}</div>
        ${from||to?`<div style="font-size:11px;opacity:0.5;">Período: ${from?fmtD(from):"inicio"} → ${to?fmtD(to):"hoy"}</div>`:""}
      </div>
    </div>
  </div>

  <!-- SUMMARY STATS -->
  <div style="padding:24px 56px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-val">${(vessel.log||[]).length}</div>
        <div class="stat-lbl">📋 Entradas Bitácora</div>
      </div>
      <div class="stat">
        <div class="stat-val">${(vessel.tasks||[]).filter(t=>t.status==="overdue").length}</div>
        <div class="stat-lbl" style="color:#dc2626;">⚠ Tareas Vencidas</div>
      </div>
      <div class="stat">
        <div class="stat-val" style="font-size:20px;">$${totalCost.toFixed(0)}</div>
        <div class="stat-lbl">💰 Total Compras USD</div>
      </div>
      <div class="stat">
        <div class="stat-val">${salidas.length}</div>
        <div class="stat-lbl">🚢 Salidas al Mar</div>
      </div>
    </div>
  </div>

  <!-- CONTENT -->
  <div style="padding:32px 56px;">
    ${sections || `<div style="text-align:center;padding:60px 0;color:#94a3b8;">
      <div style="font-size:40px;margin-bottom:16px;">📄</div>
      <div style="font-size:16px;font-weight:600;color:#475569;">Sin secciones seleccionadas</div>
    </div>`}
  </div>

  <!-- FOOTER -->
  <div style="background:#0a1628;color:rgba(255,255,255,0.5);padding:20px 56px;display:flex;justify-content:space-between;align-items:center;margin-top:40px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="font-size:14px;font-weight:700;color:#38bdf8;">Carive</div>
      <div style="font-size:11px;">— nautitrack.vercel.app</div>
    </div>
    <div style="font-size:11px;">Documento confidencial · ${vessel.name} · ${today}</div>
  </div>

  <!-- PRINT BUTTON -->
  <div class="no-print" style="position:fixed;bottom:28px;right:28px;display:flex;gap:10px;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.2));">
    <button onclick="window.print()" style="padding:13px 22px;background:linear-gradient(120deg,#2563eb,#0ea5e9);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;">
      🖨️ Imprimir / Guardar PDF
    </button>
    <button onclick="window.close()" style="padding:13px 18px;background:#fff;color:#475569;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;cursor:pointer;">
      ✕
    </button>
  </div>
</body>
</html>`;
  };

  const openReport = () => {
    const html = generateHTML();
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:620}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>📊 Generar Reporte</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{vessel.name}</div>
          </div>
          <button onClick={onClose} style={s.modalClose}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:12,color:"#64748b"}}>Selecciona las secciones que quieres incluir:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {REPORT_TYPES.map(r=>(
              <button key={r.key} onClick={()=>toggle(r.key)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",border:"1.5px solid",borderRadius:8,cursor:"pointer",textAlign:"left",background:sel.includes(r.key)?"#eff6ff":"#f8fafc",borderColor:sel.includes(r.key)?"#2563eb":"#e2e8f0"}}>
                <span style={{fontSize:18,flexShrink:0}}>{r.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:sel.includes(r.key)?"#2563eb":"#1e293b"}}>{r.label}</div>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{r.desc}</div>
                </div>
                {sel.includes(r.key)&&<span style={{color:"#2563eb",flexShrink:0,fontSize:14}}>✓</span>}
              </button>
            ))}
          </div>

          {/* Period — text inputs DD/MM/AAAA instead of date picker */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={s.label}>Desde <span style={{color:"#94a3b8",fontWeight:400}}>(DD/MM/AAAA)</span></label>
              <input value={from} onChange={e=>setFrom(e.target.value)} placeholder="01/06/2026" style={s.input}/>
            </div>
            <div>
              <label style={s.label}>Hasta <span style={{color:"#94a3b8",fontWeight:400}}>(DD/MM/AAAA)</span></label>
              <input value={to} onChange={e=>setTo(e.target.value)} placeholder="30/06/2026" style={s.input}/>
            </div>
          </div>

          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#0369a1"}}>
            💡 El reporte se abre en una nueva pestaña. Desde ahí puedes imprimir o guardar como PDF con <strong>⌘+P</strong>.
          </div>
        </div>

        {/* Fixed footer — always visible */}
        <div style={{...s.modalFooter,background:"#fff",borderTop:"1px solid #e2e8f0"}}>
          <button style={s.btnOutline} onClick={onClose}>Cancelar</button>
          <div style={{display:"flex",gap:8}}>
            <button style={{...s.btnOutline,fontSize:11}} onClick={()=>setSel(REPORT_TYPES.map(r=>r.key))}>
              Seleccionar todo
            </button>
            <button
              style={{...s.btnPrimary,opacity:sel.length===0?0.4:1,background:"linear-gradient(135deg,#7c3aed,#2563eb)"}}
              onClick={()=>{ if(sel.length>0) openReport(); }}
            >
              📄 Generar ({sel.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocsPage({ vessel, user }) {
  const [activeTab, setActiveTab]     = useState("docs");
  const [links, setLinks]             = useState([]);
  const [docs, setDocs]               = useState([]);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showAddDoc, setShowAddDoc]   = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const [newUrl, setNewUrl]           = useState("");

  // Manuals state
  const [manuals, setManuals]         = useState([]);
  const [manualsLoading, setManualsLoading] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [newManualCat, setNewManualCat] = useState("Mecánica / Motores");
  const [showUpload, setShowUpload]   = useState(false);

  // AI state
  const [aiQuery, setAiQuery]         = useState("");
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiResult, setAiResult]       = useState(null);
  const [selectedManual, setSelectedManual] = useState(null);
  const [pdfText, setPdfText]         = useState("");
  const [pdfLoading, setPdfLoading]   = useState(false);

  const MANUAL_CATS = [
    "Mecánica / Motores","Generadores","Refrigeración / A/C","Sistemas de Agua",
    "Electrónica / Navegación","Eléctrico","Hidráulico","Seguridad","Velas y Jarcia","Otro"
  ];

  const CAT_ICONS = {
    "Mecánica / Motores":"🔧","Generadores":"⚡","Refrigeración / A/C":"❄️",
    "Sistemas de Agua":"💧","Electrónica / Navegación":"🧭","Eléctrico":"🔌",
    "Hidráulico":"🔩","Seguridad":"🛡️","Velas y Jarcia":"⛵","Otro":"📄"
  };

  // Load manuals from Supabase
  useEffect(() => {
    if (!vessel?.id) return;
    fetchManuals();
  }, [vessel?.id]);

  const fetchManuals = async () => {
    setManualsLoading(true);
    const { data } = await supabase.from("manuals").select("*")
      .eq("vessel_id", vessel.id).order("created_at", { ascending: false });
    setManuals(data || []);
    setManualsLoading(false);
  };

  // Upload PDF to Supabase Storage
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Solo se aceptan archivos PDF");
      return;
    }
    setUploading(true);
    setUploadProgress("Subiendo archivo...");
    try {
      const filePath = `${user.id}/${vessel.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("manuales").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("manuales").getPublicUrl(filePath);

      setUploadProgress("Guardando en base de datos...");
      const { data: manual } = await supabase.from("manuals").insert({
        vessel_id: vessel.id,
        owner_id:  user.id,
        name:      file.name.replace(".pdf","").replace(/_/g," "),
        category:  newManualCat,
        file_url:  urlData.publicUrl,
        file_path: filePath,
        file_size: file.size,
      }).select().single();

      if (manual) setManuals(m => [manual, ...m]);
      setUploadProgress("✓ Manual subido exitosamente");
      setTimeout(() => { setUploadProgress(""); setShowUpload(false); }, 2000);
    } catch(err) {
      setUploadProgress("❌ Error: " + err.message);
    }
    setUploading(false);
  };

  const deleteManual = async (manual) => {
    if (!confirm(`¿Eliminar "${manual.name}"?`)) return;
    await supabase.storage.from("manuales").remove([manual.file_path]);
    await supabase.from("manuals").delete().eq("id", manual.id);
    setManuals(m => m.filter(x => x.id !== manual.id));
    if (selectedManual?.id === manual.id) { setSelectedManual(null); setPdfText(""); }
  };

  // Load PDF text for AI
  const loadPdfForAI = async (manual) => {
    setSelectedManual(manual);
    setActiveTab("ai");
    setPdfLoading(false);
    setPdfText(manual.file_url); // just store URL — server will fetch it
    setAiResult(null);
    setAiQuery(`Analiza este manual y dime: ¿qué sistemas y equipos cubre? ¿Cuáles son los intervalos de mantenimiento principales?`);
  };

  // Ask AI — with PDF if available, without if not
  const askAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true); setAiResult(null);
    try {
      const vesselCtx = `Embarcación: ${vessel.name || ""}, Tipo: ${vessel.type || ""}, Marina: ${vessel.marina || ""}, Capitán: ${vessel.captain || ""}, Horas motor: ${vessel.engineHours || 0}, Horas generador: ${vessel.genHours || 0}.`;

      // Always send text prompt — server fetches PDF if pdfUrl provided
      const textPrompt = selectedManual && pdfText && pdfText !== "error"
        ? `Eres un experto en mantenimiento marino. ${vesselCtx}\nManual cargado: ${selectedManual.name} (${selectedManual.category})\n\nPregunta: ${aiQuery}\n\nResponde en español, de forma clara y estructurada. Basa tu respuesta en el contenido del manual. Si preguntan por repuestos incluye números de parte específicos.`
        : `Eres un experto en mantenimiento marino. ${vesselCtx}${selectedManual ? ` Manual consultado: ${selectedManual.name} (${selectedManual.category}).` : ""}\n\nPregunta: ${aiQuery}\n\nResponde en español con información técnica detallada. Si preguntan por repuestos incluye números de parte específicos y marcas recomendadas.`;

      const messages = [{ role: "user", content: textPrompt }];

      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages,
          pdfUrl: selectedManual && pdfText && pdfText !== "error" ? pdfText : undefined,
        })
      });
      const data = await resp.json();
      setAiResult(data.content?.[0]?.text || "Sin respuesta.");
    } catch(e) {
      setAiResult("Error al conectar. Verifica tu conexión.");
    }
    setAiLoading(false);
  };

  const filteredManuals = selectedCat === "Todos" ? manuals : manuals.filter(m => m.category === selectedCat);
  const fmtSize = (bytes) => bytes > 1000000 ? `${(bytes/1000000).toFixed(1)} MB` : `${Math.round(bytes/1000)} KB`;

  const addLink = () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const url = newUrl.startsWith("http") ? newUrl : "https://" + newUrl;
    setLinks(l => [...l, { id: Date.now(), title: newTitle.trim(), url, icon: "🔗" }]);
    setNewTitle(""); setNewUrl(""); setShowAddLink(false);
  };

  const addDoc = () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const url = newUrl.startsWith("http") ? newUrl : "https://" + newUrl;
    setDocs(d => [...d, { id: Date.now(), title: newTitle.trim(), url, icon: "📄" }]);
    setNewTitle(""); setNewUrl(""); setShowAddDoc(false);
  };

  return (
    <div style={{padding:"24px 28px",maxWidth:1100,margin:"0 auto"}}>
      <h2 style={{fontSize:20,fontWeight:700,color:"#0f172a",marginBottom:4}}>📄 Documentos y Recursos</h2>
      <p style={{color:"#64748b",fontSize:13,marginBottom:20}}>Documentos · Links · Manuales técnicos con IA</p>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:"1px solid #e2e8f0",overflowX:"auto"}}>
        {[
          {key:"docs",    label:"📄 Documentos"},
          {key:"links",   label:"🔗 Links"},
          {key:"manuals", label:"📚 Manuales de Equipos"},
          {key:"ai",      label:"🤖 Asistente IA"},
        ].map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{padding:"10px 20px",background:"none",border:"none",borderBottom:activeTab===t.key?"2px solid #0ea5e9":"2px solid transparent",cursor:"pointer",fontSize:13,color:activeTab===t.key?"#0ea5e9":"#64748b",fontWeight:activeTab===t.key?600:400,whiteSpace:"nowrap"}}>{t.label}</button>
        ))}
      </div>

      {/* ── MANUALS TAB ── */}
      {activeTab==="manuals"&&(
        <div>
          {/* Upload section */}
          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showUpload?16:0}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#0369a1"}}>📤 Subir Manual PDF</div>
                <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Los manuales se guardan en la nube y el IA puede buscar dentro de ellos</div>
              </div>
              <button onClick={()=>setShowUpload(!showUpload)} style={{...s.btnPrimary,background:"#0369a1"}}>
                {showUpload?"✕ Cancelar":"＋ Subir Manual"}
              </button>
            </div>
            {showUpload&&(
              <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:4}}>
                <div>
                  <label style={s.label}>Categoría</label>
                  <select value={newManualCat} onChange={e=>setNewManualCat(e.target.value)} style={s.input}>
                    {MANUAL_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Archivo PDF</label>
                  <label style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",border:"2px dashed #bae6fd",borderRadius:10,cursor:"pointer",background:"#fff",color:"#0369a1"}}>
                    <span style={{fontSize:28}}>📎</span>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>Click para seleccionar PDF</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Máximo 50MB</div>
                    </div>
                    <input type="file" accept=".pdf" style={{display:"none"}} onChange={handleUpload} disabled={uploading}/>
                  </label>
                </div>
                {uploadProgress&&(
                  <div style={{padding:"10px 14px",background:uploadProgress.includes("✓")?"#f0fdf4":uploadProgress.includes("❌")?"#fff5f5":"#f0f9ff",border:`1px solid ${uploadProgress.includes("✓")?"#bbf7d0":uploadProgress.includes("❌")?"#fecaca":"#bae6fd"}`,borderRadius:8,fontSize:13,color:uploadProgress.includes("✓")?"#16a34a":uploadProgress.includes("❌")?"#dc2626":"#0369a1",fontWeight:600}}>
                    {uploading&&<span style={{marginRight:8}}>⏳</span>}{uploadProgress}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Category filters */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
            {["Todos",...MANUAL_CATS].map(c=>(
              <button key={c} onClick={()=>setSelectedCat(c)} style={{...s.filterBtn,background:selectedCat===c?"#1e3a5f":"transparent",color:selectedCat===c?"#fff":"#64748b",borderColor:selectedCat===c?"#4a9eff":"#e2e8f0",fontSize:11,padding:"4px 10px"}}>
                {CAT_ICONS[c]||"📂"} {c}
                {c!=="Todos"&&<span style={{marginLeft:4,fontSize:10,opacity:.7}}>({manuals.filter(m=>m.category===c).length})</span>}
              </button>
            ))}
          </div>

          {/* Manuals grid */}
          {manualsLoading&&<div style={{textAlign:"center",padding:"40px",color:"#64748b"}}>⏳ Cargando manuales...</div>}
          {!manualsLoading&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {filteredManuals.map(m=>(
                <div key={m.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  {/* Card header by category */}
                  <div style={{background:`linear-gradient(135deg,#1e3a5f,#2563eb)`,padding:"16px",color:"#fff"}}>
                    <div style={{fontSize:28,marginBottom:6}}>{CAT_ICONS[m.category]||"📄"}</div>
                    <div style={{fontSize:12,opacity:.7,letterSpacing:"0.06em",marginBottom:2}}>{m.category?.toUpperCase()}</div>
                  </div>
                  <div style={{padding:"14px 16px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:4,lineHeight:1.4}}>{m.name}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>{m.file_size ? fmtSize(m.file_size) : ""} · {new Date(m.created_at).toLocaleDateString("es-VE")}</div>
                    <div style={{display:"flex",gap:6}}>
                      <a href={m.file_url} target="_blank" rel="noreferrer" style={{...s.btnOutline,padding:"5px 10px",fontSize:11,textDecoration:"none",display:"flex",alignItems:"center",gap:4,flex:1,justifyContent:"center"}}>
                        📖 Abrir
                      </a>
                      <button onClick={()=>loadPdfForAI(m)} style={{...s.btnPrimary,padding:"5px 10px",fontSize:11,flex:1,display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
                        🤖 IA
                      </button>
                      <button onClick={()=>deleteManual(m)} style={{padding:"5px 8px",background:"none",border:"1.5px solid #fecaca",borderRadius:6,color:"#dc2626",cursor:"pointer",fontSize:12}}>
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredManuals.length===0&&!manualsLoading&&(
                <div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:"#94a3b8"}}>
                  <div style={{fontSize:48,marginBottom:12}}>📚</div>
                  <div style={{fontSize:15,fontWeight:600,color:"#475569",marginBottom:6}}>Sin manuales{selectedCat!=="Todos"?` en ${selectedCat}`:""}</div>
                  <div style={{fontSize:12}}>Sube el primer manual con el botón de arriba</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AI TAB ── */}
      {activeTab==="ai"&&(
        <div>
          {/* Selected manual context */}
          {selectedManual&&(
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,marginBottom:16}}>
              <span style={{fontSize:20}}>{CAT_ICONS[selectedManual.category]||"📄"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0369a1"}}>Manual activo: {selectedManual.name}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{pdfLoading?"⏳ Cargando PDF para IA...":pdfText&&pdfText!=="error"?"✓ PDF cargado — la IA puede leer el contenido completo":"⚠ PDF no disponible — la IA usará su conocimiento base"}</div>
              </div>
              <button onClick={()=>{setSelectedManual(null);setPdfText("");setAiResult(null);}} style={{...s.btnOutline,padding:"4px 10px",fontSize:11}}>✕ Quitar</button>
            </div>
          )}

          {!selectedManual&&(
            <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",borderRadius:14,padding:"20px 24px",marginBottom:20,color:"#fff"}}>
              <div style={{fontSize:22,marginBottom:6}}>🤖 Asistente IA de Manuales y Partes</div>
              <div style={{fontSize:13,opacity:.85,lineHeight:1.6}}>
                Selecciona un manual desde la pestaña 📚 para que la IA lo lea y responda preguntas específicas sobre él.
                Sin manual, la IA usa su conocimiento técnico marino general.
              </div>
              <button onClick={()=>setActiveTab("manuals")} style={{marginTop:12,padding:"7px 14px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:"#fff",fontSize:12,cursor:"pointer"}}>
                📚 Ver mis manuales →
              </button>
            </div>
          )}

          {/* Quick queries */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:"0.08em",marginBottom:8}}>CONSULTAS RÁPIDAS</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(selectedManual ? [
                `¿Qué sistemas cubre este manual?`,
                `¿Cuáles son los intervalos de mantenimiento?`,
                `Lista de repuestos para el próximo servicio`,
                `Procedimiento de arranque`,
                `Códigos de error comunes`,
              ] : [
                `Repuestos para servicio 500h ${vessel.captain||"motor"}`,
                `Kit impeller ${vessel.type||"motor marino"}`,
                `Zinc anodes para ${vessel.type||"barco"}`,
                `Servicio anual A/C marino`,
                `Filtros de aceite y combustible`,
              ]).map(q=>(
                <button key={q} onClick={()=>setAiQuery(q)} style={{padding:"5px 11px",border:"1.5px solid",borderRadius:20,fontSize:11,cursor:"pointer",background:aiQuery===q?"#eff6ff":"#fff",borderColor:aiQuery===q?"#2563eb":"#e2e8f0",color:aiQuery===q?"#2563eb":"#64748b",fontWeight:aiQuery===q?600:400}}>{q}</button>
              ))}
            </div>
          </div>

          {/* Query input */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <input value={aiQuery} onChange={e=>setAiQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askAI()}
              placeholder={selectedManual?"Pregunta sobre este manual...":"¿Qué repuestos necesito para el servicio de 500 horas?"}
              style={{...s.input,flex:1,padding:"10px 14px"}}/>
            <button onClick={askAI} disabled={aiLoading||pdfLoading} style={{...s.btnPrimary,padding:"10px 20px",opacity:(aiLoading||pdfLoading)?0.6:1,minWidth:110,background:"linear-gradient(120deg,#2563eb,#0ea5e9)"}}>
              {aiLoading?"⏳ Pensando...":"🔍 Preguntar"}
            </button>
          </div>

          {/* Loading */}
          {aiLoading&&(
            <div style={{background:"#f0f9ff",borderRadius:12,padding:24,textAlign:"center",border:"1px solid #bae6fd"}}>
              <div style={{fontSize:32,marginBottom:8}}>🤖</div>
              <div style={{fontSize:14,color:"#0369a1",fontWeight:600}}>{selectedManual&&pdfText?"Leyendo el manual y preparando respuesta...":"Buscando información técnica..."}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:4}}>Esto puede tomar unos segundos</div>
            </div>
          )}

          {/* Result */}
          {aiResult&&!aiLoading&&(
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <div style={{background:"linear-gradient(90deg,#f0f9ff,#e0f2fe)",padding:"12px 20px",borderBottom:"1px solid #bae6fd",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0369a1"}}>
                  🤖 {selectedManual?`Respuesta basada en: ${selectedManual.name}`:"Respuesta del Asistente IA"}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...s.btnOutline,padding:"4px 12px",fontSize:11}} onClick={()=>{setAiResult(null);setAiQuery("");}}>Nueva consulta</button>
                  <button style={{...s.btnPrimary,padding:"4px 12px",fontSize:11,background:"#16a34a"}}>📦 Solicitar procura</button>
                </div>
              </div>
              <div style={{padding:"20px 24px",whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.9,color:"#1e293b",maxHeight:500,overflowY:"auto"}}>{aiResult}</div>
              <div style={{background:"#fefce8",padding:"12px 20px",borderTop:"1px solid #fde68a",fontSize:12,color:"#92400e"}}>
                💡 <strong>Servicio de Procura Carive:</strong> Ordenamos estos repuestos desde USA y coordinamos el envío a Venezuela.
              </div>
            </div>
          )}

          {!aiResult&&!aiLoading&&(
            <div style={{background:"#f8fafc",borderRadius:12,padding:"40px 24px",textAlign:"center",border:"1px dashed #e2e8f0"}}>
              <div style={{fontSize:44,marginBottom:12}}>🔧</div>
              <div style={{fontSize:14,fontWeight:600,color:"#475569",marginBottom:6}}>Haz una pregunta arriba</div>
              <div style={{fontSize:12,color:"#94a3b8"}}>
                {selectedManual?"La IA leerá el manual completo y responderá basándose en su contenido":"Sube un manual para preguntas específicas, o consulta directamente sobre tu embarcación"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DOCS TAB ── */}
      {activeTab==="docs"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
            <button style={s.btnPrimary} onClick={()=>setShowAddDoc(!showAddDoc)}>＋ Agregar Documento</button>
          </div>
          {showAddDoc&&(
            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:20,marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:13,color:"#0369a1",marginBottom:12}}>Nuevo Documento</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div><label style={s.label}>Título *</label><input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Ej: Registro de Matrícula" style={s.input}/></div>
                <div><label style={s.label}>URL *</label><input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="https://drive.google.com/..." style={s.input}/></div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                <button style={s.btnOutline} onClick={()=>{setShowAddDoc(false);setNewTitle("");setNewUrl("");}}>Cancelar</button>
                <button style={s.btnPrimary} onClick={addDoc}>Guardar</button>
              </div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {docs.length===0&&<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:8}}>📄</div>Agrega documentos como registros, pólizas, zarpes, certificaciones y más</div>}
            {docs.map(doc=>(
              <div key={doc.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <span style={{fontSize:22,flexShrink:0}}>{doc.icon}</span>
                <div style={{flex:1}}>
                  <a href={doc.url} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:600,color:"#2563eb",textDecoration:"none"}}>{doc.title}</a>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:500}}>{doc.url}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <a href={doc.url} target="_blank" rel="noreferrer" style={{...s.btnOutline,padding:"5px 12px",fontSize:11,textDecoration:"none",display:"inline-flex",alignItems:"center"}}>↗ Abrir</a>
                  <button onClick={()=>setDocs(d=>d.filter(x=>x.id!==doc.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:16,padding:"4px 8px"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LINKS TAB ── */}
      {activeTab==="links"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
            <button style={s.btnPrimary} onClick={()=>setShowAddLink(!showAddLink)}>＋ Agregar Link</button>
          </div>
          {showAddLink&&(
            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:20,marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:13,color:"#0369a1",marginBottom:12}}>Nuevo Link</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div><label style={s.label}>Título *</label><input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Ej: Carpeta Google Drive" style={s.input}/></div>
                <div><label style={s.label}>URL *</label><input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="https://drive.google.com/..." style={s.input}/></div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                <button style={s.btnOutline} onClick={()=>{setShowAddLink(false);setNewTitle("");setNewUrl("");}}>Cancelar</button>
                <button style={s.btnPrimary} onClick={addLink}>Guardar</button>
              </div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {links.length===0&&<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:8}}>🔗</div>Agrega links a Google Drive, Dropbox, páginas web u otros recursos online</div>}
            {links.map(link=>(
              <div key={link.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <span style={{fontSize:22,flexShrink:0}}>{link.icon}</span>
                <div style={{flex:1}}>
                  <a href={link.url} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:600,color:"#2563eb",textDecoration:"none"}}>{link.title}</a>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:500}}>{link.url}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <a href={link.url} target="_blank" rel="noreferrer" style={{...s.btnOutline,padding:"5px 12px",fontSize:11,textDecoration:"none",display:"inline-flex",alignItems:"center"}}>↗ Abrir</a>
                  <button onClick={()=>setLinks(l=>l.filter(x=>x.id!==link.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:16,padding:"4px 8px"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ── NOTIFICATIONS MODAL ───────────────────────────────────────────────────────
function NotificationsModal({ vessel, user, onClose }) {
  const [tab, setTab]           = useState("send");
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null);
  const [history, setHistory]   = useState([]);
  const [phone, setPhone]       = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [msgType, setMsgType]   = useState("custom");

  useEffect(() => {
    supabase.from("notifications").select("*")
      .eq("vessel_id", vessel.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setHistory(data || []));
  }, [vessel.id]);

  const overdueTasks = (vessel.tasks||[]).filter(t => t.status === "overdue");
  const dueTasks     = (vessel.tasks||[]).filter(t => t.status === "due");

  const MSG_TEMPLATES = [
    {
      key: "overdue",
      label: "⚠️ Tareas Vencidas",
      icon: "🚨",
      color: "#dc2626",
      bg: "#fff5f5",
      border: "#fecaca",
      generate: () => overdueTasks.length === 0
        ? `✅ *Carive* — ${vessel.name}\n\nSin tareas vencidas. ¡Todo al día!`
        : `🚨 *Carive* — ${vessel.name}\n\n⚠️ ${overdueTasks.length} tarea${overdueTasks.length>1?"s":""} vencida${overdueTasks.length>1?"s":""}:\n\n${overdueTasks.slice(0,5).map(t=>`• ${t.system} — ${t.name} (vence: ${fmtDate(t.nextDue)})`).join("\n")}\n\n📱 Ver detalles: nautitrack.vercel.app`
    },
    {
      key: "due_soon",
      label: "📅 Por Vencer",
      icon: "⏰",
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
      generate: () => dueTasks.length === 0
        ? `✅ *Carive* — ${vessel.name}\n\nSin tareas por vencer esta semana.`
        : `⏰ *Carive* — ${vessel.name}\n\n📅 ${dueTasks.length} tarea${dueTasks.length>1?"s":""} por vencer:\n\n${dueTasks.slice(0,5).map(t=>`• ${t.system} — ${t.name} (vence: ${fmtDate(t.nextDue)})`).join("\n")}\n\n📱 Ver detalles: nautitrack.vercel.app`
    },
    {
      key: "status",
      label: "📊 Reporte Diario",
      icon: "📊",
      color: "#2563eb",
      bg: "#eff6ff",
      border: "#bfdbfe",
      generate: () => `📊 *Carive* — Reporte ${vessel.name}\n\n🚢 *${vessel.name}* · ${vessel.type||""}\n📍 ${vessel.marina||""}\n\n🔧 Motor: ${vessel.engineHours||0}h\n⚡ Generador: ${vessel.genHours||0}h\n⛽ Combustible: ${vessel.fuel||0} ${vessel.fuelUnit||"gal"}\n\n✅ Tareas al día: ${(vessel.tasks||[]).filter(t=>t.status==="ok").length}\n⚠️ Vencidas: ${overdueTasks.length}\n📋 Bitácora: ${(vessel.log||[]).length} entradas\n\n📱 nautitrack.vercel.app`
    },
    {
      key: "custom",
      label: "✏️ Mensaje Personalizado",
      icon: "✏️",
      color: "#7c3aed",
      bg: "#f5f3ff",
      border: "#ddd6fe",
      generate: () => customMsg || ""
    },
  ];

  const selectedTemplate = MSG_TEMPLATES.find(t => t.key === msgType);
  const message = selectedTemplate?.generate() || "";

  const send = async () => {
    if (!phone.trim()) { setResult({ ok: false, error: "Ingresa un número de teléfono" }); return; }
    if (!message.trim()) { setResult({ ok: false, error: "El mensaje está vacío" }); return; }
    setSending(true); setResult(null);
    const r = await sendWhatsApp(phone, message);
    setResult(r);
    if (r.ok) {
      // Save to history
      const { data } = await supabase.from("notifications").insert({
        vessel_id: vessel.id, owner_id: user.id,
        type: msgType, message, recipient: phone, status: "sent"
      }).select().single();
      if (data) setHistory(h => [data, ...h]);
    } else {
      await supabase.from("notifications").insert({
        vessel_id: vessel.id, owner_id: user.id,
        type: msgType, message, recipient: phone, status: "failed"
      });
    }
    setSending(false);
  };

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox, maxWidth:580}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>📲 Notificaciones WhatsApp</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{vessel.name}</div>
          </div>
          <button onClick={onClose} style={s.modalClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #e2e8f0",padding:"0 24px"}}>
          {[{key:"send",label:"📤 Enviar"},{key:"history",label:"📋 Historial"}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{padding:"10px 16px",background:"none",border:"none",borderBottom:tab===t.key?"2px solid #0ea5e9":"2px solid transparent",cursor:"pointer",fontSize:13,color:tab===t.key?"#0ea5e9":"#64748b",fontWeight:tab===t.key?600:400}}>{t.label}</button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {tab==="send"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Phone */}
              <div>
                <label style={s.label}>Número WhatsApp <span style={{color:"#dc2626"}}>*</span></label>
                <input value={phone} onChange={e=>setPhone(e.target.value)}
                  placeholder="+58 414 123 4567 o +1 305 123 4567"
                  style={s.input}/>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Incluye el código de país: +58 para Venezuela, +1 para USA</div>
              </div>

              {/* Message type */}
              <div>
                <label style={s.label}>Tipo de mensaje</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
                  {MSG_TEMPLATES.map(t=>(
                    <button key={t.key} onClick={()=>setMsgType(t.key)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",border:`1.5px solid ${msgType===t.key?t.color:t.border}`,borderRadius:8,cursor:"pointer",background:msgType===t.key?t.bg:"#fff",textAlign:"left"}}>
                      <span style={{fontSize:16}}>{t.icon}</span>
                      <span style={{fontSize:12,fontWeight:600,color:msgType===t.key?t.color:"#1e293b"}}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom message input */}
              {msgType==="custom"&&(
                <div>
                  <label style={s.label}>Mensaje</label>
                  <textarea value={customMsg} onChange={e=>setCustomMsg(e.target.value)}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={4} style={{...s.input,resize:"vertical"}}/>
                </div>
              )}

              {/* Preview */}
              {message&&(
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#16a34a",marginBottom:6,letterSpacing:"0.06em"}}>VISTA PREVIA</div>
                  <div style={{fontSize:12,color:"#1e293b",whiteSpace:"pre-wrap",lineHeight:1.6,fontFamily:"monospace"}}>{message}</div>
                </div>
              )}

              {/* Result */}
              {result&&(
                <div style={{padding:"10px 14px",borderRadius:8,background:result.ok?"#f0fdf4":"#fff5f5",border:`1px solid ${result.ok?"#bbf7d0":"#fecaca"}`,fontSize:13,color:result.ok?"#16a34a":"#dc2626",fontWeight:600}}>
                  {result.ok?"✅ Mensaje enviado exitosamente":"❌ Error: "+result.error}
                </div>
              )}

              {/* WA note */}
              <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"10px 14px",fontSize:11,color:"#0369a1"}}>
                💡 <strong>Modo prueba:</strong> Solo puedes enviar a números verificados en Meta. Para enviar a cualquier número necesitas verificar tu negocio en Meta.
              </div>
            </div>
          )}

          {tab==="history"&&(
            <div>
              {history.length===0&&(
                <div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>
                  <div style={{fontSize:32,marginBottom:8}}>📭</div>
                  <div>Sin notificaciones enviadas</div>
                </div>
              )}
              {history.map(n=>(
                <div key={n.id} style={{padding:"12px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:n.status==="sent"?"#dcfce7":"#fee2e2",color:n.status==="sent"?"#16a34a":"#dc2626"}}>{n.status==="sent"?"✓ Enviado":"✗ Fallido"}</span>
                      <span style={{fontSize:11,color:"#64748b"}}>{n.recipient}</span>
                    </div>
                    <span style={{fontSize:10,color:"#94a3b8"}}>{new Date(n.created_at).toLocaleDateString("es-VE")}</span>
                  </div>
                  <div style={{fontSize:12,color:"#475569",whiteSpace:"pre-wrap",maxHeight:60,overflow:"hidden",textOverflow:"ellipsis"}}>{n.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.modalFooter}>
          <button style={s.btnOutline} onClick={onClose}>Cerrar</button>
          {tab==="send"&&(
            <button onClick={send} disabled={sending} style={{...s.btnPrimary,background:"#25D366",opacity:sending?0.6:1,display:"flex",alignItems:"center",gap:8}}>
              {sending?"⏳ Enviando...":"📲 Enviar WhatsApp"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


function ProfileModal({ vessel, updateVessel, user, onClose }) {
  const [tab,setTab]   = useState("profile");
  const [form,setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "", marinaAddress: "",
  });
  const [config,setConfig] = useState(vessel.config||{distUnit:"nm",speedUnit:"kn",fuelUnit:"gal",tempUnit:"C"});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          const parts = (data.full_name||"").split(" ");
          setForm({
            firstName: parts[0]||"",
            lastName:  parts.slice(1).join(" ")||"",
            phone:     data.phone||"",
            email:     data.email||user.email||"",
            marinaAddress: vessel.profile?.marinaAddress||"",
          });
        }
        setLoading(false);
      });
  }, [user?.id]);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const setcfg=(k,v)=>setConfig(c=>({...c,[k]:v}));

  const save = async () => {
    const full_name = `${form.firstName} ${form.lastName}`.trim();
    await supabase.from("profiles").upsert({
      id: user.id, email: form.email||user.email,
      full_name, phone: form.phone,
    });
    // Actualizar nombre en navbar
    if (window.__setUserFullName) window.__setUserFullName(full_name);
    updateVessel({...vessel, profile:{...form}, config:{...config}});
    onClose();
  };

  const sub=vessel.subscription||{};
  const planFeatures={Basic:["1 embarcación","Bitácora básica","Tareas ilimitadas","Soporte email"],Pro:["Hasta 3 embarcaciones","Bitácora con fotos","Records y reportes","Proveedores","Soporte prioritario"],Fleet:["Embarcaciones ilimitadas","Todo lo de Pro","API access","Reportes automáticos","Gerente de cuenta"]};
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}><div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>👤 Mi Cuenta</div><button onClick={onClose} style={s.modalClose}>✕</button></div>
        <div style={{display:"flex",borderBottom:"1px solid #e2e8f0",padding:"0 24px"}}>
          {[{key:"profile",label:"Mi Perfil"},{key:"config",label:"⚙️ Unidades"},{key:"subscription",label:"Suscripción"}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{padding:"10px 16px",background:"none",border:"none",borderBottom:tab===t.key?"2px solid #0ea5e9":"2px solid transparent",cursor:"pointer",fontSize:13,color:tab===t.key?"#0ea5e9":"#64748b",fontWeight:tab===t.key?600:400}}>{t.label}</button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {loading && <div style={{textAlign:"center",padding:30,color:"#64748b"}}>⏳ Cargando...</div>}
          {!loading && tab==="profile"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:16,padding:16,background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
                <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",color:"#fff",fontSize:22,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{form.firstName?.[0]||"?"}{form.lastName?.[0]||""}</div>
                <div><div style={{fontWeight:700,fontSize:15,color:"#0f172a"}}>{form.firstName||"Tu nombre"} {form.lastName||""}</div><div style={{fontSize:12,color:"#64748b"}}>{form.email||"Sin email"}</div><button style={{...s.btnOutline,padding:"3px 10px",fontSize:11,marginTop:6}}>Cambiar foto</button></div>
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
          {tab==="config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:"12px 16px",fontSize:12,color:"#0369a1"}}>
                ⚙️ Configura las unidades de medida que se usarán en toda la aplicación.
              </div>
              {[
                {label:"Distancia", key:"distUnit", opts:[{v:"nm",l:"Millas Náuticas (nm)"},{v:"km",l:"Kilómetros (km)"},{v:"mi",l:"Millas terrestres (mi)"}]},
                {label:"Velocidad", key:"speedUnit", opts:[{v:"kn",l:"Nudos (kn)"},{v:"kmh",l:"Km/h"},{v:"mph",l:"Mph"}]},
                {label:"Combustible", key:"fuelUnit", opts:[{v:"gal",l:"Galones (gal)"},{v:"lts",l:"Litros (lts)"},{v:"%",l:"Porcentaje (%)"}]},
                {label:"Temperatura", key:"tempUnit", opts:[{v:"C",l:"Celsius (°C)"},{v:"F",l:"Fahrenheit (°F)"}]},
              ].map(({label,key,opts})=>(
                <div key={key}>
                  <label style={s.label}>{label}</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                    {opts.map(o=>(
                      <button key={o.v} onClick={()=>setcfg(key,o.v)} style={{padding:"8px 14px",border:"1.5px solid",borderRadius:8,fontSize:12,cursor:"pointer",background:config[key]===o.v?"#eff6ff":"#f8fafc",borderColor:config[key]===o.v?"#2563eb":"#e2e8f0",color:config[key]===o.v?"#2563eb":"#64748b",fontWeight:config[key]===o.v?700:400}}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab==="subscription"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{background:"linear-gradient(120deg,#2563eb,#0ea5e9)",borderRadius:12,padding:20,color:"#fff"}}>
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

// ── VesselField: single stable component, no wrappers, no re-mounting ──────────
// KEY FIX: This is a named function at module scope.
// React sees the same component type every render → input is never remounted → cursor stays
function VesselField({ editMode, label, value, onChange, placeholder }) {
  const inputStyle = {width:"100%",padding:"6px 10px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#fff",boxSizing:"border-box",outline:"none"};
  return (
    <div style={{display:"grid",gridTemplateColumns:"160px 1fr",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9",gap:12}}>
      <span style={{fontSize:12,color:"#94a3b8",flexShrink:0}}>{label}</span>
      {editMode
        ? <input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder||""} style={inputStyle}/>
        : <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{value||"—"}</span>
      }
    </div>
  );
}

function VesselDetailsModal({ vessel: vesselProp, updateVessel, onClose }) {
  // ── CRITICAL: freeze vessel on mount so parent re-renders don't kill input focus
  const vesselRef = useRef(vesselProp);
  const vessel = vesselRef.current;
  const d = vessel.details || {};

  // Edit mode
  const [editMode, setEditMode] = useState(false);

  // General info editable
  const [gen, setGen] = useState({
    name:         vessel.name    || "",
    type:         vessel.details?.type || vessel.details?.vesselType || vessel.type?.replace(/\s*\d+['m].*$/,"").trim() || "",
    eslora:       vessel.details?.eslora || (vessel.type?.match(/\d+['m][^\s]*/)?.[0]) || "",
    marina:       vessel.marina  || "",
    city:         vessel.details?.city         || "",
    state:        vessel.details?.state        || "",
    country:      vessel.details?.country      || "Venezuela",
    notifyPhone:  vessel.details?.notify_phone  || "",
    captain:      vessel.captain || "",
    manufacturer: d.manufacturer || "",
    model:        d.model        || "",
    year:         d.year         || "",
    hullType:     d.hullType     || "",
    homePort:     d.homePort     || vessel.marina || "",
    uscg:         d.uscg         || "",
    built:        d.built        || "",
    hin:          d.hin          || "",
  });

  // Dimensions
  const [dims, setDims] = useState({
    displacement:d.displacement||"", grt:d.grt||"", nrt:d.nrt||"",
    loa:d.loa||"", beam:d.beam||"", draft:d.draft||"",
  });

  // Tanks
  const [fuelTanks, setFuelTanks] = useState(d.fuelTanks||[{name:"Estribor",capacity:""},{name:"Babor",capacity:""}]);
  const [numFuelTanks, setNumFuelTanks] = useState((d.fuelTanks||[{},{}]).length);
  const [freshWater, setFreshWater] = useState(d.freshWater||"");
  const [wasteTank, setWasteTank]   = useState(d.wasteTank||"");
  const [greyWater, setGreyWater]   = useState(d.greyWater||"");

  // Anchor
  const [anchor, setAnchor]     = useState(d.anchor||"");
  const [anchorRode, setAnchorRode] = useState(d.anchorRode||"");

  // Motors
  const [motors, setMotors]       = useState(d.motors2||[{name:"Motor Estribor",make:"Caterpillar",model:"3208",serial:""},{name:"Motor Babor",make:"Caterpillar",model:"3208",serial:""}]);
  const [numMotors, setNumMotors] = useState((d.motors2||[{},{}]).length);

  // Generators
  const [gens, setGens]           = useState(d.generators2||[{name:"Generador Principal",make:"Kohler",model:"20kW",serial:""}]);
  const [numGens, setNumGens]     = useState((d.generators2||[{}]).length);

  // Dinghy
  const [dinghyList, setDinghyList] = useState(d.dinghyList||[{type:"Dinghy",make:"Zodiac",model:"Pro 310",hullSerial:"",motorSerial:"",motorMake:"Yamaha",motorModel:"15 HP"}]);

  // Crew
  const [crew, setCrew]         = useState(vessel.crew2 || vessel.crew?.map(c=>({name:c,role:"Marinero",primary:false}))||[]);
  const [newCrew, setNewCrew]   = useState("");
  const [newRole, setNewRole]   = useState("Marinero");

  // Vessel photo
  const [vesselPhoto, setVesselPhoto] = useState(vessel.photo||null);

  const ROLES  = ["Capitán","Marinero","Stew","Otro"];
  const ROLE_ICON = {"Capitán":"⚓","Marinero":"🚢","Stew":"⭐","Otro":"👤"};

  const addCrew = () => {
    if (!newCrew.trim()) return;
    const u = [...crew,{name:newCrew.trim(),role:newRole,primary:false}];
    setCrew(u); setNewCrew("");
  };
  const rmCrew     = (i) => setCrew(crew.filter((_,j)=>j!==i));
  const setPrimary = (i) => setCrew(crew.map((c,j)=>({...c,primary:j===i?!c.primary:false})));
  const setCrewRole= (i,r)=> setCrew(crew.map((c,j)=>j===i?{...c,role:r}:c));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setVesselPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const saveAll = () => {
    const updatedDetails = {
      ...d,
      ...gen,
      ...dims,
      fuelTanks:   fuelTanks.slice(0, numFuelTanks),
      freshWater,  wasteTank, greyWater,
      anchor,      anchorRode,
      motors2:     motors.slice(0, numMotors),
      generators2: gens.slice(0, numGens),
      dinghyList,
      // preserve profile/config
      _profile:      d._profile      || {},
      city:          gen.city        || d.city         || "",
      state:         gen.state       || d.state        || "",
      country:       gen.country     || d.country      || "",
      notify_phone:  gen.notifyPhone  || d.notify_phone  || "",
      _config:       d._config       || {},
      _subscription: d._subscription || {},
    };
    updateVessel({
      ...vessel,
      name:       gen.name    || vessel.name,
      type:       [gen.type, gen.eslora].filter(Boolean).join(" ") || vessel.type || "",
      marina:     gen.marina  || vessel.marina  || "",
      captain:    gen.captain || vessel.captain || "",
      photo:      vesselPhoto,
      crew2:      crew,
      crew:       crew.map(x => x.name),
      motors:     motors.slice(0, numMotors).map(m => m.name),
      generators: gens.slice(0, numGens).map(g => g.name).filter(Boolean),
      details:    updatedDetails,
    });
    setEditMode(false);
  };



  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{...s.modalBox,maxWidth:640}} onClick={e=>e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            {editMode
              ? <input value={gen.name||vessel.name} onChange={e=>setGen(g=>({...g,name:e.target.value}))} style={{...s.input,fontSize:16,fontWeight:700,padding:"4px 8px",width:240}} placeholder="Nombre del barco"/>
              : <div style={{fontSize:16,fontWeight:700,color:"#0f172a"}}>⚓ {vessel.name}</div>
            }
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Detalles de la Embarcación</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setEditMode(!editMode)} style={{...s.btnOutline,padding:"5px 12px",fontSize:12,borderColor:editMode?"#2563eb":"#e2e8f0",color:editMode?"#2563eb":"#475569"}}>
              {editMode?"✕ Cancelar edición":"✏️ Editar"}
            </button>
            <button onClick={onClose} style={s.modalClose}>✕</button>
          </div>
        </div>

        <div style={s.modalBody}>

          {/* FOTO DEL BARCO */}
          <div style={{marginBottom:20,textAlign:"center"}}>
            <div style={{position:"relative",display:"inline-block"}}>
              {vesselPhoto
                ? <img src={vesselPhoto} alt="Barco" style={{width:"100%",maxWidth:560,height:200,objectFit:"cover",borderRadius:10,border:"1px solid #e2e8f0"}}/>
                : <div style={{width:"100%",maxWidth:560,height:160,background:"linear-gradient(135deg,#0f2744,#1e3a8a)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,border:"1px solid #e2e8f0"}}>
                    <svg width="48" height="32" viewBox="0 0 60 40" fill="none"><path d="M5 28 Q15 10 30 8 Q45 10 55 28 Z" fill="#1e40af" opacity=".4"/><rect x="25" y="8" width="2" height="14" fill="#93c5fd"/><path d="M27 8 L42 16 L27 16 Z" fill="#bfdbfe" opacity=".8"/></svg>
                    <span style={{color:"#93c5fd",fontSize:12}}>Sin foto</span>
                  </div>
              }
              {editMode&&(
                <label style={{position:"absolute",bottom:8,right:8,background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:600,padding:"5px 10px",borderRadius:6,cursor:"pointer",border:"none"}}>
                  📷 Cambiar foto
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
                </label>
              )}
            </div>
          </div>

          {/* INFORMACIÓN GENERAL */}
          <div style={{marginBottom:18}}>
            <div style={s.secTitle}>Información General</div>
            <VesselField key="name" editMode={editMode} label="Nombre del Barco" value={gen.name} onChange={v=>setGen(g=>({...g,name:v}))} placeholder="Ej: La Gaviota"/>
            {/* Tipo — dropdown */}
            <div style={s.detailRow}>
              <span style={s.detailKey}>Tipo de Embarcación</span>
              {editMode
                ? <select value={gen.type} onChange={e=>setGen(g=>({...g,type:e.target.value}))} style={{...s.input,padding:"5px 8px",fontSize:12}}>
                    <option value="">Seleccionar...</option>
                    {["Yate Motor","Velero","Catamarán","Lancha","Bote de Pesca","Barco de Trabajo","Otro"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                : <span style={s.detailVal}>{gen.type||"—"}</span>
              }
            </div>
            {/* Eslora — separate field */}
            <VesselField key="eslora" editMode={editMode} label="Eslora" value={gen.eslora} onChange={v=>setGen(g=>({...g,eslora:v}))} placeholder="Ej: 48', 60', 14m"/>
            <VesselField key="marina" editMode={editMode} label="Nombre de la Marina" value={gen.marina} onChange={v=>setGen(g=>({...g,marina:v}))} placeholder="Ej: Marina Morrocoy, Club Náutico"/>
            <VesselField key="city"    editMode={editMode} label="Ciudad 🌤"  value={gen.city}    onChange={v=>setGen(g=>({...g,city:v}))}    placeholder="Ej: Tucacas, Miami, Porlamar"/>
            <VesselField key="state"   editMode={editMode} label="Estado"     value={gen.state}   onChange={v=>setGen(g=>({...g,state:v}))}   placeholder="Ej: Falcón, Florida, Nueva Esparta"/>
            <VesselField key="country" editMode={editMode} label="País"       value={gen.country} onChange={v=>setGen(g=>({...g,country:v}))} placeholder="Ej: Venezuela, USA"/>
            <VesselField key="notifyPhone" editMode={editMode} label="📲 WhatsApp Alertas" value={gen.notifyPhone} onChange={v=>setGen(g=>({...g,notifyPhone:v}))} placeholder="Ej: +584141234567 o +13051234567"/>
            <VesselField key="captain" editMode={editMode} label="Capitán" value={gen.captain} onChange={v=>setGen(g=>({...g,captain:v}))} placeholder="Nombre del capitán"/>
            <VesselField key="manuf" editMode={editMode} label="Fabricante" value={gen.manufacturer} onChange={v=>setGen(g=>({...g,manufacturer:v}))}/>
            <VesselField key="model" editMode={editMode} label="Modelo" value={gen.model} onChange={v=>setGen(g=>({...g,model:v}))}/>
            <VesselField key="year" editMode={editMode} label="Año" value={gen.year} onChange={v=>setGen(g=>({...g,year:v}))}/>
            <VesselField key="hull" editMode={editMode} label="Tipo de Casco" value={gen.hullType} onChange={v=>setGen(g=>({...g,hullType:v}))}/>
            <VesselField key="hin" editMode={editMode} label="Serial del Casco (HIN)" value={gen.hin} onChange={v=>setGen(g=>({...g,hin:v}))} placeholder="Ej: HTRS1234A898"/>
          </div>

          {/* DIMENSIONES */}
          <div style={{marginBottom:18}}>
            <div style={s.secTitle}>Dimensiones</div>
            <VesselField key="disp" editMode={editMode} label="Desplazamiento" value={dims.displacement} onChange={v=>setDims(d=>({...d,displacement:v}))} placeholder="Ej: 55,000 lbs"/>
            <VesselField key="grt" editMode={editMode} label="TRB — Tonelaje Registro Bruto" value={dims.grt} onChange={v=>setDims(d=>({...d,grt:v}))} placeholder="Ej: 42"/>
            <VesselField key="nrt" editMode={editMode} label="TRN — Tonelaje Registro Neto" value={dims.nrt} onChange={v=>setDims(d=>({...d,nrt:v}))} placeholder="Ej: 28"/>
            <VesselField key="loa" editMode={editMode} label="Eslora Total (LOA)" value={dims.loa} onChange={v=>setDims(d=>({...d,loa:v}))} placeholder="Ej: 64'6&quot;"/>
            <VesselField key="beam" editMode={editMode} label="Manga" value={dims.beam} onChange={v=>setDims(d=>({...d,beam:v}))} placeholder="Ej: 18'"/>
            <VesselField key="draft" editMode={editMode} label="Calado" value={dims.draft} onChange={v=>setDims(d=>({...d,draft:v}))} placeholder="Ej: 5'2&quot;"/>
          </div>

          {/* TANQUES */}
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={s.secTitle}>Tanques de Combustible</div>
              {editMode&&<div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#64748b"}}>N° tanques:</span>
                <select value={numFuelTanks} onChange={e=>{const n=parseInt(e.target.value);setNumFuelTanks(n);setFuelTanks(t=>{const arr=[...t];while(arr.length<n)arr.push({name:`Tanque ${arr.length+1}`,capacity:""});return arr.slice(0,n);});}} style={{...s.input,width:60,padding:"4px 8px"}}>
                  {[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>}
            </div>
            {fuelTanks.slice(0,numFuelTanks).map((tank,i)=>(
              editMode
                ? <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <div><label style={{...s.label,fontSize:11}}>Nombre tanque {i+1}</label><input value={tank.name} onChange={e=>setFuelTanks(t=>t.map((x,j)=>j===i?{...x,name:e.target.value}:x))} style={s.input}/></div>
                    <div><label style={{...s.label,fontSize:11}}>Capacidad</label><input value={tank.capacity} onChange={e=>setFuelTanks(t=>t.map((x,j)=>j===i?{...x,capacity:e.target.value}:x))} placeholder="Ej: 300 gal" style={s.input}/></div>
                  </div>
                : <div key={i} style={s.detailRow}><span style={s.detailKey}>{tank.name}</span><span style={s.detailVal}>{tank.capacity||"—"}</span></div>
            ))}
            {editMode
              ? <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
                    <div><label style={{...s.label,fontSize:11}}>Agua Potable</label><input value={freshWater} onChange={e=>setFreshWater(e.target.value)} style={s.input}/></div>
                    <div><label style={{...s.label,fontSize:11}}>Aguas Negras</label><input value={wasteTank} onChange={e=>setWasteTank(e.target.value)} style={s.input}/></div>
                    <div><label style={{...s.label,fontSize:11}}>Aguas Grises</label><input value={greyWater} onChange={e=>setGreyWater(e.target.value)} style={s.input}/></div>
                  </div>
                </>
              : <>
                  {[["Agua Potable",freshWater],["Aguas Negras",wasteTank],["Aguas Grises",greyWater]].map(([k,v])=>(
                    <div key={k} style={s.detailRow}><span style={s.detailKey}>{k}</span><span style={s.detailVal}>{v||"—"}</span></div>
                  ))}
                </>
            }
          </div>

          {/* FONDEO */}
          <div style={{marginBottom:18}}>
            <div style={s.secTitle}>Fondeo</div>
            <VesselField key="anchor" editMode={editMode} label="Ancla" value={anchor} onChange={setAnchor}/>
            <VesselField key="anchorRode" editMode={editMode} label="Cadena/Fondeo" value={anchorRode} onChange={setAnchorRode}/>
          </div>

          {/* MOTORES */}
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={s.secTitle}>Motores</div>
              {editMode&&<div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#64748b"}}>N° motores:</span>
                <select value={numMotors} onChange={e=>{const n=parseInt(e.target.value);setNumMotors(n);setMotors(t=>{const arr=[...t];const names=["Motor Estribor","Motor Babor","Motor Centro","Motor Centro Estribor","Motor Centro Babor","Motor Central"];while(arr.length<n)arr.push({name:names[arr.length]||`Motor ${arr.length+1}`,make:"",model:"",serial:""});return arr.slice(0,n);});}} style={{...s.input,width:60,padding:"4px 8px"}}>
                  {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>}
            </div>
            {motors.slice(0,numMotors).map((m,i)=>(
              editMode
                ? <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{fontWeight:600,fontSize:12,color:"#2563eb",marginBottom:8}}>{m.name}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label style={{...s.label,fontSize:11}}>Nombre</label><input value={m.name} onChange={e=>setMotors(t=>t.map((x,j)=>j===i?{...x,name:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Marca</label><input value={m.make} onChange={e=>setMotors(t=>t.map((x,j)=>j===i?{...x,make:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Modelo</label><input value={m.model} onChange={e=>setMotors(t=>t.map((x,j)=>j===i?{...x,model:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Serial</label><input value={m.serial} onChange={e=>setMotors(t=>t.map((x,j)=>j===i?{...x,serial:e.target.value}:x))} style={s.input}/></div>
                    </div>
                  </div>
                : <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{fontWeight:600,fontSize:12,color:"#2563eb",marginBottom:6}}>{m.name}</div>
                    {[["Marca",m.make],["Modelo",m.model],["Serial",m.serial]].map(([k,v])=>(
                      <div key={k} style={{...s.detailRow,padding:"4px 0"}}><span style={s.detailKey}>{k}</span><span style={s.detailVal}>{v||"—"}</span></div>
                    ))}
                  </div>
            ))}
          </div>

          {/* GENERADORES */}
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={s.secTitle}>Generadores</div>
              {editMode&&<div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#64748b"}}>N° generadores:</span>
                <select value={numGens} onChange={e=>{const n=parseInt(e.target.value);setNumGens(n);setGens(t=>{const arr=[...t];while(arr.length<n)arr.push({name:`Generador ${arr.length+1}`,make:"",model:"",serial:""});return arr.slice(0,n);});}} style={{...s.input,width:70,padding:"4px 8px"}}>
                  {[0,1,2,3].map(n=><option key={n} value={n}>{n===0?"Ninguno":n}</option>)}
                </select>
              </div>}
            </div>
            {gens.slice(0,numGens).map((g,i)=>(
              editMode
                ? <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{fontWeight:600,fontSize:12,color:"#7c3aed",marginBottom:8}}>{g.name}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label style={{...s.label,fontSize:11}}>Nombre</label><input value={g.name} onChange={e=>setGens(t=>t.map((x,j)=>j===i?{...x,name:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Marca</label><input value={g.make} onChange={e=>setGens(t=>t.map((x,j)=>j===i?{...x,make:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Modelo</label><input value={g.model} onChange={e=>setGens(t=>t.map((x,j)=>j===i?{...x,model:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Serial</label><input value={g.serial} onChange={e=>setGens(t=>t.map((x,j)=>j===i?{...x,serial:e.target.value}:x))} style={s.input}/></div>
                    </div>
                  </div>
                : <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{fontWeight:600,fontSize:12,color:"#7c3aed",marginBottom:6}}>{g.name}</div>
                    {[["Marca",g.make],["Modelo",g.model],["Serial",g.serial]].map(([k,v])=>(
                      <div key={k} style={{...s.detailRow,padding:"4px 0"}}><span style={s.detailKey}>{k}</span><span style={s.detailVal}>{v||"—"}</span></div>
                    ))}
                  </div>
            ))}
          </div>

          {/* DINGHY */}
          <div style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={s.secTitle}>Dinghy / Tender / Auxiliar</div>
              {editMode&&<button onClick={()=>setDinghyList(l=>[...l,{type:"Dinghy",make:"",model:"",hullSerial:"",motorSerial:"",motorMake:"",motorModel:""}])} style={{fontSize:11,color:"#2563eb",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>＋ Agregar</button>}
            </div>
            {dinghyList.map((d2,i)=>(
              editMode
                ? <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <select value={d2.type} onChange={e=>setDinghyList(l=>l.map((x,j)=>j===i?{...x,type:e.target.value}:x))} style={{...s.input,width:140,padding:"4px 8px",fontSize:12}}>
                        {["Auxiliar","Dinghy","Moto de Agua","Tender"].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                      <button onClick={()=>setDinghyList(l=>l.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:13}}>✕</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label style={{...s.label,fontSize:11}}>Marca casco</label><input value={d2.make} onChange={e=>setDinghyList(l=>l.map((x,j)=>j===i?{...x,make:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Modelo casco</label><input value={d2.model} onChange={e=>setDinghyList(l=>l.map((x,j)=>j===i?{...x,model:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Serial casco (HIN)</label><input value={d2.hullSerial} onChange={e=>setDinghyList(l=>l.map((x,j)=>j===i?{...x,hullSerial:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Motor marca</label><input value={d2.motorMake} onChange={e=>setDinghyList(l=>l.map((x,j)=>j===i?{...x,motorMake:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Motor modelo</label><input value={d2.motorModel} onChange={e=>setDinghyList(l=>l.map((x,j)=>j===i?{...x,motorModel:e.target.value}:x))} style={s.input}/></div>
                      <div><label style={{...s.label,fontSize:11}}>Serial motor</label><input value={d2.motorSerial} onChange={e=>setDinghyList(l=>l.map((x,j)=>j===i?{...x,motorSerial:e.target.value}:x))} style={s.input}/></div>
                    </div>
                  </div>
                : <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{fontWeight:600,fontSize:12,color:"#0891b2",marginBottom:6}}>{d2.type} — {d2.make} {d2.model}</div>
                    {[["Serial casco",d2.hullSerial],["Motor",`${d2.motorMake} ${d2.motorModel}`],["Serial motor",d2.motorSerial]].map(([k,v])=>(
                      <div key={k} style={{...s.detailRow,padding:"4px 0"}}><span style={s.detailKey}>{k}</span><span style={s.detailVal}>{v||"—"}</span></div>
                    ))}
                  </div>
            ))}
          </div>

          {/* TRIPULACIÓN */}
          <div style={{marginBottom:18}}>
            <div style={s.secTitle}>Tripulación</div>
            {crew.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:c.primary?"#f0f9ff":"#f8fafc",borderRadius:8,marginBottom:6,border:`1px solid ${c.primary?"#bae6fd":"#e2e8f0"}`}}>
                <span style={{fontSize:16}}>{ROLE_ICON[c.role]||"👤"}</span>
                <span style={{flex:1,fontWeight:600,fontSize:13,color:"#0f172a"}}>{c.name}</span>
                {editMode&&<select value={c.role} onChange={e=>setCrewRole(i,e.target.value)} style={{...s.input,width:110,padding:"3px 6px",fontSize:11}}>
                  {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </select>}
                {!editMode&&<span style={{fontSize:11,color:"#64748b",background:"#e2e8f0",padding:"2px 8px",borderRadius:20}}>{c.role}</span>}
                <button onClick={()=>setPrimary(i)} title={c.primary?"Quitar como principal":"Marcar como principal"} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:c.primary?"#f59e0b":"#d1d5db"}}>★</button>
                {editMode&&<button onClick={()=>rmCrew(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:13}}>✕</button>}
              </div>
            ))}
            {editMode&&<div style={{display:"flex",gap:8,marginTop:10}}>
              <input value={newCrew} onChange={e=>setNewCrew(e.target.value)} placeholder="Nombre del tripulante..." style={{...s.input,flex:1}}/>
              <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={{...s.input,width:110}}>
                {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <button style={s.btnPrimary} onClick={addCrew}>Agregar</button>
            </div>}
          </div>

        </div>
        <div style={s.modalFooter}>
          <button style={s.btnOutline} onClick={onClose}>Cerrar</button>
          {editMode&&<button style={s.btnPrimary} onClick={saveAll}>💾 Guardar Cambios</button>}
        </div>
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
                <div>
                  <label style={s.label}>Especialidad</label>
                  <select value={SEGMENTS.slice(0,-1).includes(form.segment)?form.segment:"Otro"} onChange={e=>{if(e.target.value!=="Otro")set("segment",e.target.value);else set("segment","");}} style={s.input}>
                    <option value="">Seleccionar...</option>
                    {SEGMENTS.map(sg=><option key={sg} value={sg}>{sg}</option>)}
                  </select>
                  {(!SEGMENTS.slice(0,-1).includes(form.segment)||form.segment==="")&&<input value={form.segment} onChange={e=>set("segment",e.target.value)} placeholder="Escribe la especialidad y se guardará..." style={{...s.input,marginTop:6}}/>}
                </div>
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
  root:       { minHeight:"100vh", background:"linear-gradient(180deg,#f4f9ff 0%,#eaf2fb 100%)", fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:"#1e293b", fontSize:13 },
  nav:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", height:56, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(8px)", borderBottom:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(10,37,64,0.06)", position:"sticky", top:0, zIndex:20, gap:12, width:"100%", maxWidth:"100vw", boxSizing:"border-box" },
  navLogo:    { display:"flex", alignItems:"center", gap:10, cursor:"pointer", flexShrink:0 },
  navBrand:   { fontSize:19, fontWeight:800, color:"#0a2540", letterSpacing:"-0.6px", fontFamily:"'Sora',system-ui,sans-serif" },
  navLinks:   { display:"flex", gap:0, flex:1, justifyContent:"center" },
  navLink:    { padding:"18px 11px", background:"none", border:"none", cursor:"pointer", fontSize:12, transition:"all 0.15s", whiteSpace:"nowrap" },
  navRight:   { display:"flex", alignItems:"center", gap:10, flexShrink:0, paddingRight:4 },
  provBtn:    { padding:"5px 11px", border:"1.5px solid #e2e8f0", borderRadius:6, background:"#f8fafc", cursor:"pointer", fontSize:12, fontWeight:500, color:"#1e293b", whiteSpace:"nowrap" },
  vesselSelector: { display:"flex", alignItems:"center", gap:7, padding:"5px 10px", border:"1.5px solid #e2e8f0", borderRadius:8, background:"#f8fafc", cursor:"pointer", fontSize:12 },
  dot:        { width:8, height:8, borderRadius:"50%", flexShrink:0 },
  drop:       { position:"absolute", top:"calc(100% + 6px)", right:0, background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, zIndex:30, minWidth:220, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", overflow:"hidden" },
  dropItem:   { display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 14px", border:"none", borderBottom:"1px solid #f1f5f9", cursor:"pointer", textAlign:"left", background:"#fff" },
  userBtn:    { display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:8, flexShrink:0 },
  bellWrap:   { position:"relative" },
  bellBadge:  { position:"absolute", top:-4, right:-4, background:"#ef4444", color:"#fff", fontSize:9, fontWeight:700, width:16, height:16, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" },
  navAvatar:  { width:32, height:32, borderRadius:"50%", background:"linear-gradient(120deg,#2563eb,#0ea5e9)", color:"#fff", fontWeight:700, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center" },
  navName:    { fontSize:12, fontWeight:600, color:"#0f172a", maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  navRole:    { fontSize:10, color:"#94a3b8", maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  body:       { padding:"20px 24px", maxWidth:1440, margin:"0 auto" },
  home:       { display:"flex", flexDirection:"column", gap:16 },
  row:        { display:"flex", gap:16, alignItems:"stretch" },
  card:       { background:"#fff", border:"1px solid #eaf1f8", borderRadius:16, padding:"18px 22px", boxShadow:"0 4px 20px rgba(10,37,64,0.06)", flex:1 },
  cardHdr:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 },
  cardTitle:  { fontSize:14, fontWeight:700, color:"#0a2540", fontFamily:"'Sora',system-ui,sans-serif" },
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
  btnPrimary: { padding:"8px 16px", background:"linear-gradient(120deg,#2563eb,#0ea5e9)", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 8px rgba(37,99,235,0.25)", fontFamily:"'Sora',system-ui,sans-serif" },
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
  detailRow:  { display:"grid", gridTemplateColumns:"160px 1fr", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f1f5f9", gap:12 },
  detailKey:  { fontSize:12, color:"#94a3b8", flexShrink:0 },
  detailVal:  { fontSize:12, fontWeight:600, color:"#1e293b" },
  label:      { display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 },
  input:      { width:"100%", padding:"8px 11px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:13, color:"#1e293b", background:"#fff", boxSizing:"border-box", outline:"none" },
  errMsg:     { fontSize:11, color:"#dc2626", marginTop:3 },
  typeChip:   { padding:"5px 13px", border:"1.5px solid", borderRadius:20, fontSize:12, cursor:"pointer", transition:"all 0.15s" },
  photoUpload: { border:"2px dashed #bae6fd", borderRadius:10, padding:14, textAlign:"center", background:"#f0f9ff" },
};
// ── CAPTAIN MANAGER MODAL ─────────────────────────────────────────────────────
function CaptainManagerModal({ vessel, user, onClose }) {
  const [captains, setCaptains]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [form, setForm]           = useState({ email:"", full_name:"", role:"Capitán", phone:"" });
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");

  useEffect(() => { loadCaptains(); }, []);

  const loadCaptains = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("captain_profiles")
      .select("*, user:user_id(email)")
      .eq("vessel_id", vessel.id);
    setCaptains(data || []);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!form.email.trim() || !form.full_name.trim()) { setMsg("Completa nombre y email"); return; }
    setSaving(true); setMsg("");
    try {
      // 1. Buscar si el usuario ya existe en auth
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", form.email.trim())
        .single();

      if (!profile) {
        setMsg("⚠️ Ese email no tiene cuenta en Carive. Pídele que se registre primero en nautitrack.vercel.app");
        setSaving(false); return;
      }

      // 2. Agregar a captain_profiles
      const { error } = await supabase.from("captain_profiles").insert({
        user_id:   profile.id,
        vessel_id: vessel.id,
        full_name: form.full_name.trim(),
        role:      form.role,
        phone:     form.phone.trim(),
        active:    true,
      });

      if (error) { setMsg("Error: " + error.message); setSaving(false); return; }

      setMsg("✅ Capitán agregado. La próxima vez que inicie sesión verá la vista de capitán.");
      setForm({ email:"", full_name:"", role:"Capitán", phone:"" });
      setAdding(false);
      loadCaptains();
    } catch(e) {
      setMsg("Error: " + e.message);
    }
    setSaving(false);
  };

  const toggleActive = async (cap) => {
    await supabase.from("captain_profiles").update({ active: !cap.active }).eq("id", cap.id);
    loadCaptains();
  };

  const remove = async (cap) => {
    if (!confirm(`¿Eliminar acceso de ${cap.full_name}?`)) return;
    await supabase.from("captain_profiles").delete().eq("id", cap.id);
    loadCaptains();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:560,boxShadow:"0 30px 80px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>⚓ Capitanes y Tripulación</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2}}>{vessel.name}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16}}>✕</button>
        </div>

        <div style={{padding:24}}>
          {/* Lista de capitanes */}
          {loading && <div style={{textAlign:"center",padding:20,color:"#64748b"}}>⏳ Cargando...</div>}

          {!loading && captains.length === 0 && !adding && (
            <div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
              <div style={{fontSize:40,marginBottom:12}}>⚓</div>
              <div style={{fontWeight:600,color:"#475569"}}>Sin capitanes asignados</div>
              <div style={{fontSize:12,marginTop:6}}>Agrega un capitán para que pueda acceder a la app</div>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {captains.map(cap=>(
              <div key={cap.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:cap.active?"#f0fdf4":"#f8fafc",border:`1px solid ${cap.active?"#bbf7d0":"#e2e8f0"}`,borderRadius:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,flexShrink:0}}>
                  {cap.full_name?.[0]||"?"}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{cap.full_name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{cap.role} · {cap.user?.email||""}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:11,fontWeight:600,color:cap.active?"#16a34a":"#94a3b8"}}>{cap.active?"Activo":"Inactivo"}</span>
                  <button onClick={()=>toggleActive(cap)} style={{padding:"4px 8px",border:"1px solid #e2e8f0",borderRadius:6,background:"#fff",cursor:"pointer",fontSize:11,color:"#475569"}}>
                    {cap.active?"Suspender":"Activar"}
                  </button>
                  <button onClick={()=>remove(cap)} style={{padding:"4px 6px",border:"none",background:"none",cursor:"pointer",color:"#dc2626",fontSize:14}}>🗑</button>
                </div>
              </div>
            ))}
          </div>

          {/* Formulario agregar */}
          {adding ? (
            <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:16}}>
              <div style={{fontWeight:700,fontSize:13,color:"#0369a1",marginBottom:12}}>Agregar capitán / tripulante</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:4}}>Nombre completo *</label>
                    <input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Carlos Mendoza" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:4}}>Rol</label>
                    <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,boxSizing:"border-box"}}>
                      <option>Capitán</option>
                      <option>Primer Oficial</option>
                      <option>Marinero</option>
                      <option>Mecánico</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:4}}>Email (debe tener cuenta en Carive) *</label>
                  <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="capitan@email.com" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:600,color:"#374151",marginBottom:4}}>Teléfono</label>
                  <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+58412..." style={{width:"100%",padding:"8px 10px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,boxSizing:"border-box"}}/>
                </div>
              </div>
              {msg && <div style={{marginTop:10,padding:"8px 12px",background:msg.startsWith("✅")?"#f0fdf4":"#fff7ed",border:`1px solid ${msg.startsWith("✅")?"#bbf7d0":"#fed7aa"}`,borderRadius:7,fontSize:12,color:msg.startsWith("✅")?"#16a34a":"#c2410c"}}>{msg}</div>}
              <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                <button onClick={()=>{setAdding(false);setMsg("");}} style={{padding:"8px 16px",border:"1.5px solid #e2e8f0",borderRadius:7,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
                <button onClick={handleInvite} disabled={saving} style={{padding:"8px 16px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:7,color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,opacity:saving?0.6:1}}>
                  {saving?"⏳ Guardando...":"✓ Agregar"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setAdding(true)} style={{width:"100%",padding:"11px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              ＋ Agregar Capitán / Tripulante
            </button>
          )}

          {/* Instrucciones */}
          <div style={{marginTop:16,padding:"10px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,color:"#64748b",lineHeight:1.6}}>
            💡 El capitán debe crear su cuenta en <strong>nautitrack.vercel.app</strong> primero. Una vez agregado aquí, al iniciar sesión verá automáticamente la vista de capitán de este barco.
          </div>
        </div>
      </div>
    </div>
  );
}
