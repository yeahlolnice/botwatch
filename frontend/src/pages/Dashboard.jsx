import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api.js'
import './Dashboard.css'

const TYPE_COLORS = {
    'llm-crawler': '#22c55e',
    'search-crawler': '#6366f1',
    'script': '#eab308',
    'scanner': '#ef4444',
    'monitor': '#888',
}

const THREAT_CAT_COLORS = {
    sqli: '#ef4444',
    xss: '#f97316',
    traversal: '#eab308',
    cmdi: '#dc2626',
    ssrf: '#a855f7',
    ssti: '#ec4899',
    log4j: '#dc2626',
    xxe: '#f59e0b',
    deser: '#ef4444',
    probe: '#6366f1',
    scanner: '#ef4444',
}

const METHOD_COLORS = {
    GET: '#22c55e',
    POST: '#6366f1',
    PUT: '#eab308',
    DELETE: '#ef4444',
    PATCH: '#f97316',
}

function statusColor(code) {
    if (!code) return '#888'
    if (code < 300) return '#22c55e'
    if (code < 400) return '#6366f1'
    if (code < 500) return '#eab308'
    return '#ef4444'
}

function scoreColor(score) {
    if (!score || score === 0) return '#888'
    if (score < 30) return '#eab308'
    if (score < 60) return '#f97316'
    return '#ef4444'
}

