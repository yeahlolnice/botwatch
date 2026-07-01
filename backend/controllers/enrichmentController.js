import { query } from '../utilities/connectDB.js';
import {
    createEnrichmentTableQuery,
    upsertAbuseIpDbQuery,
    getEnrichmentByIpQuery,
    getReportCandidatesQuery,
} from '../utilities/sqlEnrichmentQuerys.js';

const ABUSEIPDB_BASE = 'https://api.abuseipdb.com/api/v2';
// Cache TTL — don't re-check the same IP within 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getApiKey() {
    const key = process.env.ABUSEIPDB_API_KEY;
    if (!key) throw new Error('ABUSEIPDB_API_KEY is not set in .env');
    return key;
}

// GET /api/enrich/:ip
export const checkIp = async (req, res) => {
    const ip = req.params.ip;

    if (!ip || !/^[\d.a-fA-F:]+$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    try {
        // Return cached result if checked within TTL
        const cached = await query(getEnrichmentByIpQuery, [ip]);
        if (cached.rows.length > 0) {
            const row = cached.rows[0];
            const age = row.abuse_checked_at ? Date.now() - new Date(row.abuse_checked_at) : Infinity;
            if (age < CACHE_TTL_MS) {
                return res.json({ source: 'cache', data: row });
            }
        }

        // Hit AbuseIPDB
        const url = `${ABUSEIPDB_BASE}/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`;
        const response = await fetch(url, {
            headers: {
                Key: getApiKey(),
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: body.errors?.[0]?.detail || 'AbuseIPDB request failed' });
        }

        const { data } = await response.json();

        const row = await query(upsertAbuseIpDbQuery, [
            ip,
            data.abuseConfidenceScore,
            data.totalReports,
            data.lastReportedAt || null,
            data.countryCode || null,
            data.isp || null,
            data.domain || null,
            data.usageType || null,
            data.isTor || false,
            data.isPublic ?? true,
        ]);

        return res.json({ source: 'api', data: row.rows[0] });
    } catch (error) {
        console.error('Enrichment check error:', error);
        return res.status(500).json({ error: error.message || 'Failed to check IP' });
    }
};

// POST /api/enrich/report
export const reportIp = async (req, res) => {
    const { ip, categories, comment } = req.body;

    if (!ip || !categories || !Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: 'ip and categories are required' });
    }

    if (!comment || comment.trim().length < 10) {
        return res.status(400).json({ error: 'Comment must be at least 10 characters' });
    }

    try {
        const body = new URLSearchParams({
            ip,
            categories: categories.join(','),
            comment: comment.trim(),
        });

        const response = await fetch(`${ABUSEIPDB_BASE}/report`, {
            method: 'POST',
            headers: {
                Key: getApiKey(),
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });

        const json = await response.json().catch(() => ({}));

        if (!response.ok) {
            return res.status(response.status).json({ error: json.errors?.[0]?.detail || 'Report failed' });
        }

        // Re-check after reporting so cached data reflects updated score
        await query(
            `UPDATE ip_enrichment SET abuse_checked_at = NULL WHERE ip = $1::inet`,
            [ip]
        );

        return res.status(200).json({ message: `Reported ${ip} successfully`, data: json.data });
    } catch (error) {
        console.error('Enrichment report error:', error);
        return res.status(500).json({ error: error.message || 'Failed to report IP' });
    }
};

// GET /api/enrich/candidates — IPs worth reviewing/reporting
export const getCandidates = async (req, res) => {
    try {
        const result = await query(getReportCandidatesQuery);
        return res.json(result.rows);
    } catch (error) {
        console.error('Candidates error:', error);
        return res.status(500).json({ error: 'Failed to fetch candidates' });
    }
};

// POST /api/enrich/init — create the enrichment table
export const initEnrichmentTable = async (req, res) => {
    try {
        await query(createEnrichmentTableQuery);
        return res.json({ message: 'ip_enrichment table ready' });
    } catch (error) {
        console.error('Enrichment init error:', error);
        return res.status(500).json({ error: 'Failed to init enrichment table' });
    }
};
