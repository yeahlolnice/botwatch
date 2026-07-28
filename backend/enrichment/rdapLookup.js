import { getRootDomain } from '../crawler/urlUtils.js';

// RDAP is the modern, structured replacement for scraping WHOIS/who.is. We query
// rdap.org, a public redirector that forwards to the authoritative registry's
// RDAP server, and parse the standard JSON response. No API key, no scraping.

const RDAP_BASE = 'https://rdap.org/domain/';
const RDAP_TIMEOUT_MS = 10000;

function eventDate(data, action) {
    return data.events?.find((e) => e.eventAction === action)?.eventDate || null;
}

// Registrar / registrant names live in a jCard (vcardArray). Pull the formatted
// name ("fn") field out of the entity with the given role.
function entityName(data, role) {
    const entity = data.entities?.find((e) => e.roles?.includes(role));
    const fn = entity?.vcardArray?.[1]?.find((field) => field[0] === 'fn');
    return fn?.[3] || null;
}

export async function lookupRdap(hostname) {
    const domain = getRootDomain(hostname) || hostname;

    let response;
    try {
        response = await fetch(`${RDAP_BASE}${encodeURIComponent(domain)}`, {
            headers: { Accept: 'application/rdap+json' },
            signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
        });
    } catch {
        return { ok: false, domain, reason: 'request failed' };
    }

    if (!response.ok) {
        // 404 is normal for TLDs without RDAP or unregistered domains.
        return { ok: false, domain, status: response.status };
    }

    let data;
    try {
        data = await response.json();
    } catch {
        return { ok: false, domain, reason: 'invalid response' };
    }

    const registeredAt = eventDate(data, 'registration');
    const ageDays = registeredAt
        ? Math.floor((Date.now() - new Date(registeredAt).getTime()) / 86400000)
        : null;

    return {
        ok: true,
        domain,
        registrar: entityName(data, 'registrar'),
        registrantOrg: entityName(data, 'registrant'),
        registeredAt,
        updatedAt: eventDate(data, 'last changed'),
        expiresAt: eventDate(data, 'expiration'),
        ageDays,
        statuses: data.status || [],
        nameservers: (data.nameservers || []).map((n) => n.ldhName).filter(Boolean),
    };
}
