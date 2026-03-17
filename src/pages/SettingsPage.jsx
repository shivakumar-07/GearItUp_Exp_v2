import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearTokens } from "../api/client.js";
import { T, FONT } from "../theme.js";

const S = {
  page: { minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, color: T.t1 },
  container: { maxWidth: 720, margin: "0 auto", padding: "32px 24px" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 32 },
  backBtn: {
    background: "none", border: "none", color: T.t2, cursor: "pointer",
    fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: FONT.ui,
  },
  title: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.3px" },
  section: {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
    padding: "24px", marginBottom: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: T.t1, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  toggleRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 0", borderBottom: `1px solid ${T.border}`,
  },
  toggleLabel: { fontSize: 14, fontWeight: 600 },
  toggleDesc: { fontSize: 12, color: T.t3, marginTop: 2 },
  toggle: (on) => ({
    width: 44, height: 24, borderRadius: 12, cursor: "pointer", border: "none",
    background: on ? T.emerald : T.border, position: "relative", transition: "background 0.2s",
    flexShrink: 0,
  }),
  toggleDot: (on) => ({
    width: 18, height: 18, borderRadius: "50%", background: "#fff",
    position: "absolute", top: 3, left: on ? 23 : 3, transition: "left 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  }),
  label: { fontSize: 12, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "block" },
  input: {
    width: "100%", background: T.bg, border: `1.5px solid ${T.border}`,
    borderRadius: 10, padding: "11px 14px", color: T.t1, fontSize: 14,
    outline: "none", boxSizing: "border-box", fontFamily: FONT.ui, marginBottom: 14,
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
    border: "none", background: "transparent", color: T.t3, cursor: "pointer", fontSize: 16,
  },
  btn: (variant = "primary") => ({
    padding: "10px 20px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.2s",
    ...(variant === "primary"
      ? { background: T.amber, color: "#000" }
      : variant === "danger"
        ? { background: "transparent", border: `1.5px solid ${T.crimson}`, color: T.crimson }
        : { background: "transparent", border: `1.5px solid ${T.border}`, color: T.t2 }),
  }),
  error: {
    background: "#1c0909", border: `1.5px solid ${T.crimson}`, borderRadius: 10,
    padding: "11px 14px", color: T.crimson, fontSize: 13, marginBottom: 14,
  },
  toast: {
    position: "fixed", bottom: 24, right: 24, background: T.emerald, color: "#fff",
    padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 9999, fontFamily: FONT.ui,
  },
};

function Toggle({ on, onToggle }) {
  return (
    <button style={S.toggle(on)} onClick={onToggle}>
      <div style={S.toggleDot(on)} />
    </button>
  );
}

export function SettingsPage({ onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    emailNotifications: true,
    smsNotifications: true,
    darkMode: true,
  });

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get("/api/auth/me/settings");
      const data = res.data || res;
      if (data) setSettings(data);
    } catch {}
    setLoading(false);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleToggle = async (key) => {
    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    try {
      await api.put("/api/auth/me/settings", { [key]: newVal });
    } catch {
      setSettings(prev => ({ ...prev, [key]: !newVal })); // revert
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { setError("Fill in all password fields"); return; }
    if (newPassword.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmNewPassword) { setError("New passwords do not match"); return; }
    setError(""); setSaving(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      showToast("Password changed successfully");
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to change password");
    }
    setSaving(false);
  };

  const handleLogoutAll = async () => {
    if (!confirm("This will log you out from all devices. Continue?")) return;
    try {
      await api.post("/api/auth/logout-all");
      clearTokens();
      localStorage.removeItem("as_user");
      if (onLogout) onLogout();
      navigate("/login", { replace: true });
    } catch (e) {
      setError(e.data?.error?.message || "Failed to logout all devices");
    }
  };

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.t3, fontSize: 14 }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => navigate(-1)}>← Back</button>
          <div style={{ flex: 1 }} />
          <div style={S.title}>Settings</div>
        </div>

        {error && <div style={S.error}>{error}</div>}

        {/* ─── Notifications ─── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🔔 Notifications</div>

          <div style={S.toggleRow}>
            <div>
              <div style={S.toggleLabel}>Push Notifications</div>
              <div style={S.toggleDesc}>Receive alerts for orders, stock, and updates</div>
            </div>
            <Toggle on={settings.notificationsEnabled} onToggle={() => handleToggle("notificationsEnabled")} />
          </div>

          <div style={S.toggleRow}>
            <div>
              <div style={S.toggleLabel}>Email Notifications</div>
              <div style={S.toggleDesc}>Get order confirmations and reports via email</div>
            </div>
            <Toggle on={settings.emailNotifications} onToggle={() => handleToggle("emailNotifications")} />
          </div>

          <div style={{ ...S.toggleRow, borderBottom: "none" }}>
            <div>
              <div style={S.toggleLabel}>SMS Notifications</div>
              <div style={S.toggleDesc}>OTP and critical alerts via SMS</div>
            </div>
            <Toggle on={settings.smsNotifications} onToggle={() => handleToggle("smsNotifications")} />
          </div>
        </div>

        {/* ─── Change Password ─── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🔑 Change Password</div>

          <div>
            <label style={S.label}>Current Password</label>
            <div style={S.passwordWrap}>
              <input
                style={{ ...S.input, ...S.passwordInput }}
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                style={S.eyeBtn}
                onClick={() => setShowCurrentPassword(v => !v)}
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
              >
                {showCurrentPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <div>
            <label style={S.label}>New Password</label>
            <div style={S.passwordWrap}>
              <input
                style={{ ...S.input, ...S.passwordInput }}
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, upper, lower, digit, special"
              />
              <button
                type="button"
                style={S.eyeBtn}
                onClick={() => setShowNewPassword(v => !v)}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              >
                {showNewPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <div>
            <label style={S.label}>Confirm New Password</label>
            <div style={S.passwordWrap}>
              <input
                style={{ ...S.input, ...S.passwordInput }}
                type={showConfirmNewPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
                onKeyDown={e => e.key === "Enter" && handleChangePassword()}
              />
              <button
                type="button"
                style={S.eyeBtn}
                onClick={() => setShowConfirmNewPassword(v => !v)}
                aria-label={showConfirmNewPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmNewPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <button style={S.btn("primary")} onClick={handleChangePassword} disabled={saving}>
            {saving ? "Changing..." : "Change Password"}
          </button>
        </div>

        {/* ─── Danger Zone ─── */}
        <div style={{ ...S.section, borderColor: `${T.crimson}33` }}>
          <div style={{ ...S.sectionTitle, color: T.crimson }}>⚠️ Security</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
            <div>
              <div style={S.toggleLabel}>Log out from all devices</div>
              <div style={S.toggleDesc}>Revokes all active sessions across devices</div>
            </div>
            <button style={S.btn("danger")} onClick={handleLogoutAll}>
              Logout All
            </button>
          </div>
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
