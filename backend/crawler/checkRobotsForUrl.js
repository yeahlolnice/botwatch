import { crawlerEnv } from './crawlerEnv.js';
import { parseUrlParts } from './urlUtils.js';
import { fetchRobotsTxt, isPathAllowedByRobots } from './robotsFetcher.js';
import { getCachedRobots, setCachedRobots } from './robotsCache.js';

export async function checkRobotsForUrl(rawUrl) {
    const parsed = parseUrlParts(rawUrl);

    if (!parsed) {
        return {
            ok: false,
            allowed: false,
            reason: 'Invalid URL'
        };
    }

    let robotsResult = getCachedRobots(parsed.hostname);

    if (!robotsResult) {
        robotsResult = await fetchRobotsTxt(parsed.hostname);
        setCachedRobots(parsed.hostname, robotsResult);
    }

    if (!robotsResult.ok || !robotsResult.body) {
        return {
            ok: true,
            allowed: true,
            reason: 'No readable robots.txt, allowing by default',
            robotsResult
        };
    }

    const allowed = isPathAllowedByRobots(
        robotsResult.body,
        crawlerEnv.crawlerUserAgent,
        parsed.path
    );

    return {
        ok: true,
        allowed,
        reason: allowed ? 'Allowed by robots.txt' : 'Blocked by robots.txt',
        robotsResult,
        path: parsed.path
    };
}
