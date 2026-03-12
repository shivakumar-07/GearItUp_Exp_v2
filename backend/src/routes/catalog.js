import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/catalog/search?q=&vehicle_id=
router.get('/search', async (req, res, next) => {
  try {
    const { q, vehicle_id, limit = 20, offset = 0 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const whereClause = {
      status: 'VERIFIED',
      OR: [
        { partName: { contains: q, mode: 'insensitive' } },
        { oemNumber: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ],
    };

    // If vehicle_id provided, filter by fitment
    let parts;
    if (vehicle_id) {
      parts = await prisma.masterPart.findMany({
        where: {
          ...whereClause,
          fitments: {
            some: { vehicleId: vehicle_id },
          },
        },
        include: {
          fitments: {
            where: { vehicleId: vehicle_id },
            include: { vehicle: true },
          },
        },
        take: parseInt(limit),
        skip: parseInt(offset),
      });
    } else {
      parts = await prisma.masterPart.findMany({
        where: whereClause,
        take: parseInt(limit),
        skip: parseInt(offset),
      });
    }

    res.json({ parts, total: parts.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/catalog/parts/:masterPartId
router.get('/parts/:masterPartId', async (req, res, next) => {
  try {
    const part = await prisma.masterPart.findUnique({
      where: { masterPartId: req.params.masterPartId },
      include: {
        fitments: { include: { vehicle: true } },
      },
    });
    if (!part) return res.status(404).json({ error: 'Part not found' });
    res.json(part);
  } catch (err) {
    next(err);
  }
});

// GET /api/catalog/oem/:oemNumber
router.get('/oem/:oemNumber', async (req, res, next) => {
  try {
    const parts = await prisma.masterPart.findMany({
      where: {
        oemNumber: { contains: req.params.oemNumber, mode: 'insensitive' },
        status: 'VERIFIED',
      },
      include: { fitments: { include: { vehicle: true } } },
    });
    res.json({ parts });
  } catch (err) {
    next(err);
  }
});

// GET /api/catalog/vehicles
router.get('/vehicles', async (req, res, next) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: [{ make: 'asc' }, { model: 'asc' }, { yearFrom: 'desc' }],
    });
    // Group by make
    const grouped = vehicles.reduce((acc, v) => {
      if (!acc[v.make]) acc[v.make] = [];
      acc[v.make].push(v);
      return acc;
    }, {});
    res.json({ vehicles, grouped });
  } catch (err) {
    next(err);
  }
});

// GET /api/catalog/vehicles/:make/models
router.get('/vehicles/:make/models', async (req, res, next) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { make: { equals: req.params.make, mode: 'insensitive' } },
      orderBy: [{ model: 'asc' }, { yearFrom: 'desc' }],
    });
    const models = [...new Set(vehicles.map(v => v.model))];
    res.json({ models, vehicles });
  } catch (err) {
    next(err);
  }
});

// POST /api/catalog/contribute
router.post('/contribute', authenticate, async (req, res, next) => {
  try {
    const { oemNumber, partName, brand, categoryL1, hsnCode, gstRate, unitOfSale, description, vehicles: vehicleData } = req.body;
    if (!partName) return res.status(400).json({ error: 'Part name is required' });

    const part = await prisma.masterPart.create({
      data: {
        oemNumber,
        partName,
        brand,
        categoryL1,
        hsnCode,
        gstRate: gstRate || 18.00,
        unitOfSale: unitOfSale || 'Piece',
        description,
        status: 'PENDING',
        source: 'CONTRIBUTED',
      },
    });

    res.json({ success: true, part });
  } catch (err) {
    next(err);
  }
});

export default router;
