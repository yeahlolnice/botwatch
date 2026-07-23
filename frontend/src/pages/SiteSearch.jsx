import { useState } from 'react'
import { Link } from 'react-router-dom'
import './SiteSearch.css'

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}

function scoreColor(score) {
  if (score == null) return 'var(--text-dim)'
  if (score >= 70) return 'var(--green, #4ade80)'
  if (score >= 40) return 'var(--yellow, #eab308)'
  return 'var(--text-dim)'
}

function normalizeHostname(input) {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return ''
  // Accept a bare hostname or a pasted URL.
  let host
  try {
    host = trimmed.includes('://') ? new URL(trimmed).hostname : new URL(`https://${trimmed}`).hostname
  } catch {
    host = trimmed
  }
  return host.replace(/\.+$/, '') // tolerate a trailing-dot FQDN
}

function Badge({ ok, label }) {
  return (
    <span className={`search-badge ${ok ? 'search-badge--found' : 'search-badge--missing'}`}>
      {ok ? '✓' : '—'} {label}
    </span>
  )
}

export default function SiteSearch() {
  const [input, setInput] = useState('')
  const [searchedHost, setSearchedHost] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    const hostname = normalizeHostname(input)
    if (!hostname) return

    setLoading(true)
    setError(null)
    setProfile(null)
    setSearchedHost(hostname)

    try {
      const res = await fetch(`/api/public/site/${encodeURIComponent(hostname)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // A malformed hostname (400) is a user-input problem, not a system
        // failure — say so plainly instead of surfacing a raw HTTP status.
        if (res.status === 400) {
          setError(`"${hostname}" doesn't look like a valid domain name — check the spelling and try again.`)
        } else {
          setError(data?.error || `Something went wrong (HTTP ${res.status}). Please try again.`)
        }
        return
      }
      setProfile(data)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const readiness = profile?.aiReadiness

  return (
    <main className="search-page">
      <div className="search-header">
        <h1>Site Search</h1>
        <p>Look up any domain <Link to="/willowbot">Willowbot</Link> has crawled — AI readiness, tech stack, category, and more.</p>
      </div>

      <form className="search-form" onSubmit={handleSearch}>
        <input
          className="search-input"
          placeholder="example.com"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button className="search-btn" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="search-error">{error}</div>}

      {profile && profile.found === false && (
        <div className="search-empty">
          <strong>{searchedHost}</strong> hasn't been indexed yet — it isn't in the crawl queue.
        </div>
      )}

      {profile && profile.found && (
        <div className="search-results">
          <div className="search-card">
            <div className="search-card-head">
              <div>
                <h2>{profile.title || profile.hostname}</h2>
                <span className="search-hostname">{profile.hostname}</span>
                {profile.description && <p className="search-description">{profile.description}</p>}
              </div>
              {profile.category && <span className="search-category">{profile.category}</span>}
            </div>

            <div className="search-stats">
              <div className="search-stat">
                <span className="search-stat-value" style={{ color: scoreColor(readiness?.score) }}>{readiness?.score ?? '—'}</span>
                <span className="search-stat-label">AI Readiness Score</span>
              </div>
              <div className="search-stat">
                <span className="search-stat-value">{fmt(profile.pagesCrawled)}</span>
                <span className="search-stat-label">Pages Crawled</span>
              </div>
              <div className="search-stat">
                <span className="search-stat-value">{fmt(profile.subdomainCount)}</span>
                <span className="search-stat-label">Known Subdomains</span>
              </div>
            </div>

            <div className="search-section">
              <h3>AI Readiness Signals</h3>
              <div className="search-badges">
                <Badge ok={readiness?.llmsTxtFound} label="llms.txt" />
                <Badge ok={readiness?.aiTxtFound} label="ai.txt" />
                <Badge ok={readiness?.humansTxtFound} label="humans.txt" />
                <Badge ok={readiness?.robotsTxtFound} label="robots.txt" />
                <Badge ok={!!profile.termsUrl} label="Terms & Conditions" />
              </div>
              {profile.termsUrl && (
                <a className="search-terms-link" href={profile.termsUrl} target="_blank" rel="noopener noreferrer">{profile.termsUrl} ↗</a>
              )}
            </div>

            {readiness?.trainingPolicy && (
              <div className="search-section">
                <h3>AI Training Policy</h3>
                <p className="search-section-sub">
                  {readiness.trainingPolicyExplicit
                    ? 'This site has explicitly declared rules for AI crawlers in robots.txt.'
                    : 'No AI crawler-specific rules found — bots below inherit the site\'s default robots.txt rules.'}
                </p>
                <div className="search-bot-grid">
                  {Object.entries(readiness.trainingPolicy).map(([bot, status]) => (
                    <span key={bot} className={`search-bot-chip search-bot-chip--${status}`}>
                      {bot} <span>{status}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.techStack?.length > 0 && (
              <div className="search-section">
                <h3>Tech Stack</h3>
                <div className="search-chips">
                  {profile.techStack.map(tech => <span key={tech} className="search-chip">{tech}</span>)}
                </div>
              </div>
            )}

            {profile.socialLinks?.length > 0 && (
              <div className="search-section">
                <h3>Social Links</h3>
                <div className="search-social-links">
                  {profile.socialLinks.map(url => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="search-social-link">{url}</a>
                  ))}
                </div>
              </div>
            )}

            <div className="search-section">
              <h3>Contact Info</h3>
              {(profile.contacts.emailCount > 0 || profile.contacts.phoneCount > 0) ? (
                <>
                  <ul className="search-contacts">
                    {profile.contacts.emails.map(e => <li key={e}>{e}</li>)}
                    {profile.contacts.phoneNumbers.map(p => <li key={p}>{p}</li>)}
                  </ul>
                  <button className="search-unlock-btn" disabled title="Coming soon">
                    🔒 Unlock Full Contact Info — Coming Soon
                  </button>
                </>
              ) : (
                <p className="search-section-sub">No public email or phone links found on crawled pages.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
