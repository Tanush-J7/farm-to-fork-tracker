import { Router } from 'express';
import { register, login, updateUserStatus, getDistributors } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.put('/status', protect, updateUserStatus);
router.get('/distributors', protect, getDistributors);

export default router;
