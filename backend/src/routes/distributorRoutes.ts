import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getDistributorDeliveryRequests,
  respondToDeliveryRequest
} from '../controllers/distributorController';

const router = Router();

router.use(protect);

// Distributor Delivery Requests from Processors
router.get('/delivery-requests', authorize('distributor', 'admin'), getDistributorDeliveryRequests);
router.put('/delivery-requests/:id/respond', authorize('distributor', 'admin'), respondToDeliveryRequest);

export default router;
