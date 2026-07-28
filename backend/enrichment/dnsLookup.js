import dns from 'node:dns/promises';

// Resolve a promise to its value, or null on any error (NXDOMAIN, no records,
// timeout). Each record type is looked up independently so one missing type
// never blanks the whole result.
const settle = (p) => p.then((v) => v, () => null);

// Passive DNS enrichment — pure name resolution, no traffic to the target site.
export async function lookupDns(hostname) {
    const [a, aaaa, mx, ns, txt, cname, soa, caa] = await Promise.all([
        settle(dns.resolve4(hostname)),
        settle(dns.resolve6(hostname)),
        settle(dns.resolveMx(hostname)),
        settle(dns.resolveNs(hostname)),
        settle(dns.resolveTxt(hostname)),
        settle(dns.resolveCname(hostname)),
        settle(dns.resolveSoa(hostname)),
        settle(dns.resolveCaa(hostname)),
    ]);

    return {
        a: a || [],
        aaaa: aaaa || [],
        // MX comes back as { exchange, priority } — keep both.
        mx: mx || [],
        ns: ns || [],
        // TXT records arrive as arrays of string chunks; join each into one string.
        txt: (txt || []).map((chunks) => chunks.join('')),
        cname: cname || [],
        soa: soa || null,
        caa: caa || [],
    };
}
