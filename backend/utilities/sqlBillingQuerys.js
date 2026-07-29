// Billing schema (Phase 3.4). Links Stripe checkouts to provisioned API keys.
//
// Design note — the "never persist a plaintext key" invariant is preserved: the
// webhook (the reliable signal that money changed hands) records a paid order,
// but the API key itself is generated only when the buyer's success page claims
// it (see billingController.getSession). So we store the hash, never the key.

// api_key gains optional Stripe linkage columns so an issued key can be traced
// back to its subscription (for future renewal/cancellation handling in 3.5).
export const addApiKeyBillingColumnsQuery = `
ALTER TABLE api_key
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT;
`;

// One row per Checkout session. status: paid -> provisioning -> provisioned.
export const createBillingOrderTableQuery = `
CREATE TABLE IF NOT EXISTS billing_order (
    session_id TEXT PRIMARY KEY,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    email TEXT,
    tier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    api_key_id BIGINT REFERENCES api_key(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// Record a paid order from the webhook. Idempotent for Stripe's retries, and the
// WHERE guard means a duplicate delivery can never revert an already-provisioned
// order back to 'paid'.
export const upsertBillingOrderQuery = `
INSERT INTO billing_order (session_id, stripe_customer_id, stripe_subscription_id, email, tier, status, updated_at)
VALUES ($1, $2, $3, $4, $5, 'paid', NOW())
ON CONFLICT (session_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    email = EXCLUDED.email,
    updated_at = NOW()
WHERE billing_order.status = 'paid';
`;

export const getBillingOrderQuery = `SELECT * FROM billing_order WHERE session_id = $1;`;

// Atomically claim a paid order for provisioning so a double-loaded success page
// (or a concurrent poll) can never mint two keys — only the winner gets the row.
export const claimBillingOrderQuery = `
UPDATE billing_order SET status = 'provisioning', updated_at = NOW()
WHERE session_id = $1 AND status = 'paid'
RETURNING session_id, stripe_customer_id, stripe_subscription_id, email, tier;
`;

export const finalizeBillingOrderQuery = `
UPDATE billing_order SET status = 'provisioned', api_key_id = $2, updated_at = NOW()
WHERE session_id = $1;
`;
