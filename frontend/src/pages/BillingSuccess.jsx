import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './BillingSuccess.css'

// Post-checkout landing (Phase 3.4). Stripe redirects here with ?session_id=…
// We poll the backend until the webhook has recorded the payment, then it mints
// the API key and returns the plaintext exactly once — shown here for the buyer
// to copy. Refreshing later confirms the key exists but won't re-reveal it.

const POLL_MS = 2500
const MAX_POLLS = 16 // ~40s

export default function BillingSuccess() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const [state, setState] = useState({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const polls = useRef(0)

  useEffect(() => {
    if (!sessionId) { setState({ status: 'error', error: 'Missing session id.' }); return }
    let timer
    // Non-fatal responses (a gateway blip, an empty body mid-restart, or a
    // still-"pending" order) all just schedule another poll until we give up and
    // show the "taking a while" state. We only hard-error on a bad session id.
    const again = () => {
      polls.current += 1
      if (polls.current >= MAX_POLLS) { setState({ status: 'slow' }); return }
      setState({ status: 'pending' })
      timer = setTimeout(poll, POLL_MS)
    }
    const poll = async () => {
      try {
        const r = await fetch(`/api/billing/session/${encodeURIComponent(sessionId)}`)
        const text = await r.text()
        const data = text ? JSON.parse(text) : {}
        if (r.ok && data.status === 'provisioned') { setState({ status: 'done', ...data }); return }
        again()
      } catch {
        again() // network/parse hiccup — keep trying
      }
    }
    poll()
    return () => clearTimeout(timer)
  }, [sessionId])

  const copy = () => {
    navigator.clipboard?.writeText(state.key).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <main className="bs-page">
      <div className="bs-card">
        {(state.status === 'loading' || state.status === 'pending') && (
          <>
            <div className="bs-spinner" />
            <h1>Confirming your payment…</h1>
            <p>Hang tight — we're provisioning your API key. This usually takes a few seconds.</p>
          </>
        )}

        {state.status === 'done' && state.key && (
          <>
            <div className="bs-check">✓</div>
            <h1>You're all set</h1>
            <p>Your <strong>{state.tier}</strong> subscription is active. Here is your API key — copy it now, it won't be shown again.</p>
            <div className="bs-key">
              <code>{state.key}</code>
              <button className="bs-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p className="bs-hint">Use it with the <code>x-api-key</code> header. See the <Link to="/docs">API docs</Link> to get started.</p>
          </>
        )}

        {state.status === 'done' && !state.key && (
          <>
            <div className="bs-check">✓</div>
            <h1>Subscription active</h1>
            <p>Your key was already issued for this checkout and can't be shown again. If you've lost it, contact support to have it rotated.</p>
            <Link className="bs-btn" to="/docs">Go to the docs</Link>
          </>
        )}

        {state.status === 'slow' && (
          <>
            <div className="bs-check bs-check--wait">…</div>
            <h1>Payment received</h1>
            <p>Your key is taking a moment to provision. Refresh this page shortly, or check your email — you can also contact support if it doesn't appear.</p>
            <button className="bs-btn" onClick={() => window.location.reload()}>Refresh</button>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div className="bs-check bs-check--err">!</div>
            <h1>Something went wrong</h1>
            <p>{state.error}</p>
            <Link className="bs-btn" to="/pricing">Back to pricing</Link>
          </>
        )}
      </div>
    </main>
  )
}
