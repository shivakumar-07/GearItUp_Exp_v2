import { useState, useRef } from "react";
import { sendPhoneOtp, verifyPhoneOtp, signInWithGoogle, isFirebaseConfigured, missingFirebaseEnvVars } from "../firebase.js";
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

// ─── Error message helper ──────────────────────────────────────────────────
function getErrorMessage(e, fallback = "Something went wrong. Please try again.") {
  // Structured API error: { data: { error: { message } } }
  if (e.data?.error?.message) return e.data.error.message;
  // Flat API error: { data: { error: "string" } }
  if (typeof e.data?.error === "string") return e.data.error;
  // Flat message: { data: { message: "string" } }
  if (e.data?.message) return e.data.message;
  // Error object with meaningful message (from api/client.js)
  if (e.message && e.message !== "Request failed") return e.message;
  return fallback;
}

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
  passwordWrap: { position: "relative", marginBottom: 8 },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
    border: "none", background: "transparent", color: T.t3, cursor: "pointer", fontSize: 16,
  },
};

// ─── Feature list ──────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "🧾", title: "GST billing in seconds", desc: "Multi-tender invoices with WhatsApp delivery" },
  { icon: "📦", title: "Live inventory & stock alerts", desc: "Immutable ledger — every movement tracked" },
  { icon: "🤝", title: "Udhaar / credit tracking", desc: "Digital khata — automated reminders" },
  { icon: "🔍", title: "Fitment-guaranteed search", desc: "Parts guaranteed to fit your exact vehicle" },
];

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
const isLocalApi = /localhost|127\.0\.0\.1/i.test(apiBaseUrl);

