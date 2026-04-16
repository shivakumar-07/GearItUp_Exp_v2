import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, requireShopOwner } from '../middleware/auth.js';
import { generateInvoicePdf } from '../services/pdf.js';
import { sendInvoiceWhatsApp } from '../services/whatsapp.js';

const router = Router();

const MAX_INVOICE_NUMBER_RETRIES = 5;
const SUPPORTED_PAYMENT_MODES = new Set(['CASH', 'UPI', 'CREDIT', 'SPLIT']);

function toPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function toNullableAmount(value) {
  return value > 0 ? value : null;
}

function normalizeInvoicePayment({ paymentMode, cashAmount, upiAmount, creditAmount, totalAmount }) {
  const mode = String(paymentMode || '').trim().toUpperCase();
  const modeAlias = {
    UDHAAR: 'CREDIT',
    CARD: 'UPI',
  };

  let normalizedMode = modeAlias[mode] || mode || 'CASH';
  if (!SUPPORTED_PAYMENT_MODES.has(normalizedMode)) normalizedMode = 'CASH';

  let normalizedCash = toPositiveNumber(cashAmount);
  let normalizedUpi = toPositiveNumber(upiAmount);
  let normalizedCredit = toPositiveNumber(creditAmount);
  const normalizedTotal = toPositiveNumber(totalAmount);
  const activeTenderCount = [normalizedCash, normalizedUpi, normalizedCredit].filter((amount) => amount > 0).length;

  if (activeTenderCount > 1) {
    normalizedMode = 'SPLIT';
  } else if (activeTenderCount === 1) {
    if (normalizedCredit > 0) normalizedMode = 'CREDIT';
    else if (normalizedUpi > 0) normalizedMode = 'UPI';
    else normalizedMode = 'CASH';
  }

  if (activeTenderCount === 0 && normalizedTotal > 0) {
    if (normalizedMode === 'UPI') normalizedUpi = normalizedTotal;
    else if (normalizedMode === 'CREDIT') normalizedCredit = normalizedTotal;
    else {
      normalizedCash = normalizedTotal;
      normalizedMode = 'CASH';
    }
  }

  return {
    paymentMode: normalizedMode,
    cashAmount: toNullableAmount(normalizedCash),
    upiAmount: toNullableAmount(normalizedUpi),
    creditAmount: toNullableAmount(normalizedCredit),
    status: normalizedCredit > 0 ? 'CREDIT' : 'PAID',
  };
}

function isInvoiceNumberConflict(err) {
  return err?.code === 'P2002' && typeof err?.message === 'string' && err.message.includes('invoice_number');
}

