import { useState, useCallback, useEffect, useRef, Component, useContext, useMemo, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { T, FONT, GLOBAL_CSS } from "./theme";
import { fmt, uid } from "./utils";
import { useStore } from "./store";
import { Toast, useToast, Btn } from "./components/ui";
import { setTokens, clearTokens, api } from "./api/client.js";
import {
  syncInvoice,
  syncPurchase,
  syncAdjustment,
  syncProductSave,
  setSyncScope,
  getSyncStatus,
  subscribeSyncStatus,
  flushSyncQueue,
  getSyncQueueSnapshot,
  retrySyncQueueItem,
  discardSyncQueueItem,
} from "./api/sync.js";
import { ShortcutOverlay } from "./components/ShortcutOverlay";
import { CommandPalette } from "./components/CommandPalette";
import { SyncCenterModal } from "./components/SyncCenterModal";
import { AppCtx } from "./appContext";

// Always-loaded: auth, shell chrome, modals (needed on first render)
import { ProfileDropdown } from "./components/ProfileDropdown";
import { Avatar } from "./components/Avatar";
import { ProductModal } from "./components/ProductModal";
import { BulkStockInModal } from "./components/BulkStockInModal";

// ── Lazy-loaded pages (each becomes its own JS chunk, loaded on first visit) ──
// Named-export pages need the .then() unwrap since React.lazy requires a default export.
const LoginPage         = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

// ERP pages — only a SHOP_OWNER ever loads these
const DashboardPage  = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const InventoryPage  = lazy(() => import("./pages/InventoryPage").then(m => ({ default: m.InventoryPage })));
const POSBillingPage = lazy(() => import("./pages/POSBillingPage").then(m => ({ default: m.POSBillingPage })));
const HistoryPage    = lazy(() => import("./pages/HistoryPage").then(m => ({ default: m.HistoryPage })));
const ReportsPage    = lazy(() => import("./pages/ReportsPage").then(m => ({ default: m.ReportsPage })));
const LandingPage   = lazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));

// Shared page-transition fallback — skeletal shimmer instead of a spinner
const PageLoader = () => (
  <div style={{ padding: "28px 32px", fontFamily: FONT.ui }}>
    {/* Simulated page skeleton */}
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
      <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 10 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton-shimmer" style={{ height: 16, width: "30%", borderRadius: 6, marginBottom: 8 }} />
        <div className="skeleton-shimmer" style={{ height: 11, width: "18%", borderRadius: 6 }} />
      </div>
    </div>
    <div className="kpi-grid-6" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
      {[1,2,3,4].map(i => (
        <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 12 }} />
      ))}
    </div>
    <div className="skeleton-shimmer" style={{ height: 220, borderRadius: 12, marginBottom: 14 }} />
    <div className="skeleton-shimmer" style={{ height: 120, borderRadius: 12 }} />
  </div>
);

// ========== ERROR BOUNDARY ==========
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("[ErrorBoundary]", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.ui }}>
          <div style={{ textAlign: "center", maxWidth: 420, padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 14, color: T.t3, marginBottom: 24, lineHeight: 1.6 }}>{this.state.error?.message || "An unexpected error occurred."}</div>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui }}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ========== NAV ITEMS FOR LEFT SIDEBAR ==========
const NAV_ITEMS = [
  { key: "dashboard", path: "/dashboard", icon: "◈", label: "Dashboard" },
  { key: "inventory", path: "/inventory", icon: "⬡", label: "Inventory" },
  { key: "pos", path: "/billing", icon: "🧾", label: "POS" },
  { key: "history", path: "/history", icon: "🕘", label: "History" },
  { key: "reports", path: "/reports", icon: "📊", label: "Reports" },
];

const DAY_MS = 86400000;
const SALES_CUTOFF_REFRESH_MS = 60000;
const APP_BOOT_TS = Date.now();

