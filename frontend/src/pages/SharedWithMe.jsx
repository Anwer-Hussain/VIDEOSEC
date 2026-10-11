import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api, getUser } from '../api'
import WatermarkedVideoPlayer from '../components/WatermarkedVideoPlayer.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SharedWithMe() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'my-shares' ? 'my-shares' : 'received'
  const [activeTab, setActiveTab] = useState(initialTab)

  const [receivedShares, setReceivedShares] = useState([])
  const [myShares, setMyShares] = useState([])
  const [receivedFileShares, setReceivedFileShares] = useState([])
  const [myFileShares, setMyFileShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [pinPrompt, setPinPrompt] = useState(null) // { share, pin, error, action }
  const [player, setPlayer] = useState(null) // { url, title, forensicIP, forensicTimestamp }
  const [busyId, setBusyId] = useState(null)
  const [copiedToken, setCopiedToken] = useState(null)
  const [clientIP, setClientIP] = useState('127.0.0.1')
  const user = getUser()

  function refresh() {
    setLoading(true)
    setError('')
    Promise.all([
      api.listSharedWithMe().then(setReceivedShares),
      api.listMyShares().then(setMyShares),
      api.listReceivedEncryptedFileShares().then(setReceivedFileShares),
      api.listMyEncryptedFileShares().then(setMyFileShares),
      api.getClientInfo().then((info) => {
        if (info?.ip) setClientIP(info.ip)
      }),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  function switchTab(tab) {
    setActiveTab(tab)
    setSearchParams({ tab })
    setError('')
    setSuccess('')
  }

  // Cleanup blob URL on close
  useEffect(() => {
    return () => {
      if (player?.url) window.URL.revokeObjectURL(player.url)
    }
  }, [player])

  async function openReceivedShare(share, action = 'view', pin = '') {
    setBusyId(share.share_id)
    setError('')
    try {
      if (action === 'view') {
        const streamData = await api.viewSharedVideo(share.share_token, pin)
        setPlayer({
          url: streamData.url,
          title: share.original_filename,
          forensicIP: streamData.forensicIP || clientIP,
          forensicTimestamp: streamData.forensicTimestamp,
        })
        setPinPrompt(null)
      } else if (action === 'download') {
        await api.downloadSharedVideo(share.share_token, pin, share.original_filename)
        setPinPrompt(null)
      }
    } catch (err) {
      if (pinPrompt) {
        setPinPrompt((prev) => ({ ...prev, error: err.message }))
      } else {
        setError(err.message)
      }
    } finally {
      setBusyId(null)
    }
  }

  function handleReceivedActionClick(share, action) {
    if (share.has_pin) {
      setPinPrompt({ share, pin: '', error: '', action })
    } else {
      openReceivedShare(share, action, '')
    }
  }

  // Revoke / Stop Sharing
  async function handleRevoke(share) {
    if (
      !confirm(
        `Are you sure you want to STOP sharing "${share.original_filename}"?\nAnyone with this link or account will immediately lose access.`
      )
    ) {
      return
    }

    setBusyId(share.share_id)
    setError('')
    try {
      await api.revokeShare(share.share_id)
      setMyShares((prev) => prev.filter((s) => s.share_id !== share.share_id))
      setSuccess(`Stopped sharing "${share.original_filename}". Access revoked immediately.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevokeFileShare(share) {
    if (!confirm(`Stop sharing "${share.original_filename}"? Its secure link will stop working.`)) {
      return
    }
    setBusyId(share.share_id)
    setError('')
    try {
      await api.revokeEncryptedFileShare(share.share_id)
      setMyFileShares((current) => current.filter((item) => item.share_id !== share.share_id))
      setSuccess(`Stopped sharing "${share.original_filename}".`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleFilePermission(share) {
    const permission = share.permission === 'view_only' ? 'view_and_download' : 'view_only'
    setBusyId(share.share_id)
    setError('')
    try {
      await api.updateEncryptedFileShare(share.share_id, { permission })
      setMyFileShares((current) => current.map((item) => (
        item.share_id === share.share_id ? { ...item, permission } : item
      )))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  // Toggle permission
  async function handleTogglePermission(share) {
    const newPerm = share.permission === 'view_only' ? 'view_and_download' : 'view_only'
    setBusyId(share.share_id)
    setError('')
    try {
      await api.updateShare(share.share_id, { permission: newPerm })
      setMyShares((prev) =>
        prev.map((s) => (s.share_id === share.share_id ? { ...s, permission: newPerm } : s))
      )
      setSuccess(
        `Updated permission for "${share.original_filename}" to ${
          newPerm === 'view_only' ? 'View-Only' : 'Download Allowed'
        }.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function getShareUrl(token) {
    return `${window.location.origin}/share/${token}`
  }

  function getFileShareUrl(token) {
    return `${window.location.origin}/file-share/${token}`
  }

  function copyLink(token) {
    navigator.clipboard.writeText(getShareUrl(token))
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2500)
  }

  function copyFileLink(token) {
    navigator.clipboard.writeText(getFileShareUrl(token))
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2500)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Sharing &amp; Access Control</h1>
          <p className="muted">
            Manage active shares you have sent or view confidential videos shared with your account.
          </p>
        </div>
        <div className="quick-actions" style={{ marginTop: 0 }}>
          <Link to="/my-videos" className="btn btn-secondary">
            ← My Videos
          </Link>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="tab-bar" style={{ display: 'flex', gap: '8px', marginTop: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button
          className={`btn btn-small ${activeTab === 'my-shares' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => switchTab('my-shares')}
        >
          📤 Shared by Me ({myShares.length + myFileShares.length})
        </button>
        <button
          className={`btn btn-small ${activeTab === 'received' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => switchTab('received')}
        >
          📥 Received / Shared with Me ({receivedShares.length + receivedFileShares.length})
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginTop: '16px' }}>{error}</div>}
      {success && <div className="alert-success" style={{ marginTop: '16px' }}>{success}</div>}

      {loading && (
        <div className="loading-state">
          <span className="spinner" /> Loading shares…
        </div>
      )}

      {/* --- TAB 1: SHARED BY ME (ACTIVE SHARES & STOP SHARING) --- */}
      {!loading && activeTab === 'my-shares' && (
        <>
          {myShares.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-icon">📤</div>
              <p>You haven't shared any videos yet.</p>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Go to <strong>My Videos</strong> and click <strong>"🔗 Share"</strong> on any video to create a PIN-protected link or share with another user.
              </span>
              <div style={{ marginTop: '16px' }}>
                <Link to="/my-videos" className="btn btn-primary">
                  Go to My Videos
                </Link>
              </div>
            </div>
          ) : (
            <div className="video-grid">
              {myShares.map((s) => (
                <div className="video-card" key={s.share_id}>
                  <div className="video-thumb">
                    <span className="video-thumb-icon">🔗</span>
                    <span className={`badge ${s.is_expired || s.is_view_limit_reached ? 'badge-danger' : 'badge-encrypted'}`}>
                      {s.is_expired ? '⚠️ Expired' : s.is_view_limit_reached ? '🔥 Burned' : '✅ Active'}
                    </span>
                  </div>

                  <div className="video-info">
                    <h3 title={s.original_filename}>{s.original_filename}</h3>
                    <div className="video-meta" style={{ flexWrap: 'wrap', gap: '6px' }}>
                      <span>Shared with: <strong>{s.recipient_username}</strong></span>
                    </div>

                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: '1.6' }}>
                      <div>🔑 <strong>Security:</strong> {s.has_pin ? 'PIN-Protected' : 'Open Link'}</div>
                      <div>🛡️ <strong>Mode:</strong> {s.permission === 'view_only' ? 'View-Only (No Download)' : 'Download Allowed'}</div>
                      <div>👁️ <strong>Views:</strong> {s.view_count} {s.max_views ? `/ ${s.max_views} max (Burn-after-watching)` : 'views'}</div>
                      <div>⏱️ <strong>Expires:</strong> {formatDate(s.expires_at)}</div>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                      <div className="share-link-row">
                        <input
                          type="text"
                          readOnly
                          value={getShareUrl(s.share_token)}
                          className="share-link-input"
                          style={{ fontSize: '0.78rem' }}
                        />
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => copyLink(s.share_token)}
                        >
                          {copiedToken === s.share_token ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="video-actions" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <button
                      className="btn btn-small btn-secondary"
                      disabled={busyId === s.share_id}
                      onClick={() => handleTogglePermission(s)}
                      title="Switch between View-Only and Download Allowed"
                    >
                      {s.permission === 'view_only' ? 'Allow Download' : 'Make View-Only'}
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      disabled={busyId === s.share_id}
                      onClick={() => handleRevoke(s)}
                      title="Permanently deactivate this share and cut off access"
                    >
                      🛑 Stop Sharing
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- TAB 2: RECEIVED (SHARED WITH ME) --- */}
      {!loading && activeTab === 'received' && (
        <>
          {receivedShares.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-icon">📥</div>
              <p>No videos have been shared directly with your account yet.</p>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Ask another user to share a video with your username: <strong>{user?.username}</strong>
              </span>
            </div>
          ) : (
            <div className="video-grid">
              {receivedShares.map((s) => (
                <div className="video-card" key={s.share_id}>
                  <div className="video-thumb">
                    <span className="video-thumb-icon">🎬</span>
                    <span className="badge badge-encrypted">
                      {s.has_pin ? '🔑 PIN-Protected' : '🔓 Direct Access'}
                    </span>
                  </div>

                  <div className="video-info">
                    <h3 title={s.original_filename}>{s.original_filename}</h3>
                    <div className="video-meta">
                      <span>👤 By: <strong>{s.owner_username}</strong></span>
                      <span className="dot">•</span>
                      <span>{formatBytes(s.size_bytes)}</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: '1.5' }}>
                      {s.expires_at && <div>⏱️ Expires: {formatDate(s.expires_at)}</div>}
                      {s.max_views && (
                        <div>🔥 Single-View: {s.view_count}/{s.max_views} used</div>
                      )}
                      {s.is_expired && (
                        <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ Expired</span>
                      )}
                      {s.is_view_limit_reached && (
                        <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ View limit reached</span>
                      )}
                    </div>
                  </div>

                  <div className="video-actions">
                    <button
                      className="btn btn-small btn-primary"
                      disabled={busyId === s.share_id || s.is_expired || s.is_view_limit_reached}
                      onClick={() => handleReceivedActionClick(s, 'view')}
                    >
                      {busyId === s.share_id ? <span className="spinner spinner-small" /> : '▶ View'}
                    </button>
                    {s.permission === 'view_and_download' && (
                      <button
                        className="btn btn-small btn-secondary"
                        disabled={busyId === s.share_id || s.is_expired || s.is_view_limit_reached}
                        onClick={() => handleReceivedActionClick(s, 'download')}
                      >
                        ⬇️ Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && activeTab === 'my-shares' && myFileShares.length > 0 && (
        <section className="file-share-list-section" aria-labelledby="my-file-shares-heading">
          <h2 id="my-file-shares-heading">Shared files</h2>
          <div className="video-grid">
            {myFileShares.map((share) => (
              <article className="video-card file-share-card" key={`file-${share.share_id}`}>
                <div className="video-thumb">
                  <span className="video-thumb-icon">📁</span>
                  <span className={`badge ${share.is_expired || share.is_view_limit_reached ? 'badge-danger' : 'badge-encrypted'}`}>
                    {share.is_expired ? 'Expired' : share.is_view_limit_reached ? 'Limit reached' : 'Secure file'}
                  </span>
                </div>
                <div className="video-info">
                  <h3 title={share.original_filename}>{share.original_filename}</h3>
                  <div className="video-meta">
                    <span>To: <strong>{share.recipient_username}</strong></span>
                    <span className="dot">•</span>
                    <span>{formatBytes(share.size_bytes)}</span>
                  </div>
                  <div className="file-share-meta">
                    <span>{share.has_pin ? 'PIN protected' : 'Link access'}</span>
                    <span>{share.permission === 'view_only' ? 'Preview only' : 'Download allowed'}</span>
                    <span>{share.view_count}{share.max_views ? ` / ${share.max_views} views` : ' views'}</span>
                    {share.expires_at && <span>Expires {formatDate(share.expires_at)}</span>}
                  </div>
                  <div className="share-link-row">
                    <input className="share-link-input" readOnly value={getFileShareUrl(share.share_token)} />
                    <button className="btn btn-small btn-secondary" onClick={() => copyFileLink(share.share_token)}>
                      {copiedToken === share.share_token ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="file-share-owner-actions">
                    <button
                      className="btn btn-small btn-secondary"
                      disabled={busyId === share.share_id}
                      onClick={() => handleToggleFilePermission(share)}
                    >
                      {share.permission === 'view_only' ? 'Allow download' : 'Preview only'}
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      disabled={busyId === share.share_id}
                      onClick={() => handleRevokeFileShare(share)}
                    >
                      {busyId === share.share_id ? 'Stopping…' : 'Stop sharing'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && activeTab === 'received' && receivedFileShares.length > 0 && (
        <section className="file-share-list-section" aria-labelledby="received-file-shares-heading">
          <h2 id="received-file-shares-heading">Files shared with you</h2>
          <div className="video-grid">
            {receivedFileShares.map((share) => (
              <article className="video-card file-share-card" key={`received-file-${share.share_id}`}>
                <div className="video-thumb">
                  <span className="video-thumb-icon">📄</span>
                  <span className="badge badge-encrypted">{share.has_pin ? 'PIN protected' : 'Secure link'}</span>
                </div>
                <div className="video-info">
                  <h3 title={share.original_filename}>{share.original_filename}</h3>
                  <div className="video-meta">
                    <span>From: <strong>{share.owner_username}</strong></span>
                    <span className="dot">•</span>
                    <span>{formatBytes(share.size_bytes)}</span>
                  </div>
                  {share.expires_at && <div className="file-share-meta">Expires {formatDate(share.expires_at)}</div>}
                  <Link className="btn btn-small btn-primary file-share-open" to={`/file-share/${share.share_token}`}>
                    Open secure file
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* PIN Prompt Modal */}
      {pinPrompt && (
        <div className="modal-backdrop" onClick={() => setPinPrompt(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Security PIN Required</h3>
              <button className="modal-close" onClick={() => setPinPrompt(null)}>✕</button>
            </div>

            <p className="muted" style={{ fontSize: '0.88rem' }}>
              <strong>"{pinPrompt.share.original_filename}"</strong> was locked with a security PIN
              by <strong>{pinPrompt.share.owner_username}</strong>.
            </p>

            {pinPrompt.error && <div className="alert-error" style={{ marginBottom: '12px' }}>{pinPrompt.error}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                openReceivedShare(pinPrompt.share, pinPrompt.action, pinPrompt.pin)
              }}
            >
              <label>Enter Security PIN</label>
              <input
                type="password"
                placeholder="Enter PIN"
                value={pinPrompt.pin}
                onChange={(e) =>
                  setPinPrompt((prev) => ({ ...prev, pin: e.target.value, error: '' }))
                }
                autoFocus
                required
              />

              <div className="quick-actions" style={{ marginTop: '20px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={busyId}>
                  {busyId ? 'Verifying…' : '🔓 Unlock & Watch'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setPinPrompt(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forensic Watermarked Player Modal */}
      {player && (
        <WatermarkedVideoPlayer
          src={player.url}
          title={player.title}
          viewerName={user?.username || 'Recipient'}
          viewerIP={player.forensicIP}
          timestamp={player.forensicTimestamp}
          onClose={() => setPlayer(null)}
        />
      )}
    </div>
  )
}
