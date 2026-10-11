import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, getUser } from '../api'
import WatermarkedVideoPlayer from '../components/WatermarkedVideoPlayer.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PublicShareView() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState('')
  const [player, setPlayer] = useState(null)
  const [clientIP, setClientIP] = useState('127.0.0.1')
  const user = getUser()

  useEffect(() => {
    setLoading(true)
    api
      .getShareInfo(token)
      .then(setInfo)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    api.getClientInfo().then((data) => {
      if (data?.ip) setClientIP(data.ip)
    })
  }, [token])

  useEffect(() => {
    return () => {
      if (player?.url) window.URL.revokeObjectURL(player.url)
    }
  }, [player])

  async function handleUnlock(e) {
    if (e) e.preventDefault()
    setError('')
    setUnlocking(true)

    try {
      const result = await api.viewSharedVideo(token, pin)
      setPlayer({
        url: result.url,
        title: info?.original_filename || 'Confidential Video',
        forensicIP: result.forensicIP || clientIP,
        forensicTimestamp: result.forensicTimestamp,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setUnlocking(false)
    }
  }

  async function handleDownload() {
    setError('')
    try {
      await api.downloadSharedVideo(token, pin, info?.original_filename)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="page center" style={{ paddingTop: '80px' }}>
        <span className="spinner" /> Loading secure share…
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="auth-page">
        <div className="card auth-card center">
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⚠️</div>
          <h2>Share Unavailable</h2>
          <p className="muted">{error}</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ maxWidth: '480px' }}>
        <div className="center">
          <span style={{ fontSize: '2.4rem' }}>🔐</span>
          <h2>VIDEOSEC Confidential Access</h2>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Shared by <strong>{info?.owner_username}</strong>
          </p>
        </div>

        <div className="card stat-card" style={{ textAlign: 'left', padding: '14px', marginTop: '16px' }}>
          <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text)' }}>
            {info?.original_filename}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>
            Size: {formatBytes(info?.size_bytes)} • AES-256 In-Memory Decryption
          </div>
          {info?.max_views && (
            <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '6px' }}>
              🔥 Single-View / Burn-After-Watching Active
            </div>
          )}
        </div>

        {error && <div className="alert-error" style={{ marginTop: '14px' }}>{error}</div>}

        {info?.is_expired ? (
          <div className="alert-error" style={{ marginTop: '14px' }}>
            ⚠️ This secure share link has expired.
          </div>
        ) : info?.is_view_limit_reached ? (
          <div className="alert-error" style={{ marginTop: '14px' }}>
            ⚠️ This video has reached its maximum view limit (Burned).
          </div>
        ) : (
          <form onSubmit={handleUnlock} style={{ marginTop: '14px' }}>
            {info?.has_pin && (
              <>
                <label>Security PIN Required</label>
                <input
                  type="password"
                  placeholder="Enter 4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  autoFocus
                />
                <p className="hint">Enter the security PIN given to you by the owner.</p>
              </>
            )}

            <button className="btn btn-primary" disabled={unlocking} style={{ width: '100%', marginTop: '18px' }}>
              {unlocking ? 'Decrypting Stream…' : '▶ Watch Secure Video'}
            </button>

            {info?.permission === 'view_and_download' && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownload}
                style={{ width: '100%', marginTop: '10px' }}
              >
                ⬇️ Download Video
              </button>
            )}
          </form>
        )}

        <p className="muted center" style={{ fontSize: '0.78rem', marginTop: '22px' }}>
          🛡️ Protected by dynamic forensic watermarks and tamper-evident AES-256 encryption.
        </p>
      </div>

      {player && (
        <WatermarkedVideoPlayer
          src={player.url}
          title={player.title}
          viewerName={user?.username ? `${user.username} (Link)` : 'Authorized Guest'}
          viewerIP={player.forensicIP}
          timestamp={player.forensicTimestamp}
          onClose={() => setPlayer(null)}
        />
      )}
    </div>
  )
}
