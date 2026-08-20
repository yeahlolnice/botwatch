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

const SEVERITY_COLOR = {
  critical: 'var(--red)',
  high: 'var(--orange)',
  medium: 'var(--yellow)',
  low: 'var(--accent)',
}

function shortDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Daily attack-volume bars (last 30 days). Pure SVG, no chart lib.
function TrendBars({ data }) {
  if (!data || data.length < 2) return <div className="intel-empty">Not enough history yet</div>
  const vals = data.map(d => Number(d.attacks) || 0)
  const max = Math.max(...vals, 1)
  const W = 640, H = 130, pad = { l: 6, r: 6, t: 10, b: 18 }
  const bw = (W - pad.l - pad.r) / data.length
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, height: 'auto', display: 'block' }}>
          {data.map((d, i) => {
            const v = Number(d.attacks) || 0
            const h = (v / max) * (H - pad.t - pad.b)
            const x = pad.l + i * bw
            return (
              <rect key={i} x={x + 1} y={H - pad.b - h} width={Math.max(bw - 2, 1)} height={h} fill="var(--red)" opacity="0.85">
                <title>{`${shortDate(d.day)}: ${fmt(d.attacks)} attacks · ${fmt(d.ips)} IPs · ${fmt(d.trap_hits)} trap hits`}</title>
              </rect>
            )
          })}
          <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--border)" />
        </svg>
      </div>
      <div className="trend-axis">
        <span>{shortDate(data[0].day)}</span>
        <span>peak {fmt(max)}/day</span>
        <span>{shortDate(data[data.length - 1].day)}</span>
      </div>
    </>
  )
}

