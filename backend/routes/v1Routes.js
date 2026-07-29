import express from 'express';
import { apiKeyAuth, apiKeyRateLimit } from '../middleware/apiKeyAuth.js';
import { apiStatus } from '../controllers/apiKeyController.js';
import { getV1Feed, getV1Ip, getV1Domain } from '../controllers/v1Controller.js';

// The public, API-key-authenticated API (Phase 3). Every route is gated by
// apiKeyAuth + a tier-based rate limit.
const router = express.Router();

router.use(apiKeyAuth);
router.use(apiKeyRateLimit);

router.get('/status', apiStatus);
router.get('/feed', getV1Feed);
router.get('/ip/:ip', getV1Ip);
router.get('/domain/:hostname', getV1Domain);

export default router;
