import { getNextQueuedPageForDomain, incrementPagesCrawledCount } from './db.js';
import { seedDomainHomepage } from './seedDomainHomepage.js';
import { crawlPage } from './crawlPage.js';
import { isHostnameBlocked } from './ssrfGuard.js';

export async function crawlNextPageForDomain(domain) {
    if (await isHostnameBlocked(domain.hostname)) {
        throw new Error(`Refusing to crawl ${domain.hostname}: resolves to a private/internal address`);
    }

    await seedDomainHomepage(domain);

    const nextPage = await getNextQueuedPageForDomain(domain.id);

    if (!nextPage) {
        return {
            ok: true,
            message: 'No queued pages for this domain',
            domain,
            crawled: false
        };
    }

    const crawlResult = await crawlPage(nextPage.url);
    const updatedDomain = await incrementPagesCrawledCount(domain.id);

    return {
        ok: true,
        crawled: true,
        domain: updatedDomain,
        page: nextPage,
        crawlResult
    };
}
