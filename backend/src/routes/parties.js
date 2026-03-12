import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, requireShopOwner } from '../middleware/auth.js';

const router = Router();

// GET /api/shop/parties
router.get('/', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = { shopId: req.shopId, isActive: true };
    if (type) where.type = type;

    const parties = await prisma.party.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json({ parties });
  } catch (err) {
    next(err);
  }
});

// POST /api/shop/parties
router.post('/', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { name, phone, gstin, address, type, creditLimit, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const party = await prisma.party.create({
      data: {
        shopId: req.shopId,
        name,
        phone,
        gstin,
        address,
        type: type || 'CUSTOMER',
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        notes,
      },
    });
    res.json({ success: true, party });
  } catch (err) {
    next(err);
  }
});

// GET /api/shop/parties/:id/ledger
router.get('/:id/ledger', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const party = await prisma.party.findUnique({ where: { partyId: req.params.id } });
    if (!party || party.shopId !== req.shopId) return res.status(404).json({ error: 'Party not found' });

    const invoices = await prisma.invoice.findMany({
      where: { shopId: req.shopId, partyId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ party, invoices, outstanding: party.outstanding });
  } catch (err) {
    next(err);
  }
});

// POST /api/shop/parties/:id/payment
router.post('/:id/payment', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { amount, mode, reference, notes } = req.body;
    if (!amount || !mode) return res.status(400).json({ error: 'Amount and mode required' });

    const party = await prisma.party.findUnique({ where: { partyId: req.params.id } });
    if (!party || party.shopId !== req.shopId) return res.status(404).json({ error: 'Party not found' });

    await prisma.party.update({
      where: { partyId: req.params.id },
      data: { outstanding: { decrement: parseFloat(amount) } },
    });

    res.json({ success: true, newOutstanding: Number(party.outstanding) - parseFloat(amount) });
  } catch (err) {
    next(err);
  }
});

export default router;
