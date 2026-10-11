import { useEffect, useRef, useState } from 'react'

export default function WatermarkedVideoPlayer({
  src,
  title,
  viewerName = 'Authorized User',
  viewerIP = '127.0.0.1',
  timestamp,
  onClose,
}) {
  const videoRef = useRef(null)
  const [tabBlurred, setTabBlurred] = useState(false)
  const [timeStr, setTimeStr] = useState(
    timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()
  )

  // Update timestamp every minute for live forensic validity
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleString())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  // Anti-Capture Tab Privacy Guard: pause & blur if tab unfocused
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause()
        }
        setTabBlurred(true)
      } else {
        setTabBlurred(false)
      }
    }

    function handleWindowBlur() {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause()
      }
      setTabBlurred(true)
    }

    function handleWindowFocus() {
      setTabBlurred(false)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [])

  // Disable context menu on the video player
  function handleContextMenu(e) {
    e.preventDefault()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-player"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={handleContextMenu}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="badge badge-encrypted">🔒 Decrypted in Memory</span>
            <h3 title={title}>{title}</h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="player-container">
          <video
            ref={videoRef}
            src={src}
            controls
            autoPlay
            controlsList="nodownload"
            className={`video-player ${tabBlurred ? 'video-blurred' : ''}`}
          />

          {/* Dynamic Forensic Watermark Overlay */}
          <div className="watermark-overlay" aria-hidden="true">
            <div className="watermark-badge watermark-top-left">
              <span className="watermark-shield">🛡️</span> CONFIDENTIAL
            </div>
            <div className="watermark-text watermark-floating">
              <span>VIEWER: {viewerName}</span>
              <span className="watermark-dot">•</span>
              <span>IP: {viewerIP}</span>
              <span className="watermark-dot">•</span>
              <span>{timeStr}</span>
            </div>
            <div className="watermark-diagonal-repeater">
              <span>VIDEOSEC PROTECTED • {viewerName} • {viewerIP}</span>
              <span>VIDEOSEC PROTECTED • {viewerName} • {viewerIP}</span>
              <span>VIDEOSEC PROTECTED • {viewerName} • {viewerIP}</span>
            </div>
          </div>

          {/* Tab Privacy Shield */}
          {tabBlurred && (
            <div
              className="privacy-guard-overlay"
              onClick={() => {
                setTabBlurred(false)
                if (videoRef.current) videoRef.current.play()
              }}
            >
              <div className="privacy-guard-card">
                <span className="privacy-guard-icon">👁️‍🗨️</span>
                <h4>Protected Viewing Shield</h4>
                <p>Playback paused while window was unfocused for leak prevention.</p>
                <button className="btn btn-primary btn-small">Click to Resume</button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="modal-note">
            🔓 <strong>Zero-Footprint Streaming:</strong> This video exists solely as an in-memory
            stream. The storage file on the server remains 100% encrypted with AES-256.
          </p>
        </div>
      </div>
    </div>
  )
}
