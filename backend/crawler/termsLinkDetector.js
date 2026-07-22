// Path-pattern matching for a site's own Terms & Conditions / Terms of
// Service page. Intentionally URL-path-based rather than anchor-text-based —
// covers the large majority of sites without needing to thread anchor text
// through the link-extraction pipeline for one narrow signal.
const TERMS_PATH_PATTERNS = [
    /terms-and-conditions/i,
    /terms-of-service/i,
    /terms-of-use/i,
    /\/terms\b/i,
    /\/tos\b/i,
    /legal\/terms/i,
];

export function looksLikeTermsPath(path) {
    if (!path) return false;
    return TERMS_PATH_PATTERNS.some(pattern => pattern.test(path));
}
