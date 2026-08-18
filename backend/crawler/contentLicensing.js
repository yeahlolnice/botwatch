// Detects a site's machine-readable AI / text-and-data-mining (TDM) usage
// preferences from its homepage HTML: the `noai`/`noimageai` robots tokens
// some publishers use to opt out of AI training, and the TDM Reservation
// Protocol meta tags (`tdm-reservation`, `tdm-policy`). Pure — parses the
// homepage HTML the crawler already fetched. Returns null when the site
// expresses no such preference (the common case), so the caller omits it.
const META_RE = /<meta\b[^>]*>/gi;
const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
    return m ? (m[2] ?? m[3] ?? '').trim() : null;
};

export function detectContentLicensing(html) {
    if (!html || typeof html !== 'string') return null;

    let noai = false;
    let noimageai = false;
    let tdmReservation = null;
    let tdmPolicy = null;

    for (const tag of html.match(META_RE) || []) {
        const name = (attr(tag, 'name') || '').toLowerCase();
        const content = attr(tag, 'content');
        if (content == null) continue;

        if (name === 'robots' || name === 'googlebot') {
            const tokens = content.toLowerCase().split(',').map((t) => t.trim());
            if (tokens.includes('noai')) noai = true;
            if (tokens.includes('noimageai')) noimageai = true;
        } else if (name === 'tdm-reservation') {
            tdmReservation = content.trim();
        } else if (name === 'tdm-policy') {
            tdmPolicy = content.trim();
        }
    }

    const reserved = tdmReservation != null && tdmReservation !== '0';
    if (!noai && !noimageai && !reserved && !tdmPolicy) return null;

    return { noai, noimageai, tdmReserved: reserved, tdmPolicy: tdmPolicy || null };
}
