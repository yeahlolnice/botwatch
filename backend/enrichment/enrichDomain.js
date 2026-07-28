import { lookupDns } from './dnsLookup.js';
import { lookupRdap } from './rdapLookup.js';
import { checkEmailPosture } from './emailPosture.js';

const settle = (p) => p.then((v) => v, () => null);

// Orchestrates the passive enrichment sources for one domain into a single
// snapshot. Every source is isolated (settle) so one failure never sinks the
// rest. New sources (tls, security_headers, hosting, reputation, subdomains)
// slot in here as later Phase-1 increments land.
export async function enrichDomain(hostname) {
    const [dns, whois] = await Promise.all([
        settle(lookupDns(hostname)),
        settle(lookupRdap(hostname)),
    ]);

    // Email posture reuses the root TXT records DNS already fetched.
    const emailPosture = await settle(checkEmailPosture(hostname, dns?.txt));

    return {
        hostname,
        collectedAt: new Date().toISOString(),
        dns,
        whois,
        emailPosture,
    };
}
