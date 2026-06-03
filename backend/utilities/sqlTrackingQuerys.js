

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
    js_enabled, screen_width, screen_height, timezone,
    country, region, city, asn, provider
) VALUES (
    $1, $2, $3, $4,
    $5, $6,
    $7, $8, $9, $10,
    $11, $12,
    $13, $14, $15,
    $16, $17,`;