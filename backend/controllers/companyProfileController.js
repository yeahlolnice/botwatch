import { query } from '../utilities/connectDB.js';
import { getDomainByHostname, getDomainHasJsonLd } from '../crawler/db.js';
import { getLatestDomainEnrichmentQuery } from '../utilities/sqlDomainEnrichmentQuerys.js';
import { getDomainWebmcpRowsQuery, getProfiledHostnamesQuery, getDomainJsonLdTypesQuery, getDomainScoreHistoryQuery } from '../utilities/sqlCrawlerQuerys.js';
import { assessReadiness } from '../crawler/readinessAssessment.js';
import { scanAndPersistDomain } from '../crawler/scanAndPersist.js';
import { getCohortComparison } from '../crawler/cohort.js';
import { buildAiCrawlerMatrix } from '../crawler/aiCrawlerMatrix.js';
import { buildStructuredDataDepth } from '../crawler/structuredData.js';
import { buildDiscoverability } from '../crawler/discoverability.js';
import { buildReadinessTrend } from '../crawler/readinessTrend.js';

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
const chip = (label, kind) => `<span class="chip chip--${kind}">${esc(label)}</span>`;
const fact = (label, value) => (value === undefined || value === null || value === '' || value === false)
    ? '' : `<div class="fact"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

const bandKind = (b) => ({ strong: 'good', developing: 'warn', emerging: 'bad' }[String(b || '').toLowerCase()] || 'neutral');
const gradeKind = (g) => {
    const s = String(g || '').toLowerCase();
    if (/strong|a\b|good|excellent/.test(s)) return 'good';
    if (/fair|b\b|moderate/.test(s)) return 'warn';
    if (/weak|poor|c\b|d\b|f\b/.test(s)) return 'bad';
    return 'neutral';
};

// Structured-data depth — which schema.org @types the site publishes. Rendered
// inside the AI Readiness pillar; empty string when no JSON-LD types found.
function renderStructuredData(sd) {
    if (!sd) return '';
    const typeChips = sd.types.map((t) => chip(t.type, 'good')).join('');
    const overflow = sd.overflow > 0 ? `<span class="chip chip--neutral">+${sd.overflow} more</span>` : '';
    const missing = sd.foundational.filter((f) => !f.present).map((f) => f.type);
    const foundLine = missing.length === 0
        ? 'It covers the foundational types (Organization, WebSite, BreadcrumbList) that help agents identify the business and navigate it.'
        : `Foundational types that would help most agents are missing: ${missing.map((t) => `<code>${esc(t)}</code>`).join(', ')}.`;
    return `
      <div class="matrix">
        <div class="matrix-head"><h3>Structured data</h3>${chip(`${sd.distinctCount} type${sd.distinctCount === 1 ? '' : 's'}`, 'good')}</div>
        <p class="why">The schema.org types this site marks up with JSON-LD. Richer, well-typed markup lets AI answer engines and rich results extract facts — products, prices, FAQs, articles — instead of guessing from raw text. ${foundLine}</p>
        <div class="sd-chips">${typeChips}${overflow}</div>
      </div>`;
}

// Readiness trend — a sparkline of the site's AI-readiness score over time.
// Rendered inside the AI Readiness pillar; empty string until 2+ readings.
function sparkline(scores) {
    const w = 180, h = 36, pad = 3;
    const max = 100, min = 0; // scores are a fixed 0-100 scale
    const step = scores.length > 1 ? (w - pad * 2) / (scores.length - 1) : 0;
    const y = (s) => h - pad - ((s - min) / (max - min)) * (h - pad * 2);
    const pts = scores.map((s, i) => `${(pad + i * step).toFixed(1)},${y(s).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
}