function SyncStatusPill({ status, onOpenCenter, onSyncNow }) {
  const pending = Number(status?.pendingCount || 0);
  const syncing = Boolean(status?.isSyncing);
  const offline = status?.isOnline === false;
  const lastSyncedLabel = status?.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  let label = "Synced";
  let color = T.emerald;
  let background = T.emeraldBg;

  if (offline && pending > 0) {
    label = `Offline · ${pending} pending`;
    color = T.crimson;
    background = T.crimsonBg;
  } else if (syncing) {
    label = pending > 0 ? `Syncing ${pending}...` : "Syncing...";
    color = T.sky;
    background = T.skyBg;
  } else if (pending > 0) {
    label = `${pending} pending`;
    color = T.amber;
    background = T.amberGlow;
  } else if (lastSyncedLabel) {
    label = `Synced ${lastSyncedLabel}`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        onClick={() => onOpenCenter?.()}
        title="Open Sync Center"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          border: `1px solid ${color}44`,
          background,
          color,
          fontSize: 11,
          fontWeight: 700,
          padding: "5px 10px",
          fontFamily: FONT.ui,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        {syncing ? (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              borderTopColor: "transparent",
              animation: "spin 0.85s linear infinite",
            }}
          />
        ) : (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 8px ${color}88`,
              animation: pending > 0 ? "pulse 1.1s ease-in-out infinite" : "none",
            }}
          />
        )}
        <span>{label}</span>
        {pending > 0 && <span style={{ fontSize: 10, opacity: 0.9 }}>Queue</span>}
      </button>

      {pending > 0 && !syncing && (
        <button
          onClick={() => onSyncNow?.()}
          title="Sync pending changes now"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            border: `1px solid ${T.amber}55`,
            background: T.amberGlow,
            color: T.amber,
            fontSize: 14,
            fontWeight: 900,
            lineHeight: 1,
            cursor: "pointer",
            animation: "pulse 1.6s ease-in-out infinite",
          }}
        >
          ↻
        </button>
      )}
    </div>
  );
}

// ========== ERP SHELL ==========
// Defined at MODULE LEVEL so React sees a stable component type on every render.
// Previously defined inside AppContent which caused React to unmount+remount the
// entire page subtree on every state change (toast, modal, etc.).
function ERPShell({ children }) {
  const {
    pModal, setPModal, catalogModal, setCatalogModal,
    toast, toasts, removeToast,
    currentUser, handleLogout,
    syncStatus, syncNow,
    openSyncCenter,
    syncCenterOpen, setSyncCenterOpen,
    syncQueueItems, syncActionBusy, syncItemBusy,
    handleRetrySyncItem, handleDiscardSyncItem,
    saveProduct, handleBulkStockIn,
  } = useContext(AppCtx);

  const { products, movements, shops, activeShopId, resetAll, saveShops } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [shopEdit, setShopEdit] = useState(null);
  const [salesCutoffTs, setSalesCutoffTs] = useState(() => APP_BOOT_TS - DAY_MS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSalesCutoffTs(Date.now() - DAY_MS);
    }, SALES_CUTOFF_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  const todaySales = useMemo(() => (movements || []).filter((m) => m.shopId === activeShopId && m.type === "SALE" && m.date >= salesCutoffTs), [movements, activeShopId, salesCutoffTs]);
  const todayRev = useMemo(() => todaySales.reduce((s, m) => s + m.total, 0), [todaySales]);
  const stockSt = (p) => { if (p.stock <= 0) return "out"; if (p.stock < p.minStock) return "low"; return "ok"; };
  const lowStockProducts = useMemo(() => (products || []).filter((p) => p.shopId === activeShopId && stockSt(p) !== "ok"), [products, activeShopId]);
  const lowCount = lowStockProducts.length;
  const shop = useMemo(() => (shops || []).find((s) => s.id === activeShopId) || { name: "My Shop", city: "Location" }, [shops, activeShopId]);
  const currentPath = location.pathname;

  // Low stock alert banner dismiss (per session)
  const [lowStockDismissed, setLowStockDismissed] = useState(() => {
    try { return sessionStorage.getItem("vl_low_stock_dismissed") === "1"; } catch { return false; }
  });
  const dismissLowStock = () => {
    setLowStockDismissed(true);
    try {
      sessionStorage.setItem("vl_low_stock_dismissed", "1");
    } catch (err) {
      console.warn("[UI] Could not persist low stock banner state:", err?.message || err);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, color: T.t1 }}>
      <style>{GLOBAL_CSS}</style>

      {/* TOPBAR */}
      <div className="erp-topbar" style={{ height: 56, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 20px 0 88px", position: "sticky", top: 0, zIndex: 500, gap: 10, boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 1px 0 ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 12, position: "relative" }}>
          <div onClick={() => setShopEdit({ name: shop.name, city: shop.city })} style={{ cursor: "pointer" }} title="Edit shop details">
            <div style={{ fontSize: 14, fontWeight: 800, color: T.t1, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 4 }}>{shop.name} <span style={{ fontSize: 10, color: T.t4 }}>✏️</span></div>
            <div style={{ fontSize: 10, color: T.amber, fontWeight: 600, letterSpacing: "0.04em" }}>INVENTORY · {shop.city?.toUpperCase() || "LOCATION"}</div>
          </div>
          {shopEdit && (
            <div style={{ position: "absolute", top: 48, left: 0, zIndex: 9999, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", width: 280 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.t1, marginBottom: 12 }}>Edit Shop Details</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Shop Name</label>
                <input value={shopEdit.name} onChange={(e) => setShopEdit((p) => ({ ...p, name: e.target.value }))} style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.t1, fontSize: 13, fontWeight: 600, fontFamily: FONT.ui, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Location / City</label>
                <input value={shopEdit.city} onChange={(e) => setShopEdit((p) => ({ ...p, city: e.target.value }))} style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.t1, fontSize: 13, fontWeight: 600, fontFamily: FONT.ui, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShopEdit(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px", color: T.t3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.ui }}>Cancel</button>
                <button onClick={() => { const updated = shops.map((s) => (s.id === activeShopId ? { ...s, name: shopEdit.name, city: shopEdit.city } : s)); saveShops(updated); setShopEdit(null); toast("Shop details updated!", "emerald"); }} style={{ background: T.amber, border: "none", borderRadius: 8, padding: "6px 14px", color: "#000", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT.ui }}>Save</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <SyncStatusPill status={syncStatus} onSyncNow={syncNow} onOpenCenter={openSyncCenter} />
        {todayRev > 0 && (<div className="topbar-secondary" style={{ background: T.emeraldBg, border: `1px solid ${T.emerald}33`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.emerald, fontWeight: 700, fontFamily: FONT.mono, display: "flex", alignItems: "center", gap: 6 }}>📈 {fmt(todayRev)}</div>)}
        {lowCount > 0 && (<button onClick={() => navigate("/inventory")} style={{ background: T.crimsonBg, border: `1px solid ${T.crimson}33`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.crimson, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 5 }}>⚠ {lowCount}</button>)}
        <Btn size="sm" variant="ghost" onClick={() => navigate("/billing")} style={{ borderColor: T.border }}>🧾</Btn>
        <Btn size="sm" variant="amber" onClick={() => setCatalogModal(true)}>＋</Btn>
        <button className="topbar-secondary" onClick={() => { if (confirm("Reset all data to defaults?")) resetAll(); }} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.t3, cursor: "pointer", fontWeight: 600, fontFamily: FONT.ui }}>🔄</button>
        <ProfileDropdown user={currentUser} onLogout={handleLogout} />
      </div>

      {/* LOW STOCK ALERT BANNER */}
      {lowCount > 0 && !lowStockDismissed && (
        <div data-print-hide className="erp-banner" style={{
          background: T.amberGlow, borderBottom: `1px solid ${T.amber}33`,
          padding: "8px 20px 8px 92px", display: "flex", alignItems: "center", gap: 10,
          animation: "fadeDown 0.25s ease both",
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span style={{ fontSize: 13, color: T.amber, fontWeight: 600, flex: 1 }}>
            {lowCount} product{lowCount > 1 ? "s" : ""} below reorder level
          </span>
          <button
            onClick={() => navigate("/inventory")}
            style={{
              background: T.amber, color: "#000", border: "none", borderRadius: 6,
              padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui,
            }}
          >View All</button>
          <button
            onClick={dismissLowStock}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, fontSize: 16, padding: "0 4px" }}
          >×</button>
        </div>
      )}

      {/* PAGE */}
      <div className="erp-content" style={{ padding: "24px 28px 24px 92px", maxWidth: 1440, margin: "0 auto" }}>
        {children}
      </div>

      {/* Edit existing product */}
      <ProductModal open={pModal.open} product={pModal.product} products={products} activeShopId={activeShopId} onClose={() => setPModal({ open: false, product: null })} onSave={saveProduct} toast={toast} />
      {/* Add new products — cart/bucket procurement flow */}
      <BulkStockInModal open={catalogModal} onClose={() => setCatalogModal(false)} onSave={handleBulkStockIn} toast={toast} activeShopId={activeShopId} />
      <SyncCenterModal
        open={syncCenterOpen}
        onClose={() => setSyncCenterOpen(false)}
        status={syncStatus}
        items={syncQueueItems}
        onSyncNow={syncNow}
        onRetryItem={handleRetrySyncItem}
        onDiscardItem={handleDiscardSyncItem}
        actionBusy={syncActionBusy}
        itemBusy={syncItemBusy}
      />
      <Toast items={toasts} onRemove={removeToast} />

      {/* LEFT SIDEBAR / BOTTOM NAV */}
      <div className="erp-sidebar" style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: 68, zIndex: 600,
        background: `${T.surface}f8`, backdropFilter: "blur(20px)",
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 10, gap: 2,
      }}>
        {/* Brand mark */}
        <div className="sidebar-brand" style={{
          width: 40, height: 40, borderRadius: 12,
          background: `linear-gradient(135deg, ${T.amber}, ${T.amberDim})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, fontWeight: 900, color: "#000",
          boxShadow: `0 2px 12px ${T.amber}44`, marginBottom: 3,
          flexShrink: 0,
        }}>
          {shop.name?.charAt(0) || "S"}
        </div>
        <div className="sidebar-brand" style={{ fontSize: 7, color: T.amber, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
          ERP
        </div>

        {NAV_ITEMS.map((n) => {
          const isActive = currentPath === n.path || currentPath.startsWith(n.path + "/");
          return (
            <button
              key={n.key}
              onClick={() => navigate(n.path)}
              title={`${n.label}`}
              style={{
                width: 58, height: 46, borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: isActive ? T.amberGlow : "transparent",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 1, transition: "background 0.15s, opacity 0.15s",
                padding: "2px 0", position: "relative",
                outline: "none",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${T.amber}0d`; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Active left-edge indicator bar */}
              {isActive && (
                <span style={{
                  position: "absolute", left: -5, top: "50%",
                  transform: "translateY(-50%)",
                  width: 3, height: 22, borderRadius: 3,
                  background: T.amber,
                  boxShadow: `0 0 8px ${T.amber}66`,
                }} />
              )}
              <span style={{ fontSize: 14 }}>{n.icon}</span>
              <span style={{
                fontSize: 7, fontWeight: 700,
                color: isActive ? T.amber : T.t3,
                fontFamily: FONT.ui, letterSpacing: "0.02em",
                transition: "color 0.15s",
              }}>
                {n.label}
              </span>
              {/* Badge: low stock */}
              {n.key === "inventory" && lowCount > 0 && (
                <span style={{
                  position: "absolute", top: 3, right: 7,
                  background: T.amber, color: "#000",
                  fontSize: 8, borderRadius: "50%",
                  width: 14, height: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900,
                }}>
                  {lowCount}
                </span>
              )}
            </button>
          );
        })}
        <div className="sidebar-spacer" style={{ flex: 1 }} />
      </div>
    </div>
  );
}

// ========== MAIN APP COMPONENT ==========
function AppContent() {
  const navigate = useNavigate();

  // ── Auth state ──
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("as_user");
      if (stored) {
        const user = JSON.parse(stored);
        const rt = localStorage.getItem("as_refresh_token");
        if (rt) setTokens(null, rt);
        return user;
      }
    } catch (err) {
      console.warn("[Auth] Could not hydrate local user session:", err?.message || err);
    }
    return null;
  });

  // ── Store (always called — hooks rule) ──
  const {
    products, movements, orders, parties, vehicles, jobCards,
    saveProducts, saveMovements,
    receipts, saveReceipts,
    loaded, activeShopId, setActiveShopId, logAudit, clearStore,
    syncFromAPI: syncStoreFromAPI,
  } = useStore();

  // ── UI state ──
  const [pModal, setPModal]       = useState({ open: false, product: null });
  const [catalogModal, setCatalogModal] = useState(false);
  const [shortcutOverlay, setShortcutOverlay] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [syncCenterOpen, setSyncCenterOpen] = useState(false);
  const [syncActionBusy, setSyncActionBusy] = useState(false);
  const [syncItemBusy, setSyncItemBusy] = useState({});
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus());
  const [syncQueueItems, setSyncQueueItems] = useState(() => getSyncQueueSnapshot().items || []);
  const lastDbRefreshTsRef = useRef(0);
  const { items: toasts, add: toast, remove: removeToast } = useToast();

  const refreshSyncCenterState = useCallback(() => {
    const snapshot = getSyncQueueSnapshot();
    setSyncStatus(snapshot.status);
    setSyncQueueItems(snapshot.items);
    return snapshot;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((next) => {
      setSyncStatus(next);
      const snapshot = getSyncQueueSnapshot();
      setSyncQueueItems(snapshot.items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser?.userId) {
      setSyncScope({ userId: currentUser.userId, shopId: currentUser.shopId || activeShopId || null });
    } else {
      setSyncScope(null);
    }
    refreshSyncCenterState();
  }, [currentUser?.userId, currentUser?.shopId, activeShopId, refreshSyncCenterState]);

  useEffect(() => {
    if (!currentUser) return;
    flushSyncQueue({ reason: "session-ready", timeoutMs: 5000 }).catch((err) => {
      console.warn("[Sync] Session startup flush failed:", err?.message || err);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.userId) return;
    syncStoreFromAPI().catch((err) => {
      console.warn("[Store] Session DB sync failed:", err?.message || err);
    });
  }, [currentUser?.userId, currentUser?.shopId, syncStoreFromAPI]);

  useEffect(() => {
    if (!currentUser?.userId) return;
    if (syncStatus.isSyncing || syncStatus.pendingCount > 0) return;

    const now = Date.now();
    if (now - lastDbRefreshTsRef.current < 2500) return;
    lastDbRefreshTsRef.current = now;

    syncStoreFromAPI().catch((err) => {
      console.warn("[Store] Post-sync DB refresh failed:", err?.message || err);
    });
  }, [currentUser?.userId, syncStatus.isSyncing, syncStatus.pendingCount, syncStoreFromAPI]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!syncStatus.pendingCount) return undefined;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [syncStatus.pendingCount]);

  const syncNow = useCallback(async () => {
    setSyncActionBusy(true);
    try {
      const result = await flushSyncQueue({ reason: "manual", timeoutMs: 12000 });
      refreshSyncCenterState();
      if (result.synced) {
        toast("All local changes synced to backend.", "success", "Sync Complete");
      } else {
        toast(`${result.pendingCount} change(s) still pending sync.`, "warn", "Sync Pending");
      }
      return result;
    } finally {
      setSyncActionBusy(false);
    }
  }, [toast, refreshSyncCenterState]);

  const openSyncCenter = useCallback(() => {
    refreshSyncCenterState();
    setSyncCenterOpen(true);
  }, [refreshSyncCenterState]);

  const handleRetrySyncItem = useCallback(async (itemId) => {
    if (!itemId) return;
    setSyncItemBusy((prev) => ({ ...prev, [itemId]: true }));
    try {
      const result = await retrySyncQueueItem(itemId, { timeoutMs: 12000 });
      const snapshot = result.snapshot || refreshSyncCenterState();
      setSyncStatus(snapshot.status);
      setSyncQueueItems(snapshot.items);
      if (result.synced) {
        toast("Queue item synced successfully.", "success", "Retry Success");
      } else {
        toast("Retry attempted. Some items are still pending.", "warn", "Retry Done");
      }
    } catch (err) {
      toast(err?.message || "Failed to retry sync item.", "error", "Retry Failed");
    } finally {
      setSyncItemBusy((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }, [toast, refreshSyncCenterState]);

  const handleDiscardSyncItem = useCallback((itemId) => {
    if (!itemId) return;
    const ok = confirm("Discard this pending sync item? This keeps local data but skips backend write for this item.");
    if (!ok) return;

    const result = discardSyncQueueItem(itemId);
    if (result?.snapshot) {
      setSyncStatus(result.snapshot.status);
      setSyncQueueItems(result.snapshot.items);
    } else {
      refreshSyncCenterState();
    }
    toast("Pending sync item discarded.", "warn", "Item Discarded");
  }, [toast, refreshSyncCenterState]);

  // ── Keyboard shortcut system ──
  useEffect(() => {
    const handler = (e) => {
      // Ignore when typing in inputs/textareas
      const tag = document.activeElement?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "n": e.preventDefault(); navigate("/billing"); break;
          case "p": e.preventDefault(); navigate("/billing"); break;
          case "i": e.preventDefault(); navigate("/inventory"); break;
          case "k": e.preventDefault(); setCmdPaletteOpen(true); break;
          case "b":
            e.preventDefault();
            {
              // Focus barcode input if it exists on the page
              const barcodeInput = document.querySelector('[data-barcode-input]');
              if (barcodeInput) barcodeInput.focus();
            }
            break;
          default: break;
        }
        return;
      }

      // ? key for shortcut overlay (only when not in an input)
      if (e.key === "?" && !isInput) {
        setShortcutOverlay(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);

  // ── Auth handlers ──
  const handleLogin = useCallback((user) => {
    let lastUserId = null;
    try {
      lastUserId = localStorage.getItem("as_last_user_id");
    } catch (err) {
      console.warn("[Auth] Could not read last user id:", err?.message || err);
    }

    if (lastUserId && user?.userId && lastUserId !== user.userId) {
      clearStore();
    }

    setCurrentUser(user);
    // Propagate the real shopId from the DB so all API calls and store filters
    // use the correct UUID (not the hardcoded "s1" seed default).
    if (user?.shopId) {
      setActiveShopId(user.shopId);
      try {
        localStorage.setItem("vl_shopId", user.shopId);
      } catch (err) {
        console.warn("[Auth] Could not persist shop id:", err?.message || err);
      }
      try {
        localStorage.setItem("as_user", JSON.stringify(user));
      } catch (err) {
        console.warn("[Auth] Could not persist user payload:", err?.message || err);
      }
    }
    if (user?.userId) {
      try {
        localStorage.setItem("as_last_user_id", user.userId);
      } catch (err) {
        console.warn("[Auth] Could not persist last user id:", err?.message || err);
      }
    }
    syncStoreFromAPI().catch((err) => {
      console.warn("[Store] Post-login DB sync failed:", err?.message || err);
    });
    navigate("/dashboard", { replace: true });
  }, [navigate, setActiveShopId, clearStore, syncStoreFromAPI]);

  const handleLogout = useCallback(async ({ logoutAll = false } = {}) => {
    if (isLoggingOut) return false;

    const pendingCount = getSyncStatus().pendingCount;
    if (pendingCount > 0) {
      toast(`Syncing ${pendingCount} pending change(s) before logout...`, "info", "Sync Required");
      const result = await flushSyncQueue({ reason: "logout", timeoutMs: 18000 });
      if (!result.synced) {
        const forceLogout = confirm(
          `${result.pendingCount} sync item(s) are still pending. Log out anyway?\n\n` +
          "Pending sync data will stay on this device for this account and retry next time you sign in."
        );
        if (!forceLogout) {
          toast("Logout cancelled. Resolve pending sync items first.", "warn", "Logout Cancelled");
          return false;
        }
        toast("Logging out with pending sync. Queue will retry on next sign-in.", "warn", "Sync Deferred");
      }
    }

    setIsLoggingOut(true);
    try {
      const rt = localStorage.getItem("as_refresh_token");
      if (logoutAll) {
        await api.post("/api/auth/logout-all", {});
      } else {
        await api.post("/api/auth/logout", { refreshToken: rt });
      }
    } catch {
      // Proceed with local logout even if revoke endpoint is unavailable.
    } finally {
      clearTokens();
      localStorage.removeItem("as_user");
      localStorage.removeItem("as_refresh_token");
      setCurrentUser(null);
      setIsLoggingOut(false);
      navigate("/login", { replace: true });
    }

    return true;
  }, [navigate, isLoggingOut, toast]);

  // ── Business handlers ──
  const saveProduct = useCallback((p) => {
    if (!products) return false;
    // Duplicate SKU guard: ensure no other product in the same shop uses this SKU
    if (p.sku) {
      const dup = products.find(x => x.id !== p.id && x.shopId === p.shopId && x.sku === p.sku);
      if (dup) {
        toast?.(`SKU "${p.sku}" already used by "${dup.name}". Please use a unique SKU.`, "warning");
        return false;
      }
    }
    const exists = products.find((x) => x.id === p.id);
    saveProducts(exists ? products.map((x) => (x.id === p.id ? p : x)) : [...products, p]);
    if (exists) {
      syncProductSave(p).catch((err) => {
        console.warn("[Sync] Product update queueing failed:", err?.message || err);
      });
    }
    logAudit(exists ? "PRODUCT_UPDATED" : "PRODUCT_CREATED", "product", p.id, `${p.name} (${p.sku})`);
    return true;
  }, [products, saveProducts, logAudit, toast]);

  const handleBulkStockIn = useCallback(({ products: newProds = [], movements: newMovs = [] }) => {
    if (!products) return;

    // ── 1. Merge new products into store ──────────────────────────────────────
    let updated = [...products];
    for (const p of newProds) {
      const fixed = { ...p, shopId: activeShopId };
      const idx = updated.findIndex((x) => x.id === fixed.id);
      if (idx >= 0) updated[idx] = { ...updated[idx], ...fixed }; else updated.push(fixed);
    }
    saveProducts(updated);

    // ── 2. Build movement rows — use API data, or synthesize if missing ───────
    // batchId groups all movements from this single stock-in session (used when no invoiceNo)
    const batchId = "STKIN-" + Date.now();
    let movRows;
    if (newMovs.length > 0) {
      movRows = newMovs.map((m) => ({
        id: "m" + (m.movementId || m.id || String(Date.now() + Math.random())),
        shopId: activeShopId,
        productId: m.inventoryId,
        productName: m.partName || "",
        type: m.type || "PURCHASE",
        qty: Number(m.qty) || 0,
        unitPrice: Number(m.unitPrice) || 0,
        sellingPrice: 0,
        total: Number(m.totalAmount) || 0,
        gstAmount: 0,
        profit: null,
        supplier: m.supplier || m.supplierName || null,
        supplierName: m.supplierName || m.supplier || null,
        invoiceNo: m.invoiceNo || null,
        batchId: m.invoiceNo ? null : batchId,
        payment: m.paymentMode || null,
        paymentMode: m.paymentMode || null,
        paymentStatus: "paid",
        note: m.notes || "Bulk stock-in",
        date: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
      }));
    } else {
      // No movements from API (offline fallback or API omitted them) —
      // synthesize one PURCHASE movement per product so HistoryPage always has a record
      movRows = newProds
        .filter((p) => (p.stock || 0) > 0)
        .map((p) => ({
          id: "m" + (p.id || String(Date.now() + Math.random())),
          shopId: activeShopId,
          productId: p.id || p.inventoryId,
          productName: p.name || "",
          type: "PURCHASE",
          qty: p.stock || 0,
          unitPrice: p.buyPrice || 0,
          sellingPrice: p.sellPrice || 0,
          total: (p.buyPrice || 0) * (p.stock || 0),
          gstAmount: 0,
          profit: null,
          supplier: null,
          supplierName: null,
          invoiceNo: null,
          batchId,
          payment: "Cash",
          paymentMode: "Cash",
          paymentStatus: "paid",
          note: "Bulk stock-in",
          date: Date.now(),
        }));
    }

    if (movRows.length > 0) {
      saveMovements([...(movements || []), ...movRows]);
    }
    logAudit("BULK_STOCK_IN", "inventory", activeShopId, `${newProds.length} product(s) stocked in`);
  }, [products, movements, saveProducts, saveMovements, activeShopId, logAudit]);

  const handleSale = useCallback((data) => {
    if (!products || !movements) return;
    const isQuote = data.type === "Quotation";
    // Guard: prevent negative stock
    if (!isQuote) {
      const productToSell = products.find(p => p.id === data.productId);
      if (productToSell && data.qty > productToSell.stock) {
        toast(`Not enough stock for ${productToSell.name}. Only ${productToSell.stock} available.`, "error");
        return;
      }
      saveProducts(products.map((p) => (p.id === data.productId ? { ...p, stock: Math.max(0, p.stock - data.qty) } : p)));
    }
    const sel = products.find((p) => p.id === data.productId);
    const isCredit = data.paymentMode === "Udhaar" || (data.payments && data.payments.Credit > 0);
    const paymentStr = data.payments
      ? Object.entries(data.payments).filter((entry) => entry[1] > 0).map(([mode, amount]) => `${mode}:${amount}`).join(", ")
      : data.payment;
    saveMovements([...movements, {
      id: "m" + uid(), shopId: activeShopId, productId: data.productId, productName: sel?.name || "",
      type: isQuote ? "ESTIMATE" : "SALE", qty: data.qty, unitPrice: data.sellPrice, sellingPrice: data.sellPrice,
      total: data.total, totalAmount: data.total, gstAmount: data.gstAmount, profit: isQuote ? 0 : data.profit,
      discount: data.discount, customerName: data.customerName, customerPhone: data.customerPhone,
      vehicleReg: data.vehicleReg, mechanic: data.mechanic, supplier: null, invoiceNo: data.invoiceNo,
      partyId: data.partyId || null,
      payment: paymentStr, paymentMode: data.paymentMode || null, creditDays: 0, paymentStatus: isCredit && !isQuote ? "pending" : "paid",
      note: [data.customerName && `Customer: ${data.customerName}`, data.vehicleReg && `Vehicle: ${data.vehicleReg}`, data.notes].filter(Boolean).join(" · ") || (isQuote ? "Quotation generated" : "Walk-in sale"),
      date: data.date, ...(data.priceOverride && { priceOverride: data.priceOverride }),
    }]);
    logAudit(isQuote ? "QUOTATION_CREATED" : "SALE_RECORDED", "movement", data.invoiceNo, `${data.qty}×${sel?.name?.slice(0, 20)} · ${fmt(data.total)}`);
    if (data.priceOverride) logAudit("PRICE_OVERRIDE", "movement", data.invoiceNo, `${sel?.name?.slice(0, 20)}: ${fmt(data.priceOverride.originalPrice)} → ${fmt(data.priceOverride.overriddenPrice)} (${data.priceOverride.reason || "no reason"})`);
    toast(isQuote ? `Quotation Generated: ${data.invoiceNo}` : `Sale recorded: ${data.qty}×${sel?.name?.slice(0, 20) || "product"} · ${fmt(data.total)}`, isQuote ? "info" : "success", isQuote ? "Estimate Saved" : "Sale Complete");
    // Persist to backend (fire-and-forget; local state is already updated above)
    if (!isQuote) {
      syncInvoice({
        items: [{ inventoryId: data.productId, qty: data.qty, unitPrice: data.sellPrice, discount: data.discount || 0 }],
        partyName: data.customerName || undefined,
        partyPhone: data.customerPhone || undefined,
        paymentMode: data.paymentMode === "Udhaar" ? "CREDIT" : (data.paymentMode || "CASH"),
        cashAmount: data.payments?.Cash || undefined,
        upiAmount: data.payments?.UPI || undefined,
        creditAmount: data.payments?.Credit || undefined,
        notes: data.notes || undefined,
      }).catch(() => {});
    }
  }, [products, movements, saveProducts, saveMovements, toast, activeShopId, logAudit]);

  const handleMultiItemSale = useCallback((data) => {
    if (!products || !movements) return;
    const isQuote = data.type === "Quotation";
    // Stock floor guard: check all items have enough stock before proceeding
    if (!isQuote) {
      for (const item of data.items) {
        const prod = products.find(p => p.id === item.productId);
        if (prod && item.qty > prod.stock) {
          toast(`Not enough stock for "${prod.name}". Only ${prod.stock} available.`, "error");
          return;
        }
      }
    }
    const newMovements = [];
    let updatedProducts = [...products];
    let hasOverrides = false;
    data.items.forEach((item) => {
      if (!isQuote) updatedProducts = updatedProducts.map((p) => (p.id === item.productId ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p));
      const isCredit = data.paymentMode === "Udhaar" || (data.payments && data.payments.Credit > 0);
      const paymentStr = data.payments
        ? Object.entries(data.payments).filter((entry) => entry[1] > 0).map(([mode, amount]) => `${mode}:${amount}`).join(", ")
        : "";
      newMovements.push({
        id: "m" + uid(), shopId: activeShopId, productId: item.productId, productName: item.name,
        type: isQuote ? "ESTIMATE" : "SALE", qty: item.qty, unitPrice: item.sellPrice, sellingPrice: item.sellPrice,
        total: item.total, totalAmount: item.total, gstAmount: item.gstAmount, profit: isQuote ? 0 : item.profit,
        discount: item.discount, customerName: data.customerName, customerPhone: data.customerPhone,
        vehicleReg: data.vehicleReg, mechanic: data.mechanic, supplier: null, invoiceNo: data.invoiceNo,
        partyId: data.partyId || null,
        payment: paymentStr, paymentMode: data.paymentMode || null, creditDays: 0,
        paymentStatus: isCredit && !isQuote ? "pending" : "paid",
        note: [data.customerName && `Customer: ${data.customerName}`, data.vehicleReg && `Vehicle: ${data.vehicleReg}`, data.notes].filter(Boolean).join(" · ") || (isQuote ? "Quotation" : "POS Sale"),
        date: data.date, multiItemInvoice: true, ...(item.priceOverride && { priceOverride: item.priceOverride }),
      });
      if (item.priceOverride) {
        hasOverrides = true;
        logAudit("PRICE_OVERRIDE", "movement", data.invoiceNo, `${item.name?.slice(0, 20)}: ${fmt(item.priceOverride.originalPrice)} → ${fmt(item.priceOverride.overriddenPrice)} (${item.priceOverride.reason || "no reason"})`);
      }
    });
    saveProducts(updatedProducts);
    saveMovements([...movements, ...newMovements]);
    logAudit(isQuote ? "MULTI_QUOTATION_CREATED" : "MULTI_SALE_RECORDED", "movement", data.invoiceNo, `${data.items.length} items · ${fmt(data.total)}${hasOverrides ? " · price override(s)" : ""}`);
    toast(isQuote ? `Quotation: ${data.items.length} items · ${fmt(data.total)}` : `Sale recorded: ${data.items.length} items · ${fmt(data.total)}`, isQuote ? "info" : "success", isQuote ? "Estimate Saved" : `Invoice ${data.invoiceNo}`);
    // Persist multi-item invoice to backend (fire-and-forget)
    if (!isQuote) {
      syncInvoice({
        items: data.items.map(item => ({ inventoryId: item.productId, qty: item.qty, unitPrice: item.sellPrice, discount: item.discount || 0 })),
        partyName: data.customerName || undefined,
        partyPhone: data.customerPhone || undefined,
        paymentMode: data.paymentMode === "Udhaar" ? "CREDIT" : (data.paymentMode || "CASH"),
        cashAmount: data.payments?.Cash || undefined,
        upiAmount: data.payments?.UPI || undefined,
        creditAmount: data.payments?.Credit || undefined,
        notes: data.notes || undefined,
      }).catch(() => {});
    }
  }, [products, movements, saveProducts, saveMovements, toast, activeShopId, logAudit]);

  const handlePurchase = useCallback((data) => {
    if (!products || !movements) return;
    const updated = products.map((p) => (p.id === data.productId ? { ...p, stock: p.stock + data.qty, buyPrice: data.buyPrice, sellPrice: data.newSellPrice || p.sellPrice, supplier: data.supplier || p.supplier } : p));
    saveProducts(updated);
    const sel = products.find((p) => p.id === data.productId);
    saveMovements([...movements, {
      id: "m" + uid(), shopId: activeShopId, productId: data.productId, productName: sel?.name || "", type: "PURCHASE",
      qty: data.qty, unitPrice: data.buyPrice, sellingPrice: data.newSellPrice || sel?.sellPrice,
      total: data.total, gstAmount: data.gstAmount, profit: null,
      supplier: data.supplier, supplierName: data.supplier, invoiceNo: data.invoiceNo,
      payment: data.payment, paymentMode: data.payment, creditDays: data.creditDays,
      paymentStatus: data.payment === "Credit" ? "pending" : "paid",
      note: [data.supplier && `Supplier: ${data.supplier}`, data.payment === "Credit" && `Credit ${data.creditDays}d`, data.notes].filter(Boolean).join(" · ") || "Stock purchase",
      date: data.date,
    }]);
    logAudit("PURCHASE_RECORDED", "movement", data.invoiceNo, `+${data.qty} ${sel?.name?.slice(0, 20)} · ${fmt(data.total)}`);
    toast(`Stock added: +${data.qty} units · ${fmt(data.total)}`, "info", "Purchase Recorded");
    // Persist to backend (fire-and-forget)
    syncPurchase({
      inventoryId: data.productId,
      qty: data.qty,
      buyingPrice: data.buyPrice,
      newSellingPrice: data.newSellPrice,
      supplier: data.supplier,
      invoiceNo: data.invoiceNo,
      payment: data.payment,
      creditDays: data.creditDays,
      notes: data.notes,
    }).catch(() => {});
  }, [products, movements, saveProducts, saveMovements, toast, activeShopId, logAudit]);

  const handleAdjustment = useCallback((data) => {
    if (!products || !movements) return;
    const sel = products.find((p) => p.id === data.productId);
    const stockChange = data.stockDirection * data.qty;
    if (stockChange !== 0) saveProducts(products.map((p) => (p.id === data.productId ? { ...p, stock: Math.max(0, p.stock + stockChange) } : p)));
    const lossAmount = (data.adjustType === "DAMAGE" || data.adjustType === "THEFT") ? (sel?.buyPrice || 0) * data.qty : 0;
    saveMovements([...movements, {
      id: "m" + uid(), shopId: activeShopId, productId: data.productId, productName: sel?.name || "",
      type: data.adjustType, qty: data.qty, unitPrice: sel?.buyPrice || 0, sellingPrice: sel?.sellPrice || 0,
      total: data.refundAmount || lossAmount || 0, gstAmount: 0,
      profit: data.adjustType === "RETURN_IN" ? -(data.refundAmount || 0) : data.adjustType === "DAMAGE" || data.adjustType === "THEFT" ? -lossAmount : 0,
      customerName: data.adjustType === "RETURN_IN" ? "Customer Return" : null,
      supplier: data.supplierName || null, supplierName: data.supplierName || null,
      invoiceNo: data.originalInvoice || null,
      payment: data.refundMethod || data.adjustType, paymentStatus: "completed",
      note: [data.reason && `Reason: ${data.reason}`, data.reasonDetail, data.adjustType === "AUDIT" && `Audit: ${data.previousStock} → ${data.previousStock + stockChange}`, data.notes].filter(Boolean).join(" · ") || `Stock ${data.adjustType.toLowerCase()}`,
      date: data.date,
      adjustmentMeta: { type: data.adjustType, previousStock: data.previousStock, newStock: (data.previousStock || 0) + stockChange, reason: data.reason, refundMethod: data.refundMethod },
    }]);
    const labels = { RETURN_IN: "Customer return processed", RETURN_OUT: "Returned to vendor", CREDIT_NOTE: "Credit note issued", DEBIT_NOTE: "Debit note issued", DAMAGE: "Damage recorded", THEFT: "Shrinkage recorded", AUDIT: "Audit correction applied", OPENING: "Opening stock set" };
    logAudit("ADJUSTMENT_" + data.adjustType, "movement", data.productId, `${labels[data.adjustType] || data.adjustType}: ${stockChange > 0 ? "+" : ""}${stockChange} units`);
    toast(`${labels[data.adjustType] || data.adjustType}: ${stockChange !== 0 ? (stockChange > 0 ? "+" : "") + stockChange + " units of " : ""}${sel?.name?.slice(0, 20) || "product"}${data.refundAmount ? " · " + fmt(data.refundAmount) : ""}`, data.adjustType === "RETURN_IN" || data.adjustType === "OPENING" ? "info" : data.adjustType === "CREDIT_NOTE" || data.adjustType === "DEBIT_NOTE" ? "success" : "warning", labels[data.adjustType] || data.adjustType);
    // Persist to backend (fire-and-forget)
    // For AUDIT type, pass the signed stockChange so the backend applies the correct direction.
    // For all other types the direction is implied by the type (e.g. DAMAGE is always negative).
    syncAdjustment({
      inventoryId: data.productId,
      type: data.adjustType,
      qty: data.adjustType === "AUDIT" ? stockChange : data.qty,
      reason: data.reason,
      refundMethod: data.refundMethod,
      refundAmount: data.refundAmount,
      supplierName: data.supplierName,
      originalInvoice: data.originalInvoice,
      notes: data.notes,
    }).catch(() => {});
  }, [products, movements, saveProducts, saveMovements, toast, activeShopId, logAudit]);

  const handlePaymentReceipt = useCallback((data) => {
    if (!movements) return;
    const receiptMovement = {
      id: "m" + uid(), shopId: activeShopId, productId: null, productName: "",
      type: "RECEIPT", qty: 0, unitPrice: 0, sellingPrice: 0,
      total: data.amount, gstAmount: 0, profit: 0,
      customerName: data.partyName, customerPhone: data.partyPhone,
      payment: data.paymentMode, paymentMode: data.paymentMode, paymentStatus: "paid",
      note: `Payment received: ${fmt(data.amount)} from ${data.partyName} via ${data.paymentMode}. ${data.notes || ""}`.trim(),
      date: Date.now(),
    };
    let updatedMovements = movements.map((m) => {
      if (data.movementIds && data.movementIds.length > 0) {
        if (data.movementIds.includes(m.id)) return { ...m, paymentStatus: "paid" };
      } else if (m.customerName === data.partyName && m.paymentStatus === "pending") {
        return { ...m, paymentStatus: "paid" };
      }
      return m;
    });
    saveMovements([...updatedMovements, receiptMovement]);
    logAudit("RECEIPT_RECORDED", "receipt", data.partyName, `${fmt(data.amount)} via ${data.paymentMode}`);
    toast(`Payment received: ${fmt(data.amount)} from ${data.partyName}`, "success", "Receipt Recorded");
  }, [movements, saveMovements, activeShopId, logAudit, toast]);

  // ── Shared context value for shell components ──
  // useMemo keeps the object reference stable when values haven't changed,
  // preventing unnecessary re-renders in context consumers.
  const appCtxValue = useMemo(() => ({
    pModal, setPModal,
    catalogModal, setCatalogModal,
    toast, toasts, removeToast,
    currentUser, handleLogout,
    syncStatus, syncNow,
    openSyncCenter,
    syncCenterOpen, setSyncCenterOpen,
    syncQueueItems, syncActionBusy, syncItemBusy,
    handleRetrySyncItem, handleDiscardSyncItem,
    saveProduct, handleBulkStockIn,
  }), [
    pModal, setPModal,
    catalogModal, setCatalogModal,
    toast, toasts, removeToast,
    currentUser, handleLogout,
    syncStatus, syncNow,
    openSyncCenter,
    syncCenterOpen, setSyncCenterOpen,
    syncQueueItems, syncActionBusy, syncItemBusy,
    handleRetrySyncItem, handleDiscardSyncItem,
    saveProduct, handleBulkStockIn,
  ]);

  // ── Loading state — skeletal screen, no spinner ──
  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.ui }}>
        <style>{GLOBAL_CSS}</style>
        {/* Topbar skeleton */}
        <div style={{ height: 56, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
          <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          <div className="skeleton-shimmer" style={{ width: 120, height: 14, borderRadius: 6 }} />
          <div style={{ flex: 1 }} />
          <div className="skeleton-shimmer" style={{ width: 80, height: 28, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8 }} />
        </div>
        <div style={{ padding: "32px 28px", maxWidth: 900 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: "22%", borderRadius: 8, marginBottom: 24 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 90, borderRadius: 12 }} />)}
          </div>
          <div className="skeleton-shimmer" style={{ height: 260, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  // ========== ROUTE TREE ==========
  return (
    <AppCtx.Provider value={appCtxValue}>
      {/* Suspense catches lazy-loaded pages while their JS chunk downloads.
          The fallback renders inside the already-mounted shell so the sidebar
          and topbar stay visible — no full-page flash. */}
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage key="login" mode="login" onLogin={handleLogin} />} />
        <Route path="/signup" element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage key="signup" mode="signup" onLogin={handleLogin} />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* MVP routes */}
        <Route path="/dashboard" element={currentUser ? <ERPShell><DashboardPage products={products} movements={movements} orders={orders} activeShopId={activeShopId} onNavigate={(p) => navigate("/" + p)} jobCards={jobCards} parties={parties} vehicles={vehicles} /></ERPShell> : <Navigate to="/login" replace />} />
        <Route path="/inventory" element={currentUser ? <ERPShell><InventoryPage products={products} movements={movements} activeShopId={activeShopId} onAdd={() => setCatalogModal(true)} onEdit={(p) => setPModal({ open: true, product: p })} onSale={handleSale} onPurchase={handlePurchase} onAdjust={handleAdjustment} toast={toast} /></ERPShell> : <Navigate to="/login" replace />} />
        <Route path="/billing" element={currentUser ? <ERPShell><POSBillingPage products={products} activeShopId={activeShopId} onMultiSale={handleMultiItemSale} toast={toast} /></ERPShell> : <Navigate to="/login" replace />} />
        <Route path="/history" element={currentUser ? <ERPShell><HistoryPage movements={movements} activeShopId={activeShopId} /></ERPShell> : <Navigate to="/login" replace />} />
        <Route path="/reports" element={currentUser ? <ERPShell><ReportsPage movements={movements} products={products} activeShopId={activeShopId} receipts={receipts} saveReceipts={saveReceipts} onPaymentReceipt={handlePaymentReceipt} toast={toast} /></ERPShell> : <Navigate to="/login" replace />} />

        {/* Out-of-scope routes — redirect into MVP */}
        <Route path="/parties" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/workshop" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/orders" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/marketplace" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/marketplace/orders" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/marketplace/pricing" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/marketplace/checkout" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/profile" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/settings" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route path="/admin" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />

        {/* Landing page — always public, logged-in users get an "Open App" nav */}
        <Route path="/" element={<LandingPage currentUser={currentUser} />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
      </Routes>
      </Suspense>

      {/* Global overlays */}
      <ShortcutOverlay open={shortcutOverlay} onClose={() => setShortcutOverlay(false)} />
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} onNavigate={(path) => navigate(path)} />
    </AppCtx.Provider>
  );
}

// ========== EXPORT WITH ERROR BOUNDARY ==========
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
