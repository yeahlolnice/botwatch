import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Readiness.css'

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

export default function Readiness() {
  const readiness = usePolled('/api/public/ai-readiness')

  return (
    <main className="readiness-page">
      <div className="readiness-header">
        <div>
          <h1>AI Readiness</h1>
          <p>How prepared the crawled web is for AI agents — llms.txt adoption and structured (JSON-LD) data, tracked over time.</p>
        </div>
        <span className="readiness-pulse"><span className="pulse-dot" />Live</span>
      </div>

      <div className="readiness-stats">
        {[
          { label: 'Domains Checked', value: readiness?.domainsChecked },
          { label: 'With llms.txt', value: readiness != null ? `${readiness.pctWithLlmsTxt}%` : undefined, sub: readiness ? `${fmt(readiness.domainsWithLlmsTxt)} domains` : undefined },
          { label: 'Pages Checked', value: readiness?.pagesChecked },
          { label: 'With JSON-LD', value: readiness != null ? `${readiness.pctWithJsonLd}%` : undefined, sub: readiness ? `${fmt(readiness.pagesWithJsonLd)} pages` : undefined },
        ].map(s => (
          <div key={s.label} className="readiness-stat">
            <span className="readiness-stat-value">{s.value != null ? (typeof s.value === 'number' ? fmt(s.value) : s.value) : '—'}</span>
            <span className="readiness-stat-label">{s.label}</span>
            {s.sub && <span className="readiness-stat-sub">{s.sub}</span>}
          </div>
        ))}
      </div>

      <div className="readiness-card">
        <h2>Recently Checked Domains</h2>
        <p className="readiness-card-sub">Domains the crawler has checked for llms.txt, most recent first</p>
        {readiness?.recentDomains?.length > 0 ? (
          <div className="readiness-table">
            <div className="readiness-table-head">
              <span>Domain</span>
              <span>llms.txt</span>
              <span>Pages Crawled</span>
              <span>Checked</span>
            </div>
            {readiness.recentDomains.map(d => (
              <div key={d.hostname} className="readiness-row">
                <span className="readiness-domain">{d.hostname}</span>
                <span className={d.llms_txt_found ? 'readiness-yes' : 'readiness-no'}>
                  {d.llms_txt_found ? '✓ Found' : '— Not found'}
                </span>
                <span>{fmt(d.pages_crawled_count)}</span>
                <span className="readiness-checked">{timeAgo(d.llms_txt_checked_at)}</span>
              </div>
            ))}
          </div>
        ) : <div className="readiness-empty">No domains checked yet</div>}
      </div>

      <div className="readiness-footer">
        <span>Data collected by <Link to="/willowbot">Willowbot</Link>. 🐕 Look up any site on the <Link to="/search">search page</Link>.</span>
        <Link to="/">← Back to home</Link>
      </div>
    </main>
  )
}
