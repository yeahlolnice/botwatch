import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

import userRoutes from './routes/userRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import honeypotRoutes from './routes/honeypotRoutes.js';
import authRoutes from './routes/authRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import enrichmentRoutes from './routes/enrichmentRoutes.js';
import { trackRequest } from './controllers/trackingControllers.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { globalLimiter, trafficLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust cloudflared's forwarded headers so req.ip reflects the real client IP
app.set('trust proxy', true);

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, '../frontend/dist');

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || false, credentials: true }));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.text({ type: ['text/xml', 'application/xml'], limit: '10mb' }));

// Global rate limiter — applied to all routes
app.use(globalLimiter);

// Track every request — includes static asset fetches, honeypot hits, API calls
app.use(trackRequest);

// Honeypot routes — before static files so .env etc. are intercepted
app.use(honeypotRoutes);

// Serve React build — after honeypots so trap paths are never short-circuited
if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
} else {
    console.warn('Frontend dist not found — run: cd frontend && npm run build');
}

// Public auth routes — login/logout/me (login has its own rate limiter)
app.use('/api/auth', authRoutes);

// Public data routes — no auth, rate limited
app.use('/api/public', publicRoutes);

// All other /api/* routes require a valid JWT cookie
app.use('/api', requireAuth);

app.use('/api/users', requireAdmin, userRoutes);
app.use('/api/traffic', trafficLimiter, trackingRoutes);
app.use('/api/enrich', requireAdmin, enrichmentRoutes);

// 404 for unmatched API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// React router catch-all — serve index.html for all remaining paths
if (existsSync(frontendDist)) {
    app.get(/(.*)/, (req, res) => {
        res.sendFile(join(frontendDist, 'index.html'));
    });
}

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Botwatch Server running on port ${PORT}`);
});
