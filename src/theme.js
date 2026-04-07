export const T = {
  bg: "#0A0F1D",   // Deep navy background
  surface: "#121B2F",   // Progressive slate surface
  card: "#1A253D",   // Elevated card surface
  cardHover: "#23314F",
  border: "#2A3B59",
  borderHi: "#3B5075",
  // Amber — primary brand
  amber: "#F59E0B",
  amberDim: "#92400E",
  amberGlow: "rgba(245,158,11,0.12)",
  amberSoft: "rgba(245,158,11,0.06)",
  // Emerald — profit/success (fitment/stock)
  emerald: "#10B981",
  emeraldDim: "#065F46",
  emeraldBg: "rgba(16,185,129,0.1)",
  // Crimson — loss/danger (incompatible/no stock)
  crimson: "#EF4444",
  crimsonDim: "#7F1D1D",
  crimsonBg: "rgba(239,68,68,0.1)",
  // Sky — info/purchase (universal fit)
  sky: "#38BDF8",
  skyDim: "#0C4A6E",
  skyBg: "rgba(56,189,248,0.1)",
  // Violet — accent secondary
  violet: "#A78BFA",
  violetBg: "rgba(167,139,250,0.1)",
  // Text hierarchy
  t1: "#F0F4F8",   // headings
  t2: "#94A3B8",   // secondary
  t3: "#64748B",   // muted
  t4: "#334155",   // very muted
};

