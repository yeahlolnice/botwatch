import { useState } from 'react'
import { Link } from 'react-router-dom'
import './ApiDocs.css'

// Public developer docs for the botwatch API (/api/v1). Static, SEO-friendly,
// no auth required to read — a prospective customer lands here, sees exactly
// what the API returns, then signs up for a key.

const BASE = 'https://botwatch.xyz/api/v1'

const TIERS = [
  { name: 'Free', limit: '60', blurb: 'Evaluation & low-volume use.' },
  { name: 'Pro', limit: '600', blurb: 'Production integrations.' },
  { name: 'Enterprise', limit: '6,000', blurb: 'High-throughput / SOC pipelines.' },
]

const ENDPOINTS = [
  {
    id: 'status',
    method: 'GET',
    path: '/status',
    summary: 'Verify a key and read its plan + usage.',
    desc: 'A cheap health check. Confirms the key is valid and reports the tier and lifetime request count. Good for smoke-testing an integration.',
    params: [],
    curl: `curl -H "x-api-key: bw_YOUR_KEY" \\
  ${BASE}/status`,
    response: `{
  "ok": true,
  "keyPrefix": "bw_a1b2",
  "tier": "pro",
  "requestCount": 1428
}`,
  },
  {
    id: 'feed',
    method: 'GET',
    path: '/feed',
    summary: 'The scored malicious-IP threat feed.',
    desc: 'Every IP our model has scored at or above minScore, ranked most-dangerous first. Each entry carries a plain-English reason derived from the behaviour the model actually observed. Request format=csv for a drop-in blocklist.',
    params: [
      ['minScore', 'integer 0–100', 'Minimum risk score to include. Default 70.'],
      ['format', 'json | csv', 'Response format. Default json.'],
    ],
    curl: `# JSON
curl -H "x-api-key: bw_YOUR_KEY" \\
  "${BASE}/feed?minScore=80"

# CSV blocklist
curl -H "x-api-key: bw_YOUR_KEY" \\
  "${BASE}/feed?minScore=80&format=csv"`,
    response: `{
  "generatedAt": "2026-07-29T18:22:04.913Z",
  "minScore": 80,
  "count": 2,
  "feed": [
    {
      "ip": "179.65.161.165",
      "score": 100,
      "requestCount": 431,
      "reason": "High request volume from a single IP hitting many distinct paths, including honeypot traps, with an unusually low mix of User-Agents.",
      "scoredAt": "2026-07-29T04:10:55.201Z"
    },
    {
      "ip": "45.148.10.72",
      "score": 88,
      "requestCount": 112,
      "reason": "Repeated non-GET requests with request bodies against endpoints it has no legitimate reason to POST to.",
      "scoredAt": "2026-07-29T04:10:55.201Z"
    }
  ]
}`,
  },
  {
    id: 'ip',
    method: 'GET',
    path: '/ip/{ip}',
    summary: 'Risk score + reason for a single IP.',
    desc: 'Look up one address. Returns the current model score and the reason it was flagged. If the IP has never been seen, found is false.',
    params: [['ip', 'path — IPv4/IPv6', 'The address to look up, e.g. 179.65.161.165.']],
    curl: `curl -H "x-api-key: bw_YOUR_KEY" \\
  ${BASE}/ip/179.65.161.165`,
    response: `{
  "found": true,
  "ip": "179.65.161.165",
  "score": 100,
  "reason": "High request volume from a single IP hitting many distinct paths, including honeypot traps, with an unusually low mix of User-Agents.",
  "requestCount": 431,
  "scoredAt": "2026-07-29T04:10:55.201Z"
}`,
  },
  {
    id: 'domain',
    method: 'GET',
    path: '/domain/{hostname}',
    summary: 'Passive intelligence dossier for a domain.',
    desc: 'Everything we passively know about a hostname — DNS, registration (WHOIS/RDAP), email posture (SPF/DKIM/DMARC), TLS certificate, security-header grade, hosting/ASN, reputation, and observed subdomains. No packets are sent to the target at request time; this is served from our latest snapshot.',
    params: [['hostname', 'path — domain', 'The domain to look up, e.g. stripe.com.']],
    curl: `curl -H "x-api-key: bw_YOUR_KEY" \\
  ${BASE}/domain/stripe.com`,
    response: `{
  "found": true,
  "hostname": "stripe.com",
  "category": "fintech",
  "aiReadinessScore": 82,
  "enrichment": {
    "collectedAt": "2026-07-28T11:02:41.006Z",
    "tls": { "issuer": "DigiCert Inc", "validTo": "2026-11-30T23:59:59Z" },
    "hosting": { "asn": "AS16509", "org": "AMAZON-02" },
    "securityHeaders": { "grade": "A", "gradeWord": "Strong" },
    "emailPosture": { "spf": true, "dkim": true, "dmarc": "reject" },
    "subdomains": { "count": 113 }
  }
}`,
  },
]

