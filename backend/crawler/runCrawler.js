import {
    getNextQueuedDomain,
    markDomainAsCrawling,
    markDomainAsDone,
    markDomainAsError
} from './db.js';
import { crawlDomainLoop } from './crawlDomainLoop.js';

// Processes queued domains one at a time (no concurrency) — called from the
// admin-triggered POST /api/crawler/run route today. To eventually run this
// continuously and non-intrusively, call it on an interval (e.g. from
// server.js) rather than switching to concurrent domain processing, which
// would undermine the per-domain politeness delay in crawlDomainLoop.
export async function runCrawler({ maxPagesPerDomain = 10, maxDomainsThisRun = 10 } = {}) {
    const domainResults = [];
    let domainsProcessed = 0;

    while (domainsProcessed < maxDomainsThisRun) {
        const nextDomain = await getNextQueuedDomain();

        if (!nextDomain) {
            return {
                ok: true,
                stoppedReason: 'No queued domains left',
                domainsProcessed,
                domainResults
            };
        }

        let activeDomain = null;

        try {
            activeDomain = await markDomainAsCrawling(nextDomain.id);

            const crawlResult = await crawlDomainLoop(activeDomain, maxPagesPerDomain);

            const doneDomain = await markDomainAsDone(activeDomain.id);

            domainResults.push({
                ok: true,
                domain: doneDomain,
                crawlResult
            });
        } catch (error) {
            console.error(`Domain crawl failed for ${nextDomain.hostname}:`, error);

            const erroredDomain = await markDomainAsError(nextDomain.id);

            domainResults.push({
                ok: false,
                domain: erroredDomain,
                error: String(error.message || error)
            });
        }

        domainsProcessed += 1;
    }

    return {
        ok: true,
        stoppedReason: 'Reached max domains for this run',
        domainsProcessed,
        domainResults
    };
}
