import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Intel from './pages/Intel'
import Readiness from './pages/Readiness'
import Willowbot from './pages/Willowbot'
import SiteSearch from './pages/SiteSearch'
import CrawlerAdmin from './pages/CrawlerAdmin'
import Report from './pages/Report'
import Login from './pages/Login'
import Access from './pages/Access'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function Nav() {
  const { pathname } = useLocation()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(j => setUser(j?.user || null))
      .catch(() => setUser(null))
  }, [pathname])

  // Collapse the mobile/tablet menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const authed = !!user
  const isAdmin = user?.role === 'admin'

  if (pathname === '/login') return null
  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">botwatch<span>.xyz</span></Link>
      <button
        className="nav-toggle"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(o => !o)}
      >
        <span></span><span></span><span></span>
      </button>
      <div className={`nav-links ${menuOpen ? 'nav-links--open' : ''}`}>
        <Link to="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
        <Link to="/intel" className={pathname === '/intel' ? 'active' : ''}>Intel</Link>
        <Link to="/readiness" className={pathname === '/readiness' ? 'active' : ''}>Readiness</Link>
        <Link to="/search" className={pathname === '/search' ? 'active' : ''}>Search</Link>
        {authed && <Link to="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>}
        {authed && <Link to="/report" className={pathname === '/report' ? 'active' : ''}>Report</Link>}
        {isAdmin && <Link to="/admin/crawler" className={pathname === '/admin/crawler' ? 'active' : ''}>Crawler</Link>}
        {authed
          ? <button className="nav-signout" onClick={() => { fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => setUser(null)); setMenuOpen(false) }}>Sign out</button>
          : <Link to="/login" className={pathname === '/login' ? 'active' : ''}>Sign in</Link>
        }
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/intel" element={<Intel />} />
        <Route path="/readiness" element={<Readiness />} />
        <Route path="/willowbot" element={<Willowbot />} />
        <Route path="/search" element={<SiteSearch />} />
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/access/:token" element={<Access />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/crawler"
          element={
            <ProtectedRoute>
              <CrawlerAdmin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
