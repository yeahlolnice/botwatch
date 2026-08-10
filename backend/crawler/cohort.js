import { query } from '../utilities/connectDB.js';
import { getRootDomain } from './urlUtils.js';
import { getCategoryCohortQuery } from '../utilities/sqlCrawlerQuerys.js';

// A company only appears once per cohort (its registrable root domain), and we
// only surface benchmarking once there are enough OTHER companies to make a
// percentile meaningful — below this we'd be publishing "top 1 of 2".
const MIN_PEERS = 5;
// How many similar companies to list on the profile page.
const SIMILAR_LIMIT = 6;

// Rough colour band for a peer's 0-100 AI-readiness score chip. This mirrors
// the additive score in aiReadinessScore.js, not the ratio-based readiness
// band — it's just an at-a-glance tint for the list.
export function scoreKind(score) {
    if (score >= 60) return 'good';
    if (score >= 30) return 'warn';
    return 'bad';
}

// Where this domain stands among peers in the same category. Peers are other
// COMPANIES (rolled up to their root domain) sharing this domain's category.
// Returns null when the domain has no category/score or the cohort is too small
// to benchmark honestly — the caller then simply omits the section.
export async function getCohortComparison(domain) {
    if (!domain || !domain.category || domain.ai_readiness_score == null) return null;

    const rows = (await query(getCategoryCohortQuery, [domain.category])).rows;
    const self = getRootDomain(domain.hostname) || domain.hostname;

    // Everyone in the category except this company (its other subdomains rolled
    // up already, and its own root filtered out here).
    const peers = rows.filter((r) => r.company !== self);
    if (peers.length < MIN_PEERS) return null;

    const score = domain.ai_readiness_score;
    const below = peers.filter((p) => p.score < score).length;
    const percentile = Math.round((below / peers.length) * 100);

    // "Similar" = closest in readiness to this site (most comparable), shown
    // strongest-first for readability.
    const similar = [...peers]
        .sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score))
        .slice(0, SIMILAR_LIMIT)
        .sort((a, b) => b.score - a.score)
        .map((p) => ({ hostname: p.hostname, score: p.score, kind: scoreKind(p.score) }));

    return {
        category: domain.category,
        peersCount: peers.length,
        percentile,
        score,
        similar,
    };
}
