import { query } from '../utilities/connectDB.js';
import { getDomainByHostname, getDomainHasJsonLd } from '../crawler/db.js';
import { getLatestDomainEnrichmentQuery } from '../utilities/sqlDomainEnrichmentQuerys.js';
import { getDomainWebmcpRowsQuery, getProfiledHostnamesQuery } from '../utilities/sqlCrawlerQuerys.js';
import { assessReadiness } from '../crawler/readinessAssessment.js';

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const SITE = 'https://botwatch.xyz';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Merge every page's WebMCP result for a domain into one site-wide view.
function aggregateWebmcp(rows) {
    const toolsByName = new Map();
    const violations = new Set();
    let imperative = false;
    for (const { webmcp: wm } of rows) {
        if (!wm) continue;
        for (const t of wm.declarative?.tools || []) if (!toolsByName.has(t.name)) toolsByName.set(t.name, t);
        if (wm.imperative?.detected) imperative = true;
        for (const v of wm.bestPractice?.violations || []) violations.add(v);
    }
    const tools = [...toolsByName.values()];
    return {
        declarative: { count: tools.length, tools },
        imperative: { detected: imperative },
        bestPractice: { violations: [...violations] },
    };
}

const signalRow = (c) => `<li class="${c.present ? 'yes' : 'no'}"><span>${c.present ? '✓' : '✕'}</span>${esc(c.label)}</li>`;

