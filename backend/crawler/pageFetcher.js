import { crawlerEnv } from './crawlerEnv.js';
import { safeFetch } from './ssrfGuard.js';

// Signals used only for tech-stack fingerprinting — cookie *names* only,
// never values, since values can carry session/identity data we have no
// reason to store.
function extractTechHeaders(headers) {
    const cookieNames = headers.getSetCookie().map(cookie => cookie.split('=')[0].trim());

    return {
        server: headers.get('server') || null,
        poweredBy: headers.get('x-powered-by') || null,
        cookieNames,
    };
}

export async function fetchPage(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, crawlerEnv.requestTimeoutMs);

    try {
        const response = await safeFetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': crawlerEnv.crawlerUserAgent,
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        const contentType = response.headers.get('content-type') || '';
        const techHeaders = extractTechHeaders(response.headers);

        if (!contentType.includes('text/html')) {
            return {
                ok: false,
                isHtml: false,
                status: response.status,
                contentType,
                techHeaders,
                html: null
            };
        }

        const html = await response.text();

        return {
            ok: true,
            isHtml: true,
            status: response.status,
            contentType,
            techHeaders,
            html
        };
    } finally {
        clearTimeout(timeout);
    }
}
