import { useState, useMemo, useEffect } from "react";
import { T, FONT } from "../../theme";
import { useStore } from "../../store";
import { fmt, getStarRating, renderStars } from "../../utils";
import { checkFitment, getNearDistance, getDeliveryEtaFromDistance } from "../api/engine";
import { api } from "../../api/client.js";

export function ProductDetailsPage({ productId, onBack }) {
    const { products, shops, selectedVehicle, cart, saveCart } = useStore();
    const [selectedImageIdx] = useState(0);
    const [addedToCartShop, setAddedToCartShop] = useState(null);
    const [qty, setQty] = useState(1);

    // API-fetched product data (used when local store doesn't have the product)
    const [apiProduct, setApiProduct] = useState(null);
    const [apiLoading, setApiLoading] = useState(false);
    const [apiFailed, setApiFailed] = useState(false);

    // Find the master product and all listings from LOCAL store
    const safeProducts = products || [];
    const safeShops = shops || [];

    const localProductData = useMemo(() => {
        // Match by id, sku, OR masterPartId (marketplace uses masterPartId as the product ID)
        const matching = safeProducts.filter(p =>
            p.id === productId || p.sku === productId || p.masterPartId === productId
        );
        if (matching.length === 0) return null;

        const master = matching[0];

        const listings = matching.map(p => {
            const shop = safeShops.find(s => s.id === p.shopId);
            if (!shop) return null;
            const distance = parseFloat(getNearDistance(shop));
            const eta = getDeliveryEtaFromDistance(distance);
            const mrp = p.mrp || Math.round(p.sellPrice * 1.2);
            const discount = mrp > p.sellPrice ? Math.round(((mrp - p.sellPrice) / mrp) * 100) : 0;

            // Buy Box score
            const priceScore = Math.max(0, 100 - (p.sellPrice / 100));
            const proxScore = Math.max(0, 100 - (distance / 15 * 100));
            const ratingScore = ((shop.rating || 4.0) / 5) * 100;
            const buyBoxScore = (priceScore * 0.6) + (proxScore * 0.2) + (ratingScore * 0.2);

            return {
                product_id: p.id,
                shop_id: shop.id,
                shop,
                distance,
                eta,
                selling_price: p.sellPrice,
                buying_price: p.buyPrice,
                mrp,
                discount,
                stock_quantity: p.stock - (p.reservedStock || 0),
                min_stock: p.minStock,
                buyBoxScore,
                total_sales: p.totalSales || 0,
            };
        }).filter(Boolean).sort((a, b) => b.buyBoxScore - a.buyBoxScore);

        return { master, listings };
    }, [productId, safeProducts, safeShops]);

    // If not found locally, fetch from API
    useEffect(() => {
        if (localProductData) return; // Found locally, no need to fetch
        if (apiProduct) return; // Already fetched
        if (apiFailed) return; // Already tried and failed

        let cancelled = false;
        setApiLoading(true);

        (async () => {
            try {
                // Try the marketplace catalog endpoint for full product + shop listings
                const res = await api.get(`/api/marketplace/catalog/${productId}`);
                if (cancelled) return;

                const raw = res.data || res;
                // The backend returns { part: {...}, listings: [...], reviews, reviewStats }
                const p = raw.part || raw;
                const apiListings = raw.listings || raw.shops || [];

                if (!p || !p.masterPartId) {
                    setApiFailed(true);
                    setApiLoading(false);
                    return;
                }

                // Map API response to the shape ProductDetailsPage expects
                const master = {
                    id: p.masterPartId,
                    masterPartId: p.masterPartId,
                    name: p.partName,
                    brand: p.brand || '',
                    sku: p.oemNumber || p.masterPartId.slice(0, 8),
                    oemNumber: p.oemNumber || '',
                    oem_part_no: p.oemNumber || '',
                    category: p.categoryL1 || 'General',
                    categoryL2: p.categoryL2 || '',
                    description: p.description || '',
                    specifications: p.specifications || {},
                    hsnCode: p.hsnCode || '',
                    gstRate: p.gstRate || 18,
                    unitOfSale: p.unitOfSale || 'Piece',
                    isUniversal: p.isUniversal,
                    requiresFitment: p.requiresFitment,
                    image: p.imageUrl || null,
                    imageUrl: p.imageUrl || null,
                    compatibility: p.fitments || [],
                };

                const listings = apiListings.map(shop => {
                    const dist = shop.distance ?? 5;
                    const price = parseFloat(shop.price || shop.sellingPrice || 0);
                    const mrp = Math.round(price * 1.25);
                    const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                    const eta = getDeliveryEtaFromDistance(dist);

                    return {
                        product_id: p.masterPartId,
                        shop_id: shop.shopId,
                        shop: {
                            id: shop.shopId,
                            name: shop.shopName || 'Local Shop',
                            address: shop.shopAddress || '',
                            city: shop.shopCity || '',
                            isVerified: shop.isVerified || false,
                            rating: shop.rating || 4.2,
                            reviews: shop.reviewCount || 0,
                        },
                        distance: dist,
                        eta,
                        selling_price: price,
                        buying_price: 0,
                        mrp,
                        discount,
                        stock_quantity: shop.stockQty || 0,
                        min_stock: 5,
                        buyBoxScore: 50,
                        total_sales: 0,
                    };
                }).sort((a, b) => a.distance - b.distance);

                setApiProduct({ master, listings });
            } catch (err) {
                console.warn('[PDP] API fetch failed:', err.message);
                if (!cancelled) setApiFailed(true);
            } finally {
                if (!cancelled) setApiLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [productId, localProductData, apiProduct, apiFailed]);

    // Use local data first, then API data
    const productData = localProductData || apiProduct;

    // Loading state
    if (apiLoading && !productData) {
        return (
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1.2s infinite" }}>⚙️</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.t3 }}>Loading product details…</div>
            </div>
        );
    }

    if (!productData) {
        return (
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.4 }}>🔍</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.t1 }}>Product not found</div>
                <button onClick={onBack} style={{ marginTop: 24, background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>← Back to Marketplace</button>
            </div>
        );
    }

    const { master, listings: rawListings } = productData;

    // Sort by price ascending; cheapest row gets "Best Price" highlight
    const listings = [...rawListings].sort((a, b) => a.selling_price - b.selling_price);
    const winner = rawListings[0]; // Buy Box winner (by buyBoxScore, unchanged)
    const cheapestIdx = 0; // after price-asc sort, index 0 is always cheapest
    const fastestShopId = rawListings.reduce((f, l) => (!f || l.distance < f.distance) ? l : f, null)?.shop_id;
    const fitment = checkFitment(master, selectedVehicle);

    const getCategoryEmoji = (cat = "") => {
        const c = cat.toLowerCase();
        if (c.includes("engine") || c.includes("motor")) return "⚙️";
        if (c.includes("brake") || c.includes("tyre") || c.includes("wheel")) return "🛞";
        if (c.includes("electr") || c.includes("battery") || c.includes("light")) return "⚡";
        if (c.includes("filter")) return "🔩";
        if (c.includes("oil") || c.includes("fluid") || c.includes("lubric")) return "🛢️";
        if (c.includes("body") || c.includes("bumper") || c.includes("mirror")) return "🚗";
        if (c.includes("suspension") || c.includes("shock") || c.includes("spring")) return "🔧";
        if (c.includes("exhaust") || c.includes("muffler")) return "💨";
        if (c.includes("seat") || c.includes("interior")) return "🪑";
        return "📦";
    };
    const { rating, count } = getStarRating(master.id);

    const handleAddToCart = (listing) => {
        const existingCart = cart || [];
        const existing = existingCart.find(i => i.listing?.shop_id === listing.shop_id && i.listing?.product_id === listing.product_id);

        const newCart = existing
            ? existingCart.map(i => i === existing ? { ...i, qty: i.qty + qty } : i)
            : [...existingCart, {
                listing,
                product: master,
                qty,
                deliveryOption: listing.eta.speed === "express" ? "express" : "standard"
            }];

        saveCart(newCart);
        setAddedToCartShop(listing.shop_id);
        setTimeout(() => setAddedToCartShop(null), 2000);
    };

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
            {/* ═══════ BREADCRUMB ═══════ */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12, color: T.t3 }}>
                <span onClick={() => onBack?.()} style={{ cursor: "pointer", color: T.amber }}>Home</span>
                <span>›</span>
                <span>{master?.category}</span>
                <span>›</span>
                <span>{master?.brand}</span>
                <span>›</span>
                <span style={{ color: T.t1 }}>{master?.name}</span>
            </div>

            <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.t3, fontSize: 13, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
                ← Back to Marketplace
            </button>

            {/* ═══════ FITMENT BANNER ═══════ */}
            {selectedVehicle && (
                <div style={{
                    background: fitment.compatible
                        ? `linear-gradient(135deg, ${T.emerald}18, ${T.emerald}08)`
                        : `linear-gradient(135deg, ${T.crimson}18, ${T.crimson}08)`,
                    border: `2px solid ${fitment.compatible ? T.emerald : T.crimson}44`,
                    borderRadius: 14,
                    padding: "16px 24px",
                    marginBottom: 24,
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: "50%",
                        background: fitment.compatible ? `${T.emerald}22` : `${T.crimson}22`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 24, flexShrink: 0
                    }}>
                        {fitment.compatible ? "✓" : "✕"}
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: fitment.compatible ? T.emerald : T.crimson }}>
                            {fitment.compatible
                                ? (fitment.type === "universal" ? "UNIVERSAL FIT — Compatible with all vehicles" : `EXACT FIT for ${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.year}${selectedVehicle.variant ? ` ${selectedVehicle.variant}` : ''}`)
                                : `NOT COMPATIBLE with ${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.year}${selectedVehicle.variant ? ` ${selectedVehicle.variant}` : ''}`
                            }
                        </div>
                        <div style={{ fontSize: 13, color: T.t2, marginTop: 4 }}>
                            {fitment.compatible
                                ? "This part is guaranteed to fit your vehicle."
                                : "This part will NOT fit your selected vehicle. Please check compatibility before ordering."
                            }
                        </div>
                    </div>
                </div>
            )}

            <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 32 }}>
                {/* ═══════ LEFT: Product Image & Specs ═══════ */}
                <div>
                    {/* Hero Image */}
                    <div style={{ background: T.surface, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}`, marginBottom: 20 }}>
                        <div style={{ width: "100%", height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {master.image ? (
                                <img src={master.image} alt={master.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <div style={{ width: "100%", aspectRatio: "1/1", background: `linear-gradient(135deg,${T.card},${T.surface})`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, opacity: 0.4, border: `1px solid ${T.border}` }}>
                                    {getCategoryEmoji(master?.category)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Technical Specifications */}
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 900, color: T.t1, margin: "0 0 16px" }}>📋 Technical Specifications</h3>
                        {master.specifications && Object.entries(master.specifications).map(([key, val]) => (
                            <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}22` }}>
                                <span style={{ fontSize: 13, color: T.t3, textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: T.t1, fontFamily: FONT.mono }}>{val}</span>
                            </div>
                        ))}
                        {master.oem_part_no && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, background: `${T.amber}08`, margin: "8px -12px 0", padding: "10px 12px", borderRadius: 8 }}>
                                <span style={{ fontSize: 13, color: T.amber, fontWeight: 700 }}>OEM Part Number</span>
                                <span style={{ fontSize: 13, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>{master.oem_part_no}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════ RIGHT: Product Info + Buy Box ═══════ */}
                <div>
                    {/* Product Header */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, color: T.sky, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                            {master.brand}
                            {master.brandVerified && (
                                <span style={{ background: `${T.emerald}18`, color: T.emerald, fontSize: 9, fontWeight: 900, padding: "3px 8px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 3 }}>🛡️ Brand Verified</span>
                            )}
                        </div>
                        <h1 style={{ fontSize: 26, fontWeight: 900, color: T.t1, margin: "0 0 8px", lineHeight: 1.3 }}>{master.name}</h1>
                        <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.6 }}>{master.description}</div>
                        {/* Rating */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                            <span style={{ color: "#FBBF24", fontSize: 15, letterSpacing: 1 }}>{renderStars(+rating)}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.t2 }}>{rating}</span>
                            <span style={{ fontSize: 13, color: T.t3 }}>({count} ratings)</span>
                        </div>
                        {/* Fitment badge */}
                        <div style={{ marginTop: 10 }}>
                            {selectedVehicle ? (
                                fitment.compatible ? (
                                    <span style={{ background: T.emeraldBg, color: T.emerald, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                        ✓ Fits your {selectedVehicle?.make || selectedVehicle?.brand} {selectedVehicle?.model}
                                    </span>
                                ) : null
                            ) : (
                                <span style={{ background: T.skyBg, color: T.sky, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    ⊕ Universal Fit
                                </span>
                            )}
                        </div>
                        {master.sku && (
                            <div style={{ fontSize: 12, color: T.t3, marginTop: 8, fontFamily: FONT.mono }}>SKU: {master.sku}</div>
                        )}
                    </div>

                    {/* ═══════ BUY BOX (Winner) ═══════ */}
                    {winner && (
                        <div style={{
                            background: T.card, border: `2px solid ${T.amber}44`,
                            borderRadius: 16, padding: 24, marginBottom: 20,
                            boxShadow: `0 4px 20px ${T.amber}11`
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: T.amber, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Best Offer</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{winner.shop.name}</div>
                                    <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>
                                        📍 {winner.distance} km away · ⭐ {winner.shop.rating} ({winner.shop.reviews} reviews)
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: T.t1, fontFamily: FONT.mono }}>{fmt(winner.selling_price)}</div>
                                    {winner.discount > 0 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ fontSize: 13, color: T.t3, textDecoration: "line-through" }}>{fmt(winner.mrp)}</span>
                                            <span style={{ background: `${T.crimson}22`, color: T.crimson, fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>Save {winner.discount}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, padding: "10px 14px", background: `${T.emerald}0a`, borderRadius: 10, border: `1px solid ${T.emerald}22` }}>
                                <span style={{ fontSize: 16 }}>⚡</span>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.emerald }}>Get it in {winner.eta.label}</div>
                                    <div style={{ fontSize: 11, color: T.t3 }}>from {winner.shop.name} · {winner.stock_quantity} units in stock</div>
                                </div>
                            </div>

                            {/* Quantity + Add to Cart */}
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                                    <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 36, height: 40, background: T.surface, border: "none", color: T.t1, fontSize: 18, cursor: "pointer" }}>−</button>
                                    <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: FONT.mono, color: T.t1, fontSize: 15 }}>{qty}</div>
                                    <button onClick={() => setQty(qty + 1)} style={{ width: 36, height: 40, background: T.surface, border: "none", color: T.t1, fontSize: 18, cursor: "pointer" }}>+</button>
                                </div>
                                <button
                                    onClick={() => handleAddToCart(winner)}
                                    disabled={winner.stock_quantity <= 0 || (!fitment.compatible && selectedVehicle)}
                                    style={{
                                        flex: 1, height: 44, background: addedToCartShop === winner.shop_id ? T.emerald : ((!fitment.compatible && selectedVehicle) ? T.t3 : T.amber),
                                        border: "none", borderRadius: 12,
                                        color: "#000", fontSize: 15, fontWeight: 900, cursor: "pointer",
                                        boxShadow: `0 6px 20px ${T.amber}44`,
                                        transition: "all 0.2s",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                    }}
                                >
                                    {addedToCartShop === winner.shop_id ? "✓ Added!" : ((!fitment.compatible && selectedVehicle) ? "🚫 Part Not Compatible" : `🛒 Add to Cart — ${fmt(winner.selling_price * qty)}`)}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══════ OTHER SELLERS TABLE (sorted price asc) ═══════ */}
                    {listings.length > 1 && (
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 900, color: T.t1, margin: "0 0 16px" }}>
                                🏪 Compare {listings.length} Local Sellers
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {listings.map((listing, i) => {
                                    const isCheapest = i === cheapestIdx;
                                    return (
                                        <div
                                            key={listing.shop_id}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 16,
                                                padding: "14px 16px", borderRadius: 12,
                                                background: isCheapest ? `${T.amber}08` : T.surface,
                                                border: `1px solid ${isCheapest ? T.amber + "44" : T.border}`,
                                                borderLeft: isCheapest ? `3px solid ${T.amber}` : `1px solid ${T.border}`,
                                                transition: "all 0.15s"
                                            }}
                                        >
                                            {/* Shop Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{listing.shop.name}</span>
                                                    {isCheapest && (
                                                        <span style={{ background: T.amberGlow, border: `1px solid ${T.amber}44`, color: T.amber, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99, marginLeft: 6 }}>Best Price</span>
                                                    )}
                                                    {listing.shop_id === fastestShopId && listing.shop_id !== listings[cheapestIdx]?.shop_id && (
                                                        <span style={{ background: `${T.emerald}15`, border: `1px solid ${T.emerald}44`, color: T.emerald, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>Fastest Delivery</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 12, color: T.t3, marginTop: 4, display: "flex", gap: 12 }}>
                                                    <span>📍 {listing.distance} km</span>
                                                    <span>⭐ {listing.shop.rating}</span>
                                                    <span>⚡ {listing.eta.label}</span>
                                                    <span style={{ color: listing.stock_quantity > 5 ? T.emerald : T.amber }}>
                                                        {listing.stock_quantity > 5 ? `${listing.stock_quantity} in stock` : `Only ${listing.stock_quantity} left`}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div style={{ textAlign: "right", marginRight: 12 }}>
                                                <div style={{ fontSize: 18, fontWeight: 900, color: T.t1, fontFamily: FONT.mono }}>{fmt(listing.selling_price)}</div>
                                                {listing.discount > 0 && <div style={{ fontSize: 11, color: T.crimson, fontWeight: 700 }}>-{listing.discount}%</div>}
                                            </div>

                                            {/* Add to Cart */}
                                            <button
                                                onClick={() => handleAddToCart(listing)}
                                                disabled={listing.stock_quantity <= 0}
                                                style={{
                                                    background: addedToCartShop === listing.shop_id ? T.emerald : (isCheapest ? T.amber : T.surface),
                                                    border: isCheapest ? "none" : `1px solid ${T.border}`,
                                                    color: isCheapest ? "#000" : T.t1,
                                                    borderRadius: 10, padding: "10px 16px",
                                                    fontSize: 12, fontWeight: 800, cursor: "pointer",
                                                    flexShrink: 0, transition: "all 0.2s",
                                                    whiteSpace: "nowrap"
                                                }}
                                            >
                                                {addedToCartShop === listing.shop_id ? "✓ Added" : "Add to Cart"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
