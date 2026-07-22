import { crawlerEnv } from './crawlerEnv.js';
import { safeFetch } from './ssrfGuard.js';

export async function fetchRobotsTxt(hostname) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, crawlerEnv.requestTimeoutMs);

    try {
        const robotsUrl = `https://${hostname}/robots.txt`;

        const response = await safeFetch(robotsUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': crawlerEnv.crawlerUserAgent,
                'Accept': 'text/plain,*/*'
            }
        });

        if (!response.ok) {
            return {
                ok: false,
                robotsUrl,
                status: response.status,
                body: null,
                sitemapUrls: []
            };
        }

        const body = await response.text();
        const sitemapUrls = extractSitemapUrls(body);

        return {
            ok: true,
            robotsUrl,
            status: response.status,
            body,
            sitemapUrls
        };
    } finally {
        clearTimeout(timeout);
    }
}

export function extractSitemapUrls(robotsText) {
    const sitemapUrls = [];

    if (!robotsText) {
        return sitemapUrls;
    }

    const lines = robotsText.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) continue;
        if (trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^sitemap:\s*(.+)$/i);

        if (match && match[1]) {
            sitemapUrls.push(match[1].trim());
        }
    }

    return sitemapUrls;
}

export function parseRobotsRules(robotsText) {
    if (!robotsText) {
        return {};
    }

    const normalizedText = robotsText.replace(/\\n/g, '\n');
    const lines = normalizedText.split(/\r?\n/);

    const rules = {};
    let currentAgents = [];
    let inUserAgentBlock = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const userAgentMatch = trimmed.match(/^user-agent:\s*(.+)$/i);
        if (userAgentMatch) {
            const agent = userAgentMatch[1].trim().toLowerCase();

            if (!inUserAgentBlock) {
                currentAgents = [];
                inUserAgentBlock = true;
            }

            currentAgents.push(agent);

            if (!rules[agent]) {
                rules[agent] = {
                    allow: [],
                    disallow: []
                };
            }

            continue;
        }

        const allowMatch = trimmed.match(/^allow:\s*(.*)$/i);
        if (allowMatch) {
            inUserAgentBlock = false;

            for (const agent of currentAgents) {
                if (!rules[agent]) {
                    rules[agent] = { allow: [], disallow: [] };
                }

                rules[agent].allow.push(allowMatch[1].trim());
            }

            continue;
        }

        const disallowMatch = trimmed.match(/^disallow:\s*(.*)$/i);
        if (disallowMatch) {
            inUserAgentBlock = false;

            for (const agent of currentAgents) {
                if (!rules[agent]) {
                    rules[agent] = { allow: [], disallow: [] };
                }

                rules[agent].disallow.push(disallowMatch[1].trim());
            }

            continue;
        }
    }

    return rules;
}

function normalizeRobotsUserAgent(userAgent) {
    if (!userAgent) {
        return '*';
    }

    return userAgent
        .toLowerCase()
        .split('/')[0]
        .trim();
}

export function isPathAllowedByRobots(robotsText, userAgent, path) {
    if (!robotsText) {
        return true;
    }

    const rules = parseRobotsRules(robotsText);
    const normalizedAgent = normalizeRobotsUserAgent(userAgent);
    const fallbackAgent = '*';

    const matchingRules =
        rules[normalizedAgent] ||
        rules[fallbackAgent] ||
        { allow: [], disallow: [] };

    const allowRules = matchingRules.allow.filter(Boolean);
    const disallowRules = matchingRules.disallow.filter(Boolean);

    let longestAllow = '';
    let longestDisallow = '';

    for (const rule of allowRules) {
        if (path.startsWith(rule) && rule.length > longestAllow.length) {
            longestAllow = rule;
        }
    }

    for (const rule of disallowRules) {
        if (path.startsWith(rule) && rule.length > longestDisallow.length) {
            longestDisallow = rule;
        }
    }

    if (!longestDisallow) {
        return true;
    }

    return longestAllow.length >= longestDisallow.length;
}
