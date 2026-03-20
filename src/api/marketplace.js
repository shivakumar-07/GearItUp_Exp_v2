/**
 * src/api/marketplace.js
 *
 * Frontend API client for the marketplace.
 * All functions return data in the shape that engine.js / MarketplaceHome expects.
 * Falls back gracefully — callers should catch errors and use mock data.
 */

import { api } from './client.js';
import { getDeliveryEtaFromDistance } from '../marketplace/api/engine.js';

// ─── Existing thin wrappers (preserved) ──────────────────────────────────────
export const searchMarketplace = (params) => api.get('/api/marketplace/search', params);
export const createOrder        = (data)   => api.post('/api/marketplace/orders', data);
export const updateOrderStatus  = (id, status) => api.put(`/api/marketplace/orders/${id}/status`, { status });
export const trackOrder         = (id)     => api.get(`/api/marketplace/orders/${id}/track`);

// ─── Category → emoji fallback ────────────────────────────────────────────────
const CATEGORY_EMOJI = {
  Brakes: '🛑', Filters: '🔘', Ignition: '⚡', Electrical: '🔋',
  Engine: '⚙️', Suspension: '🔩', 'Body & Exterior': '🚗',
  'Engine Oils': '🛢️', Fluids: '💧', 'Clutch & Transmission': '⚙️',
  'Cooling System': '🌡️', Steering: '🕹️', Exhaust: '💨',
};
function getCategoryEmoji(cat) { return CATEGORY_EMOJI[cat] || '🔧'; }

// ─── Map one API part → the ranked shape that engine.js produces ──────────────
// This lets MarketplaceHome render API data identically to mock data.
export function mapPartToRanked(part) {
  const product = {
    id:              part.masterPartId,
    masterPartId:    part.masterPartId,
    name:            part.partName,
    brand:           part.brand || '',
    sku:             part.oemNumber || part.masterPartId.slice(0, 8),
    oemNumber:       part.oemNumber || '',
    oemNumbers:      part.oemNumbers || [],
    category:        part.categoryL1 || 'General',
    categoryL2:      part.categoryL2 || '',
    image:           part.imageUrl || getCategoryEmoji(part.categoryL1),
    imageUrl:        part.imageUrl || null,
    description:     part.description || '',
    specifications:  part.specifications || {},
    hsnCode:         part.hsnCode || '',
    gstRate:         part.gstRate || 18,
    unitOfSale:      part.unitOfSale || 'Piece',
    isUniversal:     part.isUniversal,
    requiresFitment: part.requiresFitment,
    // compatibility array used by legacy checkFitment in engine.js
    compatibility: [],
  };

  const listings = part.shops.map(shop => {
    const dist = shop.distance ?? 5;
    return {
      product_id:     part.masterPartId,
      inventoryId:    shop.inventoryId,
      shop_id:        shop.shopId,
      shop: {
        id:         shop.shopId,
        name:       shop.shopName,
        address:    shop.shopAddress,
        city:       shop.shopCity,
        isVerified: shop.isVerified,
        rating:     4.2, // placeholder — shop rating table comes in a later layer
      },
      distance:       dist,
      selling_price:  shop.price,
      mrp:            Math.round(shop.price * 1.25),
      stock_quantity: shop.stockQty,
      rackLocation:   shop.rackLocation,
      delivery_time:  dist < 5 ? 'Same Day' : dist < 15 ? '2 Hours' : 'Next Day',
      delivery_eta:   getDeliveryEtaFromDistance(dist),
      discount:       0,
      buyBoxScore:    0,
    };
  });

  if (listings.length === 0) return null;
  const bestListing = listings[0]; // already sorted by backend (distance then price)

  return {
    product,
    listings,
    bestListing,
    bestPrice:    part.bestPrice,
    bestShop:     bestListing.shop,
    availability: listings.reduce((s, l) => s + l.stock_quantity, 0),
    shopCount:    part.shopCount,
    fastestEta:   listings.reduce(
      (best, l) => l.delivery_eta.minutes < best.minutes ? l.delivery_eta : best,
      listings[0].delivery_eta
    ),
    rankScore:    50,
    isCompatible: part.fitmentType !== null,
    fitmentType:  part.fitmentType, // "exact" | "compatible" | "universal" | null
  };
}

