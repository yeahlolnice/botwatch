import crypto from 'node:crypto';
import { query } from '../utilities/connectDB.js';
import { deepReadinessScan } from '../crawler/deepScan.js';
import { sendEmail } from '../utilities/emailClient.js';
import {
    claimNextPaidReportOrderQuery,
    setReportGeneratedQuery,
    markReportSentQuery,
    markReportFailedQuery,
} from '../utilities/sqlReadinessQuerys.js';

// Async fulfillment for paid AI-readiness reports (funnel D). A lightweight
// in-process poller claims paid orders, runs the deep scan, stores the report
// snapshot, and emails a link. Polling (rather than acting straight off the
// webhook) is resilient: a missed webhook or a restart mid-generation is simply
// retried on the next tick.
const POLL_MS = 15000;
const MAX_PER_TICK = 3;
let running = false;

const baseUrl = () => (process.env.PUBLIC_BASE_URL || 'https://botwatch.xyz').replace(/\/+$/, '');

// Processes one paid order. Returns true if it handled an order, false if none
// were waiting (so the tick loop knows when to stop draining).
export async function processNextReportOrder() {
    const order = (await query(claimNextPaidReportOrderQuery)).rows[0];
    if (!order) return false;

    try {
        const report = await deepReadinessScan(order.target_url);
        const token = crypto.randomBytes(18).toString('base64url');
        await query(setReportGeneratedQuery, [order.id, token, JSON.stringify(report)]);

        const link = `${baseUrl()}/readiness-report/${token}`;
        const band = report.assessment?.band || '—';
        const email = await sendEmail({
            to: order.email,
            subject: `Your AI-readiness report for ${order.hostname}`,
            text: `Your AI-readiness report for ${order.hostname} is ready — overall band: ${band}.\n\nView your full report:\n${link}\n\nThanks for using botwatch.`,
            html: `<p>Your AI-readiness report for <strong>${order.hostname}</strong> is ready — overall band: <strong>${band}</strong>.</p>`
                + `<p><a href="${link}">View your full report</a></p>`
                + `<p style="color:#666;font-size:12px">If the link doesn't work, paste this into your browser:<br>${link}</p>`,
        });

        // The report is viewable via its token regardless; only the delivery
        // status distinguishes sent vs failed (inert dev mode counts as ok).
        const delivered = email.delivered || email.logged;
        await query(delivered ? markReportSentQuery : markReportFailedQuery, [order.id]);
        return true;
    } catch (error) {
        console.error(`Report generation failed for order ${order.id}:`, error.message);
        try { await query(markReportFailedQuery, [order.id]); } catch { /* ignore */ }
        return true;
    }
}

export function startReportWorker() {
    setInterval(async () => {
        if (running) return; // never let ticks overlap
        running = true;
        try {
            let n = 0;
            while (n < MAX_PER_TICK && await processNextReportOrder()) n++;
        } catch (error) {
            console.error('Report worker tick error:', error.message);
        } finally {
            running = false;
        }
    }, POLL_MS);
    console.log(`[reports] fulfillment worker started (poll ${POLL_MS / 1000}s)`);
}
