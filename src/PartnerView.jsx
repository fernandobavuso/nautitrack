// Vista de SOCIO (solo lectura) — para socios de negocio como co-dueños de barcos
// específicos. Ve bitácora (con fotos), tareas, calendario y gastos SOLO de los
// barcos que el gestor le asignó. Sin botones de crear/editar/eliminar; el candado
// real está en los permisos de la base (vessel_partners + políticas de lectura).
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import CalendarPage from "./CalendarPage.jsx";
import { photoUrl } from "./PaymentFields.jsx";

const fmtD = (d) => { if(!d) return "—"; const p=String(d).split("-"); return p.length===3?`${p[1]}/${p[2]}/${p[0]}`:d; };
const money = (n) => "$" + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2});

export default function PartnerView({ user, onLogout }) {
  const { lang, setLang } = useLang();
  const L = (es,en)=>lang==="en"?en:es;
  const [vessels, setVessels] = useState([]);
  const [vid, setVid]         = useState(null);
  const [tab, setTab]         = useState("log");
  const [log, setLog]         = useState([]);
  const [tasks, setTasks]     = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openEntry, setOpenEntry] = useState(null);

  // Barcos a los que este socio tiene acceso (la política de lectura hace el filtro)
  useEffect(()=>{ (async()=>{
    const { data: links } = await supabase.from("vessel_partners")
      .select("vessel_id").eq("partner_id", user.id).eq("status","active");
    const ids = (links||[]).map(l=>l.vessel_id);
    if (!ids.length) { setLoading(false); return; }
    const { data: vs } = await supabase.from("vessels").select("*").in("id", ids).order("name");
    setVessels(vs||[]);
    setVid(vs?.[0]?.id||null);
    setLoading(false);
  })(); },[user.id]);

  // Datos del barco elegido
  useEffect(()=>{ if(!vid) return; (async()=>{
    const [{ data: lg }, { data: tk }, { data: ex }] = await Promise.all([
      supabase.from("log_entries").select("*").eq("vessel_id", vid).order("date",{ascending:false}),
      supabase.from("tasks").select("*").eq("vessel_id", vid).order("next_due"),
      supabase.from("expenses").select("*").eq("vessel_id", vid).order("expense_date",{ascending:false}),
    ]);
    setLog(lg||[]); setTasks(tk||[]); setExpenses(ex||[]);
  })(); },[vid]);

  const vessel = vessels.find(v=>v.id===vid);

  // Estado de tarea calculado con la fecha de hoy (igual que la app del gestor)
  const tStatus = (t) => {
    if (t.status==="done") return { l:L("Completada","Done"), bg:"#64748b", c:"#fff" };
    if (t.next_due) {
      const today=new Date(); today.setHours(0,0,0,0);
      const days=Math.round((new Date(t.next_due+"T00:00:00")-today)/86400000);
      if (days<0)  return { l:L("Vencida","Overdue"), bg:"#ef4444", c:"#fff" };
      if (days<=7) return { l:L("Esta semana","This week"), bg:"#f59e0b", c:"#fff" };
      if (days<=30)return { l:L("Próxima","Upcoming"), bg:"#fde68a", c:"#92400e" };
    }
    return { l:L("Al día","On track"), bg:"#dcfce7", c:"#166534" };
  };

  const logTypeIcon = { Salida:"⛵", Compra:"🧾", Combustible:"⛽", Servicio:"🔧", Visita:"👋", Incidente:"⚠️" };

  // Vessel con tareas embebidas para que CalendarPage funcione en modo lectura
  const vesselForCal = vessel ? { ...vessel, tasks: tasks.map(t=>({ ...t, nextDue:t.next_due, name:t.name })) } : null;

  const monthNow = new Date().toISOString().slice(0,7);
  const expMonth = expenses.filter(e=>String(e.expense_date||"").slice(0,7)===monthNow);
  const expMonthTotal = expMonth.reduce((a,e)=>a+Number(e.amount||0),0);

  if (loading) return <div style={{padding:60,textAlign:"center",color:"#94a3b8"}}>{L("Cargando...","Loading...")}</div>;

  if (!vessels.length) return (
    <div style={{padding:"60px 20px",textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:700,color:"#334155"}}>{L("Aún no tienes barcos asignados","No vessels assigned yet")}</div>
      <div style={{fontSize:13,color:"#94a3b8",marginTop:6}}>{L("Pide al gestor de la flota que te asigne los barcos.","Ask the fleet manager to assign your vessels.")}</div>
      <button onClick={onLogout} style={{marginTop:16,padding:"9px 18px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",color:"#334155",fontSize:13,cursor:"pointer"}}>{L("Cerrar sesión","Log out")}</button>
    </div>
  );

  const tabBtn = (key,label)=>(
    <button key={key} onClick={()=>setTab(key)}
      style={{padding:"8px 14px",border:"none",borderBottom:tab===key?"2.5px solid #0ea5e9":"2.5px solid transparent",background:"none",fontSize:13,fontWeight:tab===key?700:500,color:tab===key?"#0369a1":"#64748b",cursor:"pointer"}}>
      {label}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"system-ui,-apple-system,sans-serif"}}>
      {/* Barra superior */}
      <div style={{background:"#0a2540",color:"#fff",padding:"12px 18px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontSize:15,fontWeight:800}}>Carive</div>
          <div style={{fontSize:11,opacity:0.75}}>{L("Vista de socio · solo lectura","Partner view · read only")}</div>
        </div>
        <button onClick={()=>setLang(lang==="es"?"en":"es")} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:7,color:"#fff",fontSize:11,fontWeight:700,padding:"6px 10px",cursor:"pointer"}}>{lang==="es"?"EN":"ES"}</button>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:7,color:"#fff",fontSize:11,fontWeight:600,padding:"6px 10px",cursor:"pointer"}}>{L("Salir","Log out")}</button>
      </div>

      {/* Selector de barcos */}
      <div style={{padding:"12px 18px 0",display:"flex",gap:8,flexWrap:"wrap"}}>
        {vessels.map(v=>(
          <button key={v.id} onClick={()=>setVid(v.id)}
            style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${vid===v.id?"#0ea5e9":"#e2e8f0"}`,background:vid===v.id?"#eff6ff":"#fff",color:vid===v.id?"#0369a1":"#475569",fontSize:13,fontWeight:vid===v.id?700:500,cursor:"pointer"}}>
            {v.name}
          </button>
        ))}
      </div>

      {/* Pestañas */}
      <div style={{display:"flex",gap:2,padding:"8px 18px 0",borderBottom:"1px solid #e2e8f0",overflowX:"auto"}}>
        {tabBtn("log", L("Bitácora","Logbook"))}
        {tabBtn("tasks", L("Tareas","Tasks"))}
        {tabBtn("cal", L("Calendario","Calendar"))}
        {tabBtn("costs", L("Gastos","Expenses"))}
      </div>

      <div style={{padding:"16px 18px",maxWidth:900}}>

        {/* BITÁCORA */}
        {tab==="log" && (
          log.length===0
            ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Sin entradas de bitácora.","No log entries.")}</div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {log.map(e=>(
                  <div key={e.id} style={{background:"#fff",border:"1px solid #f1f5f9",borderRadius:10,padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:14}}>{logTypeIcon[e.type]||"📋"}</span>
                      <span style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{e.type}</span>
                      <span style={{fontSize:12,color:"#94a3b8"}}>{fmtD(e.date)}</span>
                      {e.performed_by && <span style={{fontSize:11,background:"#f1f5f9",color:"#64748b",borderRadius:20,padding:"2px 9px"}}>{e.performed_by}</span>}
                    </div>
                    <div style={{fontSize:13,color:"#334155",marginTop:6,lineHeight:1.5}}>
                      {e.type==="Salida"
                        ? `${e.dest||""} · ${e.persons||"—"}p · ${e.dept_time||"—"} → ${e.arr_time||L("Pendiente","Pending")}`
                        : e.type==="Compra"
                          ? `${e.item||""} · ${money(e.cost_usd)}`
                          : (openEntry===e.id || (e.description||"").length<=140)
                            ? (e.description||"—")
                            : <>{(e.description||"").slice(0,140)}…{" "}
                                <button onClick={()=>setOpenEntry(e.id)} style={{background:"none",border:"none",color:"#2563eb",fontSize:12,cursor:"pointer",padding:0}}>{L("ver todo","show all")}</button>
                              </>}
                      {openEntry===e.id && (e.description||"").length>140 &&
                        <button onClick={()=>setOpenEntry(null)} style={{background:"none",border:"none",color:"#2563eb",fontSize:12,cursor:"pointer",padding:0,marginLeft:6}}>{L("ver menos","show less")}</button>}
                    </div>
                    {e.equipment && <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{L("Equipo:","Equipment:")} {e.equipment}</div>}
                    {Array.isArray(e.photos)&&e.photos.length>0 && (
                      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                        {e.photos.map((ph,i)=>(
                          <a key={i} href={photoUrl(ph)} target="_blank" rel="noreferrer">
                            <img src={photoUrl(ph)} alt="" style={{width:64,height:64,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"}}/>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
        )}

        {/* TAREAS */}
        {tab==="tasks" && (
          tasks.length===0
            ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Sin tareas.","No tasks.")}</div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {tasks.map(t=>{
                  const st=tStatus(t);
                  return (
                    <div key={t.id} style={{background:"#fff",border:"1px solid #f1f5f9",borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:180}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{t.name}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                          {[t.system, t.equipment, t.assigned].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{t.next_due?fmtD(t.next_due):"—"}</div>
                      <span style={{fontSize:11,fontWeight:700,background:st.bg,color:st.c,borderRadius:20,padding:"3px 10px",whiteSpace:"nowrap"}}>{st.l}</span>
                    </div>
                  );
                })}
              </div>
        )}

        {/* CALENDARIO (reutiliza el de la app en modo un-barco) */}
        {tab==="cal" && vesselForCal && (
          <div style={{margin:"-16px -18px"}}>
            <CalendarPage vessel={vesselForCal} vessels={[vesselForCal]} isMobile={false}/>
          </div>
        )}

        {/* GASTOS */}
        {tab==="costs" && (
          <>
            <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",gap:16,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{L("Este mes","This month")}</div>
                <div style={{fontSize:22,fontWeight:800,color:"#0f172a"}}>{money(expMonthTotal)}</div>
              </div>
              <div>
                <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{L("Movimientos","Transactions")}</div>
                <div style={{fontSize:22,fontWeight:800,color:"#0f172a"}}>{expMonth.length}</div>
              </div>
            </div>
            {expenses.length===0
              ? <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:13}}>{L("Sin gastos registrados.","No expenses recorded.")}</div>
              : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {expenses.map(e=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#fff",border:"1px solid #f1f5f9",borderRadius:9}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>{e.category}</div>
                        <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {[e.description, fmtD(e.expense_date)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{fontSize:14,fontWeight:800,color:"#0f172a",whiteSpace:"nowrap"}}>{money(e.amount)}</div>
                    </div>
                  ))}
                </div>}
          </>
        )}
      </div>
    </div>
  );
}
