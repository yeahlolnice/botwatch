import { fetchSitemapXml, extractUrlsFromSitemapXml } from './sitemapFetcher.js';
import { parseUrlParts } from './urlUtils.js';
import { ensureDomain, ensurePage, ensureSitemap, markSitemapAsFetched } from './db.js';
import { isHostnameBlocked } from './ssrfGuard.js';

function looksLikeSitemapUrl(url) {
    const lower = url.toLowerCase();

    return (
        lower.endsWith('sitemap.xml')
    );
}

export async function importSitemapPages(sitemap) {
    const fetchResult = await fetchSitemapXml(sitemap.url);

    if (!fetchResult.ok) {
        return {
            ok: false,
            sitemap,
            fetchResult,
            importedPages: [],
            discoveredSitemaps: []
        };
    }

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

        if (looksLikeSitemapUrl(parsed.fullUrl)) {
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
