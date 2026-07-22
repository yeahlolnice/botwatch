import { fetchRobotsTxt } from './robotsFetcher.js';
import { checkSitemapUrl } from './sitemapFetcher.js';
import { checkLlmsTxtForDomain, checkAiTxtForDomain, checkHumansTxtForDomain } from './aiReadiness.js';
import { getAiTrainingPolicy } from './aiTrainingPolicy.js';
import { recomputeAndStoreDomainScore } from './aiReadinessScore.js';
import {
    ensureSitemap,
    updateDomainAiReadiness,
    updateDomainRobotsTxtFound,
    updateDomainAiTxt,
    updateDomainHumansTxt,
    updateDomainAiTrainingPolicy,
} from './db.js';
import { isHostnameBlocked } from './ssrfGuard.js';
import { parseUrlParts } from './urlUtils.js';
import {
    getCachedSitemapDiscovery,
    setCachedSitemapDiscovery
} from './sitemapDiscoveryCache.js';

// Runs once per domain (cached), alongside sitemap discovery: checks robots.txt/sitemaps
// as before, plus /llms.txt, /ai.txt, /humans.txt, and the domain's AI
// training policy (derived from the robots.txt already fetched here — no
// extra request) as AI-readiness signals for the domain.
export async function discoverSitemapsForDomain(domain) {
    const cachedResult = getCachedSitemapDiscovery(domain.hostname);

    if (cachedResult) {
        return cachedResult;
    }

    const robotsResult = await fetchRobotsTxt(domain.hostname);
    await updateDomainRobotsTxtFound(domain.id, robotsResult.ok);

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

    const [llmsTxtResult, aiTxtResult, humansTxtResult] = await Promise.all([
        checkLlmsTxtForDomain(domain.hostname),
        checkAiTxtForDomain(domain.hostname),
        checkHumansTxtForDomain(domain.hostname),
    ]);

    await updateDomainAiReadiness(domain.id, llmsTxtResult);
    await updateDomainAiTxt(domain.id, aiTxtResult.found);
    await updateDomainHumansTxt(domain.id, humansTxtResult.found);

    const { policy: aiTrainingPolicy, hasExplicitPolicy } = getAiTrainingPolicy(robotsResult.body);
    await updateDomainAiTrainingPolicy(domain.id, aiTrainingPolicy, hasExplicitPolicy);

    await recomputeAndStoreDomainScore(domain.id, domain.hostname);

    const result = {
        robotsResult,
        sitemapUrls: uniqueSitemapUrls,
        savedSitemaps,
        llmsTxtResult,
        aiTxtResult,
        humansTxtResult,
        aiTrainingPolicy
    };

    setCachedSitemapDiscovery(domain.hostname, result);

    return result;
}
