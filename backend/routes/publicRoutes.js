import express from 'express';
import {
    getPublicStats,
    getPublicRecentTraps,
    getPublicIntel,
    getPublicLeaderboard,
    getPublicSitemap,
    getAiReadiness,
    getSiteProfile,
    getPublicThreatCharts,
    getPublicBlocklist,
} from '../controllers/publicController.js';
import { trafficLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(trafficLimiter);

router.get('/stats', getPublicStats);
router.get('/recent', getPublicRecentTraps);
router.get('/intel', getPublicIntel);
router.get('/threat-charts', getPublicThreatCharts);
router.get('/leaderboard', getPublicLeaderboard);
router.get('/ai-readiness', getAiReadiness);
router.get('/blocklist', getPublicBlocklist);
router.get('/site/:hostname', getSiteProfile);
router.get('/sitemap.xml', getPublicSitemap);

export default router;
