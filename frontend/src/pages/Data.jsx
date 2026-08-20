import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Data.css'

// Public "Data & downloads" page (Phase 6.5). Surfaces the free threat blocklist
// in three formats + points power users at the API for richer, real-time data.
export default function Data() {
  const [count, setCount] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)

  useEffect(() => {
    document.title = 'Data & downloads — botwatch.xyz'
    // Edge-cached, so this is cheap; used only to show the current list size.
    fetch('/api/public/blocklist?format=json', { credentials: 'omit' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) { setCount(j.count); setGeneratedAt(j.generatedAt) } })
      .catch(() => {})
  }, [])

  return (
    <div className="data">
      <header className="data-head">
        <div className="data-eyebrow">Data &amp; downloads</div>
        <h1>Free threat intelligence</h1>
        <p className="data-lead">
          We publish a slice of what our sensors see, free to use. Start with the threat blocklist
          below; for richer, real-time data, use the API.
        </p>
      </header>

      <section className="data-card data-card--primary">
        <div className="data-card-head">
          <h2>Threat blocklist</h2>
          {count != null && <span className="data-count">{count.toLocaleString()} IPs</span>}
        </div>
        <p>
          High-confidence malicious IPs — addresses that hit one of our honeypot decoys (which no
          legitimate visitor has any reason to touch) or that our analysts have confirmed malicious.
          We deliberately leave out model-only guesses, so the list stays clean enough to drop
          straight into a firewall or blocklist. Aggregate metadata only — never payloads or user data.
        </p>

        <div className="data-downloads">
          <a className="data-btn" href="/api/public/blocklist?format=txt">Download .txt</a>
          <a className="data-btn" href="/api/public/blocklist?format=csv">Download .csv</a>
          <a className="data-btn" href="/api/public/blocklist?format=json">Download .json</a>
        </div>

        <div className="data-meta">
          <div><span>Hotlink</span><code>https://botwatch.xyz/blocklist.txt</code></div>
          <div><span>License</span>Free to use with attribution to botwatch.xyz</div>
          <div><span>Updates</span>Continuously; cached ~1 hour{generatedAt ? ` · last generated ${new Date(generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}</div>
        </div>
      </section>

      <section className="data-card">
        <h2>Need more?</h2>
        <p>
          The API exposes per-IP risk scores, domain intelligence, and the full enriched threat feed
          in real time. See the <Link to="/docs">API docs</Link> or <Link to="/pricing">pricing</Link>.
          Questions or bulk-data requests? <Link to="/contact">Get in touch</Link>.
        </p>
      </section>
    </div>
  )
}
