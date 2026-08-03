import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './Account.css'

// Email verification landing (Phase 3.9). Reached from the emailed link with
// ?token=. Auto-submits the token on load. Reuses the account card styles.
export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState(token ? 'verifying' : 'notoken')

  useEffect(() => {
    if (!token) return
    fetch('/api/account/verify', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => setStatus(res.ok ? 'ok' : 'fail'))
      .catch(() => setStatus('fail'))
  }, [token])

  const view = {
    verifying: ['Verifying…', 'Confirming your email.', false],
    ok: ['Email verified', 'Thanks — your email is confirmed.', true],
    fail: ['Link invalid or expired', 'Request a new verification email from your account.', true],
    notoken: ['Invalid link', 'This verification link is missing its token.', true],
  }[status]

  return (
    <main className="acct-page">
      <div className="acct-authwrap">
        <div className="acct-auth">
          <h1>{view[0]}</h1>
          <p className="acct-auth-sub">{view[1]}</p>
          {view[2] && <Link className="acct-btn acct-btn--primary" to="/account">Go to your account</Link>}
        </div>
      </div>
    </main>
  )
}
