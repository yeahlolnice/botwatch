import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Intel from './pages/Intel'
import Report from './pages/Report'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function Nav() {
  const { pathname } = useLocation()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => setAuthed(r.ok))
      .catch(() => setAuthed(false))
  }, [pathname])

  if (pathname === '/login') return null
  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">botwatch<span>.xyz</span></Link>
      <div className="nav-links">
        <Link to="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
        <Link to="/intel" className={pathname === '/intel' ? 'active' : ''}>Intel</Link>
        {authed && <Link to="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>}
        {authed && <Link to="/report" className={pathname === '/report' ? 'active' : ''}>Report</Link>}
        {authed
          ? <button className="nav-signout" onClick={() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => setAuthed(false))}>Sign out</button>
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
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
