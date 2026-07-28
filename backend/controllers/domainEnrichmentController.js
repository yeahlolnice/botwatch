import { query } from '../utilities/connectDB.js';
import { ensureDomain, getDomainByHostname } from '../crawler/db.js';
import { enrichDomain } from '../enrichment/enrichDomain.js';
import {
    insertDomainEnrichmentQuery,
    getLatestDomainEnrichmentQuery,
} from '../utilities/sqlDomainEnrichmentQuerys.js';

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const cleanHostname = (raw) => (raw || '').trim().toLowerCase().replace(/\.+$/, '');
const jsonb = (value) => (value == null ? null : JSON.stringify(value));

// POST /api/enrich/domain  { hostname } — run passive enrichment now and store a
// timestamped snapshot. Admin-only (route is mounted behind requireAdmin).
export const enrichDomainNow = async (req, res) => {
    const hostname = cleanHostname(req.body?.hostname);
    if (!HOSTNAME_PATTERN.test(hostname)) {
        return res.status(400).json({ error: 'Invalid hostname' });
    }

    try {
        const domain = await ensureDomain(hostname);
        const snapshot = await enrichDomain(hostname);

        const inserted = await query(insertDomainEnrichmentQuery, [
            domain.id,
            jsonb(snapshot.dns),
            jsonb(snapshot.whois),
            jsonb(snapshot.emailPosture),
            jsonb(snapshot.tls),
            jsonb(snapshot.securityHeaders),
            jsonb(snapshot.hosting),
            jsonb(snapshot.reputation),
            jsonb(snapshot.subdomains),
        ]);

        return res.json({
            hostname,
            domainId: domain.id,
            snapshotId: inserted.rows[0].id,
            collectedAt: inserted.rows[0].collected_at,
            enrichment: snapshot,
        });
    } catch (error) {
        console.error('Domain enrichment error:', error);
        return res.status(500).json({ error: 'Failed to enrich domain' });
    }
};

// GET /api/enrich/domain/:hostname — latest stored enrichment snapshot.
export const getDomainEnrichment = async (req, res) => {
    const hostname = cleanHostname(req.params.hostname);
    if (!HOSTNAME_PATTERN.test(hostname)) {
        return res.status(400).json({ error: 'Invalid hostname' });
    }

    try {
        const domain = await getDomainByHostname(hostname);
        if (!domain) {
            return res.json({ found: false, hostname });
        }

        const result = await query(getLatestDomainEnrichmentQuery, [domain.id]);
        return res.json({ found: true, hostname, enrichment: result.rows[0] || null });
    } catch (error) {
        console.error('Get domain enrichment error:', error);
        return res.status(500).json({ error: 'Failed to fetch domain enrichment' });
    }
};
