// Load .env FIRST, overriding any system env vars (fixes Neon vs Supabase conflict)
import { config } from 'dotenv';
config({ override: true });
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth/index.js';
import catalogRoutes from './routes/catalog.js';
import inventoryRoutes from './routes/inventory.js';
import billingRoutes from './routes/billing.js';
import partiesRoutes from './routes/parties.js';
import dashboardRoutes from './routes/dashboard.js';
import marketplaceRoutes from './routes/marketplace.js';
import customerRoutes from './routes/customer.js';
import staffRoutes from './routes/staff.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authLimiter } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (
  process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']
);

function createOriginRule(pattern) {
  if (!pattern.includes('*')) {
    return { exact: pattern };
  }

  const regexSource = `^${pattern
    .split('*')
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')}$`;

  return { wildcard: new RegExp(regexSource) };
}

const allowedOriginRules = allowedOrigins.map(createOriginRule);

function isAllowedOrigin(origin) {
  return allowedOriginRules.some((rule) => {
    if (rule.exact) return origin === rule.exact;
    return rule.wildcard.test(origin);
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients and same-origin requests without an Origin header.
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());


// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/shop/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/shop/parties', partiesRoutes);
app.use('/api/shop/dashboard', dashboardRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/shop/staff', staffRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`AutoSpace backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
