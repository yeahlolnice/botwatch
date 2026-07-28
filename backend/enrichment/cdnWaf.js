// Best-effort CDN / WAF detection from response headers, the hosting ASN name,
// and nameservers. Pure function — no network calls; it reuses data the other
// sources already gathered.
export function detectCdnWaf({ headers = {}, hosting = {}, dns = {} } = {}) {
    const h = headers || {};
    const asName = (hosting?.asName || '').toUpperCase();
    const server = (h.server || '').toLowerCase();
    const via = (h.via || '').toLowerCase();
    const ns = (dns?.ns || []).join(',').toLowerCase();
    const signals = [];
    let cdn = null;
    let waf = null;

    if (h['cf-ray'] || server.includes('cloudflare') || asName.includes('CLOUDFLARE') || ns.includes('cloudflare')) {
        cdn = 'Cloudflare'; waf = 'Cloudflare'; signals.push('cloudflare');
    } else if (h['x-amz-cf-id'] || via.includes('cloudfront')) {
        cdn = 'Amazon CloudFront'; signals.push('cloudfront');
    } else if (asName.includes('AKAMAI') || h['x-akamai-transformed'] || server.includes('akamai')) {
        cdn = 'Akamai'; signals.push('akamai');
    } else if (server.includes('fastly') || h['x-fastly-request-id'] || asName.includes('FASTLY')) {
        cdn = 'Fastly'; signals.push('fastly');
    } else if (asName.includes('GOOGLE') && (h.server || '').toLowerCase().includes('gws')) {
        cdn = 'Google'; signals.push('google');
    }

    // WAF hints independent of the CDN.
    if (!waf) {
        if (h['x-sucuri-id'] || h['x-sucuri-cache']) { waf = 'Sucuri'; signals.push('sucuri'); }
        else if (h['x-iinfo'] || server.includes('imperva') || server.includes('incapsula')) { waf = 'Imperva'; signals.push('imperva'); }
        else if (h['server'] && server.includes('awselb')) { waf = null; }
    }

    return { cdn, waf, signals };
}
