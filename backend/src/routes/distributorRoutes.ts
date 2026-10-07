import { Router } from 'express';
import { 
  getIncomingShipments, 
  receiveShipment, 
  getDistributorBatches, 
  createShipment 
} from '../controllers/distributorController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

// Protect all routes
router.use(protect);
router.use(authorize('distributor', 'admin'));

router.get('/shipments/incoming', getIncomingShipments);
router.post('/shipments/:id/receive', receiveShipment);
router.get('/batches', getDistributorBatches);
router.post('/shipments', createShipment);

export default router;
