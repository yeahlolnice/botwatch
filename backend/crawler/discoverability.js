// Agent/MCP discoverability — can an AI agent arriving at the site find the
// machine-readable entry points it needs to orient and act? Pure derivation
// from signals we already have on the domain + its WebMCP aggregate; no I/O,
// no new storage. Returns a small checklist + present/total.
export function buildDiscoverability({ domain, webmcp, jsonLdFound }) {
    if (!domain) return null;
    const wm = webmcp || {};
    const hasTools = (wm.declarative?.count || 0) > 0 || !!wm.imperative?.detected;

    const checks = [
        { label: 'llms.txt index for agents', present: !!domain.llms_txt_found },
        { label: 'ai.txt usage policy', present: !!domain.ai_txt_found },
        { label: 'robots.txt', present: !!domain.robots_txt_found },
        { label: 'Structured data (JSON-LD)', present: !!jsonLdFound },
        { label: 'Callable WebMCP tools', present: hasTools },
    ];
    return { checks, present: checks.filter((c) => c.present).length, total: checks.length };
}
