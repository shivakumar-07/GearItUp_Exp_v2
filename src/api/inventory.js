import { api } from './client.js';

// ─── Inventory (Layer 3 — per-shop ledger) ────────────────────────────────────
export const getInventory       = ()         => api.get('/api/shop/inventory');
export const addInventory       = (data)     => api.post('/api/shop/inventory', data);
export const updateInventory    = (id, data) => api.put(`/api/shop/inventory/${id}`, data);
export const getMovements       = (id)       => api.get(`/api/shop/inventory/${id}/movements`);
export const recordPurchase     = (data)     => api.post('/api/shop/inventory/purchase', data);
export const recordAdjustment   = (data)     => api.post('/api/shop/inventory/adjust', data);

/**
 * Bulk stock-in — cart/bucket procurement session.
 * items:    Array<{ masterPartId, sellingPrice, buyingPrice?, stockQty?, rackLocation?,
 *                   minStockAlert?, shopSpecificNotes? }>
 * supplier: { name?, invoiceNo?, invoiceDate?, paymentMode?, creditDays?, notes? }
 * Returns:  { success, created, updated, items: [...ShopInventory], movements: [...] }
 */
export const bulkStockIn        = (items, supplier = {}) => api.post('/api/shop/inventory/bulk-stock-in', { items, supplier });

/** Toggle isMarketplaceListed on a shop inventory item. */
export const toggleMarketplace  = (id, listed) => api.patch(`/api/shop/inventory/${id}/marketplace`, { listed });

// ─── Catalog (Layer 1 + Layer 2 — global brain) ───────────────────────────────
/** Full-text search with optional vehicle filter. */
export const searchCatalog      = (params)   => api.get('/api/catalog/search', params);

/**
 * Unified fast lookup — cashier types part name, OEM number, OR barcode.
 * Returns VERIFIED + PENDING parts. Used by CatalogStockInModal.
 */
export const lookupCatalog      = (q, limit = 12) => api.get('/api/catalog/lookup', { q, limit });

/**
 * Barcode scan — exact match on barcodes[] or oemNumbers[].
 * Returns { parts, found, exactMatch }.
 * Uses GET for direct URL-based lookup (bookmarkable, cacheable).
 */
export const lookupByBarcode    = (barcode)  => api.get(`/api/catalog/barcode/${encodeURIComponent(barcode)}`);

/**
 * POST /api/catalog/lookup — camera scanner endpoint.
 * Body: { barcode } — sent by BarcodeScanner component after a successful decode.
 * Falls back to lookupByBarcode() if POST is unavailable.
 */
export const scanBarcode        = (barcode)  => api.post('/api/catalog/lookup', { barcode });

/** Get a single master part with all fitments. */
export const getCatalogPart     = (id)       => api.get(`/api/catalog/parts/${id}`);

/**
 * Contribute a new part that isn't in the catalog yet.
 * Status starts as PENDING — platform admin reviews and VERIFIES.
 */
export const contributePart     = (data)     => api.post('/api/catalog/contribute', data);

// ─── Marketplace catalog ────────────────────────────────────────────────────
/** One-product-page: full part details + all shops listing it + review stats. */
export const getMarketplacePart = (masterPartId, params) => api.get(`/api/marketplace/catalog/${masterPartId}`, params);

/** Add a review for a master part (persists even if shop delists). */
export const addReview          = (masterPartId, data)   => api.post(`/api/marketplace/catalog/${masterPartId}/review`, data);
