import { useMemo, useState } from "react";
import { T, FONT } from "../theme";
import { fmt, fmtDate, daysAgo, pct, getDebtAging, exportMovementsCSV, downloadCSV, generateCSV, margin, stockStatus } from "../utils";
import { StatCard, Btn } from "../components/ui";
import { useStore } from "../store";

export function ReportsPage({ movements, products, activeShopId, onPaymentReceipt, toast }) {
    const [view, setView] = useState("overview");
    const [auditTypeFilter, setAuditTypeFilter] = useState("");
    const [auditVisible, setAuditVisible] = useState(50);
    const { auditLog } = useStore();

    const shopMovements = useMemo(() => movements.filter(m => m.shopId === activeShopId), [movements, activeShopId]);
    const shopProducts = useMemo(() => (products || []).filter(p => p.shopId === activeShopId), [products, activeShopId]);

    // ===== FINANCIAL STATS =====
    const stats = useMemo(() => {
        let sales = 0, purchases = 0, pnl = 0, outGst = 0, inGst = 0, units = 0, returns = 0, damages = 0;
        const receivables = {}, payables = {};

        shopMovements.forEach(m => {
            if (m.type === "SALE") {
                sales += m.total; pnl += m.profit || 0; outGst += m.gstAmount || 0; units += m.qty;
                if (m.paymentMode === "Credit" || m.paymentStatus === "pending") {
                    const cust = m.customerName || "Unknown Customer";
                    if (!receivables[cust]) receivables[cust] = { name: cust, phone: m.customerPhone, total: 0, transactions: [], oldestDate: Infinity };
                    receivables[cust].total += m.total;
                    receivables[cust].transactions.push(m);
                    receivables[cust].oldestDate = Math.min(receivables[cust].oldestDate, m.date);
                }
            } else if (m.type === "PURCHASE") {
                purchases += m.total; inGst += m.gstAmount || 0;
                if (m.paymentMode === "Credit" || m.paymentStatus === "pending") {
                    const supp = m.supplierName || m.supplier || "Unknown Supplier";
                    if (!payables[supp]) payables[supp] = { name: supp, total: 0, transactions: [], oldestDate: Infinity };
                    payables[supp].total += m.total;
                    payables[supp].transactions.push(m);
                    payables[supp].oldestDate = Math.min(payables[supp].oldestDate, m.date);
                }
            } else if (m.type === "RETURN_IN") { returns += m.total || 0; }
            else if (m.type === "DAMAGE" || m.type === "THEFT") { damages += Math.abs(m.profit || 0); }
        });

        // Receipts reduce receivables
        shopMovements.filter(m => m.type === "RECEIPT").forEach(m => {
            const cust = m.customerName;
            if (cust && receivables[cust]) {
                receivables[cust].total = Math.max(0, receivables[cust].total - m.total);
            }
        });

        const recList = Object.values(receivables).filter(c => c.total > 0).map(c => ({
            ...c, ageDays: Math.floor((Date.now() - c.oldestDate) / 86400000),
            aging: getDebtAging(c.oldestDate),
        })).sort((a, b) => b.total - a.total);

        const payList = Object.values(payables).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
        const recTotal = recList.reduce((s, i) => s + i.amount || i.total, 0);
        const payTotal = payList.reduce((s, i) => s + i.amount || i.total, 0);

        // Inventory valuation
        const invValue = shopProducts.reduce((s, p) => s + (p.buyPrice * p.stock), 0);
        const invSellValue = shopProducts.reduce((s, p) => s + (p.sellPrice * p.stock), 0);
        const potentialProfit = invSellValue - invValue;

        return {
            sales, purchases, pnl, outGst, inGst, netGst: outGst - inGst,
            units, returns, damages,
            recList, recTotal: recList.reduce((s, i) => s + i.total, 0),
            payList, payTotal: payList.reduce((s, i) => s + i.total, 0),
            invValue, invSellValue, potentialProfit,
            cogs: purchases, grossProfit: pnl, netProfit: pnl - damages - returns,
        };
    }, [shopMovements, shopProducts]);

    // ===== TABS =====
    const tabs = [
        { id: "overview", label: "P&L Overview", icon: "📊" },
        { id: "balance", label: "Balance Sheet", icon: "⚖️" },
        { id: "gst", label: "GST & Tax", icon: "🏛️" },
        { id: "parties", label: "Party Ledgers", icon: "📒" },
        { id: "inventory", label: "Inventory Valuation", icon: "📦" },
        { id: "audit", label: "Audit Log", icon: "🔍" },
    ];

    // ===== HSN-WISE TAX BREAKDOWN =====
    const hsnBreakdown = useMemo(() => {
        const map = {};
        shopMovements.filter(m => m.type === "SALE").forEach(m => {
            const prod = shopProducts.find(p => p.id === m.productId);
            const hsn = prod?.hsnCode || prod?.hsn || "99";
            const rate = prod?.gstRate || prod?.gst || 18;
            const key = `${hsn}_${rate}`;
            if (!map[key]) map[key] = { hsn, rate, taxableValue: 0, qty: 0, invoices: 0 };
            map[key].taxableValue += (m.total - (m.gstAmount || 0));
            map[key].qty += m.qty;
            map[key].invoices++;
        });
        return Object.values(map).sort((a, b) => b.taxableValue - a.taxableValue);
    }, [shopMovements, shopProducts]);

    // ===== PARTY LEDGER TABLE =====
    const renderDebtTable = (title, list, isReceivable) => (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", flex: 1, minWidth: 300 }}>
            <div style={{ padding: "16px 20px", background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, color: T.t1, fontSize: 16 }}>{title}</div>
                <div style={{ fontFamily: FONT.mono, fontWeight: 900, color: isReceivable ? T.emerald : T.crimson }}>
                    {fmt(list.reduce((s, x) => s + x.total, 0))}
                </div>
            </div>
            {list.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: T.t3, fontSize: 14 }}>No pending {title.toLowerCase()}. 🎉</div>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                        {list.map((item, i) => {
                            const aging = item.aging || getDebtAging(item.oldestDate || Date.now());
                            return (
                                <tr key={i} className="row-hover" style={{ borderBottom: i < list.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                    <td style={{ padding: "14px 20px" }}>
                                        <div style={{ fontWeight: 600, color: T.t1 }}>{item.name}</div>
                                        {item.phone && <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{item.phone}</div>}
                                        {item.aging && (
                                            <span style={{ fontSize: 9, fontWeight: 800, color: aging.color, background: `${aging.color}18`, padding: "2px 6px", borderRadius: 4, marginTop: 4, display: "inline-block" }}>
                                                {aging.label}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: "14px 20px", textAlign: "right", fontFamily: FONT.mono, fontWeight: 800, color: T.t1, fontSize: 15 }}>{fmt(item.total)}</td>
                                    <td style={{ padding: "14px 20px", textAlign: "right", width: 100 }}>
                                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                            {isReceivable && (
                                                <Btn size="xs" variant="emerald" onClick={() => {
                                                    const amount = prompt(`Enter payment amount from ${item.name} (Max: ${item.total}):`, String(item.total));
                                                    if (amount && +amount > 0) {
                                                        onPaymentReceipt?.({
                                                            partyName: item.name, partyPhone: item.phone || "",
                                                            amount: Math.min(+amount, item.total), paymentMode: "Cash",
                                                            notes: `Udhaar settlement from ${item.name}`,
                                                        });
                                                    }
                                                }}>💰 Collect</Btn>
                                            )}
                                            {isReceivable && item.phone && (
                                                <Btn size="xs" variant="ghost" onClick={() => {
                                                    const msg = encodeURIComponent(`Hi ${item.name}, your pending balance at Ravi Auto Parts is ${fmt(item.total)}. Please settle at your earliest convenience. Thank you! 🙏`);
                                                    window.open(`https://wa.me/${item.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
                                                }} style={{ borderColor: T.border }}>💬</Btn>
                                            )}
                                            {!isReceivable && <Btn size="xs" variant="sky" onClick={() => {
                                                const amount = prompt(`Enter payment to ${item.name} (Max: ${item.total}):`, String(item.total));
                                                if (amount && +amount > 0) {
                                                    onPaymentReceipt?.({
                                                        partyName: item.name, partyPhone: "",
                                                        amount: Math.min(+amount, item.total), paymentMode: "Bank Transfer",
                                                        notes: `Supplier payment to ${item.name}`,
                                                        movementIds: item.transactions?.map(t => t.id) || [],
                                                    });
                                                }
                                            }}>Settle</Btn>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );

    return (
        <div className="page-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Tab Navigation */}
            <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, overflowX: "auto" }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setView(tab.id)}
                        style={{ background: view === tab.id ? `${T.amber}22` : "transparent", color: view === tab.id ? T.amber : T.t3, border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 8, transition: "0.2s", whiteSpace: "nowrap" }}
                        className="btn-hover-subtle">
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* ===== P&L OVERVIEW ===== */}
            {view === "overview" && (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="kpi-grid-6" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        <StatCard label="Net Sales Revenue" value={fmt(stats.sales)} color={T.emerald} icon="📈" sub={`${stats.units} units sold`} />
                        <StatCard label="Total Purchases (COGS)" value={fmt(stats.purchases)} color={T.sky} icon="📥" />
                        <StatCard label="Gross Profit" value={fmt(stats.pnl)} color={T.amber} icon="💰" sub={`Margin: ${pct(stats.pnl, stats.sales)}`} />
                        <StatCard label="Net Profit" value={fmt(stats.netProfit)} color={stats.netProfit >= 0 ? T.emerald : T.crimson} icon="🏦" sub={`After losses: ${fmt(stats.damages + stats.returns)}`} />
                    </div>

                    {/* P&L Statement */}
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: T.t1, marginBottom: 20 }}>📊 Profit & Loss Statement</div>
                        <div style={{ maxWidth: 500 }}>
                            {[
                                { label: "Revenue (Sales)", value: stats.sales, color: T.emerald, bold: true },
                                { label: "Less: Cost of Goods Sold", value: -stats.purchases, color: T.sky, indent: true },
                                { label: "Gross Profit", value: stats.pnl, color: T.amber, bold: true, border: true },
                                { label: "Less: Customer Returns", value: -stats.returns, color: T.crimson, indent: true },
                                { label: "Less: Damages & Shrinkage", value: -stats.damages, color: T.crimson, indent: true },
                                { label: "Net Profit / (Loss)", value: stats.netProfit, color: stats.netProfit >= 0 ? T.emerald : T.crimson, bold: true, border: true, big: true },
                            ].map((row, i) => (
                                <div key={i} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: `${row.big ? 14 : 10}px 0`, paddingLeft: row.indent ? 20 : 0,
                                    borderTop: row.border ? `1px solid ${T.border}` : "none",
                                    marginTop: row.border ? 8 : 0,
                                }}>
                                    <span style={{ fontSize: row.big ? 16 : 14, fontWeight: row.bold ? 800 : 500, color: row.bold ? T.t1 : T.t2 }}>{row.label}</span>
                                    <span style={{ fontSize: row.big ? 22 : 16, fontWeight: row.bold ? 900 : 600, fontFamily: FONT.mono, color: row.color }}>
                                        {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Waterfall Chart */}
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: T.t3 }}>P&L Waterfall</div>
                            <button onClick={() => window.print()} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px", color: T.t2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.color = T.amber; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t2; }}>
                                🖨 Export PDF
                            </button>
                        </div>
                        {(() => {
                            const steps = [
                                { label: "Revenue", value: stats.sales, color: T.amber },
                                { label: "COGS", value: -stats.purchases, color: T.crimson },
                                { label: "Gross Profit", value: stats.pnl, color: T.emerald },
                                { label: "Returns", value: -stats.returns, color: T.crimson },
                                { label: "Damages", value: -stats.damages, color: T.crimson },
                                { label: "Net Profit", value: stats.netProfit, color: stats.netProfit >= 0 ? T.emerald : T.crimson },
                            ];
                            const maxVal = Math.max(...steps.map(s => Math.abs(s.value)), 1);
                            return (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {steps.map(step => (
                                        <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ width: 110, fontSize: 12, color: T.t2, textAlign: "right", flexShrink: 0 }}>{step.label}</div>
                                            <div style={{ flex: 1, background: T.border, borderRadius: 4, height: 22, position: "relative", overflow: "hidden" }}>
                                                <div style={{ height: "100%", borderRadius: 4, width: `${(Math.abs(step.value) / maxVal) * 100}%`, background: step.color, opacity: 0.75, transition: "width 0.5s ease" }} />
                                            </div>
                                            <div style={{ width: 100, fontFamily: FONT.mono, fontSize: 12, color: step.color, fontWeight: 700, textAlign: "right", flexShrink: 0 }}>
                                                {step.value < 0 ? `(${fmt(Math.abs(step.value))})` : fmt(step.value)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Quick KPIs */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        <StatCard label="Accounts Receivable (Udhaar)" value={fmt(stats.recTotal)} color={T.crimson} icon="📋" sub={`${stats.recList.length} customers owe you`} />
                        <StatCard label="Accounts Payable" value={fmt(stats.payTotal)} color="#FB923C" icon="🏭" sub={`${stats.payList.length} suppliers to pay`} />
                        <StatCard label="Inventory Value (Cost)" value={fmt(stats.invValue)} color={T.sky} icon="📦" sub={`Potential revenue: ${fmt(stats.invSellValue)}`} />
                    </div>
                </div>
            )}

            {/* ===== GST & TAX ===== */}
            {view === "gst" && (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* GSTR-3B Summary Card Grid */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: T.t3 }}>GSTR-3B Summary</div>
                        <button onClick={() => window.print()} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px", color: T.t2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.color = T.amber; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t2; }}>
                            🖨 Export PDF
                        </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                        {[
                            { label: "Output Tax (3.1)", sub: "Tax collected on sales", value: stats.outGst, color: T.amber },
                            { label: "Input Tax Credit (4)", sub: "ITC from purchase invoices", value: stats.inGst, color: T.emerald },
                            { label: "Net Payable (6)", sub: "Amount due to government", value: Math.max(0, stats.netGst), color: stats.netGst > 0 ? T.crimson : T.emerald },
                        ].map(c => (
                            <div key={c.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>{c.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 900, fontFamily: FONT.mono, color: c.color, marginBottom: 4 }}>{fmt(c.value)}</div>
                                <div style={{ fontSize: 11, color: T.t3 }}>{c.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 32 }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: T.t1, marginBottom: 24 }}>GST Calculation Worksheet</div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: `1px dashed ${T.border}` }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>Output GST (Collected on Sales)</div>
                                <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>Tax collected from customers to be paid to Govt.</div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT.mono, color: T.amber }}>{fmt(stats.outGst)}</div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: `1px dashed ${T.border}` }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>Input GST (Paid on Purchases)</div>
                                <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>ITC available from supplier invoices.</div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT.mono, color: T.sky }}>— {fmt(stats.inGst)}</div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 0 0", marginTop: 12 }}>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: T.t1 }}>Net GST Liability</div>
                                <div style={{ fontSize: 13, color: stats.netGst > 0 ? T.crimson : T.emerald, fontWeight: 600, marginTop: 4 }}>
                                    {stats.netGst > 0 ? "Amount payable to Government" : "Input Tax Credit Available"}
                                </div>
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: FONT.mono, color: stats.netGst > 0 ? T.crimson : T.emerald, background: stats.netGst > 0 ? `${T.crimson}11` : `${T.emerald}11`, padding: "12px 24px", borderRadius: 12 }}>
                                {fmt(Math.abs(stats.netGst))} {stats.netGst < 0 && <span style={{ fontSize: 14 }}> (Cr)</span>}
                            </div>
                        </div>

                        {/* CGST/SGST Split */}
                        <div className="kpi-grid-6" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 24 }}>
                            <StatCard label="Output CGST" value={fmt(stats.outGst / 2)} color={T.amber} icon="🏛️" />
                            <StatCard label="Output SGST" value={fmt(stats.outGst / 2)} color={T.amber} icon="🏛️" />
                            <StatCard label="Input CGST" value={fmt(stats.inGst / 2)} color={T.sky} icon="📥" />
                            <StatCard label="Input SGST" value={fmt(stats.inGst / 2)} color={T.sky} icon="📥" />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <Btn variant="amber" onClick={() => {
                                const gstr1Json = {
                                    gstin: "36AAXYZ1234X1ZP",
                                    fp: new Date().toISOString().slice(0, 7).replace("-", "").slice(2),
                                    b2b: [],
                                    b2cs: [],
                                    hsn: { data: [] },
                                };
                                const salesByCustomer = {};
                                shopMovements.filter(m => m.type === "SALE").forEach(m => {
                                    const prod = shopProducts.find(p => p.id === m.productId);
                                    const taxable = m.total - (m.gstAmount || 0);
                                    const rate = prod?.gstRate || prod?.gst || 18;
                                    if (m.customerName) {
                                        if (!salesByCustomer[m.customerName]) salesByCustomer[m.customerName] = [];
                                        salesByCustomer[m.customerName].push({ inum: m.invoiceNo || "INV-" + m.id, idt: fmtDate(m.date), val: m.total, txval: taxable, rt: rate, camt: (m.gstAmount || 0) / 2, samt: (m.gstAmount || 0) / 2 });
                                    } else {
                                        gstr1Json.b2cs.push({ typ: "OE", pos: "36", rt: rate, txval: taxable, camt: (m.gstAmount || 0) / 2, samt: (m.gstAmount || 0) / 2 });
                                    }
                                });
                                Object.entries(salesByCustomer).forEach(([name, invoices]) => {
                                    gstr1Json.b2b.push({ ctin: "36AAAAA0000A1Z5", inv: invoices });
                                });
                                hsnBreakdown.forEach(h => {
                                    const cgst = h.taxableValue * (h.rate / 100) / 2;
                                    gstr1Json.hsn.data.push({ hsn_sc: h.hsn, txval: Math.round(h.taxableValue), camt: Math.round(cgst), samt: Math.round(cgst), iamt: 0, qty: h.qty, uqc: "NOS" });
                                });
                                const blob = new Blob([JSON.stringify(gstr1Json, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a"); a.href = url; a.download = `GSTR1_${gstr1Json.fp}.json`; a.click(); URL.revokeObjectURL(url);
                                toast?.("GSTR-1 JSON exported — Upload to GST Portal!", "success", "🏛️ GST Filing");
                            }}>🏛️ Export GSTR-1 JSON (Portal Format)</Btn>
                            <Btn variant="subtle" onClick={() => {
                                const headers = ["Description", "Taxable Value", "CGST (9%)", "SGST (9%)", "IGST", "Total Tax"];
                                const rows = [
                                    ["3.1(a) Outward taxable supplies", stats.sales - stats.outGst, stats.outGst / 2, stats.outGst / 2, 0, stats.outGst],
                                    ["4(A) ITC Available - Inputs", stats.purchases - stats.inGst, stats.inGst / 2, stats.inGst / 2, 0, stats.inGst],
                                    ["6.1 Tax Payable", "", Math.max(0, (stats.outGst - stats.inGst) / 2), Math.max(0, (stats.outGst - stats.inGst) / 2), 0, Math.max(0, stats.netGst)],
                                ];
                                downloadCSV(`GSTR3B_${fmtDate(Date.now()).replace(/\s/g, "_")}.csv`, generateCSV(headers, rows));
                                toast?.("GSTR-3B worksheet downloaded!", "success");
                            }}>📥 GSTR-3B Excel</Btn>
                            <Btn variant="subtle" onClick={() => {
                                const salesMov = shopMovements.filter(m => m.type === "SALE");
                                const headers = ["Invoice No", "Date", "Customer", "GSTIN", "HSN", "Taxable Value", "CGST", "SGST", "Total"];
                                const rows = salesMov.map(m => {
                                    const prod = shopProducts.find(p => p.id === m.productId);
                                    const taxable = m.total - (m.gstAmount || 0);
                                    return [m.invoiceNo || "", fmtDate(m.date), m.customerName || "Walk-in", "", prod?.hsnCode || "99", taxable, (m.gstAmount || 0) / 2, (m.gstAmount || 0) / 2, m.total];
                                });
                                downloadCSV(`GSTR1_Sales_${fmtDate(Date.now()).replace(/\s/g, "_")}.csv`, generateCSV(headers, rows));
                                toast?.("GSTR-1 sales CSV downloaded!", "success");
                            }}>📥 GSTR-1 CSV</Btn>
                        </div>
                    </div>

                    {/* HSN-wise Tax Breakdown Table */}
                    {hsnBreakdown.length > 0 && (
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                            <div style={{ padding: "16px 20px", background: T.surface, borderBottom: `1px solid ${T.border}`, fontSize: 16, fontWeight: 800, color: T.t1 }}>HSN-wise Tax Summary</div>
                          <div className="table-scroll">
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                        {["HSN Code", "Rate %", "Invoices", "Qty", "Taxable Value", "CGST", "SGST", "Total Tax"].map(h => (
                                            <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: T.t3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", fontFamily: FONT.ui }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {hsnBreakdown.map((h, i) => {
                                        const cgst = h.taxableValue * (h.rate / 100) / 2;
                                        return (
                                            <tr key={i} className="row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 700, color: T.t1 }}>{h.hsn}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.amber }}>{h.rate}%</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.t2 }}>{h.invoices}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.t2 }}>{h.qty}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 700, color: T.t1 }}>{fmt(h.taxableValue)}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.sky }}>{fmt(cgst)}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.sky }}>{fmt(cgst)}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 800, color: T.amber }}>{fmt(cgst * 2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                          </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== BALANCE SHEET ===== */}
            {view === "balance" && (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="bottom-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        {/* Assets */}
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: T.emerald, marginBottom: 20 }}>📈 Assets</div>
                            {[
                                { label: "Cash & Bank", value: stats.sales - stats.recTotal, sub: "Net cash from sales" },
                                { label: "Inventory (at Cost)", value: stats.invValue, sub: `${shopProducts.length} SKUs` },
                                { label: "Accounts Receivable", value: stats.recTotal, sub: `${stats.recList.length} customers` },
                                { label: "GST Input Credit", value: stats.inGst, sub: "ITC available" },
                            ].map((row, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: T.t1, fontSize: 14 }}>{row.label}</div>
                                        <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{row.sub}</div>
                                    </div>
                                    <span style={{ fontFamily: FONT.mono, fontWeight: 800, color: T.emerald, fontSize: 16 }}>{fmt(row.value)}</span>
                                </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, padding: "14px 0", borderTop: `2px solid ${T.emerald}` }}>
                                <span style={{ fontSize: 16, fontWeight: 900, color: T.t1 }}>Total Assets</span>
                                <span style={{ fontSize: 22, fontWeight: 900, fontFamily: FONT.mono, color: T.emerald }}>{fmt((stats.sales - stats.recTotal) + stats.invValue + stats.recTotal + stats.inGst)}</span>
                            </div>
                        </div>

                        {/* Liabilities + Equity */}
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: T.crimson, marginBottom: 20 }}>📉 Liabilities & Equity</div>
                            {[
                                { label: "Accounts Payable", value: stats.payTotal, sub: `${stats.payList.length} suppliers`, color: T.crimson },
                                { label: "GST Output Liability", value: stats.outGst, sub: "Tax collected to remit", color: T.crimson },
                                { label: "Net GST Payable", value: Math.max(0, stats.netGst), sub: stats.netGst > 0 ? "Due to Govt" : "ITC balance", color: T.amber },
                            ].map((row, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: T.t1, fontSize: 14 }}>{row.label}</div>
                                        <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{row.sub}</div>
                                    </div>
                                    <span style={{ fontFamily: FONT.mono, fontWeight: 800, color: row.color, fontSize: 16 }}>{fmt(row.value)}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 16, padding: "10px 0", borderTop: `1px dashed ${T.border}` }}>
                                <div style={{ fontWeight: 600, color: T.t3, fontSize: 12, marginBottom: 4 }}>EQUITY</div>
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                                    <span style={{ fontWeight: 600, color: T.t1 }}>Retained Earnings (Net Profit)</span>
                                    <span style={{ fontFamily: FONT.mono, fontWeight: 800, color: stats.netProfit >= 0 ? T.emerald : T.crimson, fontSize: 16 }}>{fmt(stats.netProfit)}</span>
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "14px 0", borderTop: `2px solid ${T.crimson}` }}>
                                <span style={{ fontSize: 16, fontWeight: 900, color: T.t1 }}>Total Liab. + Equity</span>
                                <span style={{ fontSize: 22, fontWeight: 900, fontFamily: FONT.mono, color: T.crimson }}>{fmt(stats.payTotal + stats.outGst + Math.max(0, stats.netGst) + stats.netProfit)}</span>
                            </div>
                        </div>
                    </div>

                    <Btn variant="subtle" onClick={() => {
                        const headers = ["Category", "Account", "Amount"];
                        const rows = [
                            ["ASSETS", "Cash & Bank", stats.sales - stats.recTotal],
                            ["ASSETS", "Inventory at Cost", stats.invValue],
                            ["ASSETS", "Accounts Receivable", stats.recTotal],
                            ["ASSETS", "GST Input Credit", stats.inGst],
                            ["", "TOTAL ASSETS", (stats.sales - stats.recTotal) + stats.invValue + stats.recTotal + stats.inGst],
                            ["LIABILITIES", "Accounts Payable", stats.payTotal],
                            ["LIABILITIES", "GST Output Liability", stats.outGst],
                            ["EQUITY", "Retained Earnings", stats.netProfit],
                            ["", "TOTAL LIAB + EQUITY", stats.payTotal + stats.outGst + stats.netProfit],
                        ];
                        downloadCSV(`Balance_Sheet_${fmtDate(Date.now()).replace(/\s/g, "_")}.csv`, generateCSV(headers, rows));
                        toast?.("Balance sheet exported!", "success");
                    }}>📥 Export Balance Sheet CSV</Btn>
                </div>
            )}

            {/* ===== PARTY LEDGERS ===== */}
            {view === "parties" && (
                <div className="fade-in" style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {renderDebtTable("Receivables (Customer Udhaar)", stats.recList, true)}
                    {renderDebtTable("Payables (Supplier Udhaar)", stats.payList, false)}
                </div>
            )}

            {/* ===== INVENTORY VALUATION ===== */}
            {view === "inventory" && (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="kpi-grid-6" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        <StatCard label="Inventory at Cost" value={fmt(stats.invValue)} color={T.sky} icon="📦" />
                        <StatCard label="Inventory at Sell Price" value={fmt(stats.invSellValue)} color={T.amber} icon="💰" />
                        <StatCard label="Potential Profit" value={fmt(stats.potentialProfit)} color={T.emerald} icon="📈" sub={`${pct(stats.potentialProfit, stats.invSellValue)} margin`} />
                        <StatCard label="Total SKUs" value={String(shopProducts.length)} color={T.violet} icon="🏷️" sub={`${shopProducts.filter(p => p.stock <= 0).length} out of stock`} />
                    </div>

                    {/* Category-wise breakdown */}
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", background: T.surface, borderBottom: `1px solid ${T.border}`, fontSize: 16, fontWeight: 800, color: T.t1 }}>Category-wise Inventory Valuation</div>
                      <div className="table-scroll">
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                    {["Category", "SKUs", "Total Qty", "Cost Value", "Sell Value", "Potential Profit", "Avg. Margin"].map(h => (
                                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: T.t3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", fontFamily: FONT.ui }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const cats = {};
                                    shopProducts.forEach(p => {
                                        if (!cats[p.category]) cats[p.category] = { count: 0, qty: 0, costVal: 0, sellVal: 0 };
                                        cats[p.category].count++;
                                        cats[p.category].qty += p.stock;
                                        cats[p.category].costVal += p.buyPrice * p.stock;
                                        cats[p.category].sellVal += p.sellPrice * p.stock;
                                    });
                                    return Object.entries(cats).sort((a, b) => b[1].costVal - a[1].costVal).map(([cat, data]) => (
                                        <tr key={cat} className="row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                                            <td style={{ padding: "12px 14px", fontWeight: 700, color: T.t1 }}>{cat}</td>
                                            <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.t2 }}>{data.count}</td>
                                            <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 700 }}>{data.qty}</td>
                                            <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.sky }}>{fmt(data.costVal)}</td>
                                            <td style={{ padding: "12px 14px", fontFamily: FONT.mono, color: T.amber }}>{fmt(data.sellVal)}</td>
                                            <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 800, color: T.emerald }}>{fmt(data.sellVal - data.costVal)}</td>
                                            <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontWeight: 700, color: data.sellVal > 0 ? T.emerald : T.t3 }}>{data.sellVal > 0 ? pct(data.sellVal - data.costVal, data.sellVal) : "—"}</td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Dead Stock */}
                    {(() => {
                        const dead = shopProducts.filter(p => p.stock > 0).filter(p => {
                            const lastSale = shopMovements.filter(m => m.productId === p.id && m.type === "SALE").sort((a, b) => b.date - a.date)[0];
                            return !lastSale || (Date.now() - lastSale.date > 90 * 86400000);
                        });
                        if (dead.length === 0) return null;
                        const deadValue = dead.reduce((s, p) => s + p.buyPrice * p.stock, 0);
                        return (
                            <div style={{ background: T.card, border: `1px solid rgba(239,68,68,0.25)`, borderRadius: 14, padding: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: T.crimson }}>💤 Dead Stock ({dead.length} products)</div>
                                        <div style={{ fontSize: 13, color: T.t3, marginTop: 2 }}>No sales in 90+ days. Capital locked: <span style={{ color: T.crimson, fontWeight: 800, fontFamily: FONT.mono }}>{fmt(deadValue)}</span></div>
                                    </div>
                                    <Btn variant="danger" size="sm" onClick={() => {
                                        const headers = ["Product", "SKU", "Stock", "Original Price", "Flash Sale Price (20% off)", "Savings"];
                                        const rows = dead.map(p => {
                                            const discPrice = Math.round(p.sellPrice * 0.8);
                                            return [p.name, p.sku, p.stock, p.sellPrice, discPrice, p.sellPrice - discPrice];
                                        });
                                        downloadCSV(`Flash_Sale_${fmtDate(Date.now()).replace(/\s/g, "_")}.csv`, generateCSV(headers, rows));
                                        toast?.(`Flash sale list exported: ${dead.length} products at 20% off`, "success", "🏷️ Flash Sale Created");
                                    }}>🏷️ Create Flash Sale</Btn>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                                    {dead.slice(0, 8).map(p => {
                                        const lastSale = shopMovements.filter(m => m.productId === p.id && m.type === "SALE").sort((a, b) => b.date - a.date)[0];
                                        return (
                                            <div key={p.id} style={{ background: T.crimsonBg, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 10, padding: "12px 14px" }}>
                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                    <span style={{ fontSize: 22 }}>{p.image}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, color: T.t1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                                                        <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{p.stock} units · {fmt(p.buyPrice * p.stock)} locked</div>
                                                        <div style={{ fontSize: 10, color: T.crimson, marginTop: 2 }}>Last sale: {lastSale ? daysAgo(lastSale.date) : "Never"}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    <Btn variant="subtle" onClick={() => {
                        const headers = ["SKU", "Product", "Category", "Stock", "Buy Price", "Cost Value", "Sell Price", "Sell Value", "Potential Profit", "Status"];
                        const rows = shopProducts.map(p => [p.sku, p.name, p.category, p.stock, p.buyPrice, p.buyPrice * p.stock, p.sellPrice, p.sellPrice * p.stock, (p.sellPrice - p.buyPrice) * p.stock, stockStatus(p) === "ok" ? "OK" : stockStatus(p) === "low" ? "LOW" : "OUT"]);
                        downloadCSV(`inventory_valuation_${fmtDate(Date.now()).replace(/\s/g, "_")}.csv`, generateCSV(headers, rows));
                        toast?.("Inventory valuation exported!", "success");
                    }}>📥 Export Inventory Valuation CSV</Btn>
                </div>
            )}

            {/* ===== AUDIT LOG ===== */}
            {view === "audit" && (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ background: T.card, border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: T.amber, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                        🔒 All actions are permanently logged for complete business transparency and accountability.
                    </div>

                    {/* Filter + Export */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                            value={auditTypeFilter}
                            onChange={e => { setAuditTypeFilter(e.target.value); setAuditVisible(50); }}
                            placeholder="Filter by action type (e.g. SALE, PRODUCT)…"
                            style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.t1, fontSize: 13, outline: "none", fontFamily: FONT.ui, transition: "border 0.15s" }}
                            onFocus={e => { e.target.style.borderColor = T.amber; e.target.style.boxShadow = `0 0 0 3px ${T.amber}22`; }}
                            onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                        />
                        <button onClick={() => window.print()} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", color: T.t2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.ui, whiteSpace: "nowrap", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.color = T.amber; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t2; }}>
                            🖨 Export PDF
                        </button>
                    </div>

                    {(() => {
                        const allAudit = (auditLog || []);
                        const filteredAudit = auditTypeFilter
                            ? allAudit.filter(e => (e.action || "").toLowerCase().includes(auditTypeFilter.toLowerCase()))
                            : allAudit;
                        const visibleAudit = filteredAudit.slice(0, auditVisible);
                        return (
                            <>
                                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                                  <div className="table-scroll">
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                                                {["Timestamp", "Action", "Entity", "Details"].map(h => (
                                                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: T.t3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: FONT.ui }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAudit.length === 0 ? (
                                                <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: T.t3 }}>
                                                    {auditTypeFilter ? `No entries matching "${auditTypeFilter}"` : "No audit entries yet."}
                                                </td></tr>
                                            ) : visibleAudit.map((entry, i) => (
                                                <tr key={entry.id || i} className="row-hover" style={{ borderBottom: `1px solid ${T.border}` }}>
                                                    <td style={{ padding: "10px 14px", fontFamily: FONT.mono, fontSize: 11, color: T.t3, whiteSpace: "nowrap" }}>{fmtDate(entry.timestamp)}<br />{new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                                                    <td style={{ padding: "10px 14px" }}>
                                                        <span style={{ background: `${T.amber}18`, color: T.amber, fontSize: 10, padding: "3px 8px", borderRadius: 5, fontWeight: 700, fontFamily: FONT.mono }}>{entry.action}</span>
                                                    </td>
                                                    <td style={{ padding: "10px 14px", fontSize: 12, color: T.t2 }}>
                                                        <span style={{ color: T.t3, fontSize: 10 }}>{entry.entityType}/</span>{entry.entityId}
                                                    </td>
                                                    <td style={{ padding: "10px 14px", fontSize: 12, color: T.t3, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>{entry.details}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                  </div>
                                </div>
                                {auditVisible < filteredAudit.length && (
                                    <div style={{ textAlign: "center", padding: "8px 0" }}>
                                        <button onClick={() => setAuditVisible(v => v + 50)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 24px", color: T.t3, cursor: "pointer", fontSize: 13, fontFamily: FONT.ui, transition: "all 0.15s" }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.color = T.amber; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.t3; }}>
                                            Load 50 more ({filteredAudit.length - auditVisible} remaining)
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
