import { quickReadinessScan } from '../crawler/quickScan.js';
import { parseUrlParts } from '../crawler/urlUtils.js';
import { getStripe } from '../utilities/stripeClient.js';
import { query } from '../utilities/connectDB.js';
import { insertReportOrderQuery, getReportByTokenQuery } from '../utilities/sqlReadinessQuerys.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPORT_PRICE_CENTS = 500; // $5.00 AUD
const baseUrl = (req) =>
    (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

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

// POST /api/readiness/report/checkout { url, email } — start a $5 AUD one-time
// Stripe Checkout for the full report. Uses inline price_data (no dashboard Price
// needed) and records a pending report_order; the webhook flips it to paid and
// the async pipeline (D) crawls + generates + emails the report.
export const createReportCheckout = async (req, res) => {
    const parsed = parseUrlParts((req.body?.url || '').trim());
    const email = (req.body?.email || '').toLowerCase().trim();
    if (!parsed) return res.status(400).json({ error: 'A valid website URL is required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });

    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet' });

    try {
        const base = baseUrl(req);
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: 'aud',
                    unit_amount: REPORT_PRICE_CENTS,
                    product_data: {
                        name: `AI-readiness report — ${parsed.hostname}`,
                        // Required by Stripe Managed Payments for inline prices so
                        // Stripe handles tax. "General - Electronically Supplied
                        // Services" fits a digital report delivered by email.
                        tax_code: 'txcd_10000000',
                    },
                },
            }],
            customer_email: email,
            metadata: { kind: 'readiness_report', url: parsed.fullUrl, hostname: parsed.hostname },
            success_url: `${base}/readiness-check?report=success`,
            cancel_url: `${base}/readiness-check`,
        });
        await query(insertReportOrderQuery, [session.id, parsed.fullUrl, parsed.hostname, email]);
        return res.json({ url: session.url });
    } catch (error) {
        console.error('Report checkout error:', error.message);
        return res.status(500).json({ error: 'Could not start checkout' });
    }
};

// GET /api/readiness/report/:token — the hosted full report, gated by the
// unguessable token from the delivery email. Public.
export const getReport = async (req, res) => {
    const token = (req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing report token' });
    try {
        const row = (await query(getReportByTokenQuery, [token])).rows[0];
        if (!row) return res.status(404).json({ error: 'Report not found' });
        return res.json({ hostname: row.hostname, generatedAt: row.updated_at, report: row.report_data });
    } catch (error) {
        console.error('getReport error:', error.message);
        return res.status(500).json({ error: 'Failed to load report' });
    }
};
