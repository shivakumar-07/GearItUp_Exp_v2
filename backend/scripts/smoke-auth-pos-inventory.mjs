const BASE_URL = (process.env.SMOKE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const FIREBASE_TOKEN = process.env.SMOKE_FIREBASE_TOKEN || process.env.FIREBASE_TOKEN || 'dev:9998887777';
const SMOKE_ACCESS_TOKEN = process.env.SMOKE_ACCESS_TOKEN || '';
const SMOKE_ROLE = process.env.SMOKE_ROLE || 'shop';
const SMOKE_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
const DIRECT_JWT_FALLBACK = process.env.SMOKE_DIRECT_JWT_FALLBACK !== 'false';
const CATALOG_QUERIES = (process.env.SMOKE_CATALOG_QUERIES || 'br,fi,oi')
  .split(',')
  .map((q) => q.trim())
  .filter(Boolean);

function nowStamp() {
  return new Date().toISOString().replace(/[T:.Z-]/g, '').slice(0, 14);
}

function parseMaybeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isLocalBaseUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

async function request(method, path, { token, body, allowStatuses = [200] } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SMOKE_TIMEOUT_MS);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const raw = await res.text();
    const data = parseMaybeJson(raw);

    if (!allowStatuses.includes(res.status)) {
      const detail = typeof data === 'string' ? data : JSON.stringify(data);
      throw new Error(`${method} ${path} failed (${res.status}): ${detail}`);
    }

    return { status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken() {
  if (SMOKE_ACCESS_TOKEN) {
    console.log('[SMOKE] Using access token from SMOKE_ACCESS_TOKEN');
    return SMOKE_ACCESS_TOKEN;
  }

  try {
    const auth = await request('POST', '/api/auth/firebase', {
      body: { firebaseToken: FIREBASE_TOKEN, role: SMOKE_ROLE },
    });

    const accessToken = auth.data?.accessToken || auth.data?.data?.accessToken;
    if (!accessToken) {
      throw new Error('Auth succeeded but no access token returned from /api/auth/firebase');
    }

    return accessToken;
  } catch (err) {
    if (!DIRECT_JWT_FALLBACK || !isLocalBaseUrl(BASE_URL)) {
      throw err;
    }

    console.log('[SMOKE] Firebase auth failed; attempting local direct-JWT fallback');
    return getLocalDirectToken();
  }
}

async function getLocalDirectToken() {
  const [{ config }, { PrismaClient }, jwtModule, pathModule, urlModule] = await Promise.all([
    import('dotenv'),
    import('@prisma/client'),
    import('jsonwebtoken'),
    import('path'),
    import('url'),
  ]);

  const path = pathModule.default;
  const { fileURLToPath } = urlModule;
  const jwt = jwtModule.default;

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  config({ path: path.resolve(scriptDir, '..', '.env'), override: false });

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing; cannot mint local smoke token');
  }

  const prisma = new PrismaClient();
  try {
    let user = await prisma.user.findFirst({
      where: {
        role: 'SHOP_OWNER',
        isActive: true,
        shopId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      const suffix = nowStamp().slice(-8);
      const phone = `9${suffix.slice(0, 9).padEnd(9, '0')}`;
      const shop = await prisma.shop.create({
        data: {
          name: `AutoSpace Smoke Shop ${suffix}`,
          ownerName: 'Smoke Runner',
          phone,
          city: 'Hyderabad',
          pincode: '500001',
        },
      });

      user = await prisma.user.create({
        data: {
          name: 'Smoke Runner',
          role: 'SHOP_OWNER',
          phone,
          phoneVerified: true,
          isVerified: true,
          shopId: shop.shopId,
        },
      });
    }

    return jwt.sign(
      { userId: user.userId, shopId: user.shopId || null, role: user.role || 'SHOP_OWNER' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
  } finally {
    await prisma.$disconnect();
  }

  return accessToken;
}

async function ensureShop(token) {
  const me = await request('GET', '/api/auth/me', { token });
  const meData = me.data?.data || me.data;

  if (meData?.shopId) {
    return meData.shopId;
  }

  const payload = {
    name: `AutoSpace Smoke Shop ${nowStamp()}`,
    ownerName: 'Smoke Runner',
    city: 'Hyderabad',
    pincode: '500001',
  };

  await request('POST', '/api/auth/register-shop', { token, body: payload });
  const meAfter = await request('GET', '/api/auth/me', { token });
  const meAfterData = meAfter.data?.data || meAfter.data;

  if (!meAfterData?.shopId) {
    throw new Error('Shop registration did not return a shopId for authenticated user');
  }

  return meAfterData.shopId;
}

async function findCatalogPart() {
  for (const query of CATALOG_QUERIES) {
    const res = await request('GET', `/api/catalog/search?q=${encodeURIComponent(query)}&limit=5`);
    const parts = res.data?.parts || [];
    if (parts.length > 0) return parts[0];
  }
  throw new Error(`No catalog part found for queries: ${CATALOG_QUERIES.join(', ')}`);
}

async function ensureInventoryItem(token) {
  const inv = await request('GET', '/api/shop/inventory', { token });
  const items = inv.data?.inventory || [];

  if (items.length > 0) {
    const preferred = items.find((item) => toNumber(item.computedStock ?? item.stockQty) >= 1) || items[0];
    return preferred;
  }

  const part = await findCatalogPart();
  const createRes = await request('POST', '/api/shop/inventory', {
    token,
    body: {
      masterPartId: part.masterPartId,
      sellingPrice: 499,
      buyingPrice: 320,
      stockQty: 2,
      rackLocation: 'SMOKE-A1',
      minStockAlert: 1,
      isMarketplaceListed: false,
    },
    allowStatuses: [200, 409],
  });

  if (createRes.status === 200 && createRes.data?.item) {
    return createRes.data.item;
  }

  const fallback = await request('GET', '/api/shop/inventory', { token });
  const fallbackItems = fallback.data?.inventory || [];
  const byPart = fallbackItems.find((item) => item.masterPartId === part.masterPartId);
  if (!byPart) {
    throw new Error('Inventory creation returned conflict but no matching inventory row was found');
  }

  return byPart;
}

async function run() {
  console.log(`[SMOKE] Base URL: ${BASE_URL}`);

  const health = await request('GET', '/health');
  if (health.data?.status !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(health.data)}`);
  }
  console.log('[SMOKE] Health check passed');

  const token = await getAccessToken();
  console.log('[SMOKE] Auth token acquired');

  const shopId = await ensureShop(token);
  console.log(`[SMOKE] Shop ready: ${shopId}`);

  const inventoryItem = await ensureInventoryItem(token);
  const inventoryId = inventoryItem.inventoryId;
  if (!inventoryId) {
    throw new Error('Inventory item does not include inventoryId');
  }

  const price = Math.max(1, toNumber(inventoryItem.sellingPrice, 499));
  const buyPrice = Math.max(1, toNumber(inventoryItem.buyingPrice, Math.round(price * 0.6)));

  const purchase = await request('POST', '/api/shop/inventory/purchase', {
    token,
    body: {
      inventoryId,
      qty: 2,
      buyingPrice: buyPrice,
      notes: 'Smoke test purchase',
    },
  });
  console.log(`[SMOKE] Purchase write passed (newStock=${purchase.data?.newStock ?? 'n/a'})`);

  const invoice = await request('POST', '/api/billing/invoice', {
    token,
    body: {
      items: [{ inventoryId, qty: 1, unitPrice: price, discount: 0 }],
      paymentMode: 'CASH',
      cashAmount: price,
      notes: 'Smoke test POS invoice',
    },
  });
  const invoiceId = invoice.data?.invoice?.invoiceId;
  if (!invoiceId) {
    throw new Error(`Invoice write succeeded but invoiceId missing: ${JSON.stringify(invoice.data)}`);
  }
  console.log(`[SMOKE] POS invoice write passed (invoiceId=${invoiceId})`);

  const adjust = await request('POST', '/api/shop/inventory/adjust', {
    token,
    body: {
      inventoryId,
      type: 'DAMAGE',
      qty: 1,
      notes: 'Smoke test adjustment',
    },
  });
  console.log(`[SMOKE] Inventory adjust write passed (newStock=${adjust.data?.newStock ?? 'n/a'})`);

  const movements = await request('GET', `/api/shop/inventory/${inventoryId}/movements`, { token });
  const rows = movements.data?.movements || [];
  const hasSale = rows.some((m) => m.type === 'SALE');
  const hasPurchase = rows.some((m) => m.type === 'PURCHASE');

  if (!hasSale || !hasPurchase) {
    throw new Error(`Movement verification failed (hasSale=${hasSale}, hasPurchase=${hasPurchase})`);
  }

  console.log('[SMOKE] Movement verification passed');
  console.log('[SMOKE] RESULT: PASS');
}

run().catch((err) => {
  console.error('[SMOKE] RESULT: FAIL');
  console.error(err.message || err);
  process.exitCode = 1;
});
