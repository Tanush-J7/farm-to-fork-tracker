import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './config/supabase';
import { generalLimiter } from './middleware/rateLimit';
import productRoutes from './routes/productRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import retailerRoutes from './routes/retailerRoutes';
import farmerRoutes from './routes/farmerRoutes';
import notificationRoutes from './routes/notificationRoutes';
import processorRoutes from './routes/processorRoutes';
import distributorRoutes from './routes/distributorRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import anomalyRoutes from './routes/anomalyRoutes';
import aiRoutes from './routes/aiRoutes';
import decisionRoutes from './routes/decisionRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const configuredCorsOrigins = process.env.CORS_ORIGIN?.trim();
const corsOrigin = !configuredCorsOrigins || configuredCorsOrigins === '*'
  ? '*'
  : configuredCorsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '8mb' }));

// Minimal Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

let isReady = false;

// Verify Supabase connectivity on boot (throwing early is more useful than
// discovering a bad URL/key on the first request)
supabase
  .from('users')
  .select('id', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) {
      console.error('Supabase connection error:', error.message);
    } else {
      console.log('Supabase connected');
      isReady = true;
    }
  });

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', (req, res) => {
  if (isReady) {
    res.status(200).json({ status: 'ready', dependencies: { supabase: 'healthy' } });
  } else {
    res.status(503).json({ status: 'unavailable', dependencies: { supabase: 'unavailable' } });
  }
});

app.use('/api/', generalLimiter);

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/retailer', retailerRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/processor', processorRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics', anomalyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/decisions', decisionRoutes);

const server = app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully');
  server.close(() => {
    console.log('Closed out remaining connections');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
