import jwt from 'jsonwebtoken';
import prisma from '../../db/prisma.js';

// ─── Cookie config for refresh tokens ───
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/api/auth',
};

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
 * Create a session: generate tokens, store refresh token in DB, set cookie.
 * Returns the response payload (caller should res.json it).
 */
export async function createSession(res, user, { isNewUser = false } = {}) {
  const { accessToken, refreshToken } = generateTokens(user.userId, user.shopId, user.role);

  await prisma.refreshToken.create({
    data: {
      userId: user.userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.user.update({
    where: { userId: user.userId },
    data: { lastLoginAt: new Date() },
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
