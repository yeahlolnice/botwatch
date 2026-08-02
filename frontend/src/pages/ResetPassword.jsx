import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './Account.css'

// Password reset landing (Phase 3.8). Reached from the emailed link with ?token=.
// Reuses the account auth-card styles.
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not reset password')
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="acct-page">
      <div className="acct-authwrap">
        <div className="acct-auth">
          {!token ? (
            <>
              <h1>Invalid link</h1>
              <p className="acct-auth-sub">This reset link is missing its token. Request a new one from the sign-in page.</p>
              <Link className="acct-btn acct-btn--primary" to="/account">Go to sign in</Link>
            </>
          ) : done ? (
            <>
              <h1>Password updated</h1>
              <p className="acct-auth-sub">Your password has been reset — you can now sign in with your new password.</p>
              <Link className="acct-btn acct-btn--primary" to="/account">Sign in</Link>
            </>
          ) : (
            <>
              <h1>Choose a new password</h1>
              <p className="acct-auth-sub">Enter a new password for your account.</p>
              <form onSubmit={submit} className="acct-form">
                <label>New password
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                </label>
                <label>Confirm password
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
                </label>
                <p className="acct-hint">At least 8 characters.</p>
                {error && <p className="acct-error">{error}</p>}
                <button type="submit" className="acct-btn acct-btn--primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
