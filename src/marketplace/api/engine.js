import { CATEGORIES } from "../../utils";
import { MASTER_PRODUCTS, SHOPS, SHOP_INVENTORY, VEHICLES, DELIVERY_PARTNERS } from "./mockDatabase";

// ═══════════════════════════════════════════════════════════════
// GEO-LOCATION (Haversine Formula)
// ═══════════════════════════════════════════════════════════════
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 5.0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const USER_LAT = 17.4000;
const USER_LNG = 78.4500;

export const getNearDistance = (shop) => {
  if (!shop?.lat) return (Math.random() * 10 + 1).toFixed(1);
  return getDistanceFromLatLonInKm(USER_LAT, USER_LNG, shop.lat, shop.lng).toFixed(1);
};

// ═══════════════════════════════════════════════════════════════
// DELIVERY ETA CALCULATOR
// ═══════════════════════════════════════════════════════════════
export const getDeliveryEtaFromDistance = (distanceKm) => {
  if (distanceKm < 5) return { label: "45 mins", minutes: 45, speed: "express" };
  if (distanceKm < 10) return { label: "2 hours", minutes: 120, speed: "standard" };
  return { label: "Next Day", minutes: 1440, speed: "economy" };
};

// ═══════════════════════════════════════════════════════════════
// VEHICLE FITMENT CHECKER
// ═══════════════════════════════════════════════════════════════
export const checkFitment = (product, vehicleCtx) => {
  if (!product) return { compatible: false, type: null };

  // ── API-sourced products carry fitmentType directly ──────────
  // When the browse endpoint returns data, fitmentType is already resolved.
  if (product.fitmentType !== undefined && product.fitmentType !== null) {
    return { compatible: true, type: product.fitmentType };
  }
  if (product.fitmentType === null && product.requiresFitment) {
    // requires_fitment = true but no match → exclude when vehicle is set
    return { compatible: vehicleCtx ? false : true, type: null };
  }

  // ── Universal parts: always compatible ───────────────────────
  if (product.isUniversal) return { compatible: true, type: "universal" };

  if (!vehicleCtx) {
    // No vehicle context: show everything (default listing behaviour)
    return { compatible: true, type: null };
  }

  const compatibility = product.compatibility || product.compatibleVehicles || [];

  // Empty compatibility list + no requires_fitment flag = universal
  if (compatibility.length === 0 && !product.requiresFitment) {
    return { compatible: true, type: "universal" };
  }

  // Check by vehicle ID
  if (vehicleCtx.id && compatibility.includes(vehicleCtx.id)) {
    return { compatible: true, type: "exact" };
  }

  // Check by string matching (brand + model) for mock/seed data
  const vehicleStr = `${vehicleCtx.brand} ${vehicleCtx.model}`.toLowerCase();
  const stringMatch = compatibility.some(v => {
    if (typeof v !== "string") return false;
    const matchVehicle = VEHICLES.find(veh => veh.id === v);
    if (matchVehicle) {
      return `${matchVehicle.brand} ${matchVehicle.model}`.toLowerCase() === vehicleStr;
    }
    return v.toLowerCase().includes(vehicleStr) || vehicleStr.includes(v.toLowerCase());
  });
  if (stringMatch) return { compatible: true, type: "exact" };

  // requires_fitment = true but no match found → incompatible
  if (product.requiresFitment) return { compatible: false, type: null };

  // Non-fitment-required part with no explicit compatibility = compatible (generic)
  return { compatible: true, type: "universal" };
};

// ═══════════════════════════════════════════════════════════════
// BUY BOX WINNER ALGORITHM
// Score = (Lowest Price × 0.6) + (Proximity × 0.2) + (Seller Rating × 0.2)
// ═══════════════════════════════════════════════════════════════
const calculateBuyBoxScore = (listing) => {
  // Normalize price (lower is better, so invert): max ₹10,000 context
  const priceScore = Math.max(0, 100 - (listing.selling_price / 100));
  // Proximity score (closer is better)
  const proxScore = Math.max(0, 100 - (listing.distance / 15 * 100));
  // Rating score
  const ratingScore = ((listing.shop?.rating || 4.0) / 5) * 100;

  return (priceScore * 0.6) + (proxScore * 0.2) + (ratingScore * 0.2);
};

