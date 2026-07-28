import { query } from '../utilities/connectDB.js';
import { ipFeatureAggregatesQuery } from '../utilities/sqlModelQuerys.js';

// An IP is labelled malicious (positive) if it hit a honeypot, tripped any
// payload/threat signal, or scored high on the existing bot classifier. These
// labels come straight from data the tracker already produces — no manual
// labelling needed to start.
const MALICIOUS_BOT_SCORE = 50;

// The order here is the canonical feature order for the model's input vector.
// Ratios are already 0–1; counts are log-compressed to tame heavy tails.
export const FEATURE_NAMES = [
    'request_count_log',
    'path_diversity',      // distinct paths / requests — high = scanning
    'ua_diversity',        // distinct UAs / requests — high = UA rotation
    'ua_missing_ratio',
    'trap_ratio',
    'threat_ratio',
    'error_ratio',         // 4xx+5xx / requests — high = probing
    'non_get_ratio',
    'with_body_ratio',
    'method_diversity',
    'max_bot_score_norm',
    'avg_bot_score_norm',
    'request_rate_log',    // requests per active minute (log)
];

// Derived feature vector (as a named object) from one aggregate row.
export function computeFeatures(a) {
    const n = Number(a.request_count) || 0;
    const safe = n > 0 ? n : 1;
    const spanMin = Math.max((Number(a.span_seconds) || 0) / 60, 1);

    return {
        request_count_log: Math.log1p(n),
        path_diversity: Number(a.distinct_paths) / safe,
        ua_diversity: Number(a.distinct_uas) / safe,
        ua_missing_ratio: Number(a.ua_missing) / safe,
        trap_ratio: Number(a.trap_hits) / safe,
        threat_ratio: Number(a.threat_requests) / safe,
        error_ratio: (Number(a.status_4xx) + Number(a.status_5xx)) / safe,
        non_get_ratio: Number(a.non_get) / safe,
        with_body_ratio: Number(a.with_body) / safe,
        method_diversity: Number(a.distinct_methods) || 0,
        max_bot_score_norm: (Number(a.max_bot_score) || 0) / 100,
        avg_bot_score_norm: (Number(a.avg_bot_score) || 0) / 100,
        request_rate_log: Math.log1p(n / spanMin),
    };
}

export function labelRow(a) {
    return Number(a.trap_hits) > 0
        || Number(a.threat_requests) > 0
        || Number(a.max_bot_score) >= MALICIOUS_BOT_SCORE
        ? 1 : 0;
}

// Ordered numeric vector for a features object — the model's actual input.
export function featureVector(features) {
    return FEATURE_NAMES.map((name) => features[name] ?? 0);
}

// The full labelled dataset: one row per IP with its feature object + label.
export async function extractIpFeatureRows() {
    const result = await query(ipFeatureAggregatesQuery);
    return result.rows.map((a) => ({
        ip: a.ip,
        requestCount: Number(a.request_count),
        features: computeFeatures(a),
        label: labelRow(a),
    }));
}
