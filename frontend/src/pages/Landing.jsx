import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
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

const TRAP_LABELS = {
  'env-file': '.env probe',
  'env-local': '.env.local probe',
  'git-config': '.git/config probe',
  'git-head': '.git/HEAD probe',
  'wp-login': 'WordPress login probe',
  'wp-admin': 'WordPress admin probe',
  'wp-config': 'WordPress config probe',
  'phpinfo': 'phpinfo() probe',
  'actuator-health': 'Spring Boot actuator probe',
  'actuator-env': 'Spring Boot env dump probe',
  'admin-panel': 'Admin panel probe',
  'admin-login-attempt': 'Admin login attempt',
  'sql-backup': 'SQL backup download',
  'aws-credentials': 'AWS credential probe',
  'htpasswd': '.htpasswd probe',
  'ssh-private-key': 'SSH key probe',
  'robots-recon': 'robots.txt recon',
  'server-status': 'Server status probe',
  'k8s-secrets': 'Kubernetes secrets probe',
}

function fmt(n) {
  if (!n) return '0'
  return Number(n).toLocaleString()
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function usePublicData(endpoint, interval = 30000) {
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
  const stats = usePublicData('/api/public/stats')
  const recent = usePublicData('/api/public/recent')

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
          <Link to="/intel" className="btn-primary">Live Intel →</Link>
          <a href="#research" className="btn-ghost">About the project</a>
        </div>
      </section>

      {/* Live stats bar */}
      <section className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{stats ? fmt(stats.total_requests) : '—'}</span>
          <span className="stat-label">Total Requests</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{stats ? fmt(stats.unique_ips) : '—'}</span>
          <span className="stat-label">Unique IPs</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{stats ? fmt(stats.countries_seen) : '—'}</span>
          <span className="stat-label">Countries</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{stats ? fmt(stats.honeypot_hits) : '—'}</span>
          <span className="stat-label">Trap Hits</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">{stats ? fmt(stats.requests_last_24h) : '—'}</span>
          <span className="stat-label">Last 24h</span>
        </div>
      </section>

      {/* Recent trap hits feed */}
      <section className="feed-section">
        <div className="feed-header">
          <h2 className="section-title">Live trap hits</h2>
          <span className="feed-pulse"><span className="pulse-dot" />Live</span>
        </div>
        <p className="section-sub">Real requests hitting honeypot endpoints right now. IPs are partially masked.</p>
        <div className="feed">
          {recent && recent.length > 0 ? recent.slice(0, 12).map((r, i) => (
            <div key={i} className="feed-row">
              <span className="feed-time">{timeAgo(r.timestamp)}</span>
              <span className="feed-trap">{TRAP_LABELS[r.trap_type] || r.trap_type}</span>
              <span className="feed-ip">{r.masked_ip}</span>
              <span className="feed-country">{r.country || '—'}</span>
              {r.bot_label && <span className="feed-bot">{r.bot_label}</span>}
            </div>
          )) : (
            <div className="feed-empty">Waiting for trap hits…</div>
          )}
        </div>
        <Link to="/intel" className="feed-more">View full intel →</Link>
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
        <a href="https://www.abuseipdb.com/user/324210" target="_blank" rel="noopener noreferrer"  title="AbuseIPDB is an IP address blacklist for webmasters and sysadmins to report IP addresses engaging in abusive behavior on their networks">
          <img src="https://www.abuseipdb.com/contributor/324210.svg" alt="AbuseIPDB Contributor Badge" style={{ width: 200, background: '#35c246', linearGradient:'(rgba(255,255,255,0), rgba(255,255,255,.3) 50%, rgba(0,0,0,.2) 51%, rgba(0,0,0,0))', padding: '5px' }} />
        </a>
        <span style={{ color: 'var(--text-dim)' }}>Cybersecurity research. All data collected passively.</span>
      </footer>
    </main>
  )
}