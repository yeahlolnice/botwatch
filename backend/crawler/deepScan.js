import { parseUrlParts, resolveUrl } from './urlUtils.js';
import { fetchPage } from './pageFetcher.js';
import { fetchRobotsTxt } from './robotsFetcher.js';
import { getAiTrainingPolicy } from './aiTrainingPolicy.js';
import { parsePage } from './linkExtractor.js';
import { checkLlmsTxtForDomain, checkAiTxtForDomain } from './aiReadiness.js';
import { looksLikeTermsPath } from './termsLinkDetector.js';
import { isHostnameBlocked } from './ssrfGuard.js';
import { assessReadiness } from './readinessAssessment.js';
import { enrichDomain } from '../enrichment/enrichDomain.js';
import { sleep } from './delay.js';

// Full readiness scan behind the PAID report — homepage + a capped set of
// internal pages, the well-known files, robots AI policy, and the full passive
// enrichment. Deeper than the free teaser's homepage-only quickScan. Reads only;
// never touches the shared crawl queue.
const MAX_PAGES = 10;
const PAGE_DELAY_MS = 300;

// Merge per-page WebMCP results into one site-wide view.
function aggregateWebmcp(results) {
    const toolsByName = new Map();
    const markers = new Set();
    const violations = new Set();
    let imperative = false;
    let iframe = false;

    for (const wm of results) {
        if (!wm) continue;
        for (const t of wm.declarative?.tools || []) {
            if (!toolsByName.has(t.name)) toolsByName.set(t.name, t);
        }
        if (wm.imperative?.detected) imperative = true;
        for (const m of wm.imperative?.markers || []) markers.add(m);
        if (wm.iframeToolsAllowed) iframe = true;
        for (const v of wm.bestPractice?.violations || []) violations.add(v);
    }

    const tools = [...toolsByName.values()];
    return {
        present: tools.length > 0 || imperative || iframe,
        declarative: { count: tools.length, tools },
        imperative: { detected: imperative, markers: [...markers] },
        iframeToolsAllowed: iframe,
        bestPractice: { violations: [...violations] },
    };
}

export async function deepReadinessScan(rawUrl, { maxPages = MAX_PAGES } = {}) {
    const parsed = parseUrlParts(rawUrl);
    if (!parsed) throw new Error('Invalid URL');
    if (await isHostnameBlocked(parsed.hostname)) throw new Error('That host cannot be scanned');

    // Well-known files + robots + full enrichment run alongside the homepage.
    const [homepage, robots, llms, aiTxt, enrichment] = await Promise.all([
        fetchPage(parsed.fullUrl).catch(() => ({ ok: false })),
        fetchRobotsTxt(parsed.hostname).catch(() => ({ ok: false, body: null })),
        checkLlmsTxtForDomain(parsed.hostname).catch(() => ({ found: false })),
        checkAiTxtForDomain(parsed.hostname).catch(() => ({ found: false })),
        enrichDomain(parsed.hostname).catch(() => null),
    ]);

    const pagesScanned = [];
    const webmcpResults = [];
    let jsonLdFound = false;
    let termsUrl = null;
    const toVisit = [];

    if (homepage.ok && homepage.isHtml && homepage.html) {
        const pp = parsePage(homepage.html);
        pagesScanned.push(parsed.fullUrl);
        webmcpResults.push(pp.webmcp);
        if (pp.jsonLd?.found) jsonLdFound = true;
        for (const href of pp.links || []) {
            const r = resolveUrl(href, parsed.fullUrl);
            if (!r || r.hostname !== parsed.hostname) continue;
            if (!termsUrl && looksLikeTermsPath(r.path)) termsUrl = r.fullUrl;
            if (r.fullUrl !== parsed.fullUrl && !toVisit.includes(r.fullUrl)) toVisit.push(r.fullUrl);
        }
    }

    for (const url of toVisit.slice(0, Math.max(0, maxPages - 1))) {
        await sleep(PAGE_DELAY_MS); // be polite between fetches
        const page = await fetchPage(url).catch(() => ({ ok: false }));
        if (!page.ok || !page.isHtml || !page.html) continue;
        const pp = parsePage(page.html);
        pagesScanned.push(url);
        webmcpResults.push(pp.webmcp);
        if (pp.jsonLd?.found) jsonLdFound = true;
    }

    const hasExplicitPolicy = robots?.body ? getAiTrainingPolicy(robots.body).hasExplicitPolicy : false;
    const webmcp = aggregateWebmcp(webmcpResults);

    const assessment = assessReadiness({
        domain: {
            llms_txt_found: llms.found,
            ai_txt_found: aiTxt.found,
            ai_training_policy_explicit: hasExplicitPolicy,
            terms_url: termsUrl,
        },
        jsonLdFound,
        webmcp,
    });

    return {
        hostname: parsed.hostname,
        scannedAt: new Date().toISOString(),
        reachable: pagesScanned.length > 0,
        pagesScanned,
        signals: {
            llmsTxt: llms.found,
            aiTxt: aiTxt.found,
            aiCrawlerPolicy: hasExplicitPolicy,
            jsonLd: jsonLdFound,
            termsUrl: termsUrl || null,
        },
        assessment,
        webmcp,
        enrichment,
    };
}
