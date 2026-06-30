import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then((res) => {
                setStatus(res.ok ? 'ok' : 'unauth');
            })
            .catch(() => setStatus('unauth'));
    }, []);

    if (status === 'loading') return null;
    if (status === 'unauth') return <Navigate to="/login" replace />;
    return children;
}