export const FONT = {
  ui: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
};

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${T.bg}; color: ${T.t1}; font-family: ${FONT.ui}; }

  /* ── Scrollbars ── */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: ${T.borderHi}; }

  .custom-scroll::-webkit-scrollbar { width: 3px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: ${T.t4}; border-radius: 10px; }

  /* ── Form Resets ── */
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
  input::placeholder, textarea::placeholder { color: ${T.t3}; }
  select option { background: ${T.card}; color: ${T.t1}; }
  * { -webkit-tap-highlight-color: transparent; }

  /* ═══════ ANIMATIONS ═══════ */

  /* Page & Element Entrances */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes fadeDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }
  @keyframes slideRight { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:none; } }
  @keyframes slideLeft  { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:none; } }
  @keyframes scaleIn  { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
  @keyframes toastSlide { from { opacity:0; transform:translateX(24px) scale(0.96); } to { opacity:1; transform:none; } }

  /* Loading & Feedback */
  @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
  @keyframes shimmer  { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes spinOnce { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes spin     { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* Ambient Effects */
  @keyframes float    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes glowPulse { 0%,100% { box-shadow: 0 0 20px rgba(245,158,11,0.1); } 50% { box-shadow: 0 0 30px rgba(245,158,11,0.25); } }
  @keyframes borderGlow { 0%,100% { border-color: ${T.border}; } 50% { border-color: ${T.borderHi}; } }

  /* ═══════ UTILITY CLASSES ═══════ */

  /* Page transitions */
  .page-in   { animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  .modal-in  { animation: scaleIn 0.25s cubic-bezier(0.16,1,0.3,1) both; }
  .toast-in  { animation: toastSlide 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  .fade-in   { animation: fadeIn 0.2s ease both; }

  /* Row hover (tables, lists) */
  .row-hover { transition: background 0.15s ease; }
  .row-hover:hover { background: ${T.cardHover} !important; }

  /* Nav items */
  .nav-item { transition: all 0.2s ease; position: relative; }
  .nav-item:hover:not(.nav-active) { background: ${T.amberGlow} !important; color: ${T.amber} !important; }
  .nav-active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 2px;
    background: ${T.amber};
    border-radius: 2px;
  }

  /* Button hover — ghost/subtle buttons */
  .btn-hover { transition: all 0.2s cubic-bezier(0.16,1,0.3,1); }
  .btn-hover:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  }
  .btn-hover:active:not(:disabled) { transform: translateY(0); filter: brightness(1); }

  /* Button hover — solid primary CTA buttons */
  .btn-hover-solid { transition: all 0.2s cubic-bezier(0.16,1,0.3,1); }
  .btn-hover-solid:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 30px rgba(245,158,11,0.35), 0 2px 8px rgba(245,158,11,0.2);
    filter: brightness(1.08);
  }
  .btn-hover-solid:active:not(:disabled) { transform: translateY(0) scale(1); }

  /* Button hover — subtle/ghost */
  .btn-hover-subtle { transition: background 0.2s, color 0.2s, transform 0.2s; }
  .btn-hover-subtle:hover { background: ${T.amberGlow} !important; color: ${T.amber} !important; }

  /* Card hover — shop-owner cards */
  .card-hover { transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
  .card-hover:hover {
    border-color: ${T.borderHi} !important;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px ${T.borderHi} !important;
    transform: translateY(-2px);
  }

  /* Marketplace product card hover — premium lift effect */
  .mp-card-hover { transition: all 0.25s cubic-bezier(0.16,1,0.3,1); }
  .mp-card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px ${T.borderHi};
    border-color: ${T.borderHi} !important;
  }

  /* Glow utilities */
  .glow-amber   { box-shadow: 0 0 24px rgba(245,158,11,0.2), 0 0 48px rgba(245,158,11,0.05); }
  .glow-emerald { box-shadow: 0 0 24px rgba(16,185,129,0.15); }
  .glow-crimson { box-shadow: 0 0 24px rgba(239,68,68,0.15); }
  .glow-sky     { box-shadow: 0 0 24px rgba(56,189,248,0.15); }

  /* Glassmorphism utility */
  .glass {
    background: rgba(18,27,47,0.75) !important;
    backdrop-filter: blur(16px) saturate(1.2);
    -webkit-backdrop-filter: blur(16px) saturate(1.2);
    border: 1px solid rgba(59,80,117,0.4) !important;
  }

  /* Gradient text */
  .gradient-text {
    background: linear-gradient(135deg, ${T.amber}, #FBBF24);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Skeleton loader shimmer */
  .skeleton-shimmer {
    background: linear-gradient(90deg, ${T.card} 25%, ${T.cardHover} 50%, ${T.card} 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease infinite;
  }

  /* Subtle ambient float */
  .float { animation: float 4s ease-in-out infinite; }
  .glow-pulse { animation: glowPulse 3s ease-in-out infinite; }

  /* ── New keyframes ── */
  @keyframes slideInRight { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
  @keyframes slideInLeft  { from { opacity:0; transform:translateX(-100%); } to { opacity:1; transform:translateX(0); } }
  @keyframes countUp      { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }

  /* ── Utility classes ── */
  .spin-ring {
    width: 16px; height: 16px;
    border: 2px solid transparent;
    border-top-color: ${T.amber};
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  .press-feedback { transition: transform 0.1s ease; }
  .press-feedback:active { transform: scale(0.97) translateY(1px) !important; }

  /* ── Print styles (POS invoice) ── */
  @media print {
    body { background: #fff !important; color: #000 !important; }
    /* Hide non-printable chrome */
    nav, [data-print-hide], .toast-in,
    [style*="position: fixed"] { display: none !important; }
    /* Make content fill page */
    [data-print-area] {
      position: absolute !important; left: 0 !important; top: 0 !important;
      width: 100% !important; padding: 20px !important;
      background: #fff !important; color: #000 !important;
    }
    [data-print-area] * { color: #000 !important; border-color: #ccc !important; }
    [data-print-area] table { width: 100% !important; }
  }

  /* ── Command palette overlay ── */
  .cmd-backdrop {
    position: fixed; inset: 0; z-index: 9990;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: fadeIn 0.12s ease both;
  }
  .cmd-box {
    position: fixed; top: 18%; left: 50%;
    transform: translateX(-50%);
    width: 540px; max-width: 92vw;
    z-index: 9991;
    animation: scaleIn 0.15s cubic-bezier(0.16,1,0.3,1) both;
  }

  /* ═══════ RESPONSIVE DESIGN ═══════ */

  /* ── Tablet & Mobile (≤768px): Sidebar → Bottom Nav ── */
  @media (max-width: 768px) {
    .erp-sidebar, .mp-sidebar, .admin-sidebar {
      top: auto !important; bottom: 0 !important;
      left: 0 !important; right: 0 !important;
      width: 100% !important; height: 62px !important;
      flex-direction: row !important;
      border-right: none !important;
      border-top: 1px solid rgba(42,59,89,0.95) !important;
      padding: 4px 6px 2px !important;
      justify-content: space-around !important;
      align-items: flex-start !important;
      gap: 0 !important;
      overflow: hidden !important;
    }
    .sidebar-brand { display: none !important; }
    .sidebar-spacer { display: none !important; }
    .erp-sidebar button, .mp-sidebar button {
      width: auto !important; flex: 1 !important;
      max-width: 76px !important; height: 50px !important;
      padding: 4px 2px !important; border-radius: 8px !important;
    }
    .erp-topbar { padding-left: 14px !important; padding-right: 14px !important; }
    .erp-content { padding: 16px 14px 80px 14px !important; }
    .erp-banner { padding: 8px 14px !important; }
    .mp-content { padding-left: 0 !important; }

    /* Grid helpers */
    .kpi-grid-6 { grid-template-columns: repeat(2, 1fr) !important; }
    .grid-2col, .bottom-grid-2, .bill-summary-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
    .grid-4col, .customer-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .grid-3col, .aging-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .checkout-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
    .inner-grid-2, .detail-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }

    /* Table horizontal scroll */
    .table-scroll { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }

    /* Marketplace nav responsive */
    .mp-nav-inner { flex-wrap: wrap !important; gap: 10px !important; padding: 12px 14px !important; }
    .mp-search-row { flex: none !important; width: 100% !important; order: 2; }
    .mp-nav-logo { order: 1; }
    .mp-nav-right { order: 3; flex-wrap: wrap !important; gap: 8px !important; }
    .veh-selector-text { display: none !important; }

    /* Hero banner: stack vertically */
    .hero-banner { flex-direction: column !important; min-height: auto !important; }
    .hero-right { width: 100% !important; border-left: none !important; border-top: 1px solid rgba(42,59,89,0.5) !important; padding: 24px !important; }

    /* Checkout stepper */
    .step-connector { width: 20px !important; }

    /* Stats flex wrap */
    .stats-flex { flex-wrap: wrap !important; }

    /* Topbar secondary items: hide on very small */
    .topbar-secondary { display: none !important; }

    /* Modal padding reduction */
    .modal-box { padding: 20px !important; }
  }

  /* ── Small Mobile (≤480px): Extra adjustments ── */
  @media (max-width: 480px) {
    .erp-content { padding: 12px 10px 76px 10px !important; }
    .kpi-grid-6 { gap: 8px !important; }
    .customer-grid { grid-template-columns: 1fr !important; }
    .aging-grid-3 { grid-template-columns: 1fr !important; }
    .grid-4col { grid-template-columns: 1fr 1fr !important; }
    .inner-grid-2 { grid-template-columns: 1fr !important; }
    .detail-grid-4 { grid-template-columns: 1fr 1fr !important; }
    .erp-topbar { padding-left: 10px !important; padding-right: 10px !important; }
    .mp-nav-inner { padding: 10px !important; }
    .hero-banner .hero-left { padding: 24px 20px !important; }
  }

  /* ── Bottom nav clearance for marketplace pages ── */
  @media (max-width: 768px) {
    .mp-content > * { padding-bottom: 80px; }
  }

  /* ── Touch targets: minimum 44px tap area ── */
  @media (max-width: 768px) {
    button, [role="button"], a {
      min-height: 36px;
    }
    /* Table action buttons can be smaller - they have adjacent tap targets */
    table button { min-height: unset; }
    /* Nav buttons already handled by sidebar CSS */
    .erp-sidebar button, .mp-sidebar button { min-height: unset; }
  }

  /* ── Prevent horizontal overflow at page level ── */
  html, body { overflow-x: hidden; }
  .erp-content { min-width: 0; }
  .table-scroll { min-width: 0; }
`;
