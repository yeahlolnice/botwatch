import { parseUrlParts, resolveUrl } from './urlUtils.js';
import { fetchPage } from './pageFetcher.js';
import { fetchRobotsTxt } from './robotsFetcher.js';
import { getAiTrainingPolicy } from './aiTrainingPolicy.js';
import { parsePage } from './linkExtractor.js';
import { checkLlmsTxtForDomain, checkAiTxtForDomain } from './aiReadiness.js';
import { looksLikeTermsPath } from './termsLinkDetector.js';
import { classifyCategory } from './categoryClassifier.js';
import { detectTechStack } from './techStackDetector.js';
import { isHostnameBlocked } from './ssrfGuard.js';
import { recomputeAndStoreDomainScore } from './aiReadinessScore.js';
import { enrichDomain } from '../enrichment/enrichDomain.js';
import { query } from '../utilities/connectDB.js';
import { insertDomainEnrichmentQuery } from '../utilities/sqlDomainEnrichmentQuerys.js';
import {
    ensureDomain,
    ensurePage,
    getDomainByHostname,
    updateDomainAiReadiness,
    updateDomainAiTxt,
    updateDomainAiTrainingPolicy,
    updateDomainRobotsTxtFound,
    updateDomainProfile,
    updatePageAiReadiness,
    updatePageWebmcp,
} from './db.js';

const jsonb = (v) => (v == null ? null : JSON.stringify(v));

// Dedupe concurrent scans for the same host so a stampede runs one scan, and
// bound total on-demand scanning so botwatch can't be turned into a mass fetcher.
const inFlight = new Map();
const MAX_CONCURRENT = 4;
let active = 0;

// Homepage-level scan that PERSISTS into the canonical domain store — domains +
// pages (JSON-LD, WebMCP) + domain_enrichment + ai_readiness_score — so every
// surface (company page, search, feed) reads one source of truth. Reuses the
// crawler's own persistence functions. Homepage-only and fast; deeper coverage
// comes from the admin crawler and paid reports.
export async function scanAndPersistDomain(rawUrl) {
    const parsed = parseUrlParts(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`);
    if (!parsed) throw new Error('Invalid URL');
    const host = parsed.hostname;
    if (await isHostnameBlocked(host)) throw new Error('That host cannot be scanned');

    if (inFlight.has(host)) return inFlight.get(host);
    if (active >= MAX_CONCURRENT) throw new Error('busy'); // caller falls back to the cached/empty view

    active += 1;
    const run = (async () => {
        const domain = await ensureDomain(host);

        const [homepage, robots, llms, aiTxt, enrichment] = await Promise.all([
            fetchPage(parsed.fullUrl).catch(() => ({ ok: false })),
            fetchRobotsTxt(host).catch(() => ({ ok: false, body: null })),
            checkLlmsTxtForDomain(host).catch(() => ({ found: false, content: null })),
            checkAiTxtForDomain(host).catch(() => ({ found: false })),
            enrichDomain(host).catch(() => null),
        ]);

        let jsonLdResult = { found: false, types: [], count: 0 };
        let termsUrl = null;
        if (homepage.ok && homepage.isHtml && homepage.html) {
            const pp = parsePage(homepage.html);
            jsonLdResult = pp.jsonLd || jsonLdResult;
            for (const href of pp.links || []) {
                const r = resolveUrl(href, parsed.fullUrl);
                if (r && r.hostname === host && looksLikeTermsPath(r.path)) { termsUrl = r.fullUrl; break; }
            }
            const page = await ensurePage({ domainId: domain.id, url: parsed.fullUrl, path: parsed.path || '/', depth: 0 });
            await updatePageAiReadiness(page.id, jsonLdResult);
            await updatePageWebmcp(page.id, pp.webmcp || null);
            const techStack = detectTechStack({
                html: homepage.html, scriptSrcs: pp.scriptSrcs, metaGenerator: pp.metaGenerator, techHeaders: homepage.techHeaders,
            });
            await updateDomainProfile(domain.id, { category: classifyCategory(jsonLdResult.types), techStack, termsUrl });
        }

        await updateDomainAiReadiness(domain.id, { found: !!llms.found, content: llms.content || null });
        await updateDomainAiTxt(domain.id, !!aiTxt.found);
        await updateDomainRobotsTxtFound(domain.id, !!robots.ok);
        if (robots?.body) {
            const { policy, hasExplicitPolicy } = getAiTrainingPolicy(robots.body);
            await updateDomainAiTrainingPolicy(domain.id, policy, hasExplicitPolicy);
        }

        if (enrichment) {
            await query(insertDomainEnrichmentQuery, [
                domain.id, jsonb(enrichment.dns), jsonb(enrichment.whois), jsonb(enrichment.emailPosture),
                jsonb(enrichment.tls), jsonb(enrichment.securityHeaders), jsonb(enrichment.hosting),
                jsonb(enrichment.reputation), jsonb(enrichment.subdomains),
            ]).catch((e) => console.error('persist enrichment failed:', e.message));
        }

        // Recompute + store the overall score — this also marks the domain
        // "profiled" (ai_readiness_score set), which is what the surfaces gate on.
        await recomputeAndStoreDomainScore(domain.id, host);

        return getDomainByHostname(host);
    })().finally(() => { active -= 1; inFlight.delete(host); });

    inFlight.set(host, run);
    return run;
}
