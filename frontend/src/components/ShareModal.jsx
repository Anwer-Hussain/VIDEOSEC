import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ShareModal({ video, onClose, onShareCreated }) {
  const [recipient, setRecipient] = useState('')
  const [pin, setPin] = useState('')
  const [permission, setPermission] = useState('view_only')
  const [expiresHours, setExpiresHours] = useState('24')
  const [singleView, setSingleView] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdShare, setCreatedShare] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleShare(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await api.createShare(video.id, {
        recipient: recipient.trim() || undefined,
        pin: pin.trim() || undefined,
        permission,
        expires_hours: expiresHours === '0' ? null : Number(expiresHours),
        max_views: singleView ? 1 : null,
      })
      setCreatedShare(result)
      if (onShareCreated) onShareCreated(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getShareUrl(token) {
    return `${window.location.origin}/share/${token}`
  }

  function handleCopy() {
    if (!createdShare) return
    navigator.clipboard.writeText(getShareUrl(createdShare.share_token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Share "{video.original_filename}"</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Create a secure, PIN-protected share with granular access control.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

        {!createdShare ? (
          <form onSubmit={handleShare}>
            <label>Share with specific User (Optional)</label>
            <input
              type="text"
              placeholder="Username or email (leave blank to create an open link)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <p className="hint">If specified, this video appears directly in the user's "Shared With Me" tab.</p>

            <label>Security PIN (Optional but Recommended)</label>
            <input
              type="password"
              placeholder="e.g. 4-digit PIN (1234)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={12}
            />
            <p className="hint">The viewer must enter this exact PIN to watch the video.</p>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div>
                <label>Permission</label>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="select-input"
                >
                  <option value="view_only">👁️ View-Only (No Download)</option>
                  <option value="view_and_download">⬇️ Allow Download</option>
                </select>
              </div>
              <div>
                <label>Expiration</label>
                <select
                  value={expiresHours}
                  onChange={(e) => setExpiresHours(e.target.value)}
                  className="select-input"
                >
                  <option value="1">⏱️ 1 Hour</option>
                  <option value="24">⏱️ 24 Hours</option>
                  <option value="168">⏱️ 7 Days</option>
                  <option value="0">♾️ No Expiry</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={singleView}
                  onChange={(e) => setSingleView(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span>🔥 <strong>Burn-After-Watching</strong> (Single-View Self-Destruct)</span>
              </label>
              <p className="hint" style={{ marginLeft: '24px' }}>
                Deactivates access immediately once the video is watched once.
              </p>
            </div>

            <div className="quick-actions" style={{ marginTop: '22px' }}>
              <button className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating Secure Share…' : '🔗 Generate Secure Share'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="share-success-box">
            <div className="alert-success" style={{ marginBottom: '16px' }}>
              🎉 Secure share created successfully!
            </div>

            <div className="stat-card" style={{ textAlign: 'left', padding: '16px', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '4px' }}>
                Shareable Link:
              </div>
              <div className="share-link-row">
                <input
                  type="text"
                  readOnly
                  value={getShareUrl(createdShare.share_token)}
                  className="share-link-input"
                />
                <button className="btn btn-primary btn-small" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>

              <div style={{ marginTop: '14px', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: '1.6' }}>
                {createdShare.recipient_username && (
                  <div>👤 <strong>Shared with:</strong> {createdShare.recipient_username}</div>
                )}
                {createdShare.has_pin && (
                  <div>🔑 <strong>PIN Protected:</strong> Yes (share the PIN with the recipient)</div>
                )}
                <div>🛡️ <strong>Permission:</strong> {createdShare.permission === 'view_only' ? 'View-Only' : 'Download Allowed'}</div>
                {createdShare.max_views && (
                  <div>🔥 <strong>Limit:</strong> Single-View (Self-Destruct)</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
