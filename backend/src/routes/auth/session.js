import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../db/prisma.js';
import { generateTokens, REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS } from './helpers.js';

const router = Router();

// POST /api/auth/refresh — rotate refresh token (from cookie OR body)
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' },
      });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH', message: 'Invalid or expired refresh token' },
      });
    }

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

    const { accessToken, refreshToken: newRT } = generateTokens(
      user.userId,
      user.shopId,
      user.role
    );

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        token: newRT,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie(REFRESH_COOKIE_NAME, newRT, REFRESH_COOKIE_OPTIONS);

    res.json({
      success: true,
      data: { accessToken, expiresIn: 28800 },
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

    res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
