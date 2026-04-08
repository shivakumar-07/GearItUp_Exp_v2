import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { T, FONT } from "../theme";

// ─── Brand palette ── exact dark automotive red from the RedPiston logo ─────
const R = {
  // Primary: the deep brick-crimson from the logo (measured from image)
  red:       "#8B1A1A",
  redHi:     "#A52828",
  redBright: "#C41E3A",  // lighter variant for glow/gradient
  redDim:    "#5C0D0D",
  redGlow:   "rgba(139,26,26,0.20)",
  redGlowHi: "rgba(139,26,26,0.40)",
  redSoft:   "rgba(139,26,26,0.08)",
  redBorder: "rgba(139,26,26,0.38)",
  // Page surfaces — near-black industrial feel
  bg:        "#0A0B0D",
  surface:   "#0F1114",
  card:      "#161A1F",
  cardHi:    "#1C2028",
  border:    "#222830",
  borderHi:  "#2E3848",
  // Accent: worn steel / vintage chrome
  steel:     "#8898AA",
  steelDim:  "#556070",
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior: smooth; }
  body { background:${R.bg}; color:${T.t1}; font-family:${FONT.ui}; overflow-x:hidden; }

  /* ── Keyframes ── */
  @keyframes fadeUp    { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:none} }
  @keyframes float     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes gradMove  { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  @keyframes redPulse  {
    0%,100%{box-shadow:0 0 20px rgba(139,26,26,0.5),0 0 0 1px rgba(139,26,26,0.3)}
    50%    {box-shadow:0 0 45px rgba(139,26,26,0.85),0 0 0 1px rgba(139,26,26,0.5)}
  }
  @keyframes engineIdle {
    0%,100% { transform: translateY(0) rotate(0deg); }
    25%     { transform: translateY(-1px) rotate(0.3deg); }
    75%     { transform: translateY(1px) rotate(-0.3deg); }
  }

  /* ── Utilities ── */
  .lp-fu    { animation: fadeUp 0.65s ease both; }
  .lp-fu-1  { animation: fadeUp 0.65s 0.10s ease both; }
  .lp-fu-2  { animation: fadeUp 0.65s 0.22s ease both; }
  .lp-fu-3  { animation: fadeUp 0.65s 0.34s ease both; }
  .lp-fu-4  { animation: fadeUp 0.65s 0.46s ease both; }
  .lp-fu-5  { animation: fadeUp 0.65s 0.58s ease both; }

  .nav-a {
    color:${T.t2}; text-decoration:none; font-size:14px; font-weight:500;
    transition:color 0.2s; cursor:pointer; letter-spacing:0.01em;
  }
  .nav-a:hover { color:${T.t1}; }

  /* Buttons */
  .btn-red {
    background:${R.red}; color:#fff; border:none; border-radius:10px;
    padding:11px 22px; font-size:13px; font-weight:900; cursor:pointer;
    font-family:${FONT.ui}; transition:all 0.2s; letter-spacing:0.06em;
    text-transform:uppercase;
  }
  .btn-red:hover { background:${R.redHi}; transform:translateY(-1px);
    box-shadow:0 8px 28px rgba(139,26,26,0.55); }

  .btn-ghost {
    background:transparent; color:${T.t1}; border:1.5px solid ${R.border};
    border-radius:10px; padding:11px 22px; font-size:13px; font-weight:600;
    cursor:pointer; font-family:${FONT.ui}; transition:all 0.2s; letter-spacing:0.02em;
  }
  .btn-ghost:hover { border-color:${R.redHi}; color:${R.redHi}; }

  .btn-hero {
    background:${R.red}; color:#fff; border:none; border-radius:12px;
    padding:16px 38px; font-size:15px; font-weight:900; cursor:pointer;
    font-family:${FONT.ui}; transition:all 0.25s; letter-spacing:0.07em;
    text-transform:uppercase; display:inline-flex; align-items:center; gap:10px;
  }
  .btn-hero:hover { background:${R.redHi}; transform:translateY(-2px);
    box-shadow:0 16px 40px rgba(139,26,26,0.6); }

  .btn-hero-outline {
    background:transparent; color:${T.t1}; border:1.5px solid ${R.borderHi};
    border-radius:12px; padding:16px 38px; font-size:15px; font-weight:600;
    cursor:pointer; font-family:${FONT.ui}; transition:all 0.25s;
    display:inline-flex; align-items:center; gap:10px; letter-spacing:0.02em;
  }
  .btn-hero-outline:hover { border-color:${R.red}; color:${R.red}; background:${R.redSoft}; }

  /* Cards */
  .feat-card {
    background:${R.card}; border:1px solid ${R.border}; border-radius:18px;
    padding:30px; transition:all 0.28s; position:relative; overflow:hidden;
  }
  .feat-card::before {
    content:''; position:absolute; inset:0; border-radius:18px;
    background:linear-gradient(135deg,${R.redGlow} 0%,transparent 60%);
    opacity:0; transition:opacity 0.3s;
  }
  .feat-card:hover::before { opacity:1; }
  .feat-card:hover { border-color:${R.redBorder}; transform:translateY(-4px);
    box-shadow:0 24px 50px rgba(0,0,0,0.45),0 0 0 1px ${R.redBorder}; }

  .stat-card {
    background:${R.card}; border:1px solid ${R.border}; border-radius:16px;
    padding:28px; text-align:center; transition:all 0.22s;
  }
  .stat-card:hover { border-color:${R.redBorder}; box-shadow:0 8px 32px rgba(139,26,26,0.2); }

  .price-card {
    background:${R.card}; border:1px solid ${R.border}; border-radius:22px;
    padding:36px; position:relative; transition:all 0.28s;
  }
  .price-card:hover { transform:translateY(-5px); box-shadow:0 28px 60px rgba(0,0,0,0.45); }
  .price-card.hot { border-color:${R.red};
    box-shadow:0 0 0 1px ${R.redDim}, 0 20px 60px rgba(139,26,26,0.25); }

  .review-card {
    background:${R.card}; border:1px solid ${R.border}; border-radius:18px;
    padding:30px; transition:all 0.22s;
  }
  .review-card:hover { border-color:${R.borderHi}; }

  .tab-btn {
    padding:10px 26px; border-radius:10px; font-size:13px; font-weight:800;
    cursor:pointer; transition:all 0.2s; border:1.5px solid transparent;
    font-family:${FONT.ui}; letter-spacing:0.05em; text-transform:uppercase;
  }

  /* Section badge */
  .s-badge {
    display:inline-flex; align-items:center; gap:7px;
    background:${R.redSoft}; border:1px solid ${R.redBorder};
    border-radius:100px; padding:6px 16px;
    font-size:11px; font-weight:900; color:${R.redHi};
    text-transform:uppercase; letter-spacing:0.12em;
  }

  /* Grid lines background */
  .grid-bg {
    position:absolute; inset:0; pointer-events:none; z-index:0;
    background-image:
      linear-gradient(rgba(34,40,48,0.55) 1px, transparent 1px),
      linear-gradient(90deg, rgba(34,40,48,0.55) 1px, transparent 1px);
    background-size:54px 54px;
    mask-image:radial-gradient(ellipse 85% 70% at 50% 40%, black 20%, transparent 100%);
  }

  /* Red glow blob */
  .glow-blob {
    position:absolute; border-radius:50%; pointer-events:none; z-index:0;
    background:radial-gradient(circle, rgba(139,26,26,0.18) 0%, transparent 70%);
  }

  /* Tech pill tags */
  .tag {
    display:inline-flex; align-items:center;
    background:${R.card}; border:1px solid ${R.border}; border-radius:100px;
    padding:5px 14px; font-size:11px; font-weight:700; color:${T.t2};
    text-transform:uppercase; letter-spacing:0.06em;
  }

  .divider { height:1px; background:linear-gradient(90deg,transparent,${R.border},transparent); }


  /* Scrollbar */
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:${R.border}; border-radius:10px; }

  @media (max-width:900px) {
    .hero-2col  { grid-template-columns:1fr !important; }
    .mockup-col { display:none !important; }
    .stats-4col { grid-template-columns:repeat(2,1fr) !important; }
    .feat-3col  { grid-template-columns:1fr !important; }
    .price-3col { grid-template-columns:1fr !important; }
    .rev-3col   { grid-template-columns:1fr !important; }
    .footer-4col{ grid-template-columns:1fr 1fr !important; }
    .nav-links  { display:none !important; }
    .hero-title { font-size:clamp(32px,9vw,54px) !important; }
    .split-2col { grid-template-columns:1fr !important; }
  }
