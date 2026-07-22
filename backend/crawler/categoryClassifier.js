import { TYPE_TO_CATEGORY } from './categoryMap.js';

// jsonLdTypes: array of @type strings seen across a domain's crawled pages.
// Specific types win over generic ones — a page tagged
// ["LocalBusiness", "Restaurant"] classifies as "Food & Beverage", not
// the generic LocalBusiness fallback.
export function classifyCategory(jsonLdTypes) {
    if (!jsonLdTypes || jsonLdTypes.length === 0) {
        return null;
    }

    for (const type of jsonLdTypes) {
        if (TYPE_TO_CATEGORY[type]) {
            return TYPE_TO_CATEGORY[type];
        }
    }

    if (jsonLdTypes.includes('LocalBusiness')) return 'Local Business';
    if (jsonLdTypes.includes('Organization')) return 'Business/Organization';

    return null;
}
