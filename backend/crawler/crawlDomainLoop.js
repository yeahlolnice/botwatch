import { crawlerEnv } from './crawlerEnv.js';
import { getNextQueuedPageForDomain, incrementPagesCrawledCount } from './db.js';
import { seedDomainHomepage } from './seedDomainHomepage.js';
import { crawlPage } from './crawlPage.js';
import { discoverSitemapsForDomain } from './discoverSitemapsForDomain.js';
import { sleep } from './delay.js';
import { isHostnameBlocked } from './ssrfGuard.js';

export async function crawlDomainLoop(domain, maxPages = 10) {
    // Single choke point per domain, regardless of how it entered the queue
    // (link discovery, sitemap import, or an admin-typed seed) — refuse to
    // touch anything private/internal before any fetch or DB readiness write.
    if (await isHostnameBlocked(domain.hostname)) {
        throw new Error(`Refusing to crawl ${domain.hostname}: resolves to a private/internal address`);
    }

    await seedDomainHomepage(domain);

    const sitemapDiscoveryResult = await discoverSitemapsForDomain(domain);

    const results = [];
    let pagesCrawledThisRun = 0;
    let currentDomain = domain;

    while (pagesCrawledThisRun < maxPages) {
        const nextPage = await getNextQueuedPageForDomain(currentDomain.id);

        if (!nextPage) {
            return {
                ok: true,
                stoppedReason: 'No queued pages left for this domain',
                domain: currentDomain,
                sitemapDiscoveryResult,
                pagesCrawledThisRun,
                results
            };
        }

        // Stay polite — wait between fetches to the same domain.
        if (pagesCrawledThisRun > 0) {
            await sleep(crawlerEnv.crawlerMinDelayMs);
        }

        const crawlResult = await crawlPage(nextPage.url);
        currentDomain = await incrementPagesCrawledCount(currentDomain.id);

        results.push({
            crawledPage: nextPage,
            crawlResult
        });

        pagesCrawledThisRun += 1;
    }

    return {
        ok: true,
        stoppedReason: 'Reached max pages for this run',
        domain: currentDomain,
        sitemapDiscoveryResult,
        pagesCrawledThisRun,
        results
    };
}
