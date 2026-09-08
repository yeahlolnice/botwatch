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
    raw_body TEXT,
    raw_body_bytes INT,
    raw_body_truncated BOOLEAN,

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

// Run after CREATE TABLE to add threat_signals to existing installations.
// attack_intent/severity/cve_ids are denormalized from the payload analyzer's
// classification; anomaly_* hold the novel-payload (0-day) triage signal.
export const migrateTrackingTableQuery = `
ALTER TABLE request_tracking
    ADD COLUMN IF NOT EXISTS threat_signals JSONB,
    ADD COLUMN IF NOT EXISTS raw_body TEXT,
    ADD COLUMN IF NOT EXISTS raw_body_bytes INT,
    ADD COLUMN IF NOT EXISTS raw_body_truncated BOOLEAN,
    ADD COLUMN IF NOT EXISTS attack_intent TEXT,
    ADD COLUMN IF NOT EXISTS attack_severity TEXT,
    ADD COLUMN IF NOT EXISTS cve_ids JSONB,
    ADD COLUMN IF NOT EXISTS anomaly_score INT,
    ADD COLUMN IF NOT EXISTS anomaly_signals JSONB,
    ADD COLUMN IF NOT EXISTS suspicious_unclassified BOOLEAN;
`;

export const insertRequestQuery = `
INSERT INTO request_tracking (
    method, path, full_url, query_params,
    status_code, response_time_ms,
    ip_address, x_forwarded_for, cf_connecting_ip, real_ip,
    user_agent, referrer,
    headers, cookies, body,
    raw_body, raw_body_bytes, raw_body_truncated,
    session_id, visitor_id,
    accept_language, accept_encoding, sec_ch_ua, sec_fetch_site, sec_fetch_mode, sec_fetch_dest,
    is_trap, trap_type, bot_score, bot_label, crawler_type,
    threat_signals,
    js_enabled, screen_width, screen_height, timezone,
    country, region, city, asn, provider,
    attack_intent, attack_severity, cve_ids, anomaly_score, anomaly_signals, suspicious_unclassified
) VALUES (
    $1, $2, $3, $4,
    $5, $6,
    $7, $8, $9, $10,
    $11, $12,
    $13, $14, $15,
    $16, $17, $18,
    $19, $20,
    $21, $22, $23, $24, $25, $26,
    $27, $28, $29, $30, $31,
    $32,
    $33, $34, $35, $36,
    $37, $38, $39, $40, $41,
    $42, $43, $44, $45, $46, $47
)`;

// NOTE: intentionally does NOT select body / raw_body. Those columns can hold
// captured request payloads (including failed-login credential attempts) and
// must never be returned by an API endpoint — inspect them at the DB level only.
export const getRecentRequestsQuery = `
SELECT
    id, request_id, timestamp,
    method, path, full_url, query_params,
    status_code, response_time_ms,
    ip_address, x_forwarded_for, cf_connecting_ip,
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

// --- Attack-analysis rollups (payload classification) ---

export const getAttackIntentBreakdownQuery = `
SELECT attack_intent AS intent,
       COUNT(*)                   AS occurrences,
       COUNT(DISTINCT ip_address) AS unique_ips
FROM request_tracking
WHERE attack_intent IS NOT NULL
GROUP BY attack_intent
ORDER BY occurrences DESC
`;

export const getAttackSeverityBreakdownQuery = `
SELECT attack_severity AS severity, COUNT(*) AS occurrences
FROM request_tracking
WHERE attack_severity IS NOT NULL
GROUP BY attack_severity
`;

export const getTopCvesQuery = `
SELECT cve AS cve,
       COUNT(*)                   AS occurrences,
       COUNT(DISTINCT ip_address) AS unique_ips,
       MAX(timestamp)             AS last_seen
FROM request_tracking,
     jsonb_array_elements_text(cve_ids) AS cve
