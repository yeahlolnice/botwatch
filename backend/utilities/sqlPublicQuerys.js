// Public-facing queries — aggregate only, no raw IPs or payloads

export const getPublicStatsQuery = `
SELECT
    COUNT(*)                                                        AS total_requests,
    COUNT(DISTINCT ip_address)                                      AS unique_ips,
    COUNT(DISTINCT country) FILTER (WHERE country IS NOT NULL)      AS countries_seen,
    COUNT(*) FILTER (WHERE is_trap = TRUE)                          AS honeypot_hits,
    COUNT(*) FILTER (WHERE threat_signals IS NOT NULL
                     AND jsonb_array_length(threat_signals) > 0)    AS threat_requests,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') AS requests_last_24h,
    COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour')   AS requests_last_hour
FROM request_tracking
`;

export const getPublicRecentTrapsQuery = `
SELECT
    timestamp,
    path,
    trap_type,
    method,
    bot_label,
    crawler_type,
    country,
    -- Mask last octet of IP for privacy
    CASE
        WHEN cf_connecting_ip IS NOT NULL
        THEN host(network(set_masklen(cf_connecting_ip, 24))) || '.xx'
        WHEN ip_address IS NOT NULL
        THEN host(network(set_masklen(ip_address, 24))) || '.xx'
        ELSE 'unknown'
    END AS masked_ip
FROM request_tracking
WHERE is_trap = TRUE
ORDER BY timestamp DESC
LIMIT 20
`;

export const getPublicAttackBreakdownQuery = `
SELECT
    sig->>'category' AS category,
    COUNT(*)         AS occurrences
FROM request_tracking,
     jsonb_array_elements(threat_signals) AS sig
WHERE threat_signals IS NOT NULL
  AND jsonb_array_length(threat_signals) > 0
GROUP BY category
ORDER BY occurrences DESC
`;

export const getPublicCountryStatsQuery = `
SELECT
    country,
    COUNT(*)                                                     AS total_requests,
    COUNT(*) FILTER (WHERE is_trap = TRUE)                       AS honeypot_hits,
    COUNT(*) FILTER (WHERE threat_signals IS NOT NULL
                     AND jsonb_array_length(threat_signals) > 0) AS threat_requests
FROM request_tracking
WHERE country IS NOT NULL
GROUP BY country
ORDER BY total_requests DESC
LIMIT 20
`;

// Known good crawlers we want to celebrate on the leaderboard
export const getPublicBotLeaderboardQuery = `
SELECT
    bot_label                AS name,
    crawler_type             AS type,
    COUNT(*)                 AS total_visits,
    MIN(timestamp)           AS first_seen,
    MAX(timestamp)           AS last_seen,
    COUNT(DISTINCT country)  AS countries
FROM request_tracking
WHERE bot_label IS NOT NULL
  AND crawler_type IN ('search-engine', 'llm-crawler', 'seo-tool', 'monitoring')
GROUP BY bot_label, crawler_type
ORDER BY total_visits DESC
LIMIT 30
`;

export const getPublicHoneypotBreakdownQuery = `
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

// Public threat blocklist — HIGH-CONFIDENCE malicious IPs only. Publishing an
// IP is a serious claim, so we deliberately include just unambiguous ground
// truth: IPs that hit a honeypot decoy (no legitimate reason to) OR an analyst
// has confirmed malicious. Model-score-only IPs are NOT published (the model
// has false positives). An analyst 'benign' verdict always excludes an IP, even
// if it tripped a trap. Aggregate metadata only — never payloads or user data.
export const getPublicBlocklistQuery = `
SELECT host(rt.ip_address)                                      AS ip,
       MIN(rt.timestamp)                                        AS first_seen,
       MAX(rt.timestamp)                                        AS last_seen,
       COUNT(*) FILTER (WHERE rt.is_trap)                       AS trap_hits,
       COALESCE(MAX(rt.bot_score), 0)                           AS max_score,
       array_agg(DISTINCT rt.country) FILTER (WHERE rt.country IS NOT NULL) AS countries,
       bool_or(v.verdict = 'malicious')                         AS confirmed
FROM request_tracking rt
LEFT JOIN ip_verdict v ON v.ip = host(rt.ip_address)
WHERE rt.ip_address IS NOT NULL
GROUP BY host(rt.ip_address)
HAVING (COUNT(*) FILTER (WHERE rt.is_trap) > 0 OR bool_or(v.verdict = 'malicious'))
   AND COALESCE(bool_or(v.verdict = 'benign'), FALSE) = FALSE
ORDER BY last_seen DESC
LIMIT 10000
`;
