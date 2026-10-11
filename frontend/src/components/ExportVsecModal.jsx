import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ExportVsecModal({ video, onClose }) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleExport(e) {
    e.preventDefault()
    if (!pin || pin.length < 4) {
      setError('Please enter a PIN of at least 4 characters.')
      return
    }
    setError('')
    setLoading(true)

    try {
      await api.exportVsec(video.id, pin, video.original_filename)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Export Portable .vsec Container</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Create an offline encrypted package that can be sent anywhere and decrypted on this site.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

        {!success ? (
          <form onSubmit={handleExport}>
            <div className="card info-card" style={{ marginTop: 0, marginBottom: '16px', padding: '14px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.5' }}>
                📦 <strong>How Portable Containers Work:</strong> The video is wrapped in an AES-256
                container locked with your custom PIN. You can send the <code>.vsec</code> file to your friend via
                WhatsApp, USB, or email. They can visit VIDEOSEC, enter your PIN, and decrypt it.
              </p>
            </div>

            <label>Set Security PIN for Recipient</label>
            <input
              type="password"
              placeholder="Enter at least 4 characters (e.g. 5678)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              minLength={4}
            />
            <p className="hint">Share this PIN securely with your friend so they can unlock the file.</p>

            <div className="quick-actions" style={{ marginTop: '22px' }}>
              <button className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Encrypting & Packaging…' : '📦 Download .vsec Package'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="alert-success" style={{ marginBottom: '16px' }}>
              🎉 Portable container downloaded!
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: '1.6' }}>
              Your file is saved as <code>.vsec</code>. You can send it to your friend.
              They can unlock it anytime by clicking <strong>"Unlock .vsec File"</strong> in the navigation bar
              and entering your PIN.
            </p>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
