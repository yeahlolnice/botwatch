import express from 'express';
import {
    checkIp,
    reportIp,
    getCandidates,
    initEnrichmentTable,
} from '../controllers/enrichmentController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Conservative limiter — AbuseIPDB free tier is 1000 checks/day
const enrichLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many enrichment requests' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/candidates', getCandidates);
router.get('/check/:ip', enrichLimiter, checkIp);
router.post('/report', reportIp);
router.post('/init', initEnrichmentTable);

export default router;