function renderTrend(trend) {
    if (!trend) return '';
    const { delta, direction, readings, first, current } = trend;
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■';
    const kind = direction === 'up' ? 'good' : direction === 'down' ? 'bad' : 'neutral';
    const label = direction === 'flat' ? 'No change' : `${arrow} ${delta > 0 ? '+' : ''}${delta}`;
    const since = first.at ? new Date(first.at).toISOString().slice(0, 10) : null;
    return `
      <div class="matrix trend trend--${direction}">
        <div class="matrix-head"><h3>Readiness trend</h3>${chip(label, kind)}</div>
        <p class="why">How this site's AI-readiness score has moved as we've re-scanned it${since ? ` since ${esc(since)}` : ''} — ${readings} reading${readings === 1 ? '' : 's'}, now at <b>${current.score}/100</b>.</p>
        ${sparkline(trend.scores)}
      </div>`;
}

// Content licensing / TDM — the site's machine-readable AI-usage preferences.
// Rendered inside the AI Readiness pillar; empty string when none expressed.
function renderContentLicensing(cl) {
    if (!cl) return '';
    const items = [];
    if (cl.noai) items.push('Opts out of AI text training (<code>noai</code>)');
    if (cl.noimageai) items.push('Opts out of AI image training (<code>noimageai</code>)');
    if (cl.tdmReserved) items.push('Reserves text &amp; data-mining rights (TDM Reservation Protocol)');
    if (cl.tdmPolicy) items.push(`Publishes a TDM policy: <code>${esc(cl.tdmPolicy)}</code>`);
    if (items.length === 0) return '';
    return `
      <div class="matrix">
        <div class="matrix-head"><h3>Content licensing &amp; AI usage</h3>${chip('Preferences set', 'good')}</div>
        <p class="why">This site expresses machine-readable preferences about how AI may use its content. Agents and training crawlers that honour these should adapt accordingly.</p>
        <ul class="signals">${items.map((t) => `<li class="yes"><span>●</span>${t}</li>`).join('')}</ul>
      </div>`;
}

// Agent discoverability — machine-readable entry points an agent uses to orient.
// Rendered inside the WebMCP (actionability) pillar; empty string when null.
function renderDiscoverability(d) {
    if (!d) return '';
    return `
      <div class="matrix">
        <div class="matrix-head"><h3>Agent discoverability</h3>${chip(`${d.present}/${d.total}`, d.present >= 3 ? 'good' : d.present > 0 ? 'warn' : 'neutral')}</div>
        <p class="why">Whether an AI agent arriving here can find the machine-readable entry points it needs to understand and act on the site.</p>
        <ul class="signals">${d.checks.map(signalRow).join('')}</ul>
      </div>`;
}

// AI-crawler access matrix — which named AI systems this site's robots.txt lets
// in. Rendered inside the AI Readiness pillar; empty string when no policy.
function renderCrawlerMatrix(matrix) {
    if (!matrix) return '';
    const rows = matrix.bots.map((b) => `
        <div class="crawl">
          <div class="crawl-id"><b>${esc(b.operator)}</b><span>${esc(b.bot)} · ${esc(b.purpose)}</span></div>
          ${chip(b.allowed ? 'Allowed' : 'Blocked', b.allowed ? 'good' : 'neutral')}
        </div>`).join('');
    const note = matrix.explicit
        ? 'This site names AI crawlers explicitly — a deliberate, thought-through policy.'
        : "Inferred from the site's general robots.txt rules — no AI-specific policy is set.";
    return `
      <div class="matrix">
        <div class="matrix-head"><h3>AI-crawler access</h3>${chip(`${matrix.allowedCount}/${matrix.total} allowed`, matrix.allowedCount > 0 ? 'good' : 'neutral')}</div>
        <p class="why">Which AI systems this site lets crawl it, per <code>robots.txt</code>. Allowing training and search crawlers means your content can feed and surface in AI answers; blocking is a valid opt-out. ${esc(note)}</p>
        <div class="crawl-grid">${rows}</div>
      </div>`;
}

