import { useState, useMemo, useRef, useEffect, useContext } from "react";
import { T, FONT } from "../theme";
import { useStore } from "../store";
import { AppCtx } from "../appContext";
import { fmt, fmtDateTime, daysAgo, uid } from "../utils";
import { assignDeliveryPartner } from "../marketplace/api/engine";
import { Btn } from "../components/ui";

// Helper: get human-friendly label for the next action
const getNextAction = (status) => {
    const map = {
        NEW: "Accept Order", ACCEPTED: "Mark Packed", PACKED: "Dispatch",
        DISPATCHED: "Mark Delivered", new: "Accept Order", placed: "Accept Order",
    };
    return map[status?.toUpperCase?.()] || map[status] || "Advance";
};

const STATUS_META = {
    NEW: { label: "New Order", icon: "📋", color: T.sky, action: "Accept & Pack", nextStatus: "ACCEPTED" },
    ACCEPTED: { label: "Accepted", icon: "✅", color: "#2DD4BF", action: "Mark as Packed", nextStatus: "PACKED" },
    PACKED: { label: "Packed", icon: "📦", color: T.amber, action: "Assign Delivery Partner", nextStatus: "DISPATCHED" },
    DISPATCHED: { label: "Dispatched", icon: "🚚", color: T.violet, action: null, nextStatus: null },
    DELIVERED: { label: "Delivered", icon: "✓", color: T.emerald, action: null, nextStatus: null },
    CANCELLED: { label: "Cancelled", icon: "✕", color: T.crimson, action: null, nextStatus: null },
};

const TABS = ["all", "NEW", "ACCEPTED", "PACKED", "DISPATCHED", "DELIVERED"];
const STATUS_PIPELINE = ["NEW", "ACCEPTED", "PACKED", "DISPATCHED", "DELIVERED"];

// Status step indicator component
function StatusStepper({ currentStatus }) {
    const currentIdx = STATUS_PIPELINE.indexOf(currentStatus);
    const isCancelled = currentStatus === "CANCELLED";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "12px 0" }}>
            {STATUS_PIPELINE.map((status, i) => {
                const meta = STATUS_META[status];
                const isComplete = !isCancelled && i <= currentIdx;
                const isCurrent = !isCancelled && i === currentIdx;
                return (
                    <div key={status} style={{ display: "flex", alignItems: "center", flex: i < STATUS_PIPELINE.length - 1 ? 1 : 0 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: isComplete ? meta.color : T.surface,
                            border: `2px solid ${isComplete ? meta.color : T.border}`,
                            fontSize: 12, color: isComplete ? "#000" : T.t4, fontWeight: 800,
                            boxShadow: isCurrent ? `0 0 12px ${meta.color}66` : "none",
                            transition: "all 0.2s",
                        }}>
                            {isComplete ? meta.icon : i + 1}
                        </div>
                        {i < STATUS_PIPELINE.length - 1 && (
                            <div style={{
                                flex: 1, height: 2, margin: "0 4px",
                                background: !isCancelled && i < currentIdx ? STATUS_META[STATUS_PIPELINE[i + 1]]?.color || T.border : T.border,
                                transition: "background 0.3s",
                            }} />
                        )}
                    </div>
                );
            })}
            {isCancelled && (
                <div style={{ marginLeft: 12, fontSize: 10, fontWeight: 800, color: T.crimson, background: `${T.crimson}15`, padding: "3px 10px", borderRadius: 6 }}>CANCELLED</div>
            )}
        </div>
    );
}

