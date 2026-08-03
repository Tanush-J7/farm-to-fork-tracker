import { Router } from 'express';
import { registerProduct, getProducts, getMyProducts, getProductByBlockchainId } from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/', protect, getProducts);
router.get('/blockchain/:id', getProductByBlockchainId);
router.get('/my', protect, authorize('farmer', 'admin'), getMyProducts);
router.post('/', protect, authorize('farmer', 'admin'), registerProduct);

export default router;
