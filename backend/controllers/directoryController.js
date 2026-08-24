import { query } from '../utilities/connectDB.js';
import {
    getDirectoryCompaniesQuery,
    getDirectoryCountQuery,
    getDirectoryCategoriesQuery,
} from '../utilities/sqlCrawlerQuerys.js';

const SITE = 'https://botwatch.xyz';
const PAGE_SIZE = 48;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
// URL-safe slug for a category label (e.g. "Technology/Software" -> "technology-software").
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const scoreKind = (n) => (n >= 60 ? 'good' : n >= 30 ? 'warn' : 'bad');

// GET /directory and /directory/:category — public, server-rendered index of
// every profiled company, cross-linking the /company/:hostname pages for SEO.
export const getDirectory = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const slug = req.params.category ? slugify(req.params.category) : null;

    try {
        const categories = (await query(getDirectoryCategoriesQuery)).rows;
        // Resolve the slug back to a real category label (handles '/' & spaces).
        const category = slug ? (categories.find((c) => slugify(c.category) === slug)?.category ?? null) : null;
        const notFound = slug && !category;

        const [companiesRes, countRes] = notFound
            ? [{ rows: [] }, { rows: [{ total: 0 }] }]
            : await Promise.all([
                query(getDirectoryCompaniesQuery, [category, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
                query(getDirectoryCountQuery, [category]),
            ]);

        const total = countRes.rows[0]?.total || 0;
        res.set('Cache-Control', 'public, max-age=1800');
        return res.status(notFound ? 404 : 200).type('html').send(renderDirectory({
            companies: companiesRes.rows,
            categories,
            category,
            slug,
            notFound,
            page,
            total,
            pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        }));
    } catch (error) {
        console.error('Directory error:', error.message);
        return res.status(500).type('html').send(renderDirectory({ companies: [], categories: [], error: true }));
    }
};

export function renderDirectory({ companies = [], categories = [], category = null, slug = null, notFound = false, page = 1, total = 0, pageCount = 1, error = false }) {
    const title = category
        ? `${category} companies — AI-readiness directory | botwatch`
        : 'Company directory — AI readiness & agent-readiness | botwatch';
    const desc = category
        ? `Browse ${category} companies ranked by how ready their sites are for AI agents — AI legibility, WebMCP, and security posture, assessed independently by botwatch.`
        : 'Browse companies by how ready their websites are for the agentic web — AI readiness, WebMCP agent-actionability, and security posture, independently assessed by botwatch.';
    const path = category ? `/directory/${slug}` : '/directory';
    const canonical = `${SITE}${path}${page > 1 ? `?page=${page}` : ''}`;

    const catChips = categories.map((c) => {
        const s = slugify(c.category);
        const active = s === slug;
        return `<a class="chip${active ? ' chip--active' : ''}" href="/directory/${s}">${esc(c.category)} <b>${c.count}</b></a>`;
    }).join('');

    const rows = companies.map((c) => `
        <a class="row" href="/company/${encodeURIComponent(c.hostname)}">
          <span class="host">${esc(c.hostname)}</span>
          <span class="cat">${esc(c.category || '—')}</span>
          <span class="chip chip--${scoreKind(c.score)}">${c.score}/100</span>
        </a>`).join('');

    const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    const prev = page > 1 ? `<a class="pg" href="${path}${page - 1 > 1 ? `?page=${page - 1}` : ''}">← Prev</a>` : '<span class="pg pg--off">← Prev</span>';
    const next = page < pageCount ? `<a class="pg" href="${path}?page=${page + 1}">Next →</a>` : '<span class="pg pg--off">Next →</span>';

    const body = error
        ? '<p class="empty">The directory is temporarily unavailable. Please try again shortly.</p>'
        : notFound
            ? `<p class="empty">No such category. <a href="/directory">Browse the full directory →</a></p>`
            : companies.length === 0
                ? `<p class="empty">No companies profiled${category ? ` in ${esc(category)}` : ''} yet. <a href="/readiness-check">Check a site →</a></p>`
                : `
      <div class="rows">
        <div class="row row--head"><span>Company</span><span>Category</span><span>AI readiness</span></div>
        ${rows}
      </div>
      <div class="pager">
        ${prev}
        <span class="pg-info">${start}–${end} of ${total}</span>
        ${next}
      </div>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${notFound ? '<meta name="robots" content="noindex">' : ''}
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
  .nav{max-width:920px;margin:0 auto;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;font-size:14px}
  .nav .brand{font-weight:800;color:var(--text);text-decoration:none;font-size:16px}
  .nav .brand span{color:var(--teal)}
  .nav a{color:var(--dim);text-decoration:none;margin-left:16px}
  main{max-width:920px;margin:0 auto;padding:10px 24px 70px}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--teal)}
  h1{font-size:30px;letter-spacing:-.5px;margin:8px 0 10px;font-weight:800}
  .lead{font-size:15px;color:var(--dim);max-width:66ch;margin:0 0 22px}
  .cats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 26px}
  .chip{font-size:12.5px;text-decoration:none;border:1px solid var(--border);border-radius:20px;padding:6px 12px;color:var(--dim);background:var(--surface);white-space:nowrap}
  .chip b{color:var(--teal);font-weight:700;margin-left:4px}
  .chip--active{border-color:var(--teal);color:var(--text)}
  .rows{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface)}
  .row{display:grid;grid-template-columns:1fr 1fr auto;gap:14px;align-items:center;padding:13px 18px;text-decoration:none;color:var(--text);border-top:1px solid var(--border)}
  .row:first-child{border-top:none}
  .row:hover{background:#0c1416}
  .row--head{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);cursor:default}
  .row--head:hover{background:transparent}
  .host{font-family:var(--mono);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cat{font-size:13px;color:var(--dim)}
  .row .chip{border:none;padding:4px 11px;font-weight:800;font-size:11.5px;text-transform:uppercase;letter-spacing:.3px}
  .chip--good{background:color-mix(in srgb,var(--green) 18%,transparent);color:#86efac}
  .chip--warn{background:color-mix(in srgb,var(--amber) 22%,transparent);color:#e3c675}
  .chip--bad{background:color-mix(in srgb,var(--red) 18%,transparent);color:#f19999}
  .pager{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;font-size:14px}
  .pg{color:var(--teal);text-decoration:none;border:1px solid var(--border);border-radius:9px;padding:8px 14px}
  .pg--off{color:var(--dim);opacity:.5}
  .pg-info{font-size:13px;color:var(--dim)}
  .empty{color:var(--dim);border:1px solid var(--border);border-radius:12px;padding:24px;background:var(--surface)}
  .foot{max-width:920px;margin:0 auto;padding:22px 24px 50px;border-top:1px solid var(--border);color:var(--dim);font-size:13px}
  .foot a{color:var(--teal)}
</style>
</head>
<body>
  <div class="nav">
    <a class="brand" href="/">botwatch<span>.xyz</span></a>
    <div><a href="/readiness-check">Check a site</a><a href="/methodology">Methodology</a></div>
  </div>
  <main>
    <div class="eyebrow">Directory</div>
    <h1>${category ? `${esc(category)} — AI-readiness directory` : 'Company AI-readiness directory'}</h1>
    <p class="lead">${category
        ? `Companies in <b>${esc(category)}</b>, ranked by how ready their sites are for the agentic web.`
        : 'Every company we’ve profiled, ranked by how ready their sites are for the agentic web — AI legibility, WebMCP agent-actionability, and security posture.'}
      ${category ? ' <a href="/directory">← All categories</a>' : ''}</p>
    ${categories.length ? `<div class="cats">${category ? '<a class="chip" href="/directory">All</a>' : '<span class="chip chip--active">All</span>'}${catChips}</div>` : ''}
    ${body}
  </main>
  <div class="foot">
    Independent AI-readiness assessments by <a href="/">botwatch.xyz</a>. Learn about <a href="/methodology">our methodology</a> or <a href="/readiness-check">check a site</a>.
  </div>
</body>
</html>`;
}
