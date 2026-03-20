import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, requireShopOwner } from '../middleware/auth.js';

const router = Router();

// GET /api/shop/inventory
router.get('/', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const shopId = req.shopId;
    const inventory = await prisma.shopInventory.findMany({
      where: { shopId },
      include: {
        masterPart: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { masterPart: { partName: 'asc' } },
    });

    // Compute stock from movements for each item
    const inventoryWithStock = await Promise.all(
      inventory.map(async (item) => {
        const stock = await computeStock(item.inventoryId);
        return { ...item, computedStock: stock };
      })
    );

    res.json({ inventory: inventoryWithStock });
  } catch (err) {
    next(err);
  }
});

// POST /api/shop/inventory
router.post('/', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { masterPartId, sellingPrice, buyingPrice, stockQty, rackLocation, minStockAlert, isMarketplaceListed } = req.body;
    if (!masterPartId || !sellingPrice) {
      return res.status(400).json({ error: 'masterPartId and sellingPrice required' });
    }

    const existing = await prisma.shopInventory.findUnique({
      where: { shopId_masterPartId: { shopId: req.shopId, masterPartId } },
    });
    if (existing) return res.status(409).json({ error: 'Product already in inventory', inventoryId: existing.inventoryId });

    const item = await prisma.shopInventory.create({
      data: {
        shopId: req.shopId,
        masterPartId,
        sellingPrice: parseFloat(sellingPrice),
        buyingPrice: buyingPrice ? parseFloat(buyingPrice) : null,
        stockQty: stockQty || 0,
        rackLocation,
        minStockAlert: minStockAlert || 5,
        isMarketplaceListed: isMarketplaceListed || false,
      },
      include: { masterPart: true },
    });

    // If opening stock provided, create an OPENING movement
    if (stockQty && stockQty > 0) {
      await prisma.movement.create({
        data: {
          shopId: req.shopId,
          inventoryId: item.inventoryId,
          type: 'OPENING',
          qty: parseInt(stockQty),
          unitPrice: buyingPrice ? parseFloat(buyingPrice) : null,
          notes: 'Opening stock',
        },
      });
    }

    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
});

