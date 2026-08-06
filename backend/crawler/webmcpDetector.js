// WebMCP detection — an "agent-actionability" readiness signal.
//
// WebMCP (a proposed Chrome web standard, developer.chrome.com/docs/ai/webmcp)
// lets a site expose structured tools that AI agents can call, instead of the
// agent blindly clicking around the DOM. We detect two flavours from crawled
// HTML:
//   • Declarative API — <form toolname tooldescription> annotations. Fully
//     detectable from static HTML (this is the reliable signal).
//   • Imperative API — document.modelContext.registerTool(...) in JavaScript.
//     We can only *heuristically* flag that it's used (from inline scripts /
//     markup); enumerating imperative tools would require executing the page's
//     JS in a headless browser, which the fetch+cheerio crawler doesn't do.
//
// Best-practice character budgets come from the WebMCP security guidance and are
// recorded as advisory violations for the readiness grade (built later).

const NAME_MAX = 30;
const DESC_MAX = 500;
const PARAM_DESC_MAX = 150;

// Identifiers that indicate imperative WebMCP usage in inline JS / markup.
const IMPERATIVE_MARKERS = ['modelContext', 'registerTool', 'useWebMCP', 'usewebmcp'];

export function detectWebMCP($, html = '') {
    const tools = [];
    const violations = [];

    // --- Declarative tools: forms annotated with toolname/tooldescription ---
    $('form[toolname]').each((_i, el) => {
        const $form = $(el);
        const name = ($form.attr('toolname') || '').trim();
        if (!name) return; // toolname is what registers the tool
        const description = ($form.attr('tooldescription') || '').trim();
        const autosubmit = $form.attr('toolautosubmit') !== undefined;

        const $fields = $form.find('input[name], select[name], textarea[name]');
        let describedParams = 0;
        $fields.each((_j, f) => {
            const pd = ($(f).attr('toolparamdescription') || '').trim();
            if (!pd) return;
            describedParams += 1;
            if (pd.length > PARAM_DESC_MAX) {
                violations.push(`param description over ${PARAM_DESC_MAX} chars in "${name}"`);
            }
        });

        tools.push({
            name,
            description: description || null,
            autosubmit,
            fieldCount: $fields.length,
            describedParams,
        });

        // Advisory best-practice checks (WebMCP char budgets + required desc).
        if (name.length > NAME_MAX) violations.push(`tool name "${name}" over ${NAME_MAX} chars`);
        if (!description) violations.push(`tool "${name}" has no tooldescription`);
        else if (description.length > DESC_MAX) violations.push(`tool "${name}" description over ${DESC_MAX} chars`);
    });

    // --- Imperative API usage (heuristic: inline JS / markup only) ---
    const markers = IMPERATIVE_MARKERS.filter((m) => html.includes(m));

    // --- Cross-origin tool delegation via the `tools` permissions policy ---
    let iframeToolsAllowed = false;
    $('iframe[allow]').each((_i, el) => {
        if (/\btools\b/.test(($(el).attr('allow') || '').toLowerCase())) iframeToolsAllowed = true;
    });

    const present = tools.length > 0 || markers.length > 0 || iframeToolsAllowed;

    return {
        present,
        declarative: { count: tools.length, tools },
        imperative: { detected: markers.length > 0, markers },
        iframeToolsAllowed,
        bestPractice: { violations },
    };
}
