import { crawlerEnv } from './crawlerEnv.js';
import { safeFetch } from './ssrfGuard.js';

export async function checkSitemapUrl(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, crawlerEnv.requestTimeoutMs);

    try {
        const response = await safeFetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': crawlerEnv.crawlerUserAgent,
                'Accept': 'application/xml,text/xml,text/plain,*/*'
            }
        });

        const contentType = response.headers.get('content-type') || '';

        return {
            ok: response.ok,
            url,
            status: response.status,
            contentType
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchSitemapXml(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, crawlerEnv.requestTimeoutMs);

    try {
        const response = await safeFetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': crawlerEnv.crawlerUserAgent,
                'Accept': 'application/xml,text/xml,text/plain,*/*'
            }
        });

        if (!response.ok) {
            return {
                ok: false,
                url,
                status: response.status,
                xml: null
            };
        }

        const xml = await response.text();

        return {
            ok: true,
            url,
            status: response.status,
            xml
        };
    } finally {
        clearTimeout(timeout);
    }
}

export function extractUrlsFromSitemapXml(xml) {
    if (!xml) {
        return [];
    }

    const matches = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)];

    return matches.map(match => match[1].trim());
}
