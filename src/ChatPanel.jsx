import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// Chat interno entre dueño y tripulante (tras un match)
// Props: connection (con id), currentUserId, otherName, onClose
export default function ChatPanel({ connection, currentUserId, otherName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef();

  useEffect(() => {
    loadMessages();
    // Refrescar cada 4 segundos (polling simple)
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [connection.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase.from("messages")
      .select("*").eq("connection_id", connection.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
    // Marcar como leídos los del otro
    await supabase.from("messages").update({ read: true })
      .eq("connection_id", connection.id).neq("sender_id", currentUserId);
  };

  const send = async () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    // Optimista
    setMessages(m => [...m, { id: "tmp"+Date.now(), sender_id: currentUserId, body, created_at: new Date().toISOString() }]);
    await supabase.from("messages").insert({
      connection_id: connection.id, sender_id: currentUserId, body,
    });
    loadMessages();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:2000}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:480,height:"75vh",display:"flex",flexDirection:"column",boxShadow:"0 -4px 30px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{padding:"14px 18px",borderBottom:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{(otherName||"?")[0].toUpperCase()}</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>{otherName||"Chat"}</div>
              <div style={{fontSize:11,color:"#16a34a"}}>● Conectado</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8"}}>✕</button>
        </div>

        {/* Mensajes */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 18px",background:"#f8fafc",display:"flex",flexDirection:"column",gap:8}}>
          {loading && <div style={{textAlign:"center",color:"#94a3b8",fontSize:13}}>Cargando...</div>}
          {!loading && messages.length===0 && (
            <div style={{textAlign:"center",color:"#94a3b8",fontSize:13,margin:"auto"}}>
              <div style={{fontSize:32,marginBottom:8}}>💬</div>
              ¡Hicieron match! Escribe el primer mensaje para coordinar.
            </div>
          )}
          {messages.map(m => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} style={{alignSelf:mine?"flex-end":"flex-start",maxWidth:"75%"}}>
                <div style={{
                  padding:"9px 13px",borderRadius:mine?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background:mine?"linear-gradient(120deg,#2563eb,#0ea5e9)":"#fff",
                  color:mine?"#fff":"#1e293b",fontSize:13,lineHeight:1.4,
                  border:mine?"none":"1px solid #e2e8f0",
                }}>{m.body}</div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2,textAlign:mine?"right":"left"}}>
                  {new Date(m.created_at).toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            );
          })}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div style={{padding:"12px 16px",borderTop:"1px solid #e2e8f0",display:"flex",gap:8}}>
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="Escribe un mensaje..." style={{flex:1,padding:"10px 14px",border:"1.5px solid #e2e8f0",borderRadius:20,fontSize:13,outline:"none"}}/>
          <button onClick={send} style={{background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:"50%",width:40,height:40,cursor:"pointer",color:"#fff",fontSize:16}}>➤</button>
        </div>
      </div>
    </div>
  );
}
