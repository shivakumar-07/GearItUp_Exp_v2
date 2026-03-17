import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { T, FONT } from "../theme.js";
import { Avatar } from "../components/Avatar.jsx";

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
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "block" },
  input: {
    width: "100%", background: T.bg, border: `1.5px solid ${T.border}`,
    borderRadius: 10, padding: "11px 14px", color: T.t1, fontSize: 14,
    outline: "none", boxSizing: "border-box", fontFamily: FONT.ui, transition: "border 0.2s",
  },
  inputDisabled: { opacity: 0.5, cursor: "not-allowed" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  btn: (variant = "primary") => ({
    padding: "10px 20px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.2s",
    ...(variant === "primary"
      ? { background: T.amber, color: "#000" }
      : { background: "transparent", border: `1.5px solid ${T.border}`, color: T.t2 }),
  }),
  badge: (color) => ({
    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
    background: `${color}22`, color, display: "inline-block",
  }),
  providerCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", background: T.bg, borderRadius: 10,
    border: `1px solid ${T.border}`, marginBottom: 8,
  },
  toast: {
    position: "fixed", bottom: 24, right: 24, background: T.emerald, color: "#fff",
    padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 9999, fontFamily: FONT.ui,
  },
  error: {
    background: "#1c0909", border: `1.5px solid ${T.crimson}`, borderRadius: 10,
    padding: "11px 14px", color: T.crimson, fontSize: 13, marginBottom: 14,
  },
  warningBanner: {
    background: "#1a1200", border: `1.5px solid ${T.amber}`, borderRadius: 10,
    padding: "11px 16px", color: T.amber, fontSize: 13, marginBottom: 14,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  },
};

const PROVIDER_META = {
  EMAIL: { icon: "✉️", label: "Email" },
  PHONE: { icon: "📱", label: "Phone" },
  GOOGLE: { icon: "🔵", label: "Google" },
};