WHERE cve_ids IS NOT NULL AND jsonb_array_length(cve_ids) > 0
GROUP BY cve
ORDER BY occurrences DESC
LIMIT 20
`;

export const getTopTargetedPathsQuery = `
SELECT path,
       COUNT(*)                   AS attacks,
       COUNT(DISTINCT ip_address) AS unique_ips
FROM request_tracking
WHERE attack_intent IS NOT NULL OR suspicious_unclassified = TRUE
GROUP BY path
ORDER BY attacks DESC
LIMIT 20
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

// Daily attack volume over the last 30 days — attack requests, distinct
// attacking IPs, and honeypot hits per day. "Attacking" = tripped a
// signature/intent, hit a honeypot, scored > 0, or was flagged novel.
// (Predicate inlined rather than shared so this stays independent of the
// attacker-infrastructure change.)
export const getAttackTrendQuery = `
SELECT date_trunc('day', timestamp) AS day,
       COUNT(*) FILTER (WHERE attack_intent IS NOT NULL OR is_trap = TRUE OR bot_score > 0 OR suspicious_unclassified = TRUE) AS attacks,
       COUNT(DISTINCT ip_address) FILTER (WHERE attack_intent IS NOT NULL OR is_trap = TRUE OR bot_score > 0 OR suspicious_unclassified = TRUE) AS ips,
       COUNT(*) FILTER (WHERE is_trap = TRUE) AS trap_hits
FROM request_tracking
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day ASC
`;

// --- Attack infrastructure cross-reference (attackers × IP enrichment) ---
// "Attacking" = tripped a signature/intent, hit a honeypot, scored > 0, or was
// flagged novel/suspicious. Country comes from the Cloudflare header (present on
// every request); ISP/usage-type/Tor come from ip_enrichment (AbuseIPDB), which
// is populated per-IP on demand, so those rollups cover the enriched subset.
const ATTACKER_PREDICATE = `(attack_intent IS NOT NULL OR is_trap = TRUE OR bot_score > 0 OR suspicious_unclassified = TRUE)`;

export const getAttacksByCountryQuery = `
SELECT country,
       COUNT(DISTINCT ip_address) AS ips,
       COUNT(*)                   AS requests,
       COUNT(*) FILTER (WHERE is_trap) AS trap_hits
FROM request_tracking
WHERE country IS NOT NULL AND ${ATTACKER_PREDICATE}
GROUP BY country
ORDER BY ips DESC, requests DESC
LIMIT 20
`;

export const getAttackInfraUsageQuery = `
SELECT COALESCE(ie.abuse_usage_type, 'Unknown')            AS usage_type,
       COUNT(DISTINCT COALESCE(rt.cf_connecting_ip, rt.ip_address)) AS ips,
       COUNT(*)                                            AS requests
FROM request_tracking rt
JOIN ip_enrichment ie ON ie.ip = COALESCE(rt.cf_connecting_ip, rt.ip_address)
WHERE ${ATTACKER_PREDICATE}
GROUP BY COALESCE(ie.abuse_usage_type, 'Unknown')
ORDER BY ips DESC
LIMIT 15
`;

export const getTopAttackerNetworksQuery = `
SELECT ie.abuse_isp                                        AS isp,
       ie.abuse_country_code                               AS country,
       COUNT(DISTINCT COALESCE(rt.cf_connecting_ip, rt.ip_address)) AS ips,
       COUNT(*)                                            AS requests,
       MAX(rt.bot_score)                                   AS max_score,
       bool_or(ie.abuse_is_tor)                            AS has_tor
FROM request_tracking rt
JOIN ip_enrichment ie ON ie.ip = COALESCE(rt.cf_connecting_ip, rt.ip_address)
WHERE ie.abuse_isp IS NOT NULL AND ${ATTACKER_PREDICATE}
GROUP BY ie.abuse_isp, ie.abuse_country_code
ORDER BY ips DESC, requests DESC
LIMIT 20
`;

