import { useState, useEffect, useRef, useMemo } from "react";
import { T, FONT } from "../theme";
import { useStore } from "../store";

export function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const [selIdx, setSelIdx] = useState(0);
  const { products } = useStore();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out = [];

    // Pages
    const pages = [
      { label: "Dashboard", path: "/dashboard", icon: "◈" },
      { label: "Inventory", path: "/inventory", icon: "⬡" },
      { label: "POS Billing", path: "/billing", icon: "🧾" },
      { label: "Reports", path: "/reports", icon: "📊" },
    ];
    pages.forEach(p => {
      if (p.label.toLowerCase().includes(q)) {
        out.push({ type: "Page", label: p.label, icon: p.icon, action: () => { onNavigate(p.path); onClose(); } });
      }
    });

    // Products
    if (products) {
      products.filter(p =>
        (p.name || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
      ).slice(0, 5).forEach(p => {
        out.push({
          type: "Product", label: p.name, sub: `SKU: ${p.sku} · Stock: ${p.stock}`,
          icon: p.image || "📦",
          action: () => { onNavigate("/inventory"); onClose(); },
        });
      });
    }

    return out.slice(0, 12);
  }, [query, products, onNavigate, onClose]);

  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selIdx]) { results[selIdx].action(); }
  };

  if (!open) return null;

  return (
    <>
      <div className="cmd-backdrop" onClick={onClose} />
      <div className="cmd-box">
        <div style={{
          background: T.card, border: `1px solid ${T.borderHi}`,
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          fontFamily: FONT.ui,
        }}>
          {/* Search input */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 18, color: T.t3 }}>🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSelIdx(0);
              }}
              onKeyDown={handleKey}
              placeholder="Search products and MVP pages..."
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: T.t1, fontSize: 15, fontFamily: FONT.ui, fontWeight: 500,
              }}
            />
            <kbd style={{
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5,
              padding: "2px 8px", fontSize: 11, color: T.t3, fontFamily: FONT.mono,
            }}>Esc</kbd>
          </div>

          {/* Results */}
          <div style={{ maxHeight: 360, overflowY: "auto", padding: results.length > 0 ? "6px 0" : 0 }}>
            {results.length === 0 && query.trim() && (
              <div style={{ padding: "24px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 13, color: T.t3 }}>No results for "{query}"</div>
              </div>
            )}
            {results.length === 0 && !query.trim() && (
              <div style={{ padding: "20px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t3 }}>Type to search products or navigate MVP pages</div>
              </div>
            )}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={r.action}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 18px", width: "100%",
                  background: i === selIdx ? T.surface : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                  transition: "background 0.1s",
                  borderLeft: i === selIdx ? `2px solid ${T.amber}` : "2px solid transparent",
                  fontFamily: FONT.ui, outline: "none",
                }}
                onMouseEnter={() => setSelIdx(i)}
              >
                <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{r.label}</div>
                  {r.sub && <div style={{ fontSize: 11, color: T.t3, marginTop: 1 }}>{r.sub}</div>}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: T.t4,
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 4, padding: "2px 7px", textTransform: "uppercase",
                }}>{r.type}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
