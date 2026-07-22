import { techStackRules } from './techStackRules.js';

// page: { html, scriptSrcs, metaGenerator, techHeaders: { server, poweredBy, cookieNames } }
export function detectTechStack(page) {
    const detected = [];

    for (const rule of techStackRules) {
        try {
            if (rule.test(page)) {
                detected.push(rule.name);
            }
        } catch {
            // A malformed page shouldn't take down detection for the rest of the rules.
        }
    }

    return detected;
}
