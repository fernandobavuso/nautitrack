// Lista de compras — lo que hay que comprar para el barco o para la empresa.
// Al marcar "Comprado" se abre el registro de gasto ya pre-llenado, de modo que la
// lista es la entrada al flujo de gastos y no un apunte suelto que hay que volver
// a escribir en Finanzas.
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { useLang } from "./i18n.jsx";
import { accountHasFleet } from "./plans.jsx";
import { EXPENSE_CATEGORIES, catL } from "./PaymentFields.jsx";

const PRIOS = [
  { k: "urgente", es: "Urgente", en: "Urgent", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  { k: "normal",  es: "Normal",  en: "Normal", bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
];
const prioOf = (p) => PRIOS.find(x => x.k === p) || PRIOS[1];
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function ShoppingPage({ vessel, vessels, user, onRegisterExpense }) {
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const isFleet = accountHasFleet(vessels);

  const [scope, setScope]   = useState("vessel");   // vessel | company
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]       = useState("");
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm]     = useState({ name:"", qty:"1", system:"", category:"Repuestos", priority:"normal", vendor:"", notes:"" });
  const [effOwner, setEffOwner] = useState(null);

  // En cuentas de flota, la lista de empresa es compartida entre co-gestores
  const resolveOwner = async () => {
    const { data } = await supabase.from("fleet_managers")
      .select("fleet_owner_id").eq("manager_id", user.id).eq("status", "active").limit(1);
    const oid = data?.[0]?.fleet_owner_id || user.id;
    setEffOwner(oid);
    return oid;
  };

  const load = async (oid) => {
    setLoading(true);
    const owner = oid || effOwner || await resolveOwner();
    let q = supabase.from("shopping_items").select("*").order("created_at", { ascending: false });
    q = scope === "company"
      ? q.is("vessel_id", null).eq("owner_id", owner)
      : q.eq("vessel_id", vessel?.id);
    const { data, error } = await q;
    if (error) { setMsg("Error: " + error.message); setTimeout(() => setMsg(""), 4000); }
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { resolveOwner().then(oid => load(oid)); /* eslint-disable-next-line */ }, [vessel?.id, scope]);

  const add = async () => {
    if (!form.name.trim()) { setMsg(L("Escribe qué hay que comprar", "Enter what to buy")); setTimeout(() => setMsg(""), 3000); return; }
    const owner = effOwner || user.id;
    const { error } = await supabase.from("shopping_items").insert({
      owner_id: owner,
      vessel_id: scope === "company" ? null : vessel.id,
      name: form.name.trim(),
      qty: form.qty !== "" ? Number(form.qty) : 1,
      system: form.system.trim() || null,
      category: form.category,
      priority: form.priority,
      vendor: form.vendor.trim() || null,
      notes: form.notes.trim() || null,
      status: "pending",
      added_by: user.full_name || user.email,
    });
    if (error) { setMsg("Error: " + error.message); setTimeout(() => setMsg(""), 4000); return; }
    setForm({ name:"", qty:"1", system:"", category:"Repuestos", priority:"normal", vendor:"", notes:"" });
    setAdding(false);
    load();
  };

  const remove = async (it) => {
    if (!confirm(L(`¿Quitar "${it.name}" de la lista?`, `Remove "${it.name}" from the list?`))) return;
    const { error } = await supabase.from("shopping_items").delete().eq("id", it.id);
    if (error) { setMsg("Error: " + error.message); setTimeout(() => setMsg(""), 4000); return; }
    setItems(l => l.filter(x => x.id !== it.id));
  };

  // Marcar comprado: se cierra el ítem y se abre el registro de gasto pre-llenado
  const buy = async (it) => {
    const { data, error } = await supabase.from("shopping_items")
      .update({ status: "done", done_at: new Date().toISOString() }).eq("id", it.id).select();
    if (error || !data?.length) { setMsg("Error: " + (error?.message || L("no se pudo marcar", "couldn't update"))); setTimeout(() => setMsg(""), 4000); return; }
    setItems(l => l.map(x => x.id === it.id ? { ...x, status: "done" } : x));
    if (onRegisterExpense) {
      onRegisterExpense({
        item: it.qty > 1 ? `${it.name} (x${it.qty})` : it.name,
        category: it.category || "Repuestos",
        vendor: it.vendor || "",
        system: it.system || "",
      });
    }
  };

  const undo = async (it) => {
    await supabase.from("shopping_items").update({ status: "pending", done_at: null }).eq("id", it.id);
    setItems(l => l.map(x => x.id === it.id ? { ...x, status: "pending" } : x));
  };

  const pending = items.filter(i => i.status !== "done");
  const done    = items.filter(i => i.status === "done");
  const urgent  = pending.filter(i => i.priority === "urgente");

  const inp = { padding:"9px 11px", border:"1px solid #e2e8f0", borderRadius:8, fontSize:13, color:"#1e293b", boxSizing:"border-box", background:"#fff", width:"100%" };
  const lbl = { fontSize:11, fontWeight:700, color:"#64748b", display:"block", marginBottom:4 };

  return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>

      <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap", marginBottom:16 }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:20, fontWeight:800, color:"#0f172a" }}>{L("Lista de compras", "Shopping list")}</div>
          <div style={{ fontSize:13, color:"#64748b" }}>
            {scope === "company"
              ? L("Lo que hay que comprar para la empresa", "What to buy for the company")
              : L(`Lo que hay que comprar para ${vessel?.name || "el barco"}`, `What to buy for ${vessel?.name || "the vessel"}`)}
          </div>
        </div>
        <button onClick={() => setAdding(true)}
          style={{ padding:"9px 15px", background:"linear-gradient(120deg,#2563eb,#0ea5e9)", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          + {L("Agregar", "Add")}
        </button>
      </div>

      {isFleet && (
        <div style={{ display:"flex", gap:6, marginBottom:14 }}>
          {[{ k:"vessel", l: vessel?.name || L("Este barco","This vessel") }, { k:"company", l:L("Mi Empresa","My Company") }].map(o => (
            <button key={o.k} onClick={() => setScope(o.k)}
              style={{ padding:"6px 13px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight: scope===o.k?700:500,
                border:`1.5px solid ${scope===o.k?"#2563eb":"#e2e8f0"}`, background: scope===o.k?"#eff6ff":"#fff", color: scope===o.k?"#1e40af":"#64748b" }}>
              {o.l}
            </button>
          ))}
        </div>
      )}

      {msg && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#dc2626", marginBottom:12 }}>{msg}</div>}

      {/* Resumen */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:120, background:"#f8fafc", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:600 }}>{L("Por comprar", "To buy")}</div>
          <div style={{ fontSize:24, fontWeight:800, color:"#0f172a" }}>{pending.length}</div>
        </div>
        <div style={{ flex:1, minWidth:120, background:"#f8fafc", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:600 }}>{L("Urgentes", "Urgent")}</div>
          <div style={{ fontSize:24, fontWeight:800, color: urgent.length ? "#dc2626" : "#0f172a" }}>{urgent.length}</div>
        </div>
        <div style={{ flex:1, minWidth:120, background:"#f8fafc", borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:11, color:"#64748b", fontWeight:600 }}>{L("Comprados", "Purchased")}</div>
          <div style={{ fontSize:24, fontWeight:800, color:"#16a34a" }}>{done.length}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:"#94a3b8", fontSize:13 }}>{L("Cargando...", "Loading...")}</div>
      ) : (
        <>
          {pending.length === 0 ? (
            <div style={{ padding:"34px 14px", textAlign:"center", color:"#94a3b8", fontSize:13, border:"1px dashed #e2e8f0", borderRadius:10, marginBottom:16 }}>
              {L("La lista está vacía. Agrega lo que haga falta comprar.", "The list is empty. Add whatever needs buying.")}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              {[...pending].sort((a,b) => (a.priority === "urgente" ? -1 : 1) - (b.priority === "urgente" ? -1 : 1)).map(it => {
                const p = prioOf(it.priority);
                return (
                  <div key={it.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#fff", border:`1px solid ${p.border}`, borderRadius:10, flexWrap:"wrap" }}>
                    <div style={{ width:4, alignSelf:"stretch", borderRadius:2, background: it.priority === "urgente" ? "#dc2626" : "#cbd5e1" }} />
                    <div style={{ flex:1, minWidth:170 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>
                        {it.name}{it.qty > 1 ? <span style={{ color:"#64748b", fontWeight:500 }}> &times;{it.qty}</span> : null}
                      </div>
                      <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
                        {[catL(it.category, lang), it.system, it.vendor, it.added_by].filter(Boolean).join(" · ")}
                      </div>
                      {it.notes && <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{it.notes}</div>}
                    </div>
                    {it.priority === "urgente" && (
                      <span style={{ fontSize:10, fontWeight:700, background:p.bg, color:p.color, borderRadius:20, padding:"3px 10px" }}>
                        {lang === "en" ? p.en : p.es}
                      </span>
                    )}
                    <button onClick={() => buy(it)}
                      style={{ padding:"7px 14px", background:"#16a34a", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ✓ {L("Comprado", "Bought")}
                    </button>
                    <button onClick={() => remove(it)} title={L("Quitar", "Remove")}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#cbd5e1", fontSize:16, padding:2 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}

          {done.length > 0 && (
            <>
              <button onClick={() => setShowDone(v => !v)}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#2563eb", fontSize:12, fontWeight:700, padding:0, marginBottom:8 }}>
                {showDone ? L("Ocultar comprados", "Hide purchased") : L(`Ver ${done.length} comprados`, `Show ${done.length} purchased`)}
              </button>
              {showDone && (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {done.map(it => (
                    <div key={it.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"#f8fafc", borderRadius:9 }}>
                      <span style={{ color:"#16a34a", fontSize:13, fontWeight:700 }}>✓</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, color:"#64748b", textDecoration:"line-through" }}>{it.name}{it.qty > 1 ? ` ×${it.qty}` : ""}</div>
                        <div style={{ fontSize:10, color:"#cbd5e1" }}>
                          {it.done_at ? new Date(it.done_at).toLocaleDateString("en-US") : ""}
                        </div>
                      </div>
                      <button onClick={() => undo(it)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:11, fontWeight:600 }}>
                        {L("Deshacer", "Undo")}
                      </button>
                      <button onClick={() => remove(it)} style={{ background:"none", border:"none", cursor:"pointer", color:"#cbd5e1", fontSize:15 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Alta */}
      {adding && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:14, overflowY:"auto" }}>
          <div style={{ background:"#fff", borderRadius:16, padding:20, maxWidth:430, width:"100%", maxHeight:"92vh", overflowY:"auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ flex:1, fontSize:16, fontWeight:800, color:"#0f172a" }}>{L("Agregar a la lista", "Add to list")}</div>
              <button onClick={() => setAdding(false)} style={{ background:"none", border:"none", fontSize:20, color:"#94a3b8", cursor:"pointer", lineHeight:1 }}>✕</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
              <div>
                <label style={lbl}>{L("¿Qué hay que comprar?", "What needs buying?")}</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus
                  placeholder={L("Filtros Racor, ánodos, jabón...", "Racor filters, anodes, soap...")} style={inp} />
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <div style={{ width:90 }}>
                  <label style={lbl}>{L("Cantidad", "Qty")}</label>
                  <input type="number" min="1" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} style={inp} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={lbl}>{L("Categoría", "Category")}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{catL(c, lang)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>{L("Prioridad", "Priority")}</label>
                <div style={{ display:"flex", gap:6 }}>
                  {PRIOS.map(p => (
                    <button key={p.k} type="button" onClick={() => setForm({ ...form, priority: p.k })}
                      style={{ flex:1, padding:"8px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight: form.priority === p.k ? 700 : 500,
                        border:`1.5px solid ${form.priority === p.k ? (p.k === "urgente" ? "#dc2626" : "#2563eb") : "#e2e8f0"}`,
                        background: form.priority === p.k ? (p.k === "urgente" ? "#fef2f2" : "#eff6ff") : "#fff",
                        color: form.priority === p.k ? (p.k === "urgente" ? "#dc2626" : "#1e40af") : "#64748b" }}>
                      {lang === "en" ? p.en : p.es}
                    </button>
                  ))}
                </div>
              </div>

              {scope === "vessel" && (
                <div>
                  <label style={lbl}>{L("Sistema o equipo (opcional)", "System or equipment (optional)")}</label>
                  <input value={form.system} onChange={e => setForm({ ...form, system: e.target.value })}
                    placeholder={L("Motores, A/C, Cubierta...", "Engines, A/C, Deck...")} style={inp} />
                </div>
              )}

              <div>
                <label style={lbl}>{L("Dónde comprarlo (opcional)", "Where to buy it (optional)")}</label>
                <input list="sl-vendors" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
                  placeholder={L("West Marine, Amazon...", "West Marine, Amazon...")} style={inp} />
                <datalist id="sl-vendors">
                  {[...new Set([
                    ...((vessels?.[0]?.providers) || []).map(p => p.company || `${p.firstName||""} ${p.lastName||""}`.trim()).filter(Boolean),
                    "Amazon", "West Marine", "Lewis Marine Supply", "Home Depot",
                  ])].map(v => <option key={v} value={v} />)}
                </datalist>
              </div>

              <div>
                <label style={lbl}>{L("Nota (opcional)", "Note (optional)")}</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder={L("Medida, referencia, detalle...", "Size, reference, detail...")} style={inp} />
              </div>

              <button onClick={add}
                style={{ padding:"11px", background:"linear-gradient(120deg,#2563eb,#0ea5e9)", border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {L("Agregar a la lista", "Add to list")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
