import { Link } from 'react-router-dom'
import './Landing.css'

const features = [
  {
    icon: '🔍',
    title: 'Universal Request Capture',
    desc: 'Every HTTP request hitting your endpoints is logged automatically — method, path, headers, IP, timing, and more.',
  },
  {
    icon: '🤖',
    title: 'Bot & Crawler Classification',
    desc: 'Identify LLM crawlers (GPTBot, ClaudeBot), search engines, monitoring tools, and malicious scanners by User-Agent fingerprints.',
  },
  {
    icon: '📊',
    title: 'Live Dashboard',
    desc: 'Real-time traffic tables, stat cards, and breakdowns by method, status code, and bot type — updated on demand.',
  },
  {
    icon: '🛡️',
    title: 'Non-Blocking Tracking',
    desc: 'Tracking fires after the response is sent. Your API latency stays clean — visibility with zero overhead.',
  },
]

const botTypes = [
  { label: 'OpenAI GPTBot', type: 'LLM Crawler', color: 'var(--green)' },
  { label: 'Anthropic ClaudeBot', type: 'LLM Crawler', color: 'var(--green)' },
  { label: 'Googlebot', type: 'Search Crawler', color: 'var(--accent)' },
  { label: 'Python Requests', type: 'Script', color: 'var(--yellow)' },
  { label: 'Nikto Scanner', type: 'Security Scanner', color: 'var(--red)' },
  { label: 'UptimeRobot', type: 'Monitor', color: 'var(--text-dim)' },
]

export default function Landing() {
  return (
    <main className="landing">
      <section className="hero-section">
        <div className="hero-badge">Open Source · Built with Node + React</div>
        <h1 className="hero-title">
          See exactly who's<br />hitting your server.
        </h1>
        <p className="hero-desc">
          botwatch.xyz captures every request to your backend — bots, crawlers, AI agents,
          and real users — and gives you a clear dashboard to understand your traffic.
        </p>
        <div className="hero-actions">
          <Link to="/dashboard" className="btn-primary">Open Dashboard →</Link>
          <a href="#how-it-works" className="btn-ghost">How it works</a>
        </div>
      </section>

      <section className="features-section" id="how-it-works">
        <h2 className="section-title">What botwatch tracks</h2>
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

      <section className="bots-section">
        <h2 className="section-title">Recognized automatically</h2>
        <p className="section-sub">botwatch classifies these and 40+ more out of the box</p>
        <div className="bot-chips">
          {botTypes.map(b => (
            <div key={b.label} className="bot-chip">
              <span className="bot-dot" style={{ background: b.color }} />
              <span className="bot-name">{b.label}</span>
              <span className="bot-type">{b.type}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="how-section">
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <div>
              <h3>Middleware captures the request</h3>
              <p>Express middleware listens on all routes and records headers, IP, User-Agent, and body.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <div>
              <h3>Response finishes — data is persisted</h3>
              <p>After the response is sent, status code and response time are appended and the record is written to PostgreSQL.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <div>
              <h3>Dashboard shows you everything</h3>
              <p>Filter by method, status, or bot type. See live traffic, stat summaries, and User-Agent breakdowns.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>botwatch<span style={{ color: 'var(--accent)' }}>.xyz</span></span>
        <span style={{ color: 'var(--text-dim)' }}>Track everything. Miss nothing.</span>
      </footer>
    </main>
  )
}