// PUT /api/shop/inventory/:id
router.put('/:id', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { sellingPrice, buyingPrice, rackLocation, minStockAlert, isMarketplaceListed } = req.body;

    const item = await prisma.shopInventory.findUnique({
      where: { inventoryId: req.params.id },
    });
    if (!item || item.shopId !== req.shopId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updated = await prisma.shopInventory.update({
      where: { inventoryId: req.params.id },
      data: {
        ...(sellingPrice !== undefined && { sellingPrice: parseFloat(sellingPrice) }),
        ...(buyingPrice !== undefined && { buyingPrice: parseFloat(buyingPrice) }),
        ...(rackLocation !== undefined && { rackLocation }),
        ...(minStockAlert !== undefined && { minStockAlert: parseInt(minStockAlert) }),
        ...(isMarketplaceListed !== undefined && { isMarketplaceListed }),
      },
      include: { masterPart: true },
    });
    res.json({ success: true, item: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/shop/inventory/:id/movements
router.get('/:id/movements', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const item = await prisma.shopInventory.findUnique({ where: { inventoryId: req.params.id } });
    if (!item || item.shopId !== req.shopId) return res.status(404).json({ error: 'Item not found' });

    const movements = await prisma.movement.findMany({
      where: { inventoryId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    const currentStock = await computeStock(req.params.id);
    res.json({ movements, currentStock });
  } catch (err) {
    next(err);
  }
});

// POST /api/shop/inventory/purchase
router.post('/purchase', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { inventoryId, qty, unitPrice, partyId, notes } = req.body;
    if (!inventoryId || !qty) return res.status(400).json({ error: 'inventoryId and qty required' });

    const item = await prisma.shopInventory.findUnique({ where: { inventoryId } });
    if (!item || item.shopId !== req.shopId) return res.status(404).json({ error: 'Item not found' });

    const totalAmount = unitPrice ? parseFloat(unitPrice) * parseInt(qty) : null;

    await prisma.$transaction(async (tx) => {
      // Record movement
      await tx.movement.create({
        data: {
          shopId: req.shopId,
          inventoryId,
          type: 'PURCHASE',
          qty: parseInt(qty),
          unitPrice: unitPrice ? parseFloat(unitPrice) : null,
          totalAmount,
          partyId,
          notes,
        },
      });

      // Update cached stock
      await tx.shopInventory.update({
        where: { inventoryId },
        data: { stockQty: { increment: parseInt(qty) } },
      });

      // Update buying price if provided
      if (unitPrice) {
        await tx.shopInventory.update({
          where: { inventoryId },
          data: { buyingPrice: parseFloat(unitPrice) },
        });
      }
    });

    const newStock = await computeStock(inventoryId);
    res.json({ success: true, newStock });
  } catch (err) {
    next(err);
  }
});

// POST /api/shop/inventory/bulk-stock-in
// Cart/bucket procurement — receives entire purchase session in one call.
// Body: {
//   items: [{ masterPartId, sellingPrice, buyingPrice?, stockQty?, rackLocation?,
//             minStockAlert?, shopSpecificNotes? }],
//   supplier: { name?, invoiceNo?, invoiceDate?, paymentMode?, creditDays?, notes? }
// }
// Returns: { success, created, updated, errorCount, errors,
//            items: [...ShopInventory+masterPart], movements: [...Movement] }
router.post('/bulk-stock-in', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { items, supplier = {} } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required and must be non-empty' });
    }
    if (items.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 items per bulk stock-in' });
    }

    const supplierNotes = [
      supplier.name       && `Supplier: ${supplier.name}`,
      supplier.invoiceNo  && `Invoice: ${supplier.invoiceNo}`,
      supplier.notes,
    ].filter(Boolean).join(' · ') || 'Bulk stock-in';

    const resultItems    = [];  // full ShopInventory objects returned to frontend
    const resultMovements = []; // all Movement objects created
    const errors = [];

    for (const item of items) {
      const {
        masterPartId, sellingPrice, buyingPrice, stockQty,
        rackLocation, minStockAlert, shopSpecificNotes,
      } = item;

      if (!masterPartId || sellingPrice == null) {
        errors.push({ masterPartId, error: 'masterPartId and sellingPrice are required' });
        continue;
      }

      try {
        const qty     = stockQty     ? parseInt(stockQty)       : 0;
        const buyP    = buyingPrice  ? parseFloat(buyingPrice)  : null;
        const sellP   = parseFloat(sellingPrice);
        const minAlert = minStockAlert ? parseInt(minStockAlert) : 5;

        const existing = await prisma.shopInventory.findUnique({
          where: { shopId_masterPartId: { shopId: req.shopId, masterPartId } },
        });

        let invId;
        let movType;

        if (existing) {
          // ── Already in inventory: add stock as PURCHASE ────────────────────
          const updateData = {
            ...(sellingPrice != null  && { sellingPrice: sellP }),
            ...(buyingPrice  != null  && { buyingPrice:  buyP  }),
            ...(rackLocation          && { rackLocation }),
            ...(shopSpecificNotes     && { shopSpecificNotes }),
            ...(qty > 0               && { stockQty: { increment: qty }, lastPurchasedAt: new Date() }),
          };
          await prisma.shopInventory.update({
            where: { inventoryId: existing.inventoryId },
            data: updateData,
          });
          invId   = existing.inventoryId;
          movType = 'PURCHASE';
        } else {
          // ── New to shop: create inventory row ──────────────────────────────
          const created = await prisma.shopInventory.create({
            data: {
              shopId:            req.shopId,
              masterPartId,
              sellingPrice:      sellP,
              buyingPrice:       buyP,
              stockQty:          qty,
              rackLocation:      rackLocation || null,
              minStockAlert:     minAlert,
              shopSpecificNotes: shopSpecificNotes || null,
              lastPurchasedAt:   qty > 0 ? new Date() : null,
            },
          });
          invId   = created.inventoryId;
          movType = 'OPENING';
        }

        // ── Record movement ───────────────────────────────────────────────────
        let mov = null;
        if (qty > 0) {
          mov = await prisma.movement.create({
            data: {
              shopId:      req.shopId,
              inventoryId: invId,
              type:        movType,
              qty,
              unitPrice:   buyP,
              totalAmount: buyP ? buyP * qty : null,
              notes:       supplierNotes,
            },
          });
          resultMovements.push(mov);
        }

        // ── Re-fetch full inventory row with masterPart ───────────────────────
        const fullInv = await prisma.shopInventory.findUnique({
          where: { inventoryId: invId },
          include: { masterPart: true },
        });
        resultItems.push({ ...fullInv, _status: existing ? 'updated' : 'created' });
      } catch (e) {
        errors.push({ masterPartId, error: e.message });
      }
    }

    const created = resultItems.filter(r => r._status === 'created').length;
    const updated = resultItems.filter(r => r._status === 'updated').length;

    res.json({
      success: true,
      created,
      updated,
      errorCount: errors.length,
      errors,
      items:     resultItems,
      movements: resultMovements,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/shop/inventory/:id/marketplace — toggle isMarketplaceListed
router.patch('/:id/marketplace', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const item = await prisma.shopInventory.findUnique({ where: { inventoryId: req.params.id } });
    if (!item || item.shopId !== req.shopId) return res.status(404).json({ error: 'Item not found' });

    const { listed } = req.body; // explicit boolean, or toggle if omitted
    const newValue = listed !== undefined ? Boolean(listed) : !item.isMarketplaceListed;

    const updated = await prisma.shopInventory.update({
      where: { inventoryId: req.params.id },
      data: { isMarketplaceListed: newValue },
      include: { masterPart: true },
    });
    res.json({ success: true, isMarketplaceListed: updated.isMarketplaceListed, item: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/shop/inventory/adjust
router.post('/adjust', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { inventoryId, type, qty, notes } = req.body;
    if (!inventoryId || !type || qty === undefined) return res.status(400).json({ error: 'inventoryId, type, and qty required' });

    const validTypes = ['ADJUSTMENT', 'DAMAGE', 'THEFT', 'RETURN_IN'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });

    const item = await prisma.shopInventory.findUnique({ where: { inventoryId } });
    if (!item || item.shopId !== req.shopId) return res.status(404).json({ error: 'Item not found' });

    const qtyChange = ['DAMAGE', 'THEFT'].includes(type) ? -Math.abs(parseInt(qty)) : parseInt(qty);

    await prisma.$transaction(async (tx) => {
      await tx.movement.create({
        data: {
          shopId: req.shopId,
          inventoryId,
          type,
          qty: parseInt(qty),
          notes,
        },
      });
      await tx.shopInventory.update({
        where: { inventoryId },
        data: { stockQty: { increment: qtyChange } },
      });
    });

    const newStock = await computeStock(inventoryId);
    res.json({ success: true, newStock });
  } catch (err) {
    next(err);
  }
});

// Helper: compute stock from movements ledger
async function computeStock(inventoryId) {
  const movements = await prisma.movement.findMany({ where: { inventoryId } });
  return movements.reduce((total, m) => {
    if (['PURCHASE', 'OPENING', 'RETURN_IN'].includes(m.type)) return total + m.qty;
    if (['SALE', 'RETURN_OUT', 'DAMAGE', 'THEFT'].includes(m.type)) return total - m.qty;
    if (m.type === 'ADJUSTMENT') return total + m.qty; // qty can be negative for downward adj
    return total;
  }, 0);
}

export default router;
