import { Router } from 'express';
import { 
  registerProduct, 
  getProducts, 
  getMyProducts, 
  getProductByBlockchainId, 
  updateProductStatus, 
  deleteProduct,
  getFarmerState,
  saveFarmerState
} from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/', protect, getProducts);
router.get('/my', protect, getMyProducts);
router.get('/farmer-state', protect, getFarmerState);
router.put('/farmer-state', protect, saveFarmerState);
router.get('/blockchain/:id', getProductByBlockchainId);
router.post('/', protect, authorize('farmer', 'admin'), registerProduct);
router.put('/:id/status', protect, updateProductStatus);
router.delete('/:id', protect, authorize('farmer', 'admin'), deleteProduct);

export default router;
