import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getUser } from '../api'
import WatermarkedVideoPlayer from '../components/WatermarkedVideoPlayer.jsx'
import ShareModal from '../components/ShareModal.jsx'
import ExportVsecModal from '../components/ExportVsecModal.jsx'
import DownloadConfirmModal from '../components/DownloadConfirmModal.jsx'
import SpotlightCard from '../components/SpotlightCard.jsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MyVideos() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [player, setPlayer] = useState(null) // { video, url }
  const [sharingVideo, setSharingVideo] = useState(null)
  const [exportingVideo, setExportingVideo] = useState(null)
  const [confirmDownloadVideo, setConfirmDownloadVideo] = useState(null)
  const [clientIP, setClientIP] = useState('127.0.0.1')
  const user = getUser()

  function refresh() {
    setLoading(true)
    api
      .listVideos()
      .then(setVideos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    api.getClientInfo().then((data) => {
      if (data?.ip) setClientIP(data.ip)
    })
  }

  useEffect(refresh, [])

  // Make sure any blob: URL we created for the player is released.
  useEffect(() => {
    return () => {
      if (player?.url) window.URL.revokeObjectURL(player.url)
    }
  }, [player])

  function isBusy(id, action) {
    return busyId === id && busyAction === action
  }

  async function run(video, action, fn) {
    setBusyId(video.id)
    setBusyAction(action)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
      setBusyAction('')
    }
  }

  function handleView(video) {
    run(video, 'view', async () => {
      const url = await api.viewVideo(video.id)
      setPlayer({ video, url })
    })
  }

  function closePlayer() {
    if (player?.url) window.URL.revokeObjectURL(player.url)
    setPlayer(null)
  }

  function handleDownload(video) {
    setConfirmDownloadVideo(video)
  }

  function handleDelete(video) {
    if (!confirm(`Permanently delete "${video.original_filename}"?`)) return
    run(video, 'delete', async () => {
      await api.deleteVideo(video.id)
      setVideos((prev) => prev.filter((v) => v.id !== video.id))
    })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My Videos</h1>
          <p className="muted">
            Stored encrypted with AES-256. <strong>View</strong> decrypts temporarily into browser
            memory with dynamic forensic watermarks — files on disk remain strictly encrypted.
          </p>
        </div>
        <div className="quick-actions" style={{ marginTop: 0 }}>
          <Link to="/upload" className="btn btn-primary">
            + Encrypt a Video
          </Link>
          <Link to="/shared-with-me?tab=my-shares" className="btn btn-secondary">
            🔗 Manage Active Shares
          </Link>
          <Link to="/shared-with-me?tab=received" className="btn btn-secondary">
            🤝 Received Videos
          </Link>
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginTop: '16px' }}>{error}</div>}

      {loading && (
        <div className="loading-state">
          <span className="spinner" /> Loading your videos…
        </div>
      )}

      {!loading && videos.length === 0 && (
        <SpotlightCard className="empty-state">
          <div className="empty-icon">🎬</div>
          <p>No videos yet.</p>
          <Link to="/upload" className="btn btn-primary">
            Upload your first video
          </Link>
        </SpotlightCard>
      )}

      {!loading && videos.length > 0 && (
        <div className="video-grid">
          {videos.map((v) => (
            <SpotlightCard className="video-card" key={v.id}>
              <div className="video-thumb">
                <span className="video-thumb-icon">🎞️</span>
                <span className="badge badge-encrypted">🔒 AES-256 Encrypted</span>
              </div>

              <div className="video-info">
                <h3 title={v.original_filename}>{v.original_filename}</h3>
                <div className="video-meta">
                  <span>{formatBytes(v.size_bytes)}</span>
                  <span className="dot">•</span>
                  <span>{formatDate(v.uploaded_at)}</span>
                </div>
              </div>

              <div className="video-actions">
                <button
                  className="btn btn-small btn-primary"
                  disabled={busyId === v.id}
                  onClick={() => handleView(v)}
                >
                  {isBusy(v.id, 'view') ? <span className="spinner spinner-small" /> : '▶ View'}
                </button>
                <button
                  className="btn btn-small btn-secondary"
                  disabled={busyId === v.id}
                  onClick={() => setSharingVideo(v)}
                  title="Share with another user or generate a PIN-protected link"
                >
                  🔗 Share
                </button>
                <button
                  className="btn btn-small btn-secondary"
                  disabled={busyId === v.id}
                  onClick={() => setExportingVideo(v)}
                  title="Export as a portable .vsec container encrypted with a custom PIN"
                >
                  📦 .vsec Export
                </button>
                <button
                  className="btn btn-small btn-secondary"
                  disabled={busyId === v.id}
                  onClick={() => handleDownload(v)}
                >
                  {isBusy(v.id, 'download') ? '…' : '⬇ Download'}
                </button>
                <button
                  className="btn btn-small btn-danger"
                  style={{ gridColumn: 'span 2' }}
                  disabled={busyId === v.id}
                  onClick={() => handleDelete(v)}
                >
                  {isBusy(v.id, 'delete') ? '…' : 'Delete Video'}
                </button>
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}

      {/* Forensic Watermarked Player Modal */}
      {player && (
        <WatermarkedVideoPlayer
          src={player.url}
          title={player.video.original_filename}
          viewerName={user?.username || 'Owner'}
          viewerIP={clientIP}
          timestamp={new Date().toISOString()}
          onClose={closePlayer}
        />
      )}

      {/* Share Modal */}
      {sharingVideo && (
        <ShareModal
          video={sharingVideo}
          onClose={() => setSharingVideo(null)}
        />
      )}

      {/* Export .vsec Container Modal */}
      {exportingVideo && (
        <ExportVsecModal
          video={exportingVideo}
          onClose={() => setExportingVideo(null)}
        />
      )}

      {/* Step-Up Download Authorization Modal */}
      {confirmDownloadVideo && (
        <DownloadConfirmModal
          video={confirmDownloadVideo}
          onConfirm={(pwd) =>
            run(confirmDownloadVideo, 'download', () =>
              api.downloadVideo(
                confirmDownloadVideo.id,
                confirmDownloadVideo.original_filename,
                pwd
              )
            )
          }
          onClose={() => setConfirmDownloadVideo(null)}
        />
      )}
    </div>
  )
}
