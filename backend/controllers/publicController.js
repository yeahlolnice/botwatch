import { query } from '../utilities/connectDB.js';
import {
    getPublicStatsQuery,
    getPublicRecentTrapsQuery,
    getPublicAttackBreakdownQuery,
    getPublicCountryStatsQuery,
    getPublicBotLeaderboardQuery,
    getPublicHoneypotBreakdownQuery,
    getPublicBlocklistQuery,
} from '../utilities/sqlPublicQuerys.js';
import {
    getDomainReadinessCountsQuery,
    getPageReadinessCountsQuery,
    getRecentDomainReadinessQuery,
} from '../utilities/sqlCrawlerQuerys.js';
import {
    getDomainByHostname,
    getMostRecentCrawledPageForDomain,
    getDomainAggregatedContacts,
    getSubdomainCount,
} from '../crawler/db.js';
import { maskEmail, maskPhoneNumber, maskIp } from '../utilities/maskingUtils.js';
import { getLatestDomainEnrichmentQuery } from '../utilities/sqlDomainEnrichmentQuerys.js';
import {
    getAttackTrendQuery,
    getAttackIntentBreakdownQuery,
    getAttackSeverityBreakdownQuery,
    getTopCvesQuery,
    getTopTargetedPathsQuery,
    getTopAttackingIPsQuery,
    getAttacksByCountryQuery,
    getAttackInfraUsageQuery,
    getTopAttackerNetworksQuery,
    getHoneypotHitsQuery,
} from '../utilities/sqlTrackingQuerys.js';

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const getPublicStats = async (req, res) => {
    try {
        const result = await query(getPublicStatsQuery);
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Public stats error:', error);
        return res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

export const getPublicRecentTraps = async (req, res) => {
    try {
        const result = await query(getPublicRecentTrapsQuery);
        return res.json(result.rows);
    } catch (error) {
        console.error('Public recent traps error:', error);
        return res.status(500).json({ error: 'Failed to fetch recent traps' });
    }
};

export const getPublicIntel = async (req, res) => {
    try {
        const [attacks, countries, honeypots] = await Promise.all([
            query(getPublicAttackBreakdownQuery),
            query(getPublicCountryStatsQuery),
            query(getPublicHoneypotBreakdownQuery),
        ]);
        return res.json({
            attacks: attacks.rows,
            countries: countries.rows,
            honeypots: honeypots.rows,
        });
    } catch (error) {
        console.error('Public intel error:', error);
        return res.status(500).json({ error: 'Failed to fetch intel' });
    }
};

// GET /api/public/threat-charts — the full set of aggregate threat charts shown
// on the public Intel page (mirrors the admin Dashboard's threats/honeypots/
// attackers tabs). Everything here is aggregate and safe to publish; attacker
// IPs are masked server-side (first group only) before they ever leave.
export const getPublicThreatCharts = async (req, res) => {
    try {
        const [trend, intents, severities, cves, paths, attackers, countries, infraUsage, networks, honeypots] =
            await Promise.all([
                query(getAttackTrendQuery),
                query(getAttackIntentBreakdownQuery),
                query(getAttackSeverityBreakdownQuery),
                query(getTopCvesQuery),
                query(getTopTargetedPathsQuery),
                query(getTopAttackingIPsQuery, [20]),
                query(getAttacksByCountryQuery),
                query(getAttackInfraUsageQuery),
                query(getTopAttackerNetworksQuery),
                query(getHoneypotHitsQuery),
            ]);

        res.set('Cache-Control', 'public, max-age=60');
        return res.json({
            attackTrend: trend.rows,
            attackIntents: intents.rows,
            attackSeverities: severities.rows,
            topCves: cves.rows,
            topTargetedPaths: paths.rows,
            topAttackingIPs: attackers.rows.map((r) => ({
                ip: maskIp(r.ip_address),
                total_requests: r.total_requests,
                threat_requests: r.threat_requests,
                honeypot_hits: r.honeypot_hits,
                max_threat_score: r.max_threat_score,
                last_seen: r.last_seen,
                labels: (r.labels || []).filter(Boolean),
            })),
            attacksByCountry: countries.rows,
            attackInfraUsage: infraUsage.rows,
            topAttackerNetworks: networks.rows,
            honeypotHits: honeypots.rows,
        });
    } catch (error) {
        console.error('Public threat charts error:', error);
        return res.status(500).json({ error: 'Failed to fetch threat charts' });
const csvEscapeList = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const isoDate = (v) => v?.toISOString?.() || v || '';

// GET /api/public/blocklist?format=txt|csv|json (also served at /blocklist.txt).
// A free, downloadable threat blocklist of high-confidence malicious IPs. Public
// and cacheable — meant to be hotlinked/consumed. See getPublicBlocklistQuery
// for the (deliberately conservative) inclusion criteria.
export const getPublicBlocklist = async (req, res) => {
    try {
        const format = ['csv', 'json'].includes(req.query.format) ? req.query.format : 'txt';
        const rows = (await query(getPublicBlocklistQuery)).rows;
        const generatedAt = new Date().toISOString();
        // Cacheable at the edge (Cloudflare) so the query doesn't run per hit.
        res.set('Cache-Control', 'public, max-age=3600');

        if (format === 'json') {
            return res.json({
                generatedAt,
                count: rows.length,
                criteria: 'IPs that hit a honeypot decoy or were analyst-confirmed malicious. Aggregate metadata only.',
                license: 'Free to use with attribution to botwatch.xyz.',
                blocklist: rows.map((r) => ({
                    ip: r.ip,
                    firstSeen: r.first_seen,
                    lastSeen: r.last_seen,
                    trapHits: Number(r.trap_hits) || 0,
                    maxScore: Number(r.max_score) || 0,
                    countries: r.countries || [],
                    confirmed: !!r.confirmed,
                })),
            });
        }

        if (format === 'csv') {
            const header = 'ip,first_seen,last_seen,trap_hits,max_score,countries,analyst_confirmed';
            const body = rows.map((r) => [
                r.ip, isoDate(r.first_seen), isoDate(r.last_seen), r.trap_hits ?? 0, r.max_score ?? 0,
                (r.countries || []).join(';'), r.confirmed ? 'yes' : 'no',
            ].map(csvEscapeList).join(',')).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="botwatch-blocklist.csv"');
            return res.send(`${header}\n${body}\n`);
        }

        // Plain text — one IP per line, with a commented header. Firewall-friendly.
        const head = [
            '# botwatch.xyz threat blocklist',
            `# generated: ${generatedAt}`,
            `# entries: ${rows.length}`,
            '# criteria: honeypot-decoy hits or analyst-confirmed malicious IPs',
            '# license: free to use with attribution to botwatch.xyz',
            '#',
        ].join('\n');
        res.type('text/plain');
        return res.send(`${head}\n${rows.map((r) => r.ip).join('\n')}\n`);
    } catch (error) {
        console.error('Public blocklist error:', error);
        return res.status(500).json({ error: 'Failed to build blocklist' });
    }
};

export const getPublicLeaderboard = async (req, res) => {
    try {
        const result = await query(getPublicBotLeaderboardQuery);
        return res.json(result.rows);
    } catch (error) {
        console.error('Public leaderboard error:', error);
        return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
};
// GET /api/public/ai-readiness — how "AI-ready" the crawled slice of the web is
export const getAiReadiness = async (req, res) => {
    try {
        const [domainCounts, pageCounts, recentDomains] = await Promise.all([
            query(getDomainReadinessCountsQuery),
            query(getPageReadinessCountsQuery),
            query(getRecentDomainReadinessQuery),
        ]);

        const domains = domainCounts.rows[0];
        const pages = pageCounts.rows[0];

        const domainsChecked = Number(domains.domains_checked) || 0;
        const domainsWithLlmsTxt = Number(domains.domains_with_llms_txt) || 0;
        const pagesChecked = Number(pages.pages_checked) || 0;
        const pagesWithJsonLd = Number(pages.pages_with_json_ld) || 0;

        return res.json({
            domainsChecked,
            domainsWithLlmsTxt,
            pctWithLlmsTxt: domainsChecked > 0 ? Math.round((domainsWithLlmsTxt / domainsChecked) * 100) : 0,
            pagesChecked,
            pagesWithJsonLd,
            pctWithJsonLd: pagesChecked > 0 ? Math.round((pagesWithJsonLd / pagesChecked) * 100) : 0,
            recentDomains: recentDomains.rows,
        });
    } catch (error) {
        console.error('Public AI readiness error:', error);
        return res.status(500).json({ error: 'Failed to fetch AI readiness data' });
    }
};

// GET /api/public/site/:hostname — public "search any site" profile lookup.
// Free view only ever gets masked contact info — full values never leave
// the server for this route. Searching a domain we haven't crawled does
// NOT queue it — crawling stays an explicit admin action via /admin/crawler,
// so this unauthenticated route can't be used to make us crawl arbitrary
// targets on demand.
export const getSiteProfile = async (req, res) => {
    // Strip a trailing-dot FQDN (e.g. "example.com.") so it isn't rejected as malformed.
    const hostname = (req.params.hostname || '').trim().toLowerCase().replace(/\.+$/, '');

    if (!HOSTNAME_PATTERN.test(hostname)) {
        return res.status(400).json({ error: 'Invalid hostname' });
    }

    try {
        const domain = await getDomainByHostname(hostname);

        if (!domain) {
            return res.json({ found: false, hostname });
        }

        const [recentPage, contacts, subdomainCount] = await Promise.all([
            getMostRecentCrawledPageForDomain(domain.id),
            getDomainAggregatedContacts(domain.id),
            getSubdomainCount(domain.root_domain, domain.hostname),
        ]);

        const emails = contacts.emails || [];
        const phoneNumbers = contacts.phone_numbers || [];

        // Latest passive-enrichment snapshot (DNS, WHOIS, TLS, headers, hosting,
        // reputation, subdomains). Supplementary — a missing table or query error
        // must never break the core profile, so it's isolated from the rest.
        let enr = null;
        try {
            const enrichmentResult = await query(getLatestDomainEnrichmentQuery, [domain.id]);
            enr = enrichmentResult.rows[0] || null;
        } catch (enrichErr) {
            console.warn('Enrichment lookup failed (non-fatal):', enrichErr.message);
        }

        return res.json({
            found: true,
            hostname: domain.hostname,
            rootDomain: domain.root_domain,
            status: domain.status,
            pagesCrawled: domain.pages_crawled_count,
            lastUpdatedAt: domain.updated_at,
            title: recentPage?.title || null,
            description: recentPage?.meta_description || null,
            category: domain.category,
            techStack: domain.tech_stack || [],
            termsUrl: domain.terms_url,
            socialLinks: contacts.social_links || [],
            subdomainCount,
            aiReadiness: {
                score: domain.ai_readiness_score,
                llmsTxtFound: domain.llms_txt_found,
                aiTxtFound: domain.ai_txt_found,
                humansTxtFound: domain.humans_txt_found,
                robotsTxtFound: domain.robots_txt_found,
                trainingPolicy: domain.ai_training_policy,
                trainingPolicyExplicit: domain.ai_training_policy_explicit,
            },
            contacts: {
                emailCount: emails.length,
                phoneCount: phoneNumbers.length,
                emails: emails.map(maskEmail),
                phoneNumbers: phoneNumbers.map(maskPhoneNumber),
            },
            enrichment: enr && {
                collectedAt: enr.collected_at,
                dns: enr.dns,
                whois: enr.whois,
                emailPosture: enr.email_posture,
                tls: enr.tls,
                securityHeaders: enr.security_headers,
                hosting: enr.hosting,
                reputation: enr.reputation,
                subdomains: enr.subdomains,
            },
        });
    } catch (error) {
        console.error('Site profile error:', error);
        return res.status(500).json({ error: 'Failed to fetch site profile' });
    }
};

// return the sitemap.xml file for search engines
export const getPublicSitemap = async (req, res) => {
    try {
        res.type('application/xml');
        res.sendFile('../sitemap.xml', { root: 'public' });
    } catch (error) {
        console.error('Public sitemap error:', error);
        return res.status(500).json({ error: 'Failed to fetch sitemap' });
    }
} 