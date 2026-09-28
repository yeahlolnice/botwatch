import { isIP } from 'node:net';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Real client IP for rate-limit keys. `trust proxy` is on (server.js), so req.ip
// is the LEFTMOST X-Forwarded-For entry — which the client controls, because
// Cloudflare appends to an attacker-supplied XFF rather than replacing it.
// Keying limiters on req.ip therefore let anyone rotate XFF to get a fresh
// bucket per request. CF-Connecting-IP is set (and overwritten) by Cloudflare,
// and all traffic reaches the origin through the tunnel, so prefer it.
export function clientIp(req) {
    const cf = req.headers?.['cf-connecting-ip'];
    if (typeof cf === 'string' && isIP(cf.trim())) return cf.trim();
    return req.ip;
}

const base = {
    standardHeaders: true,
    legacyHeaders: false,
    // ipKeyGenerator collapses IPv6 to a /56 so one host can't cycle addresses.
    keyGenerator: (req) => ipKeyGenerator(clientIp(req) || 'unknown'),
    // We deliberately don't key on req.ip, so the permissive-trust-proxy check
    // doesn't apply to these limiters.
    validate: { trustProxy: false },
};

// Global limiter — all routes
export const globalLimiter = rateLimit({
    ...base,
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please slow down' },
});

// Strict limiter for login — brute force protection
export const loginLimiter = rateLimit({
    ...base,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many login attempts, try again in 15 minutes' },
    skipSuccessfulRequests: true,
});

// Forgot-password limiter. Must NOT use skipSuccessfulRequests: /forgot always
// answers 200 (so it never leaks whether an account exists), which meant the
// login limiter never counted a single request here — the email-bombing bug.
// This is the per-IP layer; the per-address cooldown lives in forgotPassword.
export const forgotLimiter = rateLimit({
    ...base,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many reset requests, try again later' },
});

// Dashboard data limiter — prevents someone hammering the traffic endpoints
export const trafficLimiter = rateLimit({
    ...base,
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests to traffic API' },
});

// Readiness scan limiter — each scan makes outbound fetches to the target site,
// so cap it per IP to stop botwatch being used as a scanning proxy.
export const scanLimiter = rateLimit({
    ...base,
    windowMs: 60 * 1000,
    max: 12,
    message: { error: 'Too many scans, please wait a minute' },
});
