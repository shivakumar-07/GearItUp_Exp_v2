import { useState } from "react";
import { T, FONT } from "../../theme";

const BTN_STYLES = {
    amber:   { bg: T.amber,    text: "#000", border: "none",                                    shadow: "rgba(245,158,11,0.4)" },
    emerald: { bg: T.emerald,  text: "#000", border: "none",                                    shadow: "rgba(16,185,129,0.35)" },
    sky:     { bg: T.sky,      text: "#000", border: "none",                                    shadow: "rgba(56,189,248,0.35)" },
    crimson: { bg: T.crimson,  text: "#fff", border: "none",                                    shadow: "rgba(239,68,68,0.35)" },
    danger:  { bg: T.crimson,  text: "#fff", border: "none",                                    shadow: "rgba(239,68,68,0.35)" },
    ghost:   { bg: "transparent", text: T.t2, border: `1px solid ${T.border}`,                  shadow: "none" },
    subtle:  { bg: T.surface,  text: T.t2,   border: `1px solid ${T.border}`,                   shadow: "none" },
    outline: { bg: "transparent", text: T.amber, border: `1px solid ${T.amber}33`,              shadow: "none" },
};

export function Btn({ children, onClick, variant = "amber", size = "md", full, disabled, loading, style: sx = {}, className = "", type = "button", ...rest }) {
    const [active, setActive] = useState(false);
    const [hovered, setHovered] = useState(false);

    const v = BTN_STYLES[variant] || BTN_STYLES.ghost;
    const pad  = size === "xs" ? "4px 10px" : size === "sm" ? "6px 14px" : size === "lg" ? "12px 28px" : "9px 20px";
    const fs   = size === "xs" ? 11 : size === "sm" ? 12 : size === "lg" ? 15 : 13;
    const fw   = (variant === "amber" || variant === "danger" || variant === "crimson") ? 700 : 600;

    // Ghost/subtle hover: change border + text color to amber
    const isGhostLike = variant === "ghost" || variant === "subtle" || variant === "outline";
    const borderStyle = isGhostLike && hovered && !disabled && !loading
        ? `1px solid ${T.amber}`
        : v.border || "none";
    const textColor = isGhostLike && hovered && !disabled && !loading
        ? T.amber
        : v.text;

    const filterVal = (!isGhostLike) && hovered && !disabled && !loading ? "brightness(1.1)" : "none";

    const activeStyle = active && !disabled && !loading
        ? { transform: "scale(0.97) translateY(1px)", boxShadow: "none" }
        : {};

    const shadowVal = v.shadow && v.shadow !== "none"
        ? `0 2px 12px ${v.shadow}`
        : "none";

    return (
        <button
            type={type}
            className={`btn-hover${className ? " " + className : ""}`}
            onClick={onClick}
            disabled={disabled || loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { setHovered(false); setActive(false); }}
            onMouseDown={() => setActive(true)}
            onMouseUp={() => setActive(false)}
            style={{
                background: v.bg,
                color: textColor,
                border: borderStyle,
                borderRadius: 8,
                padding: pad,
                fontSize: fs,
                fontWeight: fw,
                cursor: disabled || loading ? "not-allowed" : "pointer",
                outline: "none",
                fontFamily: FONT.ui,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                width: full ? "100%" : "auto",
                opacity: disabled ? 0.45 : 1,
                letterSpacing: "0.01em",
                boxShadow: shadowVal,
                transition: "all 0.15s cubic-bezier(0.4,0,0.2,1)",
                filter: filterVal,
                ...activeStyle,
                ...sx,
            }}
            {...rest}
        >
            {loading && (
                <span style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderTopColor: variant === "amber" || variant === "danger" || variant === "crimson" ? "#000" : T.amber,
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                    flexShrink: 0,
                }} />
            )}
            {children}
        </button>
    );
}
