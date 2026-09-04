import { Router } from 'express';
import { registerProduct, getProducts, getMyProducts, getProductByBlockchainId, updateProductStatus, deleteProduct } from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/', protect, getProducts);
router.get('/blockchain/:id', getProductByBlockchainId);
router.get('/my', protect, authorize('farmer', 'admin'), getMyProducts);
router.post('/', protect, authorize('farmer', 'admin'), registerProduct);
router.put('/:id/status', protect, updateProductStatus);
router.delete('/:id', protect, authorize('farmer', 'admin'), deleteProduct);

export default router;
