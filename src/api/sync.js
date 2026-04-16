// src/api/sync.js
// Data bridging layer: maps backend API shapes → frontend store shapes
import { api } from './client.js';

const SYNC_QUEUE_KEY_BASE = 'vl_sync_queue_v1';
const SYNC_META_KEY_BASE = 'vl_sync_meta_v1';
const MAX_RETRIES = 8;
const BASE_RETRY_MS = 4000;
const MAX_RETRY_MS = 60000;
const DEFAULT_SYNC_SCOPE = Object.freeze({ userId: 'anon', shopId: 'anon' });

const syncSubscribers = new Set();
let isProcessingQueue = false;
let syncScope = { ...DEFAULT_SYNC_SCOPE };
let syncMeta = loadSyncMeta();

const MODE_ALIAS = {
  UDHAAR: 'CREDIT',
  CARD: 'UPI',
};

const MODE_MAP = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'UPI',
  CREDIT: 'CREDIT',
  UDHAAR: 'CREDIT',
  SPLIT: 'SPLIT',
};

const SYNC_KIND_META = {
  invoice: { label: 'Invoice', icon: '🧾' },
  purchase: { label: 'Purchase', icon: '📥' },
  adjustment: { label: 'Adjustment', icon: '⚖️' },
  'product-update': { label: 'Product Update', icon: '🏷️' },
};

function normalizeScopeSegment(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return encodeURIComponent(text);
}

function normalizeSyncScope(scope) {
  const hasUser = Boolean(scope?.userId);
  return {
    userId: normalizeScopeSegment(scope?.userId, DEFAULT_SYNC_SCOPE.userId),
    shopId: normalizeScopeSegment(scope?.shopId, hasUser ? 'shopless' : DEFAULT_SYNC_SCOPE.shopId),
  };
}

function getScopeStoragePrefix(scope = syncScope) {
  const normalized = normalizeSyncScope(scope);
  return `${normalized.userId}:${normalized.shopId}`;
}

function getSyncQueueStorageKey(scope = syncScope) {
  return `${SYNC_QUEUE_KEY_BASE}:${getScopeStoragePrefix(scope)}`;
}

function getSyncMetaStorageKey(scope = syncScope) {
  return `${SYNC_META_KEY_BASE}:${getScopeStoragePrefix(scope)}`;
}

function isSameScope(a, b) {
  const left = normalizeSyncScope(a);
  const right = normalizeSyncScope(b);
  return left.userId === right.userId && left.shopId === right.shopId;
}

function getDefaultSyncMeta() {
  return {
    lastSyncedAt: null,
    lastAttemptAt: null,
    lastError: null,
    isSyncing: false,
  };
}

function loadSyncMeta(scope = syncScope) {
  try {
    const raw = localStorage.getItem(getSyncMetaStorageKey(scope));
    if (!raw) return getDefaultSyncMeta();
    return { ...getDefaultSyncMeta(), ...JSON.parse(raw) };
  } catch {
    return getDefaultSyncMeta();
  }
}

function persistSyncMeta(meta, scope = syncScope) {
  syncMeta = meta;
  try {
    localStorage.setItem(getSyncMetaStorageKey(scope), JSON.stringify(meta));
  } catch (err) {
    console.warn('[Sync] Failed to persist sync metadata:', err?.message || err);
  }
}

function patchSyncMeta(partial) {
  persistSyncMeta({ ...syncMeta, ...partial });
}

