import { T, FONT } from "../../theme";

export function StatCard({ label, value, sub, color, icon, trend, onClick, glow }) {
    return (
        <div onClick={onClick} className={`card-hover${glow ? " glow-" + glow : ""}`}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.t3, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: FONT.ui }}>{label}</span>
                {icon && <span style={{ fontSize: 20, opacity: 0.7 }}>{icon}</span>}
            </div>
            <div style={{ fontSize: "clamp(16px, 3vw, 28px)", fontWeight: 800, color: color || T.t1, fontFamily: FONT.mono, letterSpacing: "-0.02em", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
            {(sub || trend) && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    {trend && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: +trend > 0 ? T.emerald : T.crimson, fontFamily: FONT.mono, background: +trend > 0 ? T.emeraldBg : T.crimsonBg, padding: "2px 6px", borderRadius: 4 }}>
                            {+trend > 0 ? "▲" : "▼"} {Math.abs(trend)}%
                        </span>
                    )}
                    {sub && <span style={{ fontSize: 12, color: T.t3, fontFamily: FONT.ui }}>{sub}</span>}
                </div>
            )}
            {/* bg glow accent */}
            <div style={{ position: "absolute", bottom: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: color ? `${color}08` : "transparent", pointerEvents: "none" }} />
        </div>
    );
}
