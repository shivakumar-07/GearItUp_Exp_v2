import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../../db/prisma.js';
import { generateTokens, hashToken, REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS } from './helpers.js';

const router = Router();

// POST /api/auth/refresh — rotate refresh token (from cookie OR body)
router.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' },
      });
    }

    const tokenHash = hashToken(rawToken);

    // Find by hash, not by raw token. Also filter out revoked/expired rows.
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH', message: 'Invalid or expired refresh token' },
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(rawToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      // JWT signature invalid — soft-revoke and reject
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }).catch(() => {});
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
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }).catch(() => {});
      return res.status(401).json({
        success: false,
        error: { code: 'USER_INACTIVE', message: 'Account is inactive' },
      });
    }

    const { accessToken, refreshToken: newRawRT } = generateTokens(
      user.userId,
      user.shopId,
      user.role
    );
    const newTokenHash = hashToken(newRawRT);

    // Token rotation: soft-revoke the old token, create a new one.
    // This way each token can only be used once — replayed tokens are caught.
    const newRtId = randomUUID();
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const newIp = req.ip || stored.ipAddress || null;
    const newDeviceInfo = JSON.stringify(stored.deviceInfo || {});
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
      // Raw SQL to write both token_hash and token columns (DB has both due to migration history)
      prisma.$executeRaw`
        INSERT INTO refresh_tokens (id, user_id, shop_id, token_hash, token, device_info, ip_address, expires_at)
        VALUES (
          ${newRtId},
          ${user.userId},
          ${user.shopId || null},
          ${newTokenHash},
          ${newTokenHash},
          ${newDeviceInfo}::jsonb,
          ${newIp},
          ${newExpiresAt}
        )
      `,
    ]);

    res.cookie(REFRESH_COOKIE_NAME, newRawRT, REFRESH_COOKIE_OPTIONS);

    res.json({
      success: true,
      data: { accessToken, expiresIn: 28800 },
      accessToken,
      refreshToken: newRawRT,
      user: {
        userId: user.userId,
        role: user.role,
        shopId: user.shopId,
        name: user.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — soft-revoke refresh token
router.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      // Soft-revoke: set revokedAt so we keep an audit trail
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }).catch(() => {});
    }

    res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
