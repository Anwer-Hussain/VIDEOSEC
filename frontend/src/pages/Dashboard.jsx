import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getUser } from '../api'
import SpotlightCard from '../components/SpotlightCard.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const user = getUser()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .listVideos()
      .then(setVideos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const totalSize = videos.reduce((sum, v) => sum + v.size_bytes, 0)

  return (
    <div className="page">
      {/* ============================================================
          FUTURISTIC CYBER HERO BANNER
          ============================================================ */}
      <div className="dashboard-hero-banner">
        <div className="hero-cyber-grid" />
        <div className="hero-ambient-glow" />

        <div className="hero-content-wrap">
          <div className="hero-badge-pill">
            <span className="live-pulse-dot" />
            <span className="hero-badge-text">VAULT SECURED</span>
            <span className="hero-badge-divider">•</span>
            <span className="hero-badge-sub">AES-256 ENVELOPE ENCRYPTION ACTIVE</span>
          </div>

          <div className="hero-greeting-row">
            <h1 className="hero-greeting-title">
              {getGreeting()},{' '}
              <span className="hero-username-highlight">{user?.username || 'User'}</span>
              <span className="hero-wave-icon" role="img" aria-label="wave">👋</span>
            </h1>
          </div>

          <p className="hero-subtitle">
            Welcome to your high-assurance cryptographic vault. All stored video assets are protected with random per-file 256-bit symmetric keys and envelope-wrapped master security.
          </p>
        </div>

        <div className="hero-vault-widget">
          <div className="vault-shield-circle">
            <div className="vault-shield-radar" />
            <svg width="44" height="44" viewBox="0 0 40 40" fill="none" className="vault-shield-svg">
              <path
                d="M20 3.5 L34 10.2 V23.2 C34 30.2 27.5 35.5 20 37.2 C12.5 35.5 6 30.2 6 23.2 V10.2 L20 3.5 Z"
                fill="rgba(255, 255, 255, 0.08)"
                stroke="var(--primary)"
                strokeWidth="1.8"
              />
              <path
                d="M15.5 16.5 V12.2 C15.5 9.8 17.5 7.8 20 7.8 C22.5 7.8 24.5 9.8 24.5 12.2 V16.5"
                stroke="var(--primary)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path d="M16 16.8 L26.5 22.5 L16 28.2 Z" fill="var(--primary)" />
              <circle cx="19" cy="22.5" r="1.8" fill="#050811" />
            </svg>
          </div>
          <div className="vault-widget-meta">
            <div className="vault-status-indicator">
              <span className="status-ping" />
              <span>Vault Status: Optimal</span>
            </div>
            <div className="vault-encryption-label">Real-time Defense Active</div>
          </div>
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginTop: '16px' }}>{error}</div>}

      <div className="stat-grid">
        <SpotlightCard className="stat-card">
          <div className="stat-card-top">
            <span className="stat-icon-wrap">🎬</span>
            <span className="stat-badge">Active Vault</span>
          </div>
          <div className="stat-value">{videos.length}</div>
          <div className="stat-label">Encrypted Videos</div>
        </SpotlightCard>

        <SpotlightCard className="stat-card">
          <div className="stat-card-top">
            <span className="stat-icon-wrap">💾</span>
            <span className="stat-badge">Encrypted Size</span>
          </div>
          <div className="stat-value">{formatBytes(totalSize)}</div>
          <div className="stat-label">Total Storage Used</div>
        </SpotlightCard>

        <SpotlightCard className="stat-card">
          <div className="stat-card-top">
            <span className="stat-icon-wrap">🛡️</span>
            <span className="stat-badge stat-badge-secure">Military Standard</span>
          </div>
          <div className="stat-value">AES-256</div>
          <div className="stat-label">Symmetric Cipher</div>
        </SpotlightCard>
      </div>

      <div className="quick-actions" style={{ marginTop: '24px' }}>
        <Link to="/upload" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span>⚡</span> + Upload &amp; Encrypt a Video
        </Link>
        <Link to="/my-videos" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span>📁</span> View My Videos
        </Link>
      </div>

      {!loading && videos.length === 0 && (
        <SpotlightCard className="empty-state">
          <div className="empty-icon">🎬</div>
          <p>You haven't uploaded any videos yet.</p>
          <Link to="/upload" className="btn btn-primary">
            Upload your first video
          </Link>
        </SpotlightCard>
      )}

      {!loading && videos.length > 0 && (
        <SpotlightCard>
          <h2>Recent uploads</h2>
          <ul className="video-list">
            {videos.slice(0, 5).map((v) => (
              <li key={v.id}>
                <span>{v.original_filename}</span>
                <span className="muted">{formatBytes(v.size_bytes)}</span>
              </li>
            ))}
          </ul>
        </SpotlightCard>
      )}
    </div>
  )
}
