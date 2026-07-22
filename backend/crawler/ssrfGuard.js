// SSRF protection for the crawler. Every outbound crawler request ultimately
// targets a hostname that originated from untrusted content (a link on a
// crawled page, a robots.txt Sitemap: line, a sitemap.xml <loc> entry) — not
// just admin-supplied seeds. Without this guard, the server would happily
// issue requests to any address it can route to, including the rest of the
// home network it runs on (192.168.x.x, 127.0.0.1, etc).
//
// This module is deliberately conservative rather than exhaustive: it uses
// Node's built-in dns/net modules (no extra dependency) to reject the IP
// ranges that matter for this threat model (private/loopback/link-local/
// reserved), not a fully spec-complete IP-range database.

import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_IPV4_CIDRS = [
    '0.0.0.0/8',
    '10.0.0.0/8',
    '100.64.0.0/10', // CGNAT
    '127.0.0.0/8',
    '169.254.0.0/16', // link-local, incl. cloud metadata endpoints
    '172.16.0.0/12',
    '192.0.0.0/24',
    '192.0.2.0/24',
    '192.168.0.0/16',
    '198.18.0.0/15',
    '198.51.100.0/24',
    '203.0.113.0/24',
    '224.0.0.0/4', // multicast
    '240.0.0.0/4', // reserved
    '255.255.255.255/32',
];

const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];

function ipv4ToInt(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
        return null;
    }
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpv4InCidr(ip, cidr) {
    const [range, bitsStr] = cidr.split('/');
    const bits = Number(bitsStr);
    const ipInt = ipv4ToInt(ip);
    const rangeInt = ipv4ToInt(range);
    if (ipInt === null || rangeInt === null) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
}

function isBlockedIpv4(ip) {
    return BLOCKED_IPV4_CIDRS.some(cidr => isIpv4InCidr(ip, cidr));
}

function isBlockedIpv6(ip) {
    const lower = ip.toLowerCase();

    if (lower === '::1' || lower === '::') return true;
    // fe80::/10 link-local
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
    // fc00::/7 unique local
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;

    // IPv4-mapped/compatible addresses — check the embedded IPv4.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIpv4(mapped[1]);

    return false;
}

// Resolves the hostname (literal IPs are checked directly, names via DNS)
// and returns true if it — or anything it resolves to — is a
// private/loopback/link-local/reserved address.
export async function isHostnameBlocked(hostname) {
    if (!hostname) return true;

    const lower = hostname.toLowerCase();

    if (lower === 'localhost' || BLOCKED_HOSTNAME_SUFFIXES.some(suffix => lower.endsWith(suffix))) {
        return true;
    }

    const ipType = net.isIP(hostname);
    if (ipType === 4) return isBlockedIpv4(hostname);
    if (ipType === 6) return isBlockedIpv6(hostname);

    let records;
    try {
        records = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
        // Unresolvable — let the fetch itself fail naturally; not a security decision.
        return false;
    }

    return records.some(r => (r.family === 4 ? isBlockedIpv4(r.address) : isBlockedIpv6(r.address)));
}

export class SsrfBlockedError extends Error {
    constructor(url) {
        super(`Blocked outbound request to ${url}: resolves to a private/internal address`);
        this.name = 'SsrfBlockedError';
    }
}

// Drop-in replacement for fetch() that rejects non-http(s) schemes, rejects
// private/internal hosts, and manually validates every redirect hop (fetch's
// automatic redirect-following would otherwise let a public host 302 to an
// internal one and bypass the check entirely).
export async function safeFetch(url, options = {}, redirectsLeft = 5) {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new SsrfBlockedError(url);
    }

    if (await isHostnameBlocked(parsed.hostname)) {
        throw new SsrfBlockedError(url);
    }

    const response = await fetch(url, { ...options, redirect: 'manual' });

    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');

        if (!location) return response;
        if (redirectsLeft <= 0) throw new Error(`Blocked fetch: too many redirects from ${url}`);

        const nextUrl = new URL(location, url).toString();
        return safeFetch(nextUrl, options, redirectsLeft - 1);
    }

    return response;
}
