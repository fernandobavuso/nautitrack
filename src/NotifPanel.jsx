import { useState, useEffect } from "react";
import { getNotifications, markAllRead } from "./notifications";

// Panel desplegable de notificaciones in-app
// Props: user, onClose, onNavigate(link)
export default function NotifPanel({ user, onClose, onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await getNotifications(user.id);
      setItems(data);
      setLoading(false);
      // Marcar como leídas al abrir
      await markAllRead(user.id);
    })();
  }, []);

  const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    return `hace ${Math.floor(diff/86400)} d`;
  };

  const ICON = {
    application: "📥", match: "🤝", review: "★",
    selected: "✓", trip_invite: "🧭", default: "•",
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.4)",zIndex:2500,display:"flex",justifyContent:"flex-end",alignItems:"flex-start"}} onClick={onClose}>
      <div style={{background:"#fff",width:"100%",maxWidth:380,maxHeight:"80vh",margin:"60px 16px 0 0",borderRadius:14,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.25)",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:15,fontWeight:800,color:"#0f172a"}}>Notificaciones</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {loading && <div style={{textAlign:"center",padding:30,color:"#94a3b8",fontSize:13}}>Cargando...</div>}
          {!loading && items.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px",color:"#94a3b8"}}>
              <div style={{fontSize:32,marginBottom:8}}>🔔</div>
              <div style={{fontSize:13,fontWeight:600}}>Sin notificaciones</div>
            </div>
          )}
          {items.map(n => (
            <div key={n.id} onClick={()=>{ if(n.link&&onNavigate){onNavigate(n.link);onClose();} }}
              style={{padding:"12px 18px",borderBottom:"1px solid #f1f5f9",display:"flex",gap:12,alignItems:"flex-start",cursor:n.link?"pointer":"default",background:n.read?"#fff":"#f0f9ff"}}>
              <div style={{fontSize:18,color:"#f59e0b",flexShrink:0,marginTop:1}}>{ICON[n.type]||ICON.default}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{n.title}</div>
                <div style={{fontSize:12,color:"#475569",lineHeight:1.4}}>{n.body}</div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
