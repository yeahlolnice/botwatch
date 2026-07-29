import express from 'express';
import { apiKeyAuth, apiKeyRateLimit } from '../middleware/apiKeyAuth.js';
import { apiStatus } from '../controllers/apiKeyController.js';

// The public, API-key-authenticated API (Phase 3). Every route is gated by
// apiKeyAuth + a tier-based rate limit. Data endpoints (threat feed, IP score,
// domain dossier) land here in 3.2.
const router = express.Router();

router.use(apiKeyAuth);
router.use(apiKeyRateLimit);

router.get('/status', apiStatus);

export default router;
