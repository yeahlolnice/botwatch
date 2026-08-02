// Email delivery (Phase 3.7 scaffold) — provider: Resend (https://resend.com).
//
// Like the Stripe client, the SDK is only loaded and used once RESEND_API_KEY is
// set. Until then sendEmail() runs "inert": it logs the message and returns
// without throwing, so the app works fine before email is configured. Password
// reset (3.8) and email verification (3.9) build on this.

let _resend = null;

export function isEmailConfigured() {
    return Boolean(process.env.RESEND_API_KEY);
}

// Verified sender address. Set EMAIL_FROM once botwatch.xyz is verified in Resend,
// e.g. "botwatch <noreply@botwatch.xyz>". Falls back to Resend's shared test
// sender so local sends work before domain verification.
export function emailFrom() {
    return process.env.EMAIL_FROM || 'botwatch <onboarding@resend.dev>';
}

async function getResend() {
    if (!isEmailConfigured()) return null;
    if (_resend) return _resend;
    try {
        const { Resend } = await import('resend');
        _resend = new Resend(process.env.RESEND_API_KEY);
        return _resend;
    } catch (error) {
        console.error('Resend SDK unavailable — run `npm install` in backend:', error.message);
        return null;
    }
}

// Send a transactional email. Never throws — returns { delivered, id?, logged?,
// error? } so callers can treat delivery as best-effort during scaffolding.
export async function sendEmail({ to, subject, html, text }) {
    if (!to || !subject) return { delivered: false, error: 'to and subject are required' };

    const resend = await getResend();
    if (!resend) {
        // Inert mode: email isn't configured. Log that it *would* have sent. The
        // body (which may carry a reset link) is only logged off-production, so a
        // misconfigured prod box never dumps tokens into the logs.
        console.log(`[email:inert] to=${to} subject=${JSON.stringify(subject)} — RESEND_API_KEY not set, not delivered`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[email:inert] body:\n${text || html || ''}`);
        }
        return { delivered: false, logged: true };
    }

    try {
        const { data, error } = await resend.emails.send({ from: emailFrom(), to, subject, html, text });
        if (error) {
            console.error('Resend send error:', error.message || error);
            return { delivered: false, error: error.message || 'send failed' };
        }
        return { delivered: true, id: data?.id };
    } catch (error) {
        console.error('Resend send threw:', error.message);
        return { delivered: false, error: error.message };
    }
}
