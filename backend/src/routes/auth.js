import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma.js';
import { verifyFirebaseToken } from '../services/firebase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ─── Cookie config for refresh tokens ───
const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,         // JS cannot read it (XSS protection)
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'lax',        // CSRF protection (lax allows top-level nav)
  maxAge: 30 * 24 * 60 * 60 * 1000,              // 30 days
  path: '/api/auth',      // Only sent to auth endpoints
};

const generateTokens = (userId, shopId, role) => {
  const accessToken = jwt.sign(
    { userId, shopId: shopId || null, role: role || 'CUSTOMER' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return { accessToken, refreshToken };
};

// POST /api/auth/firebase — verify Firebase token, return our JWT
router.post('/firebase', async (req, res, next) => {
  try {
    const { firebaseToken, role } = req.body;
    if (!firebaseToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'firebaseToken is required' },
      });
    }

    const decoded = await verifyFirebaseToken(firebaseToken);
    const { uid, phone_number, email, name, picture } = decoded;

    let isNewUser = false;
    let user = await prisma.user.findUnique({
      where: { firebaseUid: uid },
      include: { shop: true },
    });

    if (!user) {
      const phoneClean = phone_number
        ? phone_number.replace(/^\+91/, '').replace(/^\+/, '')
        : null;

      if (phoneClean) {
        user = await prisma.user
          .findUnique({ where: { phone: phoneClean }, include: { shop: true } })
          .catch(() => null);
      }
      if (!user && email) {
        user = await prisma.user
          .findUnique({ where: { email }, include: { shop: true } })
          .catch(() => null);
      }

      if (!user) {
        // Brand-new user — create with role hint from frontend
        const phoneClean2 = phone_number
          ? phone_number.replace(/^\+91/, '').replace(/^\+/, '')
          : null;
        const initialRole = role === 'shop' ? 'SHOP_OWNER' : 'CUSTOMER';
        user = await prisma.user.create({
          data: {
            firebaseUid: uid,
            phone: phoneClean2,
            email,
            name,
            avatarUrl: picture,
            role: initialRole,
          },
          include: { shop: true },
        });
        isNewUser = true;
      } else {
        // Existing user found by phone/email — link Firebase UID
        user = await prisma.user.update({
          where: { userId: user.userId },
          data: {
            firebaseUid: uid,
            name: name || user.name,
            avatarUrl: picture || user.avatarUrl,
          },
          include: { shop: true },
        });
      }
    } else {
      // Existing user found by firebaseUid — update avatar if Google provides one
      if (picture && picture !== user.avatarUrl) {
        user = await prisma.user.update({
          where: { userId: user.userId },
          data: { avatarUrl: picture },
          include: { shop: true },
        });
      }
    }

    await prisma.user.update({
      where: { userId: user.userId },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(
      user.userId,
      user.shopId,
      user.role
    );

    // Store refresh token in DB
    await prisma.refreshToken.create({
      data: {
        userId: user.userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Set refresh token as httpOnly cookie
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

    // Return access token + user data (NO refresh token in body)
    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: 28800, // 8 hours in seconds
        isNewUser,
        user: {
          userId: user.userId,
          phone: user.phone,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          shopId: user.shopId,
          shop: user.shop,
        },
      },
      // BACKWARDS COMPAT: keep these at root for existing frontend
      accessToken,
      refreshToken,
      isNewUser,
      user: {
        userId: user.userId,
        phone: user.phone,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        shopId: user.shopId,
        shop: user.shop,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh — rotate refresh token (from cookie OR body)
router.post('/refresh', async (req, res, next) => {
  try {
    // Read from httpOnly cookie first, fall back to body
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' },
      });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      // Clear the stale cookie
      res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH', message: 'Invalid or expired refresh token' },
      });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH', message: 'Refresh token signature invalid' },
      });
    }

    // Get user for fresh role/shopId
    const user = await prisma.user.findUnique({
      where: { userId: decoded.userId },
      include: { shop: true },
    });
    if (!user || !user.isActive) {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return res.status(401).json({
        success: false,
        error: { code: 'USER_INACTIVE', message: 'Account is inactive' },
      });
    }

    // Token rotation — issue new tokens, revoke old one
    const { accessToken, refreshToken: newRT } = generateTokens(
      user.userId,
      user.shopId,
      user.role
    );

    // Rotate: delete old, create new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        token: newRT,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Set new cookie
    res.cookie(REFRESH_COOKIE_NAME, newRT, REFRESH_COOKIE_OPTIONS);

    res.json({
      success: true,
      data: { accessToken, expiresIn: 28800 },
      // BACKWARDS COMPAT
      accessToken,
      refreshToken: newRT,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — revoke refresh token
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
    }

    // Clear the cookie
    res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register-shop
router.post('/register-shop', authenticate, async (req, res, next) => {
  try {
    const { name, ownerName, gstin, address, city, pincode, latitude, longitude } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_SHOP_NAME', message: 'Shop name is required' },
      });
    }
    if (req.user.shopId) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_HAS_SHOP', message: 'User already has a shop' },
      });
    }

    const shop = await prisma.shop.create({
      data: {
        name,
        ownerName: ownerName || req.user.name,
        phone: req.user.phone || 'tbd',
        gstin,
        address,
        city,
        pincode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    await prisma.user.update({
      where: { userId: req.user.userId },
      data: {
        shopId: shop.shopId,
        role: 'SHOP_OWNER',
        name: ownerName || req.user.name,
      },
    });

    res.json({ success: true, shop });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — get profile
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.user.userId,
      phone: req.user.phone,
      email: req.user.email,
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
      role: req.user.role,
      shopId: req.user.shopId,
      shop: req.user.shop,
    },
  });
});

// PATCH /api/auth/me — update profile
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_NAME', message: 'Name is required (2-100 characters)' },
      });
    }
    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_NAME', message: 'Name must be between 2 and 100 characters' },
      });
    }

    const updated = await prisma.user.update({
      where: { userId: req.user.userId },
      data: { name: name.trim() },
      include: { shop: true },
    });

    res.json({
      success: true,
      data: {
        userId: updated.userId,
        phone: updated.phone,
        email: updated.email,
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        shopId: updated.shopId,
        shop: updated.shop,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
