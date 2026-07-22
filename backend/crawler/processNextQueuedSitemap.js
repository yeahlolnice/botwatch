import { getNextQueuedSitemap } from './db.js';
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

    const result = await importSitemapPages(sitemap);

    return {
        ok: true,
        processed: true,
        sitemap,
        result
    };
}
