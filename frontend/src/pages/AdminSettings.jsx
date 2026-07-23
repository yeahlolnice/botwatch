import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import './AdminSettings.css'

export default function AdminSettings() {
    const [isAdmin, setIsAdmin] = useState(null) // null = loading
    const [busy, setBusy] = useState(null)
    const [log, setLog] = useState([])

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(j => setIsAdmin(j?.user?.role === 'admin'))
            .catch(() => setIsAdmin(false))
    }, [])

    const pushLog = (message) => {
        setLog(prev => [{ id: Date.now(), time: new Date().toLocaleTimeString(), message }, ...prev].slice(0, 20))
    }

    const handleInitTables = async () => {
        setBusy('init')
        try {
            const result = await apiFetch('/api/crawler/init', { method: 'POST' })
            pushLog(result.message || 'Crawler tables ready')
        } catch (e) {
            pushLog(`Init tables failed: ${e.message}`)
        } finally {
            setBusy(null)
        }
    }

    if (isAdmin === null) return null

    if (!isAdmin) {
        return (
            <main className="settings-page">
                <div className="settings-denied">Admin access required.</div>
            </main>
        )
    }

    return (
        <main className="settings-page">
            <div className="settings-header">
                <h1>Admin Settings</h1>
                <p>Operational tools and one-off database maintenance.</p>
            </div>

            <div className="settings-section">
                <h2>Database</h2>
                <div className="settings-card">
                    <h3>Init / update crawler tables</h3>
                    <p className="settings-card-sub">
                        Creates the crawler tables (domains, pages, links, sitemaps) and adds any new
                        AI-readiness / site-profile columns if they don't exist yet. Safe to run repeatedly —
                        every statement is idempotent, nothing is dropped or overwritten. Run this after
                        pulling an update that mentions new database columns.
                    </p>
                    <button className="settings-btn settings-btn--primary" onClick={handleInitTables} disabled={busy !== null}>
                        {busy === 'init' ? 'Running…' : 'Init tables'}
                    </button>
                </div>
            </div>

            <div className="settings-log-section">
                <h2>Activity log</h2>
                {log.length === 0 ? (
                    <p className="settings-empty">No actions yet</p>
                ) : (
                    <ul className="settings-log">
                        {log.map(entry => (
                            <li key={entry.id}><span className="settings-log-time">{entry.time}</span>{entry.message}</li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    )
}
