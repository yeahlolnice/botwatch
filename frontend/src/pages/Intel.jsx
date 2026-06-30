import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Intel.css'

function fmt(n) {
  if (!n) return '0'
  return Number(n).toLocaleString()
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const CRAWLER_TYPE_LABEL = {
  'search-engine': 'Search Engine',
  'llm-crawler': 'LLM Crawler',
  'seo-tool': 'SEO Tool',
  'monitoring': 'Monitoring',
}

const CRAWLER_TYPE_COLOR = {
  'search-engine': 'var(--accent)',
  'llm-crawler': 'var(--green)',
  'seo-tool': 'var(--yellow)',
  'monitoring': 'var(--text-dim)',
}

function usePolled(endpoint, interval = 30000) {
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

function BarRow({ label, value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="bar-value">{fmt(value)}</span>
    </div>
  )
}

export default function Intel() {
  const stats = usePolled('/api/public/stats')
  const intel = usePolled('/api/public/intel')
  const leaderboard = usePolled('/api/public/leaderboard')

  const maxAttack = intel?.attacks?.[0]?.occurrences ?? 1
  const maxCountry = intel?.countries?.[0]?.total_requests ?? 1
  const maxHoneypot = intel?.honeypots?.[0]?.hits ?? 1

  return (
    <main className="intel-page">
      <div className="intel-header">
        <div>
          <h1>Live Intelligence</h1>
          <p>Real-time data from the botwatch honeypot network. Updates every 30 seconds.</p>
        </div>
        <span className="intel-pulse"><span className="pulse-dot" />Live</span>
      </div>

      {/* Top stats */}
      <div className="intel-stats">
        {[
          { label: 'Total Requests', value: stats?.total_requests },
          { label: 'Unique IPs', value: stats?.unique_ips },
          { label: 'Countries', value: stats?.countries_seen },
          { label: 'Trap Hits', value: stats?.honeypot_hits },
          { label: 'Attack Signals', value: stats?.threat_requests },
          { label: 'Last 24h', value: stats?.requests_last_24h },
        ].map(s => (
          <div key={s.label} className="intel-stat">
            <span className="intel-stat-value">{fmt(s.value)}</span>
            <span className="intel-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="intel-grid">

        {/* Attack breakdown */}
        <div className="intel-card">
          <h2>Attack Types Detected</h2>
          <p className="intel-card-sub">Payload signatures matched across all requests</p>
          {intel?.attacks?.length > 0 ? (
            <div className="bar-list">
              {intel.attacks.map(a => (
                <BarRow
                  key={a.category}
                  label={a.category}
                  value={a.occurrences}
                  max={maxAttack}
                  color="var(--red)"
                />
              ))}
            </div>
          ) : <div className="intel-empty">No attack signals yet</div>}
        </div>

        {/* Honeypot breakdown */}
        <div className="intel-card">
          <h2>Most Probed Traps</h2>
          <p className="intel-card-sub">Honeypot endpoints ranked by hit count</p>
          {intel?.honeypots?.length > 0 ? (
            <div className="bar-list">
              {intel.honeypots.map(h => (
                <BarRow
                  key={h.trap_type}
                  label={h.trap_type}
                  value={h.hits}
                  max={maxHoneypot}
                  color="var(--yellow)"
                />
              ))}
            </div>
          ) : <div className="intel-empty">No honeypot hits yet</div>}
        </div>

        {/* Country breakdown */}
        <div className="intel-card intel-card-wide">
          <h2>Top Countries by Request Volume</h2>
          <p className="intel-card-sub">Where the traffic is coming from</p>
          {intel?.countries?.length > 0 ? (
            <div className="country-table">
              <div className="country-table-head">
                <span>Country</span>
                <span>Requests</span>
                <span>Trap Hits</span>
                <span>Attack Signals</span>
              </div>
              {intel.countries.map(c => (
                <div key={c.country} className="country-row">
                  <span className="country-name">{c.country}</span>
                  <div className="country-bar-wrap">
                    <div className="country-bar" style={{ width: `${Math.round((c.total_requests / maxCountry) * 100)}%` }} />
                    <span>{fmt(c.total_requests)}</span>
                  </div>
                  <span className="country-traps">{fmt(c.honeypot_hits)}</span>
                  <span className="country-threats">{fmt(c.threat_requests)}</span>
                </div>
              ))}
            </div>
          ) : <div className="intel-empty">No country data yet</div>}
        </div>

        {/* Bot leaderboard */}
        <div className="intel-card intel-card-wide">
          <h2>Known Crawler Leaderboard</h2>
          <p className="intel-card-sub">Legitimate bots and crawlers we've identified and classified</p>
          {leaderboard?.length > 0 ? (
            <div className="leaderboard">
              {leaderboard.map((bot, i) => (
                <div key={bot.name} className="leaderboard-row">
                  <span className="lb-rank">#{i + 1}</span>
                  <div className="lb-info">
                    <span className="lb-name">{bot.name}</span>
                    <span
                      className="lb-type"
                      style={{ color: CRAWLER_TYPE_COLOR[bot.type] || 'var(--text-dim)' }}
                    >
                      {CRAWLER_TYPE_LABEL[bot.type] || bot.type}
                    </span>
                  </div>
                  <div className="lb-stats">
                    <span>{fmt(bot.total_visits)} visits</span>
                    <span>{bot.countries} {bot.countries === 1 ? 'country' : 'countries'}</span>
                    <span className="lb-last">last seen {timeAgo(bot.last_seen)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="intel-empty">No classified crawlers yet — check back once the site gets some traffic</div>
          )}
        </div>

      </div>

      <div className="intel-footer">
        <span>All data collected passively. No active scanning.</span>
        <Link to="/">← Back to home</Link>
      </div>
    </main>
  )
}
