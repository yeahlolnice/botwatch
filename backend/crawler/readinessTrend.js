// Builds an adoption-trend view from a domain's AI-readiness score history
// (domain_score_history rows, ascending by collected_at). Pure. Returns null
// until there are at least two readings — one point isn't a trend.
export function buildReadinessTrend(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return null;

    const points = rows
        .map((r) => ({ score: Number(r.score), at: r.collected_at }))
        .filter((p) => Number.isFinite(p.score));
    if (points.length < 2) return null;

    const first = points[0];
    const current = points[points.length - 1];
    const delta = current.score - first.score;

    return {
        first,
        current,
        delta,
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        readings: points.length,
        scores: points.map((p) => p.score),
    };
}
