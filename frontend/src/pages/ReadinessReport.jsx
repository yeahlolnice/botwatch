import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import './ReadinessReport.css'

const BAND_CLASS = { Emerging: 'emerging', Developing: 'developing', Strong: 'strong' }

function Checks({ checks }) {
  return (
    <ul className="rr-checks">
      {(checks || []).filter((c) => !c.notApplicable).map((c) => (
        <li key={c.id} className={c.present ? 'rr-yes' : 'rr-no'}>
          <span className="rr-mark">{c.present ? '✓' : '✕'}</span>{c.label}
        </li>
      ))}
    </ul>
  )
}

function Field({ label, value }) {
  if (value === undefined || value === null || value === '' || value === false) return null
  return <div className="rr-field"><span>{label}</span><b>{String(value)}</b></div>
}

export default function ReadinessReport() {
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    fetch(`/api/readiness/report/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (r.status === 404) return setState({ status: 'notfound' })
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || 'Failed to load report')
        setState({ status: 'ok', data })
      })
      .catch((e) => setState({ status: 'error', error: e.message }))
  }, [token])

  if (state.status === 'loading') return <main className="rr-page"><p className="rr-msg">Loading your report…</p></main>
  if (state.status === 'notfound') return <main className="rr-page"><p className="rr-msg">That report link is invalid or has expired.</p></main>
  if (state.status === 'error') return <main className="rr-page"><p className="rr-msg">{state.error}</p></main>

  const { hostname, generatedAt, report } = state.data
  const a = report?.assessment || {}
  const wm = report?.webmcp || {}
  const enr = report?.enrichment || null
  const recs = a.recommendations || []

  return (
    <main className="rr-page">
      <header className="rr-head">
        <div>
          <div className="rr-eyebrow">AI-Readiness Report</div>
          <h1>{hostname}</h1>
          <p className="rr-date">Generated {generatedAt ? new Date(generatedAt).toLocaleString() : '—'} · {report?.pagesScanned?.length || 0} pages scanned</p>
        </div>
        <div className={`rr-band rr-band--${BAND_CLASS[a.band] || 'emerging'}`}>{a.band || '—'}</div>
      </header>

      {recs.length > 0 && (
        <section className="rr-section rr-recs">
          <h2>Recommendations ({recs.length})</h2>
          <ol>
            {recs.map((r) => <li key={r.id}>{r.recommendation}</li>)}
          </ol>
        </section>
      )}

      <section className="rr-section">
        <h2>Readiness signals</h2>
        <div className="rr-pillars">
          <div>
            <h3>Legibility <span>{a.legibility?.present}/{a.legibility?.total}</span></h3>
            <p className="rr-sub">Can agents read &amp; understand the site?</p>
            <Checks checks={a.legibility?.checks} />
          </div>
          <div>
            <h3>Actionability <span>{a.actionability?.present}/{a.actionability?.total}</span></h3>
            <p className="rr-sub">Can agents act on the site (WebMCP)?</p>
            <Checks checks={a.actionability?.checks} />
          </div>
        </div>
      </section>

      <section className="rr-section">
        <h2>WebMCP (agent actionability)</h2>
        {wm.declarative?.count > 0 ? (
          <>
            <p>{wm.declarative.count} tool{wm.declarative.count === 1 ? '' : 's'} found that agents can call:</p>
            <ul className="rr-tools">
              {wm.declarative.tools.map((t) => (
                <li key={t.name}>
                  <code>{t.name}</code>
                  {t.description ? <span className="rr-tool-desc"> — {t.description}</span> : <span className="rr-tool-warn"> — no description</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rr-empty">No WebMCP tools detected. Agents can't reliably take actions on your site — see the WebMCP recommendation above. This is an early-mover opportunity: almost no sites have this yet.</p>
        )}
        {wm.imperative?.detected && <p className="rr-note">Imperative WebMCP API usage detected in the site's JavaScript.</p>}
        {wm.bestPractice?.violations?.length > 0 && (
          <div className="rr-violations">
            <strong>Best-practice issues:</strong>
            <ul>{wm.bestPractice.violations.map((v, i) => <li key={i}>{v}</li>)}</ul>
          </div>
        )}
      </section>

      {enr && (
        <section className="rr-section">
          <h2>Technical foundation</h2>
          <div className="rr-fields">
            <Field label="TLS issuer" value={enr.tls?.issuer} />
            <Field label="TLS valid to" value={enr.tls?.validTo} />
            <Field label="Security headers" value={enr.securityHeaders?.gradeWord || enr.securityHeaders?.grade} />
            <Field label="Hosting" value={enr.hosting?.org} />
            <Field label="ASN" value={enr.hosting?.asn} />
            <Field label="SPF" value={enr.emailPosture?.spf ? 'present' : undefined} />
            <Field label="DKIM" value={enr.emailPosture?.dkim ? 'present' : undefined} />
            <Field label="DMARC" value={enr.emailPosture?.dmarc} />
            <Field label="Subdomains found" value={Array.isArray(enr.subdomains) ? enr.subdomains.length : enr.subdomains?.count} />
          </div>
        </section>
      )}

      <footer className="rr-foot">
        <p>Want the raw signals via API? See the <Link to="/docs">developer docs</Link>. Re-check any site at the <Link to="/readiness-check">readiness checker</Link>.</p>
      </footer>
    </main>
  )
}
