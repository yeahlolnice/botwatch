import rateLimit from 'express-rate-limit';
import { query } from '../utilities/connectDB.js';
import { hashApiKey, TIER_LIMITS } from '../utilities/apiKey.js';
import { getApiKeyByHashQuery, incrementApiKeyUsageQuery } from '../utilities/sqlApiKeyQuerys.js';

// Authenticates a request by API key (x-api-key header or Authorization: Bearer),
// attaches req.apiKey, and meters usage. Reject unknown/revoked keys.
export async function apiKeyAuth(req, res, next) {
    const header = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const raw = header.trim();
    if (!raw) {
        return res.status(401).json({ error: 'API key required — send it in the x-api-key header' });
    }

    try {
        const row = (await query(getApiKeyByHashQuery, [hashApiKey(raw)])).rows[0];
        if (!row) return res.status(401).json({ error: 'Invalid API key' });
        if (!row.active) return res.status(403).json({ error: 'This API key has been revoked' });

        req.apiKey = row;
        // Meter usage without blocking the response.
        query(incrementApiKeyUsageQuery, [row.id]).catch((e) => console.error('API key metering:', e.message));
        return next();
    } catch (error) {
        console.error('API key auth error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

// Per-key rate limit whose ceiling depends on the key's tier. Runs after
// apiKeyAuth so req.apiKey is set.
export const apiKeyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: (req) => TIER_LIMITS[req.apiKey?.tier] || TIER_LIMITS.free,
    keyGenerator: (req) => String(req.apiKey?.id || req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for your plan' },
});
