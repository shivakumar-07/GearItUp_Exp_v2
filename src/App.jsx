import { useState, useCallback, Component } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { T, FONT, GLOBAL_CSS } from "./theme";
import { fmt, uid } from "./utils";
import { useStore } from "./store";
import { Toast, useToast, Btn } from "./components/ui";
import { setTokens } from "./api/client.js";

// Components
import { RequireAuth, getDefaultRoute } from "./components/RequireAuth";
import { ProfileDropdown } from "./components/ProfileDropdown";
import { Avatar } from "./components/Avatar";
import { ProductModal } from "./components/ProductModal";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";

// ERP Pages
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { POSBillingPage } from "./pages/POSBillingPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ReportsPage } from "./pages/ReportsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PartiesPage } from "./pages/PartiesPage";
import { WorkshopPage } from "./pages/WorkshopPage";
import { PricingPage } from "./pages/PricingPage";

// Marketplace Pages
import { MarketplaceHome } from "./marketplace/pages/MarketplaceHome";
import { ProductDetailsPage } from "./marketplace/pages/ProductDetailsPage";
import { CheckoutPage } from "./marketplace/pages/CheckoutPage";
import { OrderTrackingPage } from "./marketplace/pages/OrderTrackingPage";
import { AdminPage } from "./marketplace/pages/AdminPage";
import { CartDrawer } from "./marketplace/components/CartDrawer";

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
  { key: "parties", path: "/parties", icon: "👥", label: "Parties" },
  { key: "workshop", path: "/workshop", icon: "🔧", label: "Workshop" },
  { key: "history", path: "/history", icon: "⊞", label: "History" },
  { key: "reports", path: "/reports", icon: "📊", label: "Reports" },
  { key: "orders", path: "/orders", icon: "◎", label: "Orders" },
];

const MP_NAV = [
  { key: "home", path: "/marketplace", icon: "🏠", label: "Home", color: "#10B981" },
  { key: "orders", path: "/marketplace/orders", icon: "📦", label: "Orders", color: "#0EA5E9" },
  { key: "pricing", path: "/marketplace/pricing", icon: "💎", label: "Pricing", color: "#D97706" },
];

