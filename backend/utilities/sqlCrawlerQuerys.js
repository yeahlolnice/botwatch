// Crawler tables (domains/pages/links/sitemaps) + AI-readiness columns.
// Ported from Willowbot_Web_Crawler/src/db/schema.sql, applied idempotently
// via POST /api/crawler/init — same pattern as sqlEnrichmentQuerys.js.

export const createDomainsTableQuery = `
CREATE TABLE IF NOT EXISTS domains (
  id BIGSERIAL PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued',
  pages_crawled_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createPagesTableQuery = `
CREATE TABLE IF NOT EXISTS pages (
  id BIGSERIAL PRIMARY KEY,
  domain_id BIGINT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  depth INTEGER NOT NULL DEFAULT 0,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  crawled_at TIMESTAMPTZ
);
`;

export const createLinksTableQuery = `
CREATE TABLE IF NOT EXISTS links (
  id BIGSERIAL PRIMARY KEY,
  source_page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_page_id, target_page_id)
);
`;

export const createSitemapsTableQuery = `
CREATE TABLE IF NOT EXISTS sitemaps (
  id BIGSERIAL PRIMARY KEY,
  domain_id BIGINT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetched_at TIMESTAMPTZ
);
`;

// AI-readiness columns — added after initial table creation, like ip_enrichment's abuse_reports column.
export const addDomainAiReadinessColumnsQuery = `
ALTER TABLE domains
  ADD COLUMN IF NOT EXISTS llms_txt_found BOOLEAN,
  ADD COLUMN IF NOT EXISTS llms_txt_content TEXT,
  ADD COLUMN IF NOT EXISTS llms_txt_checked_at TIMESTAMPTZ;
`;

export const addPageAiReadinessColumnsQuery = `
ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS json_ld_found BOOLEAN,
  ADD COLUMN IF NOT EXISTS json_ld_types JSONB,
  ADD COLUMN IF NOT EXISTS json_ld_count INTEGER;
`;

// --- domains ---

export const ensureDomainQuery = `
INSERT INTO domains (hostname)
VALUES ($1)
ON CONFLICT (hostname)
DO UPDATE SET updated_at = NOW()
RETURNING *;
`;

export const getAllDomainsQuery = `
SELECT * FROM domains ORDER BY id ASC;
`;

export const getDomainByHostnameQuery = `
SELECT * FROM domains WHERE hostname = $1 LIMIT 1;
`;

export const getNextQueuedDomainQuery = `
SELECT * FROM domains WHERE status = 'queued' ORDER BY id ASC LIMIT 1;
`;

export const markDomainAsCrawlingQuery = `
UPDATE domains SET status = 'crawling', updated_at = NOW() WHERE id = $1 RETURNING *;
`;

export const markDomainAsDoneQuery = `
UPDATE domains SET status = 'done', updated_at = NOW() WHERE id = $1 RETURNING *;
`;

export const markDomainAsErrorQuery = `
UPDATE domains SET status = 'error', updated_at = NOW() WHERE id = $1 RETURNING *;
`;

export const incrementPagesCrawledCountQuery = `
UPDATE domains SET pages_crawled_count = pages_crawled_count + 1, updated_at = NOW() WHERE id = $1 RETURNING *;
`;

export const updateDomainAiReadinessQuery = `
UPDATE domains
SET llms_txt_found = $2, llms_txt_content = $3, llms_txt_checked_at = NOW()
WHERE id = $1
RETURNING *;
`;

// Both public-facing readiness queries below exclude IP-literal/localhost/
// .local/.internal hostnames as defense-in-depth: even though the crawler
// itself now refuses to touch private/internal addresses (see ssrfGuard.js),
// this keeps any such hostname from ever being echoed back on an
// unauthenticated route (e.g. a row that predates the SSRF fix, or one an
// admin seeded directly).
const NOT_PRIVATE_LOOKING_HOSTNAME = `
  hostname !~ '^[0-9]{1,3}(\\.[0-9]{1,3}){3}$'
  AND hostname !~ '^[0-9a-fA-F:]+$'
  AND lower(hostname) <> 'localhost'
  AND lower(hostname) NOT LIKE '%.local'
  AND lower(hostname) NOT LIKE '%.internal'
  AND lower(hostname) NOT LIKE '%.localhost'
