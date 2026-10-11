import { useState, useEffect } from 'react'

export default function DownloadConfirmModal({ video, onConfirm, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password) {
      setError('Please enter your account password')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onConfirm(password)
      onClose()
    } catch (err) {
      setError(err.message || 'Incorrect password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🛡️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Authorize Download</h2>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                Step-Up Decryption Verification
              </div>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: '14px 0' }}>
          To protect against unauthorized video theft from unattended or open browser sessions,
          enter your <strong>account password</strong> to decrypt and download:
        </p>

        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>🎬</span>
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.92rem',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {video.original_filename}
            </div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              AES-256 Encrypted • Secure Decryption on demand
            </div>
          </div>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: '0.88rem' }}>Account Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to authorize"
            autoFocus
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !password}>
              {loading ? 'Decrypting…' : '⬇ Authorize & Download'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
