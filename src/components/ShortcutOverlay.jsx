import { useEffect, useRef } from "react";
import { T, FONT } from "../theme";

const SHORTCUTS = [
  { keys: "Ctrl + N", action: "New Sale" },
  { keys: "Ctrl + P", action: "Go to POS" },
  { keys: "Ctrl + I", action: "Go to Inventory" },
  { keys: "Ctrl + H", action: "Go to History" },
  { keys: "Ctrl + K", action: "Command Palette" },
  { keys: "Ctrl + B", action: "Focus Barcode Input" },
  { keys: "Ctrl + Enter", action: "Submit Bill (POS)" },
  { keys: "?", action: "Show This Overlay" },
  { keys: "Escape", action: "Close Modal / Overlay" },
];

export function ShortcutOverlay({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9990,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.12s ease both",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className="modal-in"
        style={{
          background: T.card, border: `1px solid ${T.borderHi}`,
          borderRadius: 18, padding: 28, width: "100%", maxWidth: 460,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          fontFamily: FONT.ui,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.t1, letterSpacing: "-0.02em" }}>⌨ Keyboard Shortcuts</div>
          <button
            onClick={onClose}
            style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 8, width: 32, height: 32,
              cursor: "pointer", fontSize: 16, color: T.t3,
              display: "flex", alignItems: "center", justifyContent: "center",
              outline: "none", transition: "all 0.15s",
            }}
          >×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SHORTCUTS.map(s => (
            <div
              key={s.keys}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 8,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 13, color: T.t2, fontWeight: 500 }}>{s.action}</span>
              <kbd style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "4px 10px",
                fontSize: 12, fontWeight: 700, color: T.amber,
                fontFamily: FONT.mono, letterSpacing: "0.02em",
              }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
