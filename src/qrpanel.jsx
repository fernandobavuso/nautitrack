// Panel QR — para el dueño, dentro de la app
// Genera QR del barco + muestra log de crew en tiempo real

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

export default function QRPanel({ vessel, onClose }) {
  const [crewLogs, setCrewLogs] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [copied,   setCopied]   = useState(false);
  const qrRef = useRef(null);

  const checkinUrl = `${window.location.origin}/checkin?v=${vessel.id}`;

  useEffect(()=>{
    loadLogs();
    // Generar QR con API pública (no requiere lib)
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkinUrl)}&margin=10&color=1e3a5f`;
    if (qrRef.current) qrRef.current.src = qrApiUrl;
  },[vessel.id]);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crew_logs").select("*")
      .eq("vessel_id", vessel.id)
      .order("timestamp", { ascending:false }).limit(20);
    setCrewLogs(data||[]);
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  const printQR = () => {
    const w = window.open("","_blank");
    w.document.write(`
      <html><head><title>QR Check-in — ${vessel.name}</title>
      <style>
        body { font-family:'Segoe UI',sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#fff; }
        .box { border:3px solid #1e3a5f; border-radius:20px; padding:32px 40px; text-align:center; max-width:360px; }
        .logo { font-size:13px; color:#94a3b8; letter-spacing:0.15em; margin-bottom:16px; }
        h2 { font-size:24px; color:#0f172a; margin:0 0 4px; }
        .sub { font-size:14px; color:#64748b; margin-bottom:20px; }
        img { border-radius:12px; }
        .inst { margin-top:20px; font-size:13px; color:#475569; line-height:1.6; }
        .url { margin-top:12px; font-size:10px; color:#94a3b8; word-break:break-all; }
        @media print { body { -webkit-print-color-adjust:exact; } }
      </style></head><body>
      <div class="box">
        <div class="logo">NAUTITRACK.VZ</div>
        <h2>🚢 ${vessel.name}</h2>
        <div class="sub">${vessel.marina||""}</div>
        <img src="${`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkinUrl)}&margin=10&color=1e3a5f`}" width="240" height="240"/>
        <div class="inst">📱 Escanea para registrar<br/>tu <strong>Check-in / Check-out</strong></div>
        <div class="url">${checkinUrl}</div>
      </div>
      </body></html>
    `);
    w.document.close();
    setTimeout(()=>w.print(), 500);
  };

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit",hour12:true});
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("es-VE",{weekday:"short",day:"numeric",month:"short"});

  // Quién está a bordo ahora (último action por persona)
  const onBoard = (() => {
    const byName = {};
    [...crewLogs].reverse().forEach(l=>{ byName[l.crew_name]=l; });
    return Object.values(byName).filter(l=>l.action==="checkin");
  })();

  return (
    <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={s.modal}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>📱 QR de Check-in</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2}}>{vessel.name}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,padding:24}}>

          {/* Columna izquierda — QR */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
            <div style={{background:"#fff",border:"3px solid #1e3a5f",borderRadius:16,padding:12,boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}}>
              <img ref={qrRef} width={200} height={200} alt="QR Check-in" style={{display:"block",borderRadius:8}}/>
            </div>
            <div style={{fontSize:11,color:"#64748b",textAlign:"center",lineHeight:1.5}}>
              Imprime y pega este QR en el barco.<br/>La tripulación escanea con cualquier celular.
            </div>
            <div style={{display:"flex",gap:8,width:"100%"}}>
              <button onClick={printQR} style={{...s.btn,flex:1,background:"linear-gradient(135deg,#1e3a5f,#2563eb)"}}>
                🖨️ Imprimir QR
              </button>
              <button onClick={copyLink} style={{...s.btn,flex:1,background:copied?"#16a34a":"#475569"}}>
                {copied?"✓ Copiado":"📋 Copiar link"}
              </button>
            </div>
            <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",wordBreak:"break-all",padding:"0 4px"}}>
              {checkinUrl}
            </div>
          </div>

          {/* Columna derecha — A bordo + log */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* A bordo ahora */}
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"12px 16px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#15803d",marginBottom:8}}>
                🟢 A BORDO AHORA ({onBoard.length})
              </div>
              {onBoard.length===0&&(
                <div style={{fontSize:12,color:"#64748b"}}>Nadie registrado a bordo</div>
              )}
              {onBoard.map(l=>(
                <div key={l.id} style={{fontSize:12,color:"#15803d",marginBottom:4}}>
                  👤 <strong>{l.crew_name}</strong> · {l.crew_role} · desde {fmtTime(l.timestamp)}
                </div>
              ))}
            </div>

            {/* Log reciente */}
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                ACTIVIDAD RECIENTE
                <button onClick={loadLogs} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#94a3b8"}}>↺ Actualizar</button>
              </div>
              {loading&&<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:20}}>⏳ Cargando...</div>}
              <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:280,overflowY:"auto"}}>
                {crewLogs.map(l=>(
                  <div key={l.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",
                    background:l.action==="checkin"?"#f0fdf4":"#fff5f5",
                    border:`1px solid ${l.action==="checkin"?"#bbf7d0":"#fecaca"}`,
                    borderRadius:8}}>
                    <span style={{fontSize:14}}>{l.action==="checkin"?"✅":"🔴"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#0f172a"}}>{l.crew_name}</div>
                      <div style={{fontSize:10,color:"#64748b"}}>{l.crew_role}</div>
                    </div>
                    <div style={{textAlign:"right",fontSize:10,color:"#64748b"}}>
                      <div style={{fontWeight:600}}>{fmtTime(l.timestamp)}</div>
                      <div>{fmtDate(l.timestamp)}</div>
                    </div>
                  </div>
                ))}
                {!loading&&crewLogs.length===0&&(
                  <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"20px 0"}}>
                    Sin registros aún
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: { position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20 },
  modal:   { background:"#fff",borderRadius:20,width:"100%",maxWidth:720,boxShadow:"0 30px 80px rgba(0,0,0,0.3)",overflow:"hidden",maxHeight:"90vh",overflowY:"auto" },
  header:  { background:"linear-gradient(135deg,#1e3a5f,#2563eb)",padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center" },
  btn:     { padding:"9px 12px",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer" },
};