// Matches a discovered link's hostname against known social platforms.
// Deliberately hostname-only (not path-based) — a link to any page on
// twitter.com/x.com etc. is treated as "this business has a Twitter presence."
const SOCIAL_HOSTNAMES = new Set([
    'twitter.com', 'x.com',
    'facebook.com', 'fb.com',
    'instagram.com',
    'linkedin.com',
    'youtube.com', 'youtu.be',
    'tiktok.com',
    'github.com',
    'threads.net',
    'pinterest.com',
    'reddit.com',
]);

export function isSocialHostname(hostname) {
    const clean = hostname.replace(/^www\./, '').toLowerCase();
    return SOCIAL_HOSTNAMES.has(clean);
}