function Code({ children }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className="doc-code">
      <button className="doc-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      <pre><code>{children}</code></pre>
    </div>
  )
}

export default function ApiDocs() {
  return (
    <main className="doc-page">
      <div className="doc-hero">
        <span className="doc-eyebrow">Developers</span>
        <h1>botwatch API</h1>
        <p>
          A REST API for threat intelligence and domain intelligence. Pull our scored
          malicious-IP feed, look up any IP or domain, and wire the results straight into
          your firewall, SIEM, or SOC pipeline. JSON by default, CSV where it helps.
        </p>
        <div className="doc-hero-actions">
          <a className="doc-btn doc-btn--primary" href="#endpoints">Explore endpoints</a>
          <Link className="doc-btn" to="/login">Get a key</Link>
        </div>
      </div>

      <nav className="doc-toc">
        <a href="#auth">Authentication</a>
        <a href="#limits">Rate limits</a>
        <a href="#endpoints">Endpoints</a>
        <a href="#errors">Errors</a>
      </nav>

      <section className="doc-section" id="auth">
        <h2>Authentication</h2>
        <p>
          Every request must carry an API key. Pass it in the <code>x-api-key</code> header,
          or as a <code>Bearer</code> token in <code>Authorization</code>. Keys are prefixed
          <code> bw_</code> and are shown to you exactly once when created — store them
          securely and never expose them in client-side code.
        </p>
        <Code>{`curl -H "x-api-key: bw_YOUR_KEY" ${BASE}/status

# or
curl -H "Authorization: Bearer bw_YOUR_KEY" ${BASE}/status`}</Code>
        <p className="doc-note">
          The base URL for all endpoints is <code>{BASE}</code>.
        </p>
      </section>

      <section className="doc-section" id="limits">
        <h2>Rate limits</h2>
        <p>Limits are per key, enforced per minute. Your plan sets the ceiling.</p>
        <div className="doc-tiers">
          {TIERS.map((t) => (
            <div className="doc-tier" key={t.name}>
              <div className="doc-tier-name">{t.name}</div>
              <div className="doc-tier-limit">{t.limit}<span> req/min</span></div>
              <div className="doc-tier-blurb">{t.blurb}</div>
            </div>
          ))}
        </div>
        <p className="doc-note">
          Exceeding your limit returns <code>429 Too Many Requests</code>. Back off and retry.
        </p>
      </section>

      <section className="doc-section" id="endpoints">
        <h2>Endpoints</h2>
        {ENDPOINTS.map((e) => (
          <div className="doc-endpoint" id={e.id} key={e.id}>
            <div className="doc-ep-head">
              <span className="doc-method">{e.method}</span>
              <code className="doc-ep-path">/api/v1{e.path}</code>
            </div>
            <p className="doc-ep-summary">{e.summary}</p>
            <p className="doc-ep-desc">{e.desc}</p>

            {e.params.length > 0 && (
              <table className="doc-params">
                <thead>
                  <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {e.params.map((p) => (
                    <tr key={p[0]}>
                      <td><code>{p[0]}</code></td>
                      <td className="doc-param-type">{p[1]}</td>
                      <td>{p[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="doc-ep-label">Request</div>
            <Code>{e.curl}</Code>
            <div className="doc-ep-label">Response</div>
            <Code>{e.response}</Code>
          </div>
        ))}
      </section>

      <section className="doc-section" id="errors">
        <h2>Errors</h2>
        <p>The API uses conventional HTTP status codes. Error bodies are JSON with an <code>error</code> message.</p>
        <table className="doc-params">
          <thead>
            <tr><th>Status</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>Malformed request — e.g. an invalid IP or hostname.</td></tr>
            <tr><td><code>401</code></td><td>Missing or invalid API key.</td></tr>
            <tr><td><code>403</code></td><td>The key has been revoked.</td></tr>
            <tr><td><code>429</code></td><td>Rate limit exceeded for your tier.</td></tr>
            <tr><td><code>500</code></td><td>Something went wrong on our end.</td></tr>
          </tbody>
        </table>
        <p className="doc-note">
          A successful lookup for something we've never seen is not an error — it returns
          <code> 200</code> with <code>{'{ "found": false }'}</code>.
        </p>
      </section>

      <div className="doc-cta">
        <h2>Ready to build?</h2>
        <p>Sign in to generate a key and start pulling live intelligence.</p>
        <Link className="doc-btn doc-btn--primary" to="/login">Get your API key</Link>
      </div>
    </main>
  )
}
