import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { T, FONT } from "../theme.js";

const S = {
  page: { display: "flex", minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%", maxWidth: 420, padding: "48px 40px", background: T.surface,
    borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
  },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32 },
  logoMark: {
    width: 40, height: 40, borderRadius: 10, background: T.amber,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
  },
  logoText: { fontSize: 20, fontWeight: 800, color: T.t1, letterSpacing: "-0.5px" },
  heading: { fontSize: 22, fontWeight: 800, color: T.t1, marginBottom: 6 },
  sub: { fontSize: 14, color: T.t2, marginBottom: 28, lineHeight: 1.5 },
  label: { fontSize: 13, fontWeight: 600, color: T.t2, marginBottom: 6, display: "block" },
  input: {
    width: "100%", background: T.bg, border: `1.5px solid ${T.border}`,
    borderRadius: 10, padding: "12px 14px", color: T.t1, fontSize: 15,
    outline: "none", boxSizing: "border-box", fontFamily: FONT.ui, marginBottom: 14,
    transition: "border 0.2s",
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
    border: "none", background: "transparent", color: T.t3, cursor: "pointer", fontSize: 16,
  },
  btn: (disabled) => ({
    width: "100%", padding: "14px", background: disabled ? T.amberDim : T.amber,
    color: disabled ? "#aaa" : "#000", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", marginBottom: 14, transition: "all 0.2s",
    fontFamily: FONT.ui,
  }),
  error: {
    background: "#1c0909", border: `1.5px solid ${T.crimson}`, borderRadius: 10,
    padding: "11px 14px", color: T.crimson, fontSize: 13, marginBottom: 14,
  },
  success: {
    background: "#091c0f", border: `1.5px solid ${T.emerald}`, borderRadius: 10,
    padding: "16px", textAlign: "center", marginBottom: 14,
  },
  link: { background: "none", border: "none", color: T.amber, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT.ui },
};

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { token, newPassword: password });
      setSuccess(true);
    } catch (e) {
      // Show specific backend error codes/messages
      const code = e.data?.error?.code;
      let msg = e.data?.error?.message || e.message || "Could not reset password. The link may have expired.";
      if (code === "INVALID_TOKEN") msg = "This reset link is invalid or expired. Please request a new one.";
      if (code === "WEAK_PASSWORD") msg = "Password does not meet security requirements.";
      setError(msg);
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.logo}>
            <div style={S.logoMark}>⚙️</div>
            <span style={S.logoText}>redpiston</span>
          </div>
          <div style={S.heading}>Invalid Link</div>
          <div style={S.sub}>This password reset link is missing or invalid.</div>
          <button style={S.link} onClick={() => navigate("/login")}>← Back to login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoMark}>⚙️</div>
          <span style={S.logoText}>redpiston</span>
        </div>

        {success ? (
          <div style={S.success}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.emerald, marginBottom: 6 }}>Password Reset Successfully</div>
            <div style={{ fontSize: 13, color: T.t2, marginBottom: 16, lineHeight: 1.5 }}>
              Your password has been updated. You can now log in with your new password.
            </div>
            <button style={S.link} onClick={() => navigate("/login")}>Go to Login →</button>
          </div>
        ) : (
          <>
            <div style={S.heading}>Set new password</div>
            <div style={S.sub}>Choose a strong password for your account.</div>

            {error && <div style={S.error}>{error}</div>}

            <label style={S.label}>New password</label>
            <div style={S.passwordWrap}>
              <input
                style={{ ...S.input, ...S.passwordInput }}
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, upper, lower, digit, special"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
                autoFocus
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

            <label style={S.label}>Confirm new password</label>
            <div style={S.passwordWrap}>
              <input
                style={{ ...S.input, ...S.passwordInput }}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
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

            <button
              style={S.btn(loading || !password || !confirmPassword)}
              onClick={handleReset}
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? "Resetting..." : "Reset Password →"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button style={S.link} onClick={() => navigate("/login")}>← Back to login</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
