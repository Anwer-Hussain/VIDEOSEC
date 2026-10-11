import { useEffect, useState } from 'react'
import { api } from '../api'

export default function ShareFileModal({ file, onClose }) {
  const [recipient, setRecipient] = useState('')
  const [pin, setPin] = useState('')
  const [permission, setPermission] = useState('view_only')
  const [expiresHours, setExpiresHours] = useState('24')
  const [singleView, setSingleView] = useState(false)
  const [createdShare, setCreatedShare] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleCreate(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const share = await api.createEncryptedFileShare(file.id, {
        recipient: recipient.trim() || undefined,
        pin: pin.trim() || undefined,
        permission,
        expires_hours: expiresHours === '0' ? null : Number(expiresHours),
        max_views: singleView ? 1 : null,
      })
      setCreatedShare(share)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = createdShare
    ? `${window.location.origin}/file-share/${createdShare.share_token}`
    : ''

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card file-share-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{createdShare ? 'Secure file link ready' : `Share "${file.original_filename}"`}</h3>
            <p className="muted">Choose who can access this encrypted file.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {error && <div className="alert-error" role="alert">{error}</div>}

        {createdShare ? (
          <div className="file-share-result">
            <div className="alert-success">Secure file share created.</div>
            <label htmlFor="file-share-url">Share link</label>
            <div className="share-link-row">
              <input id="file-share-url" className="share-link-input" readOnly value={shareUrl} />
              <button type="button" className="btn btn-primary btn-small" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="file-share-result-meta">
              <span>{createdShare.recipient_username ? `Recipient: ${createdShare.recipient_username}` : 'Open link'}</span>
              <span>{createdShare.has_pin ? 'PIN protected' : 'No PIN'}</span>
              <span>{createdShare.permission === 'view_and_download' ? 'Download allowed' : 'Preview only'}</span>
              {createdShare.max_views && <span>One view only</span>}
              {createdShare.expires_at && <span>Expires {new Date(createdShare.expires_at).toLocaleString()}</span>}
            </div>
            <p className="hint">
              {createdShare.recipient_username
                ? `Only ${createdShare.recipient_username} can open this link while signed in.`
                : 'Anyone with this link can request access using the PIN, if you set one.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreate}>
            <label htmlFor="file-share-recipient">Share with account (optional)</label>
            <input
              id="file-share-recipient"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="Username or email; leave blank for a link"
              autoComplete="off"
            />
            <p className="hint">Account shares appear in the recipient's Shared Videos area.</p>

            <label htmlFor="file-share-pin">Security PIN (optional)</label>
            <input
              id="file-share-pin"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="Add a PIN for another layer of protection"
              maxLength={32}
              autoComplete="new-password"
            />

            <div className="file-share-select-grid">
              <div>
                <label htmlFor="file-share-permission">Permission</label>
                <select id="file-share-permission" value={permission} onChange={(event) => setPermission(event.target.value)}>
                  <option value="view_only">Preview only</option>
                  <option value="view_and_download">Allow download</option>
                </select>
              </div>
              <div>
                <label htmlFor="file-share-expiry">Expires</label>
                <select id="file-share-expiry" value={expiresHours} onChange={(event) => setExpiresHours(event.target.value)}>
                  <option value="1">In 1 hour</option>
                  <option value="24">In 24 hours</option>
                  <option value="168">In 7 days</option>
                  <option value="0">Never</option>
                </select>
              </div>
            </div>

            <label className="file-share-single-view">
              <input type="checkbox" checked={singleView} onChange={(event) => setSingleView(event.target.checked)} />
              <span>Allow one view only</span>
            </label>

            <div className="quick-actions file-share-actions">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Creating link…' : 'Create secure link'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
