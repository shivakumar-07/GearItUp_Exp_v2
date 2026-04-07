import { useState, useMemo } from "react";
import { T, FONT } from "../theme";
import { CATEGORIES, stockStatus, margin, fmt, downloadCSV, generateCSV } from "../utils";
import { Badge, Btn, Input, Select } from "../components/ui";
import { PurchaseModal } from "../components/PurchaseModal";
import { SaleModal } from "../components/SaleModal";
import { StockAdjustmentModal } from "../components/StockAdjustmentModal";
import { printBarcodeLabels } from "../barcode";
import { MANUFACTURERS, getModelsForMfg, getYearsForModel, buildVehicleMatchStr, isProductCompatible } from "../vehicleData";

export function InventoryPage({ products, movements, activeShopId, onAdd, onEdit, onSale, onPurchase, onAdjust, toast }) {
    const [search, setSearch] = useState("");
    const [cat, setCat] = useState("All");
    const [statusF, setStatusF] = useState("All");
    const [sortBy, setSortBy] = useState("name");
    const [saleP, setSaleP] = useState(null);
    const [purchP, setPurchP] = useState(null);
    const [adjP, setAdjP] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [showVehicleFilter, setShowVehicleFilter] = useState(false);
    const [visibleCount, setVisibleCount] = useState(50);
    // Vehicle selection state: Brand → Model → Year
    const [selBrand, setSelBrand] = useState("");
    const [selModel, setSelModel] = useState("");
    const [selYear, setSelYear] = useState("");

    const brandModels = useMemo(() => selBrand ? getModelsForMfg(selBrand) : [], [selBrand]);
    const modelYears = useMemo(() => selModel ? getYearsForModel(selModel) : [], [selModel]);
    const vehicleMatchStr = useMemo(() => buildVehicleMatchStr(selBrand, selModel), [selBrand, selModel]);

    const shopProducts = useMemo(() => products.filter(p => p.shopId === activeShopId), [products, activeShopId]);

    const filtered = useMemo(() => {
        let list = shopProducts
            .filter(p => cat === "All" || p.category === cat)
            .filter(p => statusF === "All" || stockStatus(p) === statusF)
            .filter(p => !search || [p.name, p.sku, p.brand, p.supplier, p.oemNumber].some(s => (s || "").toLowerCase().includes(search.toLowerCase())));

        // Vehicle compatibility filter
        if (vehicleMatchStr) {
            list = list.filter(p => {
                const compat = isProductCompatible(p, vehicleMatchStr);
                return compat === "compatible" || compat === "universal";
            });
        }

        return list.sort((a, b) => {
            // If vehicle selected, sort compatible first, then universal
            if (vehicleMatchStr) {
                const ca = isProductCompatible(a, vehicleMatchStr);
                const cb = isProductCompatible(b, vehicleMatchStr);
                if (ca === "compatible" && cb !== "compatible") return -1;
                if (cb === "compatible" && ca !== "compatible") return 1;
            }
            if (sortBy === "profit") return (b.sellPrice - b.buyPrice) - (a.sellPrice - a.buyPrice);
            if (sortBy === "margin") return +margin(b.buyPrice, b.sellPrice) - +margin(a.buyPrice, a.sellPrice);
            if (sortBy === "stock") return a.stock - b.stock;
            if (sortBy === "value") return b.buyPrice * b.stock - a.buyPrice * a.stock;
            if (sortBy === "sell") return b.sellPrice - a.sellPrice;
            return a.name.localeCompare(b.name);
        });
    }, [shopProducts, cat, statusF, search, sortBy, vehicleMatchStr]);

    // Last 7-day sales count per product
    const sevenDayCutoff = Date.now() - 7 * 86400000;
    const salesLast7d = useMemo(() => {
        const map = {};
        (movements || []).forEach(m => {
            if (m.type === "SALE" && m.shopId === activeShopId && m.date >= sevenDayCutoff) {
                map[m.productId] = (map[m.productId] || 0) + m.qty;
            }
        });
        return map;
    }, [movements, activeShopId, sevenDayCutoff]);

    const counts = {
        out: shopProducts.filter(p => p.stock <= 0).length,
        low: shopProducts.filter(p => p.stock > 0 && p.stock < p.minStock).length,
    };

    const handleGeneratePO = () => {
        const lowItems = shopProducts.filter(p => p.stock < p.minStock);
        if (lowItems.length === 0) {
            toast?.("No items below minimum stock!", "info");
            return;
        }
        // Group by supplier for real PO generation
        const bySupplier = {};
        lowItems.forEach(p => {
            const supplier = p.supplier || "Unknown Supplier";
            if (!bySupplier[supplier]) bySupplier[supplier] = [];
            const reorderQty = Math.max(p.minStock * 2 - p.stock, p.minStock);
            bySupplier[supplier].push({ ...p, reorderQty, estimatedCost: reorderQty * p.buyPrice });
        });
        // Generate CSV
        const headers = ["Supplier", "Product", "SKU", "Category", "Current Stock", "Min Stock", "Reorder Qty", "Buy Price", "Estimated Cost"];
        const rows = [];
        Object.entries(bySupplier).forEach(([supplier, items]) => {
            items.forEach(p => {
                rows.push([supplier, p.name, p.sku, p.category, p.stock, p.minStock, p.reorderQty, p.buyPrice, p.estimatedCost]);
            });
        });
        const totalCost = rows.reduce((s, r) => s + r[8], 0);
        rows.push(["", "", "", "", "", "", "TOTAL:", "", totalCost]);
        const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s/g, "_");
        downloadCSV(`Draft_PO_${dateStr}.csv`, generateCSV(headers, rows));
        toast?.(`Draft PO generated: ${lowItems.length} items across ${Object.keys(bySupplier).length} suppliers · ${fmt(totalCost)} estimated cost`, "success", "📦 PO Downloaded");
    };

    return (
        <div className="page-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 🚗 Vehicle Selector Bar */}
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 16px" }}>
                {/* Pill trigger row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {vehicleMatchStr ? (
                        <button onClick={() => { setSelBrand(""); setSelModel(""); setSelYear(""); setShowVehicleFilter(false); }}
                            style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 20, border: `1px solid ${T.amber}`, background: T.amberGlow, color: T.amber, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.15s ease" }}>
                            🚗 {vehicleMatchStr}{selYear ? ` ${selYear}` : ""} <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
                        </button>
                    ) : (
                        <button onClick={() => setShowVehicleFilter(v => !v)}
                            style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 20, border: `1px solid ${showVehicleFilter ? T.amber : T.border}`, background: showVehicleFilter ? T.amberSoft : "transparent", color: showVehicleFilter ? T.amber : T.t2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.15s ease" }}>
                            🚗 Filter by Vehicle {showVehicleFilter ? "▲" : "▼"}
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 11, color: T.t4 }}>{MANUFACTURERS.length} brands · {filtered.length} parts found</div>
                </div>

                {/* Collapsible dropdowns panel */}
                {showVehicleFilter && !vehicleMatchStr && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, animation: "fadeIn 0.15s ease" }}>
                        {/* Brand */}
                        <select value={selBrand} onChange={e => { setSelBrand(e.target.value); setSelModel(""); setSelYear(""); }}
                            style={{ background: T.surface, border: `1px solid ${selBrand ? T.amber + "66" : T.border}`, borderRadius: 8, padding: "7px 12px", color: selBrand ? T.t1 : T.t3, fontSize: 12, fontWeight: 600, fontFamily: FONT.ui, cursor: "pointer", minWidth: 150, outline: "none" }}>
                            <option value="">Select Brand</option>
                            {MANUFACTURERS.map(m => <option key={m.id} value={m.id}>{m.logo} {m.name}</option>)}
                        </select>

                        {/* Model — only after Brand */}
                        {selBrand && (
                            <select value={selModel} onChange={e => { setSelModel(e.target.value); setSelYear(""); }}
                                style={{ background: T.surface, border: `1px solid ${selModel ? T.amber + "66" : T.border}`, borderRadius: 8, padding: "7px 12px", color: selModel ? T.t1 : T.t3, fontSize: 12, fontWeight: 600, fontFamily: FONT.ui, cursor: "pointer", minWidth: 150, outline: "none" }}>
                                <option value="">Select Model</option>
                                {brandModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        )}

                        {/* Year — only after Brand + Model */}
                        {selBrand && selModel && (
                            <select value={selYear} onChange={e => setSelYear(e.target.value)}
                                style={{ background: T.surface, border: `1px solid ${selYear ? T.amber + "66" : T.border}`, borderRadius: 8, padding: "7px 12px", color: selYear ? T.t1 : T.t3, fontSize: 12, fontWeight: 600, fontFamily: FONT.ui, cursor: "pointer", minWidth: 90, outline: "none" }}>
                                <option value="">Year</option>
                                {modelYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        )}

                        {selBrand && (
                            <button onClick={() => { setSelBrand(""); setSelModel(""); setSelYear(""); }}
                                style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 12px", color: T.t3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.ui }}>
                                ✕ Clear
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
                    <Input value={search} onChange={setSearch} placeholder="Search name, SKU, brand, supplier…" icon="🔍" />
                    {search && (
                        <button onClick={() => setSearch("")} style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
                            width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", color: T.t3, fontSize: 12, fontFamily: FONT.ui,
                        }}>×</button>
                    )}
                </div>
                <Select value={sortBy} onChange={setSortBy} style={{ width: 180 }} options={[
                    { value: "name", label: "Sort: Name" },
                    { value: "profit", label: "Sort: Profit/unit ↓" },
                    { value: "margin", label: "Sort: Margin % ↓" },
                    { value: "stock", label: "Sort: Stock (low first)" },
                    { value: "value", label: "Sort: Inventory Value ↓" },
                    { value: "sell", label: "Sort: Sell Price ↓" },
                ]} />
                {(counts.low + counts.out) > 0 && (
                    <Btn variant="sky" size="sm" onClick={handleGeneratePO}>
                        📦 Generate Draft PO ({counts.low + counts.out})
                    </Btn>
                )}
                <Btn variant="subtle" size="sm" onClick={() => {
                    if (filtered.length === 0) { toast?.("No products to print labels for!", "info"); return; }
                    printBarcodeLabels(filtered.slice(0, 30));
                    toast?.(`Printing barcode labels for ${Math.min(filtered.length, 30)} products`, "success", "🏷️ Labels");
                }}>🏷️ Print Labels</Btn>
                <Btn onClick={onAdd} size="sm">＋ Add Product</Btn>
            </div>

            {/* Category chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: T.t3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: FONT.ui, marginRight: 2 }}>Category:</span>
                {["All", ...CATEGORIES].map(c => (
                    <button key={c} onClick={() => setCat(c)} style={{
                        padding: "4px 12px", borderRadius: 20, border: `1px solid ${c === cat ? T.amber : T.border}`,
                        background: c === cat ? T.amberSoft : "transparent",
                        color: c === cat ? T.amber : T.t2,
                        fontSize: 12, cursor: "pointer", transition: "all 0.15s ease", fontFamily: FONT.ui
                    }}>{c === "All" ? "All Categories" : c}</button>
                ))}
            </div>

            {/* Stock Status chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: T.t3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: FONT.ui, marginRight: 2 }}>Stock:</span>
                {[["All", "All"], ["ok", "In Stock"], ["low", `Low (${counts.low})`], ["out", `Out (${counts.out})`]].map(([v, l]) => (
                    <button key={v} onClick={() => setStatusF(v)} style={{
                        padding: "4px 12px", borderRadius: 20,
                        border: `1px solid ${statusF === v ? (v === "out" ? T.crimson : v === "low" ? T.amber : v === "ok" ? T.emerald : T.sky) : T.border}`,
                        background: statusF === v ? (v === "out" ? "rgba(239,68,68,0.08)" : v === "low" ? T.amberSoft : v === "ok" ? "rgba(16,185,129,0.08)" : "rgba(56,189,248,0.08)") : "transparent",
                        color: statusF === v ? (v === "out" ? T.crimson : v === "low" ? T.amber : v === "ok" ? T.emerald : T.sky) : T.t2,
                        fontSize: 12, fontWeight: statusF === v ? 700 : 500, cursor: "pointer", transition: "all 0.15s ease", fontFamily: FONT.ui
                    }}>{l}</button>
                ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: T.t3, fontFamily: FONT.ui }}>
                    Showing <span style={{ color: T.t1, fontWeight: 700 }}>{Math.min(visibleCount, filtered.length)}</span> of {filtered.length} filtered ({shopProducts.length} total)
                </div>
            </div>

            {/* Empty state — outside table so layout isn't constrained */}
            {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: T.t3 }}>
                    <div style={{ fontSize: 64, opacity: 0.3, marginBottom: 16 }}>📦</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: T.t2, marginBottom: 8 }}>No products found</div>
                    <div style={{ fontSize: 14, color: T.t3, marginBottom: 20 }}>Try adjusting your search or filters</div>
                    <Btn variant="ghost" onClick={() => { setSearch(""); setCat("All"); setStatusF("All"); }}>Clear Filters</Btn>
                </div>
            )}

            {/* Table */}
            {filtered.length > 0 && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div className="table-scroll">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                            {["", "Product", "Cat.", "OEM", "Buy", "Sell", "Profit", "Margin", "Stock", "7D Sales", "Location", "Status", ""].map((h, i) => (
                                <th key={i} style={{ padding: "10px 12px", textAlign: "left", color: T.t3, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: FONT.ui, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.slice(0, visibleCount).map(p => {
                            const profit_u = p.sellPrice - p.buyPrice;
                            const mg = margin(p.buyPrice, p.sellPrice);
                            const st = stockStatus(p);
                            return (
                                <>
                                    <tr key={p.id} className="row-hover" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} style={{
                                        borderBottom: expandedId === p.id ? "none" : `1px solid ${T.border}`,
                                        background: expandedId === p.id ? T.surface : T.card,
                                        cursor: "pointer", transition: "background 0.15s",
                                        borderLeft: `3px solid ${st === "out" ? T.crimson : st === "low" ? T.amber : T.emerald}`,
                                    }}>
                                        <td style={{ padding: "10px 10px 10px 14px", width: 44 }}>
                                            {p.image && p.image.startsWith("http") ? (
                                                <img src={p.image} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: "cover", display: "block" }}
                                                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }} />
                                            ) : null}
                                            <span style={{ fontSize: 22, display: (p.image && p.image.startsWith("http")) ? "none" : "block" }}>
                                                {p.image || p.imageEmoji || "📦"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "10px 12px", maxWidth: 220 }}>
                                            <div style={{ fontWeight: 700, color: T.t1, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                                <span style={{ fontSize: 11, color: T.t3, fontFamily: FONT.mono }}>{p.sku}</span>
                                                {p.globalSku && <span style={{ fontSize: 9, fontWeight: 800, color: "#8B5CF6", background: "rgba(139,92,246,0.15)", padding: "1px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3 }}>🌐 Catalog Linked</span>}
                                                {p.condition !== "New" && p.condition && <span style={{ fontSize: 9, fontWeight: 800, color: T.amber, background: T.amberGlow, padding: "1px 6px", borderRadius: 4 }}>{p.condition}</span>}
                                                {vehicleMatchStr && (() => {
                                                    const compat = isProductCompatible(p, vehicleMatchStr);
                                                    if (compat === "compatible") return <span style={{ fontSize: 9, fontWeight: 800, color: T.emerald, background: T.emeraldBg, padding: "1px 6px", borderRadius: 4 }}>✅ Compatible</span>;
                                                    if (compat === "universal") return <span style={{ fontSize: 9, fontWeight: 800, color: T.sky, background: T.skyBg, padding: "1px 6px", borderRadius: 4 }}>🔄 Universal</span>;
                                                    return null;
                                                })()}
                                            </div>
                                        </td>
                                        <td style={{ padding: "10px 12px" }}>
                                            <span style={{ background: `${T.amber}14`, color: T.amber, fontSize: 10, padding: "2px 8px", borderRadius: 5, fontWeight: 700, fontFamily: FONT.ui }}>{p.category}</span>
                                        </td>
                                        <td style={{ padding: "10px 12px", fontFamily: FONT.mono, fontSize: 11, color: p.oemNumber ? T.t2 : T.t4 }}>{p.oemNumber || "—"}</td>
                                        <td style={{ padding: "10px 12px", color: T.t3, fontFamily: FONT.mono, fontSize: 12 }}>{fmt(p.buyPrice)}</td>
                                        <td style={{ padding: "10px 12px", color: T.t1, fontFamily: FONT.mono, fontSize: 13, fontWeight: 700 }}>{fmt(p.sellPrice)}</td>
                                        <td style={{ padding: "10px 12px", fontFamily: FONT.mono, fontSize: 13, fontWeight: 800, color: profit_u > 0 ? T.emerald : T.crimson }}>{fmt(profit_u)}</td>
                                        <td style={{ padding: "10px 12px", fontFamily: FONT.mono, fontSize: 12 }}>
                                            <span style={{ color: +mg > 30 ? T.emerald : +mg > 15 ? T.amber : T.crimson, fontWeight: 700 }}>{mg}%</span>
                                        </td>
                                        <td style={{ padding: "10px 12px" }}>
                                            <span style={{ fontFamily: FONT.mono, fontWeight: 800, fontSize: 16, color: p.stock === 0 ? T.crimson : p.stock < p.minStock ? T.amber : T.t1 }}>{p.stock}</span>
                                            <span style={{ fontSize: 10, color: T.t4, fontFamily: FONT.mono }}> /{p.minStock}</span>
                                        </td>
                                        <td style={{ padding: "10px 12px", fontFamily: FONT.mono, fontSize: 12, fontWeight: 600, color: (salesLast7d[p.id] || 0) > 0 ? T.t1 : T.t4 }}>
                                            {salesLast7d[p.id] || 0}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontFamily: FONT.mono, fontSize: 11, color: T.t3 }}>{p.location}</td>
                                        <td style={{ padding: "10px 12px" }}><Badge status={st} /></td>
                                        <td style={{ padding: "10px 14px 10px 10px" }}>
                                            <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                                                <Btn size="xs" variant="subtle" onClick={() => onEdit(p)}>Edit</Btn>
                                                <Btn size="xs" variant="ghost" onClick={() => setAdjP(p)} style={{ borderColor: T.border }}>⚖️</Btn>
                                                {(st === "low" || st === "out") && (
                                                    <Btn size="xs" variant="amber" onClick={(e) => { e.stopPropagation(); setPurchP(p); }}>Reorder</Btn>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Expandable Detail Panel */}
                                    {expandedId === p.id && (
                                        <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                                            <td colSpan={12} style={{ padding: 0 }}>
                                                <div style={{ padding: "16px 24px 20px", animation: "fadeIn 0.2s ease" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 800, color: T.t1, display: "flex", gap: 8, alignItems: "center" }}>
                                                            {p.image && p.image.startsWith("http")
                                                                ? <img src={p.image} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover", verticalAlign: "middle" }} />
                                                                : <span style={{ fontSize: 18 }}>{p.image || p.imageEmoji || "📦"}</span>
                                                            } {p.name}
                                                            <span style={{ fontSize: 10, color: T.t4, fontWeight: 500 }}>— Automobile Details</span>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); setExpandedId(null); }} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 10px", color: T.t3, fontSize: 11, cursor: "pointer", fontFamily: FONT.ui }}>✕ Close</button>
                                                    </div>
                                                    <div className="detail-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                                                        {/* OEM Number */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>OEM Number</div>
                                                            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT.mono, color: p.oemNumber ? T.amber : T.t4 }}>{p.oemNumber || "Not Available"}</div>
                                                        </div>
                                                        {/* SKU */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>SKU Number</div>
                                                            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT.mono, color: T.sky }}>{p.sku || "Not Available"}</div>
                                                        </div>
                                                        {/* Position */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Position</div>
                                                            <div style={{ fontSize: 14, fontWeight: 800, color: p.position ? T.emerald : T.t4 }}>{p.position || "Not Available"}</div>
                                                        </div>
                                                        {/* Engine Type */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Engine Type</div>
                                                            <div style={{ fontSize: 14, fontWeight: 800, color: p.engineType ? "#818CF8" : T.t4 }}>{p.engineType || "Not Available"}</div>
                                                        </div>
                                                        {/* Transmission */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Transmission</div>
                                                            <div style={{ fontSize: 14, fontWeight: 800, color: p.transmission ? T.amber : T.t4 }}>{p.transmission || "Not Available"}</div>
                                                        </div>
                                                        {/* Cross Reference / Condition */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Condition / Ref</div>
                                                            <div style={{ fontSize: 14, fontWeight: 800, color: p.condition === "New" ? T.emerald : T.amber }}>{p.condition || "New"}</div>
                                                            <div style={{ fontSize: 11, color: T.t3, marginTop: 2, fontFamily: FONT.mono }}>{p.crossRef || "No Ref."}</div>
                                                        </div>
                                                        {/* Brand + Supplier */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Brand / Warranty</div>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{p.brand || "—"}</div>
                                                            <div style={{ fontSize: 11, color: p.warranty ? T.sky : T.t3, marginTop: 2, display: "flex", gap: 4, alignItems: "center" }}>
                                                                {p.warranty ? `🛡️ ${p.warranty}` : "No Warranty Info"}
                                                            </div>
                                                        </div>
                                                        {/* Compatibility Summary */}
                                                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                                                            <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Compatibility</div>
                                                            {(() => {
                                                                const parts = [p.position, p.engineType, p.transmission].filter(Boolean);
                                                                if (parts.length === 0) return <div style={{ fontSize: 12, color: T.t4 }}>Not Available</div>;
                                                                return <div style={{ fontSize: 11, fontWeight: 600, color: T.emerald, lineHeight: 1.5 }}>{parts.join(" · ")}</div>;
                                                            })()}
                                                        </div>
                                                    </div>
                                                    {/* Location + Stock Details strip */}
                                                    <div style={{ display: "flex", gap: 16, marginTop: 12, padding: "10px 14px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, alignItems: "center", fontSize: 12 }}>
                                                        <div><span style={{ color: T.t3, fontWeight: 600 }}>📍 Location: </span><span style={{ fontFamily: FONT.mono, color: T.t1, fontWeight: 700 }}>{p.location || "—"}</span></div>
                                                        <div style={{ width: 1, height: 16, background: T.border }} />
                                                        <div><span style={{ color: T.t3, fontWeight: 600 }}>📦 Stock: </span><span style={{ fontFamily: FONT.mono, fontWeight: 800, color: p.stock === 0 ? T.crimson : p.stock < p.minStock ? T.amber : T.emerald }}>{p.stock}</span><span style={{ color: T.t4 }}> / {p.minStock} min</span></div>
                                                        <div style={{ width: 1, height: 16, background: T.border }} />
                                                        <div><span style={{ color: T.t3, fontWeight: 600 }}>💰 Inventory Value: </span><span style={{ fontFamily: FONT.mono, fontWeight: 800, color: T.amber }}>{fmt(p.buyPrice * p.stock)}</span></div>
                                                        <div style={{ width: 1, height: 16, background: T.border }} />
                                                        <div><span style={{ color: T.t3, fontWeight: 600 }}>📈 Potential Revenue: </span><span style={{ fontFamily: FONT.mono, fontWeight: 800, color: T.emerald }}>{fmt(p.sellPrice * p.stock)}</span></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Load More button */}
            {visibleCount < filtered.length && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <Btn variant="ghost" onClick={() => setVisibleCount(v => v + 50)}>
                        Load 50 more ({filtered.length - visibleCount} remaining)
                    </Btn>
                </div>
            )}

            <SaleModal open={!!saleP} product={saleP} products={products} onClose={() => setSaleP(null)} onSave={(data) => onSale(data)} toast={toast} />
            <PurchaseModal open={!!purchP} product={purchP} products={products} onClose={() => setPurchP(null)} onSave={(data) => onPurchase(data)} toast={toast} />
            <StockAdjustmentModal open={!!adjP} product={adjP} products={products} onClose={() => setAdjP(null)} onSave={(data) => onAdjust(data)} toast={toast} />
        </div>
    );
}