// Cohort benchmarking + "Similar sites" — only rendered when we have enough
// peers to be honest about it (cohort is null otherwise).
function renderSimilar(hostname, cohort) {
    if (!cohort) return '';
    const { category, percentile, peersCount, similar } = cohort;
    const rows = similar.map((p) => `
        <a class="peer" href="/company/${encodeURIComponent(p.hostname)}">
          <span class="peer-host">${esc(p.hostname)}</span>
          ${chip(`${p.score}/100`, p.kind)}
        </a>`).join('');
    return `
      <div class="pcard peers">
        <div class="pcard-head"><h2>Similar sites</h2>${chip(`Top ${100 - percentile}%`, percentile >= 50 ? 'good' : 'neutral')}</div>
        <p class="why">We group sites by what they do, then compare AI-readiness across the group. ${esc(hostname)} is ahead of <b>${percentile}%</b> of the <b>${esc(category)}</b> sites we've profiled (${peersCount} peer${peersCount === 1 ? '' : 's'}). Here are the closest in readiness — click any to see how they compare.</p>
        <div class="peer-list">${rows}</div>
      </div>`;
}

export function renderPage({ hostname, found, band, legibility, actionability, webmcp, enrichment, category, updatedAt, cohort, crawlerMatrix, structuredData, discoverability, contentLicensing, trend }) {
    const title = found
        ? `${hostname} — AI readiness, WebMCP & security | botwatch`
        : `${hostname} — AI readiness | botwatch`;
    const desc = found
        ? `Where does ${hostname} stand for the agentic web? An independent read on ${hostname}'s AI readiness, WebMCP agent-actionability, and security posture — by botwatch.`
        : `We haven't analysed ${hostname} yet. Run a free instant AI-readiness check.`;
    const canonical = `${SITE}/company/${encodeURIComponent(hostname)}`;

    const wm = webmcp || {};
    const toolCount = wm.declarative?.count || 0;
    const sec = enrichment || {};
    const secGrade = sec.security_headers?.gradeWord || sec.security_headers?.grade || null;

    const body = found ? `
      <div class="summary">
        <div>
          <div class="host">${esc(hostname)}</div>
          ${category ? `<div class="cat">${esc(category)}</div>` : ''}
        </div>
        <div class="band band--${esc((band || '').toLowerCase())}">${esc(band || '—')} for AI</div>
      </div>

      <p class="intro">Here's how ready <b>${esc(hostname)}</b> is for the agentic web — how well AI agents can <b>read</b> it, <b>act on</b> it, and how <b>secure</b> the foundations are. Assessed passively by botwatch; no affiliation with ${esc(hostname)}.</p>

      <div class="pcard">
        <div class="pcard-head"><h2>AI Readiness</h2>${chip(`${legibility.present}/${legibility.total} signals`, bandKind(band))}</div>
        <p class="why">AI assistants and answer engines increasingly read the web through automated agents. Sites that publish an <code>llms.txt</code> index, structured data, and a clear AI-crawler policy get represented accurately in AI answers — the rest get guessed at, misquoted, or skipped.</p>
        <ul class="signals">${legibility.checks.filter((c) => !c.notApplicable).map(signalRow).join('')}</ul>
        ${renderStructuredData(structuredData)}
        ${renderCrawlerMatrix(crawlerMatrix)}
        ${renderContentLicensing(contentLicensing)}
        ${renderTrend(trend)}
      </div>

      <div class="pcard act">
        <div class="pcard-head"><h2>WebMCP — agent actionability</h2>${chip(toolCount > 0 ? `${toolCount} tool${toolCount === 1 ? '' : 's'}` : 'Not detected', toolCount > 0 ? 'good' : 'neutral')}</div>
        <p class="why">WebMCP is an emerging browser standard (currently a Chrome origin trial) that lets a site expose tools an AI agent can call directly — search, book, check out — instead of clumsily driving your UI. Adoption is near zero today, so getting it right early is a genuine first-mover edge.</p>
        ${toolCount > 0
            ? `<p>We detected <b>${toolCount}</b> agent-callable tool${toolCount === 1 ? '' : 's'} on this site${wm.declarative?.tools?.length ? `: ${wm.declarative.tools.slice(0, 6).map((t) => `<code>${esc(t.name)}</code>`).join(', ')}` : ''}.</p>`
            : `<p class="muted">No WebMCP tools detected — agents can't yet take reliable, structured actions here. That's the single biggest opportunity to get ahead, because almost no site has this.</p>`}
        <ul class="signals">${actionability.checks.filter((c) => !c.notApplicable).map(signalRow).join('')}</ul>
        ${renderDiscoverability(discoverability)}
      </div>

      <div class="pcard sec">
        <div class="pcard-head"><h2>Security Posture</h2>${secGrade ? chip(secGrade, gradeKind(secGrade)) : chip('Not assessed', 'neutral')}</div>
        <p class="why">Before an agent — or a customer — trusts your site, the fundamentals have to hold: valid TLS, protective security headers, and email authentication that blocks spoofing. These are the same signals attackers probe first, and we watch them every day.</p>
        ${enrichment ? `<div class="facts">
          ${fact('TLS issuer', sec.tls?.issuer)}
          ${fact('Certificate valid to', sec.tls?.validTo)}
          ${fact('Security headers', secGrade)}
          ${fact('SPF', sec.email_posture?.spf ? 'present' : undefined)}
          ${fact('DKIM', sec.email_posture?.dkim ? 'present' : undefined)}
          ${fact('DMARC', sec.email_posture?.dmarc)}
          ${fact('Hosting', sec.hosting?.org)}
          ${fact('Subdomains found', Array.isArray(sec.subdomains) ? sec.subdomains.length : sec.subdomains?.count)}
        </div>` : `<p class="muted">Security enrichment is still being gathered for this domain.</p>`}
      </div>

      ${renderSimilar(hostname, cohort)}

      <div class="cta">
        <h2>See the full report</h2>
        <p>This is the free snapshot. The full report runs a deep, multi-page crawl of ${esc(hostname)}, checks every signal in depth — including your WebMCP tool quality — and gives you a prioritised, step-by-step plan to become AI-ready. Emailed to you.</p>
        <a class="btn" href="/readiness-check?url=${encodeURIComponent(hostname)}">Get the full report — $5 AUD →</a>
      </div>

      <div class="about">
        <h2>Why botwatch</h2>
        <p>We run honeypots and watch how automated agents and crawlers actually behave across the web, every day. We turn that intelligence into a plain read on where your site stands for the agentic web — and exactly how to get ahead of it.</p>
      </div>

      <p class="updated">Passively assessed${updatedAt ? ` · last updated ${esc(new Date(updatedAt).toISOString().slice(0, 10))}` : ''}. botwatch is independent and not affiliated with ${esc(hostname)}.</p>
    ` : `
      <div class="summary"><div><div class="host">${esc(hostname)}</div></div></div>
      <section>
        <h2>We couldn't analyse this one</h2>
        <p>We weren't able to reach or read ${esc(hostname)} just now. Try a free instant check, or come back shortly.</p>
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
  .intro{font-size:15px;color:var(--dim);margin:0 0 24px;max-width:66ch}
  .intro b{color:var(--text)}
  code{font-family:var(--mono);font-size:.86em;background:#0c1416;border:1px solid var(--border);border-radius:5px;padding:1px 5px;color:var(--teal)}
  .pcard{border:1px solid var(--border);border-radius:14px;padding:20px 22px;background:var(--surface);border-left:3px solid var(--teal);margin-bottom:16px}
  .pcard.act{border-left-color:var(--amber)}
  .pcard.sec{border-left-color:#7aa2ff}
  .pcard.peers{border-left-color:#c48bff}
  .peer-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:4px}
  .peer{display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;border:1px solid var(--border);border-radius:9px;padding:10px 12px;background:#0c1416}
  .peer:hover{border-color:color-mix(in srgb,var(--teal) 45%,var(--border))}
  .peer-host{font-family:var(--mono);font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .matrix{margin-top:16px;border-top:1px solid var(--border);padding-top:14px}
  .matrix-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
  .matrix-head h3{font-size:14px;font-weight:800}
  .crawl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px}
  .crawl{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border);border-radius:9px;padding:8px 11px;background:#0c1416}
  .crawl-id{display:flex;flex-direction:column;line-height:1.3;min-width:0}
  .crawl-id b{font-size:13px}
  .crawl-id span{font-family:var(--mono);font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sd-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
  .sd-chips .chip{font-family:var(--mono);text-transform:none;letter-spacing:0;font-size:12px}
  .spark{display:block;margin-top:8px;color:var(--teal);width:180px;max-width:100%;height:36px}
  .trend--down .spark{color:var(--red)}
  .trend--flat .spark{color:var(--dim)}
  .pcard-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
  .pcard-head h2{margin:0;font-size:18px}
  .chip{font-size:11.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;padding:5px 12px;border-radius:20px;white-space:nowrap}
  .chip--good{background:color-mix(in srgb,var(--green) 18%,transparent);color:#86efac}
  .chip--warn{background:color-mix(in srgb,var(--amber) 22%,transparent);color:#e3c675}
  .chip--bad{background:color-mix(in srgb,var(--red) 18%,transparent);color:#f19999}
  .chip--neutral{background:color-mix(in srgb,var(--dim) 20%,transparent);color:var(--dim)}
  .why{font-size:13px;color:var(--dim);line-height:1.6;margin:0 0 14px;max-width:70ch}
  .pcard p{font-size:14px;margin:10px 0}
  .muted{color:var(--dim)}
  .about{border:1px solid var(--border);border-radius:14px;padding:18px 22px;background:var(--surface);margin:18px 0}
  .about h2{margin:0 0 6px}
  .about p{font-size:14px;color:var(--dim);margin:0;max-width:68ch}
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
        let domain = await getDomainByHostname(hostname);
        let scored = domain && domain.ai_readiness_score !== null && domain.ai_readiness_score !== undefined;

        // Read-through cache: if we've never profiled this domain, scan it live,
        // persist to the canonical store, and render the fresh result. Every hit
        // after that is a plain DB read.
        if (!scored) {
            try {
                domain = (await scanAndPersistDomain(hostname)) || domain;
                scored = domain && domain.ai_readiness_score !== null && domain.ai_readiness_score !== undefined;
            } catch (error) {
                console.error('On-demand scan failed for', hostname, '—', error.message);
            }
        }

        if (!domain || !scored) {
            res.set('Cache-Control', 'public, max-age=300');
            return res.status(200).type('html').send(renderPage({ hostname, found: false }));
        }

        const [jsonLdFound, webmcpRows, enr, cohort, jsonLdTypeRows, scoreHistory] = await Promise.all([
            getDomainHasJsonLd(domain.id),
            query(getDomainWebmcpRowsQuery, [domain.id]).then((r) => r.rows).catch(() => []),
            query(getLatestDomainEnrichmentQuery, [domain.id]).then((r) => r.rows[0] || null).catch(() => null),
            getCohortComparison(domain).catch(() => null),
            query(getDomainJsonLdTypesQuery, [domain.id]).then((r) => r.rows).catch(() => []),
            query(getDomainScoreHistoryQuery, [domain.id]).then((r) => r.rows).catch(() => []),
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
            webmcp,
            enrichment: enr,
            category: domain.category,
            updatedAt: domain.updated_at,
            cohort,
            crawlerMatrix: buildAiCrawlerMatrix(domain.ai_training_policy, domain.ai_training_policy_explicit),
            structuredData: buildStructuredDataDepth(jsonLdTypeRows),
            discoverability: buildDiscoverability({ domain, webmcp, jsonLdFound }),
            contentLicensing: domain.content_licensing || null,
            trend: buildReadinessTrend(scoreHistory),
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
