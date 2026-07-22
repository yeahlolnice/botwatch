import { query } from '../utilities/connectDB.js';
import {
    createDomainsTableQuery,
    createPagesTableQuery,
    createLinksTableQuery,
    createSitemapsTableQuery,
    addDomainAiReadinessColumnsQuery,
    addPageAiReadinessColumnsQuery,
} from '../utilities/sqlCrawlerQuerys.js';
import {
    ensureDomain,
    getDomainStatusCounts,
    getPageStatusCounts,
    getDomainReadinessCounts,
    getPageReadinessCounts,
} from '../crawler/db.js';
import { runCrawler } from '../crawler/runCrawler.js';
import { processNextQueuedSitemap } from '../crawler/processNextQueuedSitemap.js';
import { crawlerEnv } from '../crawler/crawlerEnv.js';
import { parseUrlParts } from '../crawler/urlUtils.js';
import { isHostnameBlocked } from '../crawler/ssrfGuard.js';

// POST /api/crawler/init — create the crawler tables + AI-readiness columns (idempotent)
export const initCrawlerTables = async (req, res) => {
    try {
        await query(createDomainsTableQuery);
        await query(createPagesTableQuery);
        await query(createLinksTableQuery);
        await query(createSitemapsTableQuery);
        await query(addDomainAiReadinessColumnsQuery);
        await query(addPageAiReadinessColumnsQuery);
        return res.json({ message: 'Crawler tables ready' });
    } catch (error) {
        console.error('Crawler init error:', error);
        return res.status(500).json({ error: 'Failed to init crawler tables' });
    }
};

// POST /api/crawler/domains/seed — body: { hostnames: string[] }
export const seedDomains = async (req, res) => {
    const { hostnames } = req.body;

    if (!Array.isArray(hostnames) || hostnames.length === 0) {
        return res.status(400).json({ error: 'hostnames must be a non-empty array' });
    }

    try {
        const seeded = [];
        const rejected = [];

        for (const raw of hostnames) {
            if (typeof raw !== 'string' || !raw.trim()) continue;

            // Accept either a bare hostname or a full URL.
            const parsed = parseUrlParts(raw.includes('://') ? raw : `https://${raw.trim()}`);
            if (!parsed) continue;

            if (await isHostnameBlocked(parsed.hostname)) {
                rejected.push(parsed.hostname);
                continue;
            }

            const domain = await ensureDomain(parsed.hostname);
            seeded.push(domain);
        }

        return res.json({ seededCount: seeded.length, domains: seeded, rejected });
    } catch (error) {
        console.error('Seed domains error:', error);
        return res.status(500).json({ error: 'Failed to seed domains' });
    }
};

// POST /api/crawler/run — body (optional): { maxPagesPerDomain, maxDomainsThisRun }
export const runCrawlBatch = async (req, res) => {
    const maxPagesPerDomain = Number(req.body?.maxPagesPerDomain) || crawlerEnv.crawlerMaxPagesPerDomain;
    const maxDomainsThisRun = Number(req.body?.maxDomainsThisRun) || crawlerEnv.crawlerMaxDomainsPerRun;

    try {
        const result = await runCrawler({ maxPagesPerDomain, maxDomainsThisRun });
        return res.json(result);
    } catch (error) {
        console.error('Run crawler error:', error);
        return res.status(500).json({ error: 'Failed to run crawler batch' });
    }
};

// POST /api/crawler/sitemaps/process — body (optional): { maxSitemapsThisRun }
export const processSitemaps = async (req, res) => {
    const maxSitemapsThisRun = Number(req.body?.maxSitemapsThisRun) || crawlerEnv.crawlerMaxSitemapsPerRun;

    try {
        const results = [];

        for (let i = 0; i < maxSitemapsThisRun; i++) {
            const result = await processNextQueuedSitemap();
            results.push(result);

            if (!result.processed) break;
        }

        return res.json({ ok: true, processedCount: results.filter(r => r.processed).length, results });
    } catch (error) {
        console.error('Process sitemaps error:', error);
        return res.status(500).json({ error: 'Failed to process sitemaps' });
    }
};

// GET /api/crawler/status
export const getCrawlerStatus = async (req, res) => {
    try {
        const [domainStatus, pageStatus, domainReadiness, pageReadiness] = await Promise.all([
            getDomainStatusCounts(),
            getPageStatusCounts(),
            getDomainReadinessCounts(),
            getPageReadinessCounts(),
        ]);

        return res.json({
            domains: { byStatus: domainStatus, readiness: domainReadiness },
            pages: { byStatus: pageStatus, readiness: pageReadiness },
        });
    } catch (error) {
        console.error('Crawler status error:', error);
        return res.status(500).json({ error: 'Failed to fetch crawler status' });
    }
};
