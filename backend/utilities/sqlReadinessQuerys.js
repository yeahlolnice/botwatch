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

// Holds the generated report snapshot for the hosted page.
export const addReportDataColumnQuery = `
ALTER TABLE report_order ADD COLUMN IF NOT EXISTS report_data JSONB;
`;

// The worker atomically claims one paid order (paid -> generating). FOR UPDATE
// SKIP LOCKED means multiple workers/instances never grab the same order.
export const claimNextPaidReportOrderQuery = `
UPDATE report_order SET status = 'generating', updated_at = NOW()
WHERE id = (
    SELECT id FROM report_order WHERE status = 'paid'
    ORDER BY created_at ASC LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING id, target_url, hostname, email;
`;

export const setReportGeneratedQuery = `
UPDATE report_order SET report_token = $2, report_data = $3, updated_at = NOW()
WHERE id = $1;
`;

export const markReportSentQuery = `UPDATE report_order SET status = 'sent', updated_at = NOW() WHERE id = $1;`;
export const markReportFailedQuery = `UPDATE report_order SET status = 'failed', updated_at = NOW() WHERE id = $1;`;

// Public, token-gated read for the hosted report page.
export const getReportByTokenQuery = `
SELECT hostname, report_data, updated_at
FROM report_order
WHERE report_token = $1 AND report_data IS NOT NULL;
`;
