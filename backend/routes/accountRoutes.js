import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireCustomer } from '../middleware/requireCustomer.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import {
    signup, login, logout, me,
    getAccount, listKeys, createKey, revokeKey,
    forgotPassword, resetPassword,
} from '../controllers/accountController.js';

// Customer accounts (Phase 3.5). Mounted at /api/account BEFORE the global JWT
// gate, because signup/login are used by not-yet-authenticated visitors. The
// authenticated portal routes apply requireAuth + requireCustomer per-route.
const router = express.Router();

// Public
router.post('/signup', loginLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.post('/forgot', loginLimiter, forgotPassword);
router.post('/reset', loginLimiter, resetPassword);

// Authenticated customer portal
router.get('/me', requireAuth, requireCustomer, me);
router.get('/', requireAuth, requireCustomer, getAccount);
router.get('/keys', requireAuth, requireCustomer, listKeys);
router.post('/keys', requireAuth, requireCustomer, createKey);
router.post('/keys/:id/revoke', requireAuth, requireCustomer, revokeKey);

export default router;
