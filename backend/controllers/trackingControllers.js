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

    // Run payload analysis synchronously before next() so req.threatAnalysis
    // is available to honeypot handlers if they want to read it
    const { signals, threatScore } = analyzeRequest(req);
    req.threatAnalysis = { signals, threatScore };

    res.on('finish', async () => {
        try {
            const responseTime = Date.now() - startTime;

            const { method, path, query: queryParams, headers, body } = req;
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

            await query(insertRequestQuery, [
                method, path, fullUrl,
                Object.keys(queryParams).length ? JSON.stringify(queryParams) : null,
                res.statusCode, responseTime,
                ipAddress, xForwardedFor, cfConnectingIp, realIp,
                userAgent, referrer,
                JSON.stringify(allHeaders),
                cookieHeader ? JSON.stringify({ raw: cookieHeader }) : null,
                body && Object.keys(body).length ? JSON.stringify(body) : null,
                sessionId, visitorId,
                acceptLanguage, acceptEncoding, secChUa, secFetchSite, secFetchMode, secFetchDest,
                isTrap, trapType, threatScore, botLabel, crawlerType,
                signals.length ? JSON.stringify(signals) : null,
                jsEnabled, screenWidth, null, timezone,
                null, null, null, null, null, // geo: reserved for future enrichment
            ]);
        } catch (error) {
            console.error('Tracking error:', error.message);
        }
    });

    next();
};

// GET /api/traffic — paginated list of recent requests
const getRecentRequests = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;

        const [rows, countResult] = await Promise.all([
            query(getRecentRequestsQuery, [limit, offset]),
            query(getRequestCountQuery),
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
