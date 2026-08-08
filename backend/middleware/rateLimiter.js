import rateLimit from 'express-rate-limit';

// Global limiter — all routes
export const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down' },
});

// Strict limiter for login — brute force protection
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, try again in 15 minutes' },
    skipSuccessfulRequests: true,
});

// Dashboard data limiter — prevents someone hammering the traffic endpoints
export const trafficLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests to traffic API' },
});

// Readiness scan limiter — each scan makes outbound fetches to the target site,
// so cap it per IP to stop botwatch being used as a scanning proxy.
export const scanLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many scans, please wait a minute' },
});