function formatTs(ts) {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(ts) {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function StatCard({ label, value, sub, color, highlight }) {
    return (
        <div className={`stat-card ${highlight ? 'stat-card--highlight' : ''}`}>
            <div className="stat-value" style={color ? { color } : {}}>{value ?? '—'}</div>
            <div className="stat-label">{label}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    )
}

function ThreatBadge({ signals }) {
    if (!signals || signals.length === 0) return null
    const top = signals[0]
    const color = THREAT_CAT_COLORS[top.category] || '#ef4444'
    return (
        <span className="threat-badge" style={{ borderColor: color, color }} title={signals.map(s => s.id).join(', ')}>
            ⚠ {top.category} {signals.length > 1 ? `+${signals.length - 1}` : ''}
        </span>
    )
}

function BotBadge({ label, type }) {
    const color = TYPE_COLORS[type] || '#888'
    return (
        <span className="bot-badge" style={{ borderColor: color, color }}>
            {label}
        </span>
    )
}

function RequestDetail({ request, onClose }) {
    if (!request) return null
    return (
        <div className="detail-overlay" onClick={onClose}>
            <div className="detail-panel" onClick={e => e.stopPropagation()}>
                <div className="detail-header">
                    <div>
                        <span className="method-tag" style={{ color: METHOD_COLORS[request.method] || '#fff', fontSize: 16 }}>
                            {request.method}
                        </span>
                        <span className="detail-path">{request.path}</span>
                    </div>
                    <button className="detail-close" onClick={onClose}>✕</button>
                </div>

                <div className="detail-grid">
                    <div className="detail-section">
                        <h4>Request Info</h4>
                        <dl>
                            <dt>Timestamp</dt><dd>{new Date(request.timestamp).toISOString()}</dd>
                            <dt>IP Address</dt><dd className="mono">{request.cf_connecting_ip || request.ip_address || '—'}</dd>
                            <dt>CF-Connecting-IP</dt><dd className="mono">{request.cf_connecting_ip || '—'}</dd>
                            <dt>X-Forwarded-For</dt><dd className="mono">{request.x_forwarded_for || '—'}</dd>
                            <dt>Status</dt><dd style={{ color: statusColor(request.status_code) }}>{request.status_code || '—'}</dd>
                            <dt>Response Time</dt><dd>{request.response_time_ms != null ? `${request.response_time_ms}ms` : '—'}</dd>
                            <dt>Referrer</dt><dd>{request.referrer || '—'}</dd>
                        </dl>
                    </div>

                    <div className="detail-section">
                        <h4>Classification</h4>
                        <dl>
                            <dt>Bot Label</dt><dd>{request.bot_label || 'Unclassified'}</dd>
                            <dt>Crawler Type</dt><dd>{request.crawler_type || '—'}</dd>
                            <dt>Threat Score</dt>
                            <dd style={{ color: scoreColor(request.bot_score), fontWeight: 700 }}>
                                {request.bot_score ?? 0} / 100
                            </dd>
                            <dt>Is Trap Hit</dt><dd>{request.is_trap ? `Yes — ${request.trap_type}` : 'No'}</dd>
                            <dt>Accept-Language</dt><dd>{request.accept_language || '—'}</dd>
                            <dt>Sec-Fetch-Mode</dt><dd>{request.sec_fetch_mode || '—'}</dd>
                        </dl>
                    </div>
                </div>

                <div className="detail-section">
                    <h4>User-Agent</h4>
                    <pre className="detail-pre">{request.user_agent || '—'}</pre>
                </div>

                {request.threat_signals && request.threat_signals.length > 0 && (
                    <div className="detail-section">
                        <h4>Threat Signals ({request.threat_signals.length})</h4>
                        <div className="signals-list">
                            {request.threat_signals.map((s, i) => (
                                <div key={i} className="signal-row">
                                    <span className="signal-cat" style={{ color: THREAT_CAT_COLORS[s.category] || '#ef4444' }}>
                                        {s.category}
                                    </span>
                                    <span className="signal-id">{s.id}</span>
                                    <span className="signal-source">in {s.source}</span>
                                    <span className="signal-score" style={{ color: scoreColor(s.score) }}>+{s.score}</span>
                                    {s.excerpt && <pre className="signal-excerpt">{s.excerpt}</pre>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {request.query_params && Object.keys(request.query_params).length > 0 && (
                    <div className="detail-section">
                        <h4>Query Parameters</h4>
                        <pre className="detail-pre">{JSON.stringify(request.query_params, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function Dashboard() {
    const [traffic, setTraffic] = useState([])
    const [stats, setStats] = useState(null)
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [methodFilter, setMethodFilter] = useState('ALL')
    const [threatFilter, setThreatFilter] = useState(false)
    const [trapFilter, setTrapFilter] = useState(false)
    const [page, setPage] = useState(1)
    const [selected, setSelected] = useState(null)
    const [activeTab, setActiveTab] = useState('traffic')

    const fetchAll = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [trafficData, statsData] = await Promise.all([
                apiFetch(`/api/traffic?limit=50&page=${page}`),
                apiFetch('/api/traffic/stats'),
            ])
            setTraffic(trafficData.data)
            setPagination(trafficData.pagination)
            setStats(statsData)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [page])

    useEffect(() => { fetchAll() }, [fetchAll])

    const filtered = traffic.filter(r => {
        if (methodFilter !== 'ALL' && r.method !== methodFilter) return false
        if (threatFilter && (!r.threat_signals || r.threat_signals.length === 0)) return false
        if (trapFilter && !r.is_trap) return false
        const q = search.toLowerCase()
        if (q && !(
            r.path?.toLowerCase().includes(q) ||
            r.user_agent?.toLowerCase().includes(q) ||
            r.ip_address?.toLowerCase().includes(q) ||
            r.bot_label?.toLowerCase().includes(q) ||
            r.trap_type?.toLowerCase().includes(q)
        )) return false
        return true
    })

    const summary = stats?.summary || {}
    const avgMs = summary.avg_response_time_ms ? Math.round(parseFloat(summary.avg_response_time_ms)) : null

    return (
        <div className="dashboard">
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">Threat Intelligence Dashboard</h1>
                    <p className="dash-sub">Live request feed · bot classification · attack pattern detection</p>
                </div>
                <button className="refresh-btn" onClick={fetchAll} disabled={loading}>
                    {loading ? 'Loading…' : '↻ Refresh'}
                </button>
            </div>

            {error && (
                <div className="error-banner">
                    Failed to load: {error}. Is the backend running on port 5000?
                </div>
            )}

            {/* Stats row */}
            <div className="stats-grid">
                <StatCard label="Total Requests"   value={parseInt(summary.total_requests || 0).toLocaleString()} />
                <StatCard label="Unique IPs"        value={parseInt(summary.unique_ips || 0).toLocaleString()} />
                <StatCard label="Honeypot Hits"     value={parseInt(summary.honeypot_hits || 0).toLocaleString()} color="#a855f7" highlight />
                <StatCard label="Threat Flagged"    value={parseInt(summary.threat_flagged || 0).toLocaleString()} color="#f97316" />
                <StatCard label="High Threat (≥70)" value={parseInt(summary.high_threat || 0).toLocaleString()} color="#ef4444" highlight />
                <StatCard label="Last Hour"         value={parseInt(summary.requests_last_hour || 0).toLocaleString()} sub="requests" />
                <StatCard label="Last 24h"          value={parseInt(summary.requests_last_24h || 0).toLocaleString()} sub="requests" />
                <StatCard label="Avg Response"      value={avgMs != null ? `${avgMs}ms` : null} />
            </div>

            {/* Tabs */}
            <div className="tabs">
                {['traffic', 'threats', 'honeypots', 'attackers'].map(t => (
                    <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                        {t === 'honeypots' && summary.honeypot_hits > 0 &&
                            <span className="tab-badge">{summary.honeypot_hits}</span>}
                        {t === 'threats' && summary.high_threat > 0 &&
                            <span className="tab-badge tab-badge--red">{summary.high_threat}</span>}
                    </button>
                ))}
            </div>

            {activeTab === 'traffic' && (
                <>
                    <div className="filter-bar">
                        <input
                            className="search-input"
                            placeholder="Search path, IP, User-Agent, bot label, trap type…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <div className="method-filters">
                            {['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                                <button key={m} className={`method-btn ${methodFilter === m ? 'active' : ''}`}
                                    onClick={() => setMethodFilter(m)}>{m}</button>
                            ))}
                        </div>
                        <button className={`filter-toggle ${threatFilter ? 'active' : ''}`}
                            onClick={() => setThreatFilter(v => !v)}>⚠ Threats only</button>
                        <button className={`filter-toggle ${trapFilter ? 'active' : ''}`}
                            onClick={() => setTrapFilter(v => !v)}>🪤 Traps only</button>
                    </div>

                    <div className="table-wrap">
                        <table className="traffic-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Method</th>
                                    <th>Path</th>
                                    <th>Status</th>
                                    <th>Ms</th>
                                    <th>IP</th>
                                    <th>Score</th>
                                    <th>Classification</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && !loading && (
                                    <tr><td colSpan={8} className="empty-row">No requests match.</td></tr>
                                )}
                                {filtered.map(r => (
                                    <tr key={r.id} onClick={() => setSelected(r)} className={`clickable ${r.is_trap ? 'row-trap' : ''} ${r.bot_score >= 70 ? 'row-threat' : ''}`}>
                                        <td className="td-time">
                                            <span className="time-date">{formatDate(r.timestamp)}</span>
                                            <span className="time-clock">{formatTs(r.timestamp)}</span>
                                        </td>
                                        <td>
                                            <span className="method-tag" style={{ color: METHOD_COLORS[r.method] || '#fff' }}>
                                                {r.method}
                                            </span>
                                        </td>
                                        <td className="td-path" title={r.full_url}>
                                            {r.is_trap && <span className="trap-pip" title={r.trap_type}>🪤</span>}
                                            {r.path}
                                        </td>
                                        <td>
                                            <span style={{ color: statusColor(r.status_code), fontFamily: 'var(--mono)', fontSize: 12 }}>
                                                {r.status_code ?? '—'}
                                            </span>
                                        </td>
                                        <td className="td-ms">{r.response_time_ms != null ? `${r.response_time_ms}ms` : '—'}</td>
                                        <td className="td-ip">
                                            {r.cf_connecting_ip || r.ip_address || '—'}
                                            {r.cf_connecting_ip && <span className="cf-pip" title="Real IP via CF-Connecting-IP">CF</span>}
                                        </td>
                                        <td>
                                            {r.bot_score > 0
                                                ? <span className="score-badge" style={{ color: scoreColor(r.bot_score), borderColor: scoreColor(r.bot_score) }}>{r.bot_score}</span>
                                                : <span className="score-zero">0</span>
                                            }
                                        </td>
                                        <td>
                                            {r.threat_signals?.length > 0
                                                ? <ThreatBadge signals={r.threat_signals} />
                                                : r.bot_label
                                                    ? <BotBadge label={r.bot_label} type={r.crawler_type} />
                                                    : <span className="ua-raw">{truncateUa(r.user_agent)}</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pagination.pages > 1 && (
                        <div className="pagination">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                            <span>Page {page} of {pagination.pages} ({pagination.total.toLocaleString()} total)</span>
                            <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'threats' && (
                <div className="breakdown-page">
                    <div className="breakdown-card full-width">
                        <h3>Attack Categories Detected</h3>
                        {!stats?.threatBreakdown?.length
                            ? <p className="empty-msg">No threat signals detected yet.</p>
                            : <table className="breakdown-table">
                                <thead><tr><th>Category</th><th>Occurrences</th><th>Unique IPs</th></tr></thead>
                                <tbody>
                                    {stats.threatBreakdown.map(t => (
                                        <tr key={t.category}>
                                            <td><span style={{ color: THREAT_CAT_COLORS[t.category] || '#ef4444', fontWeight: 600 }}>{t.category}</span></td>
                                            <td>{parseInt(t.occurrences).toLocaleString()}</td>
                                            <td>{parseInt(t.unique_ips).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        }
                    </div>
                </div>
            )}

            {activeTab === 'honeypots' && (
                <div className="breakdown-page">
                    <div className="breakdown-card full-width">
                        <h3>Honeypot Trap Hits</h3>
                        {!stats?.honeypotHits?.length
                            ? <p className="empty-msg">No honeypot hits yet. Deploy publicly and wait.</p>
                            : <table className="breakdown-table">
                                <thead><tr><th>Trap Type</th><th>Hits</th><th>Unique IPs</th><th>Last Seen</th></tr></thead>
                                <tbody>
                                    {stats.honeypotHits.map(h => (
                                        <tr key={h.trap_type}>
                                            <td><span className="trap-type-label">{h.trap_type}</span></td>
                                            <td>{parseInt(h.hits).toLocaleString()}</td>
                                            <td>{parseInt(h.unique_ips).toLocaleString()}</td>
                                            <td className="td-time">
                                                <span className="time-date">{formatDate(h.last_seen)}</span>
                                                <span className="time-clock">{formatTs(h.last_seen)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        }
                    </div>
                </div>
            )}

            {activeTab === 'attackers' && (
                <div className="breakdown-page">
                    <div className="breakdown-card full-width">
                        <h3>Top Attacking IPs</h3>
                        {!stats?.topAttackingIPs?.filter(r => parseInt(r.threat_requests) > 0).length
                            ? <p className="empty-msg">No threat activity recorded yet.</p>
                            : <table className="breakdown-table">
                                <thead>
                                    <tr>
                                        <th>IP Address</th>
                                        <th>Total Reqs</th>
                                        <th>Threat Reqs</th>
                                        <th>Trap Hits</th>
                                        <th>Max Score</th>
                                        <th>Last Seen</th>
                                        <th>Labels</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topAttackingIPs.map(a => (
                                        <tr key={a.ip_address} className={parseInt(a.max_threat_score) >= 70 ? 'row-threat' : ''}>
                                            <td className="mono">{a.ip_address}</td>
                                            <td>{parseInt(a.total_requests).toLocaleString()}</td>
                                            <td style={{ color: parseInt(a.threat_requests) > 0 ? '#f97316' : '#888' }}>
                                                {parseInt(a.threat_requests).toLocaleString()}
                                            </td>
                                            <td style={{ color: parseInt(a.honeypot_hits) > 0 ? '#a855f7' : '#888' }}>
                                                {parseInt(a.honeypot_hits).toLocaleString()}
                                            </td>
                                            <td>
                                                <span style={{ color: scoreColor(parseInt(a.max_threat_score)), fontWeight: 700 }}>
                                                    {a.max_threat_score ?? 0}
                                                </span>
                                            </td>
                                            <td className="td-time">
                                                <span className="time-date">{formatDate(a.last_seen)}</span>
                                                <span className="time-clock">{formatTs(a.last_seen)}</span>
                                            </td>
                                            <td>
                                                {a.labels?.filter(Boolean).map(l => (
                                                    <span key={l} className="label-chip">{l}</span>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        }
                    </div>
                </div>
            )}

            <RequestDetail request={selected} onClose={() => setSelected(null)} />
        </div>
    )
}

function truncateUa(ua) {
    if (!ua) return '—'
    return ua.length > 50 ? ua.slice(0, 50) + '…' : ua
}
