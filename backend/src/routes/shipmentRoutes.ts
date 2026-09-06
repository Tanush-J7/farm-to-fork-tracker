import express from 'express';
import { createShipment, getShipments, updateShipmentStatus, logTelemetry, getAvailableBatches } from '../controllers/shipmentController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect); // Require authentication for all routes

// Distributor specific routes
router.get('/', authorize('distributor', 'admin'), getShipments);
router.get('/available-batches', authorize('distributor', 'admin'), getAvailableBatches);
router.post('/', authorize('distributor', 'admin'), createShipment);
router.put('/:id/status', authorize('distributor', 'admin'), updateShipmentStatus);
router.post('/:id/telemetry', authorize('distributor', 'admin'), logTelemetry);

import { getOptimalRoute } from '../controllers/routeOptimizer';

router.post('/route', authorize('distributor', 'admin'), getOptimalRoute);

export default router;
