import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { getProcessorRequests, claimProcessorRequest, getProcessorBatches } from '../controllers/processorController';

const router = express.Router();

// Require authentication and processor role for all routes in this file
router.use(protect);
router.use(authorize('processor'));

router.get('/requests', getProcessorRequests);
router.post('/requests/:id/claim', claimProcessorRequest);
router.get('/batches', getProcessorBatches);

export default router;
