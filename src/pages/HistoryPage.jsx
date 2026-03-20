import React, { useState, useMemo } from "react";
import { T, FONT } from "../theme";
import { fmt, pct, fmtDate, fmtTime, getMovementConfig, exportMovementsCSV } from "../utils";
import { StatCard, Input, Btn } from "../components/ui";

// ── Group movements that share the same invoiceNo or batchId ─────────────────
function groupMovements(filtered) {
    const result = [];
    const seen = new Map(); // groupKey → index in result
    for (const m of filtered) {
        const key = m.invoiceNo || m.batchId || null;
        if (key && seen.has(key)) {
            result[seen.get(key)].items.push(m);
        } else {
            const idx = result.length;
            result.push({ key, items: [m] });
            if (key) seen.set(key, idx);
        }
    }
    return result;
}

// ── A single row for a multi-item group ──────────────────────────────────────
function GroupRow({ group, isExpanded, onToggle, isLast }) {
    const first = group.items[0];
    const cfg = getMovementConfig(first.type);
    const totalAmt = group.items.reduce((s, m) => s + (m.total || 0), 0);
    const totalProfit = group.items.reduce((s, m) => s + (m.profit || 0), 0);
    const totalQty = group.items.reduce((s, m) => s + Math.abs(m.qty || 0), 0);
    const rest = group.items.length - 1;
    const productLabel = rest > 0
        ? `${first.productName} +${rest} more`
        : first.productName;
    const isSupply = first.type === "PURCHASE" || first.type === "OPENING";
    const partyName = isSupply
        ? (first.supplierName || first.supplier || "—")
        : (first.customerName || "Walk-in");
    const invoiceDisplay = first.invoiceNo || first.batchId || "—";

    return (
        <React.Fragment>
            <tr
                className="row-hover"
                onClick={onToggle}
                style={{
                    borderBottom: isExpanded ? "none" : (isLast ? "none" : `1px solid ${T.border}`),
                    background: isExpanded ? T.surface : T.card,
                    cursor: "pointer",
                    transition: "background 0.1s",
                }}
            >
                {/* Date */}
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 12, color: T.t1, fontFamily: FONT.mono }}>{fmtDate(first.date)}</div>
                    <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>{fmtTime(first.date)}</div>
                </td>
                {/* Product summary */}
                <td style={{ padding: "12px 14px", maxWidth: 180 }}>
                    <div style={{ fontWeight: 700, color: T.t1, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {productLabel}
                    </div>
                    <div style={{ fontSize: 10, color: T.amber, marginTop: 2, fontFamily: FONT.mono }}>
                        {group.items.length} items · {totalQty} units
                    </div>
                </td>
                {/* Type badge */}
                <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, padding: "3px 9px", borderRadius: 99, fontWeight: 700, fontFamily: FONT.ui, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12 }}>{cfg.icon}</span> {cfg.label}
                    </span>
                </td>
                {/* Qty */}
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 900, fontSize: 15, color: cfg.color }}>
                    {cfg.sym}{totalQty}
                </td>
                {/* Amount */}
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 600, color: T.t1 }}>
                    {totalAmt ? fmt(totalAmt) : <span style={{ color: T.t4 }}>—</span>}
                </td>
                {/* Profit */}
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 700, color: totalProfit > 0 ? T.emerald : totalProfit < 0 ? T.crimson : T.t4 }}>
                    {totalProfit ? (totalProfit > 0 ? "+" : "") + fmt(totalProfit) : <span style={{ color: T.t4 }}>—</span>}
                </td>
                {/* Invoice / batch */}
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontSize: 11, color: T.t3 }}>
                    {invoiceDisplay}
                </td>
                {/* Party */}
                <td style={{ padding: "12px 14px", fontSize: 12, color: T.t2, maxWidth: 130 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{partyName}</div>
                    {first.vehicleReg && <div style={{ fontSize: 10, color: T.amber, fontFamily: FONT.mono, marginTop: 2 }}>{first.vehicleReg}</div>}
                </td>
                {/* Payment */}
                <td style={{ padding: "12px 14px" }}>
                    {(first.payment || first.paymentMode) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 11, color: T.t3, fontWeight: 600 }}>
                                {(first.payment || first.paymentMode) === "Credit"
                                    ? <span style={{ color: T.crimson }}>💳 Credit</span>
                                    : (first.payment || first.paymentMode)}
                            </span>
                        </div>
                    )}
                </td>
                {/* Expand indicator */}
                <td style={{ padding: "12px 14px", fontSize: 11, color: T.amber, textAlign: "center" }}>
                    {isExpanded ? "▲" : "▼"}
                </td>
            </tr>

            {/* ── Expanded: mini line-item table ── */}
            {isExpanded && (
                <tr style={{ background: T.bg }}>
                    <td colSpan={10} style={{ padding: 0, borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ padding: "14px 20px 18px", animation: "fadeIn 0.15s ease" }}>
                            {/* Header */}
                            <div style={{ fontSize: 11, color: T.t3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ color: T.amber }}>{group.items.length} Line Items</span>
                                {first.invoiceNo && <span style={{ color: T.sky, fontFamily: FONT.mono }}>· {first.invoiceNo}</span>}
                                {!first.invoiceNo && first.batchId && <span style={{ color: T.t4, fontFamily: FONT.mono }}>· Batch {first.batchId}</span>}
                            </div>
                            {/* Line items table */}
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                        {["Product", "Qty", "Unit Price", "Amount", "Profit", "Note"].map(h => (
                                            <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: T.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FONT.ui }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.items.map((m, i) => {
                                        const mc = getMovementConfig(m.type);
                                        return (
                                            <tr key={m.id} style={{ borderBottom: i < group.items.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                                <td style={{ padding: "8px 10px", color: T.t1, fontWeight: 600 }}>{m.productName || "—"}</td>
                                                <td style={{ padding: "8px 10px", fontFamily: FONT.mono, color: mc.color, fontWeight: 700 }}>{mc.sym}{Math.abs(m.qty)}</td>
                                                <td style={{ padding: "8px 10px", fontFamily: FONT.mono, color: T.t2 }}>{m.unitPrice ? fmt(m.unitPrice) : "—"}</td>
                                                <td style={{ padding: "8px 10px", fontFamily: FONT.mono, color: T.amber, fontWeight: 700 }}>{m.total ? fmt(m.total) : "—"}</td>
                                                <td style={{ padding: "8px 10px", fontFamily: FONT.mono, fontWeight: 700, color: (m.profit || 0) > 0 ? T.emerald : (m.profit || 0) < 0 ? T.crimson : T.t4 }}>
                                                    {m.profit ? (m.profit > 0 ? "+" : "") + fmt(m.profit) : "—"}
                                                </td>
                                                <td style={{ padding: "8px 10px", color: T.t3, fontSize: 11 }}>{m.note || "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {/* Totals footer */}
                                <tfoot>
                                    <tr style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
                                        <td style={{ padding: "8px 10px", color: T.t3, fontWeight: 700, fontSize: 11 }}>TOTAL</td>
                                        <td style={{ padding: "8px 10px", fontFamily: FONT.mono, fontWeight: 700, color: cfg.color }}>{totalQty} units</td>
                                        <td />
                                        <td style={{ padding: "8px 10px", fontFamily: FONT.mono, fontWeight: 700, color: T.amber }}>{fmt(totalAmt)}</td>
                                        <td style={{ padding: "8px 10px", fontFamily: FONT.mono, fontWeight: 700, color: totalProfit > 0 ? T.emerald : totalProfit < 0 ? T.crimson : T.t4 }}>
                                            {totalProfit ? (totalProfit > 0 ? "+" : "") + fmt(totalProfit) : "—"}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}

// ── A single standalone row (unchanged from original) ────────────────────────
function SingleRow({ m, isExpanded, onToggle, isLast }) {
    const cfg = getMovementConfig(m.type);
    return (
        <React.Fragment>
            <tr className="row-hover" onClick={onToggle} style={{
                borderBottom: isExpanded ? "none" : (isLast ? "none" : `1px solid ${T.border}`),
                background: isExpanded ? T.surface : T.card,
                cursor: "pointer",
                transition: "background 0.1s",
            }}>
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 12, color: T.t1, fontFamily: FONT.mono }}>{fmtDate(m.date)}</div>
                    <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>{fmtTime(m.date)}</div>
                </td>
                <td style={{ padding: "12px 14px", maxWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: T.t1, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.productName}</div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, padding: "3px 9px", borderRadius: 99, fontWeight: 700, fontFamily: FONT.ui, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12 }}>{cfg.icon}</span> {cfg.label}
                    </span>
                </td>
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 900, fontSize: 15, color: cfg.color }}>
                    {cfg.sym}{Math.abs(m.qty)}
                </td>
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 600, color: T.t1 }}>{m.total ? fmt(m.total) : <span style={{ color: T.t4 }}>—</span>}</td>
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 700, color: m.profit > 0 ? T.emerald : m.profit < 0 ? T.crimson : T.t4 }}>
                    {m.profit ? (m.profit > 0 ? "+" : "") + fmt(m.profit) : <span style={{ color: T.t4 }}>—</span>}
                </td>
                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontSize: 11, color: T.t3 }}>{m.invoiceNo || <span style={{ color: T.t4 }}>—</span>}</td>
                <td style={{ padding: "12px 14px", fontSize: 12, color: T.t2, maxWidth: 130 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(m.type === "PURCHASE" || m.type === "OPENING")
                          ? (m.supplierName || m.supplier || "—")
                          : (m.customerName || "Walk-in")}
                    </div>
                    {m.vehicleReg && <div style={{ fontSize: 10, color: T.amber, fontFamily: FONT.mono, marginTop: 2 }}>{m.vehicleReg}</div>}
                </td>
                <td style={{ padding: "12px 14px" }}>
                    {(m.payment || m.paymentMode) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 11, color: T.t3, fontWeight: 600 }}>
                                {(m.payment || m.paymentMode) === "Credit" ? <span style={{ color: T.crimson }}>💳 Credit</span> : (m.payment || m.paymentMode)}
                            </span>
                            {m.paymentStatus && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: m.paymentStatus === "paid" || m.paymentStatus === "completed" ? T.emerald : T.crimson, textTransform: "uppercase" }}>
                                    {m.paymentStatus}
                                </span>
                            )}
                        </div>
                    )}
                </td>
                <td style={{ padding: "12px 14px", fontSize: 11, color: T.t3, maxWidth: 140 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.note || "—"}</span>
                </td>
            </tr>
            {/* ── Expanded detail ── */}
            {isExpanded && (
                <tr style={{ background: T.bg }}>
                    <td colSpan={10} style={{ padding: 0, borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ padding: "16px 20px 18px", display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.15s ease" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                                {[
                                    { label: "Product", value: m.productName, color: T.t1 },
                                    { label: "Type", value: cfg.label, color: cfg.color },
                                    { label: "Qty", value: `${cfg.sym}${Math.abs(m.qty)} unit${Math.abs(m.qty) !== 1 ? "s" : ""}`, color: cfg.color },
                                    { label: "Amount", value: m.total ? fmt(m.total) : "—", color: T.amber },
                                    { label: "Unit Price", value: m.unitPrice ? fmt(m.unitPrice) : "—", color: T.t2 },
                                    { label: "Profit", value: m.profit ? (m.profit > 0 ? "+" : "") + fmt(m.profit) : "—", color: m.profit > 0 ? T.emerald : m.profit < 0 ? T.crimson : T.t4 },
                                    { label: m.type === "PURCHASE" || m.type === "OPENING" ? "Supplier" : "Customer", value: (m.type === "PURCHASE" || m.type === "OPENING" ? (m.supplierName || m.supplier) : m.customerName) || "—", color: T.t2 },
                                    { label: "Payment", value: m.payment || m.paymentMode || "—", color: T.t2 },
                                    { label: "Invoice #", value: m.invoiceNo || "—", color: T.sky },
                                    { label: "Payment Status", value: m.paymentStatus || "—", color: m.paymentStatus === "paid" || m.paymentStatus === "completed" ? T.emerald : T.crimson },
                                    { label: "Customer Phone", value: m.customerPhone || "—", color: T.t3 },
                                    { label: "Vehicle Reg", value: m.vehicleReg || "—", color: T.amber },
                                ].map(({ label, value, color }) => value && value !== "—" ? (
                                    <div key={label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>
                                        <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: label === "Amount" || label === "Unit Price" || label === "Profit" || label === "Qty" ? FONT.mono : FONT.ui }}>{value}</div>
                                    </div>
                                ) : null)}
                            </div>
                            {m.note && (
                                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
                                    <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Notes / Details</div>
                                    <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.6 }}>{m.note}</div>
                                </div>
                            )}
                            {m.adjustmentMeta && (
                                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
                                    <div style={{ fontSize: 9, color: T.t4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Adjustment Details</div>
                                    <div style={{ display: "flex", gap: 20, fontSize: 12, color: T.t2, flexWrap: "wrap" }}>
                                        <span>Type: <strong style={{ color: T.t1 }}>{m.adjustmentMeta.type}</strong></span>
                                        <span>Stock: <strong style={{ color: T.amber, fontFamily: FONT.mono }}>{m.adjustmentMeta.previousStock} → {m.adjustmentMeta.newStock}</strong></span>
                                        {m.adjustmentMeta.reason && <span>Reason: <strong style={{ color: T.t1 }}>{m.adjustmentMeta.reason}</strong></span>}
                                        {m.adjustmentMeta.refundMethod && <span>Refund via: <strong style={{ color: T.emerald }}>{m.adjustmentMeta.refundMethod}</strong></span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}

export function HistoryPage({ movements, activeShopId }) {
    const [filter, setFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [expandedKey, setExpandedKey] = useState(null);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const shopMovements = useMemo(() => movements.filter(m => m.shopId === activeShopId), [movements, activeShopId]);

    const sorted = useMemo(() => [...shopMovements].sort((a, b) => b.date - a.date), [shopMovements]);

    const filtered = useMemo(() => sorted
        .filter(m => {
            if (filter === "ALL") return true;
            if (filter === "ADJUSTMENTS") return ["RETURN_IN", "RETURN_OUT", "CREDIT_NOTE", "DEBIT_NOTE", "DAMAGE", "THEFT", "AUDIT", "OPENING", "TRANSFER_IN", "TRANSFER_OUT", "ADJUST"].includes(m.type);
            return m.type === filter;
        })
        .filter(m => !search || [m.productName, m.invoiceNo, m.batchId, m.supplier, m.supplierName, m.customerName, m.note].some(s => (s || "").toLowerCase().includes(search.toLowerCase())))
        .filter(m => {
            if (dateFrom) { const from = new Date(dateFrom).getTime(); if (m.date < from) return false; }
            if (dateTo) { const to = new Date(dateTo).setHours(23, 59, 59, 999); if (m.date > to) return false; }
            return true;
        }), [sorted, filter, search, dateFrom, dateTo]);

    // Group by invoiceNo or batchId so multi-item bills collapse into one row
    const groups = useMemo(() => groupMovements(filtered), [filtered]);

    const totals = useMemo(() => ({
        purchases: shopMovements.filter(m => m.type === "PURCHASE").reduce((s, m) => s + m.total, 0),
        sales: shopMovements.filter(m => m.type === "SALE").reduce((s, m) => s + m.total, 0),
        profit: shopMovements.filter(m => m.type === "SALE").reduce((s, m) => s + (m.profit || 0), 0),
        count_p: shopMovements.filter(m => m.type === "PURCHASE").length,
        count_s: shopMovements.filter(m => m.type === "SALE").length,
        count_adj: shopMovements.filter(m => !["PURCHASE", "SALE", "ESTIMATE", "RECEIPT", "PAYMENT"].includes(m.type)).length,
    }), [shopMovements]);

    const filterChips = [
        ["ALL", "All"],
        ["PURCHASE", "Purchases"],
        ["SALE", "Sales"],
        ["ESTIMATE", "Quotations"],
        ["ADJUSTMENTS", "Adjustments"],
        ["RECEIPT", "Receipts"],
    ];

    return (
        <div className="page-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                <StatCard label="Total Purchases" value={fmt(totals.purchases)} icon="📥" color={T.sky} sub={`${totals.count_p} entries`} />
                <StatCard label="Total Sales" value={fmt(totals.sales)} icon="📤" color={T.amber} sub={`${totals.count_s} transactions`} />
                <StatCard label="Total Profit" value={fmt(totals.profit)} icon="📈" color={T.emerald} sub={pct(totals.profit, totals.sales) + " margin"} />
                <StatCard label="Adjustments" value={String(totals.count_adj)} icon="⚖️" color={T.violet} sub="Returns, damages, audits" />
            </div>

            <div style={{ background: T.card, border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: T.amber, fontWeight: 500, fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 8 }}>
                🔒 <span>Permanent audit trail — all entries are non-editable and auto-logged for accountability.</span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {filterChips.map(([v, l]) => {
                    const cfg = v !== "ALL" && v !== "ADJUSTMENTS" ? getMovementConfig(v) : null;
                    const isActive = filter === v;
                    const chipColor = cfg ? cfg.color : v === "ADJUSTMENTS" ? T.violet : T.borderHi;
                    return (
                        <button key={v} onClick={() => setFilter(v)} style={{
                            background: isActive ? chipColor : "transparent",
                            color: isActive ? "#000" : T.t2,
                            border: `1px solid ${isActive ? chipColor : T.border}`,
                            borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui, transition: "all 0.12s"
                        }}>{l}</button>
                    );
                })}
                <div style={{ flex: 1, minWidth: 180 }}><Input value={search} onChange={setSearch} placeholder="Search product, invoice, customer…" icon="🔍" /></div>

                {/* Date Range */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 10px", color: T.t1, fontFamily: FONT.ui, fontSize: 12 }} />
                    <span style={{ color: T.t3, fontSize: 11 }}>to</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 10px", color: T.t1, fontFamily: FONT.ui, fontSize: 12 }} />
                </div>

                <Btn variant="subtle" size="sm" onClick={() => exportMovementsCSV(filtered)}>⬇ Export CSV</Btn>
            </div>

            <div style={{ fontSize: 12, color: T.t3 }}>
                Showing <span style={{ color: T.t1, fontWeight: 700 }}>{groups.length}</span> {groups.length !== filtered.length && <span>(grouped from <span style={{ color: T.t1, fontWeight: 700 }}>{filtered.length}</span> entries)</span>} of {shopMovements.length} total entries
            </div>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                            {["Date & Time", "Product / Items", "Type", "Qty", "Amount", "Profit", "Invoice", "Party", "Payment", "Details"].map(h => (
                                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: T.t3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: FONT.ui, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {groups.length === 0 ? (
                            <tr><td colSpan={10} style={{ padding: "40px", textAlign: "center", color: T.t3, fontFamily: FONT.ui }}>No records found.</td></tr>
                        ) : groups.map((group, i) => {
                            const rowKey = group.key || group.items[0].id;
                            const isExpanded = expandedKey === rowKey;
                            const toggle = () => setExpandedKey(isExpanded ? null : rowKey);
                            const isLast = i === groups.length - 1;

                            if (group.items.length > 1) {
                                return <GroupRow key={rowKey} group={group} isExpanded={isExpanded} onToggle={toggle} isLast={isLast} />;
                            }
                            return <SingleRow key={rowKey} m={group.items[0]} isExpanded={isExpanded} onToggle={toggle} isLast={isLast} />;
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
