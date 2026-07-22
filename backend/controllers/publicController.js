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