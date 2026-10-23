import { Router } from 'express';
import { 
  registerProduct, 
  getProducts, 
  getMyProducts, 
  getProductByBlockchainId, 
  updateProductStatus, 
  deleteProduct,
  getFarmerState,
  saveFarmerState,
  getProductDeals,
  updateProductDeal
} from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/', protect, getProducts);
router.get('/my', protect, getMyProducts);
router.get('/deals', protect, getProductDeals);
router.get('/deal-status', protect, getProductDeals);
router.put('/deals', protect, updateProductDeal);
router.put('/deal-status', protect, updateProductDeal);
router.get('/farmer-state', protect, getFarmerState);
router.put('/farmer-state', protect, saveFarmerState);
router.get('/blockchain/:id', getProductByBlockchainId);
router.post('/', protect, authorize('farmer', 'admin'), registerProduct);
router.put('/:id/status', protect, updateProductStatus);
router.delete('/:id', protect, authorize('farmer', 'admin'), deleteProduct);

export default router;
