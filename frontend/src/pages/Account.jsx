import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './Account.css'

// Customer account portal (Phase 3.5). One self-gating page: shows a sign-in /
// sign-up card when there's no customer session, and the portal (plan + API key
// management) once authenticated. Uses plain fetch — the shared apiFetch helper
// force-redirects to the research login on 401, which we don't want here.

const TIER_LABEL = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' }
const TIER_LIMIT = { free: '60', pro: '600', enterprise: '6,000' }

function AuthCard({ onAuthed }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const isForgot = mode === 'forgot'

  const switchMode = (m) => { setMode(m); setError(''); setNotice('') }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    try {
      if (isForgot) {
        const res = await fetch('/api/account/forgot', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json().catch(() => ({}))
        setNotice(data.message || 'If that email has an account, a reset link is on its way.')
        return
      }
      const path = mode === 'signup' ? '/api/account/signup' : '/api/account/login'
      const body = mode === 'signup' ? { name, email, password } : { email, password }
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      onAuthed()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = {
    login: ['Welcome back', 'Sign in to manage your API keys and subscription.'],
    signup: ['Create your account', 'Sign up to manage your API keys and subscription.'],
    forgot: ['Reset your password', "Enter your account email and we'll send a reset link."],
  }[mode]

  return (
    <div className="acct-authwrap">
      <div className="acct-auth">
        <h1>{copy[0]}</h1>
        <p className="acct-auth-sub">{copy[1]}</p>
        <form onSubmit={submit} className="acct-form">
          {mode === 'signup' && (
            <label>Name <span>(optional)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          {!isForgot && (
            <label>Password
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>
          )}
          {mode === 'signup' && <p className="acct-hint">At least 8 characters.</p>}
          {mode === 'login' && (
            <button type="button" className="acct-linkbtn" onClick={() => switchMode('forgot')}>Forgot password?</button>
          )}
          {error && <p className="acct-error">{error}</p>}
          {notice && <p className="acct-notice">{notice}</p>}
          <button type="submit" className="acct-btn acct-btn--primary" disabled={busy}>
            {busy ? 'Please wait…' : isForgot ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="acct-switch">
          {mode === 'signup' && <>Already have an account? <button onClick={() => switchMode('login')}>Sign in</button></>}
          {mode === 'login' && <>New here? <button onClick={() => switchMode('signup')}>Create an account</button></>}
          {mode === 'forgot' && <>Remembered it? <button onClick={() => switchMode('login')}>Back to sign in</button></>}
        </p>
        <p className="acct-switch acct-switch--muted">
          Looking for the <Link to="/pricing">plans and pricing</Link>?
        </p>
      </div>
    </div>
  )
}

function Portal({ account, onLogout }) {
  const [keys, setKeys] = useState([])
  const [label, setLabel] = useState('')
  const [newKey, setNewKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [verifyMsg, setVerifyMsg] = useState('')
  const verified = account.customer?.emailVerified

  const resendVerify = async () => {
    setVerifyMsg('Sending…')
    try {
      await fetch('/api/account/resend-verification', { method: 'POST', credentials: 'include' })
      setVerifyMsg('Verification email sent — check your inbox.')
    } catch {
      setVerifyMsg('Could not send — try again later.')
    }
  }

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/account/keys', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setKeys(data.keys || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  const createKey = async () => {
    setBusy(true); setError(''); setNewKey(null)
    try {
      const res = await fetch('/api/account/keys', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create key')
      setNewKey(data.key)
      setLabel('')
      await loadKeys()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const revoke = async (id) => {
    if (!window.confirm('Revoke this key? Anything using it stops working immediately.')) return
    try {
      const res = await fetch(`/api/account/keys/${id}/revoke`, { method: 'POST', credentials: 'include' })
      if (res.ok) await loadKeys()
    } catch { /* ignore */ }
  }

  const plan = account.plan || 'free'

  return (
    <div className="acct-portal">
      <div className="acct-head">
        <div>
          <h1>Your account</h1>
          <p className="acct-email">{account.customer?.email}</p>
          {verified
            ? <p className="acct-verified">✓ Email verified</p>
            : <p className="acct-unverified">
                Email not verified. <button className="acct-linkbtn" onClick={resendVerify}>Resend link</button>
                {verifyMsg && <span className="acct-verifymsg"> {verifyMsg}</span>}
              </p>}
        </div>
        <button className="acct-btn" onClick={onLogout}>Sign out</button>
      </div>

      <div className="acct-plan">
        <div>
          <div className="acct-plan-label">Current plan</div>
          <div className="acct-plan-name">{TIER_LABEL[plan] || plan}</div>
          <div className="acct-plan-limit">{TIER_LIMIT[plan] || '—'} requests / min</div>
        </div>
        {plan === 'free'
          ? <Link className="acct-btn acct-btn--primary" to="/pricing">Upgrade</Link>
          : <Link className="acct-btn" to="/pricing">Change plan</Link>}
      </div>

      <section className="acct-keys">
        <h2>API keys</h2>
        <p className="acct-keys-sub">Keys are issued at your <strong>{TIER_LABEL[plan] || plan}</strong> tier. Copy a new key when you create it — it's shown only once.</p>

        <div className="acct-create">
          <input className="acct-input" placeholder="Label (e.g. Production server)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="acct-btn acct-btn--primary" onClick={createKey} disabled={busy}>
            {busy ? 'Creating…' : 'Generate key'}
          </button>
        </div>
        {error && <p className="acct-error">{error}</p>}
        {newKey && (
          <div className="acct-newkey">
            <strong>Copy this key now — it won't be shown again:</strong>
            <code>{newKey}</code>
          </div>
        )}

        <div className="acct-table-wrap">
          <table className="acct-table">
            <thead>
              <tr><th>Key</th><th>Label</th><th>Tier</th><th>Requests</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className={k.active ? '' : 'acct-revoked'}>
                  <td className="acct-mono">{k.key_prefix}…</td>
                  <td>{k.label || '—'}</td>
                  <td>{k.tier}</td>
                  <td className="acct-mono">{Number(k.request_count).toLocaleString()}</td>
                  <td>{k.active ? <span className="acct-active">active</span> : <span className="acct-inactive">revoked</span>}</td>
                  <td>{k.active && <button className="acct-btn acct-btn--danger" onClick={() => revoke(k.id)}>Revoke</button>}</td>
                </tr>
              ))}
              {keys.length === 0 && <tr><td colSpan={6} className="acct-empty">No keys yet — generate your first one above.</td></tr>}
            </tbody>
          </table>
        </div>

        <p className="acct-docs-link">New to the API? Read the <Link to="/docs">developer docs</Link>.</p>
      </section>
    </div>
  )
}

export default function Account() {
  const [state, setState] = useState({ status: 'loading' })

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/account', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) { setState({ status: 'anon' }); return }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setState({ status: 'anon' }); return }
      setState({ status: 'authed', account: data })
    } catch {
      setState({ status: 'anon' })
    }
  }, [])

  useEffect(() => { loadAccount() }, [loadAccount])

  const logout = async () => {
    try { await fetch('/api/account/logout', { method: 'POST', credentials: 'include' }) } catch { /* ignore */ }
    setState({ status: 'anon' })
  }

  if (state.status === 'loading') return <main className="acct-page" />
  return (
    <main className="acct-page">
      {state.status === 'authed'
        ? <Portal account={state.account} onLogout={logout} />
        : <AuthCard onAuthed={loadAccount} />}
    </main>
  )
}
