import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config();

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findFirst({
    where: {
      role: 'SHOP_OWNER',
      shopId: { not: null },
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!user) {
    throw new Error('No active SHOP_OWNER with shopId found');
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in backend env');
  }

  const token = jwt.sign(
    { userId: user.userId, shopId: user.shopId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );

  process.stdout.write(JSON.stringify({ token, userId: user.userId, shopId: user.shopId, role: user.role }));
} finally {
  await prisma.$disconnect();
}
