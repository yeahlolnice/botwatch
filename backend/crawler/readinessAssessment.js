// AI-readiness gap analysis — "what you have / what's missing / how to fix it".
//
// Deliberately a GAP ANALYSIS, not a fixed weighted score: the precise weighted
// rubric is a Phase-4 product decision that's intentionally still open. This
// groups the signals the crawler already collects into the two readiness
// pillars and, for each, reports present/absent + a recommendation when absent.
// Reused by the free teaser, the paid report, and the API.
//   • Legibility   — can agents READ & understand the site (llms.txt, JSON-LD…)
//   • Actionability — can agents ACT on the site (WebMCP tools)

const mkCheck = (id, label, present, recommendation) => ({
    id,
    label,
    present: !!present,
    recommendation: present ? null : recommendation,
});

// domain: the domains row. jsonLdFound: whether any crawled page has JSON-LD.
// webmcp: an aggregated WebMCP result across the site's pages (or a single
// page's result), shaped like crawler/webmcpDetector.js output.
export function assessReadiness({ domain = {}, jsonLdFound = false, webmcp = null } = {}) {
    const legibility = [
        mkCheck('llms_txt', 'llms.txt', domain.llms_txt_found,
            'Add an /llms.txt at your root — a curated, LLM-friendly index of your key content.'),
        mkCheck('ai_txt', 'ai.txt', domain.ai_txt_found,
            'Add an /ai.txt to declare AI-specific usage policy for your site.'),
        mkCheck('json_ld', 'Structured data (JSON-LD)', jsonLdFound,
            'Embed schema.org JSON-LD so agents can parse your entities (org, products, articles).'),
        mkCheck('ai_policy', 'Explicit AI-crawler policy', domain.ai_training_policy_explicit,
            'Declare an explicit AI-crawler policy in robots.txt (allow/deny named AI bots).'),
        mkCheck('terms', 'Published terms link', !!domain.terms_url,
            'Publish and link a clear terms page so agents know your usage terms.'),
    ];

    const wm = webmcp || {};
    const toolCount = wm.declarative?.count || 0;
    const usesImperative = !!wm.imperative?.detected;
    const violations = wm.bestPractice?.violations?.length || 0;
    const hasTools = toolCount > 0 || usesImperative;

    const actionability = [
        mkCheck('webmcp_tools', 'WebMCP tools exposed to agents', hasTools,
            'Expose WebMCP tools so agents can reliably act (search, book, checkout) instead of guessing at your UI. See developer.chrome.com/docs/ai/webmcp.'),
        mkCheck('webmcp_declarative', 'Key forms are agent-callable', toolCount > 0,
            'Annotate important forms with toolname/tooldescription to turn them into agent-callable tools.'),
        // Best-practice check only applies once tools exist; otherwise it's N/A
        // (the "expose tools" recommendation above already covers the gap).
        toolCount > 0
            ? mkCheck('webmcp_bestpractice', 'Tool declarations follow best practices', violations === 0,
                'Tighten tool names/descriptions to WebMCP character budgets and add parameter descriptions.')
            : { id: 'webmcp_bestpractice', label: 'Tool declarations follow best practices', present: false, notApplicable: true, recommendation: null },
    ];

    const summarize = (checks) => ({
        present: checks.filter((c) => c.present).length,
        total: checks.filter((c) => !c.notApplicable).length,
        checks,
    });

    // A coarse, clearly-indicative band only — NOT the final weighted score.
    const all = [...legibility, ...actionability].filter((c) => !c.notApplicable);
    const ratio = all.length ? all.filter((c) => c.present).length / all.length : 0;
    const band = ratio >= 0.75 ? 'Strong' : ratio >= 0.4 ? 'Developing' : 'Emerging';

    return {
        band,
        legibility: summarize(legibility),
        actionability: summarize(actionability),
        recommendations: all.filter((c) => !c.present && c.recommendation).map((c) => ({ id: c.id, recommendation: c.recommendation })),
    };
}
