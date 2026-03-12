import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, requireShopOwner } from '../middleware/auth.js';

const router = Router();

// GET /api/shop/dashboard?period=today|week|month
router.get('/', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { period = 'today' } = req.query;
    const shopId = req.shopId;

    const now = new Date();
    let startDate;
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Sales aggregates
    const salesAgg = await prisma.movement.aggregate({
      where: { shopId, type: 'SALE', createdAt: { gte: startDate } },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    });

    // Purchase aggregates
    const purchaseAgg = await prisma.movement.aggregate({
      where: { shopId, type: 'PURCHASE', createdAt: { gte: startDate } },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Low stock items
    const lowStockItems = await prisma.shopInventory.findMany({
      where: {
        shopId,
        stockQty: { lte: prisma.shopInventory.fields.minStockAlert },
      },
      include: { masterPart: true },
      take: 10,
    });

    // Top selling products
    const topProducts = await prisma.movement.groupBy({
      by: ['inventoryId'],
      where: { shopId, type: 'SALE', createdAt: { gte: startDate } },
      _sum: { qty: true, totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    // Outstanding dues
    const totalOutstanding = await prisma.party.aggregate({
      where: { shopId, type: { in: ['CUSTOMER', 'BOTH'] } },
      _sum: { outstanding: true },
    });

    res.json({
      period,
      revenue: Number(salesAgg._sum.totalAmount || 0),
      profit: Number(salesAgg._sum.profit || 0),
      salesCount: salesAgg._count,
      purchaseAmount: Number(purchaseAgg._sum.totalAmount || 0),
      purchaseCount: purchaseAgg._count,
      totalOutstanding: Number(totalOutstanding._sum.outstanding || 0),
      lowStockCount: lowStockItems.length,
      lowStockItems,
      topProducts,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
