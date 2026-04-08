// src/api/sync.js
// Data bridging layer: maps backend API shapes → frontend store shapes
import { api } from './client.js';

// Map backend ShopInventory + MasterPart → frontend product shape
export function mapInventoryToProduct(inv) {
  const mp = inv.masterPart;
  // Resolve the best displayable image: catalog image URL → category emoji fallback
  const imageVal = mp?.imageUrl || (mp?.images && mp.images[0]) || getCategoryEmoji(mp?.categoryL1);
  return {
    id: inv.inventoryId,
    inventoryId: inv.inventoryId,
    masterPartId: inv.masterPartId,
    globalSku: inv.masterPartId,
    name: mp?.partName || inv.partName || 'Unknown Part',
    oemNumber: mp?.oemNumber || (mp?.oemNumbers && mp.oemNumbers[0]) || '',
    oemNumbers: mp?.oemNumbers || [],
    barcodes: mp?.barcodes || [],
    brand: mp?.brand || '',
    category: mp?.categoryL1 || 'General',
    categoryL2: mp?.categoryL2 || '',
    hsnCode: mp?.hsnCode || '',
    gstRate: parseFloat(mp?.gstRate || 18),
    unitOfSale: mp?.unitOfSale || 'Piece',
    description: mp?.description || '',
    specifications: mp?.specifications || {},
    sellPrice: parseFloat(inv.sellingPrice || 0),
    buyPrice: parseFloat(inv.buyingPrice || 0),
    stock: inv.computedStock ?? inv.stockQty ?? 0,
    minStock: inv.minStockAlert || 5,
    rack: inv.rackLocation || '',
    location: inv.rackLocation || '',   // UI uses p.location throughout
    isMarketplaceListed: inv.isMarketplaceListed || false,
    shopId: inv.shopId,
    // Image — display either URL (<img>) or emoji text
    image: imageVal,
    imageEmoji: getCategoryEmoji(mp?.categoryL1),
    // SKU for barcode / POS search
    sku: mp?.oemNumber || (mp?.oemNumbers && mp.oemNumbers[0]) || inv.inventoryId?.slice(0, 8) || '',
  };
}

function getCategoryEmoji(category) {
  const map = {
    'Brakes': '🛑', 'Filters': '🔘', 'Ignition': '⚡', 'Electrical': '🔋',
    'Engine': '⚙️', 'Suspension': '🔩', 'Body & Exterior': '🚗',
    'Engine Oils': '🛢️', 'Fluids': '💧', 'Clutch & Transmission': '⚙️',
  };
  return map[category] || '🔧';
}

// Map backend Movement → frontend movement shape
export function mapMovement(m) {
  return {
    id: m.movementId || m.id,
    shopId: m.shopId,
    productId: m.inventoryId || m.productId,
    productName: m.inventory?.masterPart?.partName || m.productName || '',
    type: m.type,
    qty: m.qty,
    unitPrice: parseFloat(m.unitPrice || 0),
    sellingPrice: parseFloat(m.unitPrice || 0),
    total: parseFloat(m.totalAmount || m.total || 0),
    gstAmount: parseFloat(m.gstAmount || 0),
    profit: parseFloat(m.profit || 0),
    payment: m.paymentMode || '',
    paymentMode: m.paymentMode || '',
    paymentStatus: 'paid',
    note: m.notes || '',
    date: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
    invoiceNo: m.invoiceId || '',
  };
}

// Map backend Party → frontend party shape
export function mapParty(p) {
  return {
    id: p.partyId,
    partyId: p.partyId,
    name: p.name,
    phone: p.phone || '',
    gstin: p.gstin || '',
    address: p.address || '',
    type: p.type || 'CUSTOMER',
    creditLimit: parseFloat(p.creditLimit || 0),
    outstanding: parseFloat(p.outstanding || 0),
    notes: p.notes || '',
    shopId: p.shopId,
  };
}

// Fetch all inventory for the current shop
export async function fetchInventory() {
  try {
    const data = await api.get('/api/shop/inventory');
    return (data.inventory || []).map(mapInventoryToProduct);
  } catch (err) {
    console.warn('[Sync] Could not fetch inventory from API:', err.message);
    return null; // null = API unavailable, keep localStorage
  }
}

// Fetch all parties
export async function fetchParties() {
  try {
    const data = await api.get('/api/shop/parties');
    return (data.parties || []).map(mapParty);
  } catch (err) {
    console.warn('[Sync] Could not fetch parties from API:', err.message);
    return null;
  }
}

// Fetch recent movements (last 200) — endpoint not yet available, reserved for future use
export async function fetchMovements() {
  // We don't have a global movements endpoint yet, so skip for now.
  return null;
}

// Sync a product save to the API (fire-and-forget)
export async function syncProductSave(product) {
  try {
    if (product.inventoryId) {
      // Update existing
      await api.put(`/api/shop/inventory/${product.inventoryId}`, {
        sellingPrice: product.sellPrice,
        buyingPrice: product.buyPrice,
        rackLocation: product.rack,
        minStockAlert: product.minStock,
        isMarketplaceListed: product.isMarketplaceListed,
      });
    }
    // New product creation is handled by the product modal flow separately
  } catch (err) {
    console.warn('[Sync] Product save to API failed (not critical):', err.message);
  }
}

