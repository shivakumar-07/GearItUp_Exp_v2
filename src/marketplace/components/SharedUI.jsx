import { useRef } from "react";
import { T, FONT } from "../../theme";

export function ShopCard({ shop }) {
    return (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, minWidth: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer", transition: "all 0.15s" }} className="mp-card-hover">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T.amber}, ${T.amberDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#000", fontSize: 13 }}>
                    {shop.name.charAt(0)}
                </div>
                {shop.is_featured && <div style={{ background: `${T.amber}22`, color: T.amber, padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Featured</div>}
            </div>

            <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.t1, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shop.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.t3, fontFamily: FONT.ui }}>
                    <span style={{ color: T.amber }}>⭐ {shop.rating.toFixed(1)}</span>
                    <span>({shop.reviews} rev)</span>
                </div>
            </div>

            <div style={{ fontSize: 12, color: T.sky, fontWeight: 700, fontFamily: FONT.ui, marginTop: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                📍 ~{shop.delivery_radius}km radius
            </div>
        </div>
    );
}

export function SectionCarousel({ title, children }) {
    const scrollRef = useRef(null);
    const scroll = (dir) => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
        }
    };
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", overflow: "hidden", marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {title && <div style={{ fontSize: 22, fontWeight: 800, color: T.t1, fontFamily: FONT.ui }}>{title}</div>}
                <div style={{ display: "flex", gap: 6 }}>
                    {[[-1, "←"], [1, "→"]].map(([dir, label]) => (
                        <button key={label} onClick={() => scroll(dir)} style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: T.surface, border: `1px solid ${T.border}`,
                            color: T.t2, cursor: "pointer", fontSize: 14,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s", fontFamily: FONT.ui,
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.color = T.amber; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t2; }}
                        >{label}</button>
                    ))}
                </div>
            </div>
            <div ref={scrollRef} className="no-scrollbar" style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 16, scrollSnapType: "x mandatory", msOverflowStyle: "none", scrollbarWidth: "none" }}>
                {children}
            </div>
        </div>
    );
}

export const SkeletonLoader = ({ type = "product", count = 4 }) => {
    return (
        <div style={{ display: "flex", gap: 20, overflowX: "auto" }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{ width: type === "product" ? 260 : 200, height: type === "product" ? 340 : 120, background: T.surface, borderRadius: type === "product" ? 16 : 12, border: `1px solid ${T.border}`, padding: 16, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }} className="pulse">
                    {type === "product" ? (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <div style={{ width: 60, height: 18, background: T.border, borderRadius: 6 }} />
                                <div style={{ width: 50, height: 18, background: T.border, borderRadius: 6 }} />
                            </div>
                            <div style={{ width: "100%", height: 140, background: T.border, borderRadius: 12 }} />
                            <div style={{ width: 80, height: 12, background: T.border, borderRadius: 6, marginTop: 10 }} />
                            <div style={{ width: "90%", height: 18, background: T.border, borderRadius: 6 }} />
                            <div style={{ width: "60%", height: 18, background: T.border, borderRadius: 6 }} />
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 12 }}>
                                <div style={{ width: 90, height: 24, background: T.border, borderRadius: 6 }} />
                                <div style={{ width: 80, height: 30, background: T.border, borderRadius: 8 }} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <div style={{ width: 32, height: 32, background: T.border, borderRadius: 8 }} />
                                <div style={{ width: 45, height: 14, background: T.border, borderRadius: 4 }} />
                            </div>
                            <div style={{ width: "70%", height: 16, background: T.border, borderRadius: 6, marginTop: 8 }} />
                            <div style={{ width: "40%", height: 12, background: T.border, borderRadius: 6, marginTop: 4 }} />
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

export const EmptyState = ({ title, desc }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16, padding: 48, textAlign: "center" }}>
        <span style={{ fontSize: 42, marginBottom: 16, opacity: 0.6 }}>🔍</span>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.t1, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: T.t3, maxWidth: 320 }}>{desc}</div>
    </div>
);
