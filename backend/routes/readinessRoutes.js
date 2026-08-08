import express from 'express';
import { scanReadiness } from '../controllers/readinessController.js';
import { scanLimiter } from '../middleware/rateLimiter.js';

// Public AI-readiness checker (free teaser). Mounted at /api/readiness before
// the JWT gate — anyone can scan a URL.
const router = express.Router();

router.post('/scan', scanLimiter, scanReadiness);

export default router;
