import { useState, useEffect } from "react";
import { T, FONT } from "../theme";
import { uid, CATEGORIES, POSITIONS, ENGINE_TYPES, TRANSMISSIONS, EMOJIS, fmt } from "../utils";
import { MASTER_PRODUCTS } from "../marketplace/api/mockDatabase";
import { Modal, Field, Input, Select, Divider, Btn } from "./ui";

export function ProductModal({ open, onClose, product, products, onSave, toast, activeShopId }) {
    const isEdit = !!product;
    const blank = { name: "", sku: "", hsnCode: "", category: "Engine", brand: "", vehicles: "", buyPrice: "", sellPrice: "", mrp: "", stock: "", minStock: "10", maxStock: "1000", reorderQty: "20", location: "", supplier: "", image: "📦", gstRate: "18", trackBatch: false, batchNumber: "", expiryDate: "", notes: "", oemNumber: "", position: "", engineType: "", transmission: "", condition: "New", warranty: "", globalSku: null };
    const [f, setF] = useState(blank);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    // Global SKU search
    const [showCatalogSearch, setShowCatalogSearch] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState("");

    useEffect(() => {
        setF(product ? { ...product, buyPrice: String(product.buyPrice), sellPrice: String(product.sellPrice), mrp: String(product.mrp || ""), stock: String(product.stock), minStock: String(product.minStock), maxStock: String(product.maxStock || 1000), reorderQty: String(product.reorderQty || 20), gstRate: String(product.gstRate || product.gst || 18), hsnCode: product.hsnCode || "", trackBatch: !!product.trackBatch, batchNumber: product.batchNumber || "", expiryDate: product.expiryDate || "", vehicles: product.vehicles || (product.compatibleVehicles || []).join(", "), oemNumber: product.oemNumber || "", position: product.position || "", engineType: product.engineType || "", transmission: product.transmission || "", condition: product.condition || "New", warranty: product.warranty || "", globalSku: product.globalSku || null } : blank);
        setErrors({});
        setShowCatalogSearch(false);
        setCatalogSearch("");
    }, [product, open]);

    const set = k => v => setF(p => ({ ...p, [k]: v }));
    const profit = f.buyPrice && f.sellPrice ? +f.sellPrice - +f.buyPrice : null;
    const mg = profit !== null && +f.sellPrice > 0 ? ((profit / +f.sellPrice) * 100).toFixed(1) : null;

    const validate = () => {
        const e = {};
        if (!f.name.trim()) e.name = "Required";
        if (!f.sku.trim()) e.sku = "Required";
        if (!f.buyPrice || isNaN(f.buyPrice)) e.buyPrice = "Invalid";
        if (!f.sellPrice || isNaN(f.sellPrice)) e.sellPrice = "Invalid";
        if (f.stock === "" || isNaN(f.stock)) e.stock = "Required";
        setErrors(e);
        return !Object.keys(e).length;
    };

    const handleSelectCatalogItem = (item) => {
        setF(prev => ({
            ...prev,
            name: item.name,
            sku: item.sku,
            category: item.category,
            brand: item.brand,
            oemNumber: item.oem_part_no || prev.oemNumber,
            globalSku: item.id,
            vehicles: item.compatibility ? item.compatibility.join(", ") : prev.vehicles,
            mrp: prev.mrp || String(Math.round((item.selling_price || item.mrp || 1000) * 1.25)), // give some reasonable default if blank
            sellPrice: prev.sellPrice || String((item.selling_price || item.mrp || 1000)),
            // Don't overwrite stock or buyPrice
        }));
        setShowCatalogSearch(false);
        toast(`Linked to Global Catalog: ${item.name}`, "info");
    };

    const handleSave = async () => {
        if (!validate()) return;
        // Duplicate SKU guard
        const skuConflict = (products || []).some(
            p => p.sku && p.sku.toLowerCase() === f.sku.toLowerCase() && p.id !== product?.id
        );
        if (skuConflict) {
            setErrors(e => ({ ...e, sku: "SKU already exists. Use a unique SKU." }));
            return;
        }
        setSaving(true);
        await new Promise(r => setTimeout(r, 200));
        onSave({ ...f, id: product?.id || "p" + uid(), shopId: product?.shopId || activeShopId, buyPrice: +f.buyPrice, sellPrice: +f.sellPrice, mrp: +f.mrp || null, stock: +f.stock, minStock: +f.minStock || 10, maxStock: +f.maxStock || 1000, reorderQty: +f.reorderQty || 20, gstRate: +f.gstRate || 18, hsnCode: f.hsnCode || "", trackBatch: !!f.trackBatch, batchNumber: f.batchNumber || "", expiryDate: f.expiryDate || "", oemNumber: f.oemNumber || "", position: f.position || "", engineType: f.engineType || "", transmission: f.transmission || "", condition: f.condition || "New", warranty: f.warranty || "", globalSku: f.globalSku });
        toast(isEdit ? "Product updated!" : "Product added to inventory!", "success", isEdit ? undefined : "New Product");
        setSaving(false);
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? "Edit Product" : "Add New Product"} subtitle={isEdit ? `SKU: ${product.sku}` : "Register a new product in your inventory"} width={680}>
            <div style={{ marginBottom: 16 }}>
                <Field label="Product Icon / Image">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {EMOJIS.map(e => (
                            <button key={e} onClick={() => set("image")(e)} style={{ width: 34, height: 34, borderRadius: 7, border: `1.5px solid ${f.image === e ? T.amber : T.border}`, background: f.image === e ? T.amberGlow : "transparent", cursor: "pointer", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>{e}</button>
                        ))}
                    </div>
                </Field>
            </div>

            {/* Catalog Linker */}
            <div style={{ marginBottom: 20, padding: "14px", background: f.globalSku ? `${T.emerald}11` : T.surface, border: `1px solid ${f.globalSku ? T.emerald : T.border}`, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: f.globalSku ? T.emerald : T.t2, display: "flex", alignItems: "center", gap: 6 }}>
                        {f.globalSku ? "✅ Linked to Global Catalog" : "🌐 Link to Global Catalog SKU (Optional)"}
                    </div>
                    {f.globalSku ? (
                        <Btn size="xs" variant="ghost" onClick={() => set("globalSku")(null)}>Unlink</Btn>
                    ) : (
                        <Btn size="xs" variant={showCatalogSearch ? "ghost" : "amber"} onClick={() => setShowCatalogSearch(!showCatalogSearch)}>
                            {showCatalogSearch ? "Cancel" : "🔍 Search Catalog"}
                        </Btn>
                    )}
                </div>
                {f.globalSku && (
                    <div style={{ fontSize: 12, color: T.t3, fontFamily: FONT.mono }}>SKU ID: {f.globalSku}</div>
                )}
                {showCatalogSearch && !f.globalSku && (
                    <div style={{ marginTop: 10 }}>
                        <Input value={catalogSearch} onChange={setCatalogSearch} placeholder="Search master catalog by Name or SKU..." autoFocus />
                        {catalogSearch.length >= 2 && (
                            <div style={{ marginTop: 8, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
                                {MASTER_PRODUCTS.filter(p => (p.name + p.sku + p.brand).toLowerCase().includes(catalogSearch.toLowerCase())).slice(0, 5).map(m => (
                                    <div key={m.id} onClick={() => handleSelectCatalogItem(m)} className="row-hover" style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{m.name}</div>
                                            <div style={{ fontSize: 10, color: T.t3 }}>{m.brand} · {m.sku}</div>
                                        </div>
                                        <Btn size="xs" variant="subtle">Select</Btn>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="inner-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "span 2" }}><Field label="Product Name" required error={errors.name}><Input value={f.name} onChange={set("name")} placeholder="Bosch Brake Pad Set — Front" /></Field></div>
                <Field label="SKU / Code" required error={errors.sku}><Input value={f.sku} onChange={set("sku")} placeholder="BRK-F-0042" /></Field>
                <Field label="HSN / SAC Code" hint="For GST filing"><Input value={f.hsnCode} onChange={set("hsnCode")} placeholder="87083000" /></Field>
                <Field label="Category"><Select value={f.category} onChange={set("category")} options={CATEGORIES.map(c => ({ value: c, label: c }))} /></Field>
                <Field label="Brand / Manufacturer"><Input value={f.brand} onChange={set("brand")} placeholder="Bosch, NGK…" /></Field>
                <Field label="Supplier"><Input value={f.supplier} onChange={set("supplier")} placeholder="Supplier name" /></Field>
                <Field label="Storage Location" hint="Rack / shelf code"><Input value={f.location} onChange={set("location")} placeholder="Rack A-12" /></Field>
                <div style={{ gridColumn: "span 2" }}><Field label="Vehicle Compatibility"><Input value={f.vehicles} onChange={set("vehicles")} placeholder="Car — Swift, i20 / Bike — Splendor, Activa" disabled={!!f.globalSku} /></Field></div>

                <Divider label="Offer Details" />
                <div style={{ gridColumn: "span 2" }} />
                <Field label="Condition"><Select value={f.condition} onChange={set("condition")} options={[{ value: "New", label: "New" }, { value: "Refurbished", label: "Refurbished" }, { value: "Used", label: "Used / Second Hand" }]} /></Field>
                <Field label="Warranty" hint="e.g. 6 Months, 1 Year"><Input value={f.warranty} onChange={set("warranty")} placeholder="6 Months" /></Field>

                <Divider label="Automobile Specs" />
                <div style={{ gridColumn: "span 2" }} />
                <div style={{ gridColumn: "span 2" }}><Field label="OEM Part Number" hint="Original Equipment Manufacturer number"><Input value={f.oemNumber} onChange={set("oemNumber")} placeholder="e.g. 04465-02220" /></Field></div>
                <Field label="Position"><Select value={f.position} onChange={set("position")} options={[{ value: "", label: "— None —" }, ...POSITIONS.map(v => ({ value: v, label: v }))]} /></Field>
                <Field label="Engine Type"><Select value={f.engineType} onChange={set("engineType")} options={[{ value: "", label: "— None —" }, ...ENGINE_TYPES.map(v => ({ value: v, label: v }))]} /></Field>
                <Field label="Transmission"><Select value={f.transmission} onChange={set("transmission")} options={[{ value: "", label: "— None —" }, ...TRANSMISSIONS.map(v => ({ value: v, label: v }))]} /></Field>

                <div style={{ gridColumn: "span 2" }}><Field label="Notes / Description"><Input value={f.notes} onChange={set("notes")} placeholder="Any important notes" /></Field></div>

                <Divider label="Pricing" />
                <div style={{ gridColumn: "span 2" }} />
                <Field label="Buying Price (₹)" required error={errors.buyPrice}><Input type="number" value={f.buyPrice} onChange={set("buyPrice")} placeholder="0" prefix="₹" /></Field>
                <Field label="Selling Price (₹)" required error={errors.sellPrice}><Input type="number" value={f.sellPrice} onChange={set("sellPrice")} placeholder="0" prefix="₹" /></Field>
                <Field label="MRP (₹)" hint="Maximum Retail Price"><Input type="number" value={f.mrp} onChange={set("mrp")} placeholder="0" prefix="₹" /></Field>
                <Field label="GST Rate"><Select value={String(f.gstRate)} onChange={set("gstRate")} options={["0", "5", "12", "18", "28"].map(v => ({ value: v, label: v + "% GST" }))} /></Field>

                {profit !== null && (
                    <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ background: profit > 0 ? T.emeraldBg : T.crimsonBg, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: profit > 0 ? T.emerald : T.crimson, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Profit/Unit</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: profit > 0 ? T.emerald : T.crimson, fontFamily: FONT.mono }}>{fmt(profit)}</div>
                        </div>
                        <div style={{ background: T.amberGlow, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: T.amber, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Margin</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: T.amber, fontFamily: FONT.mono }}>{mg}%</div>
                        </div>
                    </div>
                )}

                <Divider label="Inventory" />
                <div style={{ gridColumn: "span 2" }} />
                <Field label={isEdit ? "Current Stock" : "Opening Stock"} required error={errors.stock}><Input type="number" value={f.stock} onChange={set("stock")} placeholder="0" suffix="units" /></Field>
                <Field label="Min Stock Alert" hint="Alert when stock drops below"><Input type="number" value={f.minStock} onChange={set("minStock")} placeholder="10" suffix="units" /></Field>
                <Field label="Max Stock" hint="Maximum capacity"><Input type="number" value={f.maxStock} onChange={set("maxStock")} placeholder="1000" suffix="units" /></Field>
                <Field label="Reorder Qty" hint="Auto PO quantity"><Input type="number" value={f.reorderQty} onChange={set("reorderQty")} placeholder="20" suffix="units" /></Field>

                {/* Batch / Expiry Tracking */}
                <div style={{ gridColumn: "span 2", display: "flex", gap: 14, alignItems: "center", padding: "10px 14px", background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: T.t1 }}>
                        <input type="checkbox" checked={f.trackBatch} onChange={e => set("trackBatch")(e.target.checked)} style={{ accentColor: T.amber, width: 16, height: 16 }} />
                        📦 Track Batch / Expiry
                    </label>
                    {f.trackBatch && (
                        <>
                            <Input value={f.batchNumber} onChange={set("batchNumber")} placeholder="Batch #" style={{ flex: 1 }} />
                            <Input type="date" value={f.expiryDate} onChange={set("expiryDate")} style={{ width: 150 }} />
                        </>
                    )}
                </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                <Btn variant="amber" loading={saving} onClick={handleSave}>💾 {isEdit ? "Save Changes" : "Add Product"}</Btn>
            </div>
        </Modal>
    );
}

