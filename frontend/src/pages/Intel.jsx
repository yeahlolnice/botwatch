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

// Compact "time to weaponize" — hours between scraping a canary and replaying it.
function fmtHours(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
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
  const creds = usePolled('/api/public/credential-attacks', 60000)

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

      {/* Honeytoken tripwires — planted canary credentials caught being replayed.
          The full scrape -> harvest -> replay attack chain, proven end to end. */}
      <section className="intel-creds intel-canary">
        <div className="intel-creds-head">
          <h2>Honeytoken tripwires</h2>
          <p className="intel-card-sub">
            We plant unique fake credentials inside the honeypot config files (a fake <code>.env</code>,
            <code> wp-config.php</code>). When an attacker scrapes one and later replays it against a login
            form, we catch the whole chain — <b>scrape → harvest → replay</b>. These values are never
            published anywhere, so a match is hard proof the attacker harvested them from us.
          </p>
        </div>

        <div className="intel-stats intel-creds-stats">
          {[
            { label: 'Credential Replays', value: creds?.canary?.stats?.total_replays },
            { label: 'Tokens Tripped', value: creds?.canary?.stats?.tokens_tripped },
            { label: 'Attacker IPs', value: creds?.canary?.stats?.attacker_ips },
            { label: 'Same-Host Chains', value: creds?.canary?.stats?.same_host_chains },
          ].map(s => (
            <div key={s.label} className="intel-stat">
              <span className="intel-stat-value">{fmt(s.value)}</span>
              <span className="intel-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="intel-card intel-card-wide">
          <h2>Recent tripwire hits</h2>
          <p className="intel-card-sub">Planted credentials caught being replayed against our login traps</p>
          {creds?.canary?.events?.length > 0 ? (
            <div className="intel-table">
              <div className="intel-table-head canary-cols"><span>Planted credential</span><span>Replayed via</span><span>From</span><span>Attack chain</span></div>
              {creds.canary.events.map((e, i) => (
                <div key={`${e.source}-${i}`} className="intel-table-row canary-cols">
                  <span className="mono ellipsis">{e.source}</span>
                  <span className="mono">{e.replayed_via || '—'}</span>
                  <span className="ellipsis">{e.ip}{e.country ? ` · ${e.country}` : ''}</span>
                  <span className={e.same_ip_scraped ? 'chain-same' : 'chain-shared'}>
                    {e.same_ip_scraped
                      ? (e.hours_to_weaponize != null
                          ? `Same host · ${fmtHours(e.hours_to_weaponize)} to weaponize`
                          : 'Same host')
                      : 'Different host (shared)'}
                  </span>
                </div>
              ))}
            </div>
          ) : <div className="intel-empty">No planted credentials replayed yet — the tripwires are armed</div>}
        </div>
      </section>

      {/* Credential attacks — what usernames/passwords attackers try against
          the honeypot login traps. One of the most compelling data sets we hold. */}
      <section className="intel-creds">
        <div className="intel-creds-head">
          <h2>Credentials attackers are trying</h2>
          <p className="intel-card-sub">
            Every username and password submitted to our fake WordPress and admin login traps.
            These are live attacker dictionaries — the passwords the internet is guessing right now.
            Repeat-value gated so nothing personal surfaces.
          </p>
        </div>

        <div className="intel-stats intel-creds-stats">
          {[
            { label: 'Password Attempts', value: creds?.stats?.password_attempts },
            { label: 'Unique Usernames', value: creds?.stats?.unique_usernames },
            { label: 'Unique Passwords', value: creds?.stats?.unique_passwords },
            { label: 'Attacker IPs', value: creds?.stats?.attacker_ips },
          ].map(s => (
            <div key={s.label} className="intel-stat">
              <span className="intel-stat-value">{fmt(s.value)}</span>
              <span className="intel-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="intel-grid intel-grid-col-2">
          {/* Top usernames */}
          <div className="intel-card">
            <h2>Top Usernames Tried</h2>
            <p className="intel-card-sub">The account names attackers guess most</p>
            {creds?.topUsernames?.length > 0 ? (
              <div className="intel-table">
                <div className="intel-table-head path-cols"><span>Username</span><span>Attempts</span><span>Unique IPs</span></div>
                {creds.topUsernames.map((u, i) => (
                  <div key={`${u.username}-${i}`} className="intel-table-row path-cols">
                    <span className="mono ellipsis">{u.username}</span>
                    <span>{fmt(u.attempts)}</span>
                    <span>{fmt(u.unique_ips)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="intel-empty">No login attempts recorded yet</div>}
          </div>

          {/* Top passwords */}
          <div className="intel-card">
            <h2>Top Passwords Tried</h2>
            <p className="intel-card-sub">The most-guessed passwords (seen 2+ times)</p>
            {creds?.topPasswords?.length > 0 ? (
              <div className="intel-table">
                <div className="intel-table-head path-cols"><span>Password</span><span>Attempts</span><span>Unique IPs</span></div>
                {creds.topPasswords.map((p, i) => (
                  <div key={`${p.password}-${i}`} className="intel-table-row path-cols">
                    <span className="mono ellipsis">{p.password}</span>
                    <span>{fmt(p.attempts)}</span>
                    <span>{fmt(p.unique_ips)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="intel-empty">No repeated passwords recorded yet</div>}
          </div>

          {/* Top credential pairs */}
          <div className="intel-card intel-card-wide">
            <h2>Top Credential Combos</h2>
            <p className="intel-card-sub">The exact username + password pairs from credential-stuffing lists (seen 2+ times)</p>
            {creds?.topPairs?.length > 0 ? (
              <div className="intel-table">
                <div className="intel-table-head cred-cols"><span>Username</span><span>Password</span><span>Attempts</span><span>Unique IPs</span></div>
                {creds.topPairs.map((p, i) => (
                  <div key={`${p.username}:${p.password}-${i}`} className="intel-table-row cred-cols">
                    <span className="mono ellipsis">{p.username}</span>
                    <span className="mono ellipsis">{p.password}</span>
                    <span>{fmt(p.attempts)}</span>
                    <span>{fmt(p.unique_ips)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="intel-empty">No repeated credential pairs recorded yet</div>}
          </div>
        </div>
      </section>

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
