import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './ReadinessCheck.css'

// Public AI-readiness checker + funnel entry. Free teaser (real signals), then a
// $5 upsell for the full crawl + recommendations. The purchase itself is wired
// in the next increment (C); for now the CTA explains what's coming.

const BAND_LABEL = {
  Emerging: 'Emerging',
  Developing: 'Developing',
  Strong: 'Strong',
}

function Pillar({ title, subtitle, pillar }) {
  return (
    <div className="rc-pillar">
      <div className="rc-pillar-head">
        <h3>{title}</h3>
        <span className="rc-pillar-score">{pillar.present}/{pillar.total}</span>
      </div>
      <p className="rc-pillar-sub">{subtitle}</p>
      <ul className="rc-signals">
        {pillar.signals.map((s) => (
          <li key={s.label} className={s.present ? 'rc-yes' : 'rc-no'}>
            <span className="rc-mark">{s.present ? '✓' : '✕'}</span>{s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ReadinessCheck() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showBuy, setShowBuy] = useState(false)
  const [reportEmail, setReportEmail] = useState('')
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [searchParams] = useSearchParams()
  const paid = searchParams.get('report') === 'success'

  const buyReport = async (e) => {
    e.preventDefault()
    setBuyError(''); setBuying(true)
    try {
      const res = await fetch('/api/readiness/report/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email: reportEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url // hand off to Stripe Checkout
    } catch (e) {
      setBuyError(e.message); setBuying(false)
    }
  }

  const scan = async (e) => {
    e.preventDefault()
    setError(''); setResult(null); setBusy(true)
    try {
      const res = await fetch('/api/readiness/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not scan that site')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="rc-page">
      {paid && (
        <div className="rc-paid">
          <strong>Payment received 🎉</strong> — your AI-readiness report is being generated and will be emailed to you shortly.
        </div>
      )}
      <section className="rc-hero">
        <span className="rc-eyebrow">AI Readiness Check</span>
        <h1>Is your site ready for AI agents?</h1>
        <p>
          AI agents are starting to <strong>read</strong> and <strong>act on</strong> the web. See how your site
          scores on both — content agents can understand (llms.txt, structured data) and
          <a href="https://developer.chrome.com/docs/ai/webmcp" target="_blank" rel="noreferrer"> WebMCP</a> tools
          agents can actually call. Free instant check.
        </p>
        <form className="rc-form" onSubmit={scan}>
          <input
            className="rc-input"
            type="text"
            placeholder="yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button className="rc-btn rc-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Scanning…' : 'Check my site'}
          </button>
        </form>
        {error && <p className="rc-error">{error}</p>}
      </section>

      {result && (
        <section className="rc-results">
          <div className="rc-summary">
            <div>
              <div className="rc-summary-host">{result.hostname}</div>
              {!result.reachable && <div className="rc-warn">We couldn't fully load the homepage — results may be partial.</div>}
            </div>
            <div className={`rc-band rc-band--${result.band?.toLowerCase()}`}>
              {BAND_LABEL[result.band] || result.band}
            </div>
          </div>

          <div className="rc-pillars">
            <Pillar
              title="Legibility"
              subtitle="Can agents read & understand your site?"
              pillar={result.pillars.legibility}
            />
            <Pillar
              title="Actionability"
              subtitle="Can agents act on your site (WebMCP)?"
              pillar={result.pillars.actionability}
            />
          </div>

          <div className="rc-upsell">
            <h2>Unlock your full report</h2>
            <p>
              We found <strong>{result.lockedRecommendations} specific {result.lockedRecommendations === 1 ? 'fix' : 'fixes'}</strong> we
              can recommend. The full report crawls your whole site, checks every signal in depth
              (including your WebMCP tool quality), and gives you a prioritised, step-by-step plan
              to become AI-ready — emailed to you.
            </p>
            <div className="rc-price">$5 <span>AUD · one-time</span></div>
            {!showBuy ? (
              <button className="rc-btn rc-btn--primary rc-btn--lg" onClick={() => setShowBuy(true)}>
                Get the full report
              </button>
            ) : (
              <form className="rc-buy" onSubmit={buyReport}>
                <input
                  className="rc-input"
                  type="email"
                  placeholder="you@company.com"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  required
                />
                <button className="rc-btn rc-btn--primary rc-btn--lg" type="submit" disabled={buying}>
                  {buying ? 'Redirecting…' : 'Pay $5 AUD'}
                </button>
              </form>
            )}
            <p className="rc-buy-note">We'll email your report to this address once it's generated.</p>
            {buyError && <p className="rc-error">{buyError}</p>}
          </div>
        </section>
      )}

      <section className="rc-explainer">
        <h2>The two pillars of AI readiness</h2>
        <div className="rc-explainer-grid">
          <div>
            <h3>Legibility — can agents understand you?</h3>
            <p>An <code>llms.txt</code> index, schema.org structured data, a clear AI-crawler policy, and clean content let LLMs read and represent your site accurately.</p>
          </div>
          <div>
            <h3>Actionability — can agents act for you?</h3>
            <p><a href="https://developer.chrome.com/docs/ai/webmcp" target="_blank" rel="noreferrer">WebMCP</a> lets you expose structured tools (search, book, checkout) that agents call reliably — instead of guessing at your UI. Almost no one has this yet; being early is an edge.</p>
          </div>
        </div>
        <p className="rc-explainer-foot">
          Want the API instead? See the <Link to="/docs">developer docs</Link> and <Link to="/pricing">pricing</Link>.
        </p>
      </section>
    </main>
  )
}
