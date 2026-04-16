import { useState } from "react";
import { T, FONT } from "../../theme";
import { useStore } from "../../store";
import { GlobalCatalogPage } from "./GlobalCatalogPage";
import { BrandCatalogPage } from "./BrandCatalogPage";

const ADMIN_TABS = [
    { key: "catalog", icon: "📦", label: "Global Catalog" },
    { key: "brands", icon: "🏷️", label: "Brand Partners" },
    { key: "settings", icon: "⚙️", label: "Platform Settings" },
    { key: "activity", icon: "📜", label: "Activity Log" },
];

export function AdminPage({ onBack, onViewProduct }) {
    const { auditLog, shops, products, movements, orders, resetAll } = useStore();
    const [activeTab, setActiveTab] = useState("catalog");

    // Platform stats
    const totalShops = (shops || []).length;
    const totalProducts = (products || []).length;
    const totalOrders = (orders || []).length;
    const totalMovements = (movements || []).length;
    const recentLogs = (auditLog || []).slice(-100).reverse();

    return (
        <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, color: T.t1 }}>
            {/* Admin Header */}
            <div style={{
                background: T.surface, borderBottom: `1px solid ${T.border}`,
                padding: "20px 32px", boxShadow: `0 4px 24px rgba(0,0,0,0.3)`
            }}>
                <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            {onBack && (
                                <button onClick={onBack} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", color: T.t2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 6 }}>
                                    ← Back
                                </button>
                            )}
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 12,
                                        background: `linear-gradient(135deg, #4F46E5, #7C3AED)`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 20, boxShadow: "0 4px 16px rgba(79,70,229,0.4)"
                                    }}>🛡️</div>
                                    <div>
                                        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, margin: 0 }}>Admin Console</h1>
                                        <div style={{ fontSize: 11, color: T.t3, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Platform Management</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Platform Stats */}
                        <div style={{ display: "flex", gap: 16 }}>
                            {[
                                { label: "Shops", value: totalShops, color: T.sky },
                                { label: "Products", value: totalProducts, color: T.emerald },
                                { label: "Orders", value: totalOrders, color: T.amber },
                                { label: "Transactions", value: totalMovements, color: T.violet },
                            ].map(s => (
                                <div key={s.label} style={{
                                    background: `${s.color}10`, border: `1px solid ${s.color}22`, borderRadius: 10,
                                    padding: "8px 16px", textAlign: "center", minWidth: 80
                                }}>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: FONT.mono }}>{s.value}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div style={{ display: "flex", gap: 4 }}>
                        {ADMIN_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    background: activeTab === tab.key ? `rgba(79,70,229,0.15)` : "transparent",
                                    border: `1px solid ${activeTab === tab.key ? "rgba(79,70,229,0.4)" : "transparent"}`,
                                    borderRadius: "10px 10px 0 0",
                                    padding: "10px 20px",
                                    fontSize: 13, fontWeight: activeTab === tab.key ? 800 : 600,
                                    color: activeTab === tab.key ? "#A78BFA" : T.t3,
                                    cursor: "pointer", fontFamily: FONT.ui,
                                    display: "flex", alignItems: "center", gap: 8,
                                    transition: "all 0.15s",
                                    borderBottom: activeTab === tab.key ? "2px solid #7C3AED" : "2px solid transparent",
                                }}
                            >
                                <span style={{ fontSize: 15 }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div style={{ animation: "fadeUp 0.2s ease-out" }}>
                {activeTab === "catalog" && <GlobalCatalogPage />}
                {activeTab === "brands" && <BrandCatalogPage onViewProduct={onViewProduct} />}
                {activeTab === "settings" && <SettingsTab shops={shops} resetAll={resetAll} />}
                {activeTab === "activity" && <ActivityLogTab logs={recentLogs} />}
            </div>
        </div>
    );
}

