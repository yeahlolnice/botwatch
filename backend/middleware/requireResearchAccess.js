// Research/dashboard data (bot tracking, threat intel) is for admins, seeded
// research users, and guest access-link holders — never for self-serve API
// customers. This explicitly blocks the 'customer' role from those endpoints,
// which otherwise only require a valid session. Runs after requireAuth.
export const requireResearchAccess = (req, res, next) => {
    if (req.user?.role === 'customer') {
        return res.status(403).json({ error: 'Not authorized for research data' });
    }
    next();
};
