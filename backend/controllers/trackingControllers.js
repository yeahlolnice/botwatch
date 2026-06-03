import { query } from "../utilities/connectDB.js";

import { createRequestTrackingTableQuery, insertRequestQuery } from "../utilities/sqlTrackingQuerys.js";

// track every single request to the site, login attempts, and API calls 
// this will be used for analytics and security purposes, to detect any suspicious activity and to improve the user experience

const trackRequest = async (req, res, next) => {
    try {
        const { method, path, query: queryParams, headers, cookies, body } = req;
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const ipAddress = req.ip;
        const xForwardedFor = req.headers['x-forwarded-for'] || null;
        const cfConnectingIp = req.headers['cf-connecting-ip'] || null;
        const realIp = req.headers['x-real-ip'] || null;
        const userAgent = req.headers['user-agent'] || null;
        const referrer = req.get('Referrer') || null;
        const acceptLanguage = req.headers['accept-language'] || null;
        const acceptEncoding = req.headers['accept-encoding'] || null;
        const secChUa = req.headers['sec-ch-ua'] || null;
        const secFetchSite = req.headers['sec-fetch-site'] || null;
        const secFetchMode = req.headers['sec-fetch-mode'] || null;
        const secFetchDest = req.headers['sec-fetch-dest'] || null;
        const sessionId = req.cookies['session_id'] || null;
        const visitorId = req.cookies['visitor_id'] || null;
        const jsEnabled = req.headers['sec-ch-ua-mobile'] === '?1' ? false : true;
        const screenWidth = req.headers['sec-ch-ua-width'] ? parseInt(req.headers['sec-ch-ua-width']) : null;
        const screenHeight = req.headers['sec-ch-ua-height'] ? parseInt(req.headers['sec-ch-ua-height']) : null;
        const timezone = req.headers['sec-ch-ua-timezone'] || null;
        // geolocation data can be obtained from the IP address using a third-party service like ipinfo.io or ipstack.com
        // for now we will just store the IP address and use it for geolocation later
        const country = null;
        const region = null;
        const city = null;
        const asn = null;
        const provider = null;
        await query(insertRequestQuery, [
            method, path, fullUrl, queryParams,
            null, null, // status_code and response_time_ms will be updated later in the response middleware 
            ipAddress, xForwardedFor, cfConnectingIp, realIp,
            userAgent, referrer,
            headers, cookies, body,
            sessionId, visitorId,
            acceptLanguage, acceptEncoding, secChUa, secFetchSite, secFetchMode, secFetchDest,
            null, null, null, null, null, // is_trap, trap_type, bot_score, bot_label, crawler_type
            jsEnabled, screenWidth, screenHeight, timezone,
            country, region, city, asn, provider
        ]);
        next();
    } catch (error) {
        console.error('Error tracking request:', error);
        next(); // we don't want to block the request if tracking fails, so we just log the error and continue      
    }
};

const trackLoginAttempt = async (req, res, next) => {

};

const trackAPICall = async (req, res, next) => {

};

const createTrackingTable = async (req, res, next) => {
    try {
        await query(createRequestTrackingTableQuery);
        res.send('Tracking table created successfully');
        console.log('Tracking table created successfully');
    } catch (error) {
        console.error('Error creating tracking table:', error);
        res.status(500).json({ error: 'Failed to create tracking table' });
    }
};

export { trackRequest, trackLoginAttempt, trackAPICall, createTrackingTable };   