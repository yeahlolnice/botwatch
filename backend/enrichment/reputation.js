// Best-effort domain reputation via abuse.ch URLhaus. URLhaus now requires a
// free Auth-Key (register at auth.abuse.ch, set URLHAUS_AUTH_KEY in .env). If no
// key is configured, or the service is unavailable, this settles to
// { ok:false } and reputation is simply absent from the snapshot — never fatal.
// Designed to grow more sources (Safe Browsing, Spamhaus, cached AbuseIPDB).
export async function checkReputation(hostname) {
    const key = process.env.URLHAUS_AUTH_KEY;
    if (!key) return { ok: false, source: 'urlhaus', reason: 'no auth key configured' };

    let response;
    try {
        response = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Auth-Key': key },
            body: new URLSearchParams({ host: hostname }).toString(),
            signal: AbortSignal.timeout(10000),
        });
    } catch {
        return { ok: false, source: 'urlhaus', reason: 'request failed' };
    }

    if (!response.ok) return { ok: false, source: 'urlhaus', status: response.status };

    let data;
    try { data = await response.json(); } catch { return { ok: false, source: 'urlhaus', reason: 'invalid response' }; }

    if (data.query_status === 'ok') {
        return {
            ok: true,
            source: 'urlhaus',
            listed: true,
            urlCount: Number(data.url_count) || 0,
            blacklists: data.blacklists || null,
            firstSeen: data.firstseen || null,
        };
    }

    // no_results / invalid_host — a successful check that found nothing.
    return { ok: true, source: 'urlhaus', listed: false, queryStatus: data.query_status || null };
}
