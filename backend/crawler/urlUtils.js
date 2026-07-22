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
