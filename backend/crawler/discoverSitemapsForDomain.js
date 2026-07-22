import { fetchRobotsTxt } from './robotsFetcher.js';
import { checkSitemapUrl } from './sitemapFetcher.js';
import { checkLlmsTxtForDomain } from './aiReadiness.js';
import { ensureSitemap, updateDomainAiReadiness } from './db.js';
import { isHostnameBlocked } from './ssrfGuard.js';
import { parseUrlParts } from './urlUtils.js';
import {
    getCachedSitemapDiscovery,
    setCachedSitemapDiscovery
} from './sitemapDiscoveryCache.js';

// Runs once per domain (cached), alongside sitemap discovery: checks robots.txt/sitemaps
// as before, and now also checks /llms.txt as an AI-readiness signal for the domain.
export async function discoverSitemapsForDomain(domain) {
    const cachedResult = getCachedSitemapDiscovery(domain.hostname);

    if (cachedResult) {
        return cachedResult;
    }

    const robotsResult = await fetchRobotsTxt(domain.hostname);

    let sitemapUrls = [...robotsResult.sitemapUrls];

    if (sitemapUrls.length === 0) {
        const fallbackCandidates = [
            `https://${domain.hostname}/sitemap.xml`,
            `https://${domain.hostname}/sitemap_index.xml`
        ];

        for (const candidateUrl of fallbackCandidates) {
            const checkResult = await checkSitemapUrl(candidateUrl);

            if (checkResult.ok) {
                sitemapUrls.push(candidateUrl);
            }
        }
    }

    const uniqueSitemapUrls = [...new Set(sitemapUrls)];
    const savedSitemaps = [];

    for (const sitemapUrl of uniqueSitemapUrls) {
        // Sitemap: lines in robots.txt are attacker-influenceable content — a
        // domain's own robots.txt could point anywhere.
        const parsedSitemapUrl = parseUrlParts(sitemapUrl);
        if (!parsedSitemapUrl || await isHostnameBlocked(parsedSitemapUrl.hostname)) {
            continue;
        }

        const sitemap = await ensureSitemap({
            domainId: domain.id,
            url: sitemapUrl
        });

        savedSitemaps.push(sitemap);
    }

    const llmsTxtResult = await checkLlmsTxtForDomain(domain.hostname);
    await updateDomainAiReadiness(domain.id, llmsTxtResult);

    const result = {
        robotsResult,
        sitemapUrls: uniqueSitemapUrls,
        savedSitemaps,
        llmsTxtResult
    };

    setCachedSitemapDiscovery(domain.hostname, result);

    return result;
}
