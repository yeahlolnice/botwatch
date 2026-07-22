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
import { crawlRunTracker, sitemapRunTracker } from '../crawler/runState.js';

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
// Fire-and-forget: a full batch can take several minutes (many sequential
// fetches with politeness delays), which was long enough to trip the
// reverse proxy's gateway timeout if this route waited for it — the admin
// would see a 502 even though the crawl was working fine server-side. This
// now starts the batch, responds immediately, and the admin UI polls
// GET /api/crawler/status (which includes crawlRunTracker's state) instead.
export const runCrawlBatch = async (req, res) => {
    if (crawlRunTracker.isRunning()) {
        return res.status(409).json({ error: 'A crawl batch is already running' });
    }

    const maxPagesPerDomain = Number(req.body?.maxPagesPerDomain) || crawlerEnv.crawlerMaxPagesPerDomain;
    const maxDomainsThisRun = Number(req.body?.maxDomainsThisRun) || crawlerEnv.crawlerMaxDomainsPerRun;

    crawlRunTracker.start();
    res.status(202).json({ started: true, maxPagesPerDomain, maxDomainsThisRun });

    runCrawler({ maxPagesPerDomain, maxDomainsThisRun })
        .then(result => crawlRunTracker.finish(result))
        .catch(error => {
            console.error('Run crawler error:', error);
            crawlRunTracker.fail(error);
        });
};

// POST /api/crawler/sitemaps/process — body (optional): { maxSitemapsThisRun }
// Same fire-and-forget shape as runCrawlBatch, for the same reason.
export const processSitemaps = async (req, res) => {
    if (sitemapRunTracker.isRunning()) {
        return res.status(409).json({ error: 'Sitemap processing is already running' });
    }

    const maxSitemapsThisRun = Number(req.body?.maxSitemapsThisRun) || crawlerEnv.crawlerMaxSitemapsPerRun;

    sitemapRunTracker.start();
    res.status(202).json({ started: true, maxSitemapsThisRun });

    (async () => {
        const results = [];

        for (let i = 0; i < maxSitemapsThisRun; i++) {
            const result = await processNextQueuedSitemap();
            results.push(result);

            if (!result.processed) break;
        }

        return { ok: true, processedCount: results.filter(r => r.processed).length, results };
    })()
        .then(result => sitemapRunTracker.finish(result))
        .catch(error => {
            console.error('Process sitemaps error:', error);
            sitemapRunTracker.fail(error);
        });
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
            crawl: crawlRunTracker.getState(),
            sitemaps: sitemapRunTracker.getState(),
        });
    } catch (error) {
        console.error('Crawler status error:', error);
        return res.status(500).json({ error: 'Failed to fetch crawler status' });
    }
};
