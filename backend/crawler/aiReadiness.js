import { crawlerEnv } from './crawlerEnv.js';
import { safeFetch } from './ssrfGuard.js';

// Checks a domain's homepage for /llms.txt — a proposed convention for surfacing
// LLM-friendly documentation, analogous to robots.txt/sitemap.xml.
export async function checkLlmsTxtForDomain(hostname) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, crawlerEnv.requestTimeoutMs);

    const llmsTxtUrl = `https://${hostname}/llms.txt`;

    try {
        const response = await safeFetch(llmsTxtUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': crawlerEnv.crawlerUserAgent,
                'Accept': 'text/plain,text/markdown,*/*'
            }
        });

        if (!response.ok) {
            return {
                found: false,
                llmsTxtUrl,
                status: response.status,
                content: null
            };
        }

        const content = await response.text();

        return {
            found: true,
            llmsTxtUrl,
            status: response.status,
            content
        };
    } catch (error) {
        return {
            found: false,
            llmsTxtUrl,
            status: null,
            content: null,
            error: String(error.message || error)
        };
    } finally {
        clearTimeout(timeout);
    }
}
