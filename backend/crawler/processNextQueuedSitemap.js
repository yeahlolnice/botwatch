import { getNextQueuedSitemap, markSitemapAsError } from './db.js';
import { importSitemapPages } from './importSitemapPages.js';

export async function processNextQueuedSitemap() {
    const sitemap = await getNextQueuedSitemap();

    if (!sitemap) {
        return {
            ok: true,
            processed: false,
            message: 'No queued sitemaps left'
        };
    }

    try {
        const result = await importSitemapPages(sitemap);

        return {
            ok: true,
            processed: true,
            sitemap,
            result
        };
    } catch (error) {
        // Any failure (SSRF block, timeout, parse error) must still move the
        // sitemap out of the queue — otherwise it blocks the head of the queue
        // and every "Process sitemaps" run spins on it without draining.
        console.error(`Sitemap processing failed for ${sitemap.url}:`, error);
        await markSitemapAsError(sitemap.id);

        return {
            ok: true,
            processed: true,
            sitemap,
            error: String(error.message || error)
        };
    }
}
