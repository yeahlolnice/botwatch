import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query } from '../utilities/connectDB.js';
import { generateApiKey, VALID_TIERS } from '../utilities/apiKey.js';
import { sendEmail } from '../utilities/emailClient.js';
import {
    getCustomerByEmailQuery,
    getCustomerByIdQuery,
    insertCustomerQuery,
    touchCustomerLoginQuery,
    reconcileKeyOwnerByEmailQuery,
    reconcileCustomerStripeIdQuery,
    getCustomerPlanQuery,
    listCustomerKeysQuery,
    insertCustomerKeyQuery,
    revokeCustomerKeyQuery,
    invalidateCustomerResetsQuery,
    insertPasswordResetQuery,
    getValidPasswordResetQuery,
    markPasswordResetUsedQuery,
    updateCustomerPasswordQuery,
    invalidateEmailVerificationsQuery,
    insertEmailVerificationQuery,
    getValidEmailVerificationQuery,
    markEmailVerificationUsedQuery,
    markCustomerVerifiedQuery,
} from '../utilities/sqlCustomerQuerys.js';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000, // 8h
};

// A dummy hash so login does a constant-time compare even when the email is
// unknown — prevents user-enumeration via response timing.
const DUMMY_HASH = '$2b$12$invalidhashfortimingpurposesonly000000000000000000000';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (c) =>
    jwt.sign(
        { id: c.id, email: c.email, role: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const baseUrl = (req) =>
    (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

// Adopt any billing (keys, Stripe id) that already exists for this email so a
// customer who subscribed before signing up sees it the moment they log in.
async function reconcile(customerId, email) {
    try {
        await query(reconcileKeyOwnerByEmailQuery, [customerId, email]);
        await query(reconcileCustomerStripeIdQuery, [customerId, email]);
    } catch (error) {
        console.error('Account reconcile error:', error.message);
    }
}

// Issue an email-verification token and send the verify link. Best-effort — a
// send failure never blocks signup (verification is soft).
async function issueEmailVerification(customer, req) {
    try {
        const token = crypto.randomBytes(32).toString('base64url');
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        await query(invalidateEmailVerificationsQuery, [customer.id]);
        await query(insertEmailVerificationQuery, [customer.id, sha256(token), expires]);
        const link = `${baseUrl(req)}/account/verify?token=${token}`;
        await sendEmail({
            to: customer.email,
            subject: 'Verify your botwatch email',
            text: `Confirm your email for botwatch:\n${link}\n\nThis link expires in 24 hours.`,
            html: `<p>Confirm your email for botwatch:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
        });
    } catch (error) {
        console.error('issueEmailVerification error:', error.message);
    }
}

// The account's entitled tier — from its most recent order, Free if none/invalid.
async function planFor(customer) {
    const row = (await query(getCustomerPlanQuery, [customer.email, customer.stripe_customer_id || null])).rows[0];
    return row?.tier && VALID_TIERS.includes(row.tier) ? row.tier : 'free';
}

// POST /api/account/signup — self-serve. Creates a customer, links any existing
// billing by email, and starts a session.
export const signup = async (req, res) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    const password = req.body?.password || '';
    const name = (req.body?.name || '').trim() || null;

    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    try {
        if ((await query(getCustomerByEmailQuery, [email])).rows[0]) {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }
        const hash = await bcrypt.hash(password, 12);
        const c = (await query(insertCustomerQuery, [email, hash, name])).rows[0];
        await reconcile(c.id, email);
        await issueEmailVerification(c, req);
        res.cookie('auth_token', signToken(c), COOKIE_OPTIONS);
        return res.status(201).json({ customer: { id: c.id, email: c.email, name: c.name } });
    } catch (error) {
        console.error('Signup error:', error.message);
        return res.status(500).json({ error: 'Signup failed' });
    }
};

// POST /api/account/login
export const login = async (req, res) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    const password = req.body?.password || '';
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    try {
        const c = (await query(getCustomerByEmailQuery, [email])).rows[0];
        const ok = c ? await bcrypt.compare(password, c.password) : await bcrypt.compare(password, DUMMY_HASH);
        if (!c || !ok) return res.status(401).json({ error: 'Invalid email or password' });

        await query(touchCustomerLoginQuery, [c.id]);
        await reconcile(c.id, email);
        res.cookie('auth_token', signToken(c), COOKIE_OPTIONS);
        return res.json({ customer: { id: c.id, email: c.email, name: c.name } });
    } catch (error) {
        console.error('Customer login error:', error.message);
        return res.status(500).json({ error: 'Login failed' });
    }
};

// POST /api/account/logout
export const logout = (req, res) => {
    res.clearCookie('auth_token', COOKIE_OPTIONS);
    return res.json({ ok: true });
};

// GET /api/account/me — lightweight identity check for the frontend.
export const me = (req, res) => res.json({ customer: { id: req.user.id, email: req.user.email } });

// GET /api/account — profile + current plan.
export const getAccount = async (req, res) => {
    try {
        const c = (await query(getCustomerByIdQuery, [req.user.id])).rows[0];
        if (!c) return res.status(404).json({ error: 'Account not found' });
        return res.json({
            customer: { id: c.id, email: c.email, name: c.name, emailVerified: c.email_verified },
            plan: await planFor(c),
        });
    } catch (error) {
        console.error('getAccount error:', error.message);
        return res.status(500).json({ error: 'Failed to load account' });
    }
};

// GET /api/account/keys — this account's keys (owned or matched by email).
export const listKeys = async (req, res) => {
    try {
        const c = (await query(getCustomerByIdQuery, [req.user.id])).rows[0];
        if (!c) return res.status(404).json({ error: 'Account not found' });
        const keys = (await query(listCustomerKeysQuery, [c.id, c.email])).rows;
        return res.json({ keys });
    } catch (error) {
        console.error('listKeys error:', error.message);
        return res.status(500).json({ error: 'Failed to list keys' });
    }
};

// POST /api/account/keys { label } — mint a key at the account's entitled tier.
// Plaintext is returned once and never stored.
export const createKey = async (req, res) => {
    const label = (req.body?.label || '').trim() || null;
    try {
        const c = (await query(getCustomerByIdQuery, [req.user.id])).rows[0];
        if (!c) return res.status(404).json({ error: 'Account not found' });
        const tier = await planFor(c);
        const { key, hash, prefix } = generateApiKey();
        const row = (await query(insertCustomerKeyQuery, [hash, prefix, label, tier, c.id, c.email])).rows[0];
        return res.status(201).json({ ...row, key });
    } catch (error) {
        console.error('createKey error:', error.message);
        return res.status(500).json({ error: 'Failed to create key' });
    }
};

// POST /api/account/keys/:id/revoke — revoke one of the account's own keys.
export const revokeKey = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid key id' });
    try {
        const c = (await query(getCustomerByIdQuery, [req.user.id])).rows[0];
        if (!c) return res.status(404).json({ error: 'Account not found' });
        const row = (await query(revokeCustomerKeyQuery, [id, c.id, c.email])).rows[0];
        if (!row) return res.status(404).json({ error: 'Key not found' });
        return res.json({ ok: true, id });
    } catch (error) {
        console.error('revokeKey error:', error.message);
        return res.status(500).json({ error: 'Failed to revoke key' });
    }
};

// POST /api/account/forgot { email } — email a password-reset link. Always
// returns the same generic response so it can't be used to discover which
// emails have accounts.
export const forgotPassword = async (req, res) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    const generic = { ok: true, message: 'If that email has an account, a reset link is on its way.' };
    if (!EMAIL_RE.test(email)) return res.json(generic);

    try {
        const c = (await query(getCustomerByEmailQuery, [email])).rows[0];
        if (c) {
            const token = crypto.randomBytes(32).toString('base64url');
            const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
            await query(invalidateCustomerResetsQuery, [c.id]);
            await query(insertPasswordResetQuery, [c.id, sha256(token), expires]);

            const link = `${baseUrl(req)}/account/reset?token=${token}`;
            await sendEmail({
                to: c.email,
                subject: 'Reset your botwatch password',
                text: `Reset your botwatch password:\n${link}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
                html: `<p>Reset your botwatch password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request it, you can ignore this email.</p>`,
            });
        }
        return res.json(generic);
    } catch (error) {
        console.error('forgotPassword error:', error.message);
        return res.json(generic); // stay generic even on error — never leak existence
    }
};

// POST /api/account/reset { token, password } — consume a reset token and set a
// new password. Token is single-use and time-limited.
export const resetPassword = async (req, res) => {
    const token = (req.body?.token || '').trim();
    const password = req.body?.password || '';
    if (!token) return res.status(400).json({ error: 'Missing reset token' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    try {
        const row = (await query(getValidPasswordResetQuery, [sha256(token)])).rows[0];
        if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired' });

        const hash = await bcrypt.hash(password, 12);
        await query(updateCustomerPasswordQuery, [hash, row.customer_id]);
        await query(markPasswordResetUsedQuery, [row.id]);
        return res.json({ ok: true });
    } catch (error) {
        console.error('resetPassword error:', error.message);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
};

// POST /api/account/verify { token } — consume an email-verification token and
// mark the account verified. Public (reached from the emailed link).
export const verifyEmail = async (req, res) => {
    const token = (req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing verification token' });
    try {
        const row = (await query(getValidEmailVerificationQuery, [sha256(token)])).rows[0];
        if (!row) return res.status(400).json({ error: 'This verification link is invalid or has expired' });
        await query(markCustomerVerifiedQuery, [row.customer_id]);
        await query(markEmailVerificationUsedQuery, [row.id]);
        return res.json({ ok: true });
    } catch (error) {
        console.error('verifyEmail error:', error.message);
        return res.status(500).json({ error: 'Failed to verify email' });
    }
};

// POST /api/account/resend-verification — re-send the verify link to the logged-in
// customer (no-op response if already verified).
export const resendVerification = async (req, res) => {
    try {
        const c = (await query(getCustomerByIdQuery, [req.user.id])).rows[0];
        if (!c) return res.status(404).json({ error: 'Account not found' });
        if (!c.email_verified) await issueEmailVerification(c, req);
        return res.json({ ok: true });
    } catch (error) {
        console.error('resendVerification error:', error.message);
        return res.status(500).json({ error: 'Failed to resend verification' });
    }
};
