import { lookupDns } from './dnsLookup.js';
import { lookupRdap } from './rdapLookup.js';
import { checkEmailPosture } from './emailPosture.js';
import { inspectTls } from './tlsCert.js';
import { checkSecurityHeaders } from './securityHeaders.js';
import { lookupHosting } from './hosting.js';
import { detectCdnWaf } from './cdnWaf.js';
import { checkReputation } from './reputation.js';
import { discoverSubdomains } from './subdomains.js';

const settle = (p) => p.then((v) => v, () => null);

// Orchestrates all passive enrichment sources for one domain into a single
// timestamped snapshot. Every source is isolated (settle) so one failure never
// sinks the rest. Sources that don't touch the target (DNS, RDAP, hosting via
// Cymru DNS, CT logs, URLhaus) and the light Tier-02 ones (TLS handshake,
// homepage headers — both SSRF-guarded) run together.
export async function enrichDomain(hostname) {
    const [dns, whois, tls, securityHeadersRaw, reputation, subdomains] = await Promise.all([
        settle(lookupDns(hostname)),
        settle(lookupRdap(hostname)),
        settle(inspectTls(hostname)),
        settle(checkSecurityHeaders(hostname)),
        settle(checkReputation(hostname)),
        settle(discoverSubdomains(hostname)),
    ]);

    // Email posture reuses the root TXT records DNS already fetched.
    const emailPosture = await settle(checkEmailPosture(hostname, dns?.txt));

    // Hosting needs a resolved IPv4; CDN/WAF reuses the header map + hosting.
    const hosting = await settle(lookupHosting(dns?.a?.[0]));
    const cdnWaf = detectCdnWaf({ headers: securityHeadersRaw?.headers, hosting, dns });
    if (hosting && hosting.ok) Object.assign(hosting, cdnWaf);

    // Drop the raw header map before storing — it was only for CDN detection.
    let securityHeaders = securityHeadersRaw;
    if (securityHeaders && securityHeaders.headers) {
        const { headers, ...rest } = securityHeaders;
        securityHeaders = rest;
    }

    return {
        hostname,
        collectedAt: new Date().toISOString(),
        dns,
        whois,
        emailPosture,
        tls,
        securityHeaders,
        hosting,
        reputation,
        subdomains,
    };
}
