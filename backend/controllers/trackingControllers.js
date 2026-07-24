import jwt from 'jsonwebtoken';
import { query } from "../utilities/connectDB.js";
import { classifyUserAgent } from "../utilities/botClassifier.js";
import { analyzeRequest } from "../utilities/payloadAnalyzer.js";
import {
    createRequestTrackingTableQuery,
    migrateTrackingTableQuery,
    insertRequestQuery,
    getRecentRequestsQuery,
    getRequestCountQuery,
    getTrafficStatsQuery,
    getTopUserAgentsQuery,
    getMethodBreakdownQuery,
    getStatusBreakdownQuery,
    getThreatBreakdownQuery,
    getHoneypotHitsQuery,
    getTopAttackingIPsQuery,
} from "../utilities/sqlTrackingQuerys.js";

// Middleware — registers a finish listener so status code + timing are captured
// after the response is sent. Non-blocking: errors here never affect the response.
const trackRequest = (req, res, next) => {
    const startTime = Date.now();

    // Skip tracking authenticated sessions — no point recording your own browsing
    const token = req.cookies?.auth_token;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return next();
        } catch {
            // Invalid/expired token — treat as unauthenticated and track normally
        }
    }

    // Run payload analysis synchronously before next() so req.threatAnalysis
    // is available to honeypot handlers if they want to read it
    const { signals, threatScore } = analyzeRequest(req);
    req.threatAnalysis = { signals, threatScore };

    res.on('finish', async () => {
        try {
            const responseTime = Date.now() - startTime;

            const { method, query: queryParams, headers, body } = req;
            // req.path strips the mount prefix (e.g. /api/traffic → /); originalUrl preserves it
            const path = req.originalUrl.split('?')[0];
            const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

            // IP resolution — CF-Connecting-IP is the verified real client IP
            // when behind a Cloudflare tunnel. Fall back through the chain.
            const cfConnectingIp = headers['cf-connecting-ip'] || null;
            const xForwardedFor = headers['x-forwarded-for'] || null;
            const realIp = headers['x-real-ip'] || null;
            const ipAddress = cfConnectingIp
                || realIp
                || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null)
                || req.ip
                || null;

            const userAgent = headers['user-agent'] || null;
            const referrer = req.get('Referrer') || null;

            const acceptLanguage = headers['accept-language'] || null;
            const acceptEncoding = headers['accept-encoding'] || null;
            const secChUa = headers['sec-ch-ua'] || null;
            const secFetchSite = headers['sec-fetch-site'] || null;
            const secFetchMode = headers['sec-fetch-mode'] || null;
            const secFetchDest = headers['sec-fetch-dest'] || null;

            // Store raw cookie header — could contain stolen/replayed session tokens
            const cookieHeader = headers['cookie'] || null;

            const sessionId = req.cookies?.['session_id'] || null;
            const visitorId = req.cookies?.['visitor_id'] || null;

            const jsEnabled = headers['sec-ch-ua'] ? true : null;
            const screenWidth = headers['sec-ch-viewport-width']
                ? parseInt(headers['sec-ch-viewport-width'])
                : null;
            const timezone = headers['sec-ch-ua-timezone'] || null;

            const { label: botLabel, type: crawlerType } = classifyUserAgent(userAgent);

            // Honeypot fields — set by honeypot route handlers on req
            const isTrap = req.isTrap || false;
            const trapType = req.trapType || null;

            // Store ALL headers including authorization — raw forensic value
            const allHeaders = { ...headers };

            // Parsed body only when it's a JSON/form object or a string — never a
            // raw Buffer (unparsed content types arrive as a Buffer and are
            // captured verbatim in raw_body instead).
            const parsedBody = body && !Buffer.isBuffer(body)
                && (typeof body === 'string' ? body.length : Object.keys(body).length)
                ? JSON.stringify(body) : null;

            // Verbatim raw body — captured in server.js for EVERY content type,
            // capped and flagged there. This is the ground truth of exactly what
            // was sent, which is where novel/odd exploit payloads show up.
            const rawBody = req.rawBody || null;
            const rawBodyBytes = req.rawBodyBytes ?? null;
            const rawBodyTruncated = req.rawBodyTruncated ?? false;

            await query(insertRequestQuery, [
                method, path, fullUrl,
                Object.keys(queryParams).length ? JSON.stringify(queryParams) : null,
                res.statusCode, responseTime,
                ipAddress, xForwardedFor, cfConnectingIp, realIp,
                userAgent, referrer,
                JSON.stringify(allHeaders),
                cookieHeader ? JSON.stringify({ raw: cookieHeader }) : null,
                parsedBody,
                rawBody, rawBodyBytes, rawBodyTruncated,
                sessionId, visitorId,
                acceptLanguage, acceptEncoding, secChUa, secFetchSite, secFetchMode, secFetchDest,
                isTrap, trapType, threatScore, botLabel, crawlerType,
                signals.length ? JSON.stringify(signals) : null,
                jsEnabled, screenWidth, null, timezone,
                // Country from Cloudflare header — free, no API needed
                headers['cf-ipcountry'] || null,
                null, null, null, null, // region, city, asn, provider — reserved for enrichment
            ]);
        } catch (error) {
            console.error('Tracking error:', error.message);
        }
    });

    next();
};

