import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getRetailerRequests,
  fulfillRequestFromStock,
  sourceFromFarmers,
  getFarmerSourcingOrders,
  farmerFulfillSourcingOrder,
  farmerDeclineSourcingOrder,
  getAvailableDistributors,
  assignDistributor,
  sendDeliveryRequest,
  getProcessorDeliveryRequests,
  generatePickupQR,
  confirmProcessorDispatch,
  getProcessorState,
  saveProcessorState,
  notifyFarmerIntake,
  adjustInventoryQuantity
} from '../controllers/processorController';

const router = Router();

// Protect all routes
router.use(protect);

// Cloud-synced processor state across mobile & desktop devices
router.get('/state', authorize('processor', 'admin'), getProcessorState);
router.put('/state', authorize('processor', 'admin'), saveProcessorState);
router.post('/notify-farmer', authorize('processor', 'admin'), notifyFarmerIntake);

// Processor Demand Desk & Inventory routes
router.get('/requests', authorize('processor', 'admin'), getRetailerRequests);
router.put('/requests/:id/fulfill', authorize('processor', 'admin'), fulfillRequestFromStock);
router.put('/requests/:id/source-farmers', authorize('processor', 'admin'), sourceFromFarmers);
router.put('/inventory/:id/adjust', authorize('processor', 'admin'), adjustInventoryQuantity);

// Distributor Fleet Intelligence, Requests & Assignment
router.get('/distributors', authorize('processor', 'admin'), getAvailableDistributors);
router.post('/assign-distributor', authorize('processor', 'admin'), assignDistributor);
router.post('/request-delivery', authorize('processor', 'admin'), sendDeliveryRequest);
router.get('/delivery-requests', authorize('processor', 'admin'), getProcessorDeliveryRequests);
router.post('/delivery-requests/:id/generate-pickup-qr', authorize('processor', 'admin'), generatePickupQR);
router.post('/delivery-requests/:id/confirm-dispatch', authorize('processor', 'admin'), confirmProcessorDispatch);

// Farmer-accessible procurement demand orders
router.get('/farmer-sourcing', authorize('farmer', 'processor', 'admin'), getFarmerSourcingOrders);
router.put('/farmer-sourcing/:id/fulfill', authorize('farmer', 'processor', 'admin'), farmerFulfillSourcingOrder);
router.put('/farmer-sourcing/:id/decline', authorize('farmer', 'processor', 'admin'), farmerDeclineSourcingOrder);

export default router;
