// Lazy Stripe client (Phase 3.4 billing scaffolding).
//
// The SDK is only imported and instantiated the first time billing is actually
// used, and ONLY when STRIPE_SECRET_KEY is present. This means the server boots
// and runs perfectly fine before you've added your Stripe credentials — the
// billing endpoints simply report "not configured" until the placeholders in
// .env are filled in. Nothing here can crash startup.

let _stripe = null;

// Billing is "configured" once a secret key is present. Individual tiers are
// separately gated on having a Price id (see priceForTier).
export function isBillingConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Returns a Stripe client, or null if billing isn't configured / the SDK isn't
// installed. Callers must handle null by returning a 503.
export async function getStripe() {
    if (!isBillingConfigured()) return null;
    if (_stripe) return _stripe;
    try {
        const { default: Stripe } = await import('stripe');
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        return _stripe;
    } catch (error) {
        console.error('Stripe SDK unavailable — run `npm install` in backend:', error.message);
        return null;
    }
}

// Maps a tier to its Stripe Price id. Fill these via env once you've created the
// recurring products in the Stripe dashboard.
export function priceForTier(tier) {
    return {
        pro: process.env.STRIPE_PRICE_PRO,
        enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    }[tier] || null;
}

// Tiers that are purchased via Checkout. "free" keys stay admin-issued.
export const PAID_TIERS = ['pro', 'enterprise'];
