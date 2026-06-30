import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Intel from './pages/Intel'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function Nav() {
  const { pathname } = useLocation()
  if (pathname === '/login') return null
  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">botwatch<span>.xyz</span></Link>
      <div className="nav-links">
        <Link to="/" className={pathname === '/' ? 'active' : ''}>Home</Link>
        <Link to="/intel" className={pathname === '/intel' ? 'active' : ''}>Intel</Link>
        <Link to="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
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
