// Thin query helpers for the crawler tables, built on the shared pg pool
// (utilities/connectDB.js) and the SQL text in utilities/sqlCrawlerQuerys.js.
// Ported from Willowbot's src/db/queries/*.js, which used a second pg.Pool —
// here everything goes through the one pool botwatch already uses.

import { query } from '../utilities/connectDB.js';
import { getRootDomain } from './urlUtils.js';
import {
    ensureDomainQuery,
    getAllDomainsQuery,
    getDomainByHostnameQuery,
    getNextQueuedDomainQuery,
    markDomainAsCrawlingQuery,
    markDomainAsDoneQuery,
    markDomainAsErrorQuery,
    incrementPagesCrawledCountQuery,
    updateDomainAiReadinessQuery,
    getDomainReadinessCountsQuery,
    getRecentDomainReadinessQuery,
    getDomainStatusCountsQuery,
    updateDomainProfileQuery,
    updateDomainAiTrainingPolicyQuery,
    updateDomainRobotsTxtFoundQuery,
    updateDomainAiTxtQuery,
    updateDomainHumansTxtQuery,
    updateDomainAiReadinessScoreQuery,
    getSubdomainCountQuery,
    getDomainHasJsonLdQuery,
    ensurePageQuery,
    getAllPagesQuery,
    getPageByUrlQuery,
    markPageAsCrawledQuery,
    markPageAsSkippedQuery,
    getQueuedPagesQuery,
    getNextQueuedPageForDomainQuery,
    countPagesForDomainQuery,
    updatePageAiReadinessQuery,
    getPageReadinessCountsQuery,
    getPageStatusCountsQuery,
    updatePageContentQuery,
    getMostRecentCrawledPageForDomainQuery,
    getDomainAggregatedContactsQuery,
    ensureLinkQuery,
    getAllLinksQuery,
    ensureSitemapQuery,
    getAllSitemapsQuery,
    getSitemapByIdQuery,
    markSitemapAsFetchedQuery,
    getQueuedSitemapsQuery,
    getNextQueuedSitemapQuery,
} from '../utilities/sqlCrawlerQuerys.js';

// --- domains ---

export async function ensureDomain(hostname) {
    const result = await query(ensureDomainQuery, [hostname, getRootDomain(hostname)]);
    return result.rows[0];
}

export async function getAllDomains() {
    const result = await query(getAllDomainsQuery);
    return result.rows;
}

export async function getDomainByHostname(hostname) {
    const result = await query(getDomainByHostnameQuery, [hostname]);
    return result.rows[0] || null;
}

export async function getNextQueuedDomain() {
    const result = await query(getNextQueuedDomainQuery);
    return result.rows[0] || null;
}

export async function markDomainAsCrawling(domainId) {
    const result = await query(markDomainAsCrawlingQuery, [domainId]);
    return result.rows[0] || null;
}

export async function markDomainAsDone(domainId) {
    const result = await query(markDomainAsDoneQuery, [domainId]);
    return result.rows[0] || null;
}

export async function markDomainAsError(domainId) {
    const result = await query(markDomainAsErrorQuery, [domainId]);
    return result.rows[0] || null;
}

export async function incrementPagesCrawledCount(domainId) {
    const result = await query(incrementPagesCrawledCountQuery, [domainId]);
    return result.rows[0] || null;
}

export async function updateDomainAiReadiness(domainId, { found, content }) {
    const result = await query(updateDomainAiReadinessQuery, [domainId, found, content]);
    return result.rows[0] || null;
}

export async function getDomainReadinessCounts() {
    const result = await query(getDomainReadinessCountsQuery);
    return result.rows[0];
}

export async function getRecentDomainReadiness() {
    const result = await query(getRecentDomainReadinessQuery);
    return result.rows;
}

export async function getDomainStatusCounts() {
    const result = await query(getDomainStatusCountsQuery);
    return result.rows;
}

// Merges new findings into a domain's profile — category/terms_url only set
// once (first confident finding sticks), tech_stack unions across crawls.
export async function updateDomainProfile(domainId, { category = null, techStack = [], termsUrl = null }) {
    const result = await query(updateDomainProfileQuery, [domainId, category, JSON.stringify(techStack), termsUrl]);
    return result.rows[0] || null;
}

export async function updateDomainAiTrainingPolicy(domainId, policy, hasExplicitPolicy) {
    const result = await query(updateDomainAiTrainingPolicyQuery, [domainId, JSON.stringify(policy), hasExplicitPolicy]);
    return result.rows[0] || null;
}

