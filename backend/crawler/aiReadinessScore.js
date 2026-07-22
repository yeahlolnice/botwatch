import { getDomainByHostname, getDomainHasJsonLd, updateDomainAiReadinessScore } from './db.js';

// Additive 0-100 AI-readiness score. Each signal contributes independently —
// this isn't meant to be a precise measurement, just a rough at-a-glance
// summary for the site-profile page.
const WEIGHTS = {
    llmsTxtFound: 30,
    jsonLdFound: 20,
    aiTxtFound: 15,
    hasExplicitAiPolicy: 15,
    humansTxtFound: 10,
    termsUrlFound: 10,
};

export function calculateAiReadinessScore({
    llmsTxtFound,
    jsonLdFound,
    aiTxtFound,
    hasExplicitAiPolicy,
    humansTxtFound,
    termsUrlFound,
}) {
    let score = 0;

    if (llmsTxtFound) score += WEIGHTS.llmsTxtFound;
    if (jsonLdFound) score += WEIGHTS.jsonLdFound;
    if (aiTxtFound) score += WEIGHTS.aiTxtFound;
    if (hasExplicitAiPolicy) score += WEIGHTS.hasExplicitAiPolicy;
    if (humansTxtFound) score += WEIGHTS.humansTxtFound;
    if (termsUrlFound) score += WEIGHTS.termsUrlFound;

    return Math.max(0, Math.min(100, score));
}

// Re-reads the domain's current state (llms/ai/humans.txt, AI training
// policy, terms link — all set independently, at different points in the
// crawl — plus whether any of its crawled pages have found JSON-LD) and
// stores a freshly computed score. Safe to call repeatedly as new signals
// come in — every crawled page and every discoverSitemapsForDomain pass
// calls this so the score stays current rather than frozen at first-seen.
export async function recomputeAndStoreDomainScore(domainId, hostname) {
    const [domain, jsonLdFound] = await Promise.all([
        getDomainByHostname(hostname),
        getDomainHasJsonLd(domainId),
    ]);

    if (!domain) return null;

    const score = calculateAiReadinessScore({
        llmsTxtFound: domain.llms_txt_found,
        jsonLdFound,
        aiTxtFound: domain.ai_txt_found,
        hasExplicitAiPolicy: domain.ai_training_policy_explicit,
        humansTxtFound: domain.humans_txt_found,
        termsUrlFound: !!domain.terms_url,
    });

    return updateDomainAiReadinessScore(domainId, score);
}