export function renderPage({ hostname, found, band, legibility, actionability, webmcpTools, enrichment, category, updatedAt }) {
    const title = found
        ? `${hostname} — AI readiness score & agent-readiness | botwatch`
        : `${hostname} — AI readiness | botwatch`;
    const desc = found
        ? `How ready is ${hostname} for AI agents? An independent, passive assessment of ${hostname}'s AI legibility (llms.txt, structured data) and agent actionability (WebMCP), by botwatch.`
        : `We haven't analysed ${hostname} yet. Run a free instant AI-readiness check.`;
    const canonical = `${SITE}/company/${encodeURIComponent(hostname)}`;

    const body = found ? `
      <div class="summary">
        <div>
          <div class="host">${esc(hostname)}</div>
          ${category ? `<div class="cat">${esc(category)}</div>` : ''}
        </div>
        <div class="band band--${esc((band || '').toLowerCase())}">${esc(band || '—')}</div>
      </div>

      <section>
        <h2>Readiness signals</h2>
        <div class="pillars">
          <div class="pillar">
            <h3>Legibility <b>${legibility.present}/${legibility.total}</b></h3>
            <p class="sub">Can agents read &amp; understand the site?</p>
            <ul class="signals">${legibility.checks.filter((c) => !c.notApplicable).map(signalRow).join('')}</ul>
          </div>
          <div class="pillar act">
            <h3>Actionability <b>${actionability.present}/${actionability.total}</b></h3>
            <p class="sub">Can agents act on the site (WebMCP)?</p>
            <ul class="signals">${actionability.checks.filter((c) => !c.notApplicable).map(signalRow).join('')}</ul>
          </div>
        </div>
      </section>

      <section>
        <h2>Agent actionability (WebMCP)</h2>
        <p>${webmcpTools > 0
            ? `${webmcpTools} WebMCP tool${webmcpTools === 1 ? '' : 's'} detected — agents can take structured actions here.`
            : `No WebMCP tools detected. Agents can't reliably act on this site yet — an early-mover opportunity, since almost no sites have this.`}</p>
      </section>

      ${enrichment ? `
      <section>
        <h2>Technical snapshot</h2>
        <div class="facts">
          ${enrichment.tls?.issuer ? `<div class="fact"><span>TLS issuer</span><b>${esc(enrichment.tls.issuer)}</b></div>` : ''}
          ${enrichment.security_headers?.gradeWord || enrichment.security_headers?.grade ? `<div class="fact"><span>Security headers</span><b>${esc(enrichment.security_headers.gradeWord || enrichment.security_headers.grade)}</b></div>` : ''}
          ${enrichment.hosting?.org ? `<div class="fact"><span>Hosting</span><b>${esc(enrichment.hosting.org)}</b></div>` : ''}
          ${enrichment.email_posture?.dmarc ? `<div class="fact"><span>DMARC</span><b>${esc(enrichment.email_posture.dmarc)}</b></div>` : ''}
        </div>
      </section>` : ''}

      <div class="cta">
        <h2>Get the full report</h2>
        <p>Unlock the specific, prioritised fixes to make ${esc(hostname)} AI-ready — a deep crawl, every signal, and step-by-step recommendations, emailed to you.</p>
        <a class="btn" href="/readiness-check?url=${encodeURIComponent(hostname)}">See the full report — $5 AUD →</a>
      </div>
      <p class="updated">Passively assessed${updatedAt ? ` · last updated ${esc(new Date(updatedAt).toISOString().slice(0, 10))}` : ''}. botwatch does not affiliate with ${esc(hostname)}.</p>
    ` : `
      <div class="summary"><div><div class="host">${esc(hostname)}</div></div></div>
      <section>
        <h2>Not analysed yet</h2>
        <p>We haven't assessed ${esc(hostname)} for AI readiness yet. Run a free instant check to see where it stands on agent legibility and actionability.</p>
        <div class="cta">
          <a class="btn" href="/readiness-check?url=${encodeURIComponent(hostname)}">Run a free AI-readiness check →</a>
        </div>
      </section>
    `;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${found ? '' : '<meta name="robots" content="noindex">'}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<style>
  :root{--bg:#0b0f10;--surface:#111a1c;--border:#223032;--text:#e7edec;--dim:#8ea09f;--teal:#33cdba;--amber:#e2a75c;--green:#4ade80;--red:#ef6b6b;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6}
  a{color:var(--teal)}
  .nav{max-width:820px;margin:0 auto;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;font-size:14px}
  .nav .brand{font-weight:800;color:var(--text);text-decoration:none;font-size:16px}
  .nav .brand span{color:var(--teal)}
  .nav a{color:var(--dim);text-decoration:none;margin-left:16px}
  main{max-width:820px;margin:0 auto;padding:10px 24px 70px}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--teal)}
  h1{font-size:30px;letter-spacing:-.5px;margin:8px 0 20px;font-weight:800}
  .summary{display:flex;justify-content:space-between;align-items:center;gap:16px;border:1px solid var(--border);border-radius:14px;padding:18px 22px;background:var(--surface);margin-bottom:26px}
  .host{font-family:var(--mono);font-size:20px;font-weight:700}
  .cat{font-size:12px;color:var(--dim);margin-top:3px;text-transform:capitalize}
  .band{font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:7px 15px;border-radius:20px;white-space:nowrap}
  .band--emerging{background:color-mix(in srgb,var(--red) 18%,transparent);color:#f19999}
  .band--developing{background:color-mix(in srgb,var(--amber) 22%,transparent);color:#e3c675}
  .band--strong{background:color-mix(in srgb,var(--green) 18%,transparent);color:#86efac}
  section{margin-bottom:28px}
  h2{font-size:18px;font-weight:800;margin:0 0 12px}
  h3{font-size:15px;margin:0}
  h3 b{font-family:var(--mono);color:var(--teal);margin-left:6px}
  .pillars{display:grid;gap:14px}
  @media(min-width:560px){.pillars{grid-template-columns:1fr 1fr}}
  .pillar{border:1px solid var(--border);border-radius:12px;padding:16px 18px;background:var(--surface);border-top:3px solid var(--teal)}
  .pillar.act{border-top-color:var(--amber)}
  .pillar.act h3 b{color:var(--amber)}
  .sub{font-size:12px;color:var(--dim);margin:4px 0 12px}
  .signals{list-style:none;margin:0;padding:0}
  .signals li{font-size:13.5px;padding:5px 0;display:flex;gap:9px;align-items:center}
  .signals li span{font-weight:800;width:14px;text-align:center}
  .signals .yes{color:var(--text)} .signals .yes span{color:var(--green)}
  .signals .no{color:var(--dim)} .signals .no span{color:var(--red)}
  .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
  .fact{display:flex;justify-content:space-between;gap:10px;font-size:13px;border:1px solid var(--border);border-radius:9px;padding:10px 12px;background:var(--surface)}
  .fact span{color:var(--dim)} .fact b{text-align:right}
  .cta{border:1px solid color-mix(in srgb,var(--teal) 40%,var(--border));border-radius:14px;padding:22px;background:color-mix(in srgb,var(--teal) 8%,var(--surface));text-align:center;margin:30px 0 14px}
  .cta h2{margin-bottom:6px}
  .cta p{color:var(--dim);font-size:14px;max-width:52ch;margin:0 auto 16px}
  .btn{display:inline-block;background:var(--teal);color:#06231f;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px}
  .updated{font-size:12px;color:var(--dim)}
  .foot{max-width:820px;margin:0 auto;padding:22px 24px 50px;border-top:1px solid var(--border);color:var(--dim);font-size:13px}
  .foot a{color:var(--teal)}
</style>
</head>
<body>
  <div class="nav">
    <a class="brand" href="/">botwatch<span>.xyz</span></a>
    <div><a href="/readiness-check">Check a site</a><a href="/readiness">AI Readiness</a></div>
  </div>
  <main>
    <div class="eyebrow">AI-Readiness Profile</div>
    <h1>Is ${esc(hostname)} ready for AI agents?</h1>
    ${body}
  </main>
  <div class="foot">
    An independent AI-readiness assessment by <a href="/">botwatch.xyz</a>. Learn <a href="/readiness-check">how the check works</a> or read about <a href="/docs">the API</a>.
  </div>
</body>
</html>`;
}