`;

// ─── Logo component — renders the real /logo.svg badge ───────────────────────
// The SVG is a vintage cream/sepia badge (599×480). We display it inside a
// matching cream container so the background blends naturally on dark surfaces.
function Logo({ height = 38, showText = true }) {
  // logo aspect ratio: 599 / 480 ≈ 1.248  →  width = height * 1.248
  const w = Math.round(height * 1.248);
  const pad = Math.round(height * 0.08);

  return (
    <div style={{ display:"flex", alignItems:"center", gap: showText ? 12 : 0 }}>
      {/* Cream badge container matching the SVG background */}
      <div style={{
        width: w + pad * 2,
        height: height + pad * 2,
        borderRadius: Math.round(height * 0.18),
        background: "#EBE8D7",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: `0 2px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(139,26,26,0.25)`,
      }}>
        <img
          src="/logo.svg"
          alt="RedPISTON"
          style={{
            width: w,
            height: height,
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>
      {showText && (
        <div>
          <div style={{ lineHeight:1 }}>
            <span style={{ fontSize:19, fontWeight:800, color:T.t1, letterSpacing:"0.04em" }}>Red</span>
            <span style={{ fontSize:19, fontWeight:900, color:R.red, letterSpacing:"0.07em" }}>PISTON</span>
          </div>
          <div style={{ fontSize:9, color:R.steelDim, fontWeight:700, letterSpacing:"0.18em", textTransform:"uppercase", marginTop:3 }}>
            FIND PARTS. FAST.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vintage 1969 Dodge Charger style muscle car SVG ────────────────────────
function VintageCar({ scale = 1 }) {
  const w = 310 * scale, h = 100 * scale;
  const carRed = R.red;
  const chrome  = "#8898AA";
  const black   = "#111";
  const glass   = "rgba(60,80,100,0.75)";

  return (
    <svg viewBox="0 0 310 100" width={w} height={h} overflow="visible">
      {/* ── Shadow under car ── */}
      <ellipse cx="155" cy="96" rx="145" ry="5" fill="rgba(0,0,0,0.4)" />

      {/* ── Body lower ── */}
      <path d="
        M 14,72
        Q 14,60 22,58
        L 55,52
        Q 80,47 98,47
        L 108,33 L 128,24
        Q 155,19 182,19
        Q 204,19 218,24
        L 234,36 L 242,50
        Q 268,51 285,56
        L 294,62 L 296,70 L 298,74
        L 252,74 Q 248,59 234,58 Q 218,57 213,74
        L 100,74 Q 97,59 84,58 Q 69,57 64,74
        L 14,74 Z
      " fill={carRed} />

      {/* ── Body highlight (top ridge) ── */}
      <path d="M 60,52 Q 90,46 100,46 L 110,32 L 130,23 Q 157,18 183,18 Q 207,18 222,23 L 237,37 L 245,50 Q 230,47 200,46 L 130,46 Q 110,46 98,47 Z"
        fill={R.redHi} opacity="0.4" />

      {/* ── Roof ── */}
      <path d="M 110,32 L 128,22 Q 155,17 183,17 Q 207,17 222,22 L 237,36 L 220,44 L 120,44 Z"
        fill={R.redDim} />

      {/* ── Windshield ── */}
      <path d="M 114,41 L 128,24 Q 155,19 183,19 Q 205,19 218,24 L 232,40 L 215,44 L 120,44 Z"
        fill={glass} />
      {/* windshield glare */}
      <path d="M 124,28 L 134,24 Q 148,21 162,21 L 148,44 L 120,44 Z"
        fill="rgba(255,255,255,0.06)" />

      {/* ── Side window lines ── */}
      <line x1="175" y1="20" x2="178" y2="44" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>
      <line x1="197" y1="21" x2="204" y2="44" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>

      {/* ── Hood scoop / power bulge ── */}
      <path d="M 60,52 Q 75,48 90,47 L 100,46 L 100,49 Q 88,50 75,54 Z"
        fill={R.redDim} />

      {/* ── Front bumper ── */}
      <rect x="10" y="65" width="18" height="8" rx="2" fill={chrome} />
      {/* headlight — hidden style (flat panel) */}
      <rect x="14" y="56" width="14" height="8" rx="1.5" fill="#0A0B0D" stroke={chrome} strokeWidth="0.8" />
      <rect x="16" y="58" width="10" height="4" rx="1" fill="#1A2535" />

      {/* ── Rear bumper + tail ── */}
      <rect x="280" y="62" width="16" height="9" rx="2" fill={chrome} />
      {/* tail light */}
      <rect x="278" y="54" width="14" height="7" rx="1.5" fill="#8B1A1A" stroke="#333" strokeWidth="0.8"/>
      <rect x="280" y="55" width="10" height="4" rx="1" fill={R.redBright} opacity="0.9" />

      {/* ── Rear spoiler ── */}
      <path d="M 275,46 L 295,50 L 295,54 L 275,50 Z" fill={R.redDim} />
      <rect x="286" y="44" width="4" height="8" rx="1" fill={R.redDim} />

      {/* ── Side body trim line ── */}
      <line x1="14" y1="66" x2="296" y2="66" stroke={R.redDim} strokeWidth="1.2" opacity="0.5" />

      {/* ── WHEELS ── front ── */}
      <g transform="translate(84,74)">
        {/* Tire */}
        <circle cx="0" cy="0" r="17" fill={black} />
        {/* Rim */}
        <g className="wheel-spin">
          <circle cx="0" cy="0" r="12" fill="#2A2A2A" stroke={chrome} strokeWidth="1"/>
          <circle cx="0" cy="0" r="5" fill={chrome} />
          {[-45,0,45,90,135,180,225,270].map((a,i) => {
            const r2=Math.PI*a/180;
            return <line key={i} x1={Math.cos(r2)*5} y1={Math.sin(r2)*5} x2={Math.cos(r2)*11} y2={Math.sin(r2)*11} stroke={chrome} strokeWidth="1.3" />;
          })}
        </g>
        {/* Wheel shine */}
        <ellipse cx="-4" cy="-7" rx="5" ry="3" fill="rgba(255,255,255,0.08)" transform="rotate(-20)" />
      </g>

      {/* ── WHEELS ── rear ── */}
      <g transform="translate(226,74)">
        <circle cx="0" cy="0" r="17" fill={black} />
        <g className="wheel-spin">
          <circle cx="0" cy="0" r="12" fill="#2A2A2A" stroke={chrome} strokeWidth="1"/>
          <circle cx="0" cy="0" r="5" fill={chrome} />
          {[-45,0,45,90,135,180,225,270].map((a,i) => {
            const r2=Math.PI*a/180;
            return <line key={i} x1={Math.cos(r2)*5} y1={Math.sin(r2)*5} x2={Math.cos(r2)*11} y2={Math.sin(r2)*11} stroke={chrome} strokeWidth="1.3" />;
          })}
        </g>
        <ellipse cx="-4" cy="-7" rx="5" ry="3" fill="rgba(255,255,255,0.08)" transform="rotate(-20)" />
      </g>

      {/* ── Exhaust pipes ── */}
      <rect x="285" y="70" width="14" height="4" rx="2" fill="#555" />
      <rect x="285" y="76" width="14" height="4" rx="2" fill="#555" />

      {/* ── Exhaust smoke puffs ── */}
      {[0,1,2].map(i => (
        <circle key={i}
          cx={305 + i*8}
          cy={70 + i * 3}
          r={4 + i*3}
          fill="rgba(180,180,180,0.15)"
          style={{ animation:`exhaustPuff ${0.7 + i*0.2}s ease-out ${i*0.2}s infinite` }}
        />
      ))}
    </svg>
  );
}

// ─── ERP Dashboard mockup ─────────────────────────────────────────────────────
function ERPMockup() {
  return (
    <div style={{
      background:R.surface, border:`1px solid ${R.border}`, borderRadius:18,
      overflow:"hidden", boxShadow:`0 40px 90px rgba(0,0,0,0.7), 0 0 0 1px ${R.border}`,
      width:"100%", maxWidth:540,
    }}>
      {/* Chrome bar */}
      <div style={{ background:R.bg, borderBottom:`1px solid ${R.border}`, padding:"10px 16px", display:"flex", alignItems:"center", gap:6 }}>
        <div style={{width:10,height:10,borderRadius:"50%",background:"#EF4444"}}/>
        <div style={{width:10,height:10,borderRadius:"50%",background:R.red}}/>
        <div style={{width:10,height:10,borderRadius:"50%",background:"#10B981"}}/>
        <div style={{flex:1}}/>
        <span style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:"0.08em"}}>RED PISTON · ERP DASHBOARD</span>
        <div style={{flex:1}}/>
      </div>
      {/* KPIs */}
      <div style={{padding:"14px 14px 8px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[
          {label:"Today Revenue",val:"₹18,450",color:"#10B981",icon:"📈"},
          {label:"Stock Items",val:"342",color:"#38BDF8",icon:"⬡"},
          {label:"Udhaar Due",val:"₹6,200",color:R.redHi,icon:"💳"},
        ].map(k=>(
          <div key={k.label} style={{background:R.card,border:`1px solid ${R.border}`,borderRadius:10,padding:"11px"}}>
            <div style={{fontSize:15,marginBottom:4}}>{k.icon}</div>
            <div style={{fontSize:15,fontWeight:900,color:k.color,fontFamily:FONT.mono,letterSpacing:"-0.02em"}}>{k.val}</div>
            <div style={{fontSize:9,color:T.t3,fontWeight:700,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k.label}</div>
          </div>
        ))}
      </div>
      {/* Chart */}
      <div style={{padding:"0 14px 10px"}}>
        <div style={{background:R.card,border:`1px solid ${R.border}`,borderRadius:10,padding:"13px"}}>
          <div style={{fontSize:9,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Weekly Sales</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:5,height:48}}>
            {[28,50,38,72,58,88,65].map((h,i)=>(
              <div key={i} style={{flex:1,height:`${h}%`,background:i===5?R.red:`${R.red}35`,borderRadius:"4px 4px 0 0"}}/>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
            {["M","T","W","T","F","S","S"].map((d,i)=>(
              <div key={i} style={{fontSize:9,color:T.t4,textAlign:"center",flex:1}}>{d}</div>
            ))}
          </div>
        </div>
      </div>
      {/* Txns */}
      <div style={{padding:"0 14px 14px"}}>
        <div style={{background:R.card,border:`1px solid ${R.border}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"8px 14px",borderBottom:`1px solid ${R.border}`,fontSize:9,color:T.t3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Recent Transactions</div>
          {[
            {n:"Bosch Brake Pads — Swift",a:"+₹1,200",c:"#10B981"},
            {n:"Engine Oil 10W40 Stock In",a:"-₹3,400",c:R.redHi},
            {n:"Air Filter — Honda Activa",a:"+₹650",c:"#10B981"},
          ].map((t,i)=>(
            <div key={i} style={{padding:"8px 14px",borderBottom:i<2?`1px solid ${R.border}`:"none",display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:t.c,flexShrink:0}}/>
              <div style={{flex:1,fontSize:11,color:T.t2,fontWeight:500}}>{t.n}</div>
              <div style={{fontSize:11,fontWeight:800,color:t.c,fontFamily:FONT.mono}}>{t.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Marketplace mockup ───────────────────────────────────────────────────────
function MarketplaceMockup() {
  return (
    <div style={{
      background:R.surface,border:`1px solid ${R.border}`,borderRadius:18,
      overflow:"hidden",boxShadow:`0 40px 90px rgba(0,0,0,0.7),0 0 0 1px ${R.border}`,
      width:"100%",maxWidth:455,
    }}>
      <div style={{background:R.bg,borderBottom:`1px solid ${R.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:"#EF4444"}}/>
        <div style={{width:10,height:10,borderRadius:"50%",background:R.red}}/>
        <div style={{width:10,height:10,borderRadius:"50%",background:"#10B981"}}/>
        <div style={{flex:1,textAlign:"center",fontSize:10,color:T.t3,fontWeight:700,letterSpacing:"0.07em"}}>RED PISTON MARKETPLACE</div>
      </div>
      <div style={{padding:14}}>
        <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"8px 13px",marginBottom:12,display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:17}}>🚗</span>
          <div>
            <div style={{fontSize:9,color:"#10B981",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.07em"}}>Vehicle Selected</div>
            <div style={{fontSize:12,color:T.t1,fontWeight:700}}>Maruti Swift Dzire 2019 · Petrol</div>
          </div>
          <div style={{marginLeft:"auto",background:"#10B981",color:"#000",fontSize:9,fontWeight:900,borderRadius:5,padding:"3px 8px",letterSpacing:"0.05em"}}>FIT ✓</div>
        </div>
        {[
          {n:"Bosch Brake Pads — Front Axle",p:"₹1,199",m:"₹1,599",s:3},
          {n:"Minda Air Filter — OEM Grade",p:"₹449",m:"₹599",s:5},
        ].map((p,i)=>(
          <div key={i} style={{background:R.card,border:`1px solid ${R.border}`,borderRadius:10,padding:"11px 12px",marginBottom:9,display:"flex",gap:11,alignItems:"center"}}>
            <div style={{width:42,height:42,borderRadius:10,background:R.redSoft,border:`1px solid ${R.redBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>🔩</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:T.t1,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.n}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14,fontWeight:900,color:R.red,fontFamily:FONT.mono}}>{p.p}</span>
                <span style={{fontSize:11,color:T.t4,textDecoration:"line-through",fontFamily:FONT.mono}}>{p.m}</span>
              </div>
              <div style={{fontSize:10,color:T.t3,marginTop:2}}>{p.s} shops nearby · Fits guaranteed</div>
            </div>
            <button style={{background:R.red,color:"#fff",border:"none",borderRadius:8,padding:"7px 13px",fontSize:11,fontWeight:900,cursor:"pointer",fontFamily:FONT.ui,flexShrink:0,letterSpacing:"0.05em",textTransform:"uppercase"}}>ADD</button>
          </div>
        ))}
        <div style={{textAlign:"center",padding:"3px 0",fontSize:10,color:T.t3}}>100% fitment guarantee on all listed parts</div>
      </div>
    </div>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────
const ERP_FEATS = [
  {icon:"🧾",t:"POS Billing",d:"Split payments across Cash, UPI, and Udhaar in one invoice. Instant GST receipt printing.",c:R.redHi},
  {icon:"⬡",t:"Smart Inventory",d:"Real-time stock tracking with low-stock alerts, reorder levels, and immutable ledger.",c:"#38BDF8"},
  {icon:"💳",t:"Udhaar Ledger",d:"Built-in credit management with per-customer tracking and WhatsApp payment reminders.",c:"#10B981"},
  {icon:"🔧",t:"Workshop Jobs",d:"Create job cards, assign mechanics, link parts, and generate service invoices — all in one.",c:"#A78BFA"},
  {icon:"📊",t:"GST Reports",d:"Auto GSTR-1 & GSTR-3B summaries. One-click CA export. Zero manual entry.",c:R.redHi},
  {icon:"🏪",t:"Multi-Store",d:"Manage multiple branches from one login. Each shop has its own inventory and billing.",c:"#38BDF8"},
];

const MP_FEATS = [
  {icon:"🚗",t:"Fitment Guarantee",d:"Select your vehicle once — every part listed is 100% guaranteed to fit. No wrong orders.",c:"#10B981"},
  {icon:"📍",t:"Hyperlocal Delivery",d:"Parts sourced from shops within 10 km. Same-day delivery. No warehouse delays.",c:R.redHi},
  {icon:"💸",t:"Price Comparison",d:"Compare live prices from 5+ nearby shops for the same part. Always the best deal.",c:"#38BDF8"},
  {icon:"📦",t:"Live Tracking",d:"Real-time status from order placed to door delivery. WhatsApp updates at every stage.",c:"#A78BFA"},
];

const REVIEWS = [
  {q:"Before Red Piston, I wrote every bill by hand. Now I run 80+ invoices a day and my udhaar recovery improved 40%. The GST report alone saves ₹3k/month on my CA.",n:"Rajesh Kumar",r:"Owner · Karol Bagh Auto Parts, Delhi",i:"RK",c:R.red},
  {q:"Three shops in Pune used to be total chaos. Red Piston's multi-store view saves me 2 hours daily. I can see all three branches' stock and sales from my phone.",n:"Suresh Mehta",r:"Owner · SM Auto Parts Chain, Pune",i:"SM",c:"#10B981"},
  {q:"Ordering parts used to take 3 phone calls. Now I search by the exact car model, get guaranteed-fit parts, and they arrive in under 2 hours. Game changer.",n:"Arjun Pillai",r:"Independent Mechanic · Bengaluru",i:"AP",c:"#38BDF8"},
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LandingPage({ currentUser }) {
  const navigate  = useNavigate();
  const [tab, setTab]           = useState("erp");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const appRoute = currentUser?.role === "SHOP_OWNER" ? "/dashboard" : "/marketplace";
  const feats    = tab === "erp" ? ERP_FEATS : MP_FEATS;

  return (
    <>
      <style>{CSS}</style>

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:1000,
        background: scrolled ? `${R.bg}f0` : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled ? `1px solid ${R.border}` : "1px solid transparent",
        transition:"all 0.3s",
      }}>
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 24px",height:66,display:"flex",alignItems:"center",gap:32}}>
          <div style={{cursor:"pointer",flexShrink:0}} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
            <Logo height={46} showText={true} />
          </div>

          <div className="nav-links" style={{display:"flex",gap:28,flex:1,marginLeft:8}}>
            <a className="nav-a" onClick={()=>document.getElementById("features")?.scrollIntoView({behavior:"smooth"})}>Features</a>
            <a className="nav-a" onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})}>Pricing</a>
            <a className="nav-a" onClick={()=>document.getElementById("reviews")?.scrollIntoView({behavior:"smooth"})}>Reviews</a>
          </div>

          <div style={{flex:1}}/>

          {currentUser ? (
            <button className="btn-red" onClick={()=>navigate(appRoute)}>Open App →</button>
          ) : (
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>navigate("/login")} style={{padding:"9px 20px"}}>Sign In</button>
              <button className="btn-red" onClick={()=>navigate("/login")}>Get Started Free</button>
            </div>
          )}
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section style={{position:"relative",minHeight:"100vh",display:"flex",alignItems:"center",overflow:"hidden",paddingTop:66}}>
        {/* ── Full-screen background video ── */}
        <video
          autoPlay muted loop playsInline
          style={{
            position:"absolute",inset:0,width:"100%",height:"100%",
            objectFit:"cover",zIndex:0,
            filter:"brightness(0.22) saturate(1.4)",
          }}
        >
          <source src="/video1.mp4" type="video/mp4"/>
        </video>
        {/* Dark red-tinted overlay for readability */}
        <div style={{
          position:"absolute",inset:0,zIndex:1,
          background:`linear-gradient(180deg,
            rgba(10,11,13,0.55) 0%,
            rgba(10,11,13,0.35) 40%,
            rgba(10,11,13,0.70) 80%,
            ${R.bg} 100%)`,
          pointerEvents:"none",
        }}/>
        {/* Warm red ambient over video */}
        <div style={{
          position:"absolute",inset:0,zIndex:1,
          background:`radial-gradient(ellipse 80% 60% at 50% 30%, rgba(139,26,26,0.18) 0%, transparent 70%)`,
          pointerEvents:"none",
        }}/>
        <div className="grid-bg" style={{zIndex:2}}/>
        {/* Glow blobs */}
        <div className="glow-blob" style={{width:700,height:700,top:"5%",left:"38%",transform:"translateX(-25%)",zIndex:2}}/>
        <div style={{position:"absolute",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle, rgba(56,189,248,0.04) 0%, transparent 70%)",top:"55%",left:"3%",pointerEvents:"none",zIndex:2}}/>

        <div style={{maxWidth:1180,margin:"0 auto",padding:"80px 24px 140px",width:"100%",position:"relative",zIndex:3}}>
          <div className="hero-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>

            {/* Copy */}
            <div>
              <div className="s-badge lp-fu" style={{marginBottom:20}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:R.red,display:"inline-block",animation:"pulse 1.4s infinite"}}/>
                <span>Red<strong>PISTON</strong> — India's Auto Parts Platform</span>
              </div>

              <h1 className="hero-title lp-fu-1" style={{
                fontSize:"clamp(36px,4.2vw,58px)",fontWeight:900,
                lineHeight:1.07,letterSpacing:"-0.04em",color:T.t1,marginBottom:20,
              }}>
                Run your shop.<br/>
                <span style={{
                  background:`linear-gradient(90deg,${R.red},${R.redBright},${R.red})`,
                  backgroundSize:"200% auto",WebkitBackgroundClip:"text",
                  WebkitTextFillColor:"transparent",backgroundClip:"text",
                  animation:"gradMove 3s linear infinite",
                }}>Sell online.</span>
                <br/>
                <span style={{color:T.t1}}>Grow faster.</span>
              </h1>

              <p className="lp-fu-2" style={{fontSize:17,color:T.t2,lineHeight:1.7,marginBottom:28,maxWidth:460}}>
                The all-in-one platform for Indian auto parts shops — POS, inventory, GST, udhaar, workshop, and a B2C marketplace with fitment guarantee.
              </p>

              {/* Tagline from logo */}
              <div className="lp-fu-2" style={{marginBottom:28,display:"inline-block",borderLeft:`3px solid ${R.red}`,paddingLeft:14}}>
                <div style={{fontSize:20,fontWeight:900,color:R.red,letterSpacing:"0.08em",textTransform:"uppercase",lineHeight:1}}>
                  Find Parts. Fast.
                </div>
                <div style={{fontSize:12,color:T.t3,marginTop:4,letterSpacing:"0.04em"}}>Guaranteed fitment · Delivered same day</div>
              </div>

              {/* Pills */}
              <div className="lp-fu-3" style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:34}}>
                {["GST-Ready","Fitment Engine","Udhaar Ledger","WhatsApp Alerts","Multi-Store","Barcode Scan"].map(t=>(
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>

              {/* CTAs */}
              <div className="lp-fu-4" style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <button className="btn-hero" onClick={()=>navigate(currentUser?appRoute:"/login")}>
                  {currentUser?"Open App":"Start for Free"}
                  <span style={{fontSize:18}}>→</span>
                </button>
                <button className="btn-hero-outline" onClick={()=>document.getElementById("features")?.scrollIntoView({behavior:"smooth"})}>
                  See Features ↓
                </button>
              </div>

              {/* Trust */}
              <div className="lp-fu-5" style={{marginTop:40,display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{display:"flex"}}>
                    {[R.red,"#10B981","#38BDF8"].map((c,i)=>(
                      <div key={i} style={{
                        width:28,height:28,borderRadius:"50%",background:c,
                        border:`2.5px solid ${R.bg}`,marginLeft:i>0?-9:0,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:10,fontWeight:900,color:"#fff",
                      }}>{["R","S","A"][i]}</div>
                    ))}
                  </div>
                  <span style={{fontSize:13,color:T.t2,fontWeight:500}}>500+ shops trust Red Piston</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:3}}>
                  {[...Array(5)].map((_,i)=><span key={i} style={{color:R.red,fontSize:15}}>★</span>)}
                  <span style={{fontSize:13,color:T.t2,marginLeft:5,fontWeight:600}}>4.9 / 5</span>
                </div>
              </div>
            </div>

            {/* Mockup */}
            <div className="mockup-col" style={{display:"flex",justifyContent:"center",animation:"float 4.5s ease-in-out infinite"}}>
              <ERPMockup/>
            </div>
          </div>
        </div>

        {/* car animation removed */}

        <div style={{position:"absolute",bottom:0,left:0,right:0,height:80,background:`linear-gradient(transparent,${R.bg})`,pointerEvents:"none",zIndex:4}}/>
      </section>

      {/* ══ STATS ═══════════════════════════════════════════════════════════ */}
      <section style={{padding:"56px 24px",background:R.surface,borderTop:`1px solid ${R.border}`,borderBottom:`1px solid ${R.border}`}}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <div className="stats-4col" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
            {[
              {v:"500+",  l:"Shop Owners",      s:"Across 50+ cities",  c:R.redHi},
              {v:"₹2.4Cr+",l:"Monthly GMV",    s:"Platform processed",  c:"#10B981"},
              {v:"1.2L+", l:"Parts Catalogued", s:"With fitment data",   c:"#38BDF8"},
              {v:"99.2%", l:"Platform Uptime",  s:"30-day rolling SLA",  c:"#A78BFA"},
            ].map(s=>(
              <div key={s.l} className="stat-card">
                <div style={{fontSize:32,fontWeight:900,color:s.c,fontFamily:FONT.mono,letterSpacing:"-0.04em",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:14,fontWeight:700,color:T.t1,marginTop:8}}>{s.l}</div>
                <div style={{fontSize:12,color:T.t3,marginTop:3}}>{s.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section id="features" style={{padding:"100px 24px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 60% 50% at 50% 0%, ${R.redGlow}, transparent)`,pointerEvents:"none"}}/>

        <div style={{maxWidth:1180,margin:"0 auto",position:"relative",zIndex:1}}>
          <div style={{textAlign:"center",marginBottom:50}}>
            <div className="s-badge" style={{marginBottom:16}}>Platform Features</div>
            <h2 style={{fontSize:"clamp(28px,3.5vw,44px)",fontWeight:900,color:T.t1,letterSpacing:"-0.035em",lineHeight:1.1,marginBottom:14}}>
              Everything your shop needs.<br/>
              <span style={{color:R.red}}>Nothing it doesn't.</span>
            </h2>
            <p style={{fontSize:16,color:T.t2,maxWidth:500,margin:"0 auto",lineHeight:1.65}}>
              Two powerful products in one — full ERP for shop owners, fitment-guaranteed marketplace for buyers and mechanics.
            </p>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:46}}>
            <button className="tab-btn" onClick={()=>setTab("erp")} style={{
              background: tab==="erp" ? R.red : "transparent",
              color: tab==="erp" ? "#fff" : T.t2,
              border:`1.5px solid ${tab==="erp" ? R.red : R.border}`,
            }}>🏪 Shop Owners</button>
            <button className="tab-btn" onClick={()=>setTab("mp")} style={{
              background: tab==="mp" ? "#10B981" : "transparent",
              color: tab==="mp" ? "#000" : T.t2,
              border:`1.5px solid ${tab==="mp" ? "#10B981" : R.border}`,
            }}>🚗 Buyers & Mechanics</button>
          </div>

          {/* Feature grid */}
          <div className="feat-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18,marginBottom:68}}>
            {feats.map((f,i)=>(
              <div key={f.t} className="feat-card">
                <div style={{width:46,height:46,borderRadius:13,marginBottom:18,background:`${f.c}18`,border:`1px solid ${f.c}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{f.icon}</div>
                <h3 style={{fontSize:16,fontWeight:800,color:T.t1,marginBottom:9,letterSpacing:"-0.02em"}}>{f.t}</h3>
                <p style={{fontSize:13,color:T.t2,lineHeight:1.7}}>{f.d}</p>
              </div>
            ))}
          </div>

          {/* Marketplace split */}
          <div className="split-2col" style={{background:R.card,border:`1px solid ${R.border}`,borderRadius:24,padding:"50px 52px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:56,alignItems:"center"}}>
            <div>
              <div className="s-badge" style={{marginBottom:16,background:"rgba(16,185,129,0.1)",borderColor:"rgba(16,185,129,0.3)",color:"#10B981"}}>Marketplace</div>
              <h3 style={{fontSize:28,fontWeight:900,color:T.t1,letterSpacing:"-0.035em",marginBottom:14,lineHeight:1.12}}>
                The right part,<br/><span style={{color:R.red}}>guaranteed to fit.</span>
              </h3>
              <p style={{fontSize:15,color:T.t2,lineHeight:1.7,marginBottom:24}}>
                Customers select their exact vehicle once. Our fitment engine shows only 100% compatible parts — no guesswork, no wrong orders, no returns.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:11}}>
                {["Vehicle-first search — every part fits, guaranteed","Price comparison across 5+ nearby shops","Same-day hyperlocal delivery within 10 km","Real-time WhatsApp updates at every step"].map(p=>(
                  <div key={p} style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <span style={{color:"#10B981",fontWeight:900,fontSize:13,flexShrink:0,marginTop:1}}>✓</span>
                    <span style={{fontSize:14,color:T.t2,lineHeight:1.55}}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"center"}}>
              <MarketplaceMockup/>
            </div>
          </div>
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════════════════════════ */}
      <section id="pricing" style={{padding:"100px 24px",background:R.surface,borderTop:`1px solid ${R.border}`}}>
        <div style={{maxWidth:1020,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:52}}>
            <div className="s-badge" style={{marginBottom:16}}>Pricing</div>
            <h2 style={{fontSize:"clamp(28px,3.5vw,44px)",fontWeight:900,color:T.t1,letterSpacing:"-0.035em",marginBottom:14}}>Simple, transparent pricing.</h2>
            <p style={{fontSize:16,color:T.t2,maxWidth:400,margin:"0 auto"}}>Start free. Scale as you grow. No hidden charges, ever.</p>
          </div>

          <div className="price-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {[
              {n:"Starter",p:"Free",per:"forever",icon:"🌱",c:T.t2,hot:false,
               fl:["Up to 50 products","POS billing","Basic inventory","Stock alerts","1 user login"],cta:"Get Started Free"},
              {n:"Professional",p:"₹1,499",per:"/month",icon:"🚀",c:R.redHi,hot:true,
               fl:["Unlimited products","Full POS + inventory","Online marketplace listing","GST reports","Udhaar ledger","WhatsApp reminders","5 user logins"],cta:"Start 14-Day Trial"},
              {n:"Enterprise",p:"₹3,999",per:"/month",icon:"🏭",c:"#38BDF8",hot:false,
               fl:["Everything in Pro","Multi-location support","Batch & expiry tracking","Smart auto-POs","Dedicated manager","Custom integrations"],cta:"Contact Sales"},
            ].map(tier=>(
              <div key={tier.n} className={`price-card${tier.hot?" hot":""}`}>
                {tier.hot && (
                  <div style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",
                    background:R.red,color:"#fff",fontSize:10,fontWeight:900,
                    padding:"4px 18px",borderRadius:100,letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
                    Most Popular
                  </div>
                )}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:24,marginBottom:9}}>{tier.icon}</div>
                  <div style={{fontSize:16,fontWeight:900,color:T.t1,marginBottom:7,letterSpacing:"-0.02em"}}>{tier.n}</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                    <span style={{fontSize:30,fontWeight:900,color:tier.c,fontFamily:FONT.mono,letterSpacing:"-0.04em"}}>{tier.p}</span>
                    <span style={{fontSize:13,color:T.t3}}>{tier.per}</span>
                  </div>
                </div>
                <div style={{borderTop:`1px solid ${R.border}`,paddingTop:20,marginBottom:24}}>
                  {tier.fl.map(f=>(
                    <div key={f} style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:11}}>
                      <span style={{color:tier.hot?R.red:"#10B981",fontWeight:900,fontSize:13,flexShrink:0,marginTop:1}}>✓</span>
                      <span style={{fontSize:13,color:T.t2,lineHeight:1.5}}>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  className={tier.hot?"btn-red":"btn-ghost"}
                  style={{width:"100%",padding:"13px 20px",fontSize:13,borderRadius:10}}
                  onClick={()=>navigate("/login")}
                >{tier.cta}</button>
              </div>
            ))}
          </div>
          <p style={{textAlign:"center",marginTop:26,fontSize:13,color:T.t3}}>
            All plans include unlimited invoices · barcode scanning · mobile access · Annual billing saves 20%
          </p>
        </div>
      </section>

      {/* ══ REVIEWS ══════════════════════════════════════════════════════════ */}
      <section id="reviews" style={{padding:"100px 24px"}}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:52}}>
            <div className="s-badge" style={{marginBottom:16}}>Customer Reviews</div>
            <h2 style={{fontSize:"clamp(28px,3.5vw,44px)",fontWeight:900,color:T.t1,letterSpacing:"-0.035em"}}>
              Loved by shop owners across India.
            </h2>
          </div>
          <div className="rev-3col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {REVIEWS.map(r=>(
              <div key={r.n} className="review-card">
                <div style={{display:"flex",gap:1,marginBottom:14}}>
                  {[...Array(5)].map((_,i)=><span key={i} style={{color:R.red,fontSize:16}}>★</span>)}
                </div>
                <p style={{fontSize:14,color:T.t2,lineHeight:1.75,marginBottom:20,fontStyle:"italic"}}>"{r.q}"</p>
                <div style={{display:"flex",alignItems:"center",gap:11}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:`${r.c}22`,border:`1.5px solid ${r.c}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:r.c}}>{r.i}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:T.t1}}>{r.n}</div>
                    <div style={{fontSize:11,color:T.t3,marginTop:2}}>{r.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════════════════════ */}
      <section style={{padding:"80px 24px 100px"}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
          <div style={{
            background:`linear-gradient(135deg,${R.card},${R.surface})`,
            border:`1px solid ${R.border}`,borderRadius:28,
            padding:"70px 52px",textAlign:"center",position:"relative",overflow:"hidden",
          }}>
            <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 70% 60% at 50% 110%,${R.redGlow},transparent)`,pointerEvents:"none"}}/>
            {/* Decorative gears */}
            <div style={{position:"absolute",top:-28,right:-28,opacity:0.04,fontSize:150,lineHeight:1}}>⚙</div>
            <div style={{position:"absolute",bottom:-14,left:-14,opacity:0.04,fontSize:90,lineHeight:1}}>⚙</div>

            <div style={{position:"relative",zIndex:1}}>
              {/* Logo centered */}
              <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
                <Logo height={72} showText={false}/>
              </div>

              <h2 style={{fontSize:"clamp(24px,3.2vw,40px)",fontWeight:900,color:T.t1,letterSpacing:"-0.035em",marginBottom:16,lineHeight:1.1}}>
                Ready to modernise your<br/>
                <span style={{color:R.red}}>auto parts business?</span>
              </h2>

              {/* Logo tagline in CTA */}
              <div style={{fontSize:18,fontWeight:900,color:R.red,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>
                Find Parts. Fast.
              </div>

              <p style={{fontSize:16,color:T.t2,marginBottom:36,lineHeight:1.65,maxWidth:480,margin:"0 auto 36px"}}>
                Join 500+ shop owners who replaced notebooks and WhatsApp chaos with Red<strong>PISTON</strong>. Start free — no credit card required.
              </p>

              <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
                <button
                  className="btn-hero"
                  style={{animation:"redPulse 2.5s ease-in-out infinite"}}
                  onClick={()=>navigate(currentUser?appRoute:"/login")}
                >
                  {currentUser?"Open App":"Start for Free"}
                  <span style={{fontSize:18}}>→</span>
                </button>
                {!currentUser && (
                  <button className="btn-hero-outline" onClick={()=>navigate("/login")}>Book a Demo</button>
                )}
              </div>

              <p style={{fontSize:12,color:T.t3,marginTop:20,letterSpacing:"0.02em"}}>
                Free plan forever · Setup in 5 minutes · No credit card
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer style={{background:R.surface,borderTop:`1px solid ${R.border}`,padding:"60px 24px 36px"}}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <div className="footer-4col" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:44,marginBottom:48}}>

            {/* Brand */}
            <div>
              <div style={{marginBottom:16,cursor:"pointer"}} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
                <Logo height={50} showText={true}/>
              </div>
              <p style={{fontSize:13,color:T.t3,lineHeight:1.7,maxWidth:265,marginBottom:20}}>
                India's only B2B2C platform for auto parts — full ERP for shop owners, fitment-guaranteed marketplace for buyers.
              </p>
              <div style={{display:"flex",gap:8}}>
                {["𝕏","in","▶"].map((ico,i)=>(
                  <div key={i} style={{width:34,height:34,borderRadius:8,background:R.card,border:`1px solid ${R.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:T.t3,cursor:"pointer"}}>{ico}</div>
                ))}
              </div>
            </div>

            {[
              {h:"Product", l:["ERP / POS","Inventory","Workshop","Marketplace","Pricing"]},
              {h:"Company", l:["About Us","Blog","Careers","Press Kit","Contact"]},
              {h:"Legal",   l:["Privacy Policy","Terms of Service","Refund Policy","Cookie Policy"]},
            ].map(col=>(
              <div key={col.h}>
                <div style={{fontSize:11,fontWeight:900,color:T.t1,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16}}>{col.h}</div>
                {col.l.map(l=>(
                  <div key={l} style={{marginBottom:10}}>
                    <a className="nav-a" style={{fontSize:13}}>{l}</a>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="divider" style={{marginBottom:22}}/>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div style={{fontSize:12,color:T.t4}}>© 2026 RedPISTON Technologies Pvt. Ltd. All rights reserved.</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["Made in India 🇮🇳","GST Compliant","PCI DSS Ready"].map(b=>(
                <span key={b} style={{fontSize:11,color:T.t4,background:R.card,border:`1px solid ${R.border}`,borderRadius:6,padding:"4px 10px",fontWeight:600}}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
