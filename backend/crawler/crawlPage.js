import { parseUrlParts, resolveUrl } from './urlUtils.js';
import { fetchPage } from './pageFetcher.js';
import { parsePage } from './linkExtractor.js';
import { checkRobotsForUrl } from './checkRobotsForUrl.js';
import { isHostnameBlocked } from './ssrfGuard.js';
import { detectTechStack } from './techStackDetector.js';
import { classifyCategory } from './categoryClassifier.js';
import { extractSocialProfile } from './socialLinks.js';
import { looksLikeTermsPath } from './termsLinkDetector.js';
import { recomputeAndStoreDomainScore } from './aiReadinessScore.js';
import {
    ensureDomain,
    ensurePage,
    markPageAsCrawled,
    markPageAsSkipped,
    updatePageAiReadiness,
    updatePageContent,
    updateDomainProfile,
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

    const {
        links: rawLinks,
        emails: rawEmails,
        phoneNumbers: rawPhoneNumbers,
        jsonLd: jsonLdResult,
        title,
        metaDescription,
        metaGenerator,
        scriptSrcs,
    } = parsePage(fetchResult.html);

    await updatePageAiReadiness(page.id, jsonLdResult);

    const techStack = detectTechStack({
        html: fetchResult.html,
        scriptSrcs,
        metaGenerator,
        techHeaders: fetchResult.techHeaders,
    });
    const category = classifyCategory(jsonLdResult.types);

    const discoveredLinks = [];
    const discoveredDomainsMap = new Map();
    const discoveredPagesMap = new Map();
    const savedLinksMap = new Map();
    const pageSocialLinks = new Set();
    let termsUrl = null;

    for (const rawHref of rawLinks) {
        const resolved = resolveUrl(rawHref, parsed.fullUrl);

        if (!resolved) {
            continue;
        }

        // Only record social profiles that live on a *different* host than the
        // page being crawled — otherwise crawling a social site would harvest
        // every internal handle it links to as if they were this site's own.
        if (resolved.hostname !== parsed.hostname) {
            const socialProfile = extractSocialProfile(resolved.hostname, resolved.path);
            if (socialProfile) {
                pageSocialLinks.add(socialProfile);
            }
        }

        // Only trust a Terms & Conditions link that points back at the same
        // site being crawled, not some other domain's terms page.
        if (!termsUrl && resolved.hostname === parsed.hostname && looksLikeTermsPath(resolved.path)) {
            termsUrl = resolved.fullUrl;
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

    await updatePageContent(page.id, {
        title,
        metaDescription,
        emails: rawEmails,
        phoneNumbers: rawPhoneNumbers,
        socialLinks: [...pageSocialLinks],
    });
    await updateDomainProfile(domain.id, { category, techStack, termsUrl });

    const crawledPage = await markPageAsCrawled(page.id);

    // JSON-LD presence and the terms link above can newly affect the score
    // on any page, not just the domain's homepage — recompute after every crawl.
    await recomputeAndStoreDomainScore(domain.id, domain.hostname);

    const discoveredDomains = Array.from(discoveredDomainsMap.values());
    const discoveredPages = Array.from(discoveredPagesMap.values());
    const savedLinks = Array.from(savedLinksMap.values());

    return {
        domain,
        page: crawledPage || page,
        blockedByRobots: false,
        robotsCheck,
        jsonLdResult,
        techStack,
        category,
        termsUrl,
        rawLinks,
        rawEmails,
        rawPhoneNumbers,
        pageSocialLinks,
        discoveredLinks,
        discoveredDomains,
        discoveredPages,
        savedLinks,
        linksFound: discoveredLinks.length
    };
}