// Generate invoice number: YYYYMM-XXXX
async function generateInvoiceNumber() {
  const now = new Date();
  const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
  });
  let seq = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
    seq = lastSeq + 1;
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// POST /api/billing/invoice
router.post('/invoice', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { items, partyId, partyName, partyPhone, partyGstin, paymentMode, cashAmount, upiAmount, creditAmount, notes } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in invoice' });

    // Validate stock and calculate totals
    let subtotal = 0, cgst = 0, sgst = 0;
    const processedItems = [];

    for (const item of items) {
      const inv = await prisma.shopInventory.findUnique({
        where: { inventoryId: item.inventoryId },
        include: { masterPart: true },
      });
      if (!inv || inv.shopId !== req.shopId) throw { status: 400, message: `Invalid inventory item: ${item.inventoryId}` };

      const currentStock = inv.stockQty; // use cached for speed
      if (currentStock < item.qty) throw { status: 400, message: `Insufficient stock for ${inv.masterPart.partName}: have ${currentStock}, need ${item.qty}` };

      const unitPrice = parseFloat(item.unitPrice || inv.sellingPrice);
      const discount = parseFloat(item.discount || 0);
      const taxableAmt = (unitPrice - discount) * item.qty;
      const gstRate = parseFloat(inv.masterPart.gstRate || 18);
      const itemCgst = taxableAmt * (gstRate / 2 / 100);
      const itemSgst = itemCgst;
      const itemTotal = taxableAmt + itemCgst + itemSgst;

      subtotal += taxableAmt;
      cgst += itemCgst;
      sgst += itemSgst;

      processedItems.push({
        inventoryId: item.inventoryId,
        partName: inv.masterPart.partName,
        hsnCode: inv.masterPart.hsnCode,
        qty: item.qty,
        unitPrice,
        discount,
        taxableAmt,
        gstRate,
        cgst: itemCgst,
        sgst: itemSgst,
        total: itemTotal,
        buyingPrice: parseFloat(inv.buyingPrice || 0),
      });
    }

    const totalAmount = subtotal + cgst + sgst;
    const normalizedPayment = normalizeInvoicePayment({
      paymentMode,
      cashAmount,
      upiAmount,
      creditAmount,
      totalAmount,
    });

    let invoice = null;

    for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_RETRIES; attempt += 1) {
      const invoiceNumber = await generateInvoiceNumber();

      try {
        // Create invoice + movements in a transaction
        invoice = await prisma.$transaction(async (tx) => {
          const inv = await tx.invoice.create({
            data: {
              invoiceNumber,
              shopId: req.shopId,
              partyId,
              partyName,
              partyPhone,
              partyGstin,
              subtotal,
              taxableAmount: subtotal,
              cgst,
              sgst,
              totalAmount,
              paymentMode: normalizedPayment.paymentMode,
              cashAmount: normalizedPayment.cashAmount,
              upiAmount: normalizedPayment.upiAmount,
              creditAmount: normalizedPayment.creditAmount,
              status: normalizedPayment.status,
              notes,
              items: {
                create: processedItems.map(item => ({
                  inventoryId: item.inventoryId,
                  partName: item.partName,
                  hsnCode: item.hsnCode,
                  qty: item.qty,
                  unitPrice: item.unitPrice,
                  discount: item.discount,
                  taxableAmt: item.taxableAmt,
                  gstRate: item.gstRate,
                  cgst: item.cgst,
                  sgst: item.sgst,
                  total: item.total,
                })),
              },
            },
            include: { items: true, shop: true },
          });

          // Create sale movements and update stock for each item
          for (const item of processedItems) {
            const profit = item.taxableAmt - (item.buyingPrice * item.qty);
            await tx.movement.create({
              data: {
                shopId: req.shopId,
                inventoryId: item.inventoryId,
                type: 'SALE',
                qty: item.qty,
                unitPrice: item.unitPrice,
                totalAmount: item.total,
                gstAmount: item.cgst + item.sgst,
                profit,
                invoiceId: inv.invoiceId,
                partyId,
              },
            });
            await tx.shopInventory.update({
              where: { inventoryId: item.inventoryId },
              data: { stockQty: { decrement: item.qty } },
            });
          }

          if (partyId && normalizedPayment.creditAmount) {
            await tx.party.update({
              where: { partyId },
              data: { outstanding: { increment: normalizedPayment.creditAmount } },
            });
          }

          return inv;
        });

        break;
      } catch (txnErr) {
        if (isInvoiceNumberConflict(txnErr) && attempt < MAX_INVOICE_NUMBER_RETRIES - 1) {
          continue;
        }
        throw txnErr;
      }
    }

    if (!invoice) {
      throw new Error('Unable to generate a unique invoice number');
    }

    res.json({ success: true, invoice });
  } catch (err) {
    next(err);
  }
});

// GET /api/billing/invoice/:id/pdf
router.get('/invoice/:id/pdf', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: req.params.id },
      include: { items: true, shop: true },
    });
    if (!invoice || invoice.shopId !== req.shopId) return res.status(404).json({ error: 'Invoice not found' });

    const pdfBuffer = await generateInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/billing/invoice/:id/send-whatsapp
router.post('/invoice/:id/send-whatsapp', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: req.params.id },
      include: { items: true, shop: true },
    });
    if (!invoice || invoice.shopId !== req.shopId) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.partyPhone) return res.status(400).json({ error: 'No phone number for this customer' });

    const pdfUrl = invoice.pdfUrl || `${process.env.FRONTEND_URL}/api/billing/invoice/${invoice.invoiceId}/pdf`;
    const result = await sendInvoiceWhatsApp(invoice.partyPhone, invoice.partyName, invoice.invoiceNumber, invoice.totalAmount, pdfUrl);

    res.json({ success: result.success });
  } catch (err) {
    next(err);
  }
});

// GET /api/billing/invoices
router.get('/invoices', authenticate, requireShopOwner, async (req, res, next) => {
  try {
    const { startDate, endDate, partyId, paymentMode, limit = 50, offset = 0 } = req.query;
    const where = { shopId: req.shopId };
    if (startDate) where.createdAt = { gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    if (partyId) where.partyId = partyId;
    if (paymentMode) where.paymentMode = paymentMode;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { items: { include: { inventory: { include: { masterPart: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ invoices, total });
  } catch (err) {
    next(err);
  }
});

export default router;
