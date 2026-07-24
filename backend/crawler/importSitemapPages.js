import { fetchSitemapXml, extractUrlsFromSitemapXml } from './sitemapFetcher.js';
import { parseUrlParts } from './urlUtils.js';
import { ensureDomain, ensurePage, ensureSitemap, markSitemapAsFetched, markSitemapAsError } from './db.js';
import { isHostnameBlocked } from './ssrfGuard.js';

export async function importSitemapPages(sitemap) {
    const fetchResult = await fetchSitemapXml(sitemap.url);

    if (!fetchResult.ok) {
        // Mark it errored so it leaves the queue — otherwise this same
        // unreachable sitemap sits at the head of the queue and blocks every
        // subsequent one from ever being processed.
        await markSitemapAsError(sitemap.id);

        return {
            ok: false,
            sitemap,
            fetchResult,
            importedPages: [],
            discoveredSitemaps: []
        };
    }

    // A <sitemapindex> lists other sitemaps; a <urlset> lists pages. Decide by
    // the document's root element rather than guessing from URL names, so
    // nested sitemaps (sitemap-1.xml, image-sitemap-1.xml, …) are re-queued as
    // sitemaps instead of being imported as junk "pages".
    const isSitemapIndex = /<sitemapindex[\s>]/i.test(fetchResult.xml);

    const extractedUrls = extractUrlsFromSitemapXml(fetchResult.xml);
    const importedPages = [];
    const discoveredSitemaps = [];

    for (const rawUrl of extractedUrls) {
        const parsed = parseUrlParts(rawUrl);

        if (!parsed) {
            continue;
        }

        // <loc> entries come from XML we just fetched from the network — untrusted.
        if (await isHostnameBlocked(parsed.hostname)) {
            continue;
        }

        const domain = await ensureDomain(parsed.hostname);

        if (isSitemapIndex) {
            const discoveredSitemap = await ensureSitemap({
                domainId: domain.id,
                url: parsed.fullUrl
            });

            discoveredSitemaps.push(discoveredSitemap);
            continue;
        }

        const page = await ensurePage({
            domainId: domain.id,
            url: parsed.fullUrl,
            path: parsed.path,
            depth: 0
        });

        importedPages.push(page);
    }

    const updatedSitemap = await markSitemapAsFetched(sitemap.id);

    return {
        ok: true,
        sitemap: updatedSitemap || sitemap,
        extractedCount: extractedUrls.length,
        importedCount: importedPages.length,
        discoveredSitemapsCount: discoveredSitemaps.length,
        importedPages,
        discoveredSitemaps
    };
}