`;

export const getDomainReadinessCountsQuery = `
SELECT
  COUNT(*) FILTER (WHERE llms_txt_checked_at IS NOT NULL) AS domains_checked,
  COUNT(*) FILTER (WHERE llms_txt_found = TRUE)            AS domains_with_llms_txt
FROM domains
WHERE ${NOT_PRIVATE_LOOKING_HOSTNAME};
`;

export const getRecentDomainReadinessQuery = `
SELECT hostname, status, llms_txt_found, llms_txt_checked_at, pages_crawled_count, updated_at
FROM domains
WHERE llms_txt_checked_at IS NOT NULL
  AND ${NOT_PRIVATE_LOOKING_HOSTNAME}
ORDER BY llms_txt_checked_at DESC
LIMIT 50;
`;

export const getDomainStatusCountsQuery = `
SELECT status, COUNT(*)::int AS count FROM domains GROUP BY status;
`;

// --- pages ---

export const ensurePageQuery = `
INSERT INTO pages (domain_id, url, path, depth)
VALUES ($1, $2, $3, $4)
ON CONFLICT (url)
DO UPDATE SET
  domain_id = EXCLUDED.domain_id,
  path = EXCLUDED.path,
  depth = EXCLUDED.depth
RETURNING *;
`;

export const getAllPagesQuery = `
SELECT * FROM pages ORDER BY id ASC;
`;

export const getPageByUrlQuery = `
SELECT * FROM pages WHERE url = $1 LIMIT 1;
`;

export const markPageAsCrawledQuery = `
UPDATE pages SET status = 'crawled', crawled_at = NOW() WHERE id = $1 RETURNING *;
`;

export const markPageAsSkippedQuery = `
UPDATE pages SET status = 'skipped', crawled_at = NOW() WHERE id = $1 RETURNING *;
`;

export const getQueuedPagesQuery = `
SELECT * FROM pages WHERE status = 'queued' ORDER BY id ASC;
`;

export const getNextQueuedPageForDomainQuery = `
SELECT * FROM pages WHERE domain_id = $1 AND status = 'queued' ORDER BY id ASC LIMIT 1;
`;

export const countPagesForDomainQuery = `
SELECT COUNT(*)::int AS count FROM pages WHERE domain_id = $1;
`;

export const updatePageAiReadinessQuery = `
UPDATE pages
SET json_ld_found = $2, json_ld_types = $3, json_ld_count = $4
WHERE id = $1
RETURNING *;
`;

export const getPageReadinessCountsQuery = `
SELECT
  COUNT(*) FILTER (WHERE status = 'crawled')      AS pages_checked,
  COUNT(*) FILTER (WHERE json_ld_found = TRUE)     AS pages_with_json_ld
FROM pages;
`;

export const getPageStatusCountsQuery = `
SELECT status, COUNT(*)::int AS count FROM pages GROUP BY status;
`;

// --- links ---

export const ensureLinkQuery = `
INSERT INTO links (source_page_id, target_page_id)
VALUES ($1, $2)
ON CONFLICT (source_page_id, target_page_id)
DO NOTHING
RETURNING *;
`;

export const getAllLinksQuery = `
SELECT * FROM links ORDER BY id ASC;
`;

// --- sitemaps ---

export const ensureSitemapQuery = `
INSERT INTO sitemaps (domain_id, url)
VALUES ($1, $2)
ON CONFLICT (url)
DO UPDATE SET domain_id = EXCLUDED.domain_id
RETURNING *;
`;

export const getAllSitemapsQuery = `
SELECT * FROM sitemaps ORDER BY id ASC;
`;

export const getSitemapByIdQuery = `
SELECT * FROM sitemaps WHERE id = $1 LIMIT 1;
`;

export const markSitemapAsFetchedQuery = `
UPDATE sitemaps SET status = 'fetched', fetched_at = NOW() WHERE id = $1 RETURNING *;
`;

export const getQueuedSitemapsQuery = `
SELECT * FROM sitemaps WHERE status = 'queued' ORDER BY id ASC;
`;

// Willowbot's original query had `WHERE status = 'ggggg'` (a leftover typo) which meant
// sitemap processing never found anything to do — fixed to 'queued' here.
export const getNextQueuedSitemapQuery = `
SELECT * FROM sitemaps WHERE status = 'queued' ORDER BY id ASC LIMIT 1;
`;