// GET /api/traffic — paginated + filtered list of requests
const getRecentRequests = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;

        // Build WHERE clauses dynamically from query params
        const conditions = [];
        const params = [];

        const search = req.query.search?.trim();
        if (search) {
            params.push(`%${search}%`);
            const n = params.length;
            conditions.push(`(
                path ILIKE $${n} OR
                ip_address::text ILIKE $${n} OR
                cf_connecting_ip::text ILIKE $${n} OR
                user_agent ILIKE $${n} OR
                bot_label ILIKE $${n} OR
                trap_type ILIKE $${n} OR
                country ILIKE $${n}
            )`);
        }

        if (req.query.method && req.query.method !== 'ALL') {
            params.push(req.query.method.toUpperCase());
            conditions.push(`method = $${params.length}`);
        }

        if (req.query.threat === 'true') {
            conditions.push(`threat_signals IS NOT NULL AND jsonb_array_length(threat_signals) > 0`);
        }

        if (req.query.trap === 'true') {
            conditions.push(`is_trap = TRUE`);
        }

        if (req.query.country) {
            params.push(req.query.country);
            conditions.push(`country ILIKE $${params.length}`);
        }

        if (req.query.minScore) {
            params.push(parseInt(req.query.minScore));
            conditions.push(`bot_score >= $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const dataParams = [...params, limit, offset];
        const countParams = [...params];

        const dataQuery = `
            SELECT
                id, request_id, timestamp,
                method, path, full_url, query_params,
                status_code, response_time_ms,
                ip_address, x_forwarded_for, cf_connecting_ip,
                user_agent, referrer,
                bot_label, crawler_type, bot_score,
                is_trap, trap_type,
                threat_signals,
                accept_language, sec_fetch_site, sec_fetch_mode,
                country
            FROM request_tracking
            ${where}
            ORDER BY timestamp DESC
            LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
        `;

        const countQuery = `SELECT COUNT(*) AS total FROM request_tracking ${where}`;

        const [rows, countResult] = await Promise.all([
            query(dataQuery, dataParams),
            query(countQuery, countParams),
        ]);

        res.json({
            data: rows.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                page,
                limit,
                pages: Math.ceil(countResult.rows[0].total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching traffic:', error);
        res.status(500).json({ error: 'Failed to fetch traffic data' });
    }
};

// GET /api/traffic/stats — summary stats for dashboard
const getTrafficStats = async (req, res) => {
    try {
        const [stats, topAgents, methods, statuses, threats, honeypots, attackers] = await Promise.all([
            query(getTrafficStatsQuery),
            query(getTopUserAgentsQuery, [20]),
            query(getMethodBreakdownQuery),
            query(getStatusBreakdownQuery),
            query(getThreatBreakdownQuery),
            query(getHoneypotHitsQuery),
            query(getTopAttackingIPsQuery, [20]),
        ]);

        res.json({
            summary: stats.rows[0],
            topUserAgents: topAgents.rows,
            methodBreakdown: methods.rows,
            statusBreakdown: statuses.rows,
            threatBreakdown: threats.rows,
            honeypotHits: honeypots.rows,
            topAttackingIPs: attackers.rows,
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

// GET /api/traffic/db-init — create/migrate tracking table
const createTrackingTable = async (req, res) => {
    try {
        await query(createRequestTrackingTableQuery);
        await query(migrateTrackingTableQuery);
        res.json({ message: 'Tracking table ready' });
    } catch (error) {
        console.error('Error initialising tracking table:', error);
        res.status(500).json({ error: 'Failed to initialise tracking table' });
    }
};

export { trackRequest, getRecentRequests, getTrafficStats, createTrackingTable };
