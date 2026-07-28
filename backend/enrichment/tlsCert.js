import tls from 'node:tls';
import { isHostnameBlocked } from '../crawler/ssrfGuard.js';

// Inspects the TLS certificate served on :443. Tier-02 (a normal TLS handshake),
// but it connects TO the target, so we SSRF-guard the hostname first. We keep
// rejectUnauthorized:false on purpose — an expired/self-signed cert is exactly
// the kind of thing we want to report, not throw on.
export async function inspectTls(hostname, port = 443) {
    if (await isHostnameBlocked(hostname)) {
        return { ok: false, reason: 'blocked host' };
    }

    return new Promise((resolve) => {
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };

        const socket = tls.connect(
            { host: hostname, port, servername: hostname, timeout: 10000, rejectUnauthorized: false },
            () => {
                const cert = socket.getPeerCertificate(true);
                const protocol = socket.getProtocol();
                socket.end();

                if (!cert || !cert.valid_to) { done({ ok: false, reason: 'no certificate' }); return; }

                const validTo = new Date(cert.valid_to);
                const validFrom = new Date(cert.valid_from);
                const daysToExpiry = Math.floor((validTo.getTime() - Date.now()) / 86400000);
                const san = (cert.subjectaltname || '')
                    .split(',').map((s) => s.replace(/^\s*DNS:/i, '').trim()).filter(Boolean);

                done({
                    ok: true,
                    subject: cert.subject?.CN || null,
                    issuer: cert.issuer?.O || cert.issuer?.CN || null,
                    validFrom: validFrom.toISOString(),
                    validTo: validTo.toISOString(),
                    daysToExpiry,
                    expired: daysToExpiry < 0,
                    sanCount: san.length,
                    san: san.slice(0, 50),
                    keyType: cert.asn1Curve ? `EC ${cert.asn1Curve}` : (cert.bits ? `RSA ${cert.bits}` : null),
                    serialNumber: cert.serialNumber || null,
                    protocol,
                });
            }
        );

        socket.on('error', () => done({ ok: false, reason: 'connection error' }));
        socket.on('timeout', () => { socket.destroy(); done({ ok: false, reason: 'timeout' }); });
    });
}
