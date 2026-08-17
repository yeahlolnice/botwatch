// Reprocess stored request_tracking rows through the upgraded payload analyzer,
// backfilling attack_intent/severity/cve_ids + the anomaly (novel-payload)
// columns so the whole capture history becomes classified intel.
//
// Run from the backend/ directory (so dotenv finds backend/.env), on PROD where
// the full history lives:
//   node scripts/reclassifyRequests.js            # only rows not yet classified
//   node scripts/reclassifyRequests.js --all      # re-score everything
//   node scripts/reclassifyRequests.js --dry-run  # count only, write nothing
//   node scripts/reclassifyRequests.js --limit 1000 --batch 200
import { query } from '../utilities/connectDB.js';
import { analyzeRequest } from '../utilities/payloadAnalyzer.js';
import { scoreAnomaly, ANOMALY_THRESHOLD } from '../utilities/payloadAnomaly.js';
import {
    getRequestsForReclassifyQuery,
    updateRequestClassificationQuery,
} from '../utilities/sqlTrackingQuerys.js';

const args = process.argv.slice(2);
const all = args.includes('--all');
const dryRun = args.includes('--dry-run');
const numArg = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : def;
};
const batchSize = numArg('--batch', 500);
const limit = numArg('--limit', Infinity);

// Rebuild the analyzer's inspection targets from a stored row.
const rowToParts = (row) => ({
    method: row.method,
    path: row.path,
    originalUrl: row.full_url || row.path,
    query: row.query_params || {},
    headers: row.headers || {},
    rawBody: row.raw_body || null,
    body: row.body ?? null,
});

async function main() {
    console.log(`Reclassify: ${all ? 'ALL rows' : 'unclassified rows'}${dryRun ? ' (dry-run)' : ''}, batch=${batchSize}, limit=${limit}`);
    let lastId = 0;
    let processed = 0;
    let flaggedSuspicious = 0;
    let withSignatures = 0;

    for (;;) {
        const size = Math.min(batchSize, limit - processed);
        if (size <= 0) break;
        const { rows } = await query(getRequestsForReclassifyQuery, [lastId, size, !all]);
        if (rows.length === 0) break;

        for (const row of rows) {
            const parts = rowToParts(row);
            const { signals, threatScore, classification } = analyzeRequest(parts);
            const { anomalyScore, reasons } = scoreAnomaly(parts);
            const suspicious = anomalyScore >= ANOMALY_THRESHOLD && signals.length === 0;
            if (signals.length) withSignatures += 1;
            if (suspicious) flaggedSuspicious += 1;

            if (!dryRun) {
                await query(updateRequestClassificationQuery, [
                    row.id,
                    signals.length ? JSON.stringify(signals) : null,
                    threatScore,
                    classification.primaryIntent,
                    classification.severity,
                    classification.cves.length ? JSON.stringify(classification.cves) : null,
                    anomalyScore,
                    reasons.length ? JSON.stringify(reasons) : null,
                    suspicious,
                ]);
            }
        }

        lastId = rows[rows.length - 1].id;
        processed += rows.length;
        console.log(`  …${processed} processed (through id ${lastId})`);
    }

    console.log(`Done. ${processed} rows${dryRun ? ' (nothing written)' : ' updated'} · ${withSignatures} matched a signature · ${flaggedSuspicious} flagged novel/suspicious.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Reclassify failed:', err);
    process.exit(1);
});
