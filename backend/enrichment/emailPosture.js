import dns from 'node:dns/promises';

const settle = (p) => p.then((v) => v, () => null);
const flatTxt = (records) => (records || []).map((chunks) => chunks.join(''));

// Grades a domain's email anti-spoofing posture from its DNS: SPF (root TXT) and
// DMARC (_dmarc TXT). DKIM can't be checked without knowing the selector, so we
// report it as unknown rather than guess. Passive — DNS only.
export async function checkEmailPosture(hostname, rootTxt) {
    const txt = rootTxt && rootTxt.length ? rootTxt : flatTxt(await settle(dns.resolveTxt(hostname)));
    const spf = txt.find((r) => /^v=spf1/i.test(r)) || null;

    const dmarcTxt = flatTxt(await settle(dns.resolveTxt(`_dmarc.${hostname}`)));
    const dmarc = dmarcTxt.find((r) => /^v=DMARC1/i.test(r)) || null;
    const dmarcPolicy = dmarc ? (dmarc.match(/\bp=(\w+)/i)?.[1]?.toLowerCase() || null) : null;

    // Score: SPF present (40), DMARC present (30), DMARC actually enforcing (30).
    let score = 0;
    if (spf) score += 40;
    if (dmarc) {
        score += 30;
        if (dmarcPolicy && dmarcPolicy !== 'none') score += 30;
    }
    const grade = score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 40 ? 'C' : score > 0 ? 'D' : 'F';

    return {
        spfPresent: !!spf,
        spfRecord: spf,
        dmarcPresent: !!dmarc,
        dmarcRecord: dmarc,
        dmarcPolicy,
        dkim: 'unknown', // needs a selector to check — deferred
        score,
        grade,
    };
}
