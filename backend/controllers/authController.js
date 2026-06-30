import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
    // req.user is set by requireAuth middleware
    return res.status(200).json({ user: req.user });
};
