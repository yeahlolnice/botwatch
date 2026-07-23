// Matches a discovered link against known social platforms and, when the link
// is actually profile-shaped (a handle/page — not a share widget, embed, login,
// or deep content link), returns a canonical profile URL for storage.
//
// The previous version matched on hostname alone and stored the full link, so
// it swept in share/intent buttons (facebook.com/sharer, twitter.com/intent),
// embeds (youtube.com/watch), login/legal pages, and — if the crawler ever hit
// a social site directly — every internal link. This version inspects the path
// per platform and emits a normalized `https://{host}{path}` (lowercased, no
// query/fragment/trailing slash) so the DISTINCT aggregation collapses repeats.

const stripWww = (hostname) => hostname.replace(/^www\./, '').toLowerCase();

// Each platform reports the canonical profile path for a given list of
// non-empty, lowercased path segments, or null when the path isn't a profile.
const PLATFORMS = [
    {
        // twitter/x: /{handle} — a single 1–15 char segment, minus site sections.
        hosts: ['twitter.com', 'x.com'],
        profile(segs) {
            const reserved = new Set(['intent', 'share', 'home', 'login', 'signup', 'search', 'hashtag', 'i', 'messages', 'explore', 'notifications', 'settings', 'tos', 'privacy', 'about', 'help', 'signin', 'logout', 'compose']);
            if (segs.length === 1 && /^[a-z0-9_]{1,15}$/.test(segs[0]) && !reserved.has(segs[0])) {
                return `/${segs[0]}`;
            }
            return null;
        },
    },
    {
        // facebook: /{page} or /pages/{name}/{id} — exclude share/system paths.
        hosts: ['facebook.com', 'fb.com'],
        profile(segs) {
            const reserved = new Set(['sharer', 'sharer.php', 'share.php', 'dialog', 'plugins', 'login', 'login.php', 'recover', 'help', 'policies', 'privacy', 'terms', 'tr', 'watch', 'story.php', 'permalink.php', 'photo.php', 'events', 'marketplace', 'gaming', 'home.php', 'profile.php']);
            if (segs.length === 1 && !reserved.has(segs[0])) return `/${segs[0]}`;
            if (segs.length >= 3 && segs[0] === 'pages') return `/pages/${segs[1]}/${segs[2]}`;
            return null;
        },
    },
    {
        // instagram: /{user} — exclude posts, reels, stories, system paths.
        hosts: ['instagram.com'],
        profile(segs) {
            const reserved = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'tv', 'about', 'directory', 'developer', 'legal', 'privacy']);
            if (segs.length === 1 && !reserved.has(segs[0]) && /^[a-z0-9._]{1,30}$/.test(segs[0])) {
                return `/${segs[0]}`;
            }
            return null;
        },
    },
    {
        // linkedin: only company/in/school/showcase profiles (not shareArticle, pulse, feed).
        hosts: ['linkedin.com'],
        profile(segs) {
            if (segs.length >= 2 && ['company', 'in', 'school', 'showcase'].includes(segs[0])) {
                return `/${segs[0]}/${segs[1]}`;
            }
            return null;
        },
    },
    {
        // youtube: /@handle, /c/{x}, /channel/{x}, /user/{x} — not /watch, /embed, /results.
        hosts: ['youtube.com'],
        profile(segs) {
            if (segs.length >= 1 && segs[0].startsWith('@')) return `/${segs[0]}`;
            if (segs.length >= 2 && ['c', 'channel', 'user'].includes(segs[0])) {
                return `/${segs[0]}/${segs[1]}`;
            }
            return null;
        },
    },
    {
        // tiktok: /@handle
        hosts: ['tiktok.com'],
        profile(segs) {
            if (segs.length >= 1 && segs[0].startsWith('@')) return `/${segs[0]}`;
            return null;
        },
    },
    {
        // threads: /@handle
        hosts: ['threads.net'],
        profile(segs) {
            if (segs.length === 1 && segs[0].startsWith('@')) return `/${segs[0]}`;
            return null;
        },
    },
    {
        // pinterest: /{user} — exclude pins, search, system paths.
        hosts: ['pinterest.com'],
        profile(segs) {
            const reserved = new Set(['pin', 'search', 'ideas', 'login', 'about', 'today', 'categories', 'business']);
            if (segs.length === 1 && !reserved.has(segs[0])) return `/${segs[0]}`;
            return null;
        },
    },
    {
        // reddit: /r/{sub} or /user|u/{name} — not /submit, /login, /search.
        hosts: ['reddit.com'],
        profile(segs) {
            if (segs.length >= 2 && ['r', 'user', 'u'].includes(segs[0])) {
                return `/${segs[0]}/${segs[1]}`;
            }
            return null;
        },
    },
    // Note: youtu.be is intentionally omitted — it only ever shortens individual
    // videos, never channels/profiles.
];

// Given a discovered link's hostname and path, returns a canonical social
// profile URL (e.g. "https://twitter.com/acme") when the link points at an
// actual profile on a known platform, or null otherwise.
export function extractSocialProfile(hostname, path) {
    const host = stripWww(hostname);
    const rule = PLATFORMS.find(p => p.hosts.includes(host));
    if (!rule) return null;

    const segs = (path || '').toLowerCase().split('/').filter(Boolean);
    const canonicalPath = rule.profile(segs);
    if (!canonicalPath) return null;

    return `https://${host}${canonicalPath}`;
}
