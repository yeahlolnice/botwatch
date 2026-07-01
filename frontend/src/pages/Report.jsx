import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import './Report.css'

// AbuseIPDB category codes relevant to what botwatch sees
const CATEGORIES = [
    { id: 14, label: 'Port Scan' },
    { id: 19, label: 'Bad Web Bot' },
    { id: 21, label: 'Web App Attack' },
    { id: 18, label: 'Brute-Force' },
    { id: 9,  label: 'Fraud / Phishing' },
    { id: 7,  label: 'DDoS Attack' },
]

function scoreColor(score) {
    if (score === null || score === undefined) return '#888'
    if (score >= 75) return '#ef4444'
    if (score >= 25) return '#f97316'
    return '#22c55e'
}

function ReportForm({ ip, onDone }) {
    const [categories, setCategories] = useState([])
    const [comment, setComment] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    const toggleCat = (id) =>
        setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const data = await apiFetch('/api/enrich/report', {
                method: 'POST',
                body: JSON.stringify({ ip, categories, comment }),
            })
            setResult(data.message)
            onDone(ip)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form className="report-form" onSubmit={handleSubmit}>
            <div className="report-cats">
                {CATEGORIES.map(c => (
                    <label key={c.id} className={`cat-chip ${categories.includes(c.id) ? 'active' : ''}`}>
                        <input
                            type="checkbox"
                            checked={categories.includes(c.id)}
                            onChange={() => toggleCat(c.id)}
                        />
                        {c.label}
                    </label>
                ))}
            </div>
            <textarea
                className="report-comment"
                placeholder="Describe the abusive behaviour (min 10 chars)…"
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
            />
            {error && <p className="report-error">{error}</p>}
            {result && <p className="report-success">{result}</p>}
            <button
                type="submit"
                className="report-submit"
                disabled={loading || categories.length === 0 || comment.trim().length < 10}
            >
                {loading ? 'Reporting…' : `Report ${ip} to AbuseIPDB`}
            </button>
        </form>
    )
}

function IpSummaryPanel({ ip }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)

    const load = async () => {
        if (loaded) return
        setLoading(true)
        try {
            const result = await apiFetch(`/api/enrich/summary/${encodeURIComponent(ip)}`)
            setData(result)
            setLoaded(true)
        } catch {
            // non-fatal
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [ip])

    if (loading) return <div className="summary-loading">Building report…</div>
    if (!data) return null

    const { summary, honeypots, signals, paths } = data
    const fmt = (ts) => ts ? new Date(ts).toLocaleString() : '—'

    return (
        <div className="summary-panel">
            <h4 className="summary-title">Activity Summary — {ip}</h4>

            <div className="summary-overview">
                <div className="summary-stat"><span>{Number(summary.total_requests).toLocaleString()}</span>Total Requests</div>
                <div className="summary-stat"><span>{summary.honeypot_hits}</span>Trap Hits</div>
                <div className="summary-stat"><span>{summary.threat_requests}</span>Attack Signals</div>
                <div className="summary-stat"><span>{summary.max_score}</span>Max Score</div>
                <div className="summary-stat"><span>{fmt(summary.first_seen)}</span>First Seen</div>
                <div className="summary-stat"><span>{fmt(summary.last_seen)}</span>Last Seen</div>
            </div>

            {summary.user_agents?.length > 0 && (
                <div className="summary-section">
                    <h5>User Agents</h5>
                    {summary.user_agents.map((ua, i) => (
                        <div key={i} className="summary-ua">{ua}</div>
                    ))}
                </div>
            )}

            {honeypots?.length > 0 && (
                <div className="summary-section">
                    <h5>Honeypot Hits</h5>
                    <table className="summary-table">
                        <thead><tr><th>Trap</th><th>Hits</th><th>First</th><th>Last</th></tr></thead>
                        <tbody>
                            {honeypots.map(h => (
                                <tr key={h.trap_type}>
                                    <td>{h.trap_type}</td>
                                    <td>{h.hits}</td>
                                    <td>{fmt(h.first_hit)}</td>
                                    <td>{fmt(h.last_hit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {honeypots.filter(h => h.sample_body).map(h => (
                        <div key={h.trap_type} className="summary-body">
                            <span className="summary-body-label">POST body captured on {h.trap_type}:</span>
                            <pre>{JSON.stringify(h.sample_body, null, 2)}</pre>
                        </div>
                    ))}
                </div>
            )}

            {signals?.length > 0 && (
                <div className="summary-section">
                    <h5>Attack Signals Detected</h5>
                    <table className="summary-table">
                        <thead><tr><th>Category</th><th>Signal</th><th>Source</th><th>Score</th><th>Excerpt</th></tr></thead>
                        <tbody>
                            {signals.map((s, i) => (
                                <tr key={i}>
                                    <td><span className="sig-cat">{s.category}</span></td>
                                    <td>{s.signal_id}</td>
                                    <td>{s.source}</td>
                                    <td>{s.score}</td>
                                    <td><code className="sig-excerpt">{s.excerpt}</code></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {paths?.length > 0 && (
                <div className="summary-section">
                    <h5>Paths Accessed</h5>
                    <table className="summary-table">
                        <thead><tr><th>Method</th><th>Path</th><th>Hits</th><th>Trap</th></tr></thead>
                        <tbody>
                            {paths.map((p, i) => (
                                <tr key={i} className={p.is_trap ? 'trap-row' : ''}>
                                    <td>{p.method}</td>
                                    <td><code>{p.path}</code></td>
                                    <td>{p.hits}</td>
                                    <td>{p.is_trap ? '🪤' : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default function Report() {
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [expanded, setExpanded] = useState(null)
    const [summaryIp, setSummaryIp] = useState(null)
    const [reported, setReported] = useState(new Set())
    const [enriching, setEnriching] = useState(null)

    useEffect(() => {
        apiFetch('/api/enrich/candidates')
            .then(data => { setCandidates(data); setLoading(false) })
            .catch(e => { setError(e.message); setLoading(false) })
    }, [])

    const handleCheck = async (ip) => {
        setEnriching(ip)
        try {
            await apiFetch(`/api/enrich/check/${encodeURIComponent(ip)}`)
            const data = await apiFetch('/api/enrich/candidates')
            setCandidates(data)
        } catch {
            // non-fatal
        } finally {
            setEnriching(null)
        }
    }

    const handleReported = (ip) => {
        setReported(prev => new Set([...prev, ip]))
        setExpanded(null)
        setSummaryIp(null)
    }

    return (
        <main className="report-page">
            <div className="report-header">
                <div>
                    <h1>IP Report Queue</h1>
                    <p>IPs that hit honeypots or scored ≥50. Check against AbuseIPDB then report if warranted.</p>
                </div>
                <a
                    href="https://www.abuseipdb.com/user/324210"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="AbuseIPDB Contributor"
                >
                    <img
                        src="https://www.abuseipdb.com/contributor/324210.svg"
                        alt="AbuseIPDB Contributor Badge"
                        className="abuseipdb-badge"
                        style={{ width: 200, background: '#35c246', padding: '5px' }}
                    />
                </a>
            </div>

            {loading && <div className="report-loading">Loading candidates…</div>}
            {error && <div className="report-err">Failed to load: {error}</div>}

            {!loading && candidates.length === 0 && (
                <div className="report-empty">No candidates yet — honeypot hits and high-threat IPs will appear here.</div>
            )}

            <div className="candidates-list">
                {candidates.map(c => {
                    const ip = c.ip
                    const isExpanded = expanded === ip
                    const isSummaryOpen = summaryIp === ip
                    const isReported = reported.has(ip)
                    const hasEnrichment = c.abuse_checked_at !== null

                    return (
                        <div key={ip} className={`candidate-card ${isReported ? 'candidate-reported' : ''}`}>
                            <div className="candidate-row">
                                <div className="candidate-ip-col">
                                    <span className="candidate-ip">{ip}</span>
                                    {c.abuse_is_tor && <span className="tor-badge">TOR</span>}
                                    {isReported && <span className="reported-badge">Reported</span>}
                                </div>

                                <div className="candidate-stats">
                                    <span title="Honeypot hits">🪤 {c.honeypot_hits}</span>
                                    <span title="Max threat score">⚠ {c.max_score}</span>
                                    <span title="Total requests">↑ {c.total_requests}</span>
                                    {c.countries?.[0] && <span>{c.countries[0]}</span>}
                                </div>

                                <div className="candidate-abuse">
                                    {hasEnrichment ? (
                                        <span className="abuse-score-chip" style={{ color: scoreColor(c.abuse_confidence_score) }}>
                                            {c.abuse_confidence_score}% abuse
                                        </span>
                                    ) : (
                                        <button
                                            className="check-btn"
                                            onClick={() => handleCheck(ip)}
                                            disabled={enriching === ip}
                                        >
                                            {enriching === ip ? 'Checking…' : 'Check AbuseIPDB'}
                                        </button>
                                    )}
                                    {c.abuse_isp && <span className="candidate-isp">{c.abuse_isp}</span>}
                                </div>

                                <div className="candidate-actions">
                                    <button
                                        className={`summary-btn ${isSummaryOpen ? 'active' : ''}`}
                                        onClick={() => setSummaryIp(isSummaryOpen ? null : ip)}
                                    >
                                        {isSummaryOpen ? 'Hide' : 'Build Report'}
                                    </button>
                                    <button
                                        className={`expand-btn ${isExpanded ? 'active' : ''}`}
                                        onClick={() => setExpanded(isExpanded ? null : ip)}
                                        disabled={isReported}
                                    >
                                        {isReported ? 'Reported' : isExpanded ? 'Cancel' : 'Report'}
                                    </button>
                                </div>
                            </div>

                            {c.trap_types?.filter(Boolean).length > 0 && (
                                <div className="candidate-traps">
                                    {c.trap_types.filter(Boolean).map(t => (
                                        <span key={t} className="trap-tag">{t}</span>
                                    ))}
                                </div>
                            )}

                            {isSummaryOpen && <IpSummaryPanel ip={ip} />}

                            {isExpanded && (
                                <ReportForm ip={ip} onDone={handleReported} />
                            )}
                        </div>
                    )
                })}
            </div>
        </main>
    )
}
