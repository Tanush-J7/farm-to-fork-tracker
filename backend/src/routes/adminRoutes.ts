import express from 'express';
import { getDashboardStats, getAllUsers, updateUserRole, getBlockchainHealth, getAnalytics, deleteUser } from '../controllers/adminController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/analytics', getAnalytics);
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/blockchain-health', getBlockchainHealth);

export default router;