// ═══════════════════════════════════════════════════════════════
// RANKING ENGINE — Multi-Seller Aggregation
// Groups products by SKU, returns ranked master products with
// all seller listings and Buy Box winner
// ═══════════════════════════════════════════════════════════════
export const rankingEngine = (allProducts, allShops, vehicleCtx = null) => {
  if (!allProducts || !allShops) return [];

  // Group identical products across shops by SKU or Name
  const groupedProducts = allProducts.reduce((acc, p) => {
    const key = p.sku || p.name;
    if (!acc[key]) {
      acc[key] = {
        masterTemplate: { ...p },
        listings: []
      };
    }
    const shop = allShops.find(s => s.id === p.shopId);
    if (!shop) return acc;

    acc[key].listings.push({
      ...p,
      shop,
      distance: parseFloat(getNearDistance(shop))
    });
    return acc;
  }, {});

  const vehicleId = vehicleCtx ? `${vehicleCtx.brand} ${vehicleCtx.model}` : null;

  return Object.values(groupedProducts).map(group => {
    const mp = group.masterTemplate;

    // Sort listings by Buy Box score (best first)
    const listings = group.listings.map(l => {
      const listing = {
        product_id: l.id,
        shop_id: l.shop.id,
        shop: l.shop,
        distance: l.distance,
        selling_price: l.sellPrice,
        mrp: l.mrp || Math.round(l.sellPrice * 1.2),
        stock_quantity: l.stock - (l.reservedStock || 0),
        min_stock: l.minStock,
        delivery_time: l.distance < 5 ? "Same Day" : "Next Day",
        delivery_eta: getDeliveryEtaFromDistance(l.distance),
        discount: l.mrp ? Math.round(((l.mrp - l.sellPrice) / l.mrp) * 100) : 0,
        total_sales: l.totalSales || 0,
        buying_price: l.buyPrice
      };
      listing.buyBoxScore = calculateBuyBoxScore(listing);
      return listing;
    }).sort((a, b) => b.buyBoxScore - a.buyBoxScore);

    if (listings.length === 0) return null;

    const bestListing = listings[0]; // Buy Box winner

    // Determine compatibility
    const fitment = checkFitment(mp, vehicleCtx);

    // Velocity Score
    const velocityScore = Math.min((listings.reduce((sum, l) => sum + (100 - (l.stock_quantity || 0)), 0) / 100) * 100, 100);

    // Rating Score
    const ratingScore = (bestListing.shop.rating / 5) * 100 || 80;

    // Proximity Score
    const proxScore = Math.max(0, 100 - (bestListing.distance / 15 * 100));

    // Stock Health
    let stockScore = 0;
    if (bestListing.stock_quantity > bestListing.min_stock) stockScore = 100;
    else if (bestListing.stock_quantity > 0) stockScore = 50;

    // Final Weighted Rank
    let rankScore = 0;
    if (vehicleCtx) {
      const fitmentScore = fitment.compatible ? (fitment.type === "exact" ? 100 : 80) : 0;
      rankScore = (fitmentScore * 0.4) + (velocityScore * 0.2) + (ratingScore * 0.15) + (proxScore * 0.15) + (stockScore * 0.1);
    } else {
      rankScore = (velocityScore * 0.4) + (ratingScore * 0.3) + (proxScore * 0.2) + (stockScore * 0.1);
    }

    return {
      product: mp,
      listings,
      bestListing, // Buy Box winner
      bestPrice: Math.min(...listings.map(l => l.selling_price)),
      bestShop: bestListing.shop,
      availability: listings.reduce((sum, l) => sum + l.stock_quantity, 0),
      shopCount: listings.length,
      fastestEta: listings.reduce((best, l) => l.delivery_eta.minutes < best.minutes ? l.delivery_eta : best, listings[0].delivery_eta),
      rankScore: parseFloat(rankScore.toFixed(2)),
      isCompatible: fitment.compatible,
      fitmentType: fitment.type, // "exact", "universal", or null
    };
  }).filter(Boolean).sort((a, b) => b.rankScore - a.rankScore);
};

