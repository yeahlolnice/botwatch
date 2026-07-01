export const createEnrichmentTableQuery = `
CREATE TABLE IF NOT EXISTS ip_enrichment (
    ip INET PRIMARY KEY,

    -- AbuseIPDB
    abuse_confidence_score  INT,
    abuse_total_reports     INT,
    abuse_last_reported_at  TIMESTAMPTZ,
    abuse_country_code      VARCHAR(10),
    abuse_isp               TEXT,
    abuse_domain            TEXT,
    abuse_usage_type        TEXT,
    abuse_is_tor            BOOLEAN,
    abuse_is_public         BOOLEAN,
    abuse_checked_at        TIMESTAMPTZ,

    -- Reverse DNS (free, local)
    rdns                    TEXT,

    -- Future enrichment slots (Shodan, GreyNoise, Censys, etc.)
    extra                   JSONB,

    enriched_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
`;

export const upsertAbuseIpDbQuery = `
INSERT INTO ip_enrichment (
    ip,
    abuse_confidence_score, abuse_total_reports, abuse_last_reported_at,
    abuse_country_code, abuse_isp, abuse_domain, abuse_usage_type,
    abuse_is_tor, abuse_is_public, abuse_checked_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
ON CONFLICT (ip) DO UPDATE SET
    abuse_confidence_score  = EXCLUDED.abuse_confidence_score,
    abuse_total_reports     = EXCLUDED.abuse_total_reports,
    abuse_last_reported_at  = EXCLUDED.abuse_last_reported_at,
    abuse_country_code      = EXCLUDED.abuse_country_code,
    abuse_isp               = EXCLUDED.abuse_isp,
    abuse_domain            = EXCLUDED.abuse_domain,
    abuse_usage_type        = EXCLUDED.abuse_usage_type,
    abuse_is_tor            = EXCLUDED.abuse_is_tor,
    abuse_is_public         = EXCLUDED.abuse_is_public,
    abuse_checked_at        = NOW(),
    updated_at              = NOW()
RETURNING *;
`;

export const getEnrichmentByIpQuery = `
SELECT * FROM ip_enrichment WHERE ip = $1::inet;
`;

// Full activity summary for a single IP — used to build a report
export const getIpSummaryQuery = `
SELECT
    MIN(timestamp)                                                  AS first_seen,
    MAX(timestamp)                                                  AS last_seen,
    COUNT(*)                                                        AS total_requests,
    COUNT(*) FILTER (WHERE is_trap = TRUE)                          AS honeypot_hits,
    COUNT(*) FILTER (WHERE threat_signals IS NOT NULL
                     AND jsonb_array_length(threat_signals) > 0)    AS threat_requests,
    MAX(bot_score)                                                  AS max_score,
    array_agg(DISTINCT method)                                      AS methods_used,
    array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL)  AS countries,
    array_agg(DISTINCT user_agent) FILTER (WHERE user_agent IS NOT NULL) AS user_agents
FROM request_tracking
WHERE cf_connecting_ip = $1::inet
   OR ip_address = $1::inet;
`;

export const getIpHoneypotHitsQuery = `
SELECT
    trap_type,
    COUNT(*)        AS hits,
    MIN(timestamp)  AS first_hit,
    MAX(timestamp)  AS last_hit,
    -- Sample a POST body if one was captured
    (SELECT body FROM request_tracking r2
     WHERE (r2.cf_connecting_ip = $1::inet OR r2.ip_address = $1::inet)
       AND r2.trap_type = rt.trap_type
       AND r2.body IS NOT NULL
     ORDER BY timestamp DESC LIMIT 1) AS sample_body
FROM request_tracking rt
WHERE (cf_connecting_ip = $1::inet OR ip_address = $1::inet)
  AND is_trap = TRUE
GROUP BY trap_type
ORDER BY hits DESC;
`;

export const getIpThreatSignalsQuery = `
SELECT DISTINCT
    sig->>'category'    AS category,
    sig->>'id'          AS signal_id,
    sig->>'source'      AS source,
    sig->>'excerpt'     AS excerpt,
    (sig->>'score')::int AS score
FROM request_tracking,
     jsonb_array_elements(threat_signals) AS sig
WHERE (cf_connecting_ip = $1::inet OR ip_address = $1::inet)
  AND threat_signals IS NOT NULL
  AND jsonb_array_length(threat_signals) > 0
ORDER BY score DESC
LIMIT 30;
`;

export const getIpPathsQuery = `
SELECT
    path,
    method,
    COUNT(*)        AS hits,
    MAX(timestamp)  AS last_seen,
    bool_or(is_trap) AS is_trap
FROM request_tracking
WHERE (cf_connecting_ip = $1::inet OR ip_address = $1::inet)
GROUP BY path, method
ORDER BY hits DESC
LIMIT 40;
`;

// IPs worth reviewing: hit a trap or scored high, not yet reported today
export const getReportCandidatesQuery = `
SELECT
    rt.cf_connecting_ip                                         AS ip,
    COUNT(*)                                                    AS total_requests,
    COUNT(*) FILTER (WHERE rt.is_trap = TRUE)                   AS honeypot_hits,
    MAX(rt.bot_score)                                           AS max_score,
    MAX(rt.timestamp)                                           AS last_seen,
    array_agg(DISTINCT rt.trap_type)
        FILTER (WHERE rt.trap_type IS NOT NULL)                 AS trap_types,
    array_agg(DISTINCT rt.country)
        FILTER (WHERE rt.country IS NOT NULL)                   AS countries,
    ie.abuse_confidence_score,
    ie.abuse_isp,
    ie.abuse_usage_type,
    ie.abuse_is_tor,
    ie.abuse_checked_at
FROM request_tracking rt
LEFT JOIN ip_enrichment ie ON ie.ip = rt.cf_connecting_ip
WHERE rt.cf_connecting_ip IS NOT NULL
  AND (rt.is_trap = TRUE OR rt.bot_score >= 50)
GROUP BY rt.cf_connecting_ip, ie.abuse_confidence_score, ie.abuse_isp, ie.abuse_usage_type, ie.abuse_is_tor, ie.abuse_checked_at
ORDER BY honeypot_hits DESC, max_score DESC
LIMIT 100;
`;
