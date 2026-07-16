import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];

const STATUS_COLOR = {
  overdue: "#ef4444", due: "#f59e0b", ok: "#22c55e", done: "#64748b",
};
const SHIFT_COLOR = { "Agendado":"#d97706", "En proceso":"#2563eb", "Completado":"#16a34a" };

export default function CalendarPage({ vessel, isMobile }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [filter, setFilter] = useState("todo"); // todo | tareas | viajes
  const [trips, setTrips] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selected, setSelected] = useState(null); // evento seleccionado

  useEffect(() => {
    if (!vessel?.id || vessel.id === "__empty__") { setTrips([]); return; }
    supabase.from("day_trips").select("*").eq("vessel_id", vessel.id).then(({ data }) => setTrips(data || []));
    if (vessel.owner_id) {
      supabase.from("work_shifts").select("*").eq("manager_id", vessel.owner_id).eq("vessel_name", vessel.name).then(({ data }) => setShifts(data || []));
    }
  }, [vessel?.id]);

  // Construir lista de eventos combinada
  const events = [];
  if (filter === "todo" || filter === "tareas") {
    (vessel.tasks || []).forEach(t => {
      if (!t.nextDue) return;
      events.push({
        kind: "task", date: t.nextDue.slice(0, 10),
        title: t.name || "Tarea", sub: [t.system, t.equipment].filter(Boolean).join(" · "),
        color: STATUS_COLOR[t.status] || "#2563eb", raw: t,
      });
    });
  }
  if (filter === "todo" || filter === "turnos") {
    shifts.forEach(sh => {
      if (!sh.shift_date) return;
      events.push({
        kind: "shift", date: sh.shift_date.slice(0, 10),
        title: sh.person_name, sub: [sh.description, sh.hours ? `${sh.hours}h` : null].filter(Boolean).join(" · "),
        color: SHIFT_COLOR[sh.work_status] || "#d97706", raw: sh,
      });
    });
  }
  if (filter === "todo" || filter === "viajes") {
    trips.forEach(tp => {
      if (!tp.trip_date) return;
      const cancelled = tp.status === "cancelled";
      events.push({
        kind: "trip", date: tp.trip_date.slice(0, 10),
        title: `Day trip${cancelled ? " (cancelado)" : ""}`,
        sub: [tp.trip_type, tp.crew_role].filter(Boolean).join(" · "),
        color: cancelled ? "#94a3b8" : "#0ea5e9", raw: tp,
      });
    });
  }

  // Agrupar por día
  const byDay = {};
  events.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });

  // Grilla del mes
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const fmtKey = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div style={{maxWidth:1100,margin:"0 auto"}}>
      {/* Encabezado */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:"#0f172a",fontFamily:"'Sora',system-ui,sans-serif"}}>Calendario</div>
          <div style={{fontSize:13,color:"#64748b"}}>{vessel.name}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={goToday} style={btnGhost}>Hoy</button>
          <button onClick={prevMonth} style={btnIcon}>←</button>
          <div style={{fontSize:15,fontWeight:700,color:"#0f172a",minWidth:130,textAlign:"center"}}>{MESES[month]} {year}</div>
          <button onClick={nextMonth} style={btnIcon}>→</button>
        </div>
      </div>

      {/* Filtro */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{k:"todo",l:"Todo"},{k:"tareas",l:"Tareas"},{k:"turnos",l:"Turnos"},{k:"viajes",l:"Day trips"}].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:filter===f.k?700:500,background:filter===f.k?"linear-gradient(120deg,#2563eb,#0ea5e9)":"#f1f5f9",color:filter===f.k?"#fff":"#64748b"}}>{f.l}</button>
        ))}
      </div>

      {/* Grilla */}
      <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid #e2e8f0",background:"#f8fafc"}}>
          {DIAS.map(d=><div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:10,fontWeight:700,color:"#94a3b8"}}>{isMobile?d.slice(0,1):d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {cells.map((d,i)=>{
            const key = d ? fmtKey(d) : null;
            const dayEvents = key ? (byDay[key] || []) : [];
            return (
              <div key={i} style={{minHeight:isMobile?70:100,borderRight:(i%7!==6)?"1px solid #f1f5f9":"none",borderBottom:"1px solid #f1f5f9",padding:4,background:d&&isToday(d)?"#eff6ff":"#fff",position:"relative"}}>
                {d && (
                  <>
                    <div style={{fontSize:11,fontWeight:isToday(d)?800:600,color:isToday(d)?"#2563eb":"#64748b",textAlign:"right",padding:"2px 4px"}}>{d}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:2}}>
                      {dayEvents.slice(0, isMobile?2:3).map((e,j)=>(
                        <button key={j} onClick={()=>setSelected(e)} style={{textAlign:"left",background:e.color+"18",border:"none",borderLeft:`3px solid ${e.color}`,borderRadius:4,padding:"2px 4px",cursor:"pointer",overflow:"hidden"}}>
                          <div style={{fontSize:9,fontWeight:700,color:"#0f172a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.title}</div>
                        </button>
                      ))}
                      {dayEvents.length > (isMobile?2:3) && (
                        <div style={{fontSize:9,color:"#94a3b8",paddingLeft:4}}>+{dayEvents.length-(isMobile?2:3)} más</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div style={{display:"flex",gap:16,marginTop:14,flexWrap:"wrap",fontSize:11,color:"#64748b"}}>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#ef4444"}}/>Tarea vencida</span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#f59e0b"}}/>Tarea por vencer</span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#22c55e"}}/>Tarea al día</span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#d97706"}}/>Turno</span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#0ea5e9"}}/>Day trip</span>
      </div>

      {/* Detalle del evento */}
      {selected && (
        <div style={ov} onClick={()=>setSelected(null)}>
          <div style={box} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:12,height:12,borderRadius:4,background:selected.color}}/>
                <span style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase"}}>{selected.kind==="task"?"Tarea":selected.kind==="shift"?"Turno":"Day trip"}</span>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>×</button>
            </div>
            <div style={{fontSize:18,fontWeight:800,color:"#0a2540",fontFamily:"'Sora',system-ui,sans-serif",marginBottom:6}}>{selected.title}</div>
            {selected.sub && <div style={{fontSize:13,color:"#64748b",marginBottom:10}}>{selected.sub}</div>}
            <div style={{fontSize:13,color:"#475569"}}>📅 {new Date(selected.date+"T12:00:00").toLocaleDateString("es-VE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
            {selected.kind==="shift" && selected.raw.hours && <div style={{fontSize:13,color:"#475569",marginTop:4}}>⏱️ {selected.raw.hours}h × ${selected.raw.rate||0} = ${((Number(selected.raw.hours)||0)*(Number(selected.raw.rate)||0)).toLocaleString("en-US")}</div>}
            {selected.kind==="shift" && <div style={{fontSize:13,color:"#475569",marginTop:4}}>📌 {selected.raw.work_status} · {selected.raw.payment_status}</div>}
            {selected.kind==="trip" && selected.raw.departure_time && <div style={{fontSize:13,color:"#475569",marginTop:4}}>🕐 Salida: {selected.raw.departure_time}</div>}
            {selected.kind==="trip" && selected.raw.meeting_point && <div style={{fontSize:13,color:"#475569",marginTop:4}}>📍 {selected.raw.meeting_point}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const btnGhost = {padding:"7px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",color:"#2563eb",fontSize:12,fontWeight:700,cursor:"pointer"};
const btnIcon = {width:32,height:32,borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:14,cursor:"pointer"};
const ov = {position:"fixed",inset:0,background:"rgba(10,37,64,.5)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:20};
const box = {background:"#fff",borderRadius:18,padding:24,maxWidth:400,width:"100%",boxShadow:"0 20px 60px rgba(10,37,64,.25)"};