export async function updateDomainRobotsTxtFound(domainId, found) {
    const result = await query(updateDomainRobotsTxtFoundQuery, [domainId, found]);
    return result.rows[0] || null;
}

export async function updateDomainAiTxt(domainId, found) {
    const result = await query(updateDomainAiTxtQuery, [domainId, found]);
    return result.rows[0] || null;
}

export async function updateDomainHumansTxt(domainId, found) {
    const result = await query(updateDomainHumansTxtQuery, [domainId, found]);
    return result.rows[0] || null;
}

export async function updateDomainAiReadinessScore(domainId, score) {
    const result = await query(updateDomainAiReadinessScoreQuery, [domainId, score]);
    return result.rows[0] || null;
}

export async function getSubdomainCount(rootDomain, hostname) {
    const result = await query(getSubdomainCountQuery, [rootDomain, hostname]);
    return result.rows[0].count;
}

export async function getDomainHasJsonLd(domainId) {
    const result = await query(getDomainHasJsonLdQuery, [domainId]);
    return result.rows[0].has_json_ld;
}

// --- pages ---

export async function ensurePage({ domainId, url, path, depth = 0 }) {
    const result = await query(ensurePageQuery, [domainId, url, path, depth]);
    return result.rows[0];
}

export async function getAllPages() {
    const result = await query(getAllPagesQuery);
    return result.rows;
}

export async function getPageByUrl(url) {
    const result = await query(getPageByUrlQuery, [url]);
    return result.rows[0] || null;
}

export async function markPageAsCrawled(pageId) {
    const result = await query(markPageAsCrawledQuery, [pageId]);
    return result.rows[0] || null;
}

export async function markPageAsSkipped(pageId) {
    const result = await query(markPageAsSkippedQuery, [pageId]);
    return result.rows[0] || null;
}

export async function getQueuedPages() {
    const result = await query(getQueuedPagesQuery);
    return result.rows;
}

export async function getNextQueuedPageForDomain(domainId) {
    const result = await query(getNextQueuedPageForDomainQuery, [domainId]);
    return result.rows[0] || null;
}

export async function countPagesForDomain(domainId) {
    const result = await query(countPagesForDomainQuery, [domainId]);
    return result.rows[0].count;
}

export async function updatePageAiReadiness(pageId, { found, types, count }) {
    const result = await query(updatePageAiReadinessQuery, [pageId, found, JSON.stringify(types), count]);
    return result.rows[0] || null;
}

export async function getPageReadinessCounts() {
    const result = await query(getPageReadinessCountsQuery);
    return result.rows[0];
}

export async function getPageStatusCounts() {
    const result = await query(getPageStatusCountsQuery);
    return result.rows;
}

export async function updatePageContent(pageId, { title, metaDescription, emails, phoneNumbers, socialLinks }) {
    const result = await query(updatePageContentQuery, [
        pageId,
        title || null,
        metaDescription || null,
        JSON.stringify(emails || []),
        JSON.stringify(phoneNumbers || []),
        JSON.stringify(socialLinks || []),
    ]);
    return result.rows[0] || null;
}

export async function getMostRecentCrawledPageForDomain(domainId) {
    const result = await query(getMostRecentCrawledPageForDomainQuery, [domainId]);
    return result.rows[0] || null;
}

export async function getDomainAggregatedContacts(domainId) {
    const result = await query(getDomainAggregatedContactsQuery, [domainId]);
    return result.rows[0];
}

// --- links ---

export async function ensureLink({ sourcePageId, targetPageId }) {
    const result = await query(ensureLinkQuery, [sourcePageId, targetPageId]);
    return result.rows[0] || null;
}

export async function getAllLinks() {
    const result = await query(getAllLinksQuery);
    return result.rows;
}

// --- sitemaps ---

export async function ensureSitemap({ domainId, url }) {
    const result = await query(ensureSitemapQuery, [domainId, url]);
    return result.rows[0];
}

export async function getAllSitemaps() {
    const result = await query(getAllSitemapsQuery);
    return result.rows;
}

export async function getSitemapById(id) {
    const result = await query(getSitemapByIdQuery, [id]);
    return result.rows[0] || null;
}

export async function markSitemapAsFetched(sitemapId) {
    const result = await query(markSitemapAsFetchedQuery, [sitemapId]);
    return result.rows[0] || null;
}

export async function getQueuedSitemaps() {
    const result = await query(getQueuedSitemapsQuery);
    return result.rows;
}

export async function getNextQueuedSitemap() {
    const result = await query(getNextQueuedSitemapQuery);
    return result.rows[0] || null;
}
