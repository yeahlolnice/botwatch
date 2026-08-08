import express from 'express';
import { scanReadiness, createReportCheckout, getReport } from '../controllers/readinessController.js';
import { scanLimiter } from '../middleware/rateLimiter.js';

// Public AI-readiness checker (free teaser) + paid report checkout. Mounted at
// /api/readiness before the JWT gate — anyone can scan a URL or buy a report.
const router = express.Router();

router.post('/scan', scanLimiter, scanReadiness);
router.post('/report/checkout', scanLimiter, createReportCheckout);
router.get('/report/:token', getReport);

export default router;
