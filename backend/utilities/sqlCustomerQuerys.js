// Customer accounts (Phase 3.5). Self-serve API customers live in their own
// table — deliberately separate from the admin `users`/role_type enum, so this
// external, Stripe-linked principal can never be confused with a research/admin
// account. Their JWT carries role:'customer', which requireAdmin already rejects.
//
// Accounts link to billing purely by email (and, once known, stripe_customer_id):
// a customer who subscribed before signing up is reconciled to their existing
// keys/orders on first login, and a logged-in customer's checkout carries their
// account email so new subscriptions match automatically.

export const createCustomerTableQuery = `
CREATE TABLE IF NOT EXISTS customer (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(120),
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);
`;

// Ties an issued key to the account that owns it. Nullable: keys minted by the
// checkout success page before an account exists are adopted later by email.
export const addApiKeyOwnerColumnQuery = `
ALTER TABLE api_key ADD COLUMN IF NOT EXISTS owner_customer_id BIGINT REFERENCES customer(id);
`;

export const getCustomerByEmailQuery = `
SELECT id, email, name, password, stripe_customer_id FROM customer WHERE email = $1;
`;

// Never selects the password hash — used for authenticated reads.
export const getCustomerByIdQuery = `
SELECT id, email, name, stripe_customer_id, created_at, last_login FROM customer WHERE id = $1;
`;

export const insertCustomerQuery = `
INSERT INTO customer (email, password, name) VALUES ($1, $2, $3)
RETURNING id, email, name;
`;

export const touchCustomerLoginQuery = `UPDATE customer SET last_login = NOW() WHERE id = $1;`;

// --- reconciliation: adopt pre-existing billing into a fresh/returning account ---

// Adopt any keys minted for this email (e.g. by the checkout success page) that
// aren't yet owned by an account.
export const reconcileKeyOwnerByEmailQuery = `
UPDATE api_key SET owner_customer_id = $1
WHERE owner_customer_id IS NULL AND customer_email = $2;
`;

// Backfill the account's Stripe customer id from its most recent order, if unset.
export const reconcileCustomerStripeIdQuery = `
UPDATE customer SET stripe_customer_id = sub.sid
FROM (
    SELECT stripe_customer_id AS sid FROM billing_order
    WHERE email = $2 AND stripe_customer_id IS NOT NULL
    ORDER BY created_at DESC LIMIT 1
) sub
WHERE customer.id = $1 AND customer.stripe_customer_id IS NULL;
`;

// The account's current plan = the tier of its most recent order (Free if none).
export const getCustomerPlanQuery = `
SELECT tier FROM billing_order
WHERE email = $1 OR ($2::text IS NOT NULL AND stripe_customer_id = $2)
ORDER BY created_at DESC LIMIT 1;
`;

// --- self-serve key management, scoped to the owning account ---

export const listCustomerKeysQuery = `
SELECT id, key_prefix, label, tier, active, request_count, created_at, last_used_at
FROM api_key
WHERE owner_customer_id = $1 OR customer_email = $2
ORDER BY created_at DESC;
`;

export const insertCustomerKeyQuery = `
INSERT INTO api_key (key_hash, key_prefix, label, tier, owner_customer_id, customer_email)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, key_prefix, label, tier, active, request_count, created_at;
`;

// Scoped so a customer can only revoke a key they actually own.
export const revokeCustomerKeyQuery = `
UPDATE api_key SET active = FALSE
WHERE id = $1 AND (owner_customer_id = $2 OR customer_email = $3)
RETURNING id;
`;
