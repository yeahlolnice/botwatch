// Aggregates the schema.org @types a domain publishes across its crawled pages
// (pages.json_ld_types) into a "structured-data depth" view for the company
// profile. Pure — no I/O; rows come from getDomainJsonLdTypesQuery.
//
// Depth = breadth of distinct types. We also check three FOUNDATIONAL types
// that benefit almost any site regardless of what it does, so "present/absent"
// is a fair call rather than a category-specific guess.
const FOUNDATIONAL = ['Organization', 'WebSite', 'BreadcrumbList'];
const MAX_TYPES = 14; // cap the chip list on the page

// Normalises a stored json_ld_types value (JSONB array, or already-parsed
// array) into a clean list of non-empty type strings.
function toTypeList(value) {
    let arr = value;
    if (typeof value === 'string') {
        try { arr = JSON.parse(value); } catch { return []; }
    }
    if (!Array.isArray(arr)) return [];
    return arr.filter((t) => typeof t === 'string' && t.trim());
}

export function buildStructuredDataDepth(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // Count how many pages each type appears on.
    const pageCounts = new Map();
    for (const row of rows) {
        const seen = new Set(toTypeList(row.json_ld_types));
        for (const t of seen) pageCounts.set(t, (pageCounts.get(t) || 0) + 1);
    }
    if (pageCounts.size === 0) return null;

    const types = [...pageCounts.entries()]
        .map(([type, pages]) => ({ type, pages }))
        .sort((a, b) => b.pages - a.pages || a.type.localeCompare(b.type));

    const present = new Set(pageCounts.keys());
    const foundational = FOUNDATIONAL.map((type) => ({ type, present: present.has(type) }));

    return {
        types: types.slice(0, MAX_TYPES),
        distinctCount: types.length,
        overflow: Math.max(0, types.length - MAX_TYPES),
        foundational,
        foundationalPresent: foundational.filter((f) => f.present).length,
    };
}
