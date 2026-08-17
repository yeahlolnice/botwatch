import { query } from './connectDB.js';
import {
    createRequestTrackingTableQuery,
    migrateTrackingTableQuery,
} from './sqlTrackingQuerys.js';
import {
    createDomainsTableQuery,
    createPagesTableQuery,
    createLinksTableQuery,
    createSitemapsTableQuery,
    addDomainAiReadinessColumnsQuery,
    addPageAiReadinessColumnsQuery,
    addDomainProfileColumnsQuery,
    addDomainRootDomainIndexQuery,
    addDomainContentLicensingColumnQuery,
    createDomainScoreHistoryTableQuery,
    createDomainScoreHistoryIndexQuery,
    addPageContentColumnsQuery,
    addPageWebmcpColumnQuery,
    addDomainPriorityColumnQuery,
} from './sqlCrawlerQuerys.js';
import { createEnrichmentTableQuery } from './sqlEnrichmentQuerys.js';
import {
    createDomainEnrichmentTableQuery,
    createDomainEnrichmentIndexQuery,
} from './sqlDomainEnrichmentQuerys.js';
import {
    createModelTableQuery,
    createIpScoreTableQuery,
    addIpScoreExplanationColumnQuery,
    createIpVerdictTableQuery,
} from './sqlModelQuerys.js';
import { createApiKeyTableQuery } from './sqlApiKeyQuerys.js';
import { addApiKeyBillingColumnsQuery, createBillingOrderTableQuery } from './sqlBillingQuerys.js';
import {
    createCustomerTableQuery,
    addApiKeyOwnerColumnQuery,
    createPasswordResetTableQuery,
    addCustomerEmailVerifiedColumnQuery,
    createEmailVerificationTableQuery,
} from './sqlCustomerQuerys.js';
import { createReportOrderTableQuery, addReportDataColumnQuery } from './sqlReadinessQuerys.js';

// Every schema statement is idempotent (CREATE TABLE / ADD COLUMN / CREATE INDEX
// IF NOT EXISTS), so it's safe to run them on every boot. This is what makes a
// deploy just "pull + restart": the schema is always brought up to date, and we
// never again silently drop data because someone forgot to hit an init endpoint.
const MIGRATIONS = [
    ['request_tracking table', createRequestTrackingTableQuery],
    ['request_tracking columns', migrateTrackingTableQuery],
    ['domains table', createDomainsTableQuery],
    ['pages table', createPagesTableQuery],
    ['links table', createLinksTableQuery],
    ['sitemaps table', createSitemapsTableQuery],
    ['domain ai-readiness columns', addDomainAiReadinessColumnsQuery],
    ['page ai-readiness columns', addPageAiReadinessColumnsQuery],
    ['domain profile columns', addDomainProfileColumnsQuery],
    ['domain root_domain index', addDomainRootDomainIndexQuery],
    ['domain content_licensing column', addDomainContentLicensingColumnQuery],
    ['domain_score_history table', createDomainScoreHistoryTableQuery],
    ['domain_score_history index', createDomainScoreHistoryIndexQuery],
    ['page content columns', addPageContentColumnsQuery],
    ['page webmcp column', addPageWebmcpColumnQuery],
    ['domain priority column', addDomainPriorityColumnQuery],
    ['ip_enrichment table', createEnrichmentTableQuery],
    ['ip_enrichment abuse_reports', 'ALTER TABLE ip_enrichment ADD COLUMN IF NOT EXISTS abuse_reports JSONB'],
    ['domain_enrichment table', createDomainEnrichmentTableQuery],
    ['domain_enrichment index', createDomainEnrichmentIndexQuery],
    ['ml_model table', createModelTableQuery],
    ['ip_risk_score table', createIpScoreTableQuery],
    ['ip_risk_score explanation column', addIpScoreExplanationColumnQuery],
    ['ip_verdict table', createIpVerdictTableQuery],
    ['api_key table', createApiKeyTableQuery],
    ['api_key billing columns', addApiKeyBillingColumnsQuery],
    ['billing_order table', createBillingOrderTableQuery],
    ['customer table', createCustomerTableQuery],
    ['api_key owner column', addApiKeyOwnerColumnQuery],
    ['password_reset table', createPasswordResetTableQuery],
    ['customer email_verified column', addCustomerEmailVerifiedColumnQuery],
    ['email_verification table', createEmailVerificationTableQuery],
    ['report_order table', createReportOrderTableQuery],
    ['report_order report_data column', addReportDataColumnQuery],
];

// Runs all migrations, isolating each so one failure never stops the rest and
// never crashes the server. Returns a summary for logging.
export async function runMigrations() {
    let ok = 0;
    const failures = [];
    for (const [name, sql] of MIGRATIONS) {
        try {
            await query(sql);
            ok++;
        } catch (error) {
            failures.push(name);
            console.error(`[migrate] "${name}" failed: ${error.message}`);
        }
    }
    console.log(`[migrate] ${ok}/${MIGRATIONS.length} migrations ok${failures.length ? ` — failed: ${failures.join(', ')}` : ''}`);
    return { ok, failed: failures.length };
}
