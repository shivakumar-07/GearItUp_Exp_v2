import jwt from 'jsonwebtoken';
import prisma from '../db/prisma.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { userId: decoded.userId },
      include: { shop: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;
    req.shopId = user.shopId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireShopOwner = (req, res, next) => {
  if (!['SHOP_OWNER', 'PLATFORM_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Shop owner access required' });
  }
  if (req.user.role === 'SHOP_OWNER' && !req.user.shopId) {
    return res.status(403).json({ error: 'No shop associated with this account' });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
