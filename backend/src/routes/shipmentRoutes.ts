import express from 'express';
import { createShipment, getShipments, updateShipmentStatus, logTelemetry, getAvailableBatches } from '../controllers/shipmentController';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();

router.use(protect); // Require authentication for all routes

// Distributor specific routes
router.get('/', restrictTo('distributor', 'admin'), getShipments);
router.get('/available-batches', restrictTo('distributor', 'admin'), getAvailableBatches);
router.post('/', restrictTo('distributor', 'admin'), createShipment);
router.put('/:id/status', restrictTo('distributor', 'admin'), updateShipmentStatus);
router.post('/:id/telemetry', restrictTo('distributor', 'admin'), logTelemetry);

import { getOptimalRoute } from '../controllers/routeOptimizer';

router.post('/route', restrictTo('distributor', 'admin'), getOptimalRoute);

export default router;
