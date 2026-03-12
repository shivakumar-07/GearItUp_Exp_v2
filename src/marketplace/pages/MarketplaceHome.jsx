import { useState, useEffect } from "react";
import { T, FONT, GLOBAL_CSS } from "../../theme";
import { useStore } from "../../store";
import { getHomeData } from "../api/engine";
import { ProfileDropdown } from "../../components/ProfileDropdown";
import { clearTokens } from "../../api/client.js";

// Components
import { SearchBar } from "../components/SearchBar";
import { VehicleSelectorModal } from "../components/VehicleSelectorModal";
import { ProductComparisonModal } from "../components/ProductComparisonModal";
import { ProductCard } from "../components/ProductCard";
import { ShopCard, SectionCarousel, SkeletonLoader, EmptyState } from "../components/SharedUI";
import { CustomerProfile } from "./CustomerProfile";
import { ProductDetailsPage } from "./ProductDetailsPage";

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

  // Fetch / Simulate API Call when Vehicle context changes
  useEffect(() => {
    setLoading(true);
    // Simulate network delay
    setTimeout(() => {
      const resp = getHomeData(products, shops, selectedVehicle);
      setData(resp);
      setLoading(false);
    }, 600);
  }, [products, shops, selectedVehicle]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.ui, color: T.t1, paddingBottom: 60 }}>
      {/* GLOBAL CSS INJECTION (Since this is a sub-app, ensure styles exist) */}
      <style>{GLOBAL_CSS}</style>

      {/* TOP NAVIGATION */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", gap: 32 }}>
          {/* Logo */}
          <div onClick={() => setPage("home")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${T.amber}, ${T.amberDim})`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#000", boxShadow: `0 4px 16px ${T.amber}66` }}>
              ⚙️
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: T.t1, letterSpacing: "-0.02em" }}>Velvet Parts</div>
              <div style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: "0.1em" }}>MARKETPLACE</div>
            </div>
          </div>

          {/* Search Engine */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <SearchBar onSelectProduct={(p) => {
              setPdpProductId(p.product.id);
              setPage("pdp");
            }} onOpenVehicleSelector={() => setVehModalOpen(true)} />
          </div>

          {/* Right Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              onClick={() => setVehModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: selectedVehicle ? `${T.emerald}22` : T.card, border: `1px solid ${selectedVehicle ? T.emerald : T.border}`, padding: "8px 16px", borderRadius: 12, cursor: "pointer", transition: "all 0.2s" }}
              className="mp-card-hover"
            >
              <span style={{ fontSize: 18 }}>{selectedVehicle ? (selectedVehicle.type === "Car" ? "🚙" : "🏍️") : "🚘"}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, color: selectedVehicle ? T.emerald : T.t3, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {selectedVehicle ? "Vehicle Saved" : "Select Vehicle"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>
                  {selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}${selectedVehicle.variant ? ` ${selectedVehicle.variant}` : ''}` : "Add for exact fit"}
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

            <button onClick={toggleCart} style={{ width: 42, height: 42, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", position: "relative" }}>
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

                  {/* FACETED NAVEGATION TRAY */}
                  {filterDrawerOpen && (
                    <div style={{ background: T.surface, border: `1px solid ${T.borderHi}`, borderRadius: 16, padding: 24, marginBottom: 32, animation: "fadeUp 0.2s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.t1 }}>Active Filters</div>
                        {activeFilters.length > 0 && (
                          <button onClick={() => setActiveFilters([])} style={{ background: "transparent", border: "none", color: T.sky, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Clear All</button>
                        )}
                      </div>

                      {/* Active Filter Chips */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                        {activeFilters.length === 0 && <span style={{ fontSize: 13, color: T.t3 }}>No filters applied.</span>}
                        {activeFilters.map(f => (
                          <div key={f.value} style={{ background: `${T.amber}22`, border: `1px solid ${T.amber}55`, color: T.amber, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                            {f.label}: {f.value}
                            <button onClick={() => setActiveFilters(activeFilters.filter(a => a.value !== f.value))} style={{ background: "transparent", border: "none", color: T.amber, cursor: "pointer", fontSize: 14 }}>✕</button>
                          </div>
                        ))}
                      </div>

                      {/* Facet Categories */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>

                        {/* Price Range */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Price Range</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="number" placeholder="Min" style={{ width: 80, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", color: T.t1, fontSize: 13, fontFamily: FONT.mono }} />
                            <span style={{ color: T.t3 }}>-</span>
                            <input type="number" placeholder="Max" style={{ width: 80, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", color: T.t1, fontSize: 13, fontFamily: FONT.mono }} />
                            <button style={{ background: T.borderHi, border: "none", borderRadius: 6, padding: "6px 12px", color: T.t1, fontSize: 12, cursor: "pointer" }}>Go</button>
                          </div>
                        </div>

                        {/* Brands Facet */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Brands</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 120, overflowY: "auto" }} className="custom-scroll">
                            {["Bosch", "NGK", "Purolator", "Mahle", "Monroe"].map(b => (
                              <label key={b} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: T.t1, cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={activeFilters.some(f => f.value === b)}
                                  onChange={(e) => {
                                    if (e.target.checked) setActiveFilters([...activeFilters, { label: "Brand", value: b }]);
                                    else setActiveFilters(activeFilters.filter(f => f.value !== b));
                                  }}
                                  style={{ accentColor: T.amber, width: 16, height: 16 }}
                                />
                                {b} <span style={{ color: T.t3, fontSize: 11, marginLeft: "auto" }}>({Math.floor(Math.random() * 15) + 1})</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Part Category */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Category</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {["Filters", "Brakes", "Electrical"].map(c => (
                              <button
                                key={c}
                                onClick={() => {
                                  if (!activeFilters.some(f => f.value === c)) setActiveFilters([...activeFilters, { label: "Category", value: c }]);
                                }}
                                style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, padding: "4px 10px", color: T.t2, fontSize: 12, cursor: "pointer" }}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
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
                          <ProductCard item={p} onClick={() => { setPdpProductId(p.product.id); setPage("pdp"); }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* VIEW B: NO VEHICLE SELECTED -> SHOW DYNAMIC MARKETPLACE */}
              {!selectedVehicle && data ? (
                <div style={{ animation: "fadeUp 0.4s ease-out" }}>

                  {/* Promo Banner */}
                  <div style={{ width: "100%", height: 240, borderRadius: 20, background: `linear-gradient(135deg, ${T.surface}, #0f172a)`, border: `1px solid ${T.sky}44`, marginBottom: 48, display: "flex", alignItems: "center", padding: 40, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "relative", zIndex: 10, maxWidth: 500 }}>
                      <div style={{ display: "inline-block", background: `${T.amber}22`, color: T.amber, padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Welcome to Velvet Parts</div>
                      <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", margin: "0 0 16px 0", lineHeight: 1.1 }}>Find the right part.<br />From trusted local shops.</h1>
                      <button onClick={() => setVehModalOpen(true)} style={{ background: T.amber, color: "#000", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 800, cursor: "pointer", transition: "all 0.2s" }} className="btn-hover-solid">
                        Select Your Vehicle 🚘
                      </button>
                    </div>
                    <div style={{ position: "absolute", right: -40, top: -40, fontSize: 240, opacity: 0.1 }}>⚙️</div>
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

      {/* MODALS */}
      <VehicleSelectorModal open={vehModalOpen} onClose={() => setVehModalOpen(false)} />
      <ProductComparisonModal open={!!activeProduct} productData={activeProduct} onClose={() => setActiveProduct(null)} />
    </div>
  );
}
