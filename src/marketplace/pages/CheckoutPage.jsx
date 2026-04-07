import { useState, useMemo } from "react";
import { T, FONT } from "../../theme";
import { useStore } from "../../store";
import { fmt, uid } from "../../utils";
import { DELIVERY_SLOTS } from "../api/mockDatabase";
import { assignDeliveryPartner } from "../api/engine";

const STEPS = ["address", "delivery", "payment", "confirm", "processing", "success"];
const STEP_LABELS = { address: "Address", delivery: "Delivery Slot", payment: "Payment", confirm: "Confirm", processing: "Processing", success: "Order Placed" };

export function CheckoutPage({ onBack, onOrderPlaced }) {
    const { cart, saveCart, products, saveProducts, orders, saveOrders, movements, saveMovements, shops } = useStore();
    const [step, setStep] = useState("address");
    const [address, setAddress] = useState({ name: "", phone: "", pincode: "", line1: "", line2: "", city: "Hyderabad", state: "Telangana" });
    const [paymentMethod, setPaymentMethod] = useState("upi");
    const [deliverySlot, setDeliverySlot] = useState("express");
    const [orderIds, setOrderIds] = useState([]);
    const [errors, setErrors] = useState({});
    const [stockoutError, setStockoutError] = useState(null);

    const safeCart = cart || [];
    const safeProducts = products || [];

    // Group cart by shop
    const cartByShop = useMemo(() => {
        return safeCart.reduce((acc, item) => {
            const shopId = item.listing?.shop_id;
            if (!shopId) return acc;
            if (!acc[shopId]) {
                acc[shopId] = { shopId, shop: item.listing.shop, items: [], subtotal: 0, deliveryOption: item.deliveryOption || "standard" };
            }
            acc[shopId].items.push(item);
            acc[shopId].subtotal += (item.listing?.selling_price || 0) * item.qty;
            return acc;
        }, {});
    }, [safeCart]);

    const selectedSlot = DELIVERY_SLOTS.find(s => s.id === deliverySlot) || DELIVERY_SLOTS[0];
    const totalItems = safeCart.reduce((s, i) => s + i.qty, 0);
    const totalSubtotal = Object.values(cartByShop).reduce((s, g) => s + g.subtotal, 0);
    const totalShipping = selectedSlot.fee * Object.keys(cartByShop).length;
    const totalValue = totalSubtotal + totalShipping;
    const gstInclusive = Math.round((totalValue * 18) / 118);

    // Pincode → city/state auto-fill (mock lookup)
    const handlePincodeChange = (pin) => {
        setAddress(a => ({ ...a, pincode: pin }));
        if (pin.length === 6) {
            const cityMap = { "1": "Delhi", "2": "Delhi", "3": "Jaipur", "4": "Mumbai", "5": "Hyderabad", "6": "Chennai", "7": "Kolkata", "8": "Bangalore", "9": "Ahmedabad" };
            const stateMap = { "1": "Delhi", "2": "Haryana", "3": "Rajasthan", "4": "Maharashtra", "5": "Telangana", "6": "Tamil Nadu", "7": "West Bengal", "8": "Karnataka", "9": "Gujarat" };
            const first = pin[0];
            setAddress(a => ({ ...a, city: cityMap[first] || a.city, state: stateMap[first] || a.state }));
        }
    };

    // Validation
    const validateAddress = () => {
        const e = {};
        if (!address.name.trim()) e.name = "Name is required";
        if (!address.phone.trim() || address.phone.length < 10) e.phone = "Valid phone number required";
        if (!address.pincode.trim() || address.pincode.length < 6) e.pincode = "Valid pincode required";
        if (!address.line1.trim()) e.line1 = "Address is required";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handlePlaceOrder = async () => {
        setStep("processing");
        setStockoutError(null);

        await new Promise(r => setTimeout(r, 2000));

        // Re-validate stock (stockout race condition)
        let stockIssue = null;
        safeCart.forEach(item => {
            const p = safeProducts.find(pr => pr.id === item.listing?.product_id && pr.shopId === item.listing?.shop_id);
            if (!p || p.stock < item.qty) {
                const altShop = safeProducts.find(pr => pr.id === item.listing?.product_id && pr.shopId !== item.listing?.shop_id && pr.stock >= item.qty);
                stockIssue = {
                    product: item.product?.name || "Part",
                    shopName: item.listing?.shop?.name || "Shop",
                    alternative: altShop ? {
                        shopId: altShop.shopId,
                        shopName: (shops || []).find(s => s.id === altShop.shopId)?.name || "Another shop",
                        price: altShop.sellPrice,
                        priceDiff: altShop.sellPrice - (item.listing?.selling_price || 0)
                    } : null
                };
            }
        });

        if (stockIssue) {
            setStockoutError(stockIssue);
            setStep("confirm");
            return;
        }

        // Create orders per shop
        const newOrders = [...(orders || [])];
        const newMovements = [...(movements || [])];
        const newProducts = [...safeProducts];
        const ids = [];
        const now = Date.now();

        Object.values(cartByShop).forEach(group => {
            const orderId = `#ORD-${uid().toUpperCase()}`;
            ids.push(orderId);
            const itemStr = group.items.map(i => `${i.product?.name || "Part"} × ${i.qty}`).join(", ");
            const deliveryPartner = assignDeliveryPartner(group.shop);

            newOrders.push({
                id: orderId, shopId: group.shopId,
                customer: address.name, phone: address.phone,
                address: `${address.line1}, ${address.line2 || ""}, ${address.city} - ${address.pincode}`,
                items: itemStr, total: group.subtotal + selectedSlot.fee,
                status: "NEW", time: now,
                payment: paymentMethod === "cod" ? "COD" : "Prepaid (Escrow)",
                vehicle: null,
                deliverySlot: selectedSlot,
                deliveryPartner,
                deliveryFee: selectedSlot.fee,
                estimatedDelivery: selectedSlot.desc,
                paymentSettled: false,
                customerConfirmed: false,
            });

            group.items.forEach(ci => {
                const gp = newProducts.find(p => p.id === ci.listing?.product_id && p.shopId === group.shopId);
                const sp = ci.listing?.selling_price || 0;
                const bp = gp ? gp.buyPrice : sp * 0.7;

                newMovements.push({
                    id: "m" + uid(), shopId: group.shopId,
                    productId: ci.listing?.product_id, productName: ci.product?.name,
                    type: "SALE", qty: ci.qty, unitPrice: sp, sellingPrice: sp,
                    total: sp * ci.qty, gstAmount: Math.round((sp * ci.qty * 18) / 118),
                    profit: (sp - bp) * ci.qty, discount: 0,
                    customerName: address.name, customerPhone: address.phone,
                    payment: paymentMethod === "cod" ? "COD" : "Escrow",
                    creditDays: 0, paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
                    note: `Marketplace Order: ${orderId}`, date: now,
                });

                if (gp) gp.stock = Math.max(0, gp.stock - ci.qty);
            });
        });

        saveOrders(newOrders);
        saveMovements(newMovements);
        saveProducts(newProducts);
        saveCart([]);
        setOrderIds(ids);
        setStep("success");
    };

    // Stepper
    const currentIdx = STEPS.indexOf(step);
    const renderStepper = () => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 40 }}>
            {["address", "delivery", "payment", "confirm"].map((s, i) => {
                const sIdx = STEPS.indexOf(s);
                const isActive = sIdx === currentIdx;
                const isDone = sIdx < currentIdx;
                const label = STEP_LABELS[s];
                return (
                    <div key={s} style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: "50%",
                                background: isDone ? T.emerald : isActive ? T.amber : T.surface,
                                border: `2px solid ${isDone ? T.emerald : isActive ? T.amber : T.border}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, fontWeight: 900, color: isDone || isActive ? "#000" : T.t3,
                                transition: "all 0.3s"
                            }}>
                                {isDone ? "✓" : i + 1}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? T.amber : isDone ? T.emerald : T.t3, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{label}</div>
                        </div>
                        {i < 3 && <div className="step-connector" style={{ width: 50, height: 2, background: isDone ? T.emerald : T.border, margin: "0 6px", marginBottom: 20, transition: "all 0.3s" }} />}
                    </div>
                );
            })}
        </div>
    );

    const fieldStyle = (err) => ({
        width: "100%", padding: "12px 16px", background: T.surface, border: `1.5px solid ${err ? T.crimson : T.border}`,
        borderRadius: 10, color: T.t1, fontSize: 14, fontFamily: FONT.ui, outline: "none", transition: "border 0.2s", boxSizing: "border-box"
    });
    const labelStyle = { fontSize: 12, fontWeight: 700, color: T.t2, marginBottom: 6, display: "block" };

    if (safeCart.length === 0 && step !== "success") {
        return (
            <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.4 }}>🛒</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.t1 }}>Your cart is empty</div>
                <p style={{ color: T.t3, marginTop: 8 }}>Add some parts before checking out.</p>
                <button onClick={onBack} style={{ marginTop: 24, background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>← Browse Parts</button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
            <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.t3, fontSize: 13, cursor: "pointer", marginBottom: 20 }}>← Back to Marketplace</button>

            {step !== "processing" && step !== "success" && renderStepper()}

            {/* ════════ ADDRESS STEP ════════ */}
            {step === "address" && (
                <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40 }}>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.t1, margin: "0 0 24px" }}>📍 Delivery Address</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div className="inner-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                    <label style={labelStyle}>Full Name *</label>
                                    <input value={address.name} onChange={e => setAddress({ ...address, name: e.target.value })} style={fieldStyle(errors.name)} placeholder="John Doe" />
                                    {errors.name && <div style={{ fontSize: 11, color: T.crimson, marginTop: 4 }}>{errors.name}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Phone Number *</label>
                                    <input value={address.phone} onChange={e => setAddress({ ...address, phone: e.target.value })} style={fieldStyle(errors.phone)} placeholder="9876543210" maxLength={10} />
                                    {errors.phone && <div style={{ fontSize: 11, color: T.crimson, marginTop: 4 }}>{errors.phone}</div>}
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Address Line 1 *</label>
                                <input value={address.line1} onChange={e => setAddress({ ...address, line1: e.target.value })} style={fieldStyle(errors.line1)} placeholder="House/Flat No, Street Name" />
                                {errors.line1 && <div style={{ fontSize: 11, color: T.crimson, marginTop: 4 }}>{errors.line1}</div>}
                            </div>
                            <div>
                                <label style={labelStyle}>Address Line 2 (Optional)</label>
                                <input value={address.line2} onChange={e => setAddress({ ...address, line2: e.target.value })} style={fieldStyle()} placeholder="Landmark, Area" />
                            </div>
                            <div className="inner-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                                <div>
                                    <label style={labelStyle}>City</label>
                                    <input value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })} style={fieldStyle()} />
                                </div>
                                <div>
                                    <label style={labelStyle}>State</label>
                                    <input value={address.state} onChange={e => setAddress({ ...address, state: e.target.value })} style={fieldStyle()} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Pincode *</label>
                                    <input value={address.pincode} onChange={e => handlePincodeChange(e.target.value)} style={fieldStyle(errors.pincode)} placeholder="500033" maxLength={6} />
                                    {errors.pincode && <div style={{ fontSize: 11, color: T.crimson, marginTop: 4 }}>{errors.pincode}</div>}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => { if (validateAddress()) setStep("delivery"); }}
                            style={{ marginTop: 28, width: "100%", background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: `0 6px 20px ${T.amber}44` }}
                        >
                            Select Delivery Slot →
                        </button>
                    </div>
                    {renderOrderSummary()}
                </div>
            )}

            {/* ════════ DELIVERY SLOT STEP ════════ */}
            {step === "delivery" && (
                <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40 }}>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.t1, margin: "0 0 8px" }}>🚚 Choose Delivery Slot</h2>
                        <p style={{ fontSize: 13, color: T.t3, margin: "0 0 24px" }}>Select when you'd like to receive your parts</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {DELIVERY_SLOTS.map(slot => (
                                <label
                                    key={slot.id}
                                    onClick={() => setDeliverySlot(slot.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
                                        background: deliverySlot === slot.id ? `${T.amber}11` : T.surface,
                                        border: `2px solid ${deliverySlot === slot.id ? T.amber : T.border}`,
                                        borderRadius: 12, cursor: "pointer", transition: "all 0.15s"
                                    }}
                                >
                                    <div style={{
                                        width: 22, height: 22, borderRadius: "50%",
                                        border: `2px solid ${deliverySlot === slot.id ? T.amber : T.t3}`,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                        {deliverySlot === slot.id && <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.amber }} />}
                                    </div>
                                    <span style={{ fontSize: 22 }}>{slot.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{slot.label}</div>
                                        <div style={{ fontSize: 12, color: T.t3 }}>{slot.desc}</div>
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: slot.fee === 0 ? T.emerald : T.t1, fontFamily: FONT.mono }}>
                                        {slot.fee === 0 ? "FREE" : `₹${slot.fee}`}
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                            <button onClick={() => setStep("address")} style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, color: T.t2, borderRadius: 10, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Back</button>
                            <button onClick={() => setStep("payment")} style={{ flex: 2, background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: `0 6px 20px ${T.amber}44` }}>Continue to Payment →</button>
                        </div>
                    </div>
                    {renderOrderSummary()}
                </div>
            )}

            {/* ════════ PAYMENT STEP ════════ */}
            {step === "payment" && (
                <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40 }}>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.t1, margin: "0 0 24px" }}>💳 Payment Method</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                { id: "upi", icon: "📱", label: "UPI (GPay, PhonePe, Paytm)", desc: "Instant payment via UPI" },
                                { id: "card", icon: "💳", label: "Credit / Debit Card", desc: "Visa, Mastercard, RuPay" },
                                { id: "netbanking", icon: "🏦", label: "Net Banking", desc: "All major banks supported" },
                                { id: "cod", icon: "💵", label: "Cash on Delivery", desc: "Pay when you receive the part" },
                            ].map(pm => (
                                <label
                                    key={pm.id}
                                    onClick={() => setPaymentMethod(pm.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
                                        background: paymentMethod === pm.id ? `${T.amber}11` : T.surface,
                                        border: `2px solid ${paymentMethod === pm.id ? T.amber : T.border}`,
                                        borderRadius: 12, cursor: "pointer", transition: "all 0.15s"
                                    }}
                                >
                                    <div style={{
                                        width: 22, height: 22, borderRadius: "50%",
                                        border: `2px solid ${paymentMethod === pm.id ? T.amber : T.t3}`,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                        {paymentMethod === pm.id && <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.amber }} />}
                                    </div>
                                    <span style={{ fontSize: 22 }}>{pm.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{pm.label}</div>
                                        <div style={{ fontSize: 12, color: T.t3 }}>{pm.desc}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                            <button onClick={() => setStep("delivery")} style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, color: T.t2, borderRadius: 10, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Back</button>
                            <button onClick={() => setStep("confirm")} style={{ flex: 2, background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: `0 6px 20px ${T.amber}44` }}>Review Order →</button>
                        </div>
                    </div>
                    {renderOrderSummary()}
                </div>
            )}

            {/* ════════ CONFIRM STEP ════════ */}
            {step === "confirm" && (
                <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                        {/* Stockout Error */}
                        {stockoutError && (
                            <div style={{ background: `${T.crimson}11`, border: `2px solid ${T.crimson}44`, borderRadius: 16, padding: 20 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                    <span style={{ fontSize: 24 }}>⚠️</span>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: T.crimson }}>Stock Alert!</div>
                                        <div style={{ fontSize: 13, color: T.t2, marginTop: 2 }}>
                                            Sorry, {stockoutError.shopName} just sold out of "{stockoutError.product}".
                                        </div>
                                    </div>
                                </div>
                                {stockoutError.alternative && (
                                    <button style={{ background: T.sky, color: "#000", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                                        🔄 {stockoutError.alternative.shopName} has it for ₹{stockoutError.alternative.priceDiff > 0 ? `${stockoutError.alternative.priceDiff} more` : "less"} — Update Cart
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Address Card */}
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.t1, margin: 0 }}>📍 Deliver to</h3>
                                <button onClick={() => setStep("address")} style={{ background: "transparent", border: "none", color: T.sky, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Change</button>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{address.name}</div>
                            <div style={{ fontSize: 13, color: T.t2, marginTop: 4 }}>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</div>
                            <div style={{ fontSize: 13, color: T.t2 }}>{address.city}, {address.state} - {address.pincode}</div>
                            <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>📱 {address.phone}</div>
                        </div>

                        {/* Delivery Slot Card */}
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.t1, margin: 0 }}>🚚 Delivery</h3>
                                <button onClick={() => setStep("delivery")} style={{ background: "transparent", border: "none", color: T.sky, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Change</button>
                            </div>
                            <div style={{ fontSize: 14, color: T.t1, marginTop: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                <span>{selectedSlot.icon}</span> {selectedSlot.label} — {selectedSlot.desc}
                                <span style={{ fontFamily: FONT.mono, color: selectedSlot.fee === 0 ? T.emerald : T.t2 }}>{selectedSlot.fee === 0 ? "FREE" : `₹${selectedSlot.fee}`}</span>
                            </div>
                        </div>

                        {/* Payment Card */}
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.t1, margin: 0 }}>💳 Payment</h3>
                                <button onClick={() => setStep("payment")} style={{ background: "transparent", border: "none", color: T.sky, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Change</button>
                            </div>
                            <div style={{ fontSize: 14, color: T.t1, marginTop: 8, fontWeight: 600 }}>
                                {paymentMethod === "upi" && "📱 UPI (GPay / PhonePe / Paytm)"}
                                {paymentMethod === "card" && "💳 Credit / Debit Card"}
                                {paymentMethod === "netbanking" && "🏦 Net Banking"}
                                {paymentMethod === "cod" && "💵 Cash on Delivery"}
                            </div>
                        </div>

                        {/* Items Per Shop */}
                        {Object.values(cartByShop).map((group, idx) => (
                            <div key={idx} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>📦 Shipment {idx + 1}: {group.shop?.name || "Local Shop"}</div>
                                    <div style={{ fontSize: 12, color: T.sky, fontWeight: 600 }}>{selectedSlot.icon} {selectedSlot.desc}</div>
                                </div>
                                {group.items.map((item, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.surface, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                {item.product?.image ? <img src={item.product.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ fontSize: 18 }}>📦</span>}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{item.product?.name}</div>
                                                <div style={{ fontSize: 12, color: T.t3 }}>Qty: {item.qty}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: T.t1, fontFamily: FONT.mono }}>{fmt(item.listing?.selling_price * item.qty)}</div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Order Summary with Place Order button */}
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, position: "sticky", top: 20, alignSelf: "start" }}>
                        <h3 style={{ fontSize: 18, fontWeight: 900, color: T.t1, margin: "0 0 20px" }}>Order Summary</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.t2 }}><span>Items ({totalItems})</span><span style={{ fontFamily: FONT.mono }}>{fmt(totalSubtotal)}</span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.t2 }}><span>Delivery ({Object.keys(cartByShop).length} shipments)</span><span style={{ fontFamily: FONT.mono }}>{totalShipping === 0 ? "FREE" : fmt(totalShipping)}</span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.t3 }}><span>GST (inclusive)</span><span style={{ fontFamily: FONT.mono }}>{fmt(gstInclusive)}</span></div>
                            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, color: T.t1 }}>
                                <span>Total</span>
                                <span style={{ fontFamily: FONT.mono, color: T.amber }}>{fmt(totalValue)}</span>
                            </div>
                        </div>
                        <button
                            onClick={handlePlaceOrder}
                            style={{ marginTop: 24, width: "100%", background: T.amber, color: "#000", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 900, cursor: "pointer", boxShadow: `0 8px 28px ${T.amber}55`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                        >
                            🔒 Place Order — {fmt(totalValue)}
                        </button>
                        <div style={{ textAlign: "center", fontSize: 11, color: T.t3, marginTop: 10 }}>Payment held in escrow until delivery is confirmed</div>
                    </div>
                </div>
            )}

            {/* ════════ PROCESSING STEP ════════ */}
            {step === "processing" && (
                <div style={{ textAlign: "center", padding: "80px 20px" }}>
                    <div style={{ fontSize: 64, marginBottom: 24, animation: "spin 1.5s linear infinite" }}>⏳</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: T.t1 }}>Processing your order...</div>
                    <div style={{ fontSize: 14, color: T.t3, marginTop: 8 }}>Verifying stock & securing payment</div>
                    <div style={{ width: 200, height: 4, background: T.surface, borderRadius: 4, margin: "28px auto 0", overflow: "hidden", position: "relative" }}>
                        <div style={{ width: "100%", height: "100%", background: T.amber, borderRadius: 4, animation: "shimmer 1.5s ease-in-out infinite" }} />
                    </div>
                </div>
            )}

            {/* ════════ SUCCESS STEP ════════ */}
            {step === "success" && (
                <div style={{ textAlign: "center", padding: "60px 24px", animation: "scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>
                    <div style={{ fontSize: 72, marginBottom: 20, animation: "float 3s ease-in-out infinite" }}>🎉</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: T.t1, letterSpacing: "-0.5px", marginBottom: 8 }}>Order Placed!</div>
                    <div style={{ fontSize: 15, color: T.t3, marginBottom: 24 }}>Your parts are on the way</div>

                    {/* Order IDs — amber mono pill */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
                        {orderIds.map(id => (
                            <div key={id} style={{ fontFamily: FONT.mono, fontSize: 18, fontWeight: 700, color: T.amber, background: T.amberGlow, border: `1px solid ${T.amber}44`, borderRadius: 10, padding: "12px 28px", display: "inline-block", letterSpacing: "0.05em" }}>
                                {id}
                            </div>
                        ))}
                    </div>

                    {/* Delivery info */}
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, maxWidth: 500, margin: "0 auto 32px", textAlign: "left" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.t1, marginBottom: 12 }}>📍 Delivering to</div>
                        <div style={{ fontSize: 13, color: T.t2 }}>{address.name} · {address.phone}</div>
                        <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>{address.line1}, {address.city} - {address.pincode}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.emerald, marginTop: 12 }}>{selectedSlot.icon} Estimated delivery: {selectedSlot.desc}</div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                        <button onClick={() => onOrderPlaced && onOrderPlaced(orderIds)} style={{ background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "12px 32px", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: FONT.ui }}>
                            Track Order →
                        </button>
                        <button onClick={onBack} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.t2, borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Continue Shopping</button>
                    </div>
                </div>
            )}
        </div>
    );

    function renderOrderSummary() {
        return (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, position: "sticky", top: 20, alignSelf: "start" }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: T.t1, margin: "0 0 20px" }}>Order Summary</h3>
                {Object.values(cartByShop).map((group, idx) => (
                    <div key={idx} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.t2, marginBottom: 8 }}>📦 {group.shop?.name || "Shop"}</div>
                        {group.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.t2, padding: "4px 0" }}>
                                <span>{item.product?.name} × {item.qty}</span>
                                <span style={{ fontFamily: FONT.mono }}>{fmt(item.listing?.selling_price * item.qty)}</span>
                            </div>
                        ))}
                    </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.t3, padding: "4px 0" }}>
                    <span>{selectedSlot.icon} {selectedSlot.label}</span>
                    <span style={{ fontFamily: FONT.mono }}>{selectedSlot.fee === 0 ? "FREE" : `₹${selectedSlot.fee}`}</span>
                </div>
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, color: T.t1 }}>
                    <span>Total</span>
                    <span style={{ fontFamily: FONT.mono, color: T.amber }}>{fmt(totalValue)}</span>
                </div>
            </div>
        );
    }
}
