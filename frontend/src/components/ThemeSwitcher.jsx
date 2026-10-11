import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../context/ThemeContext.jsx'

export default function ThemeSwitcher() {
  const { theme, setTheme, themes, currentThemeMeta } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(null)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      const clickedTrigger = menuRef.current?.contains(e.target)
      const clickedDropdown = dropdownRef.current?.contains(e.target)
      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) return undefined

    function updateMenuPosition() {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const menu = dropdownRef.current
      if (!trigger || !menu) return

      const viewportPadding = 12
      const width = Math.min(310, window.innerWidth - viewportPadding * 2)
      const maxHeight = Math.min(
        menu.scrollHeight,
        window.innerHeight - viewportPadding * 2,
      )
      const left = Math.max(
        viewportPadding,
        Math.min(trigger.right - width, window.innerWidth - width - viewportPadding),
      )
      const top = Math.max(
        viewportPadding,
        Math.min(trigger.bottom + 8, window.innerHeight - maxHeight - viewportPadding),
      )
      setMenuPosition({ top, left, width, maxHeight })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen])

  function handleSelectTheme(themeId) {
    setTheme(themeId)
    setIsOpen(false)
  }

  return (
    <div className="theme-switcher-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        ref={triggerRef}
        className="theme-switcher-btn spotlight-nav-item"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Change UI Theme & Cursor Spotlight"
        aria-label="Theme Switcher"
        aria-expanded={isOpen}
      >
        <span style={{ fontSize: '1rem' }}>{currentThemeMeta.icon}</span>
        <span className="theme-switcher-label">Theme</span>
        <span
          className="theme-preview-dots"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            marginLeft: '2px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentThemeMeta.color1,
              boxShadow: `0 0 6px ${currentThemeMeta.color1}`,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentThemeMeta.color2,
              boxShadow: `0 0 6px ${currentThemeMeta.color2}`,
              display: 'inline-block',
            }}
          />
        </span>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="theme-dropdown-menu"
          style={{
            position: 'fixed',
            top: menuPosition?.top ?? 12,
            right: 'auto',
            left: menuPosition?.left ?? 12,
            width: menuPosition?.width ?? Math.min(310, window.innerWidth - 24),
            maxHeight: menuPosition?.maxHeight ?? 'calc(100dvh - 24px)',
            overflowY: 'auto',
            zIndex: 1200,
            visibility: menuPosition ? 'visible' : 'hidden',
          }}
        >
          <div className="theme-dropdown-header">
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>
              🎨 Select UI Theme
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
              Adapts UI colors & interactive cursor spotlight
            </div>
          </div>

          <div className="theme-options-list">
            {themes.map((t) => {
              const isSelected = t.id === theme
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-option-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectTheme(t.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: isSelected ? 'var(--text)' : 'var(--text)',
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--muted)',
                          marginTop: '2px',
                        }}
                      >
                        {t.tagline}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Color swatches */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 6px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '999px',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: t.color1,
                          boxShadow: `0 0 8px ${t.color1}`,
                          display: 'inline-block',
                        }}
                      />
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: t.color2,
                          boxShadow: `0 0 8px ${t.color2}`,
                          display: 'inline-block',
                        }}
                      />
                    </div>

                    {isSelected && (
                      <span
                        style={{
                          color: 'var(--primary)',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
