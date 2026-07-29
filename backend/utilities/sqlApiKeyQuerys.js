// API keys for the public/monetized API (Phase 3). We store only a SHA-256 hash
// of each key — the plaintext is shown once at creation and never persisted, so
// a DB leak can't expose usable keys. key_prefix is kept for display/lookup.
export const createApiKeyTableQuery = `
CREATE TABLE IF NOT EXISTS api_key (
    id BIGSERIAL PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    label TEXT,
    tier TEXT NOT NULL DEFAULT 'free',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    request_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
`;

export const insertApiKeyQuery = `
INSERT INTO api_key (key_hash, key_prefix, label, tier)
VALUES ($1, $2, $3, $4)
RETURNING id, key_prefix, label, tier, active, created_at;
`;

// Insert used by the billing flow — carries the Stripe linkage so an issued key
// can be traced to its subscription. Plaintext is never passed here (only hash).
export const insertBillingApiKeyQuery = `
INSERT INTO api_key (key_hash, key_prefix, label, tier, stripe_customer_id, stripe_subscription_id, stripe_session_id, customer_email)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, key_prefix, tier;
`;

export const getApiKeyByHashQuery = `
SELECT id, key_prefix, label, tier, active, request_count
FROM api_key WHERE key_hash = $1;
`;

export const incrementApiKeyUsageQuery = `
UPDATE api_key SET request_count = request_count + 1, last_used_at = NOW() WHERE id = $1;
`;

export const listApiKeysQuery = `
SELECT id, key_prefix, label, tier, active, request_count, created_at, last_used_at
FROM api_key ORDER BY created_at DESC;
`;

export const revokeApiKeyQuery = `
UPDATE api_key SET active = FALSE WHERE id = $1 RETURNING id;
`;
