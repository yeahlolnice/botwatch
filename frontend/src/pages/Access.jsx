import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function Access() {
    const { token } = useParams()
    const [error, setError] = useState(null)

    useEffect(() => {
        // Hit the backend redeem endpoint — it sets the cookie and redirects to /dashboard
        window.location.href = `/api/auth/access/${token}`
    }, [token])

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
                <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
                <a href="/" style={{ fontSize: 13, color: 'var(--accent)' }}>Go home</a>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Validating access link…</p>
        </div>
    )
}
