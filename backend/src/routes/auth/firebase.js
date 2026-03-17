import { Router } from 'express';
import prisma from '../../db/prisma.js';
import { verifyFirebaseToken } from '../../services/firebase.js';
import { createSession, ensureAuthProvider, findUserByEmailInsensitive, normalizeEmail } from './helpers.js';

const router = Router();

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
    const emailNormalized = normalizeEmail(email);

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
      if (!user && emailNormalized) {
        user = await findUserByEmailInsensitive(emailNormalized, { include: { shop: true } });
      }

      if (!user) {
        const phoneClean2 = phone_number
          ? phone_number.replace(/^\+91/, '').replace(/^\+/, '')
          : null;
        const initialRole = role === 'shop' ? 'SHOP_OWNER' : 'CUSTOMER';
        user = await prisma.user.create({
          data: {
            firebaseUid: uid,
            phone: phoneClean2,
            email: emailNormalized,
            name,
            avatarUrl: picture,
            role: initialRole,
            phoneVerified: !!phoneClean2,
            emailVerified: !!emailNormalized,
          },
          include: { shop: true },
        });
        isNewUser = true;
      } else {
        user = await prisma.user.update({
          where: { userId: user.userId },
          data: {
            firebaseUid: uid,
            email: user.email || emailNormalized || undefined,
            emailVerified: user.emailVerified || !!emailNormalized,
            name: name || user.name,
            avatarUrl: picture || user.avatarUrl,
          },
          include: { shop: true },
        });
      }
    } else {
      const updateData = {};
      const canonicalEmail = normalizeEmail(user.email || emailNormalized);

      if (canonicalEmail && canonicalEmail !== user.email) {
        updateData.email = canonicalEmail;
      }
      if (canonicalEmail && !user.emailVerified) {
        updateData.emailVerified = true;
      }
      if (name && name !== user.name) {
        updateData.name = name;
      }
      if (picture && picture !== user.avatarUrl) {
        updateData.avatarUrl = picture;
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { userId: user.userId },
          data: updateData,
          include: { shop: true },
        });
      }
    }

    // Ensure GOOGLE provider is linked
    await ensureAuthProvider(user.userId, 'GOOGLE', uid);

    // Also link PHONE provider if phone came from Firebase
    if (user.phone) {
      await ensureAuthProvider(user.userId, 'PHONE', user.phone);
    }

    if (user.email) {
      await ensureAuthProvider(user.userId, 'EMAIL', normalizeEmail(user.email));
    }

    const payload = await createSession(res, user, { isNewUser });

    // BACKWARDS COMPAT: include data wrapper for existing frontend
    res.json({
      ...payload,
      data: {
        accessToken: payload.accessToken,
        expiresIn: 28800,
        isNewUser,
        user: payload.user,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
