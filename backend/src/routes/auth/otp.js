import { Router } from 'express';
import prisma from '../../db/prisma.js';
import { sendOtp, verifyOtp } from '../../services/otp.js';
import { otpSendLimiter } from '../../middleware/rateLimiter.js';
import { createSession, ensureAuthProvider } from './helpers.js';

const router = Router();

// ─── In-memory OTP failure tracking (resets on server restart) ──────────────
const otpFailures = new Map();
const OTP_MAX_FAILURES = 5;
const OTP_LOCK_MS = 15 * 60 * 1000; // 15 minutes

function recordOtpFailure(phone) {
  const rec = otpFailures.get(phone) || { count: 0, lockedUntil: null };
  rec.count += 1;
  if (rec.count >= OTP_MAX_FAILURES) {
    rec.lockedUntil = new Date(Date.now() + OTP_LOCK_MS);
  }
  otpFailures.set(phone, rec);
}

function isOtpLocked(phone) {
  const rec = otpFailures.get(phone);
  if (!rec?.lockedUntil) return false;
  if (rec.lockedUntil > new Date()) return true;
  otpFailures.delete(phone);
  return false;
}

function clearOtpFailures(phone) {
  otpFailures.delete(phone);
}

// POST /api/auth/request-otp
router.post('/request-otp', otpSendLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHONE', message: 'A valid 10-digit phone number is required' },
      });
    }

    if (isOtpLocked(phone)) {
      return res.status(429).json({
        success: false,
        error: { code: 'OTP_LOCKED', message: 'Too many failed attempts. Please wait 15 minutes before trying again.' },
      });
    }

    await sendOtp(phone);
    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, otp, role } = req.body;
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHONE', message: 'A valid 10-digit phone number is required' },
      });
    }
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'OTP must be 6 digits' },
      });
    }

    if (isOtpLocked(phone)) {
      return res.status(429).json({
        success: false,
        error: { code: 'OTP_LOCKED', message: 'Too many failed attempts. Please wait 15 minutes.' },
      });
    }

    const { valid } = await verifyOtp(phone, otp);
    if (!valid) {
      recordOtpFailure(phone);
      const rec = otpFailures.get(phone);
      const remaining = OTP_MAX_FAILURES - (rec?.count || 0);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: remaining > 0
            ? `Invalid or expired OTP. ${remaining} attempt(s) remaining.`
            : 'Account locked due to too many failed attempts. Try again in 15 minutes.',
        },
      });
    }

    clearOtpFailures(phone);

    // Upsert user by phone
    let isNewUser = false;
    let user = await prisma.user.findUnique({ where: { phone }, include: { shop: true } });
    if (!user) {
      const initialRole = role === 'shop' ? 'SHOP_OWNER' : 'CUSTOMER';
      user = await prisma.user.create({
        data: { phone, role: initialRole, phoneVerified: true },
        include: { shop: true },
      });
      isNewUser = true;
    } else if (!user.phoneVerified) {
      user = await prisma.user.update({
        where: { userId: user.userId },
        data: { phoneVerified: true },
        include: { shop: true },
      });
    }

    // Ensure PHONE provider is linked
    await ensureAuthProvider(user.userId, 'PHONE', phone);

    const payload = await createSession(res, user, { isNewUser });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
