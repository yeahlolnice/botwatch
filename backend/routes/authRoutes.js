import express from 'express';
import { login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
