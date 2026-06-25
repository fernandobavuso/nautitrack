import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// Panel de administrador (solo visible para los correos en ADMIN_EMAILS)
// Tablero de ingresos: comisiones por venta + activación de planes

export const ADMIN_EMAILS = [
  "fernandobavuso@gmail.com",  // TODO Fernando: ajusta/añade tus correos de admin
];

export function isAdmin(user) {
  return user?.email && ADMIN_EMAILS.map(e=>e.toLowerCase()).includes(user.email.toLowerCase());
}

export default function AdminPanel({ user, onClose }) {
  const [tab, setTab] = useState("ingresos");
  const [sales, setSales] = useState([]);
  const [stores, setStores] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    // Ventas ganadas (con comisión) = subasta cerrada
    const { data: won } = await supabase.from("part_responses")
      .select("*, store:store_id(store_name,store_city), request:request_id(item_name,city)")
      .eq("is_winner", true).order("confirmed_at",{ascending:false});
    setSales(won||[]);
    // Tiendas
    const { data: st } = await supabase.from("profiles").select("*").eq("role","store");
    setStores(st||[]);
    // Embarcaciones (para activar planes)
    const { data: vs } = await supabase.from("vessels").select("id,name,details,owner_id");
    setVessels(vs||[]);
    setLoading(false);
  };

  // Activar plan a una embarcación
  const setPlan = async (vessel, plan) => {
    const details = { ...(vessel.details||{}) };
    details._subscription = { ...(details._subscription||{}), plan };
    await supabase.from("vessels").update({ details }).eq("id", vessel.id);
    setMsg(`Plan de ${vessel.name} actualizado a ${plan}`);
    setTimeout(()=>setMsg(""),3000);
    loadAll();
  };

  if (loading) return <Overlay onClose={onClose}><div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>Cargando...</div></Overlay>;

  // Totales de comisión (solo USD para el tablero)
  const totalCommission = sales.filter(s=>s.commission_amount).reduce((a,s)=>a+Number(s.commission_amount),0);
  const totalSales = sales.filter(s=>s.sale_amount&&s.currency==="USD").reduce((a,s)=>a+Number(s.sale_amount),0);

  // Comisión acumulada por tienda
  const byStore = {};
  sales.forEach(s => {
    if (!s.commission_amount) return;
    const id = s.store_id;
    if (!byStore[id]) byStore[id] = { name:s.store?.store_name||"Tienda", city:s.store?.store_city||"", total:0, count:0 };
    byStore[id].total += Number(s.commission_amount);
    byStore[id].count++;
  });
  const storeComm = Object.values(byStore).sort((a,b)=>b.total-a.total);

  return (
    <Overlay onClose={onClose}>
      <div style={{padding:"18px 22px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:17,fontWeight:800,color:"#0f172a"}}>Panel de Administrador</div>
          <div style={{fontSize:12,color:"#64748b"}}>Ingresos, comisiones y planes</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
      </div>

      <div style={{display:"flex",gap:6,padding:"12px 22px 0",borderBottom:"1px solid #e2e8f0"}}>
        {[{k:"ingresos",l:"Ingresos"},{k:"tiendas",l:"Comisiones por tienda"},{k:"planes",l:"Planes"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 14px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?700:500,color:tab===t.k?"#2563eb":"#64748b",borderBottom:tab===t.k?"2px solid #2563eb":"2px solid transparent",marginBottom:-1}}>{t.l}</button>
        ))}
      </div>

      <div style={{padding:22,overflowY:"auto"}}>
        {/* INGRESOS */}
        {tab==="ingresos"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
              <Stat label="COMISIONES GANADAS (USD)" value={`$ ${totalCommission.toLocaleString("es-VE",{maximumFractionDigits:2})}`} accent="#16a34a"/>
              <Stat label="VOLUMEN DE VENTAS (USD)" value={`$ ${totalSales.toLocaleString("es-VE",{maximumFractionDigits:0})}`}/>
              <Stat label="VENTAS CERRADAS" value={sales.length}/>
            </div>

            <div style={{fontSize:13,fontWeight:700,color:"#0f172a",marginBottom:10}}>Ventas recientes</div>
            {sales.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>Aún no hay ventas cerradas</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sales.map(s=>(
                <div key={s.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{s.request?.item_name||"Repuesto"}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{s.store?.store_name||"Tienda"}{s.confirmed_at?` · ${new Date(s.confirmed_at).toLocaleDateString("es-VE")}`:""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#16a34a"}}>+${s.commission_amount||0}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>venta ${s.sale_amount||0} · {s.commission_rate||0}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMISIONES POR TIENDA */}
        {tab==="tiendas"&&(
          <div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Comisiones acumuladas que cada tienda te debe. Cóbralas junto con su suscripción mensual.</div>
            {storeComm.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>Sin comisiones aún</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {storeComm.map((st,i)=>(
                <div key={i} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{st.name}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{st.city}{st.city?" · ":""}{st.count} venta{st.count!==1?"s":""}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:"#16a34a"}}>$ {st.total.toLocaleString("es-VE",{maximumFractionDigits:2})}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PLANES */}
        {tab==="planes"&&(
          <div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Activa o cambia el plan de cada embarcación cuando un cliente te pague.</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {vessels.map(v=>{
                const plan = v.details?._subscription?.plan || "free";
                return (
                  <div key={v.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{v.name}</div>
                      <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:plan==="free"?"#f1f5f9":"#dcfce7",color:plan==="free"?"#64748b":"#16a34a"}}>{plan==="free"?"Gratis":plan==="pro"?"Pro":"Flota"}</span>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {["free","pro","fleet"].map(p=>(
                        <button key={p} onClick={()=>setPlan(v,p)} disabled={plan===p} style={{flex:1,padding:"7px",borderRadius:7,border:"1px solid",cursor:plan===p?"default":"pointer",fontSize:12,fontWeight:700,
                          borderColor:plan===p?"#2563eb":"#e2e8f0", background:plan===p?"#eff6ff":"#fff", color:plan===p?"#2563eb":"#64748b"}}>{p==="free"?"Gratis":p==="pro"?"Pro":"Flota"}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {msg&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:4000}}>{msg}</div>}
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2600,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:680,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:16}}>
      <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:accent||"#0f172a"}}>{value}</div>
    </div>
  );
}
