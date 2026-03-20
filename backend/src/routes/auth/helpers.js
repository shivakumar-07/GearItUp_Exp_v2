import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import prisma from '../../db/prisma.js';

// ─── Cookie config for refresh tokens ────────────────────────────────────────
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/api/auth',
};

/**
 * Hash a refresh token for safe storage.
 * We store SHA-256(rawToken) so a DB breach can't replay sessions.
 * SHA-256 is appropriate here (unlike passwords) because refresh tokens
 * are already high-entropy random JWTs — bcrypt's slow hash is unnecessary.
 */
export function hashToken(rawToken) {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateTokens(userId, shopId, role) {
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
}

export function formatUserResponse(user) {
  return {
    userId: user.userId,
    phone: user.phone,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    shopId: user.shopId,
    shop: user.shop || null,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    isVerified: user.isVerified || user.emailVerified || user.phoneVerified || false,
    loginCount: user.loginCount || 0,
  };
}

export function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export async function findUserByEmailInsensitive(email, options = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const { include, select } = options;
  const users = await prisma.user.findMany({
    where: {
      email: {
        equals: normalized,
        mode: 'insensitive',
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 2,
    ...(include ? { include } : {}),
    ...(select ? { select } : {}),
  });

  if (users.length > 1) {
    const err = new Error('Multiple accounts found for this email. Please contact support to merge your account.');
    err.status = 409;
    err.code = 'ACCOUNT_CONFLICT';
    throw err;
  }

  return users[0] || null;
}

/**
 * Extract lightweight device fingerprint from the request.
 * Stored in device_info JSONB for session management UI ("Active sessions").
 */
function extractDeviceInfo(req) {
  const ua = req.headers['user-agent'] || '';
  const platform = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /chrome/i.test(ua) ? 'Chrome'
    : /firefox/i.test(ua) ? 'Firefox'
    : /safari/i.test(ua) ? 'Safari'
    : /edge/i.test(ua) ? 'Edge'
    : 'Unknown';
  return { ua: ua.slice(0, 200), platform, browser };
}

/**
 * Create a session: generate tokens, store hashed refresh token in DB,
 * set httpOnly cookie. Returns the JSON payload for the response.
 */
export async function createSession(res, user, { isNewUser = false, req = null } = {}) {
  const { accessToken, refreshToken } = generateTokens(user.userId, user.shopId, user.role);
  const tokenHash = hashToken(refreshToken);

  const deviceInfo = req ? extractDeviceInfo(req) : {};
  const ipAddress = req ? (req.ip || req.connection?.remoteAddress || null) : null;

  // Use raw SQL to write both token_hash and token columns (DB has both due to migration history).
  // Prisma ORM is bypassed here because the generated client may lag behind the actual DB schema.
  const rtId = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.$executeRaw`
    INSERT INTO refresh_tokens (id, user_id, shop_id, token_hash, token, device_info, ip_address, expires_at)
    VALUES (
      ${rtId},
      ${user.userId},
      ${user.shopId || null},
      ${tokenHash},
      ${tokenHash},
      ${JSON.stringify(deviceInfo)}::jsonb,
      ${ipAddress},
      ${expiresAt}
    )
  `;

  // Update last login + increment login counter + set isVerified
  await prisma.user.update({
    where: { userId: user.userId },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
      isVerified: user.emailVerified || user.phoneVerified || false,
    },
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);

  return {
    success: true,
    accessToken,
    refreshToken,
    isNewUser,
    user: formatUserResponse(user),
  };
}

/**
 * Ensure an AuthProvider record exists for the given user + provider combo.
 * Uses upsert to avoid duplicates.
 */
export async function ensureAuthProvider(userId, provider, providerId) {
  if (!providerId) return;

  const existing = await prisma.authProvider.findUnique({
    where: { provider_providerId: { provider, providerId } },
  });

  if (existing && existing.userId !== userId) {
    const err = new Error('This login method is already linked to another account.');
    err.status = 409;
    err.code = 'ACCOUNT_CONFLICT';
    throw err;
  }

  if (!existing) {
    await prisma.authProvider.create({
      data: { userId, provider, providerId },
    });
  }
}
