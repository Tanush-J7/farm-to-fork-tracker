import express from 'express';
import { getDashboardStats, getAllUsers, updateUserRole, getBlockchainHealth, getAnalytics, deleteUser, approveProduct, deleteAdminProduct, clearAllProducts, cleanTestUsers, getUserDetails, getProductDetails } from '../controllers/adminController';
import { getAdminProfileRequests, reviewProfileRequest } from '../controllers/profileController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/analytics', getAnalytics);
router.get('/users', getAllUsers);
router.get('/users/:id/details', getUserDetails);
router.get('/products/:id/details', getProductDetails);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.put('/products/:id/approve', approveProduct);
router.delete('/products/:id', deleteAdminProduct);
router.post('/products/clear-all', clearAllProducts);
router.post('/users/clean-test-users', cleanTestUsers);
router.get('/blockchain-health', getBlockchainHealth);

// Profile verification and approval routes
router.get('/profile-requests', getAdminProfileRequests);
router.put('/profile-requests/:id/review', reviewProfileRequest);

export default router;