export function ProfilePage({ user, onUserUpdate }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [userData, setUserData] = useState(null);
  const [profile, setProfile] = useState({ gender: "", dateOfBirth: "", addresses: [] });
  const [providers, setProviders] = useState([]);
  const [shopData, setShopData] = useState(null);

  // Editable fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get("/api/auth/me");
      const data = res.data || res;
      setUserData(data);
      setName(data.name || "");
      setEmail(data.email || "");
      setProfile(data.profile || { gender: "", dateOfBirth: "", addresses: [] });
      setProviders(data.providers || []);
      if (data.shop) setShopData(data.shop);
    } catch (e) {
      setError("Failed to load profile");
    }
    setLoading(false);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSaveBasic = async () => {
    setSaving(true); setError("");
    try {
      const emailChanged = email && email !== userData?.email;
      const res = await api.patch("/api/auth/me", { name, email });
      const updated = res.data || res;
      setUserData(prev => ({ ...prev, ...updated }));
      // Update localStorage
      const stored = JSON.parse(localStorage.getItem("as_user") || "{}");
      const newUser = { ...stored, name: updated.name, email: updated.email };
      localStorage.setItem("as_user", JSON.stringify(newUser));
      if (onUserUpdate) onUserUpdate(newUser);

      if (emailChanged && updated.emailVerified === false) {
        // Trigger verification email for new address (best-effort)
        api.post("/api/auth/resend-verification", { email: updated.email }).catch(() => {});
        showToast("Verification email sent to your new address — please check your inbox");
      } else {
        showToast("Profile updated");
      }
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to save");
    }
    setSaving(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true); setError("");
    try {
      await api.put("/api/auth/me/profile", {
        gender: profile.gender || null,
        dateOfBirth: profile.dateOfBirth || null,
        addresses: profile.addresses,
      });
      showToast("Profile details saved");
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to save");
    }
    setSaving(false);
  };

  const handleSaveShop = async () => {
    setSaving(true); setError("");
    try {
      const res = await api.patch("/api/auth/me/shop", shopData);
      setShopData(res.data || res);
      showToast("Shop details updated");
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to save");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.t3, fontSize: 14 }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => navigate(-1)}>← Back</button>
          <div style={{ flex: 1 }} />
          <div style={S.title}>My Profile</div>
        </div>

        {userData?.email && userData?.emailVerified === false && (
          <div style={S.warningBanner}>
            <span>⚠️ Your email address is not verified. Check your inbox for a verification code.</span>
            <button
              style={{ background: "none", border: "none", color: T.amber, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: FONT.ui, whiteSpace: "nowrap" }}
              onClick={() => {
                api.post("/api/auth/resend-verification", { email: userData.email }).catch(() => {});
                showToast("Verification email resent");
              }}
            >
              Resend
            </button>
          </div>
        )}
        {error && <div style={S.error}>{error}</div>}

        {/* ─── Basic Info ─── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>👤 Personal Information</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <Avatar user={userData} size={64} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{userData?.name || "—"}</div>
              <div style={{ fontSize: 13, color: T.t3 }}>{userData?.email || userData?.phone || "—"}</div>
              <span style={S.badge(T.amber)}>{userData?.role}</span>
              {userData?.emailVerified && <span style={{ ...S.badge(T.emerald), marginLeft: 6 }}>Email Verified</span>}
              {userData?.phoneVerified && <span style={{ ...S.badge(T.emerald), marginLeft: 6 }}>Phone Verified</span>}
            </div>
          </div>

          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>Full Name</label>
              <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div style={S.field}>
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>Phone</label>
            <input style={{ ...S.input, ...S.inputDisabled }} value={userData?.phone || "Not set"} disabled />
          </div>
          <button style={S.btn("primary")} onClick={handleSaveBasic} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* ─── Profile Details ─── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📋 Profile Details</div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>Gender</label>
              <select
                style={{ ...S.input, cursor: "pointer" }}
                value={profile.gender || ""}
                onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
              >
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Date of Birth</label>
              <input
                style={S.input}
                type="date"
                value={profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : ""}
                onChange={e => setProfile(p => ({ ...p, dateOfBirth: e.target.value }))}
              />
            </div>
          </div>
          <button style={S.btn("primary")} onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Details"}
          </button>
        </div>

        {/* ─── Linked Accounts ─── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🔗 Linked Accounts</div>
          {providers.length === 0 ? (
            <div style={{ color: T.t3, fontSize: 13, padding: "12px 0" }}>No linked accounts found</div>
          ) : (
            providers.map((p, i) => {
              const meta = PROVIDER_META[p.provider] || { icon: "🔑", label: p.provider };
              return (
                <div key={i} style={S.providerCard}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{meta.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.label}</div>
                      <div style={{ fontSize: 12, color: T.t3 }}>{p.providerId}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: T.t3 }}>
                    Linked {new Date(p.linkedAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Shop Details (Shop Owners only) ─── */}
        {shopData && (
          <div style={S.section}>
            <div style={S.sectionTitle}>🏪 Shop Details</div>
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Shop Name</label>
                <input style={S.input} value={shopData.name || ""} onChange={e => setShopData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={S.field}>
                <label style={S.label}>Owner Name</label>
                <input style={S.input} value={shopData.ownerName || ""} onChange={e => setShopData(p => ({ ...p, ownerName: e.target.value }))} />
              </div>
            </div>
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>GSTIN</label>
                <input style={S.input} value={shopData.gstin || ""} onChange={e => setShopData(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} placeholder="36AABCS1429B1Z1" />
              </div>
              <div style={S.field}>
                <label style={S.label}>City</label>
                <input style={S.input} value={shopData.city || ""} onChange={e => setShopData(p => ({ ...p, city: e.target.value }))} />
              </div>
            </div>
            <div style={S.field}>
              <label style={S.label}>Address</label>
              <input style={S.input} value={shopData.address || ""} onChange={e => setShopData(p => ({ ...p, address: e.target.value }))} placeholder="Shop address" />
            </div>
            <div style={S.field}>
              <label style={S.label}>Shop Description</label>
              <textarea
                style={{ ...S.input, minHeight: 80, resize: "vertical" }}
                value={shopData.shopDescription || ""}
                onChange={e => setShopData(p => ({ ...p, shopDescription: e.target.value }))}
                placeholder="Tell customers about your shop..."
              />
            </div>
            <button style={S.btn("primary")} onClick={handleSaveShop} disabled={saving}>
              {saving ? "Saving..." : "Update Shop"}
            </button>
          </div>
        )}
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