// GET /company/:hostname — public, server-rendered AI-readiness profile (SEO).
export const getCompanyProfile = async (req, res) => {
    const hostname = String(req.params.hostname || '').toLowerCase().trim().replace(/\.+$/, '');
    if (!HOSTNAME_RE.test(hostname)) {
        return res.status(404).type('html').send(renderPage({ hostname: hostname || 'unknown', found: false }));
    }

    try {
        const domain = await getDomainByHostname(hostname);
        const scored = domain && domain.ai_readiness_score !== null && domain.ai_readiness_score !== undefined;
        if (!domain || !scored) {
            res.set('Cache-Control', 'public, max-age=300');
            return res.status(200).type('html').send(renderPage({ hostname, found: false }));
        }

        const [jsonLdFound, webmcpRows, enr] = await Promise.all([
            getDomainHasJsonLd(domain.id),
            query(getDomainWebmcpRowsQuery, [domain.id]).then((r) => r.rows).catch(() => []),
            query(getLatestDomainEnrichmentQuery, [domain.id]).then((r) => r.rows[0] || null).catch(() => null),
        ]);

        const webmcp = aggregateWebmcp(webmcpRows);
        const assessment = assessReadiness({
            domain: {
                llms_txt_found: domain.llms_txt_found,
                ai_txt_found: domain.ai_txt_found,
                ai_training_policy_explicit: domain.ai_training_policy_explicit,
                terms_url: domain.terms_url,
            },
            jsonLdFound,
            webmcp,
        });

        res.set('Cache-Control', 'public, max-age=3600');
        return res.status(200).type('html').send(renderPage({
            hostname,
            found: true,
            band: assessment.band,
            legibility: assessment.legibility,
            actionability: assessment.actionability,
            webmcpTools: webmcp.declarative.count,
            enrichment: enr,
            category: domain.category,
            updatedAt: domain.updated_at,
        }));
    } catch (error) {
        console.error('Company profile error:', error.message);
        return res.status(500).type('html').send(renderPage({ hostname, found: false }));
    }
};

// GET /sitemap-companies.xml — lists every scored domain's profile page.
export const getCompanySitemap = async (req, res) => {
    try {
        const rows = (await query(getProfiledHostnamesQuery)).rows;
        const urls = rows.map((r) => {
            const loc = `${SITE}/company/${encodeURIComponent(r.hostname)}`;
            const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : null;
            return `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
        }).join('\n');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.type('application/xml').send(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
        );
    } catch (error) {
        console.error('Company sitemap error:', error.message);
        return res.status(500).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
};