export const getTorAttackerCountQuery = `
SELECT COUNT(DISTINCT COALESCE(rt.cf_connecting_ip, rt.ip_address)) AS tor_ips
FROM request_tracking rt
JOIN ip_enrichment ie ON ie.ip = COALESCE(rt.cf_connecting_ip, rt.ip_address)
WHERE ie.abuse_is_tor = TRUE AND ${ATTACKER_PREDICATE}
`;

// --- Reclassify (reprocess stored requests through the upgraded analyzer) ---
// Pulls the columns the analyzer needs to rebuild its inspection targets from a
// stored row. Id-keyed pagination (WHERE id > $1) so a batch job can stream the
// whole table. $2 = batch size; $3 = when true, only rows not yet classified.
export const getRequestsForReclassifyQuery = `
SELECT id, method, path, full_url, query_params, headers, body, raw_body, user_agent
FROM request_tracking
WHERE id > $1
  AND ($3 = FALSE OR attack_intent IS NULL)
ORDER BY id ASC
LIMIT $2
`;

export const updateRequestClassificationQuery = `
UPDATE request_tracking SET
    threat_signals = $2,
    bot_score = $3,
    attack_intent = $4,
    attack_severity = $5,
    cve_ids = $6,
    anomaly_score = $7,
    anomaly_signals = $8,
    suspicious_unclassified = $9
WHERE id = $1
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

// --- Credential-attack analytics (honeypot login attempts) ------------------
// Attackers submit usernames/passwords to the fake login traps (WordPress
// `log`/`pwd`, admin panel `username`/`password`). Those posts are tracked like
// any other request, so the submitted credentials land in the body JSONB. These
// are attacker-supplied dictionary/stuffing values — not botwatch user data
// (real signup credentials are stripped before storage in trackingControllers).
//
// PRIVACY: a honeypot can occasionally catch a real credential (someone
// fat-fingers a genuine password into a fake form). The password and pair
// queries therefore only surface values seen 2+ times (HAVING COUNT(*) >= 2),
// so a one-off (possibly real) secret never appears; dictionary values, which
// recur across attempts, do. Values are also length-capped defensively.
// Usernames are not gated — attempted account names (admin, root, …) aren't
// secrets. Keep the >= 2 gate on any PUBLIC surface.

const CRED_USER = `COALESCE(body->>'log', body->>'username', body->>'user')`;
const CRED_PASS = `COALESCE(body->>'pwd', body->>'password', body->>'pass')`;

export const getTopAttemptedUsernamesQuery = `
SELECT LEFT(${CRED_USER}, 64)     AS username,
       COUNT(*)                   AS attempts,
       COUNT(DISTINCT ip_address) AS unique_ips,
       MAX(timestamp)             AS last_seen
FROM request_tracking
WHERE jsonb_typeof(body) = 'object'
  AND ${CRED_USER} IS NOT NULL AND ${CRED_USER} <> ''
GROUP BY 1
ORDER BY attempts DESC
LIMIT 15
`;

export const getTopAttemptedPasswordsQuery = `
SELECT LEFT(${CRED_PASS}, 64)     AS password,
       COUNT(*)                   AS attempts,
       COUNT(DISTINCT ip_address) AS unique_ips
FROM request_tracking
WHERE jsonb_typeof(body) = 'object'
  AND ${CRED_PASS} IS NOT NULL AND ${CRED_PASS} <> ''
GROUP BY 1
HAVING COUNT(*) >= 2
ORDER BY attempts DESC
LIMIT 15
`;

export const getTopCredentialPairsQuery = `
SELECT LEFT(${CRED_USER}, 64) AS username,
       LEFT(${CRED_PASS}, 64) AS password,
       COUNT(*)               AS attempts,
       COUNT(DISTINCT ip_address) AS unique_ips
FROM request_tracking
WHERE jsonb_typeof(body) = 'object'
  AND ${CRED_USER} IS NOT NULL AND ${CRED_USER} <> ''
  AND ${CRED_PASS} IS NOT NULL AND ${CRED_PASS} <> ''