// Sync a party save to the API (fire-and-forget)
export async function syncPartySave(party) {
  try {
    if (party.partyId) {
      // Existing party - would need a PUT endpoint
      // For now, skip - create is handled by the parties page
    }
  } catch (err) {
    console.warn('[Sync] Party save to API failed (not critical):', err.message);
  }
}

// ─── Push functions — local-first: UI updates immediately, backend syncs async ─

/**
 * Sync a sale/invoice to the backend.
 * Called fire-and-forget from handleSale / handleMultiItemSale in App.jsx.
 * Only fires if all inventoryIds are real DB UUIDs (not seed data like "p1").
 */
export async function syncInvoice({ items, partyId, partyName, partyPhone, paymentMode, cashAmount, upiAmount, creditAmount, notes }) {
  // Guard: only call API if we have real DB inventory IDs
  const hasRealIds = items?.every(item => isDbUuid(item.inventoryId));
  if (!hasRealIds) return;
  try {
    const inferredTotal = (items || []).reduce((sum, item) => {
      const qty = Number(item.qty || 0);
      const unit = Number(item.unitPrice || 0);
      const discount = Number(item.discount || 0);
      return sum + Math.max(0, (unit * qty) - discount);
    }, 0);

    let normalizedCash = normalizeTenderAmount(cashAmount);
    let normalizedUpi = normalizeTenderAmount(upiAmount);
    let normalizedCredit = normalizeTenderAmount(creditAmount);
    const normalizedMode = normalizePaymentMode(paymentMode, {
      cashAmount: normalizedCash,
      upiAmount: normalizedUpi,
      creditAmount: normalizedCredit,
    });

    if (normalizedMode === 'CASH' && normalizedCash === undefined && inferredTotal > 0) normalizedCash = inferredTotal;
    if (normalizedMode === 'UPI' && normalizedUpi === undefined && inferredTotal > 0) normalizedUpi = inferredTotal;
    if (normalizedMode === 'CREDIT' && normalizedCredit === undefined && inferredTotal > 0) normalizedCredit = inferredTotal;
    if (normalizedMode === 'SPLIT' && normalizedCash === undefined && normalizedUpi === undefined && normalizedCredit === undefined && inferredTotal > 0) {
      normalizedCash = inferredTotal;
    }

    await api.post('/api/billing/invoice', {
      items: items.map(item => ({
        inventoryId: item.inventoryId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
      })),
      partyId: partyId || undefined,
      partyName: partyName || undefined,
      partyPhone: partyPhone || undefined,
      paymentMode: normalizedMode,
      cashAmount: normalizedCash,
      upiAmount: normalizedUpi,
      creditAmount: normalizedCredit,
      notes: notes || undefined,
    });
    console.log('[Sync] Invoice synced to backend');
  } catch (err) {
    console.warn('[Sync] Invoice API failed (saved locally):', err.message);
  }
}

/**
 * Sync a single-item stock purchase to the backend.
 */
export async function syncPurchase({ inventoryId, qty, buyingPrice, newSellingPrice, supplier, invoiceNo, payment, creditDays, notes }) {
  if (!isDbUuid(inventoryId)) return;
  try {
    await api.post('/api/shop/inventory/purchase', {
      inventoryId, qty, buyingPrice, newSellingPrice, supplier, invoiceNo, payment, creditDays, notes,
    });
    console.log('[Sync] Purchase synced to backend');
  } catch (err) {
    console.warn('[Sync] Purchase API failed (saved locally):', err.message);
  }
}

/**
 * Sync a stock adjustment to the backend.
 * type: RETURN_IN | RETURN_OUT | DAMAGE | THEFT | AUDIT | ADJUSTMENT | OPENING
 */
export async function syncAdjustment({ inventoryId, type, qty, reason, refundMethod, refundAmount, supplierName, originalInvoice, notes }) {
  if (!isDbUuid(inventoryId)) return;
  try {
    await api.post('/api/shop/inventory/adjust', {
      inventoryId, type, qty, reason, refundMethod, refundAmount, supplierName, originalInvoice, notes,
    });
    console.log('[Sync] Adjustment synced to backend');
  } catch (err) {
    console.warn('[Sync] Adjustment API failed (saved locally):', err.message);
  }
}

/**
 * Returns true if the ID looks like a real Postgres UUID (from the DB),
 * false if it's seed data (e.g. "p1", "p2", "s1").
 */
function isDbUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function normalizeTenderAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function normalizePaymentMode(mode, amounts = {}) {
  const modeMap = {
    CASH: 'CASH',
    UPI: 'UPI',
    CARD: 'CARD',
    CREDIT: 'CREDIT',
    UDHAAR: 'CREDIT',
    SPLIT: 'SPLIT',
  };

  const key = String(mode || '').trim().toUpperCase();
  const mapped = modeMap[key] || (key || 'CASH');
  const activeTenders = [amounts.cashAmount, amounts.upiAmount, amounts.creditAmount].filter(Boolean).length;
  return activeTenders > 1 ? 'SPLIT' : mapped;
}
