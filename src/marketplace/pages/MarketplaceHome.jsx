import { useState, useEffect, useRef } from "react";
import { T, FONT, GLOBAL_CSS } from "../../theme";
import { useStore } from "../../store";
import { getHomeData } from "../api/engine";
import { browseMarketplace, buildHomeDataFromApi } from "../../api/marketplace.js";
import { ProfileDropdown } from "../../components/ProfileDropdown";
import { clearTokens } from "../../api/client.js";
import { CATEGORIES } from "../../utils";

// Components
import { SearchBar } from "../components/SearchBar";
import { VehicleSelectorModal } from "../components/VehicleSelectorModal";
import { ProductComparisonModal } from "../components/ProductComparisonModal";
import { ProductCard } from "../components/ProductCard";
import { ShopCard, SectionCarousel, SkeletonLoader, EmptyState } from "../components/SharedUI";
import { CustomerProfile } from "./CustomerProfile";
import { ProductDetailsPage } from "./ProductDetailsPage";
import { fmt } from "../../utils";

function SideBySideModal({ open, items, onClose }) {
  if (!open || !items?.length) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(10,15,29,0.85)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: T.surface, borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh", width: Math.min(340 * items.length + 48, 1100), animation: "scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.card }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.t1, textTransform: "uppercase", letterSpacing: "1.5px" }}>Compare Products ({items.length})</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.t3, fontSize: 24, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", display: "flex", gap: 16, background: T.bg }}>
          {items.map(item => {
            const { product, bestPrice, listings, isCompatible } = item;
            const buyBox = listings?.[0];
            return (
              <div key={product.id} style={{ flex: 1, minWidth: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Image */}
                <div style={{ height: 180, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {product.image ? (
                    typeof product.image === "string" && product.image.length <= 4
                      ? <span style={{ fontSize: 64 }}>{product.image}</span>
                      : <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : <span style={{ fontSize: 48, opacity: 0.3 }}>📦</span>}
                  {isCompatible && (
                    <div style={{ position: "absolute", top: 8, left: 8, background: `${T.emerald}dd`, color: "#fff", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900, fontFamily: FONT.ui }}>✓ FIT</div>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div style={{ fontSize: 10, color: T.sky, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{product.brand}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.t1, lineHeight: 1.35 }}>{product.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.t1, fontFamily: FONT.mono }}>{fmt(bestPrice)}</div>
                  {/* Specs */}
                  {product.specifications && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 4 }}>
                      {Object.entries(product.specifications).slice(0, 5).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: T.t3, textTransform: "capitalize" }}>{k}</span>
                          <span style={{ color: T.t2, fontWeight: 600, fontFamily: FONT.mono }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Best seller */}
                  <div style={{ fontSize: 11, color: T.t3, marginTop: "auto", paddingTop: 8 }}>
                    <span>📍 {buyBox?.shop?.name || "Local Shop"}</span>
                    <span style={{ marginLeft: 8, color: T.emerald }}>⚡ {buyBox?.delivery_time || "Same Day"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function MarketplaceHome() {
  const { products, shops, selectedVehicle, toggleCart, cart } = useStore();

  // Get user from localStorage (set during login)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('as_user')); } catch { return null; }
  });

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Simple Internal Routing
  const [page, setPage] = useState("home"); // "home" | "profile" | "pdp"
  const [pdpProductId, setPdpProductId] = useState(null);

  // UI Modals State
  const [vehModalOpen, setVehModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);

  // Faceted Filter State
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState("relevance"); // relevance | price_asc | price_desc | newest

  // Compare State (max 3 items)
  const [compareList, setCompareList] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const handleCompareToggle = (item) => {
    setCompareList(prev => {
      const exists = prev.some(p => p.product?.id === item.product?.id);
      if (exists) return prev.filter(p => p.product?.id !== item.product?.id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, item];
    });
  };

  // Track user geo for distance sorting (best-effort, no permission required)
  const userGeoRef = useRef(null);
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { userGeoRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => {} // silently ignore denial
      );
    }
  }, []);

  // Load home data — tries real API first, falls back to local engine
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const opts = { limit: 60 };
        // Pass vehicle context if selected
        if (selectedVehicle) {
          opts.make     = selectedVehicle.brand || selectedVehicle.make;
          opts.model    = selectedVehicle.model;
          opts.year     = selectedVehicle.year;
          opts.fuelType = selectedVehicle.fuel || selectedVehicle.fuelType;
        }
        // Pass user location for distance sort
        if (userGeoRef.current) {
          opts.lat = userGeoRef.current.lat;
          opts.lng = userGeoRef.current.lng;
        }

        const browsed = await browseMarketplace(opts);
        if (cancelled) return;

        if (browsed.parts.length > 0) {
          // ✅ Real API data
          const resp = buildHomeDataFromApi(browsed, selectedVehicle, CATEGORIES);
          setData(resp);
          setLoading(false);
          return;
        }
      } catch (err) {
        // API unavailable — fall through to mock engine
        console.warn('[Marketplace] API browse failed, using mock data:', err.message);
      }

      if (cancelled) return;
      // 🔄 Fallback: local engine with seed/localStorage products
      const resp = getHomeData(products, shops, selectedVehicle);
      setData(resp);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [products, shops, selectedVehicle]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, color: T.t1, paddingBottom: 80 }}>
      {/* GLOBAL CSS INJECTION (Since this is a sub-app, ensure styles exist) */}
      <style>{GLOBAL_CSS}</style>

      {/* TOP NAVIGATION */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div className="mp-nav-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          {/* Logo */}
          <div className="mp-nav-logo" onClick={() => setPage("home")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${T.amber}, ${T.amberDim})`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#000", boxShadow: `0 4px 16px ${T.amber}66` }}>
              ⚙️
            </div>
            <div className="topbar-secondary">
              <div style={{ fontSize: 15, fontWeight: 900, color: T.t1, letterSpacing: "-0.02em" }}>Velvet Parts</div>
              <div style={{ fontSize: 9, color: T.t3, fontWeight: 700, letterSpacing: "0.1em" }}>MARKETPLACE</div>
            </div>
          </div>

          {/* Search Engine */}
          <div className="mp-search-row" style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
            <SearchBar onSelectProduct={(p) => {
              setPdpProductId(p.product.id);
              setPage("pdp");
            }} onOpenVehicleSelector={() => setVehModalOpen(true)} />
          </div>

          {/* Right Actions */}
          <div className="mp-nav-right" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              onClick={() => setVehModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: selectedVehicle ? `${T.emerald}22` : T.card, border: `1px solid ${selectedVehicle ? T.emerald : T.border}`, padding: "7px 12px", borderRadius: 10, cursor: "pointer", transition: "all 0.2s" }}
              className="mp-card-hover"
            >
              <span style={{ fontSize: 18 }}>{selectedVehicle ? (selectedVehicle.type === "Car" ? "🚙" : "🏍️") : "🚘"}</span>
              <div className="veh-selector-text" style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, color: selectedVehicle ? T.emerald : T.t3, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {selectedVehicle ? "Saved" : "Vehicle"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.t1, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : "Select"}
                </span>
              </div>
            </div>

            <ProfileDropdown
              user={currentUser}
              onLogout={() => {
                clearTokens();
                localStorage.removeItem('as_user');
                setCurrentUser(null);
                window.location.href = '/login';
              }}
            />

            <button onClick={toggleCart} style={{ width: 40, height: 40, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", position: "relative", flexShrink: 0 }}>
              🛒
              {cart.length > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, background: T.amber, color: "#000", width: 18, height: 18, borderRadius: "50%", fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{cart.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {page === "profile" && <CustomerProfile />}
      {page === "pdp" && <ProductDetailsPage productId={pdpProductId} onBack={() => setPage("home")} />}
      {page === "home" && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              <div>
                <div style={{ width: 220, height: 28, background: T.border, borderRadius: 8, marginBottom: 20 }} className="pulse" />
                <SkeletonLoader type="product" count={5} />
              </div>
              <div>
                <div style={{ width: 180, height: 28, background: T.border, borderRadius: 8, marginBottom: 20 }} className="pulse" />
                <SkeletonLoader type="shop" count={5} />
              </div>
            </div>
          ) : (
            <>
              {/* VIEW A: VEHICLE SELECTED -> SHOW COMPATIBLE PARTS RANKED */}
              {selectedVehicle && data?.compatibleParts ? (
                <div style={{ animation: "fadeUp 0.4s ease-out" }}>
                  <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <h1 style={{ fontSize: 28, fontWeight: 900, color: T.t1, margin: "0 0 8px 0" }}>Parts for {selectedVehicle.brand} {selectedVehicle.model}{selectedVehicle.variant ? ` ${selectedVehicle.variant}` : ''}</h1>
                      <div style={{ fontSize: 15, color: T.t3 }}>Showing {data.compatibleParts.length} verified compatible parts sorted by lowest price & nearest shops.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, color: T.t1, cursor: "pointer", fontFamily: FONT.ui, appearance: "none" }}
                      >
                        <option value="relevance">Sort: Relevance</option>
                        <option value="price_asc">Price: Low → High</option>
                        <option value="price_desc">Price: High → Low</option>
                        <option value="newest">Newest First</option>
                      </select>
                      <button
                        onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                        style={{ background: filterDrawerOpen ? T.amber : T.card, border: `1px solid ${filterDrawerOpen ? T.amber : T.border}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: filterDrawerOpen ? "#000" : T.t2, cursor: "pointer", transition: "all 0.15s" }}
                        className={filterDrawerOpen ? "" : "btn-hover"}
                      >
                        Filter {filterDrawerOpen ? "↓" : "⚙️"}
                      </button>
                    </div>
                  </div>

                  {/* FILTER SIDEBAR — slide in from left */}
                  {filterDrawerOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        onClick={() => setFilterDrawerOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(10,15,29,0.6)", backdropFilter: "blur(2px)" }}
                      />
                      {/* Panel */}
                      <div style={{
                        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 501,
                        width: 300, background: T.surface, borderRight: `1px solid ${T.border}`,
                        boxShadow: "8px 0 32px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column",
                        animation: "slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)"
                      }}>
                        {/* Header */}
                        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.t1, textTransform: "uppercase", letterSpacing: "1.5px" }}>Filters</div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            {activeFilters.length > 0 && (
                              <button onClick={() => setActiveFilters([])} style={{ background: "transparent", border: "none", color: T.sky, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Clear All</button>
                            )}
                            <button onClick={() => setFilterDrawerOpen(false)} style={{ background: "transparent", border: "none", color: T.t3, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
                          </div>
                        </div>

                        {/* Scrollable Content */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 28 }}>

                          {/* Active Filter Chips */}
                          {activeFilters.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {activeFilters.map(f => (
                                <div key={f.value} style={{ background: `${T.amber}22`, border: `1px solid ${T.amber}55`, color: T.amber, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 5 }}>
                                  {f.value}
                                  <button onClick={() => setActiveFilters(activeFilters.filter(a => a.value !== f.value))} style={{ background: "transparent", border: "none", color: T.amber, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Price Range */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.t3, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Price Range</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input type="number" placeholder="Min" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.t1, fontSize: 13, fontFamily: FONT.mono }} />
                              <span style={{ color: T.t3, flexShrink: 0 }}>–</span>
                              <input type="number" placeholder="Max" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.t1, fontSize: 13, fontFamily: FONT.mono }} />
                            </div>
                          </div>

                          {/* Brands */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.t3, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Brand</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {["Bosch", "NGK", "Purolator", "Mahle", "Monroe", "Denso"].map(b => (
                                <label key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: T.t1, cursor: "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={activeFilters.some(f => f.value === b)}
                                    onChange={(e) => {
                                      if (e.target.checked) setActiveFilters(p => [...p, { label: "Brand", value: b }]);
                                      else setActiveFilters(p => p.filter(f => f.value !== b));
                                    }}
                                    style={{ accentColor: T.amber, width: 16, height: 16, flexShrink: 0 }}
                                  />
                                  {b}
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Category */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.t3, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Category</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {["Filters", "Brakes", "Electrical", "Engine", "Suspension", "Tyres"].map(c => (
                                <button
                                  key={c}
                                  onClick={() => {
                                    if (activeFilters.some(f => f.value === c)) setActiveFilters(p => p.filter(f => f.value !== c));
                                    else setActiveFilters(p => [...p, { label: "Category", value: c }]);
                                  }}
                                  style={{
                                    background: activeFilters.some(f => f.value === c) ? `${T.amber}22` : T.bg,
                                    border: `1px solid ${activeFilters.some(f => f.value === c) ? T.amber : T.border}`,
                                    color: activeFilters.some(f => f.value === c) ? T.amber : T.t2,
                                    borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s"
                                  }}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Availability */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.t3, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Availability</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {[["In Stock Only", "instock"], ["Same Day Delivery", "sameday"]].map(([label, val]) => (
                                <label key={val} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: T.t1, cursor: "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={activeFilters.some(f => f.value === val)}
                                    onChange={(e) => {
                                      if (e.target.checked) setActiveFilters(p => [...p, { label: "Avail", value: val }]);
                                      else setActiveFilters(p => p.filter(f => f.value !== val));
                                    }}
                                    style={{ accentColor: T.amber, width: 16, height: 16, flexShrink: 0 }}
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>

                        </div>

                        {/* Apply footer */}
                        <div style={{ padding: "16px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                          <button
                            onClick={() => setFilterDrawerOpen(false)}
                            style={{ width: "100%", background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: FONT.ui }}
                            className="btn-hover-solid"
                          >
                            Apply Filters {activeFilters.length > 0 ? `(${activeFilters.length})` : ""}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {data.compatibleParts.length === 0 ? (
                    <EmptyState title="No parts found" desc="We currently don't have any parts explicitly listed for this vehicle model in your area." />
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
                      {data.compatibleParts.filter(p => {
                        if (activeFilters.length === 0) return true;
                        const brandFilters = activeFilters.filter(f => f.label === "Brand").map(f => f.value);
                        const catFilters = activeFilters.filter(f => f.label === "Category").map(f => f.value);
                        const brandMatch = brandFilters.length === 0 || brandFilters.includes(p.product.brand);
                        const catMatch = catFilters.length === 0 || catFilters.includes(p.product.category);
                        return brandMatch && catMatch;
                      }).sort((a, b) => {
                        if (sortBy === "price_asc") return a.bestPrice - b.bestPrice;
                        if (sortBy === "price_desc") return b.bestPrice - a.bestPrice;
                        if (sortBy === "newest") return (b.product.createdAt || 0) - (a.product.createdAt || 0);
                        return (b.rankScore || 0) - (a.rankScore || 0); // relevance
                      }).map(p => (
                        <div key={p.product.id} style={{ position: "relative" }}>
                          <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", zIndex: 10, background: T.emerald, color: "#000", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 900, fontFamily: FONT.ui, display: "flex", alignItems: "center", gap: 6, boxShadow: `0 4px 12px ${T.emerald}44`, whiteSpace: "nowrap" }}>
                            <span>✓</span> Exact Fit for {selectedVehicle.brand} {selectedVehicle.model}{selectedVehicle.variant ? ` ${selectedVehicle.variant}` : ''}
                          </div>
                          <ProductCard item={p} onClick={() => { setPdpProductId(p.product.id); setPage("pdp"); }} inCompare={compareList.some(c => c.product?.id === p.product?.id)} onCompareToggle={handleCompareToggle} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* VIEW B: NO VEHICLE SELECTED -> SHOW DYNAMIC MARKETPLACE */}
              {!selectedVehicle && data ? (
                <div style={{ animation: "fadeUp 0.4s ease-out" }}>

                  {/* Hero Split Banner */}
                  <div className="hero-banner" style={{ width: "100%", borderRadius: 20, background: `linear-gradient(135deg, ${T.surface} 60%, #0f172a)`, border: `1px solid ${T.sky}33`, marginBottom: 48, display: "flex", alignItems: "stretch", overflow: "hidden", position: "relative", minHeight: 260 }}>
                    {/* Left: Headline */}
                    <div className="hero-left" style={{ flex: 1, padding: "40px 48px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, position: "relative", zIndex: 10 }}>
                      <div style={{ display: "inline-block", alignSelf: "flex-start", background: `${T.amber}22`, color: T.amber, padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em" }}>Hyperlocal Auto Parts</div>
                      <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.1 }}>
                        Find the right part.<br />
                        <span style={{ color: T.amber }}>Guaranteed to fit.</span>
                      </h1>
                      <div style={{ fontSize: 14, color: T.t3, maxWidth: 380, lineHeight: 1.6 }}>
                        Verified fitment for your exact vehicle. Compare prices across trusted local shops.
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {["✓ Exact Fitment", "✓ Local Shops", "✓ Same Day Delivery"].map(f => (
                          <span key={f} style={{ fontSize: 12, color: T.emerald, fontWeight: 700 }}>{f}</span>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="topbar-secondary" style={{ width: 1, background: `linear-gradient(to bottom, transparent, ${T.border}, transparent)`, flexShrink: 0 }} />

                    {/* Right: Vehicle Selector Card */}
                    <div className="hero-right" style={{ width: 300, padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, background: `${T.card}88`, backdropFilter: "blur(8px)", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.t1, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22 }}>🚘</span> Select Your Vehicle
                      </div>
                      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.5 }}>
                        Tell us your vehicle and we'll show only parts that fit — no guesswork.
                      </div>
                      <button
                        onClick={() => setVehModalOpen(true)}
                        style={{ background: T.amber, color: "#000", border: "none", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 8px 24px ${T.amber}44`, transition: "all 0.2s", fontFamily: FONT.ui }}
                        className="btn-hover-solid"
                      >
                        Get Exact Fit →
                      </button>
                      <div style={{ fontSize: 11, color: T.t4, textAlign: "center" }}>
                        Cars, Bikes, Trucks — all supported
                      </div>
                    </div>

                    {/* BG decoration */}
                    <div style={{ position: "absolute", left: -20, bottom: -40, fontSize: 200, opacity: 0.04, pointerEvents: "none" }}>⚙️</div>
                  </div>

                  {/* Popular Categories Mock */}
                  <SectionCarousel title="Popular Categories">
                    {data.popularCategories.map(c => (
                      <div key={c} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px 32px", minWidth: 160, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "pointer" }} className="mp-card-hover">
                        <span style={{ fontSize: 32 }}>{c === "Brakes" ? "🛑" : c === "Engine" ? "⚙️" : c === "Filters" ? "💨" : c === "Electrical" ? "⚡" : c === "Suspension" ? "🛞" : "🔧"}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{c}</span>
                      </div>
                    ))}
                  </SectionCarousel>

                  {/* Top Selling Overall */}
                  <SectionCarousel title="🔥 Global Top Selling Parts">
                    {data.topSelling.map(p => (
                      <ProductCard key={p.product.id} item={p} onClick={() => { setPdpProductId(p.product.id); setPage("pdp"); }} />
                    ))}
                  </SectionCarousel>

                  {/* Best Deals */}
                  {data.bestDeals.length > 0 && (
                    <SectionCarousel title="💰 Best Deals Today">
                      {data.bestDeals.map(p => (
                        <ProductCard key={p.product.id} item={p} onClick={() => { setPdpProductId(p.product.id); setPage("pdp"); }} />
                      ))}
                    </SectionCarousel>
                  )}

                  {/* Trending Local */}
                  <SectionCarousel title="⚡ Trending Near You">
                    {data.trendingNearYou.map(p => (
                      <ProductCard key={p.product.id} item={p} onClick={() => { setPdpProductId(p.product.id); setPage("pdp"); }} />
                    ))}
                  </SectionCarousel>

                  {/* Nearby Shops Preview */}
                  <SectionCarousel title="🏪 Trusted Shops Near You">
                    {data.trendingNearYou.filter((v, i, a) => a.findIndex(t => (t.listings[0].shop_id === v.listings[0].shop_id)) === i).map(p => (
                      <ShopCard key={p.listings[0].shop_id} shop={p.listings[0].shop} />
                    ))}
                  </SectionCarousel>

                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* FLOATING COMPARE BAR */}
      {compareList.length > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 68, right: 0, zIndex: 900,
          background: T.surface, borderTop: `1px solid ${T.border}`,
          padding: "12px 24px", display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)", animation: "fadeUp 0.2s ease"
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "1px", marginRight: 8, flexShrink: 0 }}>
            Comparing {compareList.length}/3
          </div>
          {compareList.map(item => (
            <div key={item.product?.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{item.product?.name?.slice(0, 22)}</span>
              <button onClick={() => handleCompareToggle(item)} style={{ background: "none", border: "none", color: T.t4, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          {compareList.length > 1 && (
            <button onClick={() => setCompareOpen(true)} style={{ background: T.amber, color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui }}>
              Compare Now →
            </button>
          )}
          <button onClick={() => setCompareList([])} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: T.t3, cursor: "pointer", fontFamily: FONT.ui }}>
            Clear
          </button>
        </div>
      )}

      {/* MODALS */}
      <VehicleSelectorModal open={vehModalOpen} onClose={() => setVehModalOpen(false)} />
      <ProductComparisonModal open={!!activeProduct} productData={activeProduct} onClose={() => setActiveProduct(null)} />
      <SideBySideModal open={compareOpen} items={compareList} onClose={() => setCompareOpen(false)} />
    </div>
  );
}
