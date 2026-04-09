import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import { T, FONT } from "../theme";

const ROLE_LABELS = {
  SHOP_OWNER: { label: "Shop Owner", color: "#D97706", bg: "#D9770622" },
  CUSTOMER: { label: "Customer", color: "#0D9488", bg: "#0D948822" },
  PLATFORM_ADMIN: { label: "Admin", color: "#7C3AED", bg: "#7C3AED22" },
  CASHIER: { label: "Cashier", color: "#2563EB", bg: "#2563EB22" },
  MANAGER: { label: "Manager", color: "#059669", bg: "#05966922" },
  MECHANIC: { label: "Mechanic", color: "#E11D48", bg: "#E11D4822" },
};

function RoleBadge({ role }) {
  const r = ROLE_LABELS[role] || { label: role, color: T.t3, bg: T.surface };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: r.color, background: r.bg,
      padding: "2px 8px", borderRadius: 6, letterSpacing: "0.04em",
      textTransform: "uppercase", display: "inline-block", marginTop: 4,
    }}>
      {r.label}
    </span>
  );
}

function MenuItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px", border: "none", background: "transparent",
        cursor: "pointer", fontSize: 13, fontWeight: 600,
        color: danger ? "#EF4444" : T.t1,
        fontFamily: FONT.ui, transition: "background 0.12s",
        borderRadius: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "#EF444412" : `${T.surface}`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{icon}</span>
      {label}
    </button>
  );
}

export function ProfileDropdown({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);

    // Parent handles guarded logout (sync flush + state cleanup + redirect).
    const ok = onLogout ? await onLogout() : true;
    if (ok === false) setOpen(true);
    setLoggingOut(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          background: "transparent", border: `2px solid ${open ? T.amber : "transparent"}`,
          borderRadius: "50%", padding: 2, cursor: "pointer",
          transition: "border-color 0.15s",
        }}
      >
        <Avatar user={user} size={34} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            width: 280, borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
            background: T.card, zIndex: 9999,
            border: `1px solid ${T.border}`,
            overflow: "hidden", fontFamily: FONT.ui,
          }}
        >
          {/* User info header */}
          <div style={{ padding: "16px 16px 12px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Avatar user={user} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name || "Set your name"}
              </div>
              <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>
                {user?.email || user?.phone || "—"}
              </div>
              <RoleBadge role={user?.role || "CUSTOMER"} />
            </div>
          </div>

          <div style={{ height: 1, background: T.border, margin: "0 12px" }} />

          {/* Menu items */}
          <div style={{ padding: "6px 0" }}>
            <MenuItem icon="👤" label="My Profile" onClick={() => { setOpen(false); navigate("/profile"); }} />
            <MenuItem icon="⚙️" label="Settings" onClick={() => { setOpen(false); navigate("/settings"); }} />
            {user?.role === "SHOP_OWNER" && (
              <>
                <MenuItem icon="🏪" label="My Shop Details" onClick={() => { setOpen(false); navigate("/dashboard"); }} />
                <MenuItem icon="👥" label="Manage Staff" onClick={() => { setOpen(false); navigate("/parties"); }} />
              </>
            )}
          </div>

          <div style={{ height: 1, background: T.border, margin: "0 12px" }} />

          {/* Logout — always last, always red */}
          <div style={{ padding: "6px 0" }}>
            <MenuItem
              icon="⏻"
              label={loggingOut ? "Logging out…" : "Log Out"}
              onClick={handleLogout}
              danger
            />
          </div>
        </div>
      )}
    </div>
  );
}
