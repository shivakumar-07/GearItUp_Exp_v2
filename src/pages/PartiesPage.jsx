import { useState, useMemo, useEffect } from "react";
import { T, FONT } from "../theme";
import { fmt, fmtDate, daysAgo, uid, downloadCSV, generateCSV } from "../utils";
import { Btn, Input, Select, Modal, Field, Divider } from "../components/ui";
import { MANUFACTURERS, getModelsForMfg } from "../vehicleData";

export function PartiesPage({ parties, movements, vehicles, activeShopId, onSaveParty, onSaveVehicle, toast }) {
    const [view, setView] = useState("customers");
    const [search, setSearch] = useState("");
    const [editParty, setEditParty] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    // Add Vehicle inline form state
    const [showVehForm, setShowVehForm] = useState(false);
    const blankVeh = { make: "", model: "", year: "", fuelType: "Petrol", registrationNumber: "", ownerId: "", engineType: "", odometer: "" };
    const [vehForm, setVehForm] = useState(blankVeh);
    const setVF = k => v => setVehForm(p => ({ ...p, [k]: v }));
    const vehModels = useMemo(() => vehForm.make ? getModelsForMfg(vehForm.make) : [], [vehForm.make]);
    const currentYear = new Date().getFullYear();
    const yearOpts = Array.from({ length: 30 }, (_, i) => currentYear - i);

    const handleSaveVehicle = () => {
        if (!vehForm.make || !vehForm.model || !vehForm.registrationNumber) {
            toast?.("Make, model and registration number are required", "error");
            return;
        }
        const vehicle = {
            id: "veh_" + uid(),
            shopId: activeShopId,
            make: vehForm.make,
            model: vehForm.model,
            variant: "",
            year: +vehForm.year || currentYear,
            fuelType: vehForm.fuelType || "Petrol",
            engineType: vehForm.engineType || "",
            registrationNumber: vehForm.registrationNumber.toUpperCase(),
            odometer: +vehForm.odometer || 0,
            vin: "",
            ownerId: vehForm.ownerId || "",
            notes: "",
            createdAt: Date.now(),
        };
        onSaveVehicle?.(vehicle);
        toast?.(`Vehicle ${vehicle.registrationNumber} added!`, "success", "🚗");
        setVehForm(blankVeh);
        setShowVehForm(false);
    };

    const shopParties = useMemo(() => (parties || []).filter(p => p.shopId === activeShopId), [parties, activeShopId]);
    const shopVehicles = useMemo(() => (vehicles || []).filter(v => v.shopId === activeShopId), [vehicles, activeShopId]);
    const shopMovements = useMemo(() => (movements || []).filter(m => m.shopId === activeShopId), [movements, activeShopId]);

    const filtered = useMemo(() => {
        const typeFilter = view === "customers" ? "customer" : "supplier";
        return shopParties
            .filter(p => p.type === typeFilter || p.type === "both")
            .filter(p => !search || [p.name, p.phone, p.gstin, p.city].some(s => (s || "").toLowerCase().includes(search.toLowerCase())))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [shopParties, view, search]);

    // Calculate outstanding balance per party from movements
    const getBalance = (party) => {
        let balance = party.openingBalance || 0;
        shopMovements.forEach(m => {
            if (party.type === "customer" || party.type === "both") {
                if (m.customerName === party.name && m.type === "SALE" && (m.paymentStatus === "pending" || m.paymentMode === "Credit")) balance += m.total;
                if (m.type === "RECEIPT" && m.customerName === party.name) balance -= m.total;
            }
            if (party.type === "supplier" || party.type === "both") {
                if ((m.supplierName === party.name || m.supplier === party.name) && m.type === "PURCHASE" && (m.paymentStatus === "pending" || m.paymentMode === "Credit")) balance += m.total;
                if (m.type === "PAYMENT" && m.supplierName === party.name) balance -= m.total;
            }
        });
        return balance;
    };

    const getTransactionCount = (party) => {
        return shopMovements.filter(m =>
            m.customerName === party.name || m.supplierName === party.name || m.supplier === party.name
        ).length;
    };

    // Credit aging: days since oldest unpaid credit transaction
    const getCreditAge = (party) => {
        const creditMoves = shopMovements.filter(m => {
            const matchesParty = m.customerName === party.name || m.supplierName === party.name || m.supplier === party.name;
            return matchesParty && (m.paymentStatus === "pending" || m.paymentMode === "Credit") && (m.type === "SALE" || m.type === "PURCHASE");
        }).sort((a, b) => a.date - b.date);
        if (creditMoves.length === 0) return 0;
        return Math.floor((Date.now() - creditMoves[0].date) / 86400000);
    };

    const totalOutstanding = filtered.reduce((s, p) => s + getBalance(p), 0);

    const agingBuckets = useMemo(() => {
        const buckets = { d30: 0, d60: 0, d60plus: 0 };
        filtered.forEach(p => {
            const age = getCreditAge(p);
            const bal = getBalance(p);
            if (bal <= 0) return;
            if (age <= 30) buckets.d30 += bal;
            else if (age <= 60) buckets.d60 += bal;
            else buckets.d60plus += bal;
        });
        return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtered, shopMovements]);

    const stats = {
        total: filtered.length,
        withCredit: filtered.filter(p => getBalance(p) > 0).length,
        totalOutstanding,
    };

    // Party Ledger (transaction list)
    const getPartyLedger = (party) => {
        return shopMovements
            .filter(m => m.customerName === party.name || m.supplierName === party.name || m.supplier === party.name)
            .sort((a, b) => b.date - a.date)
            .slice(0, 20);
    };

    const handleExportCSV = () => {
        const headers = ["Name", "Type", "Phone", "GSTIN", "City", "Credit Limit", "Outstanding", "Transactions", "Tags"];
        const rows = filtered.map(p => [p.name, p.type, p.phone, p.gstin || "", p.city || "", p.creditLimit, getBalance(p), getTransactionCount(p), (p.tags || []).join(", ")]);
        downloadCSV(`${view}_${fmtDate(Date.now()).replace(/\s/g, "_")}.csv`, generateCSV(headers, rows));
        toast?.("Party list exported!", "success");
    };

    return (
        <div className="page-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
                {[["customers", "👤 Customers"], ["suppliers", "🏭 Suppliers"], ["vehicles", "🚗 Vehicles"]].map(([id, label]) => (
                    <button key={id} onClick={() => setView(id)} className="btn-hover-subtle"
                        style={{ background: view === id ? `${T.amber}22` : "transparent", color: view === id ? T.amber : T.t3, border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FONT.ui, transition: "0.2s" }}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Vehicles Tab */}
            {view === "vehicles" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Toolbar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, color: T.t3 }}>
                            <span style={{ fontWeight: 700, color: T.t1 }}>{shopVehicles.length}</span> vehicles registered
                        </div>
                        <Btn size="sm" onClick={() => setShowVehForm(v => !v)}>
                            {showVehForm ? "✕ Cancel" : "＋ Add Vehicle"}
                        </Btn>
                    </div>

                    {/* Inline Add Vehicle Form */}
                    {showVehForm && (
                        <div style={{ background: T.card, border: `1px solid ${T.amber}44`, borderRadius: 14, padding: 20, animation: "fadeUp 0.2s ease" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>New Vehicle</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
                                {/* Make */}
                                <Field label="Make *">
                                    <select value={vehForm.make} onChange={e => setVF("make")(e.target.value)}
                                        style={{ width: "100%", background: T.surface, border: `1px solid ${vehForm.make ? T.amber + "66" : T.border}`, borderRadius: 8, padding: "9px 12px", color: vehForm.make ? T.t1 : T.t3, fontSize: 13, fontFamily: FONT.ui, outline: "none", cursor: "pointer" }}>
                                        <option value="">Select make…</option>
                                        {MANUFACTURERS.map(m => <option key={m.id} value={m.id}>{m.logo} {m.name}</option>)}
                                    </select>
                                </Field>
                                {/* Model */}
                                <Field label="Model *">
                                    <select value={vehForm.model} onChange={e => setVF("model")(e.target.value)}
                                        style={{ width: "100%", background: T.surface, border: `1px solid ${vehForm.model ? T.amber + "66" : T.border}`, borderRadius: 8, padding: "9px 12px", color: vehForm.model ? T.t1 : T.t3, fontSize: 13, fontFamily: FONT.ui, outline: "none", cursor: "pointer" }}
                                        disabled={!vehForm.make}>
                                        <option value="">Select model…</option>
                                        {vehModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </Field>
                                {/* Year */}
                                <Field label="Year">
                                    <select value={vehForm.year} onChange={e => setVF("year")(e.target.value)}
                                        style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", color: T.t1, fontSize: 13, fontFamily: FONT.ui, outline: "none", cursor: "pointer" }}>
                                        <option value="">Year</option>
                                        {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </Field>
                                {/* Fuel */}
                                <Field label="Fuel Type">
                                    <select value={vehForm.fuelType} onChange={e => setVF("fuelType")(e.target.value)}
                                        style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", color: T.t1, fontSize: 13, fontFamily: FONT.ui, outline: "none", cursor: "pointer" }}>
                                        {["Petrol", "Diesel", "CNG", "Electric", "Hybrid"].map(f => <option key={f}>{f}</option>)}
                                    </select>
                                </Field>
                                {/* Reg Number */}
                                <Field label="Reg. Number *">
                                    <Input value={vehForm.registrationNumber} onChange={setVF("registrationNumber")} placeholder="TS09AB1234" />
                                </Field>
                                {/* Owner */}
                                <Field label="Owner">
                                    <select value={vehForm.ownerId} onChange={e => setVF("ownerId")(e.target.value)}
                                        style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", color: T.t1, fontSize: 13, fontFamily: FONT.ui, outline: "none", cursor: "pointer" }}>
                                        <option value="">No owner</option>
                                        {shopParties.filter(p => p.type === "customer" || p.type === "both").map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </Field>
                                {/* Engine */}
                                <Field label="Engine Type">
                                    <Input value={vehForm.engineType} onChange={setVF("engineType")} placeholder="1.2L VTEC" />
                                </Field>
                                {/* Odometer */}
                                <Field label="Odometer (km)">
                                    <Input type="number" value={vehForm.odometer} onChange={setVF("odometer")} placeholder="45000" suffix="km" />
                                </Field>
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                                <Btn variant="ghost" size="sm" onClick={() => { setVehForm(blankVeh); setShowVehForm(false); }}>Cancel</Btn>
                                <Btn size="sm" onClick={handleSaveVehicle}>🚗 Save Vehicle</Btn>
                            </div>
                        </div>
                    )}

                    {/* Vehicle Cards Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                        {shopVehicles.map(v => {
                            const owner = shopParties.find(p => p.id === v.ownerId);
                            return (
                                <div key={v.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, transition: "0.2s" }} className="row-hover">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 18, fontWeight: 900, color: T.t1 }}>{v.make} {v.model}</div>
                                            <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>{v.variant} · {v.year} · {v.fuelType}</div>
                                        </div>
                                        <span style={{ background: T.skyBg, color: T.sky, padding: "4px 10px", borderRadius: 6, fontWeight: 800, fontFamily: FONT.mono, fontSize: 13 }}>{v.registrationNumber}</span>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                                        <div><span style={{ color: T.t3 }}>Owner:</span> <span style={{ color: T.t1, fontWeight: 600 }}>{owner?.name || "—"}</span></div>
                                        <div><span style={{ color: T.t3 }}>Engine:</span> <span style={{ color: T.t2 }}>{v.engineType || "—"}</span></div>
                                        <div><span style={{ color: T.t3 }}>Odometer:</span> <span style={{ color: T.amber, fontWeight: 700, fontFamily: FONT.mono }}>{(v.odometer || 0).toLocaleString()} km</span></div>
                                        <div><span style={{ color: T.t3 }}>VIN:</span> <span style={{ color: T.t2, fontFamily: FONT.mono, fontSize: 10 }}>{v.vin || "—"}</span></div>
                                    </div>
                                    {v.notes && <div style={{ marginTop: 10, padding: "8px 12px", background: `${T.amber}0A`, borderRadius: 8, fontSize: 11, color: T.t3 }}>📝 {v.notes}</div>}
                                </div>
                            );
                        })}
                    </div>
                    {shopVehicles.length === 0 && !showVehForm && (
                        <div style={{ textAlign: "center", padding: 48 }}>
                            <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>🚗</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: T.t2, marginBottom: 6 }}>No vehicles registered yet</div>
                            <div style={{ fontSize: 13, color: T.t3, marginBottom: 20 }}>Add a vehicle to track service history and compatible parts</div>
                            <Btn size="sm" onClick={() => setShowVehForm(true)}>＋ Add First Vehicle</Btn>
                        </div>
                    )}
                </div>
            )}

            {/* Customer/Supplier Tabs */}
            {view !== "vehicles" && (
                <>
                    {/* Stats Bar */}
                    <div className="stats-flex" style={{ display: "flex", gap: 12 }}>
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 20px", flex: 1 }}>
                            <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase" }}>Total {view}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: FONT.mono }}>{stats.total}</div>
                        </div>
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 20px", flex: 1 }}>
                            <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase" }}>With Credit</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: T.crimson, fontFamily: FONT.mono }}>{stats.withCredit}</div>
                        </div>
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 20px", flex: 2 }}>
                            <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase" }}>Total Outstanding</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: totalOutstanding > 0 ? T.crimson : T.emerald, fontFamily: FONT.mono }}>{fmt(totalOutstanding)}</div>
                        </div>
                    </div>

                    {/* Credit Aging Summary */}
                    {(agingBuckets.d30 > 0 || agingBuckets.d60 > 0 || agingBuckets.d60plus > 0) && (
                        <div className="aging-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <div style={{ background: T.card, border: `1px solid ${T.emeraldDim}`, borderRadius: 10, padding: "10px 16px" }}>
                                <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>0–30 Days</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: T.emerald, fontFamily: FONT.mono }}>{fmt(agingBuckets.d30)}</div>
                                <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>Recent credit</div>
                            </div>
                            <div style={{ background: T.card, border: `1px solid ${T.amberDim}`, borderRadius: 10, padding: "10px 16px" }}>
                                <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>31–60 Days</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>{fmt(agingBuckets.d60)}</div>
                                <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>Follow up needed</div>
                            </div>
                            <div style={{ background: T.card, border: `1px solid ${T.crimsonDim}`, borderRadius: 10, padding: "10px 16px" }}>
                                <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>60+ Days</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: T.crimson, fontFamily: FONT.mono }}>{fmt(agingBuckets.d60plus)}</div>
                                <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>Overdue — urgent</div>
                            </div>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ flex: 1 }}><Input value={search} onChange={setSearch} placeholder={`Search ${view}…`} icon="🔍" /></div>
                        <Btn variant="subtle" size="sm" onClick={handleExportCSV}>📥 Export CSV</Btn>
                        <Btn size="sm" onClick={() => { setEditParty(null); setShowAddModal(true); }}>＋ Add {view === "customers" ? "Customer" : "Supplier"}</Btn>
                    </div>

                    {/* Table */}
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                      <div className="table-scroll">
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                                    {["Name", "Phone", "GSTIN", "City", "Credit Limit", "Outstanding", "Txns", "Tags", ""].map((h, i) => (
                                        <th key={i} style={{ padding: "10px 14px", textAlign: "left", color: T.t3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", fontFamily: FONT.ui }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={9} style={{ padding: 48, textAlign: "center", color: T.t3 }}>No {view} found.</td></tr>
                                ) : filtered.map(p => {
                                    const bal = getBalance(p);
                                    const txns = getTransactionCount(p);
                                    const isExpanded = expandedId === p.id;
                                    return (
                                        <>
                                            <tr key={p.id} className="row-hover" style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                                                <td style={{ padding: "12px 14px" }}>
                                                    <div style={{ fontWeight: 700, color: T.t1, fontSize: 13 }}>{p.name}</div>
                                                    {p.email && <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>{p.email}</div>}
                                                    {/* Credit aging badge */}
                                                    {bal > 0 && (() => {
                                                        const age = getCreditAge(p);
                                                        if (age <= 0) return null;
                                                        const color = age > 60 ? T.crimson : age > 30 ? T.amber : T.emerald;
                                                        return <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}22`, padding: "1px 6px", borderRadius: 4, marginTop: 3, display: "inline-block" }}>{age}d overdue</span>;
                                                    })()}
                                                    {/* Mini balance bar */}
                                                    {(() => {
                                                        const limit = p.creditLimit || 0;
                                                        const pct = limit > 0 ? Math.min(100, (bal / limit) * 100) : 0;
                                                        if (bal <= 0) return null;
                                                        return (
                                                            <div style={{ marginTop: 6 }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                                    <span style={{ fontSize: 11, color: T.t3 }}>Credit used</span>
                                                                    <span style={{ fontSize: 11, fontFamily: FONT.mono, color: T.amber }}>{fmt(bal)}{limit > 0 ? ` / ${fmt(limit)}` : ""}</span>
                                                                </div>
                                                                {limit > 0 && (
                                                                    <div style={{ height: 4, background: T.border, borderRadius: 2 }}>
                                                                        <div style={{ height: "100%", borderRadius: 2, background: pct > 80 ? T.crimson : pct > 50 ? T.amber : T.emerald, width: `${pct}%`, transition: "width 0.3s" }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontSize: 12, color: T.t2 }}>{p.phone}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontSize: 11, color: p.gstin ? T.t2 : T.t4 }}>{p.gstin || "—"}</td>
                                                <td style={{ padding: "12px 14px", fontSize: 12, color: T.t2 }}>{p.city || "—"}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontSize: 12, color: T.t2 }}>{fmt(p.creditLimit)}</td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontSize: 14, fontWeight: 800, color: bal > 0 ? T.crimson : T.emerald }}>
                                            {bal > 0 ? fmt(bal) : "—"}
                                            {/* Credit limit usage bar */}
                                            {bal > 0 && p.creditLimit > 0 && (
                                                <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: T.border, width: "100%" }}>
                                                    <div style={{
                                                        height: "100%", borderRadius: 2,
                                                        width: `${Math.min(100, (bal / p.creditLimit) * 100)}%`,
                                                        background: bal > p.creditLimit ? T.crimson : bal > p.creditLimit * 0.8 ? T.amber : T.emerald,
                                                        transition: "width 0.3s ease",
                                                    }} />
                                                </div>
                                            )}
                                        </td>
                                                <td style={{ padding: "12px 14px", fontFamily: FONT.mono, fontSize: 12, color: T.t2 }}>{txns}</td>
                                                <td style={{ padding: "12px 14px" }}>
                                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                        {(p.tags || []).map(t => (
                                                            <span key={t} style={{ background: `${T.amber}14`, color: T.amber, fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{t}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: "12px 14px" }}>
                                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                                        <Btn size="xs" variant="subtle" onClick={(e) => { e.stopPropagation(); setEditParty(p); setShowAddModal(true); }}>Edit</Btn>
                                                        {bal > 0 && p.phone && (
                                                            <Btn size="xs" variant="emerald" onClick={(e) => {
                                                                e.stopPropagation();
                                                                const msg = `Namaste ${p.name}, aapka hamare shop mein ₹${fmt(bal)} ka baki hai. Kripya jald payment karein. Dhanyawaad.`;
                                                                window.open(`https://wa.me/91${(p.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                                                                toast?.("WhatsApp reminder opened", "success");
                                                            }}>WhatsApp</Btn>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={p.id + "_detail"}>
                                                    <td colSpan={9} style={{ padding: "0 14px 14px 14px", background: T.surface }}>
                                                        <div style={{ fontSize: 12, fontWeight: 800, color: T.t1, marginBottom: 8, marginTop: 8 }}>Recent Transactions</div>
                                                        {getPartyLedger(p).length === 0 ? (
                                                            <div style={{ color: T.t3, fontSize: 12 }}>No transactions yet.</div>
                                                        ) : (() => {
                                                            // Compute running balance (oldest → newest, then reverse for display)
                                                            let running = p.openingBalance || 0;
                                                            const ledgerWithBalance = getPartyLedger(p).slice().reverse().map(m => {
                                                                if (m.type === "SALE" && (m.paymentStatus === "pending" || m.paymentMode === "Credit")) running += m.total;
                                                                else if (m.type === "RECEIPT") running -= m.total;
                                                                else if (m.type === "PURCHASE" && (m.paymentStatus === "pending" || m.paymentMode === "Credit")) running += m.total;
                                                                else if (m.type === "PAYMENT") running -= m.total;
                                                                return { ...m, runningBal: running };
                                                            }).reverse();
                                                            return (
                                                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                                                    <thead>
                                                                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                                                            {["Date", "Type", "Product", "Amount", "Status", "Balance"].map(h => (
                                                                                <th key={h} style={{ padding: "5px 8px", textAlign: "left", color: T.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FONT.ui }}>{h}</th>
                                                                            ))}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {ledgerWithBalance.map(m => (
                                                                            <tr key={m.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                                                                                <td style={{ padding: "6px 8px", color: T.t3 }}>{fmtDate(m.date)}</td>
                                                                                <td style={{ padding: "6px 8px", color: T.t2, fontWeight: 600 }}>{m.type}</td>
                                                                                <td style={{ padding: "6px 8px", color: T.t2 }}>{m.productName || "—"}</td>
                                                                                <td style={{ padding: "6px 8px", fontFamily: FONT.mono, fontWeight: 700, color: m.type === "SALE" || m.type === "PURCHASE" ? T.amber : T.emerald }}>{fmt(m.total)}</td>
                                                                                <td style={{ padding: "6px 8px", color: m.paymentStatus === "paid" || m.paymentStatus === "completed" ? T.emerald : T.crimson, fontWeight: 600, fontSize: 10 }}>{m.paymentStatus || "—"}</td>
                                                                                <td style={{ padding: "6px 8px", fontFamily: FONT.mono, fontWeight: 700, color: T.amber }}>{fmt(m.runningBal)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            );
                                                        })()}
                                                        {p.notes && <div style={{ marginTop: 8, padding: "6px 10px", background: `${T.amber}08`, borderRadius: 6, fontSize: 11, color: T.t3 }}>📝 {p.notes}</div>}
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
                </>
            )}

            {/* Add/Edit Party Modal */}
            <PartyFormModal
                open={showAddModal}
                party={editParty}
                type={view === "customers" ? "customer" : "supplier"}
                onClose={() => { setShowAddModal(false); setEditParty(null); }}
                onSave={(p) => {
                    onSaveParty?.(p);
                    toast?.(editParty ? `${p.name} updated!` : `${p.name} added!`, "success");
                    setShowAddModal(false);
                    setEditParty(null);
                }}
                activeShopId={activeShopId}
            />
        </div>
    );
}

// ===== Party Form Modal =====
function PartyFormModal({ open, party, type, onClose, onSave, activeShopId }) {
    const isEdit = !!party;
    const blank = { name: "", phone: "", email: "", gstin: "", address: "", city: "", creditLimit: "0", creditDays: "30", loyaltyPoints: "0", openingBalance: "0", tags: "", notes: "" };
    const [f, setF] = useState(blank);

    useEffect(() => {
        if (party) {
            setF({ ...party, creditLimit: String(party.creditLimit || 0), creditDays: String(party.creditDays || 30), loyaltyPoints: String(party.loyaltyPoints || 0), openingBalance: String(party.openingBalance || 0), tags: (party.tags || []).join(", ") });
        } else {
            setF(blank);
        }
    }, [party, open]);

    const set = k => v => setF(p => ({ ...p, [k]: v }));

    const handleSave = () => {
        if (!f.name.trim()) return;
        onSave({
            ...f,
            id: party?.id || (type === "customer" ? "cust" : "sup") + "_" + uid(),
            shopId: party?.shopId || activeShopId,
            type: party?.type || type,
            creditLimit: +f.creditLimit || 0,
            creditDays: +f.creditDays || 30,
            loyaltyPoints: +f.loyaltyPoints || 0,
            openingBalance: +f.openingBalance || 0,
            tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
            vehicles: party?.vehicles || [],
            isActive: true,
            createdAt: party?.createdAt || Date.now(),
        });
    };

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${type === "customer" ? "Customer" : "Supplier"}` : `Add ${type === "customer" ? "Customer" : "Supplier"}`} width={560}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "span 2" }}><Field label="Name" required><Input value={f.name} onChange={set("name")} placeholder="Business or person name" /></Field></div>
                <Field label="Phone"><Input value={f.phone} onChange={set("phone")} placeholder="+91 9876543210" /></Field>
                <Field label="Email"><Input value={f.email} onChange={set("email")} placeholder="email@example.com" /></Field>
                <Field label="GSTIN"><Input value={f.gstin} onChange={set("gstin")} placeholder="22AAAAA0000A1Z5" /></Field>
                <Field label="City"><Input value={f.city} onChange={set("city")} placeholder="Hyderabad" /></Field>
                <div style={{ gridColumn: "span 2" }}><Field label="Address"><Input value={f.address} onChange={set("address")} placeholder="Full address" /></Field></div>
                <Divider label="Credit & Finance" />
                <div style={{ gridColumn: "span 2" }} />
                <Field label="Credit Limit (₹)"><Input type="number" value={f.creditLimit} onChange={set("creditLimit")} prefix="₹" /></Field>
                <Field label="Credit Days"><Input type="number" value={f.creditDays} onChange={set("creditDays")} suffix="days" /></Field>
                <Field label="Opening Balance (₹)"><Input type="number" value={f.openingBalance} onChange={set("openingBalance")} prefix="₹" /></Field>
                {type === "customer" && <Field label="Loyalty Points"><Input type="number" value={f.loyaltyPoints} onChange={set("loyaltyPoints")} /></Field>}
                <div style={{ gridColumn: "span 2" }}><Field label="Tags (comma-separated)"><Input value={f.tags} onChange={set("tags")} placeholder="regular, mechanic, credit" /></Field></div>
                <div style={{ gridColumn: "span 2" }}><Field label="Notes"><Input value={f.notes} onChange={set("notes")} placeholder="Internal notes" /></Field></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                <Btn variant="amber" onClick={handleSave}>💾 {isEdit ? "Save Changes" : `Add ${type === "customer" ? "Customer" : "Supplier"}`}</Btn>
            </div>
        </Modal>
    );
}
