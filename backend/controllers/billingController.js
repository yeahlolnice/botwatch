import jwt from 'jsonwebtoken';
import { query } from '../utilities/connectDB.js';
import { generateApiKey } from '../utilities/apiKey.js';
import { insertBillingApiKeyQuery } from '../utilities/sqlApiKeyQuerys.js';
import {
    upsertBillingOrderQuery,
    getBillingOrderQuery,
    claimBillingOrderQuery,
    finalizeBillingOrderQuery,
} from '../utilities/sqlBillingQuerys.js';
import { getStripe, isBillingConfigured, priceForTier, PAID_TIERS } from '../utilities/stripeClient.js';

// GET /api/billing/config — tells the frontend whether billing is live and which
// tiers are actually purchasable (a tier is purchasable only once its Price id is
// set in env). Lets the pricing page degrade gracefully before Stripe is wired.
export const billingConfig = (req, res) => {
    res.json({
        configured: isBillingConfigured(),
        tiers: {
            pro: Boolean(priceForTier('pro')),
            enterprise: Boolean(priceForTier('enterprise')),
        },
    });
};

// Prefer an explicit public base URL, else derive from the (proxy-trusted) request.
const baseUrl = (req) =>
    (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

// Checkout is public (buyers needn't be logged in), but if a customer IS logged
// in we read their email from the session cookie so the resulting order links to
// their account automatically. Never trusts a client-supplied email.
const customerEmailFromReq = (req) => {
    try {
        const token = req.cookies?.auth_token;
        if (!token) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.role === 'customer' ? decoded.email : null;
    } catch {
        return null;
    }
};

// POST /api/billing/checkout { tier } — create a Stripe Checkout Session for a
// subscription tier and hand back its hosted URL for the browser to redirect to.
export const createCheckout = async (req, res) => {
    const tier = (req.body?.tier || '').trim();
    if (!PAID_TIERS.includes(tier)) {
        return res.status(400).json({ error: `tier must be one of: ${PAID_TIERS.join(', ')}` });
    }

    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ error: 'Billing is not configured yet' });

    const price = priceForTier(tier);
    if (!price) return res.status(503).json({ error: `No Stripe price configured for the ${tier} tier yet` });

    try {
        const base = baseUrl(req);
        const email = customerEmailFromReq(req);
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price, quantity: 1 }],
            success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${base}/pricing`,
            metadata: { tier },
            subscription_data: { metadata: { tier } },
            ...(email ? { customer_email: email } : {}),
        });
        return res.json({ url: session.url });
    } catch (error) {
        console.error('Checkout error:', error.message);
        return res.status(500).json({ error: 'Failed to start checkout' });
    }
};

// POST /api/billing/webhook — Stripe calls this. We verify the signature against
// the verbatim raw body (captured for every request in server.js) and, on a
// completed checkout, record the paid order. The API key is minted later, at
// reveal time (getSession), so no plaintext key is ever stored.
export const handleWebhook = async (req, res) => {
    const stripe = await getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) return res.status(503).json({ error: 'Billing is not configured yet' });

    if (!req.rawBody || req.rawBodyTruncated) {
        return res.status(400).json({ error: 'Raw body unavailable for signature verification' });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], secret);
    } catch (error) {
        console.error('Webhook signature verification failed:', error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const s = event.data.object;
            await query(upsertBillingOrderQuery, [
                s.id,
                s.customer || null,
                s.subscription || null,
                s.customer_details?.email || s.customer_email || null,
                s.metadata?.tier || 'pro',
            ]);
        }
        // Future: subscription.updated / .deleted -> flip the linked key's tier or
        // revoke it. Left as a clearly-marked extension point for Phase 3.5.
        return res.json({ received: true });
    } catch (error) {
        console.error('Webhook handling error:', error.message);
        return res.status(500).json({ error: 'Webhook handling failed' });
    }
};

// GET /api/billing/session/:sessionId — the success page polls this. Once the
// webhook has recorded the paid order, the FIRST call mints an API key at the
// purchased tier and returns the plaintext exactly once; later calls only confirm
// the key was already issued (they never re-reveal it).
export const getSession = async (req, res) => {
    const sessionId = (req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'Missing session id' });

    try {
        const order = (await query(getBillingOrderQuery, [sessionId])).rows[0];
        if (!order) return res.json({ status: 'pending' }); // webhook hasn't landed yet
        if (order.status === 'provisioned') {
            return res.json({ status: 'provisioned', alreadyIssued: true, tier: order.tier });
        }

        // Atomically claim the paid order; only the winner proceeds to mint a key.
        const claim = (await query(claimBillingOrderQuery, [sessionId])).rows[0];
        if (!claim) {
            // Already claimed/provisioning elsewhere — don't mint a second key.
            return res.json({ status: 'provisioned', alreadyIssued: true, tier: order.tier });
        }

        const { key, hash, prefix } = generateApiKey();
        const label = claim.email ? `Subscriber · ${claim.email}` : 'Subscriber';
        const row = (await query(insertBillingApiKeyQuery, [
            hash, prefix, label, claim.tier,
            claim.stripe_customer_id, claim.stripe_subscription_id, sessionId, claim.email,
        ])).rows[0];
        await query(finalizeBillingOrderQuery, [sessionId, row.id]);

        // Plaintext returned exactly once — the client must copy it now.
        return res.json({ status: 'provisioned', tier: claim.tier, key });
    } catch (error) {
        console.error('Billing session error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch billing session' });
    }
};
