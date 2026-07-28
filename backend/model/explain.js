// Turns a score + its per-feature factors into a plain-English "why" sentence.
// Deterministic and template-based — no dependency, safe to run on every score.
// The `pos` phrase describes an above-average value, `neg` a below-average one;
// the explainer picks based on each driver's scaled value (z).
const PHRASES = {
    request_count_log: { pos: 'a high volume of requests', neg: 'very few requests' },
    path_diversity: { pos: 'requests spread across many paths', neg: 'repeated hits on a small set of paths' },
    ua_diversity: { pos: 'many rotating User-Agents', neg: 'a single consistent User-Agent' },
    ua_missing_ratio: { pos: 'frequently missing a User-Agent', neg: 'a consistently present User-Agent' },
    error_ratio: { pos: 'many error responses (probing)', neg: 'mostly successful responses' },
    non_get_ratio: { pos: 'a high share of non-GET requests', neg: 'almost entirely GET requests' },
    with_body_ratio: { pos: 'frequent request bodies (payloads)', neg: 'rarely any request body' },
    method_diversity: { pos: 'a wide mix of HTTP methods', neg: 'a single HTTP method' },
    request_rate_log: { pos: 'a rapid request rate', neg: 'a slow, human-like pace' },
};

function joinList(items) {
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function explainScore(score, factors) {
    const risky = score >= 50;

    // The drivers pushing the score in its direction, strongest first.
    const drivers = factors
        .filter((f) => (risky ? f.impact > 0 : f.impact < 0))
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 3)
        .map((f) => {
            const p = PHRASES[f.feature];
            if (!p) return null;
            return f.z >= 0 ? p.pos : p.neg;
        })
        .filter(Boolean);

    if (drivers.length === 0) {
        return risky
            ? `Elevated risk (score ${score}).`
            : `Low risk (score ${score}) — behaves like normal traffic.`;
    }

    return risky
        ? `High risk (score ${score}): shows ${joinList(drivers)}.`
        : `Low risk (score ${score}): ${joinList(drivers)}.`;
}
