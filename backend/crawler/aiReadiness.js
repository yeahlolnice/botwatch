import { crawlerEnv } from './crawlerEnv.js';
import { safeFetch } from './ssrfGuard.js';

// Checks a domain for a well-known text file at its root — the same shape
// robots.txt/sitemap.xml already use. Backs llms.txt, ai.txt, and
// humans.txt checks below.
export async function checkWellKnownFile(hostname, path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, crawlerEnv.requestTimeoutMs);

    const url = `https://${hostname}/${path}`;

    try {
        const response = await safeFetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': crawlerEnv.crawlerUserAgent,
                'Accept': 'text/plain,text/markdown,*/*'
            }
        });

        if (!response.ok) {
            return {
                found: false,
                url,
                status: response.status,
                content: null
            };
        }

        const content = await response.text();

        return {
            found: true,
            url,
            status: response.status,
            content
        };
    } catch (error) {
        return {
            found: false,
            url,
            status: null,
            content: null,
            error: String(error.message || error)
        };
    } finally {
        clearTimeout(timeout);
    }
}

// /llms.txt — a proposed convention for surfacing LLM-friendly documentation.
export async function checkLlmsTxtForDomain(hostname) {
    const result = await checkWellKnownFile(hostname, 'llms.txt');
    return { ...result, llmsTxtUrl: result.url };
}

// /ai.txt — an emerging, less standardized companion convention for
// declaring AI-specific policy (adoption is much lower than llms.txt/robots.txt).
export async function checkAiTxtForDomain(hostname) {
    return checkWellKnownFile(hostname, 'ai.txt');
}

// /humans.txt — a long-standing (pre-AI) convention for site credits; not an
// AI-specific signal, but cheap to check alongside the others and useful
// context for a site profile.
export async function checkHumansTxtForDomain(hostname) {
    return checkWellKnownFile(hostname, 'humans.txt');
}
