import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { query } from '../utilities/connectDB.js';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
};

// POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await query(
            'SELECT id, name, email, password, role FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        const user = result.rows[0];

        // Use a constant-time compare even on "user not found" to prevent
        // user enumeration via timing attacks
        const passwordMatch = user
            ? await bcrypt.compare(password, user.password)
            : await bcrypt.compare(password, '$2b$12$invalidhashfortimingpurposesonly000000000000000000000');

        if (!user || !passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        res.cookie('auth_token', token, COOKIE_OPTIONS);

        return res.status(200).json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
};

// POST /api/auth/logout
export const logout = (req, res) => {
    res.clearCookie('auth_token', COOKIE_OPTIONS);
    return res.status(200).json({ message: 'Logged out' });
};

// GET /api/auth/me
export const me = (req, res) => {
    return res.status(200).json({ user: req.user });
};

// POST /api/auth/access-link — admin only, generates a 2-hour guest access token
export const createAccessLink = async (req, res) => {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS access_links (
                token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_by  INT NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                expires_at  TIMESTAMPTZ NOT NULL,
                used_at     TIMESTAMPTZ,
                used_count  INT DEFAULT 0
            )
        `);

        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

        await query(
            `INSERT INTO access_links (token, created_by, expires_at)
             VALUES ($1, $2, $3)`,
            [token, req.user.id, expiresAt]
        );

        const baseUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
        return res.status(201).json({
            url: `${baseUrl}/access/${token}`,
            expires_at: expiresAt,
        });
    } catch (error) {
        console.error('Access link error:', error);
        return res.status(500).json({ error: 'Failed to create access link' });
    }
};

// GET /api/auth/access/:token — validates token, issues a guest JWT cookie
export const redeemAccessLink = async (req, res) => {
    try {
        const { token } = req.params;

        const result = await query(
            `SELECT * FROM access_links WHERE token = $1`,
            [token]
        );

        const link = result.rows[0];

        if (!link) return res.status(404).json({ error: 'Invalid access link' });
        if (new Date(link.expires_at) < new Date()) {
            return res.status(410).json({ error: 'This link has expired' });
        }

        // Record use but don't block reuse within the window
        await query(
            `UPDATE access_links SET used_at = NOW(), used_count = used_count + 1 WHERE token = $1`,
            [token]
        );

        const guestToken = jwt.sign(
            { role: 'guest', via: token },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'strict',
            maxAge: 2 * 60 * 60 * 1000,
        };

        res.cookie('auth_token', guestToken, cookieOptions);
        return res.redirect('/dashboard');
    } catch (error) {
        console.error('Redeem access link error:', error);
        return res.status(500).json({ error: 'Failed to redeem access link' });
    }
};