function readSyncQueue(scope = syncScope) {
  try {
    const raw = localStorage.getItem(getSyncQueueStorageKey(scope));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSyncQueue(queue, scope = syncScope) {
  try {
    localStorage.setItem(getSyncQueueStorageKey(scope), JSON.stringify(queue));
  } catch (err) {
    console.warn('[Sync] Failed to persist sync queue:', err?.message || err);
  }
}

export function setSyncScope(scope) {
  const nextScope = normalizeSyncScope(scope || DEFAULT_SYNC_SCOPE);
  const scopeChanged = !isSameScope(syncScope, nextScope);
  syncScope = nextScope;
  syncMeta = loadSyncMeta(syncScope);

  emitSyncStatus(readSyncQueue(syncScope));

  if (scopeChanged && isOnline()) {
    processSyncQueue('scope-change').catch((err) => {
      console.warn('[Sync] Scope-change queue sync failed:', err?.message || err);
    });
  }

  return computeSyncStatus(readSyncQueue(syncScope));
}

export function clearSyncQueueForScope(scope = syncScope) {
  const targetScope = normalizeSyncScope(scope);
  try {
    localStorage.removeItem(getSyncQueueStorageKey(targetScope));
    localStorage.removeItem(getSyncMetaStorageKey(targetScope));
  } catch (err) {
    console.warn('[Sync] Failed to clear scoped sync data:', err?.message || err);
  }

  if (isSameScope(syncScope, targetScope)) {
    syncMeta = getDefaultSyncMeta();
    emitSyncStatus([]);
  }

  return {
    scope: targetScope,
    status: computeSyncStatus(isSameScope(syncScope, targetScope) ? [] : readSyncQueue(syncScope)),
  };
}

function isOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

function computeSyncStatus(queue = readSyncQueue()) {
  const first = queue[0] || null;
  return {
    pendingCount: queue.length,
    hasPendingWrites: queue.length > 0,
    isSyncing: Boolean(syncMeta.isSyncing || isProcessingQueue),
    isOnline: isOnline(),
    lastSyncedAt: syncMeta.lastSyncedAt,
    lastAttemptAt: syncMeta.lastAttemptAt,
    lastError: syncMeta.lastError,
    nextRetryAt: first?.nextRetryAt || null,
    oldestPendingAt: first?.createdAt || null,
  };
}

function getKindMeta(kind) {
  return SYNC_KIND_META[kind] || { label: kind || 'Unknown', icon: '🔄' };
}

function truncateText(value, maxLen = 72) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function summarizeQueuePayload(kind, payload = {}) {
  if (kind === 'invoice') {
    const lines = Array.isArray(payload.items) ? payload.items.length : 0;
    const qty = (payload.items || []).reduce((sum, row) => sum + Number(row?.qty || 0), 0);
    const party = payload.partyName ? ` · ${truncateText(payload.partyName, 26)}` : '';
    return `${lines} line${lines === 1 ? '' : 's'} · Qty ${qty}${party}`;
  }

  if (kind === 'purchase') {
    const qty = Number(payload.qty || 0);
    const supplier = payload.supplier ? ` · ${truncateText(payload.supplier, 26)}` : '';
    return `+${qty} units${supplier}`;
  }

  if (kind === 'adjustment') {
    const type = String(payload.type || 'ADJUSTMENT').toUpperCase();
    const qty = Number(payload.qty || 0);
    return `${type} · Qty ${qty}`;
  }

  if (kind === 'product-update') {
    const item = payload.inventoryId ? String(payload.inventoryId).slice(0, 8) : 'item';
    return `Pricing/rack update · ${item}`;
  }

  return truncateText(JSON.stringify(payload), 70) || 'Queued update';
}

function toQueueViewItem(item, index, size) {
  const meta = getKindMeta(item.kind);
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: meta.label,
    icon: meta.icon,
    summary: summarizeQueuePayload(item.kind, item.payload),
    payload: item.payload,
    createdAt: item.createdAt || null,
    lastTriedAt: item.lastTriedAt || null,
    retryCount: Number(item.retryCount || 0),
    nextRetryAt: item.nextRetryAt || null,
    lastError: item.lastError || null,
    lastErrorStatus: item.lastErrorStatus || null,
    lastErrorCode: item.lastErrorCode || null,
    isBlocking: size > 0 && index === 0,
  };
}

function emitSyncStatus(queue = readSyncQueue()) {
  const status = computeSyncStatus(queue);
  for (const fn of syncSubscribers) {
    try {
      fn(status);
    } catch (err) {
      console.warn('[Sync] Status subscriber callback failed:', err?.message || err);
    }
  }
}

function newQueueItem(kind, payload) {
  return {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    payload,
    createdAt: Date.now(),
    lastTriedAt: null,
    retryCount: 0,
    nextRetryAt: Date.now(),
    lastError: null,
    lastErrorStatus: null,
    lastErrorCode: null,
  };
}

function shouldRetry(err) {
  const status = Number(err?.status || 0);
  const code = String(err?.code || err?.data?.error?.code || '').toUpperCase();

  // Auth/permission failures need user action (re-login/role fix), so do not retry-loop.
  if (status === 401 || status === 403) return false;
  if (code.includes('TOKEN') || code.includes('AUTH') || code.includes('UNAUTH')) return false;

  // Retry network errors + transient HTTP failures.
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function computeBackoffMs(retryCount) {
  const jitter = Math.floor(Math.random() * 600);
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * (2 ** Math.max(0, retryCount - 1))) + jitter;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTenderAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function normalizePaymentMode(mode, amounts = {}) {
  const key = String(mode || '').trim().toUpperCase();
  const mapped = MODE_MAP[key] || (key || 'CASH');
  const activeTenders = [amounts.cashAmount, amounts.upiAmount, amounts.creditAmount].filter(Boolean).length;
  return activeTenders > 1 ? 'SPLIT' : mapped;
}

function normalizeInvoicePayload(payload = {}) {
  const items = (payload.items || []).map(item => ({
    inventoryId: item.inventoryId,
    qty: Number(item.qty || 0),
    unitPrice: Number(item.unitPrice || 0),
    discount: Number(item.discount || 0),
  }));

  const inferredTotal = items.reduce((sum, item) => {
    return sum + Math.max(0, (item.unitPrice * item.qty) - item.discount);
  }, 0);

  let normalizedCash = normalizeTenderAmount(payload.cashAmount);
  let normalizedUpi = normalizeTenderAmount(payload.upiAmount);
  let normalizedCredit = normalizeTenderAmount(payload.creditAmount);
  let normalizedMode = normalizePaymentMode(payload.paymentMode, {
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

  return {
    items,
    partyId: payload.partyId || undefined,
    partyName: payload.partyName || undefined,
    partyPhone: payload.partyPhone || undefined,
    paymentMode: MODE_ALIAS[normalizedMode] || normalizedMode || 'CASH',
    cashAmount: normalizedCash,
    upiAmount: normalizedUpi,
    creditAmount: normalizedCredit,
    notes: payload.notes || undefined,
  };
}

async function performSyncOperation(item) {
  const payload = item?.payload || {};
  if (item.kind === 'invoice') {
    await api.post('/api/billing/invoice', normalizeInvoicePayload(payload));
    return;
  }

  if (item.kind === 'purchase') {
    await api.post('/api/shop/inventory/purchase', {
      inventoryId: payload.inventoryId,
      qty: payload.qty,
      buyingPrice: payload.buyingPrice,
      newSellingPrice: payload.newSellingPrice,
      supplier: payload.supplier,
      invoiceNo: payload.invoiceNo,
      payment: payload.payment,
      creditDays: payload.creditDays,
      notes: payload.notes,
    });
    return;
  }

  if (item.kind === 'adjustment') {
    await api.post('/api/shop/inventory/adjust', {
      inventoryId: payload.inventoryId,
      type: payload.type,
      qty: payload.qty,
      reason: payload.reason,
      refundMethod: payload.refundMethod,
      refundAmount: payload.refundAmount,
      supplierName: payload.supplierName,
      originalInvoice: payload.originalInvoice,
      notes: payload.notes,
    });
    return;
  }

  if (item.kind === 'product-update') {
    await api.put(`/api/shop/inventory/${payload.inventoryId}`, {
      sellingPrice: payload.sellPrice,
      buyingPrice: payload.buyPrice,
      rackLocation: payload.rack,
      minStockAlert: payload.minStock,
      isMarketplaceListed: payload.isMarketplaceListed,
    });
    return;
  }

  throw Object.assign(new Error(`Unknown sync operation: ${item.kind}`), { status: 400, code: 'SYNC_UNKNOWN_KIND' });
}

async function processSyncQueue(reason = 'auto', { deadlineTs = 0 } = {}) {
  if (isProcessingQueue) return computeSyncStatus();

  if (!isOnline()) {
    patchSyncMeta({ isSyncing: false, lastError: 'Offline: waiting for connection.' });
    emitSyncStatus();
    return computeSyncStatus();
  }

  const queue = readSyncQueue();
  if (queue.length === 0) {
    patchSyncMeta({ isSyncing: false, lastError: null });
    emitSyncStatus(queue);
    return computeSyncStatus(queue);
  }

  isProcessingQueue = true;
  patchSyncMeta({ isSyncing: true, lastAttemptAt: Date.now() });
  emitSyncStatus(queue);

  try {
    let workingQueue = readSyncQueue();
    while (workingQueue.length > 0) {
      if (deadlineTs && Date.now() >= deadlineTs) break;

      const first = workingQueue[0];
      if (first?.nextRetryAt && first.nextRetryAt > Date.now()) break;

      try {
        await performSyncOperation(first);
        workingQueue.shift();
        writeSyncQueue(workingQueue);
        patchSyncMeta({ lastSyncedAt: Date.now(), lastError: null });
        emitSyncStatus(workingQueue);
      } catch (err) {
        const retryCount = Number(first.retryCount || 0) + 1;
        const updated = {
          ...first,
          retryCount,
          lastTriedAt: Date.now(),
          lastError: err?.message || 'Sync failed',
          lastErrorStatus: Number(err?.status || 0) || null,
          lastErrorCode: err?.code || null,
          nextRetryAt: Date.now() + computeBackoffMs(retryCount),
        };

        // Non-retryable errors are kept in queue with long retry interval so user sees the block.
        if (!shouldRetry(err) || retryCount >= MAX_RETRIES) {
          updated.nextRetryAt = Date.now() + MAX_RETRY_MS;
        }

        workingQueue[0] = updated;
        writeSyncQueue(workingQueue);
        patchSyncMeta({
          lastAttemptAt: Date.now(),
          lastError: updated.lastError,
        });
        emitSyncStatus(workingQueue);
        break;
      }
    }

    return computeSyncStatus(readSyncQueue());
  } finally {
    isProcessingQueue = false;
    patchSyncMeta({ isSyncing: false });
    emitSyncStatus();
    if (reason) {
      // Keep this no-op branch so reason is visible in debugger while stepping through sync flow.
    }
  }
}

function enqueueSyncOperation(kind, payload) {
  const queue = readSyncQueue();
  queue.push(newQueueItem(kind, payload));
  writeSyncQueue(queue);
  emitSyncStatus(queue);
  processSyncQueue('enqueue').catch((err) => {
    console.warn('[Sync] Queue processing failed after enqueue:', err?.message || err);
  });
  return queue.length;
}

export function getSyncStatus() {
  return computeSyncStatus();
}

export function getSyncQueueSnapshot() {
  const queue = readSyncQueue();
  return {
    status: computeSyncStatus(queue),
    items: queue.map((item, index) => toQueueViewItem(item, index, queue.length)),
  };
}

export function subscribeSyncStatus(listener) {
  if (typeof listener !== 'function') return () => {};
  syncSubscribers.add(listener);
  try {
    listener(getSyncStatus());
  } catch (err) {
    console.warn('[Sync] Initial status callback failed:', err?.message || err);
  }
  return () => {
    syncSubscribers.delete(listener);
  };
}

export async function flushSyncQueue({ reason = 'manual', timeoutMs = 20000 } = {}) {
  const timeout = Math.max(0, Number(timeoutMs) || 0);
  const deadlineTs = timeout > 0 ? Date.now() + timeout : 0;

  let status = await processSyncQueue(reason, { deadlineTs }).catch(() => computeSyncStatus());

  while (status.pendingCount > 0) {
    if (deadlineTs && Date.now() >= deadlineTs) break;

    const waitUntil = status.nextRetryAt && status.nextRetryAt > Date.now()
      ? Math.min(status.nextRetryAt, deadlineTs || status.nextRetryAt)
      : Date.now() + 350;

    const waitMs = Math.max(120, Math.min(900, waitUntil - Date.now()));
    await sleep(waitMs);
    status = await processSyncQueue(reason, { deadlineTs }).catch(() => computeSyncStatus());
  }

  const finalStatus = computeSyncStatus();
  return {
    synced: finalStatus.pendingCount === 0,
    pendingCount: finalStatus.pendingCount,
    status: finalStatus,
  };
}

export async function retrySyncQueueItem(itemId, { timeoutMs = 12000 } = {}) {
  if (!itemId) {
    return { retried: false, reason: 'MISSING_ID', snapshot: getSyncQueueSnapshot() };
  }

  const queue = readSyncQueue();
  const index = queue.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return { retried: false, reason: 'NOT_FOUND', snapshot: getSyncQueueSnapshot() };
  }

  queue[index] = {
    ...queue[index],
    nextRetryAt: Date.now(),
    lastError: null,
    lastErrorStatus: null,
    lastErrorCode: null,
  };

  writeSyncQueue(queue);
  emitSyncStatus(queue);

  const result = await flushSyncQueue({ reason: 'item-retry', timeoutMs });
  return {
    retried: true,
    ...result,
    snapshot: getSyncQueueSnapshot(),
  };
}

export function discardSyncQueueItem(itemId) {
  if (!itemId) {
    return { removed: false, reason: 'MISSING_ID', snapshot: getSyncQueueSnapshot() };
  }

  const queue = readSyncQueue();
  const index = queue.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return { removed: false, reason: 'NOT_FOUND', snapshot: getSyncQueueSnapshot() };
  }

  const [removedItem] = queue.splice(index, 1);
  writeSyncQueue(queue);
  if (queue.length === 0) {
    patchSyncMeta({ lastError: null });
  }
  emitSyncStatus(queue);

  processSyncQueue('discard').catch((err) => {
    console.warn('[Sync] Queue processing failed after discard:', err?.message || err);
  });

  return {
    removed: true,
    removedItem: toQueueViewItem(removedItem, 0, 1),
    snapshot: {
      status: computeSyncStatus(queue),
      items: queue.map((item, idx) => toQueueViewItem(item, idx, queue.length)),
    },
  };
}

if (typeof window !== 'undefined' && !window.__asSyncBootstrappedV1) {
  window.__asSyncBootstrappedV1 = true;
  window.addEventListener('online', () => {
    patchSyncMeta({ lastError: null });
    processSyncQueue('online').catch((err) => {
      console.warn('[Sync] Online-triggered queue sync failed:', err?.message || err);
    });
  });
  window.addEventListener('storage', (e) => {
    const queueKey = getSyncQueueStorageKey();
    const metaKey = getSyncMetaStorageKey();
    if (!e.key || e.key === queueKey || e.key === metaKey) {
      syncMeta = loadSyncMeta();
      emitSyncStatus();
    }
  });
  setTimeout(() => {
    processSyncQueue('bootstrap').catch((err) => {
      console.warn('[Sync] Bootstrap queue sync failed:', err?.message || err);
    });
  }, 200);
}

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
  try {
    const data = await api.get('/api/shop/inventory/movements', { limit: 1000 });
    return (data.movements || []).map(mapMovement);
  } catch (err) {
    console.warn('[Sync] Could not fetch movements from API:', err.message);
    return null;
  }
}

// Sync a product save to the API (fire-and-forget)
export async function syncProductSave(product) {
  if (!isDbUuid(product?.inventoryId)) return { queued: false, reason: 'LOCAL_ONLY_ID' };
  enqueueSyncOperation('product-update', {
    inventoryId: product.inventoryId,
    sellPrice: product.sellPrice,
    buyPrice: product.buyPrice,
    rack: product.rack,
    minStock: product.minStock,
    isMarketplaceListed: product.isMarketplaceListed,
  });
  return { queued: true };
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
  if (!hasRealIds) return { queued: false, reason: 'LOCAL_ONLY_ID' };
  enqueueSyncOperation('invoice', {
    items,
    partyId,
    partyName,
    partyPhone,
    paymentMode,
    cashAmount,
    upiAmount,
    creditAmount,
    notes,
  });
  return { queued: true };
}

/**
 * Sync a single-item stock purchase to the backend.
 */
export async function syncPurchase({ inventoryId, qty, buyingPrice, newSellingPrice, supplier, invoiceNo, payment, creditDays, notes }) {
  if (!isDbUuid(inventoryId)) return { queued: false, reason: 'LOCAL_ONLY_ID' };
  enqueueSyncOperation('purchase', {
    inventoryId, qty, buyingPrice, newSellingPrice, supplier, invoiceNo, payment, creditDays, notes,
  });
  return { queued: true };
}

/**
 * Sync a stock adjustment to the backend.
 * type: RETURN_IN | RETURN_OUT | DAMAGE | THEFT | AUDIT | ADJUSTMENT | OPENING
 */
export async function syncAdjustment({ inventoryId, type, qty, reason, refundMethod, refundAmount, supplierName, originalInvoice, notes }) {
  if (!isDbUuid(inventoryId)) return { queued: false, reason: 'LOCAL_ONLY_ID' };
  enqueueSyncOperation('adjustment', {
    inventoryId, type, qty, reason, refundMethod, refundAmount, supplierName, originalInvoice, notes,
  });
  return { queued: true };
}

/**
 * Returns true if the ID looks like a real Postgres UUID (from the DB),
 * false if it's seed data (e.g. "p1", "p2", "s1").
 */
function isDbUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
