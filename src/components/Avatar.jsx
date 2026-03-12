import { useState } from "react";

// Deterministic color from userId — same user always gets same color
function getAvatarColor(userId) {
  const colors = [
    "#1B3A5C", "#0D9488", "#D97706", "#059669",
    "#6D28D9", "#DC2626", "#2563EB", "#9333EA",
    "#E11D48", "#0891B2", "#4F46E5", "#CA8A04",
  ];
  let hash = 0;
  const str = String(userId || "U");
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => {
      const ch = w[0];
      // Only use Latin letters and digits for initials
      if (/[a-zA-Z0-9]/.test(ch)) return ch.toUpperCase();
      return "";
    })
    .join("") || "?";
}

export function Avatar({ user, size = 36, style = {} }) {
  const [imgError, setImgError] = useState(false);

  if (user?.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name || "User"}
        width={size}
        height={size}
        style={{
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          ...style,
        }}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Initials fallback
  const bg = getAvatarColor(user?.userId || user?.id || user?.phone);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.38,
        fontFamily: "'Inter', 'SF Pro', sans-serif",
        flexShrink: 0,
        userSelect: "none",
        ...style,
      }}
    >
      {getInitials(user?.name || user?.phone)}
    </div>
  );
}
