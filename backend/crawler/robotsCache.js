const robotsCache = new Map();

export function getCachedRobots(hostname) {
    return robotsCache.get(hostname) || null;
}

export function setCachedRobots(hostname, robotsResult) {
    robotsCache.set(hostname, robotsResult);
}

export function clearRobotsCache() {
    robotsCache.clear();
}
