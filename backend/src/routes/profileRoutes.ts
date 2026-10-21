import { Router } from 'express';
import { getMyProfile, requestProfileUpdate, getUserProfile, searchGeocode, reverseGeocode } from '../controllers/profileController';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/my', protect, getMyProfile);
router.post('/request-update', protect, requestProfileUpdate);
router.get('/user/:id', protect, getUserProfile);
router.get('/geocode/search', searchGeocode);
router.get('/geocode/reverse', reverseGeocode);

export default router;
