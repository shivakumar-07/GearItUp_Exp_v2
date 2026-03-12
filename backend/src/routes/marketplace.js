import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/marketplace/search?q=&vehicle_id=&lat=&lng=&radius=10
router.get('/search', async (req, res, next) => {
  try {
    const { q, vehicle_id, lat, lng, radius = 10, limit = 20, offset = 0 } = req.query;
    if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Query required' });

    // Find matching master parts
    const partWhere = {
      status: 'VERIFIED',
      OR: [
        { partName: { contains: q, mode: 'insensitive' } },
        { oemNumber: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (vehicle_id) {
      partWhere.fitments = { some: { vehicleId: vehicle_id } };
    }

    const parts = await prisma.masterPart.findMany({
      where: partWhere,
      include: {
        inventory: {
          where: {
            isMarketplaceListed: true,
            stockQty: { gt: 0 },
          },
          include: { shop: true },
        },
        fitments: vehicle_id ? { where: { vehicleId: vehicle_id }, include: { vehicle: true } } : false,
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    // Filter by location if provided
    const results = parts.map(part => ({
      ...part,
      shops: part.inventory
        .filter(inv => {
          if (!lat || !lng || !inv.shop.latitude || !inv.shop.longitude) return true;
          const dist = getDistanceKm(parseFloat(lat), parseFloat(lng), Number(inv.shop.latitude), Number(inv.shop.longitude));
          return dist <= parseFloat(radius);
        })
        .map(inv => ({
          inventoryId: inv.inventoryId,
          shopId: inv.shopId,
          shopName: inv.shop.name,
          shopAddress: inv.shop.address,
          price: Number(inv.sellingPrice),
          stockQty: inv.stockQty,
          distance: (lat && lng && inv.shop.latitude)
            ? getDistanceKm(parseFloat(lat), parseFloat(lng), Number(inv.shop.latitude), Number(inv.shop.longitude)).toFixed(1)
            : null,
        }))
        .filter(s => s.stockQty > 0)
        .sort((a, b) => (a.distance || 999) - (b.distance || 999)),
    })).filter(p => p.shops.length > 0);

    res.json({ results, total: results.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/marketplace/orders
router.post('/orders', authenticate, async (req, res, next) => {
  try {
    const { items, customerName, deliveryAddress } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });

    // Validate stock
    for (const item of items) {
      const inv = await prisma.shopInventory.findUnique({ where: { inventoryId: item.inventoryId } });
      if (!inv || inv.stockQty < item.qty) {
        return res.status(400).json({ error: `Insufficient stock for item ${item.inventoryId}` });
      }
    }

    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
    const orderNumber = `ORD${Date.now()}`;

    // Group items by shop
    const shopGroups = items.reduce((acc, item) => {
      if (!acc[item.shopId]) acc[item.shopId] = [];
      acc[item.shopId].push(item);
      return acc;
    }, {});

    const orders = await Promise.all(
      Object.entries(shopGroups).map(async ([shopId, shopItems]) => {
        const shopSubtotal = shopItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
        const order = await prisma.marketplaceOrder.create({
          data: {
            orderNumber: `${orderNumber}-${shopId.slice(0, 6)}`,
            customerId: req.user.userId,
            customerPhone: req.user.phone,
            customerName: customerName || req.user.name,
            shopId,
            subtotal: shopSubtotal,
            total: shopSubtotal,
            deliveryAddress,
            status: 'PENDING',
            items: {
              create: shopItems.map(i => ({
                inventoryId: i.inventoryId,
                partName: i.partName,
                qty: i.qty,
                unitPrice: i.unitPrice,
                total: i.unitPrice * i.qty,
              })),
            },
          },
          include: { items: true },
        });

        // Reserve stock
        for (const item of shopItems) {
          await prisma.shopInventory.update({
            where: { inventoryId: item.inventoryId },
            data: { reservedQty: { increment: item.qty } },
          });
        }

        return order;
      })
    );

    res.json({ success: true, orders, orderNumber });
  } catch (err) {
    next(err);
  }
});

// PUT /api/marketplace/orders/:id/status
router.put('/orders/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['CONFIRMED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const order = await prisma.marketplaceOrder.findUnique({
      where: { orderId: req.params.id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Only the shop owner can update the status (or admin)
    if (req.user.role !== 'PLATFORM_ADMIN' && order.shopId !== req.user.shopId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.marketplaceOrder.update({
      where: { orderId: req.params.id },
      data: { status },
    });

    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
});

// GET /api/marketplace/orders/:id/track
router.get('/orders/:id/track', async (req, res, next) => {
  try {
    const order = await prisma.marketplaceOrder.findUnique({
      where: { orderId: req.params.id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
