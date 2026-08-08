import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Intel from './pages/Intel'
import Readiness from './pages/Readiness'
import ReadinessCheck from './pages/ReadinessCheck'
import ReadinessReport from './pages/ReadinessReport'
import Willowbot from './pages/Willowbot'
import SiteSearch from './pages/SiteSearch'
import CrawlerAdmin from './pages/CrawlerAdmin'
import AdminSettings from './pages/AdminSettings'
import ModelAdmin from './pages/ModelAdmin'
import ApiKeys from './pages/ApiKeys'
import ApiDocs from './pages/ApiDocs'
import Pricing from './pages/Pricing'
import BillingSuccess from './pages/BillingSuccess'
import Account from './pages/Account'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Report from './pages/Report'
import Login from './pages/Login'
import Access from './pages/Access'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function Nav() {
  const { pathname } = useLocation()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadUser = useCallback(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(j => setUser(j?.user || null))
      .catch(() => setUser(null))
  }, [])

  // Refresh on route change, and whenever an auth action fires an 'auth-changed'
  // event (e.g. a customer signing in/out in-place on /account, which doesn't
  // change the URL and so wouldn't otherwise update the nav).
  useEffect(() => { loadUser() }, [pathname, loadUser])
  useEffect(() => {
    window.addEventListener('auth-changed', loadUser)
    return () => window.removeEventListener('auth-changed', loadUser)
  }, [loadUser])

  // Collapse the mobile/tablet menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const authed = !!user
  const isAdmin = user?.role === 'admin'
  const isCustomer = user?.role === 'customer'
  const isResearch = authed && !isCustomer

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
        <Link to="/docs" className={pathname === '/docs' ? 'active' : ''}>API</Link>
        <Link to="/pricing" className={pathname === '/pricing' ? 'active' : ''}>Pricing</Link>
        {isResearch && <Link to="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>}
        {isResearch && <Link to="/report" className={pathname === '/report' ? 'active' : ''}>Report</Link>}
        {isAdmin && <Link to="/admin/crawler" className={pathname === '/admin/crawler' ? 'active' : ''}>Crawler</Link>}
        {isAdmin && <Link to="/admin/model" className={pathname === '/admin/model' ? 'active' : ''}>Model</Link>}
        {isAdmin && <Link to="/admin/keys" className={pathname === '/admin/keys' ? 'active' : ''}>API Keys</Link>}
        {isAdmin && <Link to="/admin/settings" className={pathname === '/admin/settings' ? 'active' : ''}>Settings</Link>}
        {isCustomer && <Link to="/account" className={pathname === '/account' ? 'active' : ''}>Account</Link>}
        {authed
          ? <button className="nav-signout" onClick={() => { const url = isCustomer ? '/api/account/logout' : '/api/auth/logout'; fetch(url, { method: 'POST', credentials: 'include' }).then(() => { setUser(null); window.dispatchEvent(new Event('auth-changed')) }); setMenuOpen(false) }}>Sign out</button>
          : <Link to="/account" className={pathname === '/account' ? 'active' : ''}>Sign in</Link>
        }
      </div>
    </nav>
  )
}

// Site footer. Holds the discreet staff/admin sign-in so customers aren't sent
// to the admin login from the main nav. Hidden on the login page itself.
function Footer() {
  const { pathname } = useLocation()
  if (pathname === '/login') return null
  return (
    <footer className="site-footer">
      <span className="site-footer-copy">© {new Date().getFullYear()} botwatch.xyz</span>
      <Link to="/login" className="site-footer-staff">Staff sign in</Link>
    </footer>
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
        <Route path="/readiness-check" element={<ReadinessCheck />} />
        <Route path="/readiness-report/:token" element={<ReadinessReport />} />
        <Route path="/willowbot" element={<Willowbot />} />
        <Route path="/search" element={<SiteSearch />} />
        <Route path="/docs" element={<ApiDocs />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/billing/success" element={<BillingSuccess />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/reset" element={<ResetPassword />} />
        <Route path="/account/verify" element={<VerifyEmail />} />
        <Route
          path="/report"
          element={
            <ProtectedRoute roles={['admin', 'user', 'guest']}>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/access/:token" element={<Access />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={['admin', 'user', 'guest']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/crawler"
          element={
            <ProtectedRoute roles={['admin']}>
              <CrawlerAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/model"
          element={
            <ProtectedRoute roles={['admin']}>
              <ModelAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/keys"
          element={
            <ProtectedRoute roles={['admin']}>
              <ApiKeys />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