// ========== MAIN APP COMPONENT ==========
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

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
    } catch {}
    return null;
  });

  // ── Store (always called — hooks rule) ──
  const {
    products, movements, orders, shops, parties, vehicles, jobCards,
    saveProducts, saveMovements, saveOrders, saveShops, saveParties, saveVehicles, saveJobCards,
    auditLog, receipts, saveReceipts,
    loaded, activeShopId, logAudit, resetAll,
  } = useStore();

  // ── UI state ──
  const [pModal, setPModal] = useState({ open: false, product: null });
  const { items: toasts, add: toast, remove: removeToast } = useToast();
  const [shopEdit, setShopEdit] = useState(null);

  // ── Auth handlers ──
  const handleLogin = useCallback((user) => {
    setCurrentUser(user);
    const dest = getDefaultRoute(user?.role);
    navigate(dest, { replace: true });
  }, [navigate]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("as_user");
    localStorage.removeItem("as_refresh_token");
    setCurrentUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  // ── Business handlers (same as before, used by ERP pages) ──
  const saveProduct = useCallback((p) => {
    if (!products) return;
    const exists = products.find((x) => x.id === p.id);
    saveProducts(exists ? products.map((x) => (x.id === p.id ? p : x)) : [...products, p]);
    logAudit(exists ? "PRODUCT_UPDATED" : "PRODUCT_CREATED", "product", p.id, `${p.name} (${p.sku})`);
  }, [products, saveProducts, logAudit]);

  const handleSale = useCallback((data) => {
    if (!products || !movements) return;
    const isQuote = data.type === "Quotation";
    if (!isQuote) {
      saveProducts(products.map((p) => (p.id === data.productId ? { ...p, stock: Math.max(0, p.stock - data.qty) } : p)));
    }
    const sel = products.find((p) => p.id === data.productId);
    const isCredit = data.paymentMode === "Udhaar" || (data.payments && data.payments.Credit > 0);
    const paymentStr = data.payments ? Object.entries(data.payments).filter(([_, a]) => a > 0).map(([k, a]) => `${k}:${a}`).join(", ") : data.payment;
    saveMovements([...movements, {
      id: "m" + uid(), shopId: activeShopId, productId: data.productId, productName: sel?.name || "",
      type: isQuote ? "ESTIMATE" : "SALE", qty: data.qty, unitPrice: data.sellPrice, sellingPrice: data.sellPrice,
      total: data.total, gstAmount: data.gstAmount, profit: isQuote ? 0 : data.profit,
      discount: data.discount, customerName: data.customerName, customerPhone: data.customerPhone,
      vehicleReg: data.vehicleReg, mechanic: data.mechanic, supplier: null, invoiceNo: data.invoiceNo,
      payment: paymentStr, paymentMode: data.paymentMode || null, creditDays: 0, paymentStatus: isCredit && !isQuote ? "pending" : "paid",
      note: [data.customerName && `Customer: ${data.customerName}`, data.vehicleReg && `Vehicle: ${data.vehicleReg}`, data.notes].filter(Boolean).join(" · ") || (isQuote ? "Quotation generated" : "Walk-in sale"),
      date: data.date, ...(data.priceOverride && { priceOverride: data.priceOverride }),
    }]);
    logAudit(isQuote ? "QUOTATION_CREATED" : "SALE_RECORDED", "movement", data.invoiceNo, `${data.qty}×${sel?.name?.slice(0, 20)} · ${fmt(data.total)}`);
    if (data.priceOverride) logAudit("PRICE_OVERRIDE", "movement", data.invoiceNo, `${sel?.name?.slice(0, 20)}: ${fmt(data.priceOverride.originalPrice)} → ${fmt(data.priceOverride.overriddenPrice)} (${data.priceOverride.reason || "no reason"})`);
    toast(isQuote ? `Quotation Generated: ${data.invoiceNo}` : `Sale recorded: ${data.qty}×${sel?.name?.slice(0, 20) || "product"} · ${fmt(data.total)}`, isQuote ? "info" : "success", isQuote ? "Estimate Saved" : "Sale Complete");
  }, [products, movements, saveProducts, saveMovements, toast, activeShopId, logAudit]);

  const handleMultiItemSale = useCallback((data) => {
    if (!products || !movements) return;
    const isQuote = data.type === "Quotation";
    const newMovements = [];
    let updatedProducts = [...products];
    let hasOverrides = false;
    data.items.forEach((item) => {
      if (!isQuote) updatedProducts = updatedProducts.map((p) => (p.id === item.productId ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p));
      const isCredit = data.paymentMode === "Udhaar" || (data.payments && data.payments.Credit > 0);
      const paymentStr = data.payments ? Object.entries(data.payments).filter(([_, a]) => a > 0).map(([k, a]) => `${k}:${a}`).join(", ") : "";
      newMovements.push({
        id: "m" + uid(), shopId: activeShopId, productId: item.productId, productName: item.name,
        type: isQuote ? "ESTIMATE" : "SALE", qty: item.qty, unitPrice: item.sellPrice, sellingPrice: item.sellPrice,
        total: item.total, gstAmount: item.gstAmount, profit: isQuote ? 0 : item.profit,
        discount: item.discount, customerName: data.customerName, customerPhone: data.customerPhone,
        vehicleReg: data.vehicleReg, mechanic: data.mechanic, supplier: null, invoiceNo: data.invoiceNo,
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

  // ── Computed values ──
  const todaySales = (movements || []).filter((m) => m.shopId === activeShopId && m.type === "SALE" && m.date >= Date.now() - 86400000);
  const todayRev = todaySales.reduce((s, m) => s + m.total, 0);
  const stockSt = (p) => { if (p.stock <= 0) return "out"; if (p.stock < p.minStock) return "low"; return "ok"; };
  const lowCount = (products || []).filter((p) => p.shopId === activeShopId && stockSt(p) !== "ok").length;
  const pendingOrders = (orders || []).filter((o) => o.shopId === activeShopId && (o.status === "NEW" || o.status === "placed")).length;
  const shop = (shops || []).find((s) => s.id === activeShopId) || { name: "My Shop", city: "Location" };
  const currentPath = location.pathname;

  // ── Loading state ──
  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.ui }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42, animation: "pulse 1.5s infinite", marginBottom: 16 }}>⚙️</div>
          <div style={{ color: T.t3, fontSize: 14 }}>Loading AutoSpace…</div>
        </div>
        <style>{GLOBAL_CSS}</style>
      </div>
    );
  }

  // ========== ERP SHELL (sidebar+topbar for shop owner) ==========
  const ERPShell = ({ children }) => (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, color: T.t1 }}>
      <style>{GLOBAL_CSS}</style>

      {/* TOPBAR */}
      <div style={{ height: 56, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 20px 0 88px", position: "sticky", top: 0, zIndex: 500, gap: 10, boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 1px 0 ${T.border}` }}>
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
        {todayRev > 0 && (<div style={{ background: T.emeraldBg, border: `1px solid ${T.emerald}33`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.emerald, fontWeight: 700, fontFamily: FONT.mono, display: "flex", alignItems: "center", gap: 6 }}>📈 Today: {fmt(todayRev)}</div>)}
        {lowCount > 0 && (<button onClick={() => navigate("/inventory")} style={{ background: T.crimsonBg, border: `1px solid ${T.crimson}33`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.crimson, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 5 }}>⚠ {lowCount} alert{lowCount > 1 ? "s" : ""}</button>)}
        <Btn size="sm" variant="ghost" onClick={() => navigate("/billing")} style={{ borderColor: T.border }}>🧾 POS</Btn>
        <Btn size="sm" variant="amber" onClick={() => setPModal({ open: true, product: null })}>＋ Product</Btn>
        <button onClick={() => { if (confirm("Reset all data to defaults?")) resetAll(); }} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.t3, cursor: "pointer", fontWeight: 600, fontFamily: FONT.ui }}>🔄</button>
        <ProfileDropdown user={currentUser} onLogout={handleLogout} />
      </div>

      {/* PAGE */}
      <div style={{ padding: "24px 28px 24px 92px", maxWidth: 1440, margin: "0 auto" }}>
        {children}
      </div>

      <ProductModal open={pModal.open} product={pModal.product} activeShopId={activeShopId} onClose={() => setPModal({ open: false, product: null })} onSave={saveProduct} toast={toast} />
      <Toast items={toasts} onRemove={removeToast} />

      {/* LEFT SIDEBAR */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 68, zIndex: 600, background: `${T.surface}f5`, backdropFilter: "blur(16px)", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, gap: 2 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${T.amber},${T.amberDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: "#000", boxShadow: `0 2px 12px ${T.amber}55`, marginBottom: 4 }}>{shop.name?.charAt(0) || "S"}</div>
        <div style={{ fontSize: 7, color: T.amber, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>ERP</div>
        {NAV_ITEMS.map((n) => {
          const isActive = currentPath === n.path || currentPath.startsWith(n.path + "/");
          return (
            <button key={n.key} onClick={() => navigate(n.path)} title={n.label} style={{ width: 58, height: 46, borderRadius: 10, border: `1px solid ${isActive ? T.amber + "44" : "transparent"}`, cursor: "pointer", background: isActive ? T.amberGlow : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, transition: "all 0.15s", padding: "2px 0", position: "relative" }}>
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span style={{ fontSize: 7, fontWeight: 700, color: isActive ? T.amber : T.t3, fontFamily: FONT.ui, letterSpacing: "0.02em" }}>{n.label}</span>
              {n.key === "orders" && pendingOrders > 0 && <span style={{ position: "absolute", top: 2, right: 6, background: T.crimson, color: "#fff", fontSize: 8, borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{pendingOrders}</span>}
              {n.key === "inventory" && lowCount > 0 && <span style={{ position: "absolute", top: 2, right: 6, background: T.amber, color: "#000", fontSize: 8, borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{lowCount}</span>}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
      </div>
    </div>
  );

  // ========== MARKETPLACE SHELL ==========
  const MPShell = ({ children }) => (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ paddingLeft: 68 }}>{children}</div>
      <CartDrawer onCheckout={() => navigate("/marketplace/checkout")} />
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 68, zIndex: 400, background: `${T.surface}ee`, backdropFilter: "blur(12px)", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${T.amber},${T.amberDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 2px 12px ${T.amber}55`, marginBottom: 8 }}>⚙️</div>
        <div style={{ fontSize: 7, color: T.amber, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Market</div>
        {MP_NAV.map((a) => {
          const isActive = currentPath === a.path;
          return (
            <button key={a.key} onClick={() => navigate(a.path)} title={a.label} style={{ width: 58, height: 50, borderRadius: 10, border: `1px solid ${isActive ? a.color + "44" : T.border}`, cursor: "pointer", background: isActive ? `${a.color}22` : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, transition: "all 0.15s", padding: "4px 0" }}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? a.color : T.t3, fontFamily: FONT.ui, letterSpacing: "0.02em" }}>{a.label}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
      </div>
      <Toast items={toasts} onRemove={removeToast} />
    </>
  );

  // ========== ADMIN SHELL ==========
  const AdminShell = ({ children }) => (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ paddingLeft: 68 }}>{children}</div>
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 68, zIndex: 400, background: `${T.surface}ee`, backdropFilter: "blur(12px)", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20, gap: 4 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 4px 16px rgba(79,70,229,0.4)", marginBottom: 12 }}>🛡️</div>
        <div style={{ fontSize: 7, color: "#A78BFA", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Admin</div>
        <div style={{ flex: 1 }} />
      </div>
      <Toast items={toasts} onRemove={removeToast} />
    </>
  );

  // ========== ROUTE TREE ==========
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={currentUser ? <Navigate to={getDefaultRoute(currentUser.role)} replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ERP routes — SHOP_OWNER */}
      <Route path="/dashboard" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><DashboardPage products={products} movements={movements} orders={orders} activeShopId={activeShopId} onNavigate={(p) => navigate("/" + p)} jobCards={jobCards} parties={parties} vehicles={vehicles} /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
      <Route path="/inventory" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><InventoryPage products={products} movements={movements} activeShopId={activeShopId} onAdd={() => setPModal({ open: true, product: null })} onEdit={(p) => setPModal({ open: true, product: p })} onSale={handleSale} onPurchase={handlePurchase} onAdjust={handleAdjustment} toast={toast} /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
      <Route path="/billing" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><POSBillingPage products={products} activeShopId={activeShopId} onMultiSale={handleMultiItemSale} toast={toast} /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
      <Route path="/parties" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><PartiesPage parties={parties} movements={movements} vehicles={vehicles} activeShopId={activeShopId} onSaveParty={(p) => { const exists = (parties || []).find((x) => x.id === p.id); saveParties(exists ? parties.map((x) => (x.id === p.id ? p : x)) : [...(parties || []), p]); logAudit(exists ? "PARTY_UPDATED" : "PARTY_CREATED", "party", p.id, p.name); }} onSaveVehicle={(v) => { const exists = (vehicles || []).find((x) => x.id === v.id); saveVehicles(exists ? vehicles.map((x) => (x.id === v.id ? v : x)) : [...(vehicles || []), v]); }} toast={toast} /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
      <Route path="/workshop" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><WorkshopPage jobCards={jobCards} vehicles={vehicles} parties={parties} products={products} activeShopId={activeShopId} onSaveJobCard={(jc) => { const exists = (jobCards || []).find((x) => x.id === jc.id); saveJobCards(exists ? jobCards.map((x) => (x.id === jc.id ? jc : x)) : [...(jobCards || []), jc]); logAudit(exists ? "JOB_CARD_UPDATED" : "JOB_CARD_CREATED", "job_card", jc.id, `${jc.jobNumber} — ${jc.status}`); }} toast={toast} /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
      <Route path="/history" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><HistoryPage movements={movements} activeShopId={activeShopId} /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
      <Route path="/reports" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><ReportsPage movements={movements} products={products} activeShopId={activeShopId} receipts={receipts} saveReceipts={saveReceipts} onPaymentReceipt={handlePaymentReceipt} toast={toast} /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
      <Route path="/orders" element={currentUser?.role === "SHOP_OWNER" ? <ERPShell><OrdersPage /></ERPShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />

      {/* Marketplace routes — CUSTOMER or any authenticated user */}
      <Route path="/marketplace" element={currentUser ? <MPShell><MarketplaceHome /></MPShell> : <Navigate to="/login" replace />} />
      <Route path="/marketplace/orders" element={currentUser ? <MPShell><OrderTrackingPage onBack={() => navigate("/marketplace")} /></MPShell> : <Navigate to="/login" replace />} />
      <Route path="/marketplace/pricing" element={currentUser ? <MPShell><PricingPage onBack={() => navigate("/marketplace")} /></MPShell> : <Navigate to="/login" replace />} />
      <Route path="/marketplace/checkout" element={currentUser ? <MPShell><CheckoutPage onBack={() => navigate("/marketplace")} onOrderPlaced={() => navigate("/marketplace/orders")} /></MPShell> : <Navigate to="/login" replace />} />

      {/* Profile & Settings (authenticated) */}
      <Route path="/profile" element={currentUser ? <ProfilePage user={currentUser} onUserUpdate={(u) => setCurrentUser(u)} /> : <Navigate to="/login" replace />} />
      <Route path="/settings" element={currentUser ? <SettingsPage onLogout={handleLogout} /> : <Navigate to="/login" replace />} />

      {/* Admin */}
      <Route path="/admin" element={currentUser?.role === "PLATFORM_ADMIN" ? <AdminShell><AdminPage /></AdminShell> : <Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />

      {/* Catch-all: redirect to user's default route */}
      <Route path="*" element={<Navigate to={currentUser ? getDefaultRoute(currentUser.role) : "/login"} replace />} />
    </Routes>
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
