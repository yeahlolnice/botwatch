import { parseUrlParts, resolveUrl } from './urlUtils.js';
import { fetchPage } from './pageFetcher.js';
import { extractLinks, extractJsonLd } from './linkExtractor.js';
import { checkRobotsForUrl } from './checkRobotsForUrl.js';
import { isHostnameBlocked } from './ssrfGuard.js';
import {
    ensureDomain,
    ensurePage,
    markPageAsCrawled,
    markPageAsSkipped,
    updatePageAiReadiness,
    ensureLink,
} from './db.js';

export async function crawlPage(rawUrl) {
    const parsed = parseUrlParts(rawUrl);

    if (!parsed) {
        throw new Error('Invalid URL');
    }

    const domain = await ensureDomain(parsed.hostname);

    const page = await ensurePage({
        domainId: domain.id,
        url: parsed.fullUrl,
        path: parsed.path,
        depth: 0
    });

    const robotsCheck = await checkRobotsForUrl(parsed.fullUrl);

    if (!robotsCheck.allowed) {
        return {
            domain,
            page,
            blockedByRobots: true,
            robotsCheck,
            rawLinks: [],
            discoveredLinks: [],
            discoveredDomains: [],
            discoveredPages: [],
            savedLinks: [],
            linksFound: 0
        };
    }

    const fetchResult = await fetchPage(parsed.fullUrl);

    if (!fetchResult.ok || !fetchResult.isHtml) {
        const skippedPage = await markPageAsSkipped(page.id);

        return {
            domain,
            page: skippedPage || page,
            blockedByRobots: false,
            robotsCheck,
            fetchResult,
            rawLinks: [],
            discoveredLinks: [],
            discoveredDomains: [],
            discoveredPages: [],
            savedLinks: [],
            linksFound: 0
        };
    }

    const jsonLdResult = extractJsonLd(fetchResult.html);
    await updatePageAiReadiness(page.id, jsonLdResult);

    const rawLinks = extractLinks(fetchResult.html);
    const discoveredLinks = [];
    const discoveredDomainsMap = new Map();
    const discoveredPagesMap = new Map();
    const savedLinksMap = new Map();

    for (const rawHref of rawLinks) {
        const resolved = resolveUrl(rawHref, parsed.fullUrl);

        if (!resolved) {
            continue;
        }

        // Never queue a link-discovered host that points at a private/internal
        // address — this is untrusted content from whatever page we just crawled.
        if (await isHostnameBlocked(resolved.hostname)) {
            continue;
        }

        discoveredLinks.push(resolved);

        const discoveredDomain = await ensureDomain(resolved.hostname);
        discoveredDomainsMap.set(discoveredDomain.hostname, discoveredDomain);

        const discoveredPage = await ensurePage({
            domainId: discoveredDomain.id,
            url: resolved.fullUrl,
            path: resolved.path,
            depth: 1
        });

        discoveredPagesMap.set(discoveredPage.url, discoveredPage);

        const savedLink = await ensureLink({
            sourcePageId: page.id,
            targetPageId: discoveredPage.id
        });

        if (savedLink) {
            const key = `${savedLink.source_page_id}-${savedLink.target_page_id}`;
            savedLinksMap.set(key, savedLink);
        }
    }

    const crawledPage = await markPageAsCrawled(page.id);

    const discoveredDomains = Array.from(discoveredDomainsMap.values());
    const discoveredPages = Array.from(discoveredPagesMap.values());
    const savedLinks = Array.from(savedLinksMap.values());

    return {
        domain,
        page: crawledPage || page,
        blockedByRobots: false,
        robotsCheck,
        jsonLdResult,
        rawLinks,
        discoveredLinks,
        discoveredDomains,
        discoveredPages,
        savedLinks,
        linksFound: discoveredLinks.length
    };
}
