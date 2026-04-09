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
      : variant === "danger"
      ? { background: "transparent", border: `1.5px solid ${T.crimson}`, color: T.crimson }
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
  card: {
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12,
    padding: "14px 16px", marginBottom: 10,
  },
  statRow: {
    display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap",
  },
  stat: {
    flex: "1 1 120px", background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 12, padding: "14px 16px", textAlign: "center",
  },
  statVal: { fontSize: 22, fontWeight: 800, color: T.amber },
  statLabel: { fontSize: 11, color: T.t3, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" },
};

const PROVIDER_META = {
  EMAIL: { icon: "✉️", label: "Email" },
  PHONE: { icon: "📱", label: "Phone" },
  GOOGLE: { icon: "🔵", label: "Google" },
};

const STAFF_ROLE_COLORS = {
  OWNER: T.amber, MANAGER: "#8B5CF6", CASHIER: T.sky,
  MECHANIC: T.emerald, DELIVERY: "#F97316",
};

// ─── Address Form Modal ────────────────────────────────────────────────────────
function AddressForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || { label: "Home", fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ marginTop: 16, padding: 16, background: T.bg, borderRadius: 12, border: `1px solid ${T.border}` }}>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>Label</label>
          <select style={{ ...S.input, cursor: "pointer" }} value={form.label} onChange={e => set("label", e.target.value)}>
            <option>Home</option><option>Work</option><option>Other</option>
          </select>
        </div>
        <div style={S.field}>
          <label style={S.label}>Full Name</label>
          <input style={S.input} value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder="Recipient name" />
        </div>
      </div>
      <div style={S.field}>
        <label style={S.label}>Phone</label>
        <input style={S.input} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 XXXXX XXXXX" />
      </div>
      <div style={S.field}>
        <label style={S.label}>Address Line 1</label>
        <input style={S.input} value={form.line1} onChange={e => set("line1", e.target.value)} placeholder="House/Flat, Street" />
      </div>
      <div style={S.field}>
        <label style={S.label}>Address Line 2</label>
        <input style={S.input} value={form.line2 || ""} onChange={e => set("line2", e.target.value)} placeholder="Area, Colony (optional)" />
      </div>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>City</label>
          <input style={S.input} value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
        </div>
        <div style={S.field}>
          <label style={S.label}>State</label>
          <input style={S.input} value={form.state} onChange={e => set("state", e.target.value)} placeholder="State" />
        </div>
      </div>
      <div style={S.field}>
        <label style={S.label}>Pincode</label>
        <input style={S.input} value={form.pincode} onChange={e => set("pincode", e.target.value)} placeholder="6-digit pincode" maxLength={6} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button style={S.btn("primary")} onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving..." : "Save Address"}</button>
        <button style={S.btn("secondary")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Garage Form ───────────────────────────────────────────────────────────────
function GarageForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || { nickname: "", make: "", model: "", variant: "", year: new Date().getFullYear(), fuelType: "PETROL", registrationNo: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ marginTop: 16, padding: 16, background: T.bg, borderRadius: 12, border: `1px solid ${T.border}` }}>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>Nickname (optional)</label>
          <input style={S.input} value={form.nickname || ""} onChange={e => set("nickname", e.target.value)} placeholder='e.g. "My Activa"' />
        </div>
        <div style={S.field}>
          <label style={S.label}>Make</label>
          <input style={S.input} value={form.make} onChange={e => set("make", e.target.value)} placeholder="Honda, Maruti, etc." />
        </div>
      </div>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>Model</label>
          <input style={S.input} value={form.model} onChange={e => set("model", e.target.value)} placeholder="Activa, Swift, etc." />
        </div>
        <div style={S.field}>
          <label style={S.label}>Variant</label>
          <input style={S.input} value={form.variant || ""} onChange={e => set("variant", e.target.value)} placeholder="VXi, ZXi, etc." />
        </div>
      </div>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>Year</label>
          <input style={S.input} type="number" value={form.year} onChange={e => set("year", e.target.value)} min={1990} max={new Date().getFullYear()} />
        </div>
        <div style={S.field}>
          <label style={S.label}>Fuel Type</label>
          <select style={{ ...S.input, cursor: "pointer" }} value={form.fuelType || "PETROL"} onChange={e => set("fuelType", e.target.value)}>
            <option value="PETROL">Petrol</option>
            <option value="DIESEL">Diesel</option>
            <option value="CNG">CNG</option>
            <option value="ELECTRIC">Electric</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
      </div>
      <div style={S.field}>
        <label style={S.label}>Registration Number</label>
        <input style={S.input} value={form.registrationNo || ""} onChange={e => set("registrationNo", e.target.value.toUpperCase())} placeholder="MH12AB1234" />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button style={S.btn("primary")} onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving..." : "Save Vehicle"}</button>
        <button style={S.btn("secondary")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Main ProfilePage ──────────────────────────────────────────────────────────
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

  // Layer 2: role-specific
  const [customerProfile, setCustomerProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [garageVehicles, setGarageVehicles] = useState([]);
  const [shopStaff, setShopStaff] = useState([]);

  // UI states
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [showGarageForm, setShowGarageForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("CASHIER");
  const [inviting, setInviting] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Pre-populate from the cached user prop immediately (no API wait)
  useEffect(() => {
    if (user) {
      setUserData(user);
      setName(user.name || "");
      setEmail(user.email || "");
      if (user.shop) setShopData(user.shop);
    }
  }, [user]);

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

      // Layer 2 role-specific
      if (data.customerProfile) setCustomerProfile(data.customerProfile);
      if (data.addresses) setAddresses(data.addresses);
      if (data.garageVehicles) setGarageVehicles(data.garageVehicles);
      if (data.shopStaff) setShopStaff(data.shopStaff);
    } catch (e) {
      // Non-fatal: we already have the user prop — just note the refresh failed
      // Don't block the UI with a hard error; the cached data is sufficient to use
      console.warn("[Profile] API refresh failed:", e.message);
      if (!userData) {
        // Only show error if we have no data at all
        setError("Could not refresh profile from server. Showing cached data.");
      }
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
      const stored = JSON.parse(localStorage.getItem("as_user") || "{}");
      const newUser = { ...stored, name: updated.name, email: updated.email };
      localStorage.setItem("as_user", JSON.stringify(newUser));
      if (onUserUpdate) onUserUpdate(newUser);
      if (emailChanged && updated.emailVerified === false) {
        api.post("/api/auth/resend-verification", { email: updated.email }).catch(() => {});
        showToast("Verification email sent to your new address");
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

  // ── Address handlers ──────────────────────────────────────────────────────────
  const handleSaveAddress = async (form) => {
    setSaving(true);
    try {
      if (editingAddress) {
        const res = await api.put(`/api/customer/addresses/${editingAddress.addressId}`, form);
        setAddresses(prev => prev.map(a => a.addressId === editingAddress.addressId ? (res.data || res) : a));
        showToast("Address updated");
      } else {
        const res = await api.post("/api/customer/addresses", form);
        setAddresses(prev => [...prev, res.data || res]);
        showToast("Address added");
      }
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to save address");
    }
    setSaving(false);
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm("Remove this address?")) return;
    try {
      await api.delete(`/api/customer/addresses/${addressId}`);
      setAddresses(prev => prev.filter(a => a.addressId !== addressId));
      showToast("Address removed");
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to remove address");
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    try {
      const res = await api.patch(`/api/customer/addresses/${addressId}/default`, {});
      setAddresses(res.data || res);
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to set default");
    }
  };

  // ── Garage handlers ────────────────────────────────────────────────────────────
  const handleSaveVehicle = async (form) => {
    setSaving(true);
    try {
      if (editingVehicle) {
        const res = await api.put(`/api/customer/garage/${editingVehicle.garageId}`, form);
        setGarageVehicles(prev => prev.map(v => v.garageId === editingVehicle.garageId ? (res.data || res) : v));
        showToast("Vehicle updated");
      } else {
        const res = await api.post("/api/customer/garage", form);
        setGarageVehicles(prev => [...prev, res.data || res]);
        showToast("Vehicle added to garage");
      }
      setShowGarageForm(false);
      setEditingVehicle(null);
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to save vehicle");
    }
    setSaving(false);
  };

  const handleDeleteVehicle = async (garageId) => {
    if (!window.confirm("Remove this vehicle from your garage?")) return;
    try {
      await api.delete(`/api/customer/garage/${garageId}`);
      setGarageVehicles(prev => prev.filter(v => v.garageId !== garageId));
      showToast("Vehicle removed");
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to remove vehicle");
    }
  };

  const handleSetDefaultVehicle = async (garageId) => {
    try {
      const res = await api.patch(`/api/customer/garage/${garageId}/default`, {});
      setGarageVehicles(res.data || res);
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to set default vehicle");
    }
  };

  // ── Staff handlers ────────────────────────────────────────────────────────────
  const handleInviteStaff = async () => {
    if (!invitePhone.trim()) return;
    setInviting(true); setError("");
    try {
      const res = await api.post("/api/shop/staff/invite", { phone: invitePhone.trim(), role: inviteRole });
      const newMember = res.data || res;
      setShopStaff(prev => [...prev, newMember]);
      setInvitePhone("");
      showToast(`${newMember.user?.name || "Staff member"} added as ${inviteRole}`);
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to invite staff");
    }
    setInviting(false);
  };

  const handleDeactivateStaff = async (staffId) => {
    if (!window.confirm("Deactivate this staff member? They will lose shop access.")) return;
    try {
      await api.patch(`/api/shop/staff/${staffId}/deactivate`, {});
      setShopStaff(prev => prev.map(s => s.id === staffId ? { ...s, isActive: false } : s));
      showToast("Staff access revoked");
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to deactivate");
    }
  };

  const handleReactivateStaff = async (staffId) => {
    try {
      const res = await api.patch(`/api/shop/staff/${staffId}/reactivate`, {});
      const updated = res.data || res;
      setShopStaff(prev => prev.map(s => s.id === staffId ? { ...s, ...updated } : s));
      showToast("Staff reactivated");
    } catch (e) {
      setError(e.data?.error?.message || e.message || "Failed to reactivate");
    }
  };

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.t3, fontSize: 14 }}>Loading profile...</div>
      </div>
    );
  }

  const role = userData?.role;

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
            <span>⚠️ Your email address is not verified. Check your inbox.</span>
            <button
              style={{ background: "none", border: "none", color: T.amber, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: FONT.ui, whiteSpace: "nowrap" }}
              onClick={() => {
                api.post("/api/auth/resend-verification", { email: userData.email }).catch(() => {});
                showToast("Verification email resent");
              }}
            >Resend</button>
          </div>
        )}
        {error && <div style={S.error}>{error}</div>}

        {/* ─── Customer Loyalty Stats ─── */}
        {role === "CUSTOMER" && customerProfile && (
          <div style={S.section}>
            <div style={S.sectionTitle}>⭐ Loyalty & Wallet</div>
            <div style={S.statRow}>
              <div style={S.stat}>
                <div style={S.statVal}>₹{parseFloat(customerProfile.walletBalance || 0).toFixed(0)}</div>
                <div style={S.statLabel}>Wallet Balance</div>
              </div>
              <div style={S.stat}>
                <div style={S.statVal}>{customerProfile.loyaltyPoints || 0}</div>
                <div style={S.statLabel}>Loyalty Points</div>
              </div>
              <div style={S.stat}>
                <div style={S.statVal}>{customerProfile.totalOrders || 0}</div>
                <div style={S.statLabel}>Total Orders</div>
              </div>
              <div style={S.stat}>
                <div style={S.statVal}>₹{parseFloat(customerProfile.totalSpent || 0).toFixed(0)}</div>
                <div style={S.statLabel}>Total Spent</div>
              </div>
            </div>
          </div>
        )}

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
              <select style={{ ...S.input, cursor: "pointer" }} value={profile.gender || ""} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Date of Birth</label>
              <input
                style={S.input} type="date"
                value={profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : ""}
                onChange={e => setProfile(p => ({ ...p, dateOfBirth: e.target.value }))}
              />
            </div>
          </div>
          <button style={S.btn("primary")} onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Details"}
          </button>
        </div>

        {/* ─── Customer: Address Book ─── */}
        {role === "CUSTOMER" && (
          <div style={S.section}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={S.sectionTitle}>📍 Saved Addresses</div>
              {!showAddressForm && !editingAddress && (
                <button style={S.btn("secondary")} onClick={() => setShowAddressForm(true)}>+ Add Address</button>
              )}
            </div>

            {showAddressForm && !editingAddress && (
              <AddressForm saving={saving} onSave={handleSaveAddress} onCancel={() => setShowAddressForm(false)} />
            )}

            {addresses.length === 0 && !showAddressForm && (
              <div style={{ color: T.t3, fontSize: 13, padding: "12px 0" }}>No saved addresses. Add one for faster checkout.</div>
            )}
            {addresses.map(addr => (
              <div key={addr.addressId} style={{ ...S.card, position: "relative" }}>
                {editingAddress?.addressId === addr.addressId ? (
                  <AddressForm initial={addr} saving={saving} onSave={handleSaveAddress} onCancel={() => setEditingAddress(null)} />
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={S.badge(T.sky)}>{addr.label}</span>
                        {addr.isDefault && <span style={S.badge(T.emerald)}>Default</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!addr.isDefault && (
                          <button style={{ ...S.btn("secondary"), padding: "4px 10px", fontSize: 11 }} onClick={() => handleSetDefaultAddress(addr.addressId)}>Set Default</button>
                        )}
                        <button style={{ ...S.btn("secondary"), padding: "4px 10px", fontSize: 11 }} onClick={() => setEditingAddress(addr)}>Edit</button>
                        <button style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 11 }} onClick={() => handleDeleteAddress(addr.addressId)}>Remove</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{addr.fullName}</div>
                    <div style={{ fontSize: 13, color: T.t2 }}>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</div>
                    {addr.landmark && <div style={{ fontSize: 13, color: T.t3 }}>Near: {addr.landmark}</div>}
                    <div style={{ fontSize: 13, color: T.t2 }}>{addr.city}, {addr.state} — {addr.pincode}</div>
                    <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>📞 {addr.phone}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── Customer: My Garage ─── */}
        {role === "CUSTOMER" && (
          <div style={S.section}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={S.sectionTitle}>🚗 My Garage</div>
              {!showGarageForm && !editingVehicle && (
                <button style={S.btn("secondary")} onClick={() => setShowGarageForm(true)}>+ Add Vehicle</button>
              )}
            </div>

            {showGarageForm && !editingVehicle && (
              <GarageForm saving={saving} onSave={handleSaveVehicle} onCancel={() => setShowGarageForm(false)} />
            )}

            {garageVehicles.length === 0 && !showGarageForm && (
              <div style={{ color: T.t3, fontSize: 13, padding: "12px 0" }}>No vehicles saved. Add your vehicle for fitment-guaranteed parts browsing.</div>
            )}
            {garageVehicles.map(v => (
              <div key={v.garageId} style={S.card}>
                {editingVehicle?.garageId === v.garageId ? (
                  <GarageForm initial={v} saving={saving} onSave={handleSaveVehicle} onCancel={() => setEditingVehicle(null)} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{v.nickname || `${v.make} ${v.model}`}</span>
                        {v.isDefault && <span style={S.badge(T.emerald)}>Default</span>}
                      </div>
                      <div style={{ fontSize: 13, color: T.t2 }}>
                        {v.make} {v.model}{v.variant ? ` ${v.variant}` : ""} · {v.year}
                        {v.fuelType ? ` · ${v.fuelType}` : ""}
                      </div>
                      {v.registrationNo && <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>🔢 {v.registrationNo}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!v.isDefault && (
                        <button style={{ ...S.btn("secondary"), padding: "4px 10px", fontSize: 11 }} onClick={() => handleSetDefaultVehicle(v.garageId)}>Set Default</button>
                      )}
                      <button style={{ ...S.btn("secondary"), padding: "4px 10px", fontSize: 11 }} onClick={() => setEditingVehicle(v)}>Edit</button>
                      <button style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 11 }} onClick={() => handleDeleteVehicle(v.garageId)}>Remove</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── Shop Owner: Staff Management ─── */}
        {role === "SHOP_OWNER" && (
          <div style={S.section}>
            <div style={S.sectionTitle}>👥 Staff Management</div>

            {/* Invite form */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.t2, marginBottom: 10 }}>Invite Staff Member</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  style={{ ...S.input, flex: "1 1 160px", minWidth: 160 }}
                  value={invitePhone}
                  onChange={e => setInvitePhone(e.target.value)}
                  placeholder="Phone number of staff"
                />
                <select style={{ ...S.input, flex: "0 0 140px", cursor: "pointer" }} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  {["MANAGER", "CASHIER", "MECHANIC", "DELIVERY"].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button style={{ ...S.btn("primary"), whiteSpace: "nowrap" }} onClick={handleInviteStaff} disabled={inviting || !invitePhone.trim()}>
                  {inviting ? "Adding..." : "Add Staff"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 8 }}>Staff must already have a redpiston account. They will get immediate access.</div>
            </div>

            {/* Staff list */}
            {shopStaff.length === 0 ? (
              <div style={{ color: T.t3, fontSize: 13, padding: "8px 0" }}>No staff members yet.</div>
            ) : (
              shopStaff.map(s => (
                <div key={s.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 16, fontWeight: 800,
                      background: `${STAFF_ROLE_COLORS[s.role] || T.t3}22`,
                      color: STAFF_ROLE_COLORS[s.role] || T.t3,
                    }}>
                      {(s.user?.name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.user?.name || "—"}</div>
                      <div style={{ fontSize: 12, color: T.t3 }}>{s.user?.phone || s.user?.email || "—"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={S.badge(STAFF_ROLE_COLORS[s.role] || T.t3)}>{s.role}</span>
                    {!s.isActive && <span style={S.badge(T.crimson)}>Inactive</span>}
                    {s.role !== "OWNER" && (
                      s.isActive
                        ? <button style={{ ...S.btn("danger"), padding: "4px 12px", fontSize: 12 }} onClick={() => handleDeactivateStaff(s.id)}>Revoke Access</button>
                        : <button style={{ ...S.btn("secondary"), padding: "4px 12px", fontSize: 12 }} onClick={() => handleReactivateStaff(s.id)}>Reactivate</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
