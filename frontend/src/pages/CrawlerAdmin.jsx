import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api.js'
import './CrawlerAdmin.css'

const POLL_INTERVAL_MS = 3000

function StatusTable({ title, rows }) {
    return (
        <div className="crawler-status-block">
            <h4>{title}</h4>
            {rows?.length > 0 ? (
                <table className="crawler-status-table">
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.status}>
                                <td className="crawler-status-label">{r.status}</td>
                                <td className="crawler-status-count">{r.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p className="crawler-empty">No data yet</p>}
        </div>
    )
}

function RunningBadge({ tracker }) {
    if (!tracker) return null
    if (tracker.running) {
        return <span className="crawler-running-badge crawler-running-badge--active">● running since {new Date(tracker.startedAt).toLocaleTimeString()}</span>
    }
    if (tracker.lastError) {
        return <span className="crawler-running-badge crawler-running-badge--error">last run failed: {tracker.lastError}</span>
    }
    if (tracker.finishedAt) {
        return <span className="crawler-running-badge">idle — last finished {new Date(tracker.finishedAt).toLocaleTimeString()}</span>
    }
    return null
}

function getStatusCount(rows, status) {
    return rows?.find(r => r.status === status)?.count ?? 0
}

function summarizeRunResult(kind, result) {
    if (!result) return null
    if (kind === 'crawl') {
        return `Crawl batch: ${result.domainsProcessed} domain(s) processed (${result.stoppedReason})`
    }
    return `Processed ${result.processedCount} sitemap(s)`
}

export default function CrawlerAdmin() {
    const [isAdmin, setIsAdmin] = useState(null) // null = loading
    const [status, setStatus] = useState(null)
    const [statusLoading, setStatusLoading] = useState(false)
    const [busy, setBusy] = useState(null) // which action is currently running
    const [log, setLog] = useState([])

    const [seedInput, setSeedInput] = useState('')
    const [maxPagesPerDomain, setMaxPagesPerDomain] = useState('')
    const [maxDomainsThisRun, setMaxDomainsThisRun] = useState('')
    const [maxSitemapsThisRun, setMaxSitemapsThisRun] = useState('')

    const pollIntervalsRef = useRef({})
    const pollCancelledRef = useRef({})

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(j => setIsAdmin(j?.user?.role === 'admin'))
            .catch(() => setIsAdmin(false))
    }, [])

    const pushLog = (message) => {
        setLog(prev => [{ id: Date.now(), time: new Date().toLocaleTimeString(), message }, ...prev].slice(0, 20))
    }

    const fetchStatus = useCallback(async () => {
        setStatusLoading(true)
        try {
            const data = await apiFetch('/api/crawler/status')
            setStatus(data)
            return data
        } catch (e) {
            pushLog(`Status fetch failed: ${e.message}`)
            return null
        } finally {
            setStatusLoading(false)
        }
    }, [])

    // Long jobs (crawl batch, sitemap processing) run in the background on
    // the server now — poll status until the tracker reports it's done,
    // rather than holding one HTTP request open the whole time (that used
    // to trip the reverse proxy's gateway timeout on longer batches).
    //
    // Uses a self-scheduling setTimeout, NOT setInterval: setInterval fires on
    // a fixed cadence regardless of whether the previous request resolved, so a
    // slow /status response would pile up overlapping in-flight pings (each
    // running several DB queries) and effectively self-DDoS. Here the next ping
    // is only scheduled once the current one has completed.
    const pollUntilDone = useCallback((kind, label) => {
        if (pollIntervalsRef.current[kind]) return // already polling

        pollCancelledRef.current[kind] = false

        const tick = async () => {
            const data = await fetchStatus()
            if (pollCancelledRef.current[kind]) return // unmounted mid-request

            const tracker = data?.[kind]
            if (tracker && !tracker.running) {
                delete pollIntervalsRef.current[kind]
                setBusy(null)

                if (tracker.lastError) {
                    pushLog(`${label} failed: ${tracker.lastError}`)
                } else {
                    pushLog(summarizeRunResult(kind, tracker.lastResult) || `${label} finished`)
                }
                return
            }

            // Still running (or a transient fetch failure) — schedule the next
            // ping only now that this one has finished, so pings never overlap.
            pollIntervalsRef.current[kind] = setTimeout(tick, POLL_INTERVAL_MS)
        }

        pollIntervalsRef.current[kind] = setTimeout(tick, POLL_INTERVAL_MS)
    }, [fetchStatus])

    useEffect(() => {
        // Ref objects are stable for the component's lifetime, so these locals
        // point at the same maps the poller mutates — reading them at cleanup
        // reflects the current timers/flags.
        const timeouts = pollIntervalsRef.current
        const cancelled = pollCancelledRef.current
        return () => {
            Object.keys(cancelled).forEach(kind => { cancelled[kind] = true })
            Object.values(timeouts).forEach(clearTimeout)
        }
    }, [])

    useEffect(() => {
        if (!isAdmin) return
        fetchStatus().then(data => {
            // Resume polling if a batch was already in flight (e.g. page reload mid-run).
            if (data?.crawl?.running) {
                setBusy('run')
                pollUntilDone('crawl', 'Crawl batch')
            }
            if (data?.sitemaps?.running) {
                setBusy('sitemaps')
                pollUntilDone('sitemaps', 'Sitemap processing')
            }
        })
    }, [isAdmin, fetchStatus, pollUntilDone])

    const handleSeed = async () => {
        const hostnames = seedInput
            .split(/[\n,]/)
            .map(s => s.trim())
            .filter(Boolean)

        if (hostnames.length === 0) {
            pushLog('Seed skipped: no hostnames entered')
            return
        }

        setBusy('seed')
        try {
            const result = await apiFetch('/api/crawler/domains/seed', {
                method: 'POST',
                body: JSON.stringify({ hostnames }),
            })
            pushLog(result.rejected?.length > 0
                ? `Seeded ${result.seededCount} domain(s) — rejected as private/internal: ${result.rejected.join(', ')}`
                : `Seeded ${result.seededCount} domain(s)`)
            await fetchStatus()
        } catch (e) {
            pushLog(`seed failed: ${e.message}`)
        } finally {
            setBusy(null)
        }
    }

    const handleRun = async () => {
        const body = {}
        if (maxPagesPerDomain) body.maxPagesPerDomain = Number(maxPagesPerDomain)
        if (maxDomainsThisRun) body.maxDomainsThisRun = Number(maxDomainsThisRun)

        setBusy('run')
        try {
            await apiFetch('/api/crawler/run', { method: 'POST', body: JSON.stringify(body) })
            pushLog('Crawl batch started…')
            pollUntilDone('crawl', 'Crawl batch')
        } catch (e) {
            setBusy(null)
            pushLog(`run failed: ${e.message}`)
        }
    }

    const handleProcessSitemaps = async () => {
        const body = {}
        if (maxSitemapsThisRun) body.maxSitemapsThisRun = Number(maxSitemapsThisRun)

        setBusy('sitemaps')
        try {
            await apiFetch('/api/crawler/sitemaps/process', { method: 'POST', body: JSON.stringify(body) })
            pushLog('Sitemap processing started…')
            pollUntilDone('sitemaps', 'Sitemap processing')
        } catch (e) {
            setBusy(null)
            pushLog(`sitemaps failed: ${e.message}`)
        }
    }

    if (isAdmin === null) return null

    if (!isAdmin) {
        return (
            <main className="crawler-admin-page">
                <div className="crawler-denied">Admin access required.</div>
            </main>
        )
    }

    const domains = status?.domains
    const pages = status?.pages
    const defaults = status?.defaults
    const queuedSitemaps = getStatusCount(status?.sitemapCounts?.byStatus, 'queued')

    return (
        <main className="crawler-admin-page">
            <div className="crawler-header">
                <div>
                    <h1>Crawler Admin</h1>
                    <p>Trigger and monitor the AI-readiness web crawler.</p>
                </div>
                <button className="crawler-btn" onClick={fetchStatus} disabled={statusLoading}>
                    {statusLoading ? 'Refreshing…' : '↻ Refresh status'}
                </button>
            </div>

            <div className="crawler-grid">

                <div className="crawler-card">
                    <h3>1. Seed domains</h3>
                    <p className="crawler-card-sub">Hostnames to start crawling from (comma or newline separated). Needed at least once — the crawler only expands from what's already queued.</p>
                    <textarea
                        className="crawler-textarea"
                        placeholder={'example.com\nanother-site.com'}
                        value={seedInput}
                        onChange={e => setSeedInput(e.target.value)}
                        rows={3}
                    />
                    <button className="crawler-btn crawler-btn--primary" onClick={handleSeed} disabled={busy !== null}>
                        {busy === 'seed' ? 'Seeding…' : 'Seed domains'}
                    </button>
                </div>

                <div className="crawler-card">
                    <h3>2. Run crawl batch</h3>
                    <p className="crawler-card-sub">Crawls queued domains one page at a time, respecting robots.txt and a polite delay between requests. Stops early if 3 domains in a row fail.</p>
                    <div className="crawler-run-inputs">
                        <label>
                            Max pages/domain
                            <input type="number" min="1" placeholder={defaults ? String(defaults.maxPagesPerDomain) : '5'} value={maxPagesPerDomain} onChange={e => setMaxPagesPerDomain(e.target.value)} />
                        </label>
                        <label>
                            Max domains this run
                            <input type="number" min="1" placeholder={defaults ? String(defaults.maxDomainsThisRun) : '10'} value={maxDomainsThisRun} onChange={e => setMaxDomainsThisRun(e.target.value)} />
                        </label>
                    </div>
                    {defaults && (
                        <p className="crawler-defaults-note">
                            Defaults when left blank: {defaults.maxPagesPerDomain} pages/domain · {defaults.maxDomainsThisRun} domains/run
                        </p>
                    )}
                    <button className="crawler-btn crawler-btn--primary" onClick={handleRun} disabled={busy !== null}>
                        {busy === 'run' ? 'Crawling…' : 'Run crawl batch'}
                    </button>
                    <RunningBadge tracker={status?.crawl} />
                </div>

                <div className="crawler-card">
                    <h3>3. Process queued sitemaps</h3>
                    <p className="crawler-card-sub">Drains queued sitemaps, importing the page URLs they contain.</p>
                    <p className="crawler-defaults-note">
                        {queuedSitemaps} sitemap{queuedSitemaps === 1 ? '' : 's'} queued
                        {defaults ? ` · defaults to ${defaults.maxSitemapsThisRun} per run` : ''}
                    </p>
                    <div className="crawler-run-inputs">
                        <label>
                            Sitemaps this run
                            <input type="number" min="1" max="5000" placeholder={defaults ? String(defaults.maxSitemapsThisRun) : '20'} value={maxSitemapsThisRun} onChange={e => setMaxSitemapsThisRun(e.target.value)} />
                        </label>
                    </div>
                    <button className="crawler-btn crawler-btn--primary" onClick={handleProcessSitemaps} disabled={busy !== null}>
                        {busy === 'sitemaps' ? 'Processing…' : 'Process sitemaps'}
                    </button>
                    <RunningBadge tracker={status?.sitemaps} />
                </div>
            </div>

            <div className="crawler-status-section">
                <h2>Status</h2>
                <div className="crawler-status-grid">
                    <StatusTable title="Domains by status" rows={domains?.byStatus} />
                    <StatusTable title="Pages by status" rows={pages?.byStatus} />
                    <div className="crawler-status-block">
                        <h4>AI readiness coverage</h4>
                        <dl className="crawler-readiness-dl">
                            <dt>Domains checked for llms.txt</dt><dd>{domains?.readiness?.domains_checked ?? '—'}</dd>
                            <dt>Domains with llms.txt</dt><dd>{domains?.readiness?.domains_with_llms_txt ?? '—'}</dd>
                            <dt>Pages checked (crawled)</dt><dd>{pages?.readiness?.pages_checked ?? '—'}</dd>
                            <dt>Pages with JSON-LD</dt><dd>{pages?.readiness?.pages_with_json_ld ?? '—'}</dd>
                        </dl>
                    </div>
                </div>
            </div>

            <div className="crawler-log-section">
                <h2>Activity log</h2>
                {log.length === 0 ? (
                    <p className="crawler-empty">No actions yet</p>
                ) : (
                    <ul className="crawler-log">
                        {log.map(entry => (
                            <li key={entry.id}><span className="crawler-log-time">{entry.time}</span>{entry.message}</li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    )
}
