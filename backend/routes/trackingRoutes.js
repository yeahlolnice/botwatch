import express from 'express';
import { getRecentRequests, getTrafficStats, createTrackingTable } from '../controllers/trackingControllers.js';

const router = express.Router();

router.get('/', getRecentRequests);
router.get('/stats', getTrafficStats);
router.get('/db-init', createTrackingTable);

export default router;
