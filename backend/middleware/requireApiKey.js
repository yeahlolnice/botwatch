export const requireApiKey = (req, res, next) => {
    const provided = req.headers['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY;

    if (!expected) {
        console.error('INTERNAL_API_KEY not set — API is unprotected');
        return next();
    }

    if (provided !== expected) {
        // Still tracked by the middleware — this is useful data (someone probing the API)
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};
