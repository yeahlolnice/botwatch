import { AI_TRAINING_BOTS, AI_BOT_META } from './aiBots.js';

// Turns a domain's stored ai_training_policy map ({ GPTBot: 'allowed', ... })
// into a display-ready access matrix for the company profile. Pure — no I/O;
// the policy is already computed at scan time by getAiTrainingPolicy.
//
// "Blocked" is a legitimate owner choice (opting out of AI training), so it's
// not treated as a failure — the matrix just reports who can reach the site.
// Returns null when we have no policy to show, so the caller omits the block.
export function buildAiCrawlerMatrix(policy, explicit) {
    if (!policy || typeof policy !== 'object') return null;

    const bots = AI_TRAINING_BOTS
        .filter((bot) => policy[bot] === 'allowed' || policy[bot] === 'blocked')
        .map((bot) => {
            const meta = AI_BOT_META[bot] || { operator: bot, purpose: 'Crawler' };
            return { bot, operator: meta.operator, purpose: meta.purpose, allowed: policy[bot] === 'allowed' };
        });

    if (bots.length === 0) return null;

    const allowedCount = bots.filter((b) => b.allowed).length;
    return {
        bots,
        allowedCount,
        total: bots.length,
        explicit: !!explicit,
    };
}
