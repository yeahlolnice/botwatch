import { query } from '../utilities/connectDB.js';
import { getFeedQuery, getIpScoreByIpQuery } from '../utilities/sqlModelQuerys.js';
import { getDomainByHostname } from '../crawler/db.js';
import { getLatestDomainEnrichmentQuery } from '../utilities/sqlDomainEnrichmentQuerys.js';

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const IP_PATTERN = /^[0-9a-f:.]{2,45}$/i;

const csvEscape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET /api/v1/feed?minScore=70&format=json|csv — the scored malicious-IP feed.
export const getV1Feed = async (req, res) => {
    try {
        const minScore = Math.min(Math.max(parseInt(req.query.minScore, 10) || 70, 0), 100);
        const format = req.query.format === 'csv' ? 'csv' : 'json';
        const rows = (await query(getFeedQuery, [minScore])).rows;

        if (format === 'csv') {
            const header = 'ip,score,request_count,scored_at,reason';
            const body = rows.map((r) => [r.ip, r.score, r.request_count, r.scored_at?.toISOString?.() || r.scored_at, r.explanation].map(csvEscape).join(',')).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="botwatch-threat-feed.csv"');
            return res.send(`${header}\n${body}\n`);
        }

        return res.json({
            generatedAt: new Date().toISOString(),
            minScore,
            count: rows.length,
            feed: rows.map((r) => ({ ip: r.ip, score: r.score, requestCount: r.request_count, reason: r.explanation, scoredAt: r.scored_at })),
        });
    } catch (error) {
        console.error('v1 feed error:', error);
        return res.status(500).json({ error: 'Failed to build feed' });
    }
};

// GET /api/v1/ip/:ip — risk score + reason for one IP.
export const getV1Ip = async (req, res) => {
    const ip = (req.params.ip || '').trim();
    if (!IP_PATTERN.test(ip)) return res.status(400).json({ error: 'Invalid IP address' });

    try {
        const row = (await query(getIpScoreByIpQuery, [ip])).rows[0];
        if (!row) return res.json({ found: false, ip });
        return res.json({
            found: true,
            ip: row.ip,
            score: row.score,
            reason: row.explanation,
            requestCount: row.request_count,
            scoredAt: row.scored_at,
        });
    } catch (error) {
        console.error('v1 ip error:', error);
        return res.status(500).json({ error: 'Failed to look up IP' });
    }
};

// GET /api/v1/domain/:hostname — the passive-enrichment dossier for a domain.
export const getV1Domain = async (req, res) => {
    const hostname = (req.params.hostname || '').trim().toLowerCase().replace(/\.+$/, '');
    if (!HOSTNAME_PATTERN.test(hostname)) return res.status(400).json({ error: 'Invalid hostname' });

    try {
        const domain = await getDomainByHostname(hostname);
        if (!domain) return res.json({ found: false, hostname });

        const enr = (await query(getLatestDomainEnrichmentQuery, [domain.id])).rows[0] || null;
        return res.json({
            found: true,
            hostname,
            category: domain.category,
            aiReadinessScore: domain.ai_readiness_score,
            enrichment: enr && {
                collectedAt: enr.collected_at,
                dns: enr.dns,
                whois: enr.whois,
                emailPosture: enr.email_posture,
                tls: enr.tls,
                securityHeaders: enr.security_headers,
                hosting: enr.hosting,
                reputation: enr.reputation,
                subdomains: enr.subdomains,
            },
        });
    } catch (error) {
        console.error('v1 domain error:', error);
        return res.status(500).json({ error: 'Failed to fetch domain' });
    }
};
