import { useState, useEffect } from 'react'
import { api, getUser } from '../api'
import WatermarkedVideoPlayer from '../components/WatermarkedVideoPlayer.jsx'

export default function OfflineDecrypt() {
  const [file, setFile] = useState(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [player, setPlayer] = useState(null)
  const [clientIP, setClientIP] = useState('127.0.0.1')
  const user = getUser()

  useEffect(() => {
    api.getClientInfo().then((data) => {
      if (data?.ip) setClientIP(data.ip)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (player?.url) window.URL.revokeObjectURL(player.url)
    }
  }, [player])

  async function handleUnlock(action = 'stream') {
    if (!file) {
      setError('Please select a .vsec container file.')
      return
    }
    if (!pin) {
      setError('Please enter the security PIN.')
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const result = await api.unlockVsec(file, pin, action)
      if (action === 'download') {
        setSuccess(`Successfully decrypted and downloaded "${result.filename}"!`)
      } else {
        setPlayer({
          url: result.url,
          title: file.name.replace(/\.vsec$/i, '.mp4'),
          forensicIP: result.forensicIP || clientIP,
          forensicTimestamp: result.forensicTimestamp,
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFileSelection(selectedFile) {
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.vsec')) {
      setFile(null)
      setError('Choose a .vsec portable container file.')
      setSuccess('')
      return
    }
    setFile(selectedFile)
    setError('')
    setSuccess('')
  }

  function handleFileDrop(event) {
    event.preventDefault()
    handleFileSelection(event.dataTransfer.files[0] || null)
  }

  return (
    <div className="page offline-decrypt-page">
      <div className="offline-page-heading">
        <div className="offline-page-kicker"><span className="offline-live-dot" /> SECURE CONTAINER ACCESS</div>
        <h1>Unlock <span className="offline-title-accent">.vsec</span> Portable Container</h1>
        <p className="muted">
        Received an encrypted <strong>.vsec</strong> file from a friend? Upload it here, enter the
        secret PIN, and watch or download the decrypted video.
        </p>
      </div>

      <div className="offline-decrypt-layout">
        <form className="card offline-decrypt-card" onSubmit={(event) => event.preventDefault()}>
          <div className="offline-card-heading">
            <span className="offline-step-mark">01</span>
            <div>
              <h2>Container details</h2>
              <p>Select the encrypted package and enter its PIN.</p>
            </div>
            <span className="offline-lock-badge">PIN PROTECTED</span>
          </div>

          {error && <div className="alert-error" role="alert">{error}</div>}
          {success && <div className="alert-success" role="status">{success}</div>}

          <label className="offline-field-label" htmlFor="offline-container-file">Encrypted package</label>
          <label
            className={`offline-file-picker ${file ? 'has-file' : ''}`}
            htmlFor="offline-container-file"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleFileDrop}
          >
            <input
              id="offline-container-file"
              className="offline-file-input"
              type="file"
              accept=".vsec"
              onChange={(event) => handleFileSelection(event.target.files[0] || null)}
            />
            <span className="offline-file-icon" aria-hidden="true">↥</span>
            <span className="offline-file-copy">
              <strong>{file ? file.name : 'Choose a .vsec file'}</strong>
              <span>{file ? 'Package ready to unlock' : 'Browse or drag your encrypted package here'}</span>
            </span>
            <span className="offline-browse-button">Browse files</span>
          </label>

          <div className="offline-pin-heading">
            <label className="offline-field-label" htmlFor="offline-security-pin">Security PIN</label>
            <span>Provided by the sender</span>
          </div>
          <input
            id="offline-security-pin"
            className="offline-pin-input"
            type="password"
            placeholder="Enter the sender's PIN"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoComplete="off"
            required
          />

          <div className="offline-crypto-tags" aria-label="Security standards">
            <span>AES-256</span>
            <span>PBKDF2</span>
            <span>SHA-256 verified</span>
          </div>

          <div className="quick-actions offline-decrypt-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!file || !pin || loading}
              onClick={() => handleUnlock('stream')}
            >
              {loading ? 'Decrypting…' : '▶ Unlock & Watch'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!file || !pin || loading}
              onClick={() => handleUnlock('download')}
            >
              ⬇️ Decrypt & Download
            </button>
          </div>
        </form>

        <section className="card offline-info-card">
          <div className="offline-info-heading">
            <span aria-hidden="true">◈</span>
            <div>
              <h2>How portable containers work</h2>
              <p>Your video stays encrypted until the PIN is verified.</p>
            </div>
          </div>
          <ol className="offline-security-steps">
            <li><span>01</span><p>The sender locks the container with a custom PIN.</p></li>
            <li><span>02</span><p>PBKDF2 runs 100,000 rounds to derive the decryption key.</p></li>
            <li><span>03</span><p>A SHA-256 checksum verifies the decrypted video.</p></li>
          </ol>
        </section>
      </div>

      {player && (
        <WatermarkedVideoPlayer
          src={player.url}
          title={player.title}
          viewerName={user?.username || 'Guest (Offline Decrypt)'}
          viewerIP={player.forensicIP}
          timestamp={player.forensicTimestamp}
          onClose={() => setPlayer(null)}
        />
      )}
    </div>
  )
}
