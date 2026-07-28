import { getRootDomain } from '../crawler/urlUtils.js';

const UA = 'BotwatchBot/1.0 (+https://botwatch.xyz/willowbot)';

// Passive subdomain discovery from Certificate Transparency logs — no traffic to
// the target, just public records of issued certs. crt.sh is the primary source
// but is frequently overloaded (502s), so we fall back to certspotter.

async function fromCrtSh(root) {
    let res;
    try {
        res = await fetch(`https://crt.sh/?q=${encodeURIComponent('%.' + root)}&output=json`, {
            headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000),
        });
    } catch { return null; }
    if (!res.ok) return null;
    let rows;
    try { rows = await res.json(); } catch { return null; }

    const names = new Set();
    for (const row of rows) {
        for (const raw of String(row.name_value || '').split('\n')) addName(names, raw, root);
    }
    return names;
}

async function fromCertspotter(root) {
    let res;
    try {
        res = await fetch(
            `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(root)}&include_subdomains=true&expand=dns_names`,
            { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }
        );
    } catch { return null; }
    if (!res.ok) return null; // 429 when rate-limited without a key
    let rows;
    try { rows = await res.json(); } catch { return null; }

    const names = new Set();
    for (const row of rows) {
        for (const raw of row.dns_names || []) addName(names, raw, root);
    }
    return names;
}

function addName(set, raw, root) {
    const name = String(raw).trim().toLowerCase().replace(/^\*\./, '');
    if (name && name.endsWith(`.${root}`) && !name.includes(' ')) set.add(name);
}

export async function discoverSubdomains(hostname) {
    const root = getRootDomain(hostname) || hostname;

    let names = await fromCrtSh(root);
    let source = 'crt.sh';
    if (!names) { names = await fromCertspotter(root); source = 'certspotter'; }
    if (!names) return { ok: false, root, reason: 'all CT sources unavailable' };

    const subdomains = [...names].sort();
    return { ok: true, root, source, count: subdomains.length, subdomains: subdomains.slice(0, 500) };
}
