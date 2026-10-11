import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'

const PREVIEWABLE_EXTENSIONS = new Set([
  'bmp', 'csv', 'gif', 'jpeg', 'jpg', 'md', 'pdf', 'png', 'svg', 'tif', 'tiff', 'txt', 'webp',
])

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PublicFileShare() {
  const { token } = useParams()
  const [share, setShare] = useState(null)
  const [pin, setPin] = useState('')
  const [preview, setPreview] = useState(null)
  const [viewUsed, setViewUsed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.getEncryptedFileShareInfo(token)
      .then((result) => { if (active) setShare(result) })
      .catch((err) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [token])

  useEffect(() => () => {
    if (preview?.url) window.URL.revokeObjectURL(preview.url)
  }, [preview])

  const extension = share?.original_filename.split('.').pop()?.toLowerCase() || ''
  const previewable = PREVIEWABLE_EXTENSIONS.has(extension)
  const unavailable = share?.is_expired || share?.is_view_limit_reached || viewUsed

  async function handlePreview() {
    setBusy(true)
    setError('')
    try {
      const result = await api.viewEncryptedFileShare(token, pin)
      const url = window.URL.createObjectURL(result.blob)
      setPreview({ url, mimetype: result.mimetype })
      if (share?.max_views && result.viewCount >= share.max_views) setViewUsed(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    setError('')
    try {
      const viewCount = await api.downloadEncryptedFileShare(token, pin, share.original_filename)
      if (share?.max_views && viewCount >= share.max_views) setViewUsed(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="public-file-share-page">
      <section className="card public-file-share-card">
        <div className="public-file-share-eyebrow"><span /> SECURE FILE SHARE</div>
        <h1>{share?.original_filename || 'Shared file'}</h1>
        {share ? (
          <>
            <p className="muted public-file-share-meta">
              Shared by <strong>{share.owner_username}</strong> <span>•</span> {formatBytes(share.size_bytes)}
            </p>
            {share.recipient_username && (
              <p className="public-file-direct-notice">This link is restricted to {share.recipient_username}'s account.</p>
            )}
            {share.is_expired ? (
              <div className="alert-error">This secure file link has expired.</div>
            ) : share.is_view_limit_reached || viewUsed ? (
              <div className="alert-error">This file share has reached its view limit.</div>
            ) : (
              <>
                {share.has_pin && (
                  <label className="public-file-pin-label" htmlFor="public-file-pin">Security PIN</label>
                )}
                {share.has_pin && (
                  <input
                    id="public-file-pin"
                    type="password"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    placeholder="Enter the PIN from the sender"
                    autoComplete="off"
                  />
                )}
                <div className="public-file-share-actions">
                  {previewable && (
                    <button className="btn btn-secondary" type="button" disabled={busy || (share.has_pin && !pin)} onClick={handlePreview}>
                      {busy ? 'Opening…' : 'Preview securely'}
                    </button>
                  )}
                  {share.permission === 'view_and_download' && (
                    <button className="btn btn-primary" type="button" disabled={busy || (share.has_pin && !pin)} onClick={handleDownload}>
                      {busy ? 'Preparing…' : 'Download file'}
                    </button>
                  )}
                </div>
                {!previewable && share.permission === 'view_only' && (
                  <p className="public-file-no-preview">This format cannot be previewed in the browser. Ask the sender to enable downloads.</p>
                )}
                {error && <div className="alert-error public-file-share-error" role="alert">{error}</div>}
              </>
            )}
            {preview && (
              <div className="public-file-preview">
                {preview.mimetype.startsWith('image/') ? (
                  <img src={preview.url} alt={share.original_filename} />
                ) : (
                  <iframe src={preview.url} title={`Preview of ${share.original_filename}`} />
                )}
              </div>
            )}
            <div className="public-file-share-security">
              <span>{share.has_pin ? 'PIN protected' : 'Link access'}</span>
              <span>{share.permission === 'view_and_download' ? 'Download enabled' : 'Preview only'}</span>
              {share.expires_at && <span>Expires {new Date(share.expires_at).toLocaleString()}</span>}
              {share.max_views && <span>View {share.view_count} of {share.max_views}</span>}
            </div>
          </>
        ) : !error ? (
          <p className="muted">Loading secure share…</p>
        ) : (
          <div className="alert-error" role="alert">{error}</div>
        )}
      </section>
    </div>
  )
}
