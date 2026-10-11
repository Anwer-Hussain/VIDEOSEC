import { createContext, useContext, useState, useEffect } from 'react'
import { THEMES } from './themes.js'

export { THEMES }

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('videosec_theme') || 'obsidian'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('videosec_theme', theme)
  }, [theme])

  function setTheme(newTheme) {
    setThemeState(newTheme)
  }

  const currentThemeMeta = THEMES.find((t) => t.id === theme) || THEMES[0]

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, currentThemeMeta }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
