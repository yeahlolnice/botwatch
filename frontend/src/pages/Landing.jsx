import { Link } from 'react-router-dom'
import './Landing.css'

const features = [
  {
    icon: '🪤',
    title: 'Honeypot Endpoints',
    desc: 'Fake .env files, WordPress login pages, phpinfo, actuator endpoints, SSH keys, and more — served to anyone probing for vulnerabilities. Every hit is logged and attributed.',
  },
  {
    icon: '🔬',
    title: 'Payload Analysis',
    desc: 'Every request body, query string, and header is scanned for SQLi, XSS, path traversal, command injection, SSRF, Log4Shell, XXE, and deserialization attempts in real time.',
  },
  {
    icon: '🌐',
    title: 'Threat Actor Profiling',
    desc: 'IPs, User-Agents, and attack patterns are correlated across sessions to identify campaigns, tooling, and the infrastructure behind automated scanning operations.',
  },
  {
    icon: '📡',
    title: 'Full Request Fidelity',
    desc: 'Headers, cookies, bodies, and timing are stored unredacted. The raw data is the research value — nothing is sanitised before it hits the database.',
  },
]

const botTypes = [
  { label: 'OpenAI GPTBot', type: 'LLM Crawler', color: 'var(--green)' },
  { label: 'Anthropic ClaudeBot', type: 'LLM Crawler', color: 'var(--green)' },
  { label: 'Googlebot', type: 'Search Crawler', color: 'var(--accent)' },
  { label: 'Python Requests', type: 'Script', color: 'var(--yellow)' },
  { label: 'Nikto Scanner', type: 'Security Scanner', color: 'var(--red)' },
  { label: 'Nuclei', type: 'Security Scanner', color: 'var(--red)' },
  { label: 'SQLMap', type: 'Security Scanner', color: 'var(--red)' },
  { label: 'Masscan', type: 'Port Scanner', color: 'var(--orange)' },
]

export default function Landing() {
  return (
    <main className="landing">
      <section className="hero-section">
        <div className="hero-badge">Cybersecurity Research · Open Data Collection</div>
        <h1 className="hero-title">
          What are bots actually<br />doing to your server?
        </h1>
        <p className="hero-desc">
          botwatch.xyz is an open research project studying how malicious bots, automated scanners,
          and threat actors interact with web infrastructure in the wild — and what they're looking for.
        </p>
        <div className="hero-actions">
          <Link to="/dashboard" className="btn-primary">Live Data →</Link>
          <a href="#research" className="btn-ghost">About the project</a>
        </div>
      </section>

      <section className="features-section" id="research">
        <h2 className="section-title">What we're studying</h2>
        <p className="section-sub">Every request to this server is a data point. This is what we collect and why.</p>
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
        <h2 className="section-title">Who's out there</h2>
        <p className="section-sub">A sample of what we see hitting servers every day</p>
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

      <section className="how-section" id="how-it-works">
        <h2 className="section-title">How the data is collected</h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <div>
              <h3>Every request is captured</h3>
              <p>Express middleware intercepts all traffic — including probes for known vulnerabilities, path enumeration attempts, and requests to honeypot endpoints designed to attract automated scanners.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <div>
              <h3>Payloads are analysed for attack signatures</h3>
              <p>Request bodies, query strings, and headers are scanned against 60+ signatures covering common attack categories. Matches are stored with the exact excerpt that triggered the detection.</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <div>
              <h3>Patterns are correlated over time</h3>
              <p>IP addresses, tooling fingerprints, and payload patterns are linked across sessions. The goal is to identify coordinated campaigns, understand attacker tooling, and potentially surface 0-day exploit attempts being used in the wild.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>botwatch<span style={{ color: 'var(--accent)' }}>.xyz</span></span>
        <span style={{ color: 'var(--text-dim)' }}>Cybersecurity research. All data collected passively.</span>
      </footer>
    </main>
  )
}
