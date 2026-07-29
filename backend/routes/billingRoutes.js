import express from 'express';
import { createCheckout, handleWebhook, getSession, billingConfig } from '../controllers/billingController.js';

// Public billing routes (Phase 3.4). Mounted at /api/billing BEFORE the JWT gate:
// checkout is used by not-yet-logged-in buyers, and the webhook is called by
// Stripe with no cookie. All of these no-op cleanly until Stripe is configured.
const router = express.Router();

router.get('/config', billingConfig);
router.post('/checkout', createCheckout);
router.post('/webhook', handleWebhook);
router.get('/session/:sessionId', getSession);

export default router;
