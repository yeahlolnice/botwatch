import { parseRobotsRules, isPathAllowedByRobots } from './robotsFetcher.js';
import { AI_TRAINING_BOTS } from './aiBots.js';

// Evaluates a domain's already-fetched robots.txt against a curated list of
// AI-training crawler user-agents — no extra network request, this reuses
// the same robots.txt body discoverSitemapsForDomain.js already has.
//
// hasExplicitPolicy distinguishes "this site named GPTBot specifically" from
// "GPTBot just inherited the site's default Disallow: * for everyone" — a
// site that has actually thought about AI crawlers (allow or block) is a
// stronger AI-readiness signal than one that hasn't addressed it at all.
export function getAiTrainingPolicy(robotsText) {
    const rules = parseRobotsRules(robotsText);
    const policy = {};
    let hasExplicitPolicy = false;

    for (const bot of AI_TRAINING_BOTS) {
        const key = bot.toLowerCase();

        if (Object.prototype.hasOwnProperty.call(rules, key)) {
            hasExplicitPolicy = true;
        }

        policy[bot] = isPathAllowedByRobots(robotsText, bot, '/') ? 'allowed' : 'blocked';
    }

    return { policy, hasExplicitPolicy };
}
