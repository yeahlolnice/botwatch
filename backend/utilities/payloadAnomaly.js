import { buildTargets, excerpt } from './payloadAnalyzer.js';

// Novel-payload / anomaly detector. Flags requests that *look* attack-shaped but
// match no known signature — the "possible 0-day / unclassified" signal. Pure;
// reuses payloadAnalyzer's target flattening + excerpting. Conservative on
// purpose: the output feeds a human triage queue, not an automatic block.
//
// The caller marks a request suspicious_unclassified when scoreAnomaly() clears
// ANOMALY_THRESHOLD *and* the signature engine found nothing.
export const ANOMALY_THRESHOLD = 40;

const STANDARD_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const INJECTION_CHARS = /[;|&$(){}<>]/g;
const NULL_BYTE = /%00|\\x00/;

// Shannon entropy (bits/char) — encoded/obfuscated blobs run high (~4.5-6),
// natural text and form data run lower.
function entropy(str) {
    const freq = new Map();
    for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1);
    let e = 0;
    for (const n of freq.values()) {
        const p = n / str.length;
        e -= p * Math.log2(p);
    }
    return e;
}

export function scoreAnomaly(parts) {
    const targets = buildTargets(parts);
    const reasons = [];
    let score = 0;
    const flag = (id, points, source, value, index) => {
        score += points;
        reasons.push({ id, source, excerpt: value != null ? excerpt(value, index || 0, 120) : null });
    };

    const method = String(parts.method || '').toUpperCase();
    const rawBody = parts.rawBody || (typeof parts.body === 'string' ? parts.body : null);
    const hasBody = !!(parts.rawBody
        || (parts.body && (typeof parts.body === 'string' ? parts.body.length : Object.keys(parts.body).length)));

    // 1. Null bytes anywhere — almost never legitimate.
    for (const { source, value } of targets) {
        if (value && NULL_BYTE.test(value)) { flag('null_byte', 30, source, value, value.search(/%00|\\x00/)); break; }
    }

    // 2. High-entropy / oversized raw body — encoded or obfuscated payload.
    if (rawBody && rawBody.length >= 64 && entropy(rawBody) >= 4.5) flag('high_entropy_body', 25, 'raw_body', rawBody, 0);
    if (rawBody && rawBody.length >= 8192) flag('oversized_body', 10, 'raw_body', rawBody, 0);

    // 3. Heavy percent-encoding or \x/\u escapes in a single value — evasion.
    for (const { source, value } of targets) {
        if (!value) continue;
        if ((value.match(/%[0-9a-f]{2}/gi) || []).length >= 8 || (value.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi) || []).length >= 4) {
            flag('encoding_heavy', 20, source, value, 0);
            break;
        }
    }

    // 4. Dense injection/shell metacharacters without a matching signature.
    for (const { source, value } of targets) {
        if (value && (value.match(INJECTION_CHARS) || []).length >= 6) { flag('injection_shape', 20, source, value, 0); break; }
    }

    // 5. Method/body oddities.
    if (method && !STANDARD_METHODS.has(method)) flag('nonstandard_method', 15, 'method', method, 0);
    else if ((method === 'GET' || method === 'HEAD') && hasBody) flag('body_on_get', 15, 'method', method, 0);

    // 6. Overlong query value.
    for (const { source, value } of targets) {
        if (source.startsWith('query.') && value && value.length >= 512) { flag('long_query_value', 10, source, value, 0); break; }
    }

    // 7. Body-bearing request with no User-Agent — automated, not a browser.
    const headers = parts.headers || {};
    if (hasBody && !headers['user-agent'] && !headers['User-Agent']) flag('missing_ua_body', 15, 'header.user-agent', null, 0);

    return { anomalyScore: Math.min(score, 100), reasons };
}