function getFirebaseConfigErrorMessage() {
  const missing = missingFirebaseEnvVars.length > 0
    ? ` Missing env vars: ${missingFirebaseEnvVars.join(", ")}.`
    : "";
  return `Firebase web auth is not configured for this frontend deployment.${missing} Add them in frontend environment settings and redeploy.`;
}

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

  // Email auth state
  const [authTab, setAuthTab] = useState("phone"); // "phone" | "email"
  const [emailMode, setEmailMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  // Set password for Google-auth accounts
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [setPasswordState, setSetPasswordState] = useState({ loading: false, error: "", newPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSetPasswordInput, setShowSetPasswordInput] = useState(false);

  // Profile form
  const [profile, setProfile] = useState({ name: "", shopName: "", city: "Hyderabad", gstin: "" });

  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const emailOtpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // ── Timer for OTP resend ──
  const startResendTimer = () => {
    setResendTimer(60);
    const iv = setInterval(() => setResendTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; }), 1000);
  };

  const ensureFirebaseAvailable = () => {
    if (!isFirebaseConfigured && !isLocalApi) {
      setError(getFirebaseConfigErrorMessage());
      return false;
    }
    return true;
  };

  // ── Send OTP ──
  const handleSendOtp = async () => {
    if (!phone || phone.length !== 10) { setError("Enter a valid 10-digit mobile number"); return; }
    if (!ensureFirebaseAvailable()) return;
    setError(""); setLoading(true);
    try {
      const result = await sendPhoneOtp(phone, "recaptcha-container");
      setConfirmResult(result);
      setStep(STEPS.OTP);
      startResendTimer();
    } catch (e) { setError(e.message || "Could not send OTP. Try again."); }
    setLoading(false);
  };

  // ── Email Register ──
  const handleEmailRegister = async () => {
    if (!email) { setError("Enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address"); return; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      const data = await api.post("/api/auth/register", { email, password, role });
      const userData = data?.user;
      const accessToken = data?.accessToken;
      const refreshToken = data?.refreshToken;
      if (!userData) throw new Error("Server returned an unexpected response.");
      setTokens(accessToken, refreshToken);
      setIsNewUser(true);
      setCurrentUser(userData);
      if (userData.name) setProfile(p => ({ ...p, name: userData.name }));
      // Go to email verification
      setStep(STEPS.OTP);
      startResendTimer();
    } catch (e) {
      setError(getErrorMessage(e, "Registration failed. Try again."));
    }
    setLoading(false);
  };

  // ── Email Login ──
  const handleEmailLogin = async () => {
    if (!email || !password) { setError("Enter both email and password"); return; }
    setError(""); setLoading(true);
    try {
      const data = await api.post("/api/auth/login", { email, password });
      const userData = data?.user;
      const accessToken = data?.accessToken;
      const refreshToken = data?.refreshToken;
      if (!userData) throw new Error("Server returned an unexpected response.");
      setTokens(accessToken, refreshToken);
      localStorage.setItem("as_user", JSON.stringify(userData));
      onLogin(userData);
    } catch (e) {
      // Show specific backend error codes/messages
      const code = e.data?.error?.code;
      let msg = getErrorMessage(e, "Login failed. Check your credentials.");
      if (code === "ACCOUNT_LOCKED") msg = "Account locked due to too many failed attempts. Try again later or reset your password.";
      if (code === "ACCOUNT_INACTIVE") msg = "Account is deactivated. Contact support.";
      if (code === "INVALID_CREDENTIALS") msg = "Invalid email or password. Try again or reset your password.";
      // Google-auth only account (no password hash yet)
      if (code === "NO_PASSWORD") {
        msg = "This account uses Google login. Set a password to enable email login, or use 'Continue with Google'.";
        setShowSetPassword(true);
      }
      setError(msg);
    }
    setLoading(false);
  };

  // ── Set Password for Google-auth account ──
  const handleSetPassword = async () => {
    setSetPasswordState((s) => ({ ...s, error: "" }));
    if (!email || !setPasswordState.newPassword || setPasswordState.newPassword.length < 8) {
      setSetPasswordState((s) => ({ ...s, error: "Enter a valid email and strong password." }));
      return;
    }

    setSetPasswordState((s) => ({ ...s, loading: true }));
    try {
      await api.post("/api/auth/set-password", { email, newPassword: setPasswordState.newPassword });
      setShowSetPassword(false);
      setError("Password set successfully. You can now log in with email and password.");
      setSetPasswordState((s) => ({ ...s, newPassword: "" }));
    } catch (e) {
      setSetPasswordState((s) => ({ ...s, error: getErrorMessage(e, "Could not set password. Try again.") }));
    } finally {
      setSetPasswordState((s) => ({ ...s, loading: false }));
    }
  };

  // ── Forgot Password ──
  const handleForgotPassword = async () => {
    if (!forgotEmail) { setError("Enter your email address"); return; }
    setError(""); setLoading(true);
    try {
      await api.post("/api/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch (e) {
      setError(getErrorMessage(e, "Could not send reset link."));
    }
    setLoading(false);
    // Show hint to check spam folder
    if (forgotSent) setError("If your email is registered, a reset link has been sent. Check your inbox and spam folder.");
  };

  // ── Verify Email OTP ──
  const handleVerifyEmailOtp = async () => {
    const code = emailOtp.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    setError(""); setLoading(true);
    try {
      await api.post("/api/auth/verify-email", { email, code });
      // Email verified — proceed to profile setup for new users
      if (isNewUser) {
        setStep(STEPS.PROFILE);
      } else {
        const userData = currentUser;
        localStorage.setItem("as_user", JSON.stringify(userData));
        onLogin(userData);
      }
    } catch (e) {
      setError(getErrorMessage(e, "Invalid code. Try again."));
    }
    setLoading(false);
  };

  // ── Email OTP input helpers ──
  const handleEmailOtpChange = (i, v) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...emailOtp]; n[i] = v.slice(-1); setEmailOtp(n);
    if (v && i < 5) emailOtpRefs[i + 1].current?.focus();
    if (!v && i > 0) emailOtpRefs[i - 1].current?.focus();
  };
  const handleEmailOtpKey = (i, e) => {
    if (e.key === "Backspace" && !emailOtp[i] && i > 0) emailOtpRefs[i - 1].current?.focus();
    if (e.key === "Enter") handleVerifyEmailOtp();
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
    if (!ensureFirebaseAvailable()) return;
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
      if (e.code === 'DEV_TOKEN_NOT_ALLOWED') {
        throw new Error(getFirebaseConfigErrorMessage());
      }
      if (e.code === 'INVALID_FIREBASE_ID_TOKEN') {
        throw new Error("Invalid sign-in token. Please sign in again. If this persists, ensure frontend and backend use the same Firebase project configuration.");
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
            <div style={S.stepLabel}>Welcome to redpiston</div>
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

      // ── STEP 2: Auth method (phone / email / Google) ──
      case STEPS.AUTH:
        return (
          <div className="auth-card">
            <button style={S.btnBack} onClick={() => { setStep(STEPS.ROLE); setError(""); setShowForgotPassword(false); setForgotSent(false); }}>← Back</button>
            <div style={S.stepLabel}>{role === "shop" ? "Shop Owner" : "Customer / Mechanic"}</div>
            <div style={S.heading}>Sign in or Sign up</div>
            <div style={S.sub}>Choose your preferred login method.</div>

            {/* Tab toggle: Phone | Email */}
            <div style={{ display: "flex", gap: 0, marginBottom: 20, background: T.surface, borderRadius: 10, border: `1.5px solid ${T.border}`, overflow: "hidden" }}>
              <button
                onClick={() => { setAuthTab("phone"); setError(""); setShowForgotPassword(false); }}
                style={{
                  flex: 1, padding: "11px 0", border: "none", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.2s",
                  background: authTab === "phone" ? T.amberGlow : "transparent",
                  color: authTab === "phone" ? T.amber : T.t3,
                  borderRight: `1px solid ${T.border}`,
                }}
              >
                📱 Phone OTP
              </button>
              <button
                onClick={() => { setAuthTab("email"); setError(""); setShowForgotPassword(false); }}
                style={{
                  flex: 1, padding: "11px 0", border: "none", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.2s",
                  background: authTab === "email" ? T.amberGlow : "transparent",
                  color: authTab === "email" ? T.amber : T.t3,
                }}
              >
                ✉️ Email
              </button>
            </div>

            {error && <div style={S.error}>{error}</div>}
            {showSetPassword && (
              <div style={{ marginTop: 20, background: '#091c0f', border: '1.5px solid #38BDF8', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#38BDF8', marginBottom: 8 }}>Set a password for this account</div>
                <div style={S.passwordWrap}>
                  <input
                    style={{ ...S.inputBase, ...S.passwordInput }}
                    type={showSetPasswordInput ? "text" : "password"}
                    placeholder="New password (min 8 chars)"
                    value={setPasswordState.newPassword}
                    onChange={e => setSetPasswordState(s => ({ ...s, newPassword: e.target.value }))}
                  />
                  <button
                    type="button"
                    style={S.eyeBtn}
                    onClick={() => setShowSetPasswordInput(v => !v)}
                    aria-label={showSetPasswordInput ? "Hide password" : "Show password"}
                  >
                    {showSetPasswordInput ? "🙈" : "👁"}
                  </button>
                </div>
                <button style={S.btnPrimary(setPasswordState.loading)} disabled={setPasswordState.loading} onClick={handleSetPassword}>
                  {setPasswordState.loading ? "Setting..." : "Set Password"}
                </button>
                {setPasswordState.error && <div style={S.error}>{setPasswordState.error}</div>}
              </div>
            )}

            {/* ─── PHONE TAB ─── */}
            {authTab === "phone" && (
              <>
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
              </>
            )}

            {/* ─── EMAIL TAB ─── */}
            {authTab === "email" && !showForgotPassword && (
              <>
                <label style={S.label}>Email address</label>
                <input
                  className="auth-input"
                  style={{ ...S.inputBase, marginBottom: 12 }}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (emailMode === "login" ? handleEmailLogin() : handleEmailRegister())}
                  autoFocus
                />

                <label style={S.label}>Password</label>
                <div style={S.passwordWrap}>
                  <input
                    className="auth-input"
                    style={{ ...S.inputBase, ...S.passwordInput, marginBottom: emailMode === "signup" ? 12 : 8 }}
                    type={showPassword ? "text" : "password"}
                    placeholder={emailMode === "signup" ? "Min 8 chars, upper, lower, digit, special" : "Enter your password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (emailMode === "login" ? handleEmailLogin() : handleEmailRegister())}
                  />
                  <button
                    type="button"
                    style={S.eyeBtn}
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>

                {emailMode === "signup" && (
                  <>
                    <label style={S.label}>Confirm password</label>
                    <div style={S.passwordWrap}>
                      <input
                        className="auth-input"
                        style={{ ...S.inputBase, ...S.passwordInput, marginBottom: 16 }}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleEmailRegister()}
                      />
                      <button
                        type="button"
                        style={S.eyeBtn}
                        onClick={() => setShowConfirmPassword(v => !v)}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? "🙈" : "👁"}
                      </button>
                    </div>
                  </>
                )}

                {emailMode === "login" && (
                  <div style={{ textAlign: "right", marginBottom: 16 }}>
                    <button
                      style={{ ...S.resendBtn, fontSize: 12 }}
                      onClick={() => { setShowForgotPassword(true); setForgotEmail(email); setError(""); setForgotSent(false); }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  className="auth-btn-primary"
                  style={S.btnPrimary(loading || !email || !password)}
                  onClick={emailMode === "login" ? handleEmailLogin : handleEmailRegister}
                  disabled={loading || !email || !password}
                >
                  {loading
                    ? (emailMode === "login" ? "Logging in..." : "Creating account...")
                    : (emailMode === "login" ? "Log In →" : "Create Account →")
                  }
                </button>

                <div style={{ textAlign: "center", fontSize: 13, color: T.t3, marginTop: 4 }}>
                  {emailMode === "login" ? (
                    <>Don't have an account?{" "}<button style={S.resendBtn} onClick={() => { setEmailMode("signup"); setError(""); }}>Sign up</button></>
                  ) : (
                    <>Already have an account?{" "}<button style={S.resendBtn} onClick={() => { setEmailMode("login"); setError(""); }}>Log in</button></>
                  )}
                </div>
              </>
            )}

            {/* ─── FORGOT PASSWORD ─── */}
            {authTab === "email" && showForgotPassword && (
              <>
                {forgotSent ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Check your email</div>
                    <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.5, marginBottom: 20 }}>
                      If an account exists for <strong style={{ color: T.t1 }}>{forgotEmail}</strong>, we've sent a password reset link.
                    </div>
                    <button
                      style={S.resendBtn}
                      onClick={() => { setShowForgotPassword(false); setForgotSent(false); setError(""); }}
                    >
                      ← Back to login
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, marginBottom: 6 }}>Reset your password</div>
                    <div style={{ fontSize: 13, color: T.t2, marginBottom: 16, lineHeight: 1.5 }}>
                      Enter your email and we'll send you a link to reset your password.
                    </div>

                    <label style={S.label}>Email address</label>
                    <input
                      className="auth-input"
                      style={{ ...S.inputBase, marginBottom: 16 }}
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                      autoFocus
                    />

                    <button
                      className="auth-btn-primary"
                      style={S.btnPrimary(loading || !forgotEmail)}
                      onClick={handleForgotPassword}
                      disabled={loading || !forgotEmail}
                    >
                      {loading ? "Sending..." : "Send Reset Link →"}
                    </button>

                    <div style={{ textAlign: "center", marginTop: 8 }}>
                      <button
                        style={S.resendBtn}
                        onClick={() => { setShowForgotPassword(false); setError(""); }}
                      >
                        ← Back to login
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ─── OR divider + Google (always visible) ─── */}
            {!(authTab === "email" && showForgotPassword) && (
              <>
                <div style={S.orRow}>
                  <div style={S.orLine} /><span style={S.orText}>OR</span><div style={S.orLine} />
                </div>

                <button className="auth-btn-google" style={S.btnGoogle} onClick={handleGoogleLogin} disabled={loading}>
                  <GoogleIcon />
                  Continue with Google
                </button>
              </>
            )}

            <div id="recaptcha-container" />
          </div>
        );

      // ── STEP 3: OTP verification (phone or email) ──
      case STEPS.OTP: {
        const isEmailVerify = authTab === "email";
        const currentOtp = isEmailVerify ? emailOtp : otp;
        const currentRefs = isEmailVerify ? emailOtpRefs : otpRefs;
        const handleChange = isEmailVerify ? handleEmailOtpChange : handleOtpChange;
        const handleKey = isEmailVerify ? handleEmailOtpKey : handleOtpKey;
        const handleVerify = isEmailVerify ? handleVerifyEmailOtp : handleVerifyOtp;
        const handleResend = isEmailVerify
          ? async () => { setLoading(true); try { await api.post("/api/auth/resend-verification", { email }); startResendTimer(); } catch {} setLoading(false); }
          : handleSendOtp;

        return (
          <div className="auth-card">
            <button style={S.btnBack} onClick={() => {
              setStep(STEPS.AUTH);
              setOtp(["","","","","",""]);
              setEmailOtp(["","","","","",""]);
              setError("");
            }}>
              ← {isEmailVerify ? "Change email" : "Change number"}
            </button>
            <div style={S.stepLabel}>Verification</div>
            <div style={S.heading}>{isEmailVerify ? "Verify your email" : "Enter OTP"}</div>
            <div style={S.sub}>
              {isEmailVerify
                ? <>Enter the 6-digit code sent to <strong style={{ color: T.t1 }}>{email}</strong></>
                : <>Sent to <strong style={{ color: T.t1 }}>+91 {phone.slice(0, 5)} {phone.slice(5)}</strong></>
              }
            </div>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.otpRow}>
              {currentOtp.map((digit, i) => (
                <input
                  key={i}
                  ref={currentRefs[i]}
                  className="otp-box"
                  style={S.otpBox}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKey(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              className="auth-btn-primary"
              style={S.btnPrimary(loading || currentOtp.join("").length < 6)}
              onClick={handleVerify}
              disabled={loading || currentOtp.join("").length < 6}
            >
              {loading ? "Verifying..." : "Verify & Continue ✓"}
            </button>

            <div style={S.resend}>
              {resendTimer > 0
                ? <span style={{ color: T.t3 }}>Resend code in {resendTimer}s</span>
                : <><span style={{ color: T.t3 }}>Didn't get it? </span><button style={S.resendBtn} onClick={handleResend}>Resend code</button></>
              }
            </div>
          </div>
        );
      }

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
              <span style={S.logoText}>redpiston</span>
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
