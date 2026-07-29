// Per-IP behavioural aggregates for the malicious-IP model. One row per source
// IP, summarising everything the tracker recorded about it. The derived feature
// vector and the training label are computed from these in featureExtraction.js.
// LEFT JOINs ip_verdict so an analyst's confirm/deny can override the auto-label
// at training time (see labelRow). ip_verdict has one row per IP, so the join
// never multiplies request counts.
export const ipFeatureAggregatesQuery = `
SELECT
    host(request_tracking.ip_address)                                     AS ip,
    COUNT(*)                                                               AS request_count,
    COUNT(DISTINCT path)                                                   AS distinct_paths,
    COUNT(DISTINCT user_agent)                                             AS distinct_uas,
    COUNT(*) FILTER (WHERE user_agent IS NULL OR user_agent = '')          AS ua_missing,
    COUNT(*) FILTER (WHERE is_trap)                                        AS trap_hits,
    COUNT(*) FILTER (WHERE threat_signals IS NOT NULL)                     AS threat_requests,
    COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500)       AS status_4xx,
    COUNT(*) FILTER (WHERE status_code >= 500)                             AS status_5xx,
    COUNT(*) FILTER (WHERE method <> 'GET')                                AS non_get,
    COUNT(*) FILTER (WHERE raw_body IS NOT NULL OR body IS NOT NULL)       AS with_body,
    COUNT(DISTINCT method)                                                 AS distinct_methods,
    COALESCE(MAX(bot_score), 0)                                            AS max_bot_score,
    COALESCE(AVG(bot_score), 0)::float                                     AS avg_bot_score,
    EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))                  AS span_seconds,
    MAX(v.verdict)                                                         AS verdict
FROM request_tracking
LEFT JOIN ip_verdict v ON v.ip = host(request_tracking.ip_address)
WHERE request_tracking.ip_address IS NOT NULL
GROUP BY request_tracking.ip_address;
`;

// Analyst verdicts (confirm/deny) — the human-in-the-loop labels. Kept in their
// own table so they survive re-scoring and can override the auto-label.
export const createIpVerdictTableQuery = `
CREATE TABLE IF NOT EXISTS ip_verdict (
    ip TEXT PRIMARY KEY,
    verdict TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const upsertIpVerdictQuery = `
INSERT INTO ip_verdict (ip, verdict, reviewed_at) VALUES ($1, $2, NOW())
ON CONFLICT (ip) DO UPDATE SET verdict = EXCLUDED.verdict, reviewed_at = NOW();
`;

export const deleteIpVerdictQuery = `DELETE FROM ip_verdict WHERE ip = $1;`;

export const getFeedQuery = `
SELECT ip, score, explanation, request_count, scored_at
FROM ip_risk_score
WHERE score >= $1
ORDER BY score DESC, request_count DESC NULLS LAST;
`;

export const getIpScoreByIpQuery = `
SELECT ip, score, explanation, request_count, scored_at
FROM ip_risk_score WHERE ip = $1;
`;

// --- model + score persistence (auto-created by runMigrations) ---
export const createModelTableQuery = `
CREATE TABLE IF NOT EXISTS ml_model (
    name TEXT PRIMARY KEY,
    model JSONB NOT NULL,
    metrics JSONB,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createIpScoreTableQuery = `
CREATE TABLE IF NOT EXISTS ip_risk_score (
    ip TEXT PRIMARY KEY,
    score INTEGER NOT NULL,
    label INTEGER,
    request_count INTEGER,
    top_factors JSONB,
    explanation TEXT,
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// For installs created before the explanation column existed.
export const addIpScoreExplanationColumnQuery = `
ALTER TABLE ip_risk_score ADD COLUMN IF NOT EXISTS explanation TEXT;
`;

export const upsertModelQuery = `
INSERT INTO ml_model (name, model, metrics, trained_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (name) DO UPDATE SET model = EXCLUDED.model, metrics = EXCLUDED.metrics, trained_at = NOW()
RETURNING trained_at;
`;

export const getModelQuery = `SELECT model, metrics, trained_at FROM ml_model WHERE name = $1;`;

export const upsertIpScoreQuery = `
INSERT INTO ip_risk_score (ip, score, label, request_count, top_factors, explanation, scored_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW())
ON CONFLICT (ip) DO UPDATE SET
    score = EXCLUDED.score, label = EXCLUDED.label,
    request_count = EXCLUDED.request_count, top_factors = EXCLUDED.top_factors,
    explanation = EXCLUDED.explanation, scored_at = NOW();
`;

export const getTopIpScoresQuery = `
SELECT s.ip, s.score, s.label, s.request_count, s.top_factors, s.explanation, s.scored_at, v.verdict
FROM ip_risk_score s
LEFT JOIN ip_verdict v ON v.ip = s.ip
ORDER BY s.score DESC, s.request_count DESC NULLS LAST
LIMIT $1;
`;
