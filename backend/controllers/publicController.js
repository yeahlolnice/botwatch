import { query } from '../utilities/connectDB.js';
import {
    getPublicStatsQuery,
    getPublicRecentTrapsQuery,
    getPublicAttackBreakdownQuery,
    getPublicCountryStatsQuery,
    getPublicBotLeaderboardQuery,
    getPublicHoneypotBreakdownQuery,
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
import { maskEmail, maskPhoneNumber } from '../utilities/maskingUtils.js';

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