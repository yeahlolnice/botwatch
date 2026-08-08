import { parseUrlParts, resolveUrl } from './urlUtils.js';
import { fetchPage } from './pageFetcher.js';
import { fetchRobotsTxt } from './robotsFetcher.js';
import { getAiTrainingPolicy } from './aiTrainingPolicy.js';
import { parsePage } from './linkExtractor.js';
import { checkLlmsTxtForDomain, checkAiTxtForDomain } from './aiReadiness.js';
import { looksLikeTermsPath } from './termsLinkDetector.js';
import { isHostnameBlocked } from './ssrfGuard.js';
import { assessReadiness } from './readinessAssessment.js';

// Fast, homepage-only readiness scan for the FREE teaser. The paid report runs a
// full multi-page crawl + full enrichment; this is a quick snapshot of just the
// homepage plus the well-known files (robots.txt, llms.txt, ai.txt). Every fetch
// is isolated so one failure (e.g. no llms.txt) never sinks the whole scan.
export async function quickReadinessScan(rawUrl) {
    const parsed = parseUrlParts(rawUrl);
    if (!parsed) throw new Error('Enter a valid website URL');
    if (await isHostnameBlocked(parsed.hostname)) throw new Error('That host cannot be scanned');

    const [homepage, robots, llms, aiTxt] = await Promise.all([
        fetchPage(parsed.fullUrl).catch(() => ({ ok: false })),
        fetchRobotsTxt(parsed.hostname).catch(() => ({ ok: false, body: null })),
        checkLlmsTxtForDomain(parsed.hostname).catch(() => ({ found: false })),
        checkAiTxtForDomain(parsed.hostname).catch(() => ({ found: false })),
    ]);

    let jsonLdFound = false;
    let webmcp = null;
    let termsUrl = null;
    if (homepage.ok && homepage.isHtml && homepage.html) {
        const page = parsePage(homepage.html);
        jsonLdFound = page.jsonLd?.found || false;
        webmcp = page.webmcp || null;
        for (const href of page.links || []) {
            const r = resolveUrl(href, parsed.fullUrl);
            if (r && r.hostname === parsed.hostname && looksLikeTermsPath(r.path)) {
                termsUrl = r.fullUrl;
                break;
            }
        }
    }

    const hasExplicitPolicy = robots?.body ? getAiTrainingPolicy(robots.body).hasExplicitPolicy : false;

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
        reachable: !!(homepage.ok && homepage.isHtml),
        assessment,
        webmcpToolCount: webmcp?.declarative?.count || 0,
    };
}
