/**
 * CatalogStockInModal.jsx
 *
 * The MNC-style "Add to Inventory" flow — shop owner NEVER types product data from scratch.
 *
 * Flow:
 *   Step 1 — SEARCH:    Type name / OEM number / scan barcode → live catalog results
 *   Step 2 — CONFIGURE: Review auto-filled part details → enter ONLY price + stock
 *   Fallback:           "Not in catalog?" → contribute a new part (manual entry)
 *
 * Why this matters:
 *   A human typing "Bosch brak pad" instead of "Bosch Brake Pad" creates a duplicate
 *   in the catalog. This modal eliminates that problem by forcing selection from the
 *   global brain (Layer 1) before writing to the per-shop ledger (Layer 3).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { T, FONT } from "../theme";
import { Modal, Field, Input, Select, Btn } from "./ui";
import { BarcodeScanner } from "./BarcodeScanner.jsx";
import { lookupCatalog, lookupByBarcode, scanBarcode, addInventory, contributePart } from "../api/inventory.js";
import { uid, CATEGORIES, fmt } from "../utils";

// ─── constants ────────────────────────────────────────────────────────────────

const EMOJI_BY_CATEGORY = {
  Brakes: "🛑", Filters: "🔘", Ignition: "⚡", Electrical: "🔋",
  Engine: "⚙️", Suspension: "🔩", "Body & Exterior": "🚗",
  "Engine Oils": "🛢️", Lubrication: "🛢️", Fluids: "💧",
  "Clutch & Transmission": "⚙️", General: "📦", Tyres: "🔘",
  Lights: "💡", AC: "❄️", Braking: "🛑",
};
const catEmoji = (cat) => EMOJI_BY_CATEGORY[cat] || "🔧";

const GST_RATES = ["0", "5", "12", "18", "28"];
const UNIT_OPTIONS = ["Piece", "Set", "Pair", "Litre", "Kg", "Metre", "Box", "Roll"];

// ─── sub-component: PartImage ────────────────────────────────────────────────
function PartImage({ src, category, size = 40 }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.55, flexShrink: 0 }}>
      {catEmoji(category)}
    </div>
  );
}

// ─── sub-component: StatusBadge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    VERIFIED: { color: T.emerald, bg: `${T.emerald}22`, label: "✓ Verified" },
    PENDING:  { color: T.amber,   bg: `${T.amber}22`,   label: "⏳ Pending" },
    REJECTED: { color: "#EF4444", bg: "#EF444422",      label: "✗ Rejected" },
  };
  const c = cfg[status] || cfg.PENDING;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: c.color, background: c.bg, padding: "2px 7px", borderRadius: 4 }}>
      {c.label}
    </span>
  );
}

// ─── sub-component: FitmentPills ─────────────────────────────────────────────
function FitmentPills({ fitments }) {
  if (!fitments || fitments.length === 0) return (
    <span style={{ fontSize: 11, color: T.t4 }}>Universal / Not specified</span>
  );
  const shown = fitments.slice(0, 4);
  const extra = fitments.length - shown.length;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {shown.map((f) => (
        <span key={f.fitmentId || f.vehicleId} style={{ fontSize: 10, fontWeight: 600, color: T.sky, background: `${T.sky}18`, padding: "2px 8px", borderRadius: 4 }}>
          {f.vehicle ? `${f.vehicle.make} ${f.vehicle.model} ${f.vehicle.yearFrom}–${f.vehicle.yearTo || "present"}` : f.fitType}
        </span>
      ))}
      {extra > 0 && <span style={{ fontSize: 10, color: T.t3, padding: "2px 8px" }}>+{extra} more</span>}
    </div>
  );
}

// ─── ScanButton: tactile amber CTA with press-down feedback ──────────────────
function ScanButton({ onClick }) {
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onMouseLeave={() => setActive(false)}
      style={{
        flexShrink: 0,
        background: `linear-gradient(135deg, ${T.amber}, #D97706)`,
        border: "none",
        borderRadius: 10,
        color: "#000",
        fontWeight: 800,
        fontSize: 12,
        fontFamily: FONT.ui,
        cursor: "pointer",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        minHeight: 46,
        boxShadow: active ? "0 1px 6px rgba(245,158,11,0.2)" : "0 3px 14px rgba(245,158,11,0.35)",
        transform: active ? "scale(0.97) translateY(1px)" : "scale(1) translateY(0)",
        transition: "transform 0.1s cubic-bezier(0.16,1,0.3,1), box-shadow 0.1s",
        willChange: "transform",
      }}
    >
      📷 Scan
    </button>
  );
}

// ─── BackButton: subtle left-arrow nav ───────────────────────────────────────
function BackButton({ onClick, label = "Back to search" }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none",
        color: hover ? T.amber : T.t3,
        cursor: "pointer", fontSize: 12, fontWeight: 600,
        fontFamily: FONT.ui, marginBottom: 16, padding: "4px 0",
        transition: "color 0.15s",
      }}
    >
      ← {label}
    </button>
  );
}

// ─── Step 1: Search ────────────────────────────────────────────────────────────
function SearchStep({ onSelect, onManual, initialQuery }) {
  // onManual(name, barcode?) — barcode is defined only when called from camera scan not-found
  const [query, setQuery]       = useState(initialQuery || "");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await lookupCatalog(query, 14);
        setResults(data.parts || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  // ── Camera barcode scan result ────────────────────────────────────────────
  const handleCameraScan = useCallback(async (barcode) => {
    setScanOpen(false);
    setScanError("");
    setQuery(barcode);
    setLoading(true);
    try {
      const data = await scanBarcode(barcode);
      if (data.exactMatch) {
        onSelect(data.exactMatch);
        return;
      }
      if (data.parts && data.parts.length > 0) {
        setResults(data.parts);
        setSearched(true);
      }
    } catch (err) {
      if (err.status === 404 && err.data?.allow_contribution) {
        // Part not in catalog — auto-open contribution form with barcode pre-filled
        onManual("", barcode);
        return;
      }
      setScanError("Lookup failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [onSelect, onManual]);

  // ── Keyboard Enter: exact barcode lookup ─────────────────────────────────
  const handleKeyDown = async (e) => {
    if (e.key === "Enter" && query.trim().length >= 4) {
      setLoading(true);
      try {
        const data = await lookupByBarcode(query.trim());
        if (data.exactMatch) {
          onSelect(data.exactMatch);
          return;
        }
        if (data.parts && data.parts.length > 0) {
          setResults(data.parts);
          setSearched(true);
        } else {
          setResults([]);
          setSearched(true);
        }
      } catch {
        // fallback to text search already running
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      {/* Camera scanner overlay */}
      <BarcodeScanner
        open={scanOpen}
        onScan={handleCameraScan}
        onClose={() => setScanOpen(false)}
        hint="Point at a product barcode, EAN-13, or OEM label"
      />

      {/* Header hint */}
      <div style={{
        padding: "10px 14px",
        background: T.amberSoft,
        borderRadius: 10,
        border: `1px solid ${T.amber}22`,
        marginBottom: 14,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>◈</span>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
            Step 1 of 2 — Global Parts Catalog
          </div>
          <div style={{ fontSize: 12, color: T.t3, lineHeight: 1.5 }}>
            Scan a barcode, enter an OEM number, or type the part name.
            Product details fill automatically — you only enter price &amp; stock.
          </div>
        </div>
      </div>

      {/* Scan button + text input row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "stretch" }}>
        <ScanButton onClick={() => { setScanError(""); setScanOpen(true); }} />

        {/* Search input */}
        <div style={{ position: "relative", flex: 1 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="OEM number · Part name · Brand"
            style={{
              width: "100%", boxSizing: "border-box",
              background: T.card,
              border: `2px solid ${query.length >= 2 ? T.amber + "99" : T.border}`,
              borderRadius: 10, padding: "11px 44px 11px 14px",
              color: T.t1, fontSize: 13, fontWeight: 600,
              fontFamily: FONT.ui, outline: "none",
              transition: "border-color 0.18s, box-shadow 0.18s",
              height: "100%",
              boxShadow: query.length >= 2 ? `0 0 0 3px ${T.amber}18` : "none",
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = T.amber + "99";
              e.currentTarget.style.boxShadow = `0 0 0 3px ${T.amber}18`;
            }}
            onBlur={e => {
              if (query.length < 2) {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.boxShadow = "none";
              }
            }}
          />
          {loading ? (
            <span style={{
              position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
              width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                width: 14, height: 14, border: `2px solid ${T.border}`,
                borderTopColor: T.amber, borderRadius: "50%",
                animation: "spin 0.7s linear infinite", display: "block",
              }} />
            </span>
          ) : query.length >= 2 && (
            <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: T.amber, fontWeight: 700, fontFamily: FONT.mono }}>↵</span>
          )}
        </div>
      </div>

      {/* Scan error / not found banner */}
      {scanError && (
        <div style={{
          padding: "10px 14px",
          background: `${T.amber}12`,
          border: `1px solid ${T.amber}44`,
          borderRadius: 8,
          fontSize: 12,
          color: T.amber,
          fontWeight: 600,
          marginBottom: 12,
          fontFamily: FONT.ui,
        }}>
          ⚠️ {scanError}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 12, maxHeight: 380, overflowY: "auto" }}>
          {results.map((part, i) => (
            <div
              key={part.masterPartId}
              onClick={() => onSelect(part)}
              className="row-hover"
              style={{
                padding: "12px 16px",
                borderBottom: i < results.length - 1 ? `1px solid ${T.border}` : "none",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14,
                background: T.card,
                transition: "background 0.12s",
              }}
            >
              <PartImage src={part.imageUrl || (part.images && part.images[0])} category={part.categoryL1} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>
                    {part.partName}
                  </span>
                  <StatusBadge status={part.status} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {part.brand && (
                    <span style={{ fontSize: 11, color: T.t2, fontWeight: 600 }}>{part.brand}</span>
                  )}
                  {part.oemNumber && (
                    <span style={{ fontSize: 10, color: T.amber, fontFamily: FONT.mono, background: `${T.amber}14`, padding: "1px 6px", borderRadius: 4 }}>
                      {part.oemNumber}
                    </span>
                  )}
                  {part.categoryL1 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.sky, background: `${T.sky}18`, padding: "1px 6px", borderRadius: 4 }}>
                      {part.categoryL1}
                    </span>
                  )}
                  {part.fitments?.length > 0 && (
                    <span style={{ fontSize: 9, color: T.t3, fontWeight: 600 }}>
                      Fits {part.fitments.length} vehicle{part.fitments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {part.hsnCode && (
                    <span style={{ fontSize: 9, color: T.t4, fontFamily: FONT.mono }}>HSN {part.hsnCode}</span>
                  )}
                </div>
              </div>
              <Btn size="xs" variant="amber" style={{ flexShrink: 0 }}>
                Select →
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {searched && results.length === 0 && (
        <div style={{
          textAlign: "center", padding: "32px 24px",
          border: `2px dashed ${T.border}`, borderRadius: 12, marginBottom: 12,
          background: T.surface,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.t2, marginBottom: 6 }}>
            "{query}" not found in catalog
          </div>
          <div style={{ fontSize: 12, color: T.t3, marginBottom: 18, lineHeight: 1.6 }}>
            This part isn't in our global catalog yet.<br />
            You can add it manually — it will be submitted for catalog review.
          </div>
          <Btn variant="amber" size="sm" onClick={() => onManual(query)}>
            ＋ Add "{query.slice(0, 32)}{query.length > 32 ? "…" : ""}" Manually
          </Btn>
        </div>
      )}

      {/* Idle hint */}
      {!searched && query.length < 2 && (
        <div style={{ padding: "24px 16px", color: T.t4, fontSize: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.t3, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Trusted Brands
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {["Bosch", "NGK", "Denso", "TVS", "Minda", "Exide", "MRF", "Amaron"].map(b => (
              <span key={b} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: T.t2, fontWeight: 600 }}>{b}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { icon: "📷", text: "Tap Scan to use camera barcode reader" },
              { icon: "⌨", text: "Type OEM number or part name above" },
              { icon: "↵", text: "Press Enter for exact barcode scan" },
            ].map(h => (
              <div key={h.text} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{h.icon}</span>
                <span style={{ fontSize: 11, color: T.t3 }}>{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Configure price + stock ──────────────────────────────────────────
function ConfigureStep({ part, onBack, onSave, saving, activeShopId }) {
  const [f, setF] = useState({
    buyPrice: "", sellPrice: "", stockQty: "0",
    rackLocation: "", minStockAlert: "5",
  });
  const [errors, setErrors] = useState({});

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const profit = f.buyPrice && f.sellPrice
    ? parseFloat(f.sellPrice) - parseFloat(f.buyPrice)
    : null;
  const margin = profit !== null && parseFloat(f.sellPrice) > 0
    ? ((profit / parseFloat(f.sellPrice)) * 100).toFixed(1)
    : null;

  const validate = () => {
    const e = {};
    if (!f.buyPrice  || isNaN(f.buyPrice))  e.buyPrice  = "Required";
    if (!f.sellPrice || isNaN(f.sellPrice)) e.sellPrice = "Required";
    if (f.stockQty === "" || isNaN(f.stockQty)) e.stockQty = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(f);
  };

  const specs = part.specifications && typeof part.specifications === "object"
    ? Object.entries(part.specifications).slice(0, 6)
    : [];

  return (
    <div>
      <BackButton onClick={onBack} />

      {/* Part details card (read-only — from global catalog) */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Step 2 of 2 — Global Catalog Details (auto-filled)
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <PartImage src={part.imageUrl || (part.images && part.images[0])} category={part.categoryL1} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.t1 }}>{part.partName}</span>
              <StatusBadge status={part.status} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {part.brand && <span style={{ fontSize: 11, fontWeight: 700, color: T.t2 }}>{part.brand}</span>}
              {part.categoryL1 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, background: `${T.amber}14`, padding: "2px 8px", borderRadius: 4 }}>
                  {part.categoryL1}{part.categoryL2 ? ` › ${part.categoryL2}` : ""}
                </span>
              )}
              {part.unitOfSale && part.unitOfSale !== "Piece" && (
                <span style={{ fontSize: 10, color: T.t3, fontWeight: 600 }}>Unit: {part.unitOfSale}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11 }}>
              {part.oemNumber && (
                <span><span style={{ color: T.t4 }}>OEM: </span><span style={{ fontFamily: FONT.mono, color: T.amber, fontWeight: 700 }}>{part.oemNumber}</span></span>
              )}
              {part.oemNumbers?.length > 1 && (
                <span style={{ color: T.t3 }}>+{part.oemNumbers.length - 1} cross refs</span>
              )}
              {part.hsnCode && (
                <span><span style={{ color: T.t4 }}>HSN: </span><span style={{ fontFamily: FONT.mono, color: T.t2 }}>{part.hsnCode}</span></span>
              )}
              {part.gstRate != null && (
                <span><span style={{ color: T.t4 }}>GST: </span><span style={{ color: T.t2, fontWeight: 700 }}>{parseFloat(part.gstRate)}%</span></span>
              )}
            </div>
          </div>
        </div>

        {/* Technical specs */}
        {specs.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {specs.map(([k, v]) => (
              <div key={k} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10 }}>
                <span style={{ color: T.t4, textTransform: "uppercase", fontWeight: 700 }}>{k.replace(/_/g, " ")}: </span>
                <span style={{ color: T.t2, fontWeight: 700 }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Fitments */}
        {part.fitments?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Fits:</div>
            <FitmentPills fitments={part.fitments} />
          </div>
        )}
      </div>

      {/* Shop-specific fields — ONLY these need manual entry */}
      <div style={{ background: T.card, border: `1px solid ${T.amber}44`, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
          Your Shop Details — Price &amp; Stock
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Buying Price (₹)" required error={errors.buyPrice}>
            <Input type="number" value={f.buyPrice} onChange={set("buyPrice")} placeholder="0" prefix="₹" autoFocus />
          </Field>
          <Field label="Selling Price (₹)" required error={errors.sellPrice}>
            <Input type="number" value={f.sellPrice} onChange={set("sellPrice")} placeholder="0" prefix="₹" />
          </Field>
          <Field label="Opening Stock" required error={errors.stockQty} hint="Units currently in hand">
            <Input type="number" value={f.stockQty} onChange={set("stockQty")} placeholder="0" suffix="units" />
          </Field>
          <Field label="Min Stock Alert" hint="Alert below this threshold">
            <Input type="number" value={f.minStockAlert} onChange={set("minStockAlert")} placeholder="5" suffix="units" />
          </Field>
          <div style={{ gridColumn: "span 2" }}>
            <Field label="Rack / Storage Location" hint="e.g. Rack A-12, Shelf 3B">
              <Input value={f.rackLocation} onChange={set("rackLocation")} placeholder="Rack A-12" />
            </Field>
          </div>
        </div>

        {/* Profit preview — only shown once both prices are entered */}
        {profit !== null && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14,
            animation: "scaleIn 0.2s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            <div style={{
              background: profit > 0 ? `${T.emerald}12` : `${T.crimson}12`,
              border: `1px solid ${profit > 0 ? T.emerald : T.crimson}33`,
              borderRadius: 10, padding: "12px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 9, color: profit > 0 ? T.emerald : T.crimson, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                Profit / Unit
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: profit > 0 ? T.emerald : T.crimson, fontFamily: FONT.mono }}>
                {profit > 0 ? "+" : ""}{fmt(profit)}
              </div>
            </div>
            <div style={{
              background: `${T.amber}10`,
              border: `1px solid ${T.amber}33`,
              borderRadius: 10, padding: "12px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 9, color: T.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                Margin
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>
                {margin}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onBack}>Cancel</Btn>
        <Btn variant="amber" loading={saving} onClick={handleSave}>
          💾 Add to Inventory
        </Btn>
      </div>
    </div>
  );
}

// ─── Fallback: Contribute new part ────────────────────────────────────────────
function ContributeStep({ initialName, initialBarcode, onBack, onSave, saving }) {
  const blank = {
    partName: initialName || "", brand: "", categoryL1: "Engine", categoryL2: "",
    oemNumber: initialBarcode || "", hsnCode: "", gstRate: "18", unitOfSale: "Piece", description: "",
    buyPrice: "", sellPrice: "", stockQty: "0", rackLocation: "", minStockAlert: "5",
    image: "📦",
    _scannedBarcode: initialBarcode || "",
  };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState({});

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!f.partName.trim()) e.partName  = "Required";
    if (!f.buyPrice  || isNaN(f.buyPrice))  e.buyPrice  = "Required";
    if (!f.sellPrice || isNaN(f.sellPrice)) e.sellPrice = "Required";
    if (f.stockQty === "" || isNaN(f.stockQty)) e.stockQty = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(f);
  };

  return (
    <div>
      <BackButton onClick={onBack} />

      <div style={{ padding: "12px 16px", background: `${T.amber}11`, border: `1px solid ${T.amber}44`, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Contribute New Part to Catalog
        </div>
        <div style={{ fontSize: 12, color: T.t3, lineHeight: 1.5 }}>
          This part will be added with <b style={{ color: T.amber }}>Pending</b> status and reviewed by our catalog team.
          Once verified, it becomes available to all shops on the platform.
        </div>
      </div>

      {/* Scanned barcode indicator */}
      {initialBarcode && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: `${T.sky}12`, border: `1px solid ${T.sky}44`, borderRadius: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>📷</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.sky, textTransform: "uppercase", letterSpacing: "0.06em" }}>Scanned Barcode</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: T.t1, fontWeight: 700 }}>{initialBarcode}</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "span 2" }}>
          <Field label="Part Name" required error={errors.partName}>
            <Input value={f.partName} onChange={set("partName")} placeholder="Bosch Front Brake Pad Set" />
          </Field>
        </div>
        <Field label="Brand">
          <Input value={f.brand} onChange={set("brand")} placeholder="Bosch, NGK, Denso…" />
        </Field>
        <Field label="Category">
          <Select value={f.categoryL1} onChange={set("categoryL1")} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Field>
        <div style={{ gridColumn: "span 2" }}>
          <Field label="OEM Part Number" hint="From the box / manufacturer website">
            <Input value={f.oemNumber} onChange={set("oemNumber")} placeholder="04465-02220" />
          </Field>
        </div>
        <Field label="HSN Code">
          <Input value={f.hsnCode} onChange={set("hsnCode")} placeholder="87083000" />
        </Field>
        <Field label="GST Rate">
          <Select value={f.gstRate} onChange={set("gstRate")} options={GST_RATES.map((r) => ({ value: r, label: r + "% GST" }))} />
        </Field>
        <Field label="Unit of Sale">
          <Select value={f.unitOfSale} onChange={set("unitOfSale")} options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))} />
        </Field>
        <Field label="Buying Price (₹)" required error={errors.buyPrice}>
          <Input type="number" value={f.buyPrice} onChange={set("buyPrice")} placeholder="0" prefix="₹" />
        </Field>
        <Field label="Selling Price (₹)" required error={errors.sellPrice}>
          <Input type="number" value={f.sellPrice} onChange={set("sellPrice")} placeholder="0" prefix="₹" />
        </Field>
        <Field label="Opening Stock" required error={errors.stockQty}>
          <Input type="number" value={f.stockQty} onChange={set("stockQty")} placeholder="0" suffix="units" />
        </Field>
        <Field label="Min Stock Alert">
          <Input type="number" value={f.minStockAlert} onChange={set("minStockAlert")} placeholder="5" suffix="units" />
        </Field>
        <div style={{ gridColumn: "span 2" }}>
          <Field label="Rack / Storage Location">
            <Input value={f.rackLocation} onChange={set("rackLocation")} placeholder="Rack A-12" />
          </Field>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <Field label="Description" hint="Technical notes, material, application">
            <Input value={f.description} onChange={set("description")} placeholder="Ceramic brake pads for front axle…" />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <Btn variant="ghost" onClick={onBack}>Cancel</Btn>
        <Btn variant="amber" loading={saving} onClick={handleSave}>
          📤 Contribute &amp; Add to Inventory
        </Btn>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function CatalogStockInModal({ open, onClose, onSave, toast, activeShopId }) {
  const [step, setStep]           = useState("search"); // "search" | "configure" | "contribute"
  const [selected, setSelected]   = useState(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [saving, setSaving]       = useState(false);

  // Reset on open / close
  useEffect(() => {
    if (!open) {
      setStep("search");
      setSelected(null);
      setManualQuery("");
      setManualBarcode("");
      setSaving(false);
    }
  }, [open]);

  const handleSelect = useCallback((part) => {
    setSelected(part);
    setStep("configure");
  }, []);

  // name: text query or empty; barcode: scanned barcode (optional)
  const handleManual = useCallback((query, barcode = "") => {
    setManualQuery(query);
    setManualBarcode(barcode);
    setStep("contribute");
  }, []);

  // ── Save from catalog-selected part ──────────────────────────────────────
  const handleConfigureSave = useCallback(async (form) => {
    setSaving(true);
    try {
      let product;
      try {
        const res = await addInventory({
          masterPartId:  selected.masterPartId,
          sellingPrice:  parseFloat(form.sellPrice),
          buyingPrice:   parseFloat(form.buyPrice),
          stockQty:      parseInt(form.stockQty) || 0,
          rackLocation:  form.rackLocation || null,
          minStockAlert: parseInt(form.minStockAlert) || 5,
        });

        // Build a frontend-compatible product object from the API response
        const inv = res.item;
        product = {
          id:           inv.inventoryId,
          inventoryId:  inv.inventoryId,
          masterPartId: selected.masterPartId,
          globalSku:    selected.masterPartId,
          name:         selected.partName,
          oemNumber:    selected.oemNumber || (selected.oemNumbers && selected.oemNumbers[0]) || "",
          oemNumbers:   selected.oemNumbers || [],
          barcodes:     selected.barcodes  || [],
          brand:        selected.brand    || "",
          category:     selected.categoryL1 || "General",
          categoryL2:   selected.categoryL2  || "",
          hsnCode:      selected.hsnCode   || "",
          gstRate:      parseFloat(selected.gstRate || 18),
          unitOfSale:   selected.unitOfSale || "Piece",
          specifications: selected.specifications || {},
          sellPrice:    parseFloat(form.sellPrice),
          buyPrice:     parseFloat(form.buyPrice),
          stock:        parseInt(form.stockQty) || 0,
          minStock:     parseInt(form.minStockAlert) || 5,
          rack:         form.rackLocation || "",
          location:     form.rackLocation || "",
          image:        selected.imageUrl || (selected.images && selected.images[0]) || catEmoji(selected.categoryL1),
          sku:          selected.oemNumber || (selected.oemNumbers && selected.oemNumbers[0]) || inv.inventoryId.slice(0, 8),
          shopId:       activeShopId,
        };
      } catch (apiErr) {
        // API unavailable (shop offline) — create a local-only product that syncs later
        console.warn("[CatalogStockIn] API unavailable, saving locally:", apiErr.message);
        const localId = "p" + uid();
        product = {
          id:           localId,
          masterPartId: selected.masterPartId,
          globalSku:    selected.masterPartId,
          name:         selected.partName,
          oemNumber:    selected.oemNumber || "",
          brand:        selected.brand    || "",
          category:     selected.categoryL1 || "General",
          hsnCode:      selected.hsnCode   || "",
          gstRate:      parseFloat(selected.gstRate || 18),
          unitOfSale:   selected.unitOfSale || "Piece",
          sellPrice:    parseFloat(form.sellPrice),
          buyPrice:     parseFloat(form.buyPrice),
          stock:        parseInt(form.stockQty) || 0,
          minStock:     parseInt(form.minStockAlert) || 5,
          rack:         form.rackLocation || "",
          location:     form.rackLocation || "",
          image:        catEmoji(selected.categoryL1),
          sku:          selected.oemNumber || localId.slice(0, 8),
          shopId:       activeShopId,
          _pendingSync: true,
        };
      }

      onSave(product);
      toast(`${selected.partName} added to inventory!`, "success", "Added from Catalog");
      onClose();
    } finally {
      setSaving(false);
    }
  }, [selected, activeShopId, onSave, toast, onClose]);

  // ── Save from manual "contribute" form ───────────────────────────────────
  const handleContributeSave = useCallback(async (form) => {
    setSaving(true);
    try {
      let masterPartId = null;
      let product;

      try {
        // Step A: Contribute to catalog (creates MasterPart with PENDING status)
        const catalogRes = await contributePart({
          partName:    form.partName,
          brand:       form.brand    || undefined,
          categoryL1:  form.categoryL1,
          oemNumber:   form.oemNumber || undefined,
          hsnCode:     form.hsnCode  || undefined,
          gstRate:     parseFloat(form.gstRate || 18),
          unitOfSale:  form.unitOfSale || "Piece",
          description: form.description || undefined,
          // Include scanned barcode if this contribution was triggered by a camera scan
          ...(form._scannedBarcode && { barcodes: [form._scannedBarcode] }),
          ...(form.oemNumber && { oemNumbers: [form.oemNumber] }),
        });
        masterPartId = catalogRes.part?.masterPartId;

        // Step B: Add to shop inventory using the new MasterPart
        if (masterPartId) {
          const invRes = await addInventory({
            masterPartId,
            sellingPrice:  parseFloat(form.sellPrice),
            buyingPrice:   parseFloat(form.buyPrice),
            stockQty:      parseInt(form.stockQty) || 0,
            rackLocation:  form.rackLocation || null,
            minStockAlert: parseInt(form.minStockAlert) || 5,
          });

          product = {
            id:           invRes.item.inventoryId,
            inventoryId:  invRes.item.inventoryId,
            masterPartId,
            globalSku:    masterPartId,
            name:         form.partName,
            oemNumber:    form.oemNumber || "",
            brand:        form.brand    || "",
            category:     form.categoryL1 || "General",
            hsnCode:      form.hsnCode   || "",
            gstRate:      parseFloat(form.gstRate || 18),
            unitOfSale:   form.unitOfSale || "Piece",
            sellPrice:    parseFloat(form.sellPrice),
            buyPrice:     parseFloat(form.buyPrice),
            stock:        parseInt(form.stockQty) || 0,
            minStock:     parseInt(form.minStockAlert) || 5,
            rack:         form.rackLocation || "",
            location:     form.rackLocation || "",
            image:        catEmoji(form.categoryL1),
            sku:          form.oemNumber || invRes.item.inventoryId.slice(0, 8),
            shopId:       activeShopId,
            _pendingCatalogVerification: true,
          };
        }
      } catch (apiErr) {
        console.warn("[CatalogStockIn] Contribute API failed, saving locally:", apiErr.message);
      }

      // Fallback: purely local product if API is down
      if (!product) {
        const localId = "p" + uid();
        product = {
          id:           localId,
          name:         form.partName,
          oemNumber:    form.oemNumber || "",
          brand:        form.brand    || "",
          category:     form.categoryL1 || "General",
          hsnCode:      form.hsnCode   || "",
          gstRate:      parseFloat(form.gstRate || 18),
          unitOfSale:   form.unitOfSale || "Piece",
          sellPrice:    parseFloat(form.sellPrice),
          buyPrice:     parseFloat(form.buyPrice),
          stock:        parseInt(form.stockQty) || 0,
          minStock:     parseInt(form.minStockAlert) || 5,
          rack:         form.rackLocation || "",
          location:     form.rackLocation || "",
          image:        catEmoji(form.categoryL1),
          sku:          form.oemNumber || localId.slice(0, 8),
          shopId:       activeShopId,
        };
      }

      onSave(product);
      toast(
        `${form.partName} added! Part submitted for catalog review.`,
        "success",
        "Contributed & Added"
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }, [activeShopId, onSave, toast, onClose]);

  // ── Titles ────────────────────────────────────────────────────────────────
  const titles = {
    search:     "Add Product to Inventory",
    configure:  selected ? `Add — ${selected.partName}` : "Configure Stock",
    contribute: "Add New Part to Catalog",
  };
  const subtitles = {
    search:     "Search the global catalog — product details fill automatically",
    configure:  "Enter your shop price and opening stock",
    contribute: "Part not in catalog? Add it — it will be reviewed and verified",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titles[step]}
      subtitle={subtitles[step]}
      width={640}
    >
      {step === "search" && (
        <SearchStep onSelect={handleSelect} onManual={handleManual} />
      )}
      {step === "configure" && selected && (
        <ConfigureStep
          part={selected}
          onBack={() => setStep("search")}
          onSave={handleConfigureSave}
          saving={saving}
          activeShopId={activeShopId}
        />
      )}
      {step === "contribute" && (
        <ContributeStep
          initialName={manualQuery}
          initialBarcode={manualBarcode}
          onBack={() => setStep("search")}
          onSave={handleContributeSave}
          saving={saving}
        />
      )}
    </Modal>
  );
}
