# Billing setup (Phase 3.4)

The billing scaffolding is fully wired but **inert until you add your Stripe
credentials**. With no Stripe env vars set, every `/api/billing/*` endpoint
returns `503 { "error": "Billing is not configured yet" }` and nothing else in
the app is affected. Fill in the four placeholders in `.env` (see `.env.example`)
and it goes live — no code changes needed.

## What you do

1. **Create a Stripe account** and switch to test mode while setting up.
2. **Create two recurring Products** (Stripe → Products), e.g. "botwatch Pro"
   and "botwatch Enterprise", each with a monthly Price. Copy each **Price ID**
   (`price_…`) into `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ENTERPRISE`.
3. **Copy your Secret key** (Developers → API keys) into `STRIPE_SECRET_KEY`.
4. **Add a webhook** (Developers → Webhooks) pointing to
   `https://botwatch.xyz/api/billing/webhook`, subscribed to the
   **`checkout.session.completed`** event. Copy its **Signing secret**
   (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.
5. Restart the backend. Done.

Local testing without a public URL: `stripe listen --forward-to
localhost:5000/api/billing/webhook` (the Stripe CLI prints a `whsec_…` to use).

## How the flow works

1. Buyer clicks a tier on `/pricing` → `POST /api/billing/checkout` creates a
   Stripe Checkout Session and returns its hosted URL; the browser redirects to
   Stripe to pay.
2. On success Stripe redirects to `/billing/success?session_id=…` **and**
   (independently, reliably) calls our webhook.
3. The webhook verifies the signature and records the paid order.
4. The success page polls `GET /api/billing/session/:id`; the first poll after
   payment **mints an API key at the purchased tier and shows the plaintext
   once**. The key is generated at this moment and only its hash is stored — we
   never persist a plaintext key.

## Security notes

- Webhook signatures are verified against the verbatim raw request body.
- The plaintext key is shown exactly once and never stored; refreshing the
  success page confirms the key exists but will not re-reveal it.
- If a buyer pays but never loads the success page, the order sits as `paid` in
  the `billing_order` table and a key can be issued manually from there.

## Still ahead (Phase 3.5)

Self-serve customer accounts so a subscriber has their own login to view usage
and rotate keys, plus handling `subscription.updated` / `.deleted` webhooks to
change a key's tier or revoke it on cancellation (extension point is marked in
`billingController.handleWebhook`).
