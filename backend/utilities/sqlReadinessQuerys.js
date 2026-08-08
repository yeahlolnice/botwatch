// Paid AI-readiness report orders (funnel C). One row per $5 checkout. The
// webhook flips pending -> paid; the async pipeline (D) then crawls, generates,
// and emails the report, moving it paid -> generating -> sent (or failed).
export const createReportOrderTableQuery = `
CREATE TABLE IF NOT EXISTS report_order (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    target_url TEXT NOT NULL,
    hostname TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    report_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const insertReportOrderQuery = `
INSERT INTO report_order (session_id, target_url, hostname, email)
VALUES ($1, $2, $3, $4) RETURNING id;
`;

// Idempotent for Stripe's at-least-once delivery: only pending -> paid.
export const markReportOrderPaidQuery = `
UPDATE report_order SET status = 'paid', updated_at = NOW()
WHERE session_id = $1 AND status = 'pending'
RETURNING id;
`;
