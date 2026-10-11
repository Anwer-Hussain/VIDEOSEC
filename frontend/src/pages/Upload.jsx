import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const navigate = useNavigate()

  function handleFileChange(e) {
    setSuccess(null)
    setError('')
    setFile(e.target.files[0] || null)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setError('')
    setSuccess(null)
    setUploading(true)
    setProgress(0)

    try {
      const result = await api.uploadVideo(file, setProgress)
      setSuccess(result)
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="page">
      <h1>Encrypt a Video</h1>
      <p className="muted">
        Select a video to upload. It is encrypted with a unique AES-256 key the
        moment it reaches the server — the original file is never stored in
        plaintext.
      </p>

      <form className="card" onSubmit={handleUpload}>
        {error && <div className="alert-error">{error}</div>}
        {success && (
          <div className="alert-success">
            "{success.original_filename}" encrypted and stored successfully.
          </div>
        )}

        <label>Video file</label>
        <input
          type="file"
          accept="video/mp4,video/x-msvideo,video/quicktime,video/x-matroska,video/webm"
          onChange={handleFileChange}
        />

        {uploading && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <span className="progress-label">{progress}%</span>
          </div>
        )}

        <div className="quick-actions">
          <button className="btn btn-primary" disabled={!file || uploading}>
            {uploading ? 'Encrypting & uploading...' : 'Encrypt & Upload'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/my-videos')}
          >
            Go to My Videos
          </button>
        </div>
      </form>

      <div className="card info-card">
        <h2>How the encryption works</h2>
        <ol>
          <li>A random 256-bit AES key + IV is generated for this video only.</li>
          <li>The video bytes are encrypted (AES-256-CBC) before touching disk.</li>
          <li>The data key is itself wrapped with a server master key and stored encrypted.</li>
          <li>Only ciphertext is written to storage — never the plaintext video.</li>
        </ol>
      </div>
    </div>
  )
}
