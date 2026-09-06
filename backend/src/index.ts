import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './config/supabase';
import productRoutes from './routes/productRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import shipmentRoutes from './routes/shipmentRoutes';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const configuredCorsOrigins = process.env.CORS_ORIGIN?.trim();
const corsOrigin = !configuredCorsOrigins || configuredCorsOrigins === '*'
  ? '*'
  : configuredCorsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '8mb' }));

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
    }
  });

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shipments', shipmentRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