/* ─────── PLATFORM SETTINGS TAB ─────── */
function SettingsTab({ shops, resetAll }) {
    return (
        <div style={{ padding: "32px 32px", maxWidth: 1000, margin: "0 auto" }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: T.t1, margin: "0 0 8px" }}>⚙️ Platform Settings</h2>
            <p style={{ fontSize: 14, color: T.t3, margin: "0 0 32px" }}>Configure platform-wide settings and manage the system.</p>

            {/* General Settings */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.t1, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
                    🏪 Registered Shops
                </h3>
                {(shops || []).length === 0 ? (
                    <div style={{ fontSize: 14, color: T.t3 }}>No shops registered yet.</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {(shops || []).map((shop, i) => (
                            <div key={shop.id || i} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "14px 18px", background: T.surface, border: `1px solid ${T.border}`,
                                borderRadius: 12
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{
                                        width: 38, height: 38, borderRadius: 10,
                                        background: `linear-gradient(135deg, ${T.amber}, ${T.amberDim})`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 16, fontWeight: 900, color: "#000"
                                    }}>{shop.name?.charAt(0) || "S"}</div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{shop.name}</div>
                                        <div style={{ fontSize: 11, color: T.t3 }}>{shop.city} · ⭐ {shop.rating} ({shop.reviews} reviews)</div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{
                                        background: `${T.emerald}18`, color: T.emerald, fontSize: 10,
                                        fontWeight: 800, padding: "4px 10px", borderRadius: 6
                                    }}>Active</span>
                                    <span style={{ fontSize: 11, color: T.t3, fontFamily: FONT.mono }}>ID: {shop.id}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Marketplace Config */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.t1, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
                    🌐 Marketplace Configuration
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                        { label: "Platform Name", value: "redpiston", type: "text" },
                        { label: "Default Currency", value: "INR (₹)", type: "text" },
                        { label: "GST Rate", value: "18%", type: "text" },
                        { label: "Default Delivery Radius", value: "15 km", type: "text" },
                    ].map(field => (
                        <div key={field.label}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                                {field.label}
                            </label>
                            <input
                                defaultValue={field.value}
                                style={{
                                    width: "100%", background: T.surface, border: `1px solid ${T.border}`,
                                    borderRadius: 10, padding: "10px 14px", color: T.t1, fontSize: 13,
                                    fontWeight: 600, fontFamily: FONT.ui, outline: "none", boxSizing: "border-box"
                                }}
                            />
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                    <button style={{
                        background: T.amber, color: "#000", border: "none", borderRadius: 10,
                        padding: "10px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer"
                    }} className="btn-hover-solid">
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div style={{
                background: `${T.crimson}08`, border: `2px solid ${T.crimson}33`, borderRadius: 16,
                padding: 24
            }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.crimson, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                    ⚠️ Danger Zone
                </h3>
                <p style={{ fontSize: 13, color: T.t3, margin: "0 0 16px" }}>
                    These actions are irreversible. Use with extreme caution.
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        onClick={() => { if (confirm("Reset ALL data to defaults? This cannot be undone!")) resetAll(); }}
                        style={{
                            background: `${T.crimson}18`, border: `1px solid ${T.crimson}44`, color: T.crimson,
                            borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 800,
                            cursor: "pointer", fontFamily: FONT.ui
                        }}
                    >
                        🗑️ Reset All Data
                    </button>
                    <button style={{
                        background: T.surface, border: `1px solid ${T.border}`, color: T.t2,
                        borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700,
                        cursor: "pointer", fontFamily: FONT.ui
                    }}>
                        📤 Export Data (JSON)
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─────── ACTIVITY LOG TAB ─────── */
function ActivityLogTab({ logs }) {
    const [filter, setFilter] = useState("");
    const filtered = filter
        ? logs.filter(l => l.action?.toLowerCase().includes(filter.toLowerCase()) || l.detail?.toLowerCase().includes(filter.toLowerCase()) || l.entity?.toLowerCase().includes(filter.toLowerCase()))
        : logs;

    const getActionColor = (action) => {
        if (!action) return T.t3;
        if (action.includes("SALE") || action.includes("RECEIPT")) return T.emerald;
        if (action.includes("PURCHASE")) return T.sky;
        if (action.includes("CREATED") || action.includes("PRODUCT")) return T.amber;
        if (action.includes("UPDATED") || action.includes("ADJUSTMENT")) return T.violet;
        if (action.includes("OVERRIDE") || action.includes("RESET")) return T.crimson;
        return T.t2;
    };

    const getActionIcon = (action) => {
        if (!action) return "📝";
        if (action.includes("SALE")) return "🧾";
        if (action.includes("PURCHASE")) return "📥";
        if (action.includes("PRODUCT_CREATED")) return "➕";
        if (action.includes("PRODUCT_UPDATED")) return "✏️";
        if (action.includes("RECEIPT")) return "💰";
        if (action.includes("OVERRIDE")) return "⚠️";
        if (action.includes("ADJUSTMENT") || action.includes("RETURN")) return "🔄";
        if (action.includes("PARTY")) return "👤";
        if (action.includes("JOB_CARD")) return "🔧";
        return "📝";
    };

    return (
        <div style={{ padding: "32px 32px", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: T.t1, margin: "0 0 4px" }}>📜 Activity Log</h2>
                    <p style={{ fontSize: 13, color: T.t3, margin: 0 }}>Full audit trail of all platform actions • {logs.length} entries</p>
                </div>
                <input
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Filter by action, entity..."
                    style={{
                        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
                        padding: "10px 16px", color: T.t1, fontSize: 13, width: 280,
                        fontFamily: FONT.ui, outline: "none"
                    }}
                />
            </div>

            {filtered.length === 0 ? (
                <div style={{
                    background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
                    padding: "60px 20px", textAlign: "center"
                }}>
                    <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>📜</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.t2 }}>No activity logged yet</div>
                    <div style={{ fontSize: 13, color: T.t3, marginTop: 6 }}>Actions like sales, purchases, and product updates will appear here.</div>
                </div>
            ) : (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                    {filtered.map((log, i) => (
                        <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 20px",
                            borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}22` : "none",
                            transition: "background 0.1s"
                        }} className="row-hover">
                            {/* Icon */}
                            <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: `${getActionColor(log.action)}12`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 16
                            }}>
                                {getActionIcon(log.action)}
                            </div>

                            {/* Action + Detail */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{
                                        fontSize: 11, fontWeight: 800, color: getActionColor(log.action),
                                        textTransform: "uppercase", letterSpacing: "0.04em",
                                        background: `${getActionColor(log.action)}12`,
                                        padding: "2px 8px", borderRadius: 4
                                    }}>
                                        {(log.action || "").replace(/_/g, " ")}
                                    </span>
                                    {log.entity && (
                                        <span style={{ fontSize: 11, color: T.t3 }}>
                                            {log.entity}: <span style={{ fontFamily: FONT.mono, color: T.t2 }}>{log.entityId}</span>
                                        </span>
                                    )}
                                </div>
                                {log.detail && (
                                    <div style={{
                                        fontSize: 12, color: T.t2, marginTop: 4,
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                                    }}>
                                        {log.detail}
                                    </div>
                                )}
                            </div>

                            {/* Timestamp */}
                            <div style={{ fontSize: 11, color: T.t3, fontFamily: FONT.mono, flexShrink: 0, textAlign: "right" }}>
                                {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN", {
                                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true
                                }) : "—"}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
