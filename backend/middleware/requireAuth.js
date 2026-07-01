import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
    const token = req.cookies?.auth_token;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.id || null,
            email: decoded.email || null,
            role: decoded.role,
            isGuest: decoded.role === 'guest',
        };
        next();
    } catch (error) {
        res.clearCookie('auth_token');
        return res.status(401).json({ error: 'Session expired, please log in again' });
    }
};
