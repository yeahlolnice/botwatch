import net from 'node:net';
import psl from 'psl';

export function parseUrlParts(rawUrl) {
    try {
        const url = new URL(rawUrl);

        const hostname = url.hostname.toLowerCase();

        let path = url.pathname || '/';

        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }

        const normalizedUrl = `${url.protocol}//${hostname}${path}`;

        return {
            hostname,
            path,
            fullUrl: normalizedUrl
        };
    } catch {
        return null;
    }
}

export function resolveUrl(rawHref, baseUrl) {
    try {
        if (!rawHref) {
            return null;
        }

        const trimmed = rawHref.trim();

        if (
            trimmed.startsWith('mailto:') ||
            trimmed.startsWith('tel:') ||
            trimmed.startsWith('javascript:') ||
            trimmed.startsWith('#')
        ) {
            return null;
        }

        const resolved = new URL(trimmed, baseUrl);

        return parseUrlParts(resolved.toString());
    } catch {
        return null;
    }
}

// Registrable "root" domain for grouping subdomains — e.g. blog.example.co.uk
// -> example.co.uk. Uses the public suffix list (via psl) rather than a naive
// "last 2 labels" split, which gets multi-part TLDs like .co.uk/.com.au wrong.
export function getRootDomain(hostname) {
    if (!hostname) return null;

    // IP literals and single-label hosts (localhost, etc.) have no
    // registrable root — psl.get() on an IP produces nonsense, not null.
    if (net.isIP(hostname) || !hostname.includes('.')) {
        return hostname;
    }

    return psl.get(hostname) || hostname;
}
