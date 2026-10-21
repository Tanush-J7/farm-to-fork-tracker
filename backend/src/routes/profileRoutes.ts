import { Router } from 'express';
import { getMyProfile, requestProfileUpdate, getUserProfile } from '../controllers/profileController';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/my', protect, getMyProfile);
router.post('/request-update', protect, requestProfileUpdate);
router.get('/user/:id', protect, getUserProfile);

export default router;