export function OrdersPage() {
    const { orders, saveOrders, shops, activeShopId } = useStore();
    const { toast } = useContext(AppCtx);
    const [activeTab, setActiveTab] = useState("all");
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [selectedOrders, setSelectedOrders] = useState(new Set());

    const safeOrders = orders || [];

    // Poll every 30 seconds for new orders and play a beep
    const prevOrderCount = useRef(
        (safeOrders).filter(o => o.shopId === activeShopId && (o.status === "NEW" || o.status === "placed")).length
    );
    useEffect(() => {
        const interval = setInterval(() => {
            const newCount = (orders || []).filter(o => o.shopId === activeShopId && (o.status === "NEW" || o.status === "placed")).length;
            if (newCount > prevOrderCount.current) {
                toast?.(`${newCount - prevOrderCount.current} new order(s) received!`, "success");
                try {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.frequency.value = 880;
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                    osc.start(); osc.stop(ctx.currentTime + 0.3);
                } catch (e) { }
            }
            prevOrderCount.current = newCount;
        }, 30000);
        return () => clearInterval(interval);
    }, [orders, activeShopId, toast]);

    // Get marketplace orders (they have an address field or COD/Escrow payment)
    const marketplaceOrders = useMemo(() =>
        safeOrders
            .filter(o => o.address || o.payment?.includes("Escrow") || o.payment?.includes("COD") || o.payment?.includes("Prepaid"))
            .filter(o => !activeShopId || o.shopId === activeShopId)
            .sort((a, b) => b.time - a.time),
        [safeOrders, activeShopId]
    );

    const filteredOrders = activeTab === "all" ? marketplaceOrders : marketplaceOrders.filter(o => o.status === activeTab);

    // Count by status
    const statusCounts = useMemo(() => {
        const counts = { all: marketplaceOrders.length };
        Object.keys(STATUS_META).forEach(s => { counts[s] = marketplaceOrders.filter(o => o.status === s).length; });
        return counts;
    }, [marketplaceOrders]);

    const handleAdvanceStatus = (orderId) => {
        const orderIdx = safeOrders.findIndex(o => o.id === orderId);
        if (orderIdx === -1) return;

        const order = safeOrders[orderIdx];
        const meta = STATUS_META[order.status];
        if (!meta?.nextStatus) return;

        const updated = [...safeOrders];
        updated[orderIdx] = {
            ...order,
            status: meta.nextStatus,
            [`${meta.nextStatus.toLowerCase()}At`]: Date.now(),
        };

        // If dispatching, assign delivery partner
        if (meta.nextStatus === "DISPATCHED") {
            const shop = (shops || []).find(s => s.id === order.shopId);
            const partner = assignDeliveryPartner(shop);
            updated[orderIdx].deliveryPartner = partner;
            updated[orderIdx].dispatchedAt = Date.now();
        }

        saveOrders(updated);
    };

    const handleCancelOrder = (orderId) => {
        const updated = safeOrders.map(o => o.id === orderId ? { ...o, status: "CANCELLED", cancelledAt: Date.now() } : o);
        saveOrders(updated);
    };

    const handleBulkAccept = () => {
        const newOrders = marketplaceOrders.filter(o => o.status === "NEW");
        if (newOrders.length === 0) return;
        const updated = safeOrders.map(o => {
            if (newOrders.some(n => n.id === o.id)) {
                return { ...o, status: "ACCEPTED", acceptedAt: Date.now() };
            }
            return o;
        });
        saveOrders(updated);
    };

    // Accept only the selected orders (checkbox bulk accept)
    const handleBulkAcceptSelected = () => {
        if (selectedOrders.size === 0) return;
        const count = selectedOrders.size;
        const updated = safeOrders.map(o => {
            if (selectedOrders.has(o.id)) return { ...o, status: "ACCEPTED", acceptedAt: Date.now() };
            return o;
        });
        saveOrders(updated);
        setSelectedOrders(new Set());
        toast?.(`${count} order${count > 1 ? "s" : ""} accepted`, "success");
    };

    const newOrderCount = statusCounts.NEW || 0;

    return (
        <div style={{ padding: "24px 28px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, margin: 0 }}>📦 Marketplace Orders</h1>
                    <p style={{ fontSize: 14, color: T.t3, margin: "6px 0 0" }}>{marketplaceOrders.length} orders from online customers</p>
                </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {selectedOrders.size > 0 && (
                            <Btn variant="amber" onClick={handleBulkAcceptSelected}>
                                Accept All ({selectedOrders.size})
                            </Btn>
                        )}
                        {newOrderCount > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                    background: `${T.crimson}18`, border: `2px solid ${T.crimson}44`,
                                    borderRadius: 14, padding: "14px 20px",
                                    display: "flex", alignItems: "center", gap: 12,
                                    animation: "pulse 2s infinite"
                                }}>
                                    <span style={{ fontSize: 20 }}>🔴</span>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: T.crimson }}>{newOrderCount} order{newOrderCount > 1 ? "s" : ""} waiting!</div>
                                        <div style={{ fontSize: 11, color: T.t3 }}>Accept within 5 mins to maintain rankings</div>
                                    </div>
                                </div>
                                {newOrderCount > 1 && (
                                    <Btn variant="emerald" onClick={handleBulkAccept}>✓ Accept All ({newOrderCount})</Btn>
                                )}
                            </div>
                        )}
                    </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto" }}>
                {TABS.map(tab => {
                    const cnt = statusCounts[tab] || 0;
                    const isActive = activeTab === tab;
                    const meta = STATUS_META[tab];
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: "10px 16px", borderRadius: 10,
                                background: isActive ? (meta?.color || T.amber) + "22" : T.surface,
                                border: `1.5px solid ${isActive ? (meta?.color || T.amber) : T.border}`,
                                color: isActive ? (meta?.color || T.amber) : T.t2,
                                fontSize: 13, fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 8,
                                transition: "all 0.15s", whiteSpace: "nowrap"
                            }}
                        >
                            {tab === "all" ? "All" : meta?.label || tab}
                            {cnt > 0 && (
                                <span style={{
                                    background: isActive ? (meta?.color || T.amber) : T.border,
                                    color: isActive ? "#000" : T.t3,
                                    fontSize: 11, fontWeight: 900, padding: "2px 8px",
                                    borderRadius: 99
                                }}>{cnt}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📋</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.t2 }}>No {activeTab === "all" ? "" : STATUS_META[activeTab]?.label.toLowerCase() + " "}orders</div>
                    <div style={{ fontSize: 13, color: T.t3, marginTop: 8 }}>Marketplace orders from online customers will appear here</div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {filteredOrders.map(order => {
                        const meta = STATUS_META[order.status] || STATUS_META.NEW;
                        const shop = (shops || []).find(s => s.id === order.shopId);
                        const isExpanded = expandedOrder === order.id;
                        const isNew = order.status === "NEW";

                        return (
                            <div
                                key={order.id}
                                style={{
                                    background: T.card,
                                    border: `${isNew ? "2px" : "1px"} solid ${isNew ? T.crimson + "66" : T.border}`,
                                    borderRadius: 16, overflow: "hidden",
                                    boxShadow: isNew ? `0 0 20px ${T.crimson}22` : "0 2px 8px rgba(0,0,0,0.1)",
                                    transition: "all 0.2s"
                                }}
                            >
                                {/* Order Header */}
                                <div
                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                    style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "16px 24px", cursor: "pointer",
                                        background: isNew ? `${T.crimson}08` : "transparent"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                        {isNew && (
                                            <input
                                                type="checkbox"
                                                checked={selectedOrders.has(order.id)}
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => {
                                                    setSelectedOrders(prev => {
                                                        const s = new Set(prev);
                                                        e.target.checked ? s.add(order.id) : s.delete(order.id);
                                                        return s;
                                                    });
                                                }}
                                                style={{ marginRight: 4, width: 16, height: 16, cursor: "pointer", accentColor: T.amber }}
                                            />
                                        )}
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 12,
                                            background: `${meta.color}22`, color: meta.color,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 18, fontWeight: 900
                                        }}>
                                            {meta.icon}
                                        </div>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontSize: 14, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>{order.id}</span>
                                                <span style={{ background: `${meta.color}22`, color: meta.color, fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 99 }}>{meta.label}</span>
                                                {isNew && <span style={{ color: T.crimson, fontSize: 11, fontWeight: 700, animation: "pulse 2s infinite" }}>⏰ Accept now!</span>}
                                            </div>
                                            <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>
                                                {order.customer} · {daysAgo(order.time)} · {order.payment}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 18, fontWeight: 900, color: T.t1, fontFamily: FONT.mono }}>{fmt(order.total)}</div>
                                        </div>
                                        <span style={{ fontSize: 14, color: T.t3, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div style={{ borderTop: `1px solid ${T.border}`, padding: "20px 24px" }}>
                                        {/* Status Step Indicator */}
                                        <StatusStepper currentStatus={order.status} />
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                            {/* Customer Info */}
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Customer Details</div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{order.customer}</div>
                                                <div style={{ fontSize: 13, color: T.t2, marginTop: 4 }}>📱 {order.phone}</div>
                                                {order.address && <div style={{ fontSize: 13, color: T.t2, marginTop: 4 }}>📍 {order.address}</div>}
                                            </div>

                                            {/* Order Info */}
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Order Details</div>
                                                <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.7 }}>
                                                    <div><strong>Items:</strong> {order.items}</div>
                                                    <div><strong>Payment:</strong> {order.payment}</div>
                                                    <div><strong>Placed:</strong> {fmtDateTime(order.time)}</div>
                                                    {order.deliverySlot && <div><strong>Delivery:</strong> {order.deliverySlot.icon} {order.deliverySlot.label}</div>}
                                                    {order.deliveryPartner && (
                                                        <div><strong>Driver:</strong> {order.deliveryPartner.icon} {order.deliveryPartner.name} · 📱 {order.deliveryPartner.phone}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: "flex", gap: 12, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                                            {meta.action && (
                                                <Btn
                                                    variant="amber"
                                                    onClick={(e) => { e.stopPropagation(); handleAdvanceStatus(order.id); }}
                                                    style={{ flex: 1 }}
                                                >
                                                    {getNextAction(order.status)}
                                                </Btn>
                                            )}
                                            {(order.status === "NEW" || order.status === "ACCEPTED") && (
                                                <Btn
                                                    variant="danger"
                                                    onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                                >
                                                    Cancel Order
                                                </Btn>
                                            )}
                                            {order.status === "DELIVERED" && (
                                                <div style={{
                                                    flex: 1, padding: "14px 20px", borderRadius: 12,
                                                    background: `${T.emerald}14`, border: `1px solid ${T.emerald}44`,
                                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                                    fontSize: 14, fontWeight: 700, color: T.emerald
                                                }}>
                                                    ✓ Completed — {order.paymentSettled ? "Payment Settled" : "Settlement Pending"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
