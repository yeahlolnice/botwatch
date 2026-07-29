import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api.js'
import './ApiKeys.css'

const TIERS = ['free', 'pro', 'enterprise']

export default function ApiKeys() {
  const [keys, setKeys] = useState([])
  const [label, setLabel] = useState('')
  const [tier, setTier] = useState('free')
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try { const d = await apiFetch('/api/keys'); setKeys(d.keys || []) }
    catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    setBusy(true); setError(null); setNewKey(null)
    try {
      const r = await apiFetch('/api/keys', { method: 'POST', body: JSON.stringify({ label, tier }) })
      setNewKey(r.key)
      setLabel('')
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const revoke = async (id) => {
    if (!window.confirm('Revoke this key? Anything using it stops working immediately.')) return
    try { await apiFetch(`/api/keys/${id}/revoke`, { method: 'POST' }); await load() }
    catch (e) { setError(e.message) }
  }

  return (
    <main className="keys-page">
      <div className="keys-header">
        <h1>API Keys</h1>
        <p>Issue keys for the public API (<code>/api/v1</code>). The tier sets the per-minute rate limit — Free 60, Pro 600, Enterprise 6000.</p>
      </div>

      <div className="keys-create">
        <input className="keys-input" placeholder="Label (e.g. Acme Corp)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="keys-select" value={tier} onChange={(e) => setTier(e.target.value)}>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="keys-btn keys-btn--primary" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create key'}</button>
      </div>

      {error && <div className="keys-error">{error}</div>}

      {newKey && (
        <div className="keys-new">
          <strong>Copy this key now — it won't be shown again:</strong>
          <code className="keys-new-value">{newKey}</code>
        </div>
      )}

      <div className="keys-table-wrap">
        <table className="keys-table">
          <thead>
            <tr><th>Key</th><th>Label</th><th>Tier</th><th>Requests</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className={k.active ? '' : 'keys-revoked'}>
                <td className="keys-prefix">{k.key_prefix}…</td>
                <td>{k.label || '—'}</td>
                <td>{k.tier}</td>
                <td className="keys-num">{Number(k.request_count).toLocaleString()}</td>
                <td>{k.active ? <span className="keys-active">active</span> : <span className="keys-inactive">revoked</span>}</td>
                <td>{k.active && <button className="keys-btn keys-btn--danger" onClick={() => revoke(k.id)}>Revoke</button>}</td>
              </tr>
            ))}
            {keys.length === 0 && <tr><td colSpan={6} className="keys-empty">No keys yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  )
}
