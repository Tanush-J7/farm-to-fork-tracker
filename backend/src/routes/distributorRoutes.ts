import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getDistributorDeliveryRequests,
  respondToDeliveryRequest,
  verifyPickupQR,
  confirmPickupAndTakeCustody,
  generateDeliveryQR
} from '../controllers/distributorController';

const router = Router();

router.use(protect);

// Distributor Delivery Requests from Processors
router.get('/delivery-requests', authorize('distributor', 'admin'), getDistributorDeliveryRequests);
router.put('/delivery-requests/:id/respond', authorize('distributor', 'admin'), respondToDeliveryRequest);

// Pickup Verification & Custody Transfer (Scanning Processor's QR)
router.post('/verify-pickup-qr', authorize('distributor', 'admin'), verifyPickupQR);
router.post('/confirm-pickup', authorize('distributor', 'admin'), confirmPickupAndTakeCustody);

// Arrival at Store & Delivery QR Generation for Retailer
router.post('/delivery-requests/:id/generate-delivery-qr', authorize('distributor', 'admin'), generateDeliveryQR);

export default router;
