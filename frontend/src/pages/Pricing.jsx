import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Pricing.css'

// Public pricing page (Phase 3.4). Tiers map to Stripe Prices on the backend.
// Display prices below are illustrative — the amount actually charged comes from
// the Stripe Price you configure; edit these to match. A tier is only checkout-
// able once its Price id is set (surfaced via /api/billing/config).

const PLANS = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'Evaluate the API and run low-volume lookups.',
    features: ['60 requests / min', 'Threat feed & IP lookups', 'Domain intelligence', 'Community support'],
    cta: 'self',
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$49',
    cadence: 'per month',
    blurb: 'Production integrations and automated pipelines.',
    features: ['600 requests / min', 'Everything in Free', 'CSV blocklist export', 'Email support'],
    cta: 'subscribe',
    highlight: true,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: '$499',
    cadence: 'per month',
    blurb: 'High-throughput SOC and threat-intel workloads.',
    features: ['6,000 requests / min', 'Everything in Pro', 'Priority support', 'Custom limits on request'],
    cta: 'subscribe',
  },
]

export default function Pricing() {
  const [config, setConfig] = useState(null)
  const [busyTier, setBusyTier] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/billing/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setConfig(c || { configured: false, tiers: {} }))
      .catch(() => setConfig({ configured: false, tiers: {} }))
  }, [])

  const subscribe = async (tier) => {
    setBusyTier(tier); setError(null)
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await r.json()
      if (!r.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url // hand off to Stripe Checkout
    } catch (e) {
      setError(e.message)
      setBusyTier(null)
    }
  }

  // Ready to sell a paid tier only once billing is live AND that tier has a price.
  const purchasable = (tier) => Boolean(config?.configured && config?.tiers?.[tier])

  return (
    <main className="price-page">
      <div className="price-hero">
        <span className="price-eyebrow">Pricing</span>
        <h1>Simple, usage-based plans</h1>
        <p>Pick a tier, subscribe, and your API key is issued the moment payment clears. Cancel anytime.</p>
      </div>

      {config && !config.configured && (
        <div className="price-banner">
          Online checkout is being set up. In the meantime, you can{' '}
          <Link to="/account">create a free account</Link> to get a starter key.
        </div>
      )}
      {error && <div className="price-error">{error}</div>}

      <div className="price-grid">
        {PLANS.map((p) => (
          <div className={`price-card ${p.highlight ? 'price-card--highlight' : ''}`} key={p.tier}>
            {p.highlight && <div className="price-tag">Most popular</div>}
            <div className="price-name">{p.name}</div>
            <div className="price-amount">{p.price}<span> {p.cadence}</span></div>
            <p className="price-blurb">{p.blurb}</p>
            <ul className="price-features">
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {p.cta === 'self' ? (
              <Link className="price-btn" to="/docs">Read the docs</Link>
            ) : purchasable(p.tier) ? (
              <button
                className={`price-btn ${p.highlight ? 'price-btn--primary' : ''}`}
                onClick={() => subscribe(p.tier)}
                disabled={busyTier === p.tier}
              >
                {busyTier === p.tier ? 'Redirecting…' : `Subscribe to ${p.name}`}
              </button>
            ) : (
              <button className="price-btn" disabled>Coming soon</button>
            )}
          </div>
        ))}
      </div>

      <p className="price-foot">
        Questions about volume or custom terms? <Link to="/docs">See the API docs</Link>.
      </p>
    </main>
  )
}
