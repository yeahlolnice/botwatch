// Crawler-specific env defaults. Ported from Willowbot's src/config/env.js,
// reading process.env directly like the rest of backend/ does (dotenv is
// already loaded once in server.js / connectDB.js).

export const crawlerEnv = {
    requestTimeoutMs: Number(process.env.CRAWLER_REQUEST_TIMEOUT_MS || 10000),

    crawlerMaxPagesPerDomain: Number(process.env.CRAWLER_MAX_PAGES_PER_DOMAIN || 5),
    crawlerMaxDomainsPerRun: Number(process.env.CRAWLER_MAX_DOMAINS_PER_RUN || 10),
    crawlerMaxSitemapsPerRun: Number(process.env.CRAWLER_MAX_SITEMAPS_PER_RUN || 20),

    crawlerUserAgent: process.env.CRAWLER_USER_AGENT || 'Willowbot/v1.2 (+https://botwatch.xyz/willowbot)',
    crawlerMinDelayMs: Number(process.env.CRAWLER_MIN_DELAY_MS || 2000),
};
