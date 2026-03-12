import { useState, useRef } from "react";
import { sendPhoneOtp, verifyPhoneOtp, signInWithGoogle } from "../firebase.js";
import { api, setTokens } from "../api/client.js";
import { T, FONT } from "../theme.js";

/**
 * AUTH FLOW:
 *
 * STEP 1 — Role selection: "Shop Owner" | "Customer / Mechanic"
 * STEP 2 — Auth method: Phone OTP | Google (Google only for customers)
 * STEP 3 — OTP entry (if phone chosen)
 * STEP 4 — Profile setup (only for NEW users):
 *           Shop Owner: name + shop name + city + GSTIN
 *           Customer: name only
 * DONE — redirect to ERP or Marketplace
 */

const STEPS = { ROLE: "role", AUTH: "auth", OTP: "otp", PROFILE: "profile" };

// ─── Styles ────────────────────────────────────────────────────────────────

const css = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .auth-card { animation: fadeUp 0.3s ease; }
  .auth-input:focus { border-color: ${T.amber} !important; box-shadow: 0 0 0 3px ${T.amberGlow}; }
  .auth-btn-primary:hover:not(:disabled) { background: #FBBF24; transform: translateY(-1px); }
  .auth-btn-google:hover { background: #1e2d47 !important; border-color: ${T.borderHi} !important; }
  .auth-role-card:hover { border-color: ${T.amber} !important; background: ${T.amberSoft} !important; }
  .auth-role-card.selected { border-color: ${T.amber}; background: ${T.amberSoft}; }
  .otp-box:focus { border-color: ${T.amber} !important; box-shadow: 0 0 0 3px ${T.amberGlow}; }
`;

const S = {
  page: { display: "flex", minHeight: "100vh", background: T.bg, fontFamily: FONT.ui },

  // Left branding panel
  left: {
    width: 420, minWidth: 420, background: T.surface, display: "flex", flexDirection: "column",
    justifyContent: "space-between", padding: "48px 44px", borderRight: `1px solid ${T.border}`,
  },
  logo: { display: "flex", alignItems: "center", gap: 12, marginBottom: 44 },
  logoMark: {
    width: 44, height: 44, borderRadius: 12, background: T.amber,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
  },
  logoText: { fontSize: 22, fontWeight: 800, color: T.t1, letterSpacing: "-0.5px" },
  tagline: { fontSize: 26, fontWeight: 700, color: T.t1, lineHeight: 1.3, marginBottom: 36 },
  featureList: { display: "flex", flexDirection: "column", gap: 18 },
  feature: { display: "flex", gap: 14, alignItems: "flex-start" },
  featureIconWrap: {
    width: 38, height: 38, borderRadius: 10, background: T.amberGlow, border: `1px solid ${T.amberSoft}`,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
  },
  featureTitle: { fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 2 },
  featureDesc: { fontSize: 13, color: T.t2, lineHeight: 1.4 },
  trust: {
    display: "flex", alignItems: "center", gap: 8, padding: "16px 0",
    borderTop: `1px solid ${T.border}`, color: T.t3, fontSize: 13,
  },

  // Right auth panel
  right: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 48px" },
  card: { width: "100%", maxWidth: 440 },
  stepLabel: {
    fontSize: 12, fontWeight: 600, color: T.amber, letterSpacing: "1px",
    textTransform: "uppercase", marginBottom: 8,
  },
  heading: { fontSize: 26, fontWeight: 800, color: T.t1, marginBottom: 6, letterSpacing: "-0.3px" },
  sub: { fontSize: 15, color: T.t2, marginBottom: 32, lineHeight: 1.5 },

  // Role cards
  roleGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 },
  roleCard: {
    padding: "20px 16px", borderRadius: 14, border: `2px solid ${T.border}`,
    background: T.surface, cursor: "pointer", textAlign: "center", transition: "all 0.2s",
  },
  roleIcon: { fontSize: 32, marginBottom: 10, display: "block" },
  roleTitle: { fontSize: 14, fontWeight: 700, color: T.t1, marginBottom: 4 },
  roleDesc: { fontSize: 12, color: T.t2, lineHeight: 1.4 },

  // Inputs
  label: { fontSize: 13, fontWeight: 600, color: T.t2, marginBottom: 6, display: "block" },
  inputBase: {
    width: "100%", background: T.surface, border: `1.5px solid ${T.border}`,
    borderRadius: 10, padding: "12px 14px", color: T.t1, fontSize: 15,
    outline: "none", boxSizing: "border-box", fontFamily: FONT.ui, transition: "border 0.2s",
  },
  phoneRow: {
    display: "flex", alignItems: "stretch", border: `1.5px solid ${T.border}`,
    borderRadius: 10, overflow: "hidden", marginBottom: 8, background: T.surface, transition: "border 0.2s",
  },
  phoneFlag: {
    padding: "12px 14px", background: "#0D1628", color: T.t2, fontSize: 14,
    borderRight: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6,
    whiteSpace: "nowrap", fontFamily: FONT.mono,
  },
  phoneInput: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: T.t1, fontSize: 16, padding: "12px 14px", fontFamily: FONT.mono, letterSpacing: "1px",
  },

  // Buttons
  btnPrimary: (disabled) => ({
    width: "100%", padding: "14px", background: disabled ? T.amberDim : T.amber,
    color: disabled ? "#aaa" : "#000", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", marginBottom: 14, transition: "all 0.2s",
    fontFamily: FONT.ui,
  }),
  btnGoogle: {
    width: "100%", padding: "13px", background: T.surface, border: `1.5px solid ${T.border}`,
    borderRadius: 10, color: T.t1, fontSize: 14, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14,
    transition: "all 0.2s", fontFamily: FONT.ui,
  },
  btnBack: {
    background: "none", border: "none", color: T.t2, cursor: "pointer",
    fontSize: 13, padding: "0 0 20px", display: "flex", alignItems: "center", gap: 6, fontFamily: FONT.ui,
  },

  // OTP boxes
  otpRow: { display: "flex", gap: 10, marginBottom: 20 },
  otpBox: {
    flex: 1, height: 54, textAlign: "center", fontSize: 22, fontWeight: 700,
    fontFamily: FONT.mono, background: T.surface, border: `1.5px solid ${T.border}`,
    borderRadius: 10, color: T.t1, outline: "none", transition: "border 0.2s, box-shadow 0.2s",
  },

  // Divider
  orRow: { display: "flex", alignItems: "center", gap: 12, margin: "16px 0" },
  orLine: { flex: 1, height: 1, background: T.border },
  orText: { color: T.t3, fontSize: 12, fontWeight: 600 },

  // Misc
  error: {
    background: "#1c0909", border: `1.5px solid ${T.crimson}`, borderRadius: 10,
    padding: "11px 14px", color: T.crimson, fontSize: 13, marginBottom: 14,
  },
  resend: { textAlign: "center", fontSize: 13, color: T.t2, marginBottom: 4 },
  resendBtn: { background: "none", border: "none", color: T.amber, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  hint: { fontSize: 12, color: T.t3, marginBottom: 20, lineHeight: 1.5 },
};

// ─── Feature list ──────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "🧾", title: "GST billing in seconds", desc: "Multi-tender invoices with WhatsApp delivery" },
  { icon: "📦", title: "Live inventory & stock alerts", desc: "Immutable ledger — every movement tracked" },
  { icon: "🤝", title: "Udhaar / credit tracking", desc: "Digital khata — automated reminders" },
  { icon: "🔍", title: "Fitment-guaranteed search", desc: "Parts guaranteed to fit your exact vehicle" },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState(STEPS.ROLE);
  const [role, setRole] = useState(null);          // "shop" | "customer"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // logged-in user (before profile setup)

  // Profile form
  const [profile, setProfile] = useState({ name: "", shopName: "", city: "Hyderabad", gstin: "" });

  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // ── Timer for OTP resend ──
  const startResendTimer = () => {
    setResendTimer(60);
    const iv = setInterval(() => setResendTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; }), 1000);
  };

  // ── Send OTP ──
  const handleSendOtp = async () => {
    if (!phone || phone.length !== 10) { setError("Enter a valid 10-digit mobile number"); return; }
    setError(""); setLoading(true);
    try {
      const result = await sendPhoneOtp(phone, "recaptcha-container");
      setConfirmResult(result);
      setStep(STEPS.OTP);
      startResendTimer();
    } catch (e) { setError(e.message || "Could not send OTP. Try again."); }
    setLoading(false);
  };

  // ── Verify OTP → backend auth → new or existing user ──
  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setError(""); setLoading(true);
    try {
      const { token } = await verifyPhoneOtp(confirmResult, code);
      await loginWithBackend(token);
    } catch (e) { setError(e.message || "Invalid OTP. Try again."); }
    setLoading(false);
  };

  // ── Google Sign-In ──
  const handleGoogleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const { token } = await signInWithGoogle();
      await loginWithBackend(token);
    } catch (e) {
      console.error('[Login] Google sign-in error:', e);
      if (e.message === 'SESSION_EXPIRED') {
        setError("Session expired. Please try again.");
      } else if (e.message?.includes('popup-closed') || e.message?.includes('popup_closed')) {
        setError("Sign-in popup was closed. Please try again.");
      } else if (e.message?.includes('network') || e.message?.includes('Failed to fetch')) {
        setError("Network error — check your internet connection and ensure the backend server is running.");
      } else {
        setError(e.message || "Google sign-in failed. Try again.");
      }
    }
    setLoading(false);
  };

  // ── Core: call backend, detect new vs existing ──
  const loginWithBackend = async (firebaseToken) => {
    let data;
    try {
      data = await api.post("/api/auth/firebase", { firebaseToken, role });
    } catch (e) {
      console.error('[Login] Backend auth error:', e);
      if (e.code === 'NETWORK_ERROR' || e.message?.includes('Failed to fetch')) {
        throw new Error("Cannot reach the server. Please check if the backend is running on port 3001.");
      }
      throw new Error(e.data?.error?.message || e.data?.error || e.message || "Authentication failed. Please try again.");
    }

    // Handle both new structured format (data.data) and old flat format
    const userData = data?.data?.user || data?.user;
    const accessToken = data?.data?.accessToken || data?.accessToken;
    const refreshToken = data?.refreshToken; // Still in body for backwards compat
    const newUserFlag = data?.data?.isNewUser ?? data?.isNewUser;

    if (!userData) {
      throw new Error("Server returned an unexpected response. Please try again.");
    }

    setTokens(accessToken, refreshToken);

    if (newUserFlag) {
      // New user — collect profile
      setIsNewUser(true);
      setCurrentUser(userData);
      // Pre-fill name if Google provided it
      if (userData.name) setProfile(p => ({ ...p, name: userData.name }));
      setStep(STEPS.PROFILE);
    } else {
      // Existing user — done
      localStorage.setItem("as_user", JSON.stringify(userData));
      onLogin(userData);
    }
  };

  // ── Save profile (new user onboarding) ──
  const handleSaveProfile = async () => {
    if (!profile.name.trim()) { setError("Please enter your name"); return; }
    if (role === "shop" && !profile.shopName.trim()) { setError("Please enter your shop name"); return; }
    setError(""); setLoading(true);
    try {
      let user = { ...currentUser, name: profile.name.trim() };

      if (role === "shop") {
        // Register shop (also updates name on backend)
        const shopRes = await api.post("/api/auth/register-shop", {
          name: profile.shopName.trim(),
          ownerName: profile.name.trim(),
          gstin: profile.gstin.trim() || undefined,
          city: profile.city.trim(),
        });
        user = { ...user, shopId: shopRes.shop.shopId, role: "SHOP_OWNER", shop: shopRes.shop };
      } else {
        // Save name to backend for customers
        const res = await api.patch("/api/auth/me", { name: profile.name.trim() });
        const updatedUser = res?.data || res;
        user = { ...user, name: updatedUser.name || profile.name.trim(), role: "CUSTOMER" };
      }

      localStorage.setItem("as_user", JSON.stringify(user));
      onLogin(user);
    } catch (e) { setError(e.message || "Could not save profile. Try again."); }
    setLoading(false);
  };

  // ── OTP input helpers ──
  const handleOtpChange = (i, v) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...otp]; n[i] = v.slice(-1); setOtp(n);
    if (v && i < 5) otpRefs[i + 1].current?.focus();
    if (!v && i > 0) otpRefs[i - 1].current?.focus();
  };
  const handleOtpKey = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
    if (e.key === "Enter") handleVerifyOtp();
  };

  // ─────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // ── STEP 1: Role selection ──
      case STEPS.ROLE:
        return (
          <div className="auth-card">
            <div style={S.stepLabel}>Welcome to AutoSpace</div>
            <div style={S.heading}>Who are you?</div>
            <div style={S.sub}>Select your role to get the right experience.</div>

            <div style={S.roleGrid}>
              <div
                className={`auth-role-card ${role === "shop" ? "selected" : ""}`}
                style={S.roleCard}
                onClick={() => setRole("shop")}
              >
                <span style={S.roleIcon}>🏪</span>
                <div style={S.roleTitle}>Shop Owner</div>
                <div style={S.roleDesc}>Manage inventory, billing & credit for your auto parts shop</div>
              </div>
              <div
                className={`auth-role-card ${role === "customer" ? "selected" : ""}`}
                style={S.roleCard}
                onClick={() => setRole("customer")}
              >
                <span style={S.roleIcon}>🚗</span>
                <div style={S.roleTitle}>Customer / Mechanic</div>
                <div style={S.roleDesc}>Find parts with fitment guarantee & order from nearby shops</div>
              </div>
            </div>

            <button
              className="auth-btn-primary"
              style={S.btnPrimary(!role)}
              disabled={!role}
              onClick={() => role && setStep(STEPS.AUTH)}
            >
              Continue →
            </button>

            <div style={{ textAlign: "center", fontSize: 13, color: T.t3 }}>
              Works for both sign in &amp; sign up
            </div>
          </div>
        );

      // ── STEP 2: Auth method (phone / Google) ──
      case STEPS.AUTH:
        return (
          <div className="auth-card">
            <button style={S.btnBack} onClick={() => setStep(STEPS.ROLE)}>← Back</button>
            <div style={S.stepLabel}>{role === "shop" ? "Shop Owner" : "Customer / Mechanic"}</div>
            <div style={S.heading}>Sign in or Sign up</div>
            <div style={S.sub}>Enter your mobile number. We'll send a one-time password.</div>

            {error && <div style={S.error}>{error}</div>}

            <label style={S.label}>Mobile number</label>
            <div className="auth-input" style={S.phoneRow}>
              <span style={S.phoneFlag}>🇮🇳 +91</span>
              <input
                style={S.phoneInput}
                placeholder="98765 43210"
                value={phone}
                maxLength={10}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                autoFocus
              />
            </div>
            <div style={S.hint}>We'll send a 6-digit OTP. Standard SMS rates apply.</div>

            <button
              className="auth-btn-primary"
              style={S.btnPrimary(loading || phone.length !== 10)}
              onClick={handleSendOtp}
              disabled={loading || phone.length !== 10}
            >
              {loading ? "Sending OTP..." : "Send OTP →"}
            </button>

            <div style={S.orRow}>
              <div style={S.orLine} /><span style={S.orText}>OR</span><div style={S.orLine} />
            </div>

            <button className="auth-btn-google" style={S.btnGoogle} onClick={handleGoogleLogin} disabled={loading}>
              <GoogleIcon />
              Continue with Google
            </button>

            <div id="recaptcha-container" />
          </div>
        );

      // ── STEP 3: OTP verification ──
      case STEPS.OTP:
        return (
          <div className="auth-card">
            <button style={S.btnBack} onClick={() => { setStep(STEPS.AUTH); setOtp(["","","","","",""]); setError(""); }}>← Change number</button>
            <div style={S.stepLabel}>Verification</div>
            <div style={S.heading}>Enter OTP</div>
            <div style={S.sub}>
              Sent to <strong style={{ color: T.t1 }}>+91 {phone.slice(0, 5)} {phone.slice(5)}</strong>
            </div>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.otpRow}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  className="otp-box"
                  style={S.otpBox}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              className="auth-btn-primary"
              style={S.btnPrimary(loading || otp.join("").length < 6)}
              onClick={handleVerifyOtp}
              disabled={loading || otp.join("").length < 6}
            >
              {loading ? "Verifying..." : "Verify & Continue ✓"}
            </button>

            <div style={S.resend}>
              {resendTimer > 0
                ? <span style={{ color: T.t3 }}>Resend OTP in {resendTimer}s</span>
                : <><span style={{ color: T.t3 }}>Didn't get it? </span><button style={S.resendBtn} onClick={handleSendOtp}>Resend OTP</button></>
              }
            </div>
          </div>
        );

      // ── STEP 4: Profile setup (new users only) ──
      case STEPS.PROFILE:
        return (
          <div className="auth-card">
            <div style={S.stepLabel}>Almost there!</div>
            <div style={S.heading}>{role === "shop" ? "Set up your shop" : "Quick setup"}</div>
            <div style={S.sub}>
              {role === "shop"
                ? "Tell us about your shop to complete registration."
                : "Just your name — and you're ready to shop."}
            </div>

            {error && <div style={S.error}>{error}</div>}

            <label style={S.label}>Your name *</label>
            <input
              className="auth-input"
              style={{ ...S.inputBase, marginBottom: 16 }}
              placeholder="e.g. Raju Sharma"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              autoFocus
            />

            {role === "shop" && (
              <>
                <label style={S.label}>Shop name *</label>
                <input
                  className="auth-input"
                  style={{ ...S.inputBase, marginBottom: 16 }}
                  placeholder="e.g. Raju Auto Parts"
                  value={profile.shopName}
                  onChange={e => setProfile(p => ({ ...p, shopName: e.target.value }))}
                />

                <label style={S.label}>City</label>
                <input
                  className="auth-input"
                  style={{ ...S.inputBase, marginBottom: 16 }}
                  placeholder="e.g. Hyderabad"
                  value={profile.city}
                  onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                />

                <label style={S.label}>GSTIN <span style={{ color: T.t3, fontWeight: 400 }}>(optional — add later)</span></label>
                <input
                  className="auth-input"
                  style={{ ...S.inputBase, marginBottom: 20 }}
                  placeholder="e.g. 36AABCS1429B1Z1"
                  value={profile.gstin}
                  onChange={e => setProfile(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                />
              </>
            )}

            <button
              className="auth-btn-primary"
              style={S.btnPrimary(loading)}
              onClick={handleSaveProfile}
              disabled={loading}
            >
              {loading ? "Setting up..." : role === "shop" ? "Launch my shop 🚀" : "Start shopping →"}
            </button>
          </div>
        );

      default: return null;
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={S.page}>

        {/* ── Left branding panel ── */}
        <div style={S.left}>
          <div>
            <div style={S.logo}>
              <div style={S.logoMark}>⚙️</div>
              <span style={S.logoText}>AutoSpace</span>
            </div>
            <div style={S.tagline}>The smart platform for India's auto parts trade</div>
            <div style={S.featureList}>
              {FEATURES.map((f, i) => (
                <div key={i} style={S.feature}>
                  <div style={S.featureIconWrap}>{f.icon}</div>
                  <div>
                    <div style={S.featureTitle}>{f.title}</div>
                    <div style={S.featureDesc}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.trust}>
            <span style={{ color: T.emerald, fontSize: 16 }}>⭐</span>
            Trusted by shops in Hyderabad &nbsp;·&nbsp; Launch city: Hyderabad
          </div>
        </div>

        {/* ── Right auth panel ── */}
        <div style={S.right}>
          <div style={S.card}>
            {/* Progress dots */}
            <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
              {[STEPS.ROLE, STEPS.AUTH, STEPS.OTP, STEPS.PROFILE].map((s, i) => {
                const stepOrder = [STEPS.ROLE, STEPS.AUTH, STEPS.OTP, STEPS.PROFILE];
                const current = stepOrder.indexOf(step);
                const idx = stepOrder.indexOf(s);
                const active = idx === current;
                const done = idx < current;
                // Skip OTP dot if Google was used
                if (s === STEPS.OTP && step === STEPS.PROFILE && !phone) return null;
                return (
                  <div key={s} style={{
                    height: 4, flex: s === STEPS.ROLE ? 0.5 : 1, borderRadius: 2,
                    background: done ? T.amber : active ? T.amber : T.border,
                    opacity: active ? 1 : done ? 0.7 : 0.3,
                    transition: "all 0.3s",
                  }} />
                );
              })}
            </div>

            {renderStep()}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Google icon SVG ─────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
