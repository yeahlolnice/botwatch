import { query } from '../utilities/connectDB.js';
import { getPublicStatsQuery, getPublicAttackBreakdownQuery } from '../utilities/sqlPublicQuerys.js';

const SITE = 'https://botwatch.xyz';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const num = (n) => Number(n || 0).toLocaleString('en-US');

// GET /methodology — public, server-rendered authority page describing how
// botwatch detects malicious bots and threat actors. Weaves in live aggregate
// numbers (counts only — never individual IPs, payloads, or captured content).
export const getMethodology = async (req, res) => {
    let stats = {};
    let attacks = [];
    try {
        const [s, a] = await Promise.all([
            query(getPublicStatsQuery).then((r) => r.rows[0] || {}).catch(() => ({})),
            query(getPublicAttackBreakdownQuery).then((r) => r.rows).catch(() => []),
        ]);
        stats = s; attacks = a.slice(0, 8);
    } catch { /* render with whatever we have — the page is useful without live numbers */ }

    res.set('Cache-Control', 'public, max-age=1800');
    return res.status(200).type('html').send(renderMethodology(stats, attacks));
};

export function renderMethodology(stats = {}, attacks = []) {
    const title = 'How botwatch detects malicious bots — methodology';
    const desc = 'How botwatch.xyz identifies malicious bots, crawlers, and threat actors: honeypots, a behavioural machine-learning model, payload & CVE signature analysis, novel-payload detection, and passive enrichment.';
    const canonical = `${SITE}/methodology`;

    const stat = (label, value) => `<div class="stat"><b>${esc(num(value))}</b><span>${esc(label)}</span></div>`;
    const attackChips = attacks.length
        ? `<div class="chips">${attacks.map((a) => `<span class="chip">${esc(a.category)} · ${esc(num(a.occurrences))}</span>`).join('')}</div>`
        : '';

    const method = (n, h, body) => `
      <section class="m">
        <div class="mnum">${n}</div>
        <div><h2>${h}</h2>${body}</div>
      </section>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${esc(canonical)}">
<style>
  :root{--bg:#0b0f10;--surface:#111a1c;--border:#223032;--text:#e7edec;--dim:#8ea09f;--teal:#33cdba;--red:#ef6b6b;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.65}
  a{color:var(--teal)}
  .nav{max-width:860px;margin:0 auto;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;font-size:14px}
  .nav .brand{font-weight:800;color:var(--text);text-decoration:none;font-size:16px}
  .nav .brand span{color:var(--teal)}
  .nav a{color:var(--dim);text-decoration:none;margin-left:16px}
  main{max-width:860px;margin:0 auto;padding:10px 24px 70px}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--teal)}
  h1{font-size:32px;letter-spacing:-.5px;margin:8px 0 14px;font-weight:800}
  .lead{font-size:17px;color:var(--dim);max-width:64ch;margin:0 0 26px}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 12px}
  .stat{border:1px solid var(--border);border-radius:12px;padding:16px 18px;background:var(--surface)}
  .stat b{display:block;font-size:24px;font-family:var(--mono)}
  .stat span{font-size:12px;color:var(--dim)}
  .live-note{font-size:12px;color:var(--dim);margin:0 0 30px}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
  .chip{font-size:12px;font-family:var(--mono);border:1px solid var(--border);border-radius:20px;padding:5px 12px;color:var(--dim);background:var(--surface)}
  .m{display:flex;gap:18px;padding:22px 0;border-top:1px solid var(--border)}
  .mnum{font-family:var(--mono);color:var(--teal);font-weight:800;font-size:15px;min-width:28px}
  .m h2{font-size:19px;margin:0 0 8px}
  .m p{margin:0 0 8px;max-width:64ch}
  code{font-family:var(--mono);font-size:.86em;background:#0c1416;border:1px solid var(--border);border-radius:5px;padding:1px 5px;color:var(--teal)}
  .privacy{border:1px solid color-mix(in srgb,var(--teal) 40%,var(--border));border-radius:14px;padding:20px 22px;background:color-mix(in srgb,var(--teal) 7%,var(--surface));margin:30px 0 0}
  .privacy h2{margin:0 0 8px;font-size:18px}
  .privacy p{margin:0;color:var(--dim);max-width:66ch}
  .foot{max-width:860px;margin:0 auto;padding:22px 24px 50px;border-top:1px solid var(--border);color:var(--dim);font-size:13px}
</style>
</head>
<body>
  <div class="nav">
    <a class="brand" href="/">botwatch<span>.xyz</span></a>
    <div><a href="/intel">Live intel</a><a href="/contact">Contact</a></div>
  </div>
  <main>
    <div class="eyebrow">Methodology</div>
    <h1>How botwatch detects malicious bots</h1>
    <p class="lead">botwatch.xyz is a cybersecurity research project. We run honeypots and watch how automated agents, crawlers, and threat actors behave across the web — then turn that behaviour into threat intelligence. Here's how.</p>

    <div class="stats">
      ${stat('requests observed', stats.total_requests)}
      ${stat('flagged as threats', stats.threat_requests)}
      ${stat('honeypot hits', stats.honeypot_hits)}
      ${stat('countries seen', stats.countries_seen)}
    </div>
    <p class="live-note">Live aggregate figures from our sensors — counts only. We never publish individual IPs, captured payloads, or credentials.</p>
    ${attacks.length ? `<h2 style="font-size:16px;margin:0">Attack categories we're seeing</h2>${attackChips}` : ''}

    ${method('01', 'Honeypots &amp; trap endpoints', `
      <p>We expose a network of decoy endpoints — fake admin panels, config files, and vulnerable-looking paths — that no legitimate user has any reason to touch. Any hit is a strong signal of automated scanning or malicious intent, and we capture the full request for analysis (headers, method, and the raw payload) with strict politeness and rate controls elsewhere on the site.</p>`)}

    ${method('02', 'Behavioural machine-learning model', `
      <p>For every source IP we aggregate how it behaves — request volume and rate, path and user-agent diversity, error rates, method mix, and more — into a feature vector, and score it with a logistic-regression model that runs entirely in-house (no third-party service). Crucially it trains on <b>behavioural</b> features only, deliberately excluding the signals that define the label, so it learns to predict maliciousness <em>before</em> an IP trips an obvious signature. Every score comes with a plain-language explanation of why, and analysts can confirm or override any call — a human stays in the loop.</p>`)}

    ${method('03', 'Payload &amp; CVE signature analysis', `
      <p>Each request is scanned against a library of attack signatures — SQL injection, XSS, path traversal, command injection, SSRF, template injection, deserialization, and scanner fingerprints — plus a curated set of named, high-severity CVE exploit patterns (Log4Shell, Spring4Shell, Shellshock, and more). Matches are classified by <b>intent</b> (recon, injection, exploit, scanner) and <b>severity</b>, so we can see not just that an attack happened but what the attacker was trying to do.</p>`)}

    ${method('04', 'Novel-payload &amp; 0-day detection', `
      <p>Signatures only catch what we already know. So we also flag requests that <em>look</em> attack-shaped but match no known signature — obfuscated or high-entropy payloads, unusual encodings, injection-shaped structure, odd method/body combinations. These land in a review queue where an analyst can investigate genuinely novel techniques, including possible zero-day attempts.</p>`)}

    ${method('05', 'Passive enrichment', `
      <p>We enrich the infrastructure behind an attack using passive, non-intrusive sources: DNS and reverse DNS, WHOIS/RDAP, TLS certificates, email authentication posture, hosting and network (ASN), and reputation data. Cross-referencing attackers against their networks and countries turns isolated events into a picture of where threats actually originate.</p>`)}

    <div class="privacy">
      <h2>Our privacy stance</h2>
      <p>This is defensive research. We study attacker behaviour and payloads, never legitimate users. Successful logins are never recorded, real-user submissions are stripped, and captured request bodies are never exposed through any public interface — everything you see here is aggregate. Found a security issue? See our <a href="/contact">responsible-disclosure policy</a>.</p>
    </div>
  </main>
  <div class="foot">
    An independent cybersecurity research project. See <a href="/intel">live threat intel</a> or read about our <a href="/readiness">AI-readiness</a> work.
  </div>
</body>
</html>`;
}
