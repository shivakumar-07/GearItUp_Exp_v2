import { useState, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { T, FONT, GLOBAL_CSS } from "../theme";
import { fmt } from "../utils";
import { useStore } from "../store";
import { Toast, useToast, Btn } from "../components/ui";
import { ProfileDropdown } from "../components/ProfileDropdown";
import { ProductModal } from "../components/ProductModal";

const NAV_ITEMS = [
  { key: "dashboard", path: "/dashboard", icon: "◈", label: "Dashboard" },
  { key: "inventory", path: "/inventory", icon: "⬡", label: "Inventory" },
  { key: "pos", path: "/billing", icon: "🧾", label: "POS" },
  { key: "parties", path: "/parties", icon: "👥", label: "Parties" },
  { key: "workshop", path: "/workshop", icon: "🔧", label: "Workshop" },
  { key: "history", path: "/history", icon: "⊞", label: "History" },
  { key: "reports", path: "/reports", icon: "📊", label: "Reports" },
  { key: "orders", path: "/orders", icon: "◎", label: "Orders" },
];

export function ERPLayout({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    products, movements, orders, shops,
    saveShops, activeShopId, resetAll,
  } = useStore();
  const { items: toasts, add: toast, remove: removeToast } = useToast();
  const [pModal, setPModal] = useState({ open: false, product: null });
  const [shopEdit, setShopEdit] = useState(null);

  const currentPath = location.pathname;

  // Stats
  const todaySales = (movements || []).filter(
    (m) => m.shopId === activeShopId && m.type === "SALE" && m.date >= Date.now() - 86400000
  );
  const todayRev = todaySales.reduce((s, m) => s + m.total, 0);
  const stockSt = (p) => {
    if (p.stock <= 0) return "out";
    if (p.stock < p.minStock) return "low";
    return "ok";
  };
  const lowCount = (products || []).filter(
    (p) => p.shopId === activeShopId && stockSt(p) !== "ok"
  ).length;
  const pendingOrders = (orders || []).filter(
    (o) => o.shopId === activeShopId && (o.status === "NEW" || o.status === "placed")
  ).length;

  const shop = (shops || []).find((s) => s.id === activeShopId) || {
    name: "My Shop",
    city: "Location",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, color: T.t1 }}>
      <style>{GLOBAL_CSS}</style>

      {/* ═══ TOPBAR ═══ */}
      <div
        style={{
          height: 56, background: T.surface, borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", padding: "0 20px 0 88px",
          position: "sticky", top: 0, zIndex: 500, gap: 10,
          boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 1px 0 ${T.border}`,
        }}
      >
        {/* Shop name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 12, position: "relative" }}>
          <div onClick={() => setShopEdit({ name: shop.name, city: shop.city })} style={{ cursor: "pointer" }} title="Edit shop details">
            <div style={{ fontSize: 14, fontWeight: 800, color: T.t1, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 4 }}>
              {shop.name} <span style={{ fontSize: 10, color: T.t4 }}>✏️</span>
            </div>
            <div style={{ fontSize: 10, color: T.amber, fontWeight: 600, letterSpacing: "0.04em" }}>
              INVENTORY · {shop.city?.toUpperCase() || "LOCATION"}
            </div>
          </div>

          {/* Edit popover */}
          {shopEdit && (
            <div style={{ position: "absolute", top: 48, left: 0, zIndex: 9999, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", width: 280 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.t1, marginBottom: 12 }}>Edit Shop Details</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Shop Name</label>
                <input value={shopEdit.name} onChange={(e) => setShopEdit((p) => ({ ...p, name: e.target.value }))} style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.t1, fontSize: 13, fontWeight: 600, fontFamily: FONT.ui, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Location / City</label>
                <input value={shopEdit.city} onChange={(e) => setShopEdit((p) => ({ ...p, city: e.target.value }))} style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.t1, fontSize: 13, fontWeight: 600, fontFamily: FONT.ui, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShopEdit(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px", color: T.t3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.ui }}>Cancel</button>
                <button onClick={() => { const updated = shops.map((s) => (s.id === activeShopId ? { ...s, name: shopEdit.name, city: shopEdit.city } : s)); saveShops(updated); setShopEdit(null); toast("Shop details updated!", "emerald"); }} style={{ background: T.amber, border: "none", borderRadius: 8, padding: "6px 14px", color: "#000", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT.ui }}>Save</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Quick stats */}
        {todayRev > 0 && (
          <div style={{ background: T.emeraldBg, border: `1px solid ${T.emerald}33`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.emerald, fontWeight: 700, fontFamily: FONT.mono, display: "flex", alignItems: "center", gap: 6 }}>
            📈 Today: {fmt(todayRev)}
          </div>
        )}
        {lowCount > 0 && (
          <button onClick={() => navigate("/inventory")} style={{ background: T.crimsonBg, border: `1px solid ${T.crimson}33`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.crimson, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 5 }}>
            ⚠ {lowCount} alert{lowCount > 1 ? "s" : ""}
          </button>
        )}

        <Btn size="sm" variant="ghost" onClick={() => navigate("/billing")} style={{ borderColor: T.border }}>🧾 POS</Btn>
        <Btn size="sm" variant="amber" onClick={() => setPModal({ open: true, product: null })}>＋ Product</Btn>
        <button onClick={() => { if (confirm("Reset all data to defaults?")) resetAll(); }} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.t3, cursor: "pointer", fontWeight: 600, fontFamily: FONT.ui }}>🔄</button>

        {/* Profile dropdown */}
        <ProfileDropdown user={user} onLogout={onLogout} />
      </div>

      {/* ═══ PAGE CONTENT ═══ */}
      <div style={{ padding: "24px 28px 24px 92px", maxWidth: 1440, margin: "0 auto" }}>
        <Outlet context={{ toast, setPModal }} />
      </div>

      {/* ═══ PRODUCT MODAL ═══ */}
      <ProductModal
        open={pModal.open}
        product={pModal.product}
        activeShopId={activeShopId}
        onClose={() => setPModal({ open: false, product: null })}
        onSave={(p) => {
          // This will be passed to pages via Outlet context or imported
        }}
        toast={toast}
      />

      {/* ═══ TOASTS ═══ */}
      <Toast items={toasts} onRemove={removeToast} />

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div
        style={{
          position: "fixed", left: 0, top: 0, bottom: 0, width: 68, zIndex: 600,
          background: `${T.surface}f5`, backdropFilter: "blur(16px)",
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 10, gap: 2,
        }}
      >
        {/* Logo */}
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${T.amber},${T.amberDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: "#000", boxShadow: `0 2px 12px ${T.amber}55`, marginBottom: 4 }}>
          {shop.name?.charAt(0) || "S"}
        </div>
        <div style={{ fontSize: 7, color: T.amber, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>ERP</div>

        {/* Nav items */}
        {NAV_ITEMS.map((n) => {
          const isActive = currentPath === n.path || currentPath.startsWith(n.path + "/");
          return (
            <button
              key={n.key}
              onClick={() => navigate(n.path)}
              title={n.label}
              style={{
                width: 58, height: 46, borderRadius: 10,
                border: `1px solid ${isActive ? T.amber + "44" : "transparent"}`,
                cursor: "pointer",
                background: isActive ? T.amberGlow : "transparent",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 1,
                transition: "all 0.15s", padding: "2px 0", position: "relative",
              }}
            >
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span style={{ fontSize: 7, fontWeight: 700, color: isActive ? T.amber : T.t3, fontFamily: FONT.ui, letterSpacing: "0.02em" }}>
                {n.label}
              </span>
              {n.key === "orders" && pendingOrders > 0 && (
                <span style={{ position: "absolute", top: 2, right: 6, background: T.crimson, color: "#fff", fontSize: 8, borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                  {pendingOrders}
                </span>
              )}
              {n.key === "inventory" && lowCount > 0 && (
                <span style={{ position: "absolute", top: 2, right: 6, background: T.amber, color: "#000", fontSize: 8, borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                  {lowCount}
                </span>
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />
      </div>
    </div>
  );
}
