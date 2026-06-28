export const createRequestTrackingTableQuery = `
CREATE TABLE IF NOT EXISTS request_tracking (
    id BIGSERIAL PRIMARY KEY,

    request_id UUID DEFAULT gen_random_uuid(),

    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    full_url TEXT,
    query_params JSONB,

    status_code INT,
    response_time_ms INT,

    ip_address INET,
    x_forwarded_for TEXT,
    cf_connecting_ip INET,
    real_ip INET,

    user_agent TEXT,
    referrer TEXT,

    headers JSONB,
    cookies JSONB,
    body JSONB,

    session_id TEXT,
    visitor_id TEXT,

    accept_language TEXT,
    accept_encoding TEXT,
    sec_ch_ua TEXT,
    sec_fetch_site TEXT,
    sec_fetch_mode TEXT,
    sec_fetch_dest TEXT,

    is_trap BOOLEAN DEFAULT FALSE,
    trap_type TEXT,
    bot_score INT DEFAULT 0,
    bot_label TEXT,
    crawler_type TEXT,

    threat_signals JSONB,

    js_enabled BOOLEAN,
    screen_width INT,
    screen_height INT,
    timezone TEXT,

    country TEXT,
    region TEXT,
    city TEXT,
    asn TEXT,
    provider TEXT
);
`;

// Run after CREATE TABLE to add threat_signals to existing installations
export const migrateTrackingTableQuery = `
ALTER TABLE request_tracking
    ADD COLUMN IF NOT EXISTS threat_signals JSONB;
`;

export const insertRequestQuery = `
INSERT INTO request_tracking (
    method, path, full_url, query_params,
    status_code, response_time_ms,
    ip_address, x_forwarded_for, cf_connecting_ip, real_ip,
    user_agent, referrer,
    headers, cookies, body,
    session_id, visitor_id,
    accept_language, accept_encoding, sec_ch_ua, sec_fetch_site, sec_fetch_mode, sec_fetch_dest,
    is_trap, trap_type, bot_score, bot_label, crawler_type,
    threat_signals,
    js_enabled, screen_width, screen_height, timezone,
    country, region, city, asn, provider
) VALUES (
    $1, $2, $3, $4,
    $5, $6,
    $7, $8, $9, $10,
    $11, $12,
    $13, $14, $15,
    $16, $17,
    $18, $19, $20, $21, $22, $23,
    $24, $25, $26, $27, $28,
    $29,
    $30, $31, $32, $33,
    $34, $35, $36, $37, $38
)`;

export const getRecentRequestsQuery = `
SELECT
    id, request_id, timestamp,
    method, path, full_url, query_params,
    status_code, response_time_ms,
    ip_address, x_forwarded_for,
    user_agent, referrer,
    bot_label, crawler_type, bot_score,
    is_trap, trap_type,
    threat_signals,
    accept_language, sec_fetch_site, sec_fetch_mode
FROM request_tracking
ORDER BY timestamp DESC
LIMIT $1 OFFSET $2
`;

export const getRequestCountQuery = `SELECT COUNT(*) AS total FROM request_tracking`;

export const getTrafficStatsQuery = `
SELECT
    COUNT(*)                                                        AS total_requests,
    COUNT(DISTINCT ip_address)                                      AS unique_ips,
    COUNT(DISTINCT user_agent)                                      AS unique_user_agents,
    AVG(response_time_ms)                                           AS avg_response_time_ms,
    COUNT(*) FILTER (WHERE bot_label IS NOT NULL)                   AS classified_bots,
    COUNT(*) FILTER (WHERE is_trap = TRUE)                          AS honeypot_hits,
    COUNT(*) FILTER (WHERE bot_score > 0)                           AS threat_flagged,
    COUNT(*) FILTER (WHERE bot_score >= 70)                         AS high_threat,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour')   AS requests_last_hour,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') AS requests_last_24h
FROM request_tracking
`;

export const getTopUserAgentsQuery = `
SELECT
    COALESCE(bot_label, 'Unknown') AS label,
    user_agent,
    COUNT(*) AS request_count,
    MAX(timestamp) AS last_seen
FROM request_tracking
GROUP BY bot_label, user_agent
ORDER BY request_count DESC
LIMIT $1
`;

export const getMethodBreakdownQuery = `
SELECT method, COUNT(*) AS count
FROM request_tracking
GROUP BY method
ORDER BY count DESC
`;

export const getStatusBreakdownQuery = `
SELECT status_code, COUNT(*) AS count
FROM request_tracking
WHERE status_code IS NOT NULL
GROUP BY status_code
ORDER BY count DESC
`;

export const getThreatBreakdownQuery = `
SELECT
    sig->>'category' AS category,
    COUNT(*)         AS occurrences,
    COUNT(DISTINCT ip_address) AS unique_ips
FROM request_tracking,
     jsonb_array_elements(threat_signals) AS sig
WHERE threat_signals IS NOT NULL
  AND jsonb_array_length(threat_signals) > 0
GROUP BY category
ORDER BY occurrences DESC
`;

export const getHoneypotHitsQuery = `
SELECT
    trap_type,
    COUNT(*)                   AS hits,
    COUNT(DISTINCT ip_address) AS unique_ips,
    MAX(timestamp)             AS last_seen
FROM request_tracking
WHERE is_trap = TRUE
GROUP BY trap_type
ORDER BY hits DESC
`;

export const getTopAttackingIPsQuery = `
SELECT
    ip_address,
    COUNT(*)                                                    AS total_requests,
    COUNT(*) FILTER (WHERE bot_score > 0)                       AS threat_requests,
    COUNT(*) FILTER (WHERE is_trap = TRUE)                      AS honeypot_hits,
    MAX(bot_score)                                              AS max_threat_score,
    MAX(timestamp)                                              AS last_seen,
    array_agg(DISTINCT bot_label) FILTER (WHERE bot_label IS NOT NULL) AS labels
FROM request_tracking
GROUP BY ip_address
ORDER BY threat_requests DESC, honeypot_hits DESC
LIMIT $1
`;
