import { quickReadinessScan } from '../crawler/quickScan.js';

// POST /api/readiness/scan { url } — public. Runs the fast homepage-only scan
// and returns the FREE TEASER: which signals are present/missing per pillar, the
// coarse band, and how many recommendations are locked. The actual recommendation
// text (the "how to fix it") is deliberately withheld — that's the paid report.
export const scanReadiness = async (req, res) => {
    const url = (req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'A website URL is required' });

    try {
        const result = await quickReadinessScan(url);
        const { assessment } = result;

        // Signal labels + present/absent only — never the recommendation text.
        const pillar = (p) => ({
            present: p.present,
            total: p.total,
            signals: p.checks
                .filter((c) => !c.notApplicable)
                .map((c) => ({ label: c.label, present: c.present })),
        });

        return res.json({
            hostname: result.hostname,
            reachable: result.reachable,
            band: assessment.band,
            pillars: {
                legibility: pillar(assessment.legibility),
                actionability: pillar(assessment.actionability),
            },
            webmcpTools: result.webmcpToolCount,
            lockedRecommendations: assessment.recommendations.length,
        });
    } catch (error) {
        return res.status(400).json({ error: error.message || 'Could not scan that site' });
    }
};
