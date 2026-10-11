import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import AuthBackground from './components/AuthBackground.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import Files from './pages/Files.jsx'
import MyVideos from './pages/MyVideos.jsx'
import SharedWithMe from './pages/SharedWithMe.jsx'
import PublicShareView from './pages/PublicShareView.jsx'
import PublicFileShare from './pages/PublicFileShare.jsx'
import OfflineDecrypt from './pages/OfflineDecrypt.jsx'
import { getToken, clearSession } from './api'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  useEffect(() => {
    function handleAuthExpired() {
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [navigate])

  // Automatically lock session after 10 minutes of inactivity
  useEffect(() => {
    const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
    let timer = null

    function resetTimer() {
      if (timer) clearTimeout(timer)
      if (!getToken()) return

      timer = setTimeout(() => {
        if (getToken()) {
          clearSession()
          navigate('/login?reason=inactivity', { replace: true })
        }
      }, INACTIVITY_TIMEOUT_MS)
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }))

    resetTimer()

    return () => {
      if (timer) clearTimeout(timer)
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer))
    }
  }, [navigate, location.pathname])

  // Prevent any browser scrollbar on auth pages (login/register)
  useEffect(() => {
    if (isAuthPage) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [isAuthPage])

  return (
    <>
      <AuthBackground />
      <Navbar />
      <main className={isAuthPage ? 'main-auth' : ''}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={getToken() ? '/dashboard' : '/login'} replace />}
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/share/:token" element={<PublicShareView />} />
          <Route path="/file-share/:token" element={<PublicFileShare />} />
          <Route path="/offline-decrypt" element={<OfflineDecrypt />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/files"
            element={
              <ProtectedRoute>
                <Files />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-videos"
            element={
              <ProtectedRoute>
                <MyVideos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shared-with-me"
            element={
              <ProtectedRoute>
                <SharedWithMe />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
