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
export async function runCrawler({ maxPagesPerDomain = 10, maxDomainsThisRun = 10, maxConsecutiveFailures = 3 } = {}) {
    const domainResults = [];
    let domainsProcessed = 0;
    let consecutiveFailures = 0;

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

            consecutiveFailures = 0;
        } catch (error) {
            // Log and move on to the next domain — one bad site (a 502, a
            // timeout, a blocked host) shouldn't derail the whole batch.
            console.error(`Domain crawl failed for ${nextDomain.hostname}:`, error);

            const erroredDomain = await markDomainAsError(nextDomain.id);

            domainResults.push({
                ok: false,
                domain: erroredDomain,
                error: String(error.message || error)
            });

            consecutiveFailures += 1;
            domainsProcessed += 1;

            // ...but if failures are stacking up back to back, something is
            // more likely systemic (network down, DNS broken) than a run of
            // bad luck on individual sites — stop rather than burn through
            // the rest of the queue the same way.
            if (consecutiveFailures >= maxConsecutiveFailures) {
                return {
                    ok: true,
                    stoppedReason: `Stopped after ${consecutiveFailures} consecutive domain failures`,
                    domainsProcessed,
                    domainResults
                };
            }

            continue;
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
