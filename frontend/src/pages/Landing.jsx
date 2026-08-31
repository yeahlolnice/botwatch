import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './Landing.css'

// The platform's main homepage and commercial front door: the AI-readiness
// product. The security research side (honeypots, threat intel) is a free
// side-project with its own landing at /security, teased at the bottom here.

const features = [
  {
    icon: '📄',
    title: 'Content agents can read',
    desc: 'llms.txt, ai.txt, robots policy and structured (JSON-LD) data — the signals that decide whether an AI answer can understand, quote, and cite your site.',
  },
  {
    icon: '🛠️',
    title: 'Tools agents can call',
    desc: 'WebMCP lets your site expose structured tools an AI agent can actually invoke, instead of guessing at your UI. We detect what you expose and score it.',
  },
  {
    icon: '📊',
    title: 'Benchmarked over time',
    desc: 'Every domain gets an independent, tracked readiness score with a full profile — see where you stand against your cohort and whether you are improving.',
  },
]

function fmt(n) {
  if (!n) return '0'
  return Number(n).toLocaleString()
}

function usePublicData(endpoint, interval = 60000) {
  const [data, setData] = useState(null)
  useEffect(() => {
    const load = () =>
      fetch(endpoint)
        .then(r => r.ok ? r.json() : null)
        .then(setData)
        .catch(() => {})
    load()
    const id = setInterval(load, interval)
    return () => clearInterval(id)
  }, [endpoint, interval])
  return data
}

export default function Landing() {
  const navigate = useNavigate()
  const readiness = usePublicData('/api/public/ai-readiness')
  const [url, setUrl] = useState('')

  // Hand off to the existing check page, which prefills and auto-scans from the
  // ?url= param — no need to duplicate the scan flow here.
  const check = (e) => {
    e.preventDefault()
    const u = url.trim()
    if (u) navigate(`/readiness-check?url=${encodeURIComponent(u)}`)
  }

  return (
    <main className="landing">
      <section className="hero-section">
        <div className="hero-badge">AI Readiness · Get seen and cited by AI</div>
        <h1 className="hero-title">
          Is your site ready to be seen and cited by AI?
        </h1>
        <p className="hero-desc">
          AI agents are starting to read and act on the web. botwatch scores how ready your
          site is on both fronts — the content agents can understand and the tools they can
          call — and shows you exactly what to fix. Free instant check.
        </p>
        <form className="rd-form" onSubmit={check}>
          <input
            className="rd-input"
            type="text"
            placeholder="yourwebsite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Your website"
            required
          />
          <button className="btn-primary" type="submit">Check my site →</button>
        </form>
        <div className="hero-actions">
          <Link to="/readiness" className="btn-ghost">See the live readiness index</Link>
        </div>
      </section>

      {/* Live credibility bar from the crawled corpus */}
      <section className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{readiness ? fmt(readiness.domainsChecked) : '—'}</span>
          <span className="stat-label">Domains Scored</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{readiness ? fmt(readiness.pagesChecked) : '—'}</span>
          <span className="stat-label">Pages Analysed</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{readiness != null ? `${readiness.pctWithLlmsTxt}%` : '—'}</span>
          <span className="stat-label">Have llms.txt</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{readiness != null ? `${readiness.pctWithJsonLd}%` : '—'}</span>
          <span className="stat-label">Have JSON-LD</span>
        </div>
      </section>

      <section className="features-section" id="what">
        <h2 className="section-title">What we score</h2>
        <p className="section-sub">Two things decide whether an AI agent can use your site — and most sites only think about one.</p>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <div>
              <h3>Run a free instant check</h3>
              <p>Enter your domain and get an immediate readiness score across AI-legibility signals and agent-actionable tools — no signup required.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <div>
              <h3>See exactly what to fix</h3>
              <p>Your profile breaks the score down signal by signal — llms.txt, structured data, crawler policy, WebMCP — with the specific gaps holding you back.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <div>
              <h3>Get the full report</h3>
              <p>Go deeper with a detailed, benchmarked report and track your readiness over time as you improve. <Link to="/pricing">See plans →</Link></p>
            </div>
          </div>
        </div>
      </section>

      {/* Compact teaser for the security research side-project */}
      <section className="security-teaser">
        <div className="security-teaser-body">
          <span className="security-teaser-eyebrow">Also from botwatch</span>
          <h2>We track the bad bots of the web</h2>
          <p>
            Our security research side-project runs a network of honeypots studying how malicious
            bots and automated crawlers probe the web. It's free, open, and genuinely fascinating.
          </p>
        </div>
        <Link to="/security" className="btn-ghost">Explore the threat intel →</Link>
      </section>
    </main>
  )
}
