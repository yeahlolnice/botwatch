import express from 'express';
import {
    getPublicStats,
    getPublicRecentTraps,
    getPublicIntel,
    getPublicLeaderboard,
} from '../controllers/publicController.js';
import { trafficLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(trafficLimiter);

router.get('/stats', getPublicStats);
router.get('/recent', getPublicRecentTraps);
router.get('/intel', getPublicIntel);
router.get('/leaderboard', getPublicLeaderboard);

export default router;
