# Email setup (Phase 3.7 — Resend)

Transactional email (password reset, email verification) is sent via
[Resend](https://resend.com). Like the Stripe billing scaffold, it's **inert
until configured**: with no `RESEND_API_KEY`, `sendEmail()` just logs the message
and returns — nothing else in the app is affected.

## What you do
1. **Create a Resend account** (free tier: ~3,000 emails/month, plenty for
   password resets + verification).
2. **Verify `botwatch.xyz`** (Resend → Domains → Add Domain). Add the DNS
   records it gives you (SPF/DKIM/DMARC) so mail lands in inboxes, not spam.
   You already run these exact checks in the domain-enrichment feature.
3. **Create an API key** (Resend → API Keys) and put it in `.env` as
   `RESEND_API_KEY`.
4. **Set the sender** in `.env` as `EMAIL_FROM`, e.g.
   `EMAIL_FROM=botwatch <noreply@botwatch.xyz>` (must be on the verified domain).
5. Restart the backend.

Before your domain is verified you can still test using Resend's shared sender
(`onboarding@resend.dev`, the built-in fallback) to your own address.

## How it's used
`backend/utilities/emailClient.js` exposes `sendEmail({ to, subject, html, text })`.
It returns `{ delivered, id?, logged?, error? }` and never throws, so callers
treat delivery as best-effort. In inert mode (no key) the message is logged; the
body is only logged off-production, so a misconfigured prod box never dumps reset
tokens into the logs.
