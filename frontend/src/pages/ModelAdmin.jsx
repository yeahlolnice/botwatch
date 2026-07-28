import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api.js'
import './ModelAdmin.css'

function scoreClass(score) {
  if (score >= 70) return 'model-score--high'
  if (score >= 40) return 'model-score--med'
  return 'model-score--low'
}

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

export default function ModelAdmin() {
  const [dataset, setDataset] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [scores, setScores] = useState([])
  const [busy, setBusy] = useState(null)
  const [log, setLog] = useState([])

  const pushLog = (message) =>
    setLog((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), message }, ...prev].slice(0, 12))

  const loadDataset = useCallback(async () => {
    try { setDataset(await apiFetch('/api/model/dataset-stats')) }
    catch (e) { pushLog(`Dataset load failed: ${e.message}`) }
  }, [])

  const loadScores = useCallback(async () => {
    try { const d = await apiFetch('/api/model/scores?limit=50'); setScores(d.scores || []) }
    catch (e) { pushLog(`Scores load failed: ${e.message}`) }
  }, [])

  useEffect(() => { loadDataset(); loadScores() }, [loadDataset, loadScores])

  const handleTrain = async () => {
    setBusy('train')
    try {
      const r = await apiFetch('/api/model/train', { method: 'POST' })
      setMetrics(r)
      const t = r.metrics?.test
      pushLog(`Trained on ${r.counts.train}/${r.counts.total} IPs — test accuracy ${pct(t?.accuracy)}, precision ${pct(t?.precision)}`)
      await loadDataset()
    } catch (e) { pushLog(`Train failed: ${e.message}`) }
    finally { setBusy(null) }
  }

  const handleScore = async () => {
    setBusy('score')
    try {
      const r = await apiFetch('/api/model/score-all', { method: 'POST' })
      pushLog(`Scored ${r.scored} IPs — ${r.highRisk} high-risk (≥70)`)
      await loadScores()
    } catch (e) { pushLog(`Score failed: ${e.message}`) }
    finally { setBusy(null) }
  }

  const handleVerdict = async (ip, verdict) => {
    try {
      await apiFetch('/api/model/verdict', { method: 'POST', body: JSON.stringify({ ip, verdict }) })
      pushLog(`${ip}: ${verdict === 'clear' ? 'review cleared' : verdict === 'malicious' ? 'confirmed malicious' : 'marked false positive'}`)
      await loadScores()
    } catch (e) { pushLog(`Verdict failed: ${e.message}`) }
  }

  const test = metrics?.metrics?.test

  return (
    <main className="model-page">
      <div className="model-header">
        <h1>Malicious-IP Model</h1>
        <p>Scores every source IP 0–100 from how it behaves. Train on the collected traffic, then score to flag the risky ones.</p>
      </div>

      <div className="model-cards">
        <div className="model-card">
          <h3>1. Train</h3>
          <p className="model-card-sub">
            {dataset
              ? `${dataset.totalIps} IPs collected · ${dataset.positives} malicious / ${dataset.negatives} benign`
              : 'Loading dataset…'}
          </p>
          <button className="model-btn model-btn--primary" onClick={handleTrain} disabled={busy !== null}>
            {busy === 'train' ? 'Training…' : 'Train model'}
          </button>
          {test && (
            <div className="model-metrics">
              <span><b>{pct(test.accuracy)}</b> accuracy</span>
              <span><b>{pct(test.precision)}</b> precision</span>
              <span><b>{pct(test.recall)}</b> recall</span>
            </div>
          )}
        </div>

        <div className="model-card">
          <h3>2. Score IPs</h3>
          <p className="model-card-sub">Apply the trained model to every IP and store a risk score + a plain-English reason.</p>
          <button className="model-btn model-btn--primary" onClick={handleScore} disabled={busy !== null}>
            {busy === 'score' ? 'Scoring…' : 'Score all IPs'}
          </button>
        </div>

        <div className="model-card">
          <h3>3. Threat feed</h3>
          <p className="model-card-sub">Export the scored high-risk IPs (score ≥ 70) as a feed.</p>
          <div className="model-feed-links">
            <a className="model-btn" href="/api/model/feed?format=csv&minScore=70">Download CSV</a>
            <a className="model-btn" href="/api/model/feed?format=json&minScore=70" target="_blank" rel="noopener noreferrer">View JSON</a>
          </div>
        </div>
      </div>

      {log.length > 0 && (
        <div className="model-log">
          {log.map((l) => <div key={l.id} className="model-log-line"><span>{l.time}</span> {l.message}</div>)}
        </div>
      )}

      <div className="model-scores">
        <h2>Highest-risk IPs</h2>
        {scores.length > 0 ? (
          <div className="model-table-wrap">
            <table className="model-table">
              <thead>
                <tr><th>IP</th><th>Score</th><th>Requests</th><th>Why</th><th>Review</th></tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.ip}>
                    <td className="model-ip">
                      <Link to={`/dashboard?search=${encodeURIComponent(s.ip)}`} className="model-ip-link" title="Review this IP's requests">{s.ip}</Link>
                    </td>
                    <td><span className={`model-score ${scoreClass(s.score)}`}>{s.score}</span></td>
                    <td className="model-num">{s.request_count ?? '—'}</td>
                    <td className="model-why">{s.explanation || '—'}</td>
                    <td className="model-verdict">
                      <button
                        title="Confirm malicious"
                        className={`model-vbtn${s.verdict === 'malicious' ? ' model-vbtn--mal' : ''}`}
                        onClick={() => handleVerdict(s.ip, s.verdict === 'malicious' ? 'clear' : 'malicious')}
                      >✓</button>
                      <button
                        title="False positive"
                        className={`model-vbtn${s.verdict === 'benign' ? ' model-vbtn--ben' : ''}`}
                        onClick={() => handleVerdict(s.ip, s.verdict === 'benign' ? 'clear' : 'benign')}
                      >✗</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="model-empty">No scores yet — Train, then Score all IPs.</p>}
      </div>
    </main>
  )
}
