# Backlog

Ordered queue for the autonomous loop (see `CLAUDE.md` → Autonomous workflow).
Top unchecked ticket is next. One ticket per PR; PRs are left open for review.

## Phase 3 follow-ups (current)

- [ ] **3.6 — Subscription lifecycle webhooks**
  Handle `customer.subscription.updated` and `customer.subscription.deleted` in
  `billingController.handleWebhook` (extension point already marked). On tier
  change → update the linked key's tier; on cancellation → deactivate the key(s)
  for that subscription. Link via `stripe_subscription_id` / `stripe_customer_id`
  on `api_key`. No new external deps. **Fully implementable.**
  _Done when:_ both events handled idempotently, key tier/active reflects the
  subscription, signature verification unchanged, logic simulated.

- [ ] **3.7 — Email delivery scaffold (inert until configured)**
  Provider-agnostic `sendEmail()` utility that no-ops (logs the message + link)
  until an email provider is configured via env — same pattern as the Stripe
  billing scaffold. `.env.example` + short setup doc. **BLOCKED-SOFT:** the user
  must later pick a provider (SMTP/SendGrid/Resend/…) and add credentials; build
  it inert and flag that, don't wait.

- [ ] **3.8 — Password reset (customer accounts)** _(needs 3.7)_
  `password_reset_token` table, `POST /api/account/forgot` (issue token, email
  reset link) + `POST /api/account/reset` (consume token, set new bcrypt hash).
  Tokens single-use, short TTL. Frontend `/account/reset` page.

- [ ] **3.9 — Email verification** _(needs 3.7)_
  Verify a customer's email on signup: issue a token, email a verify link,
  `GET/POST /api/account/verify`, mark `customer.email_verified`. Gate nothing
  hard initially — surface verified state in the portal.

## Phase 4 — AI-readiness company layer (next major phase; break down later)

- [ ] Draft Phase 4 into concrete tickets before starting (company profiles,
  AI-readiness scoring surfaced per company, etc.). Larger design surface —
  expect to pause for product decisions.

---
_Completed tickets move to a Done section with their PR number._

## Done
- 3.1 API keys (#46) · 3.2 data endpoints (#47) · 3.3 docs (#48) · 3.4 Stripe billing (#49) · 3.5 customer accounts (#50) · auth-tracking redaction (#52)
