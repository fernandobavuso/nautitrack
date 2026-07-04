import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// Mini "drive" de documentos por embarcación: carpetas + subir archivos reales
// o guardar links. Persiste en la tabla vessel_documents + Storage bucket "documentos".

export default function DocsManager({ vessel }) {
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]); // nombres de carpetas
  const [currentFolder, setCurrentFolder] = useState(""); // "" = raíz
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState(null); // null | "file" | "link" | "folder"
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newFolder, setNewFolder] = useState("");

  useEffect(() => { if (vessel?.id) load(); }, [vessel?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("vessel_documents")
      .select("*").eq("vessel_id", vessel.id).order("created_at", { ascending: false });
    const all = data || [];
    setDocs(all);
    // Derivar la lista de carpetas de los documentos + las creadas vacías (kind='folder')
    const fset = new Set();
    all.forEach(d => { if (d.folder) fset.add(d.folder); if (d.kind === "folder") fset.add(d.title); });
    setFolders([...fset].sort());
    setLoading(false);
  };

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  // Subir archivo real a Storage
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { flash("El archivo supera 50MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${vessel.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(path);
      const { error: insErr } = await supabase.from("vessel_documents").insert({
        vessel_id: vessel.id, owner_id: vessel.owner_id, folder: currentFolder,
        title: newTitle.trim() || file.name, kind: "file",
        url: urlData.publicUrl, file_path: path, file_size: file.size, mime_type: file.type,
      });
      if (insErr) throw insErr;
      flash("Documento cargado");
      setMode(null); setNewTitle("");
      load();
    } catch (err) {
      flash("Error: " + err.message);
    }
    setUploading(false);
  };

  // Guardar link
  const addLink = async () => {
    if (!newTitle.trim() || !newUrl.trim()) { flash("Completa título y URL"); return; }
    const url = newUrl.startsWith("http") ? newUrl : "https://" + newUrl;
    await supabase.from("vessel_documents").insert({
      vessel_id: vessel.id, owner_id: vessel.owner_id, folder: currentFolder,
      title: newTitle.trim(), kind: "link", url,
    });
    flash("Link agregado");
    setMode(null); setNewTitle(""); setNewUrl("");
    load();
  };

  // Crear carpeta (registro marcador kind='folder')
  const createFolder = async () => {
    if (!newFolder.trim()) { flash("Escribe un nombre de carpeta"); return; }
    if (folders.includes(newFolder.trim())) { flash("Ya existe esa carpeta"); return; }
    await supabase.from("vessel_documents").insert({
      vessel_id: vessel.id, owner_id: vessel.owner_id, folder: "",
      title: newFolder.trim(), kind: "folder",
    });
    flash("Carpeta creada");
    setMode(null); setNewFolder("");
    load();
  };

  const del = async (doc) => {
    if (!confirm(`¿Eliminar "${doc.title}"?`)) return;
    if (doc.file_path) await supabase.storage.from("documentos").remove([doc.file_path]);
    await supabase.from("vessel_documents").delete().eq("id", doc.id);
    flash("Eliminado");
    load();
  };

  const deleteFolder = async (folderName) => {
    const inside = docs.filter(d => d.folder === folderName && d.kind !== "folder");
    if (inside.length > 0) { flash("Vacía la carpeta antes de eliminarla"); return; }
    if (!confirm(`¿Eliminar la carpeta "${folderName}"?`)) return;
    // borrar el marcador de carpeta
    await supabase.from("vessel_documents").delete().eq("vessel_id", vessel.id).eq("kind", "folder").eq("title", folderName);
    flash("Carpeta eliminada");
    load();
  };

  if (loading) return <div style={{padding:30,textAlign:"center",color:"#94a3b8"}}>Cargando...</div>;

  // Documentos visibles en la carpeta actual (excluye marcadores de carpeta)
  const visibleDocs = docs.filter(d => d.kind !== "folder" && (d.folder || "") === currentFolder);

  return (
    <div>
      {/* Barra de acciones */}
      <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <div style={{fontSize:13,color:"#64748b"}}>
          {currentFolder ? (
            <span><button onClick={()=>setCurrentFolder("")} style={{background:"none",border:"none",color:"#2563eb",cursor:"pointer",fontWeight:600,padding:0}}>Documentos</button> / <strong>{currentFolder}</strong></span>
          ) : "Tus documentos, organizados en carpetas. Sube tus archivos a la nube."}
        </div>
        <div style={{display:"flex",gap:8}}>
          {!currentFolder && <button onClick={()=>setMode(mode==="folder"?null:"folder")} style={btnOutline}>Nueva carpeta</button>}
          <label style={{...btnPrimary,cursor:uploading?"default":"pointer",opacity:uploading?.6:1}}>
            {uploading ? "Subiendo..." : "Cargar documento"}
            <input type="file" style={{display:"none"}} onChange={handleFile} disabled={uploading}/>
          </label>
        </div>
      </div>

      {/* Panel nueva carpeta */}
      {mode==="folder" && (
        <div style={panel}>
          <div style={{fontWeight:700,fontSize:13,color:"#0369a1",marginBottom:10}}>Nueva carpeta</div>
          <div style={{display:"flex",gap:8}}>
            <input value={newFolder} onChange={e=>setNewFolder(e.target.value)} placeholder="Ej: Pólizas, Zarpes, Registros" style={{...inp,flex:1}}/>
            <button onClick={createFolder} style={btnPrimary}>Crear</button>
          </div>
        </div>
      )}

      {/* Panel agregar link */}
      {false && mode==="link" && (
        <div style={panel}></div>
      )}

      {/* Título opcional para el archivo a subir */}
      {!currentFolder && (
        <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Sugerencia: crea carpetas para organizar (Pólizas, Zarpes, Registros...) y entra en una antes de subir.</div>
      )}

      {/* Carpetas (solo en la raíz) */}
      {!currentFolder && folders.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:18}}>
          {folders.map(f=>{
            const count = docs.filter(d=>d.folder===f && d.kind!=="folder").length;
            return (
              <div key={f} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14,cursor:"pointer",position:"relative"}} onClick={()=>setCurrentFolder(f)}>
                <div style={{marginBottom:8}}><FolderIcon/></div>
                <div style={{fontSize:13,fontWeight:700,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f}</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{count} {count===1?"archivo":"archivos"}</div>
                <button onClick={(e)=>{e.stopPropagation();deleteFolder(f);}} style={{position:"absolute",top:8,right:8,background:"none",border:"none",cursor:"pointer",color:"#cbd5e1",fontSize:14}}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Documentos de la carpeta actual */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {visibleDocs.length===0 && folders.length===0 && !currentFolder && (
          <div style={{textAlign:"center",padding:"40px 20px",color:"#94a3b8"}}>
            <div style={{marginBottom:10,display:"flex",justifyContent:"center"}}><FileIcon size={34}/></div>
            <div style={{fontWeight:600}}>Aún no tienes documentos</div>
            <div style={{fontSize:12,marginTop:4}}>Sube registros, pólizas, zarpes, certificaciones... o guarda links</div>
          </div>
        )}
        {visibleDocs.length===0 && currentFolder && (
          <div style={{textAlign:"center",padding:"30px",color:"#94a3b8",fontSize:13}}>Esta carpeta está vacía. Sube un documento o agrega un link.</div>
        )}
        {visibleDocs.map(doc=>(
          <div key={doc.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:"#fff",border:"1px solid #e2e8f0",borderRadius:10}}>
            <span style={{flexShrink:0,color:doc.kind==="link"?"#0ea5e9":"#2563eb"}}>{doc.kind==="link"?<LinkIcon/>:<FileIcon/>}</span>
            <div style={{flex:1,minWidth:0}}>
              <a href={doc.url} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:600,color:"#2563eb",textDecoration:"none"}}>{doc.title}</a>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{doc.kind==="link"?"Link externo":formatSize(doc.file_size)}{doc.created_at?` · ${new Date(doc.created_at).toLocaleDateString("es-VE")}`:""}</div>
            </div>
            <a href={doc.url} target="_blank" rel="noreferrer" style={{...btnOutline,padding:"5px 12px",fontSize:11,textDecoration:"none"}}>Abrir</a>
            <button onClick={()=>del(doc)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12,fontWeight:600}}>Eliminar</button>
          </div>
        ))}
      </div>

      {msg && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0f172a",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:3000}}>{msg}</div>}
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024*1024) return `${Math.round(bytes/1024)} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

const FolderIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
);
const FileIcon = ({ size=20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
);
const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
);

const btnPrimary = {padding:"8px 16px",background:"linear-gradient(120deg,#2563eb,#0ea5e9)",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6};
const btnOutline = {padding:"8px 14px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:8,color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"};
const panel = {background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:16,marginBottom:16};
const inp = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",boxSizing:"border-box",outline:"none"};