GROUP BY 1, 2
HAVING COUNT(*) >= 2
ORDER BY attempts DESC
LIMIT 15
`;

export const getCredentialAttemptStatsQuery = `
SELECT COUNT(*) FILTER (WHERE ${CRED_PASS} IS NOT NULL AND ${CRED_PASS} <> '')       AS password_attempts,
       COUNT(DISTINCT ${CRED_USER}) FILTER (WHERE ${CRED_USER} <> '')                AS unique_usernames,
       COUNT(DISTINCT ${CRED_PASS}) FILTER (WHERE ${CRED_PASS} <> '')                AS unique_passwords,
       COUNT(DISTINCT ip_address) FILTER (WHERE ${CRED_USER} IS NOT NULL OR ${CRED_PASS} IS NOT NULL) AS attacker_ips
FROM request_tracking
WHERE jsonb_typeof(body) = 'object'
  AND (${CRED_USER} IS NOT NULL OR ${CRED_PASS} IS NOT NULL)
`;

// --- Honeytoken replays (scrape -> harvest -> replay attack chain) ----------
// $1 is the array of planted canary values (honeytokens.js). A login attempt
// whose submitted username/password equals one of these proves the attacker
// harvested it from a fake config file first — we never publish these values,
// so they can't be guessed. We also correlate each replay back to whether the
// SAME IP earlier scraped a config-file trap ($2 = those trap types), which
// separates same-host reuse from cross-actor credential sharing.

export const getCanaryReplayStatsQuery = `
WITH matched AS (
    SELECT ip_address, timestamp,
           ${CRED_USER} AS un, ${CRED_PASS} AS pw
    FROM request_tracking
    WHERE jsonb_typeof(body) = 'object'
      AND (${CRED_USER} = ANY($1) OR ${CRED_PASS} = ANY($1))
),
scrapers AS (
    SELECT DISTINCT ip_address
    FROM request_tracking
    WHERE trap_type = ANY($2)
)
SELECT COUNT(*)                                   AS total_replays,
       COUNT(DISTINCT m.ip_address)               AS attacker_ips,
       COUNT(DISTINCT COALESCE(m.pw, m.un))       AS tokens_tripped,
       COUNT(*) FILTER (WHERE s.ip_address IS NOT NULL) AS same_host_chains
FROM matched m
LEFT JOIN scrapers s ON s.ip_address = m.ip_address
`;

// Recent tripwire events for the showcase feed. Each row is one replay of a
// planted credential, with the harvesting correlation and time-to-weaponize.
export const getCanaryReplayEventsQuery = `
WITH matched AS (
    SELECT ip_address, country, timestamp AS replayed_at, trap_type,
           COALESCE(
               (SELECT v FROM unnest($1::text[]) AS v WHERE v = ${CRED_PASS}),
               (SELECT v FROM unnest($1::text[]) AS v WHERE v = ${CRED_USER})
           ) AS token
    FROM request_tracking
    WHERE jsonb_typeof(body) = 'object'
      AND (${CRED_USER} = ANY($1) OR ${CRED_PASS} = ANY($1))
),
scrapes AS (
    SELECT ip_address, MIN(timestamp) AS first_scrape
    FROM request_tracking
    WHERE trap_type = ANY($2)
    GROUP BY ip_address
)
SELECT m.token,
       m.ip_address,
       m.country,
       m.replayed_at,
       m.trap_type AS replayed_via,
       (s.ip_address IS NOT NULL)                                    AS same_ip_scraped,
       s.first_scrape,
       CASE WHEN s.first_scrape IS NOT NULL
            THEN EXTRACT(EPOCH FROM (m.replayed_at - s.first_scrape)) / 3600.0
       END                                                           AS hours_to_weaponize
FROM matched m
LEFT JOIN scrapes s ON s.ip_address = m.ip_address
WHERE m.token IS NOT NULL
ORDER BY m.replayed_at DESC
LIMIT 20
`;
