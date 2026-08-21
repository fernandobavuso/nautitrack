// Campos contables compartidos por todos los formularios de gasto/compra:
// Proveedor/Tienda, N° de factura y —si el pago es con tarjeta— marca, últimos 4
// y DE QUIÉN es la tarjeta (mía / de la empresa / del dueño). Ese último dato es
// clave: con tarjeta del dueño el gasto NO es reembolsable (él ya lo pagó).
import { useLang } from "./i18n.jsx";

export const CARD_OWNERS = [
  { v: "personal", es: "Mía (personal)",   en: "Mine (personal)" },
  { v: "company",  es: "De la empresa",    en: "Company's" },
  { v: "owner",    es: "Del dueño del barco", en: "Boat owner's" },
  { v: "other",    es: "Otra",             en: "Other" },
];
export const CARD_BRANDS = ["Visa", "Mastercard", "Amex", "Discover", "Otra"];
export const EXPENSE_CATEGORIES = ["Combustible","Consumibles","Mantenimiento","Reparación","Repuestos","Sueldos","Marina","Seguro","Impuestos","Otro"];

export const cardOwnerLabel = (v, lang) => {
  const o = CARD_OWNERS.find(x => x.v === v);
  return o ? (lang === "en" ? o.en : o.es) : "";
};

// Texto compacto para listas y reportes: "Visa •4832 (dueño)"
export const paymentSummary = (e, lang) => {
  const pm = e.payment_method || e.payment || "";
  if (pm !== "Tarjeta") return pm;
  const bits = ["Tarjeta"];
  if (e.card_brand) bits[0] = e.card_brand;
  if (e.card_last4) bits.push(`•${e.card_last4}`);
  let s = bits.join(" ");
  if (e.card_owner) {
    const short = { personal: lang==="en"?"mine":"mía", company: lang==="en"?"company":"empresa", owner: lang==="en"?"owner":"dueño", other: lang==="en"?"other":"otra" }[e.card_owner];
    if (short) s += ` (${short})`;
  }
  return s;
};

const COMMON_STORES = ["Amazon", "West Marine", "Lewis Marine Supply", "Home Depot", "eBay"];

const lbl = { fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 };
const inp = { padding: "9px 11px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#1e293b", boxSizing: "border-box", background: "#fff" };

// value: { vendor, invoice, cardBrand, cardLast4, cardOwner }
// onChange(patch), payment: método elegido, providers: lista de la flota,
// onOwnerCard(): aviso cuando la tarjeta es del dueño (para apagar reembolsable)
export default function PurchaseMeta({ value, onChange, payment, providers = [], onOwnerCard, compact = false, hideVendor = false }) {
  const { lang } = useLang();
  const L = (es, en) => (lang === "en" ? en : es);
  const v = value || {};
  const suggestions = [...new Set([
    ...providers.map(p => p.company || `${p.firstName || ""} ${p.lastName || ""}`.trim()).filter(Boolean),
    ...COMMON_STORES,
  ])];
  const listId = "vendors-" + (compact ? "c" : "f");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!hideVendor && <div style={{ flex: 2, minWidth: 150 }}>
          <label style={lbl}>{L("Proveedor / Tienda", "Vendor / Store")}</label>
          <input list={listId} value={v.vendor || ""} onChange={e => onChange({ vendor: e.target.value })}
            placeholder={L("Amazon, West Marine, taller...", "Amazon, West Marine, shop...")} style={{ ...inp, width: "100%" }} />
          <datalist id={listId}>{suggestions.map(x => <option key={x} value={x} />)}</datalist>
        </div>}
        <div style={{ flex: 1, minWidth: 110 }}>
          <label style={lbl}>{L("N° factura / recibo", "Invoice / receipt #")}</label>
          <input value={v.invoice || ""} onChange={e => onChange({ invoice: e.target.value })}
            placeholder={L("opcional", "optional")} style={{ ...inp, width: "100%" }} />
        </div>
      </div>

      {payment === "Tarjeta" && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: "10px 11px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 110 }}>
              <label style={lbl}>{L("¿De quién es la tarjeta?", "Whose card is it?")}</label>
              <select value={v.cardOwner || ""} onChange={e => { onChange({ cardOwner: e.target.value }); if (e.target.value === "owner" && onOwnerCard) onOwnerCard(); }}
                style={{ ...inp, width: "100%" }}>
                <option value="">{L("Seleccionar...", "Select...")}</option>
                {CARD_OWNERS.map(o => <option key={o.v} value={o.v}>{lang === "en" ? o.en : o.es}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 95 }}>
              <label style={lbl}>{L("Marca", "Brand")}</label>
              <select value={v.cardBrand || ""} onChange={e => onChange({ cardBrand: e.target.value })} style={{ ...inp, width: "100%" }}>
                <option value="">—</option>
                {CARD_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 90 }}>
              <label style={lbl}>{L("Últimos 4", "Last 4")}</label>
              <input value={v.cardLast4 || ""} maxLength={4} inputMode="numeric"
                onChange={e => onChange({ cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="4832" style={{ ...inp, width: "100%" }} />
            </div>
          </div>
          {v.cardOwner === "owner" && (
            <div style={{ fontSize: 11, color: "#0369a1", marginTop: 7 }}>
              {L("La pagó el dueño con su tarjeta: no aplica reembolso.", "Paid by the owner with their card: no reimbursement applies.")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
