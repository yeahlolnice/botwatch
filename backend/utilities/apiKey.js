import crypto from 'node:crypto';

// Generates a new API key: a "bw_" prefix + 32 url-safe random chars. Returns the
// plaintext (shown to the user once), its SHA-256 hash (what we store), and a
// short prefix for display/lookup.
export function generateApiKey() {
    const random = crypto.randomBytes(24).toString('base64url'); // 32 chars
    const key = `bw_${random}`;
    return {
        key,
        hash: hashApiKey(key),
        prefix: key.slice(0, 11), // "bw_" + 8 chars
    };
}

export function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

// Requests-per-minute ceiling by tier — enforced by the rate limiter.
export const TIER_LIMITS = {
    free: 60,
    pro: 600,
    enterprise: 6000,
};

export const VALID_TIERS = Object.keys(TIER_LIMITS);
