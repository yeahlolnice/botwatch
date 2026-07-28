// Per-IP behavioural aggregates for the malicious-IP model. One row per source
// IP, summarising everything the tracker recorded about it. The derived feature
// vector and the training label are computed from these in featureExtraction.js.
export const ipFeatureAggregatesQuery = `
SELECT
    host(ip_address)                                                       AS ip,
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
    EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))                  AS span_seconds
FROM request_tracking
WHERE ip_address IS NOT NULL
GROUP BY ip_address;
`;