// ─── Browse — main listing ────────────────────────────────────────────────────
/**
 * Fetch marketplace parts from the real backend.
 * @param {object} opts - { make, model, year, fuelType, vehicleId, category, q, lat, lng, limit, offset }
 * @returns {Promise<{ parts: RankedPart[], total: number, vehicleApplied: boolean }>}
 */
export async function browseMarketplace(opts = {}) {
  const params = {};
  if (opts.make)      params.make       = opts.make;
  if (opts.model)     params.model      = opts.model;
  if (opts.year)      params.year       = String(opts.year);
  if (opts.fuelType)  params.fuel_type  = opts.fuelType;
  if (opts.vehicleId) params.vehicle_id = opts.vehicleId;
  if (opts.category && opts.category !== 'All') params.category = opts.category;
  if (opts.q)         params.q          = opts.q;
  if (opts.lat)       params.lat        = opts.lat;
  if (opts.lng)       params.lng        = opts.lng;
  if (opts.limit)     params.limit      = opts.limit;
  if (opts.offset)    params.offset     = opts.offset;

  const res = await api.get('/api/marketplace/browse', params);
  const d = res.data || res;

  return {
    parts:          (d.parts || []).map(mapPartToRanked).filter(Boolean),
    total:          d.total || 0,
    vehicleApplied: d.vehicleApplied || false,
    vehicleId:      d.vehicleId || null,
  };
}

// ─── Build home page data from browse response ────────────────────────────────
// Returns the exact shape that getHomeData() from engine.js returns,
// so MarketplaceHome renders without structural changes.
export function buildHomeDataFromApi(browsed, vehicleCtx, CATEGORIES) {
  const { parts, vehicleApplied } = browsed;

  if (vehicleApplied && vehicleCtx) {
    const compatibleParts = parts.filter(p =>
      p.fitmentType === 'exact' || p.fitmentType === 'compatible'
    );
    const universalParts = parts.filter(p => p.fitmentType === 'universal');

    return {
      compatibleParts: [...compatibleParts, ...universalParts],
      universalParts,
      allParts: parts,
    };
  }

  return {
    topSelling:       parts.slice(0, 10),
    trendingNearYou:  [...parts].sort(
      (a, b) => (a.bestListing?.distance ?? 999) - (b.bestListing?.distance ?? 999)
    ).slice(0, 10),
    bestDeals: parts.filter(p => p.bestListing?.discount > 0).slice(0, 5),
    popularCategories: CATEGORIES ? CATEGORIES.slice(0, 6) : [],
  };
}

// ─── Vehicle search ───────────────────────────────────────────────────────────
export async function searchVehicles(opts = {}) {
  const params = {};
  if (opts.q)            params.q            = opts.q;
  if (opts.make)         params.make         = opts.make;
  if (opts.model)        params.model        = opts.model;
  if (opts.vehicle_type) params.vehicle_type = opts.vehicle_type;
  if (opts.limit)        params.limit        = opts.limit;
  const res = await api.get('/api/marketplace/vehicles', params);
  return (res.data || res).vehicles || [];
}

export async function fetchVehicleMakes(vehicleType) {
  const params = vehicleType ? { vehicle_type: vehicleType } : {};
  const res = await api.get('/api/marketplace/vehicles/makes', params);
  return (res.data || res) || [];
}

export async function fetchVehicleModels(make) {
  const res = await api.get('/api/marketplace/vehicles/models', { make });
  return (res.data || res) || [];
}

export async function fetchVehicleVariants(make, model) {
  const res = await api.get('/api/marketplace/vehicles/variants', { make, model });
  return (res.data || res) || [];
}
