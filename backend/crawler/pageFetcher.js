import { crawlerEnv } from './crawlerEnv.js';
import { safeFetch } from './ssrfGuard.js';

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

        if (!contentType.includes('text/html')) {
            return {
                ok: false,
                isHtml: false,
                status: response.status,
                contentType,
                html: null
            };
        }

        const html = await response.text();

        return {
            ok: true,
            isHtml: true,
            status: response.status,
            contentType,
            html
        };
    } finally {
        clearTimeout(timeout);
    }
}
