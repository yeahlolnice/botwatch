const sitemapDiscoveryCache = new Map();

export function getCachedSitemapDiscovery(hostname) {
    return sitemapDiscoveryCache.get(hostname) || null;
}

export function setCachedSitemapDiscovery(hostname, result) {
    sitemapDiscoveryCache.set(hostname, result);
}

export function clearSitemapDiscoveryCache() {
    sitemapDiscoveryCache.clear();
}
