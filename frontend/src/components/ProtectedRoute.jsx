import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

// Gates a route on an authenticated session. Optionally restrict to specific
// roles: an authenticated user whose role isn't allowed (e.g. an API customer
// hitting the research dashboard) is sent to their own area rather than /login.
export default function ProtectedRoute({ children, roles }) {
    const [state, setState] = useState({ status: 'loading' });

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then(({ user }) => setState({ status: 'ok', role: user?.role }))
            .catch(() => setState({ status: 'unauth' }));
    }, []);

    if (state.status === 'loading') return null;
    if (state.status === 'unauth') return <Navigate to="/login" replace />;
    if (roles && !roles.includes(state.role)) {
        // Authenticated, but not for this area. Customers go to their portal.
        return <Navigate to={state.role === 'customer' ? '/account' : '/login'} replace />;
    }
    return children;
}
