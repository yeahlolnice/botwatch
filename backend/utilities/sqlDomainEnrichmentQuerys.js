// Domain enrichment is stored as time-series snapshots: one row per enrichment
// run, so we keep full history (change tracking / trends in later phases) and
// read the latest row for the current profile. Each source lands in its own
// JSONB column; columns for sources not yet built (tls, security_headers,
// hosting, reputation, subdomains) exist now so the schema stays stable.

export const createDomainEnrichmentTableQuery = `
CREATE TABLE IF NOT EXISTS domain_enrichment (
    id BIGSERIAL PRIMARY KEY,
    domain_id BIGINT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dns JSONB,
    whois JSONB,
    email_posture JSONB,
    tls JSONB,
    security_headers JSONB,
    hosting JSONB,
    reputation JSONB,
    subdomains JSONB
);
`;

export const createDomainEnrichmentIndexQuery = `
CREATE INDEX IF NOT EXISTS idx_domain_enrichment_latest
    ON domain_enrichment (domain_id, collected_at DESC);
`;

export const insertDomainEnrichmentQuery = `
INSERT INTO domain_enrichment (
    domain_id, dns, whois, email_posture, tls, security_headers, hosting, reputation, subdomains
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, collected_at;
`;

export const getLatestDomainEnrichmentQuery = `
SELECT * FROM domain_enrichment
WHERE domain_id = $1
ORDER BY collected_at DESC
LIMIT 1;
`;
