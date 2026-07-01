import express from 'express';
import { login, logout, me, createAccessLink, redeemAccessLink } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/access-link', requireAuth, requireAdmin, createAccessLink);
router.get('/access/:token', redeemAccessLink);

export default router;
