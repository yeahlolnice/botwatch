// Gates the customer portal routes. Runs after requireAuth, so req.user is set.
export const requireCustomer = (req, res, next) => {
    if (req.user?.role !== 'customer') {
        return res.status(403).json({ error: 'Customer account required' });
    }
    next();
};
