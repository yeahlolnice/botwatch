import { safeFetch } from '../crawler/ssrfGuard.js';

// The headers that matter for a defensive posture grade.
const CHECKS = [
    ['strict-transport-security', 'HSTS'],
    ['content-security-policy', 'CSP'],
    ['x-frame-options', 'X-Frame-Options'],
    ['x-content-type-options', 'X-Content-Type-Options'],
    ['referrer-policy', 'Referrer-Policy'],
    ['permissions-policy', 'Permissions-Policy'],
];

// Fetches the homepage (via SSRF-safe fetch, which also follows redirects) and
// grades which security headers are present. Returns the full header map too,
// so CDN/WAF detection can reuse it without a second request.
export async function checkSecurityHeaders(hostname) {
    let response;
    try {
        response = await safeFetch(`https://${hostname}/`, {
            headers: { 'User-Agent': 'BotwatchBot/1.0 (+https://botwatch.xyz/willowbot)' },
            signal: AbortSignal.timeout(12000),
        });
    } catch {
        return { ok: false, reason: 'fetch failed' };
    }

    const headers = {};
    for (const [k, v] of response.headers) headers[k.toLowerCase()] = v;

    const present = [];
    const missing = [];
    for (const [key, label] of CHECKS) {
        if (headers[key]) present.push(label); else missing.push(label);
    }

    const score = Math.round((present.length / CHECKS.length) * 100);
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 50 ? 'C' : score >= 25 ? 'D' : 'F';

    return {
        ok: true,
        status: response.status,
        grade,
        score,
        present,
        missing,
        server: headers.server || null,
        // Not persisted — used by the orchestrator for CDN/WAF detection.
        headers,
    };
}
