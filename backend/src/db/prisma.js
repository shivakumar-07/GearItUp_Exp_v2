import { config } from 'dotenv';
config({ override: true }); // ensure Supabase URL wins over system env

import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!process.env.DATABASE_URL && process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

if (!databaseUrl) {
  console.warn('[DB] DATABASE_URL is not set. Prisma will start, but any database query will fail until the env var is configured.');
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Log which DB we're connecting to (first 60 chars, hide password)
const dbUrl = databaseUrl || '';
const safePart = dbUrl.replace(/:([^@]+)@/, ':***@').substring(0, 60);
console.log(`[DB] Connecting to: ${safePart}...`);

export default prisma;
