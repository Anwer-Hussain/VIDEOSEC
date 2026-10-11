import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getUser, getToken, clearSession, getUserAvatar, saveUserAvatar } from '../api'
import SecurityModal from './SecurityModal.jsx'
import ThemeSwitcher from './ThemeSwitcher.jsx'
import HelpGuideModal from './HelpGuideModal.jsx'
import Logo from './Logo.jsx'

function resizeImage(file, maxSize = 220) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.88))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function NavSpotlightItem({ to, children, isActive, onClick, className = '', title }) {
  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }

  function handleMouseLeave(e) {
    e.currentTarget.style.setProperty('--mouse-x', `-999px`)
    e.currentTarget.style.setProperty('--mouse-y', `-999px`)
  }

  if (to) {
    return (
      <Link
        to={to}
        className={`spotlight-nav-item ${isActive ? 'active' : ''} ${className}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        title={title}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={`spotlight-nav-item ${isActive ? 'active' : ''} ${className}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      title={title}
    >
      {children}
    </button>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [token, setToken] = useState(getToken)
  const [user, setUser] = useState(getUser)
  const [avatar, setAvatar] = useState(() => getUserAvatar(getUser()?.id))
  const [showSecurity, setShowSecurity] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showHelpGuide, setShowHelpGuide] = useState(false)
  const [helpGuideTab, setHelpGuideTab] = useState('how-to-use')
  const userMenuRef = useRef(null)
  const moreMenuRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        const clickedThemeMenu = e.target instanceof Element && e.target.closest('.theme-dropdown-menu')
        if (!clickedThemeMenu) setShowMoreMenu(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setShowUserMenu(false)
        setShowMoreMenu(false)
      }
    }

    if (showUserMenu || showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showUserMenu, showMoreMenu])

  // Automatically dismiss open modals, dropdowns, and menus whenever the user navigates to a new page
  useEffect(() => {
    setShowSecurity(false)
    setShowUserMenu(false)
    setShowMoreMenu(false)
    setShowHelpGuide(false)
  }, [location.pathname])

  useEffect(() => {
    function handleOpenHelpGuide(e) {
      setHelpGuideTab(e.detail?.tab || 'how-to-use')
      setShowHelpGuide(true)
      setShowMoreMenu(false)
    }
    window.addEventListener('open:help-guide', handleOpenHelpGuide)
    return () => window.removeEventListener('open:help-guide', handleOpenHelpGuide)
  }, [])

  useEffect(() => {
    function syncAuth() {
      setToken(getToken())
      const u = getUser()
      setUser(u)
      setAvatar(getUserAvatar(u?.id))
    }
    window.addEventListener('auth:change', syncAuth)
    window.addEventListener('auth:expired', syncAuth)
    return () => {
      window.removeEventListener('auth:change', syncAuth)
      window.removeEventListener('auth:expired', syncAuth)
    }
  }, [])

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (PNG, JPG, WebP)')
      return
    }
    try {
      const resized = await resizeImage(file, 220)
      saveUserAvatar(user?.id, resized)
      setAvatar(resized)
    } catch (err) {
      console.error('Failed to update avatar:', err)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleRemoveAvatar() {
    saveUserAvatar(user?.id, null)
    setAvatar(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const loggedIn = !!token
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  function handleLogout() {
    clearSession()
    navigate('/login')
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="brand" aria-label="VIDEOSEC Home">
          <Logo size="large" />
        </Link>

        <div className="nav-links">
          {loggedIn ? (
            <>
              <div className="nav-module-links">
                <NavSpotlightItem to="/dashboard" isActive={location.pathname === '/dashboard'}>
                  Dashboard
                </NavSpotlightItem>
                <NavSpotlightItem
                  to="/upload"
                  isActive={location.pathname === '/upload'}
                >
                  Encrypt Video
                </NavSpotlightItem>
                <NavSpotlightItem to="/my-videos" isActive={location.pathname === '/my-videos'}>
                  My Videos
                </NavSpotlightItem>
                <NavSpotlightItem
                  to="/shared-with-me"
                  isActive={location.pathname.startsWith('/shared-with-me')}
                >
                  Shared Videos
                </NavSpotlightItem>
                <NavSpotlightItem
                  to="/offline-decrypt"
                  isActive={location.pathname === '/offline-decrypt'}
                >
                  Unlock .vsec
                </NavSpotlightItem>
              </div>

              <div className="nav-utility-links">
                <div className="nav-more-container" ref={moreMenuRef}>
                  <button
                    type="button"
                    className={`nav-more-trigger ${showMoreMenu || location.pathname === '/files' ? 'active' : ''}`}
                    onClick={() => setShowMoreMenu((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={showMoreMenu}
                    title="More options"
                  >
                    <span aria-hidden="true">☰</span>
                    <span>More</span>
                    <span className="nav-more-chevron" aria-hidden="true">▾</span>
                  </button>

                  {showMoreMenu && (
                    <div className="nav-more-menu" role="menu" aria-label="More options">
                      <button
                        type="button"
                        className="nav-more-option"
                        role="menuitem"
                        onClick={() => {
                          setShowMoreMenu(false)
                          navigate('/files')
                        }}
                      >
                        <span aria-hidden="true">▧</span>
                        <span>Files</span>
                      </button>
                      <button
                        type="button"
                        className="nav-more-option"
                        role="menuitem"
                        onClick={() => {
                          setShowMoreMenu(false)
                          setShowSecurity(true)
                        }}
                      >
                        <span aria-hidden="true">🛡️</span>
                        <span>Security</span>
                      </button>
                      <button
                        type="button"
                        className="nav-more-option"
                        role="menuitem"
                        onClick={() => {
                          setShowMoreMenu(false)
                          setHelpGuideTab('how-to-use')
                          setShowHelpGuide(true)
                        }}
                      >
                        <span aria-hidden="true">💡</span>
                        <span>Guide</span>
                      </button>
                      <div className="nav-more-theme" role="none">
                        <ThemeSwitcher />
                      </div>
                    </div>
                  )}
                </div>

                <div className="user-profile-menu-container" ref={userMenuRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className={`nav-user-btn ${showUserMenu ? 'active' : ''}`}
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    title="User Profile & Settings"
                    aria-expanded={showUserMenu}
                  >
                    {avatar ? (
                      <img src={avatar} alt="Profile" className="nav-avatar-mini" />
                    ) : (
                      <span className="nav-avatar-placeholder-mini">
                        {user?.username?.[0]?.toUpperCase() || '👤'}
                      </span>
                    )}
                    <span>Hi, {user?.username}</span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        opacity: 0.7,
                        transform: showUserMenu ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                        display: 'inline-block',
                      }}
                    >
                      ▼
                    </span>
                  </button>

                  {showUserMenu && (
                    <div className="user-profile-popup">
                      <div className="user-popup-content">
                        <div
                          className="user-avatar-large-container"
                          onClick={() => fileInputRef.current?.click()}
                          title="Click to choose profile picture from PC"
                        >
                          {avatar ? (
                            <img src={avatar} alt="Profile" className="user-avatar-large" />
                          ) : (
                            <div className="user-avatar-placeholder-large">
                              {user?.username?.[0]?.toUpperCase() || '👤'}
                            </div>
                          )}
                          <div className="user-avatar-badge-cam" title="Change photo">
                            📷
                          </div>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/webp, image/gif"
                          onChange={handleAvatarChange}
                          style={{ display: 'none' }}
                        />

                        <div className="user-popup-username">{user?.username}</div>
                        {user?.email && <div className="user-popup-email">{user.email}</div>}

                        <div className="user-avatar-actions">
                          <button
                            type="button"
                            className="btn-avatar-pill"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            📷 {avatar ? 'Change Photo' : 'Choose Photo'}
                          </button>
                          {avatar && (
                            <button
                              type="button"
                              className="btn-avatar-pill-danger"
                              onClick={handleRemoveAvatar}
                              title="Remove photo"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="user-popup-divider" />

                      <button
                        type="button"
                        className="user-popup-logout-btn"
                        onClick={() => {
                          setShowUserMenu(false)
                          handleLogout()
                        }}
                      >
                        🚪 Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="nav-module-links">
                {!isAuthPage && (
                  <NavSpotlightItem
                    to="/offline-decrypt"
                    isActive={location.pathname === '/offline-decrypt'}
                  >
                    Unlock .vsec
                  </NavSpotlightItem>
                )}
                <NavSpotlightItem to="/login" isActive={location.pathname === '/login'}>
                  Login
                </NavSpotlightItem>
              </div>
              <div className="nav-utility-links">
                {!isAuthPage && <ThemeSwitcher />}
                <Link to="/register" className="btn btn-primary btn-small nav-register-link">
                  Register
                </Link>
              </div>
            </>
          )}
        </div>
      </nav>

      {showSecurity && <SecurityModal onClose={() => setShowSecurity(false)} />}
      <HelpGuideModal
        isOpen={showHelpGuide}
        onClose={() => setShowHelpGuide(false)}
        defaultTab={helpGuideTab}
      />

      {loggedIn && (
        <button
          type="button"
          className="floating-ai-launcher"
          onClick={() => {
            setHelpGuideTab('ai-chat')
            setShowHelpGuide(true)
          }}
          title="Ask AI Assistant to clear any doubts about VIDEOSEC"
        >
          <span className="floating-ai-icon">🤖</span>
          <span className="floating-ai-label">Ask AI</span>
          <span className="floating-ai-pulse" />
        </button>
      )}
    </>
  )
}
