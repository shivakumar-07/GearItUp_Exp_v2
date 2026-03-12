// src/api/sync.js
// Data bridging layer: maps backend API shapes → frontend store shapes
import { api } from './client.js';

// Map backend ShopInventory + MasterPart → frontend product shape
export function mapInventoryToProduct(inv) {
  return {
    id: inv.inventoryId,
    inventoryId: inv.inventoryId,
    masterPartId: inv.masterPartId,
    globalSku: inv.masterPartId,
    name: inv.masterPart?.partName || inv.partName || 'Unknown Part',
    oemNumber: inv.masterPart?.oemNumber || '',
    brand: inv.masterPart?.brand || '',
    category: inv.masterPart?.categoryL1 || 'General',
    categoryL2: inv.masterPart?.categoryL2 || '',
    hsnCode: inv.masterPart?.hsnCode || '',
    gstRate: parseFloat(inv.masterPart?.gstRate || 18),
    unitOfSale: inv.masterPart?.unitOfSale || 'Piece',
    sellPrice: parseFloat(inv.sellingPrice || 0),
    buyPrice: parseFloat(inv.buyingPrice || 0),
    stock: inv.computedStock ?? inv.stockQty ?? 0,
    minStock: inv.minStockAlert || 5,
    rack: inv.rackLocation || '',
    isMarketplaceListed: inv.isMarketplaceListed || false,
    shopId: inv.shopId,
    // Keep these for UI compatibility
    sku: inv.masterPart?.oemNumber || inv.inventoryId?.slice(0, 8) || '',
    imageEmoji: getCategoryEmoji(inv.masterPart?.categoryL1),
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
  try {
    // We don't have a global movements endpoint yet, so skip for now
    return null;
  } catch (err) {
    return null;
  }
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