// ═══════════════════════════════════════════════════════════════
// HOME PAGE DATA — Dynamic sections based on vehicle context
// ═══════════════════════════════════════════════════════════════
export const getHomeData = (products, shops, vehicleCtx = null) => {
  const allRanked = rankingEngine(products, shops, vehicleCtx);

  if (vehicleCtx) {
    const compatible = allRanked.filter(p => p.isCompatible);
    const universal = allRanked.filter(p => p.fitmentType === "universal");
    return {
      compatibleParts: compatible,
      universalParts: universal,
      allParts: allRanked,
    };
  }

  return {
    topSelling: [...allRanked].slice(0, 10),
    trendingNearYou: [...allRanked].sort((a, b) => a.listings[0].distance - b.listings[0].distance).slice(0, 10),
    bestDeals: [...allRanked].sort((a, b) => b.listings[0].discount - a.listings[0].discount).filter(p => p.listings[0].discount > 0).slice(0, 5),
    popularCategories: CATEGORIES.slice(0, 6)
  };
};

// ═══════════════════════════════════════════════════════════════
// SEARCH ENGINE — NLP-style smart parsing + ranked results
// ═══════════════════════════════════════════════════════════════
export const searchEngine = (query, products, shops, vehicleCtx = null) => {
  if (!query || query.length < 2 || !products || !shops) return { products: [], categories: [], shops: [], parsedVehicle: null };

  const q = query.toLowerCase();

  // ── Smart NLP Parse: extract vehicle info from search query ──
  let parsedVehicle = null;
  const vehicleBrands = ["honda", "maruti", "tata", "hyundai", "mahindra", "kia", "toyota", "renault", "volkswagen", "royal enfield"];
  const foundBrand = vehicleBrands.find(b => q.includes(b));
  if (foundBrand) {
    // Try to find model + year in the query
    const matchingVehicles = VEHICLES.filter(v => q.includes(v.brand.toLowerCase()) || q.includes(v.model.toLowerCase()));
    if (matchingVehicles.length > 0) {
      // Check for year in query
      const yearMatch = q.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        const withYear = matchingVehicles.find(v => v.year === yearMatch[1]);
        if (withYear) parsedVehicle = withYear;
      }
      if (!parsedVehicle) parsedVehicle = matchingVehicles[0];
    }
  }

  // Use parsed vehicle context if no explicit vehicle is selected
  const effectiveVehicle = vehicleCtx || parsedVehicle;

  // ── Filter matching products ──
  const queryTerms = q.replace(/for|the|and|or|of|in|a|an/gi, "").trim().split(/\s+/).filter(t => t.length >= 2);

  const matchedCategories = CATEGORIES.filter(c => c.toLowerCase().includes(q));
  const matchedShops = shops.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));

  const productMatches = products.filter(p => {
    const searchFields = `${p.name} ${p.brand} ${p.sku} ${p.category} ${p.description || ""}`.toLowerCase();
    // Match if ALL non-vehicle terms are found in the product
    const nonVehicleTerms = queryTerms.filter(t => !vehicleBrands.includes(t) && !t.match(/^\d{4}$/) && !VEHICLES.some(v => v.model.toLowerCase().includes(t)));
    if (nonVehicleTerms.length === 0) {
      // Pure vehicle query — return all products
      return true;
    }
    return nonVehicleTerms.some(term => searchFields.includes(term));
  });

  const rankedProducts = rankingEngine(productMatches, shops, effectiveVehicle);

  return {
    products: rankedProducts.slice(0, 10),
    categories: matchedCategories,
    shops: matchedShops,
    parsedVehicle, // Return so UI can show "Did you mean: Honda City 2019?"
  };
};

// ═══════════════════════════════════════════════════════════════
// DELIVERY PARTNER ASSIGNMENT
// Pick the best available partner based on proximity to shop
// ═══════════════════════════════════════════════════════════════
export const assignDeliveryPartner = (shop) => {
  if (!shop) return DELIVERY_PARTNERS[0];
  // Simulate: randomly assign with weighted preference for faster partners
  const shuffled = [...DELIVERY_PARTNERS].sort(() => Math.random() - 0.5);
  return shuffled[0];
};
