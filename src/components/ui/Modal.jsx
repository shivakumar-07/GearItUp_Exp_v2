import { useEffect, useRef } from "react";
import { T, FONT } from "../../theme";

/**
 * Modal — accessible base component.
 *
 * Behaviour:
 *  - Escape key calls onClose.
 *  - First focusable element is auto-focused 100ms after open.
 *  - Overlay background click calls onClose.
 *  - Body scroll is locked while open.
 *
 * Caller responsibility:
 *  - When Modal closes, the calling component should restore focus to the
 *    trigger element (e.g. save a ref to the button that opened the modal and
 *    call triggerRef.current?.focus() in an onClose handler or useEffect).
 */
export function Modal({ open, onClose, title, subtitle, width = 560, children }) {
    const containerRef = useRef(null);

    // Lock body scroll
    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    // Escape key → close
    useEffect(() => {
        if (!open) return;
        const handleKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose && onClose();
            }
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    // Auto-focus first focusable element on open
    useEffect(() => {
        if (!open || !containerRef.current) return;
        const timer = setTimeout(() => {
            if (!containerRef.current) return;
            const focusable = containerRef.current.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable) focusable.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, [open]);

    if (!open) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.75)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                animation: "fadeIn 0.15s ease",
            }}
            onClick={e => e.target === e.currentTarget && onClose && onClose()}
        >
            <div
                ref={containerRef}
                className="modal-in modal-box"
                style={{
                    background: T.card,
                    border: `1px solid ${T.borderHi}`,
                    borderRadius: 18,
                    padding: 28,
                    width: "100%",
                    maxWidth: width,
                    maxHeight: "92vh",
                    overflowY: "auto",
                    boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
                    fontFamily: FONT.ui,
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: "-0.02em" }}>{title}</div>
                        {subtitle && <div style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>{subtitle}</div>}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: T.surface,
                            border: `1px solid ${T.border}`,
                            cursor: "pointer",
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            fontSize: 16,
                            color: T.t3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s",
                            outline: "none",
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.t1; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t3; }}
                        aria-label="Close modal"
                    >
                        ×
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
