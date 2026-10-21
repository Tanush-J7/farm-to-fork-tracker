import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getRetailerRequests,
  fulfillRequestFromStock,
  sourceFromFarmers,
  getFarmerSourcingOrders,
  getAvailableDistributors,
  assignDistributor
} from '../controllers/processorController';

const router = Router();

// Protect all routes
router.use(protect);

// Processor Demand Desk routes
router.get('/requests', authorize('processor', 'admin'), getRetailerRequests);
router.put('/requests/:id/fulfill', authorize('processor', 'admin'), fulfillRequestFromStock);
router.put('/requests/:id/source-farmers', authorize('processor', 'admin'), sourceFromFarmers);

// Distributor Fleet Intelligence & Assignment
router.get('/distributors', authorize('processor', 'admin'), getAvailableDistributors);
router.post('/assign-distributor', authorize('processor', 'admin'), assignDistributor);

// Farmer-accessible procurement demand orders
router.get('/farmer-sourcing', authorize('farmer', 'processor', 'admin'), getFarmerSourcingOrders);

export default router;