export default function Intel() {
  const stats = usePolled('/api/public/stats')
  const intel = usePolled('/api/public/intel')
  const leaderboard = usePolled('/api/public/leaderboard')
  const charts = usePolled('/api/public/threat-charts', 60000)

  const maxAttack = intel?.attacks?.[0]?.occurrences ?? 1
  const maxCountry = intel?.countries?.[0]?.total_requests ?? 1
  const maxHoneypot = intel?.honeypots?.[0]?.hits ?? 1
  const maxIntent = charts?.attackIntents?.[0]?.occurrences ?? 1
  const maxSeverity = Math.max(1, ...(charts?.attackSeverities ?? []).map(s => Number(s.occurrences) || 0))
  const maxUsage = charts?.attackInfraUsage?.[0]?.ips ?? 1

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

      <div className="intel-grid intel-grid-col-2">

        {/* Attack volume trend */}
        <div className="intel-card intel-card-wide">
          <h2>Attack Volume</h2>
          <p className="intel-card-sub">Daily attack requests over the last 30 days</p>
          <TrendBars data={charts?.attackTrend} />
        </div>

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

        {/* Attacker intent */}
        <div className="intel-card">
          <h2>Attacker Intent</h2>
          <p className="intel-card-sub">What the automated traffic is trying to do</p>
          {charts?.attackIntents?.length > 0 ? (
            <div className="bar-list">
              {charts.attackIntents.map(i => (
                <BarRow key={i.intent} label={i.intent} value={Number(i.occurrences)} max={maxIntent} color="var(--orange)" />
              ))}
            </div>
          ) : <div className="intel-empty">No classified attacks yet</div>}
        </div>

        {/* Severity */}
        <div className="intel-card">
          <h2>Attack Severity</h2>
          <p className="intel-card-sub">Distribution by severity of matched signatures</p>
          {charts?.attackSeverities?.length > 0 ? (
            <div className="bar-list">
              {charts.attackSeverities.map(s => (
                <BarRow key={s.severity} label={s.severity} value={Number(s.occurrences)} max={maxSeverity} color={SEVERITY_COLOR[s.severity] || 'var(--accent)'} />
              ))}
            </div>
          ) : <div className="intel-empty">No severity data yet</div>}
        </div>

        {/* Known CVE exploit attempts */}
        <div className="intel-card intel-card-wide">
          <h2>Known CVE Exploit Attempts</h2>
          <p className="intel-card-sub">Named vulnerabilities attackers are firing at us</p>
          {charts?.topCves?.length > 0 ? (
            <div className="intel-table">
              <div className="intel-table-head cve-cols"><span>CVE</span><span>Attempts</span><span>Unique IPs</span><span>Last Seen</span></div>
              {charts.topCves.map(c => (
                <div key={c.cve} className="intel-table-row cve-cols">
                  <span className="mono">{c.cve}</span>
                  <span>{fmt(c.occurrences)}</span>
                  <span>{fmt(c.unique_ips)}</span>
                  <span className="dim">{timeAgo(c.last_seen)}</span>
                </div>
              ))}
            </div>
          ) : <div className="intel-empty">No CVE exploit attempts recorded yet</div>}
        </div>

        {/* Top targeted paths */}
        <div className="intel-card intel-card-wide">
          <h2>Top Targeted Paths</h2>
          <p className="intel-card-sub">The endpoints attackers probe most</p>
          {charts?.topTargetedPaths?.length > 0 ? (
            <div className="intel-table">
              <div className="intel-table-head path-cols"><span>Path</span><span>Attacks</span><span>Unique IPs</span></div>
              {charts.topTargetedPaths.map((p, i) => (
                <div key={`${p.path}-${i}`} className="intel-table-row path-cols">
                  <span className="mono ellipsis">{p.path}</span>
                  <span>{fmt(p.attacks)}</span>
                  <span>{fmt(p.unique_ips)}</span>
                </div>
              ))}
            </div>
          ) : <div className="intel-empty">No targeted paths yet</div>}
        </div>

        {/* Top attacking IPs (masked) */}
        <div className="intel-card intel-card-wide">
          <h2>Top Attacking IPs</h2>
          <p className="intel-card-sub">Most active sources — addresses masked for privacy</p>
          {charts?.topAttackingIPs?.filter(a => Number(a.threat_requests) > 0 || Number(a.honeypot_hits) > 0).length > 0 ? (
            <div className="intel-table">
              <div className="intel-table-head ip-cols"><span>IP</span><span>Requests</span><span>Threats</span><span>Traps</span><span>Score</span></div>
              {charts.topAttackingIPs.filter(a => Number(a.threat_requests) > 0 || Number(a.honeypot_hits) > 0).map((a, i) => (
                <div key={`${a.ip}-${i}`} className="intel-table-row ip-cols">
                  <span className="mono">{a.ip}</span>
                  <span>{fmt(a.total_requests)}</span>
                  <span className="threats">{fmt(a.threat_requests)}</span>
                  <span className="traps">{fmt(a.honeypot_hits)}</span>
                  <span>{a.max_threat_score ?? 0}</span>
                </div>
              ))}
            </div>
          ) : <div className="intel-empty">No attacking IPs recorded yet</div>}
        </div>

        {/* Attack infrastructure — usage type */}
        <div className="intel-card">
          <h2>Attack Infrastructure</h2>
          <p className="intel-card-sub">Hosting type of attacker IPs (enriched subset)</p>
          {charts?.attackInfraUsage?.length > 0 ? (
            <div className="bar-list">
              {charts.attackInfraUsage.map(u => (
                <BarRow key={u.usage_type} label={u.usage_type} value={Number(u.ips)} max={maxUsage} color="var(--accent)" />
              ))}
            </div>
          ) : <div className="intel-empty">No enriched infrastructure data yet</div>}
        </div>

        {/* Top attacker networks */}
        <div className="intel-card">
          <h2>Top Attacker Networks</h2>
          <p className="intel-card-sub">ISPs / networks of attacker IPs (enriched subset)</p>
          {charts?.topAttackerNetworks?.length > 0 ? (
            <div className="intel-table">
              <div className="intel-table-head net-cols"><span>Network</span><span>IPs</span><span>Country</span></div>
              {charts.topAttackerNetworks.map((n, i) => (
                <div key={`${n.isp}-${i}`} className="intel-table-row net-cols">
                  <span className="ellipsis">{n.isp}{n.has_tor ? ' ⚠' : ''}</span>
                  <span>{fmt(n.ips)}</span>
                  <span className="dim">{n.country || '—'}</span>
                </div>
              ))}
            </div>
          ) : <div className="intel-empty">No enriched network data yet</div>}
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
        <span>All data collected passively.</span>
        <Link to="/">← Back to home</Link>
      </div>
    </main>
  )
}
