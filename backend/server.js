import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

import userRoutes from './routes/userRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import honeypotRoutes from './routes/honeypotRoutes.js';
import { trackRequest } from './controllers/trackingControllers.js';
import { requireApiKey } from './middleware/requireApiKey.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust cloudflared's forwarded headers so req.ip reflects the real client IP
app.set('trust proxy', true);

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, '../frontend/dist');

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.text({ type: ['text/xml', 'application/xml'], limit: '10mb' }));

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

// All /api/* routes require the internal key
app.use('/api', requireApiKey);

app.use('/api/users', userRoutes);
app.use('/api/traffic', trackingRoutes);

// 404 for unmatched API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// React router catch-all — serve index.html for all remaining paths
// Placed after API and honeypot routes so it never swallows them
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
