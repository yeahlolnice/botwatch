// Dogfooding WebMCP: botwatch exposes its own agent-callable tools via the
// imperative WebMCP API (document.modelContext). All read-only, backed by the
// public API. No-ops in browsers without WebMCP. Outputs kept short (the spec
// suggests <~1.5K chars per tool output); names <=30 chars, descriptions <=500.

const clean = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.+$/, '')

async function getJson(url) {
  const res = await fetch(url, { credentials: 'omit', headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`botwatch request failed (${res.status})`)
  return res.json()
}

const yn = (v) => (v ? 'yes' : 'no')

const TOOLS = [
  {
    name: 'lookup_ai_readiness',
    description: "Look up botwatch's independent AI-readiness assessment for a website by hostname (e.g. example.com): overall score, AI-legibility signals (llms.txt, ai.txt, robots policy), category, and a link to the full profile.",
    inputSchema: {
      type: 'object',
      properties: { hostname: { type: 'string', description: 'Website hostname to look up, e.g. "example.com" (no protocol or path).' } },
      required: ['hostname'],
    },
    annotations: { readOnlyHint: true },
    async execute({ hostname }) {
      const h = clean(hostname)
      if (!h) return 'Please provide a hostname, e.g. example.com'
      const d = await getJson(`/api/public/site/${encodeURIComponent(h)}`)
      if (!d.found) return `botwatch has not profiled ${h} yet. Run a free check at https://botwatch.xyz/readiness-check?url=${encodeURIComponent(h)}`
      const ai = d.aiReadiness || {}
      return [
        `AI readiness for ${h}: ${ai.score ?? 'n/a'}/100.`,
        `Signals — llms.txt: ${yn(ai.llmsTxtFound)}, ai.txt: ${yn(ai.aiTxtFound)}, robots.txt: ${yn(ai.robotsTxtFound)}, explicit AI-crawler policy: ${yn(ai.trainingPolicyExplicit)}.`,
        d.category ? `Category: ${d.category}.` : '',
        `Full profile: https://botwatch.xyz/company/${encodeURIComponent(h)}`,
      ].filter(Boolean).join(' ')
    },
  },
  {
    name: 'get_threat_blocklist',
    description: "Get botwatch's free threat blocklist summary — the count of high-confidence malicious IPs (honeypot hits or analyst-confirmed) and download links.",
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async execute() {
      const d = await getJson('/api/public/blocklist?format=json')
      return `botwatch threat blocklist: ${d.count} high-confidence malicious IPs. Download: https://botwatch.xyz/blocklist.txt (also .csv/.json at /api/public/blocklist).`
    },
  },
  {
    name: 'get_threat_stats',
    description: 'Get live aggregate threat statistics from the botwatch honeypot network (totals only, no individual IPs).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async execute() {
      const s = await getJson('/api/public/stats')
      return `botwatch live stats — requests observed: ${s.total_requests}; flagged as threats: ${s.threat_requests}; honeypot hits: ${s.honeypot_hits}; countries: ${s.countries_seen}; last 24h: ${s.requests_last_24h}.`
    },
  },
]

// Register the tools if the browser supports WebMCP. Safe to call once at boot.
export function registerWebMcpTools() {
  const mc = typeof document !== 'undefined' ? document.modelContext : null
  if (!mc || typeof mc.registerTool !== 'function') return
  for (const tool of TOOLS) {
    try { mc.registerTool(tool) } catch { /* ignore — a bad tool must never break the app */ }
  }
}
