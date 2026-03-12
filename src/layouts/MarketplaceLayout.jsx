import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { T, FONT, GLOBAL_CSS } from "../theme";
import { useStore } from "../store";
import { Toast, useToast } from "../components/ui";
import { ProfileDropdown } from "../components/ProfileDropdown";
import { Avatar } from "../components/Avatar";
import { CartDrawer } from "../marketplace/components/CartDrawer";

const MP_NAV = [
  { key: "home", path: "/marketplace", icon: "🏠", label: "Home", color: "#10B981" },
  { key: "orders", path: "/marketplace/orders", icon: "📦", label: "Orders", color: "#0EA5E9" },
  { key: "pricing", path: "/marketplace/pricing", icon: "💎", label: "Pricing", color: "#D97706" },
];

export function MarketplaceLayout({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { items: toasts, remove: removeToast } = useToast();
  const currentPath = location.pathname;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* Page content — pushed right for sidebar */}
      <div style={{ paddingLeft: 68 }}>
        <Outlet />
      </div>

      {/* Cart drawer */}
      <CartDrawer onCheckout={() => navigate("/marketplace/checkout")} />

      {/* Left sidebar */}
      <div
        style={{
          position: "fixed", left: 0, top: 0, bottom: 0, width: 68, zIndex: 400,
          background: `${T.surface}ee`, backdropFilter: "blur(12px)",
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 16, gap: 4,
        }}
      >
        {/* Brand */}
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${T.amber},${T.amberDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 2px 12px ${T.amber}55`, marginBottom: 8 }}>
          ⚙️
        </div>
        <div style={{ fontSize: 7, color: T.amber, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Market
        </div>

        {/* Nav */}
        {MP_NAV.map((a) => {
          const isActive = currentPath === a.path || (a.key === "home" && currentPath === "/marketplace");
          return (
            <button
              key={a.key}
              onClick={() => navigate(a.path)}
              title={a.label}
              style={{
                width: 58, height: 50, borderRadius: 10,
                border: `1px solid ${isActive ? a.color + "44" : T.border}`,
                cursor: "pointer",
                background: isActive ? `${a.color}22` : "transparent",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 2,
                transition: "all 0.15s", padding: "4px 0",
              }}
            >
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? a.color : T.t3, fontFamily: FONT.ui, letterSpacing: "0.02em" }}>
                {a.label}
              </span>
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* User avatar + profile */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 12, width: 58 }}>
          <ProfileDropdown user={user} onLogout={onLogout} />
        </div>
      </div>

      {/* Toasts */}
      <Toast items={toasts} onRemove={removeToast} />
    </>
  );
}
