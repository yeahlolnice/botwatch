import dns from 'node:dns/promises';

const settle = (p) => p.then((v) => v, () => null);

// IP → ASN / network owner using Team Cymru's free DNS-based service. Reverse the
// octets and query origin.asn.cymru.com TXT for the ASN + prefix + country, then
// AS{n}.asn.cymru.com TXT for the AS name. Passive, keyless, no traffic to the
// target — it's all DNS.
export async function lookupHosting(ip) {
    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return { ok: false, reason: 'no ipv4 address' };
    }

    const reversed = ip.split('.').reverse().join('.');
    const originTxt = await settle(dns.resolveTxt(`${reversed}.origin.asn.cymru.com`));
    if (!originTxt) return { ok: false, ip, reason: 'no asn data' };

    // "13335 | 104.16.0.0/13 | US | arin | 2011-11-15"
    const parts = originTxt[0].join('').split('|').map((s) => s.trim());
    const asnNum = parts[0]?.split(/\s+/)[0] || null;
    const prefix = parts[1] || null;
    const country = parts[2] || null;
    const registry = parts[3] || null;

    let asName = null;
    if (asnNum) {
        const asTxt = await settle(dns.resolveTxt(`AS${asnNum}.asn.cymru.com`));
        if (asTxt) {
            // "13335 | US | arin | 2010-07-14 | CLOUDFLARENET, US"
            asName = asTxt[0].join('').split('|').map((s) => s.trim())[4] || null;
        }
    }

    return {
        ok: true,
        ip,
        asn: asnNum ? `AS${asnNum}` : null,
        asName,
        prefix,
        country,
        registry,
    };
}
