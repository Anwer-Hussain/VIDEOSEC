import { useEffect, useState } from 'react'
import { api } from '../api'
import ShareFileModal from '../components/ShareFileModal.jsx'

const ACCEPTED_TYPES = '.bmp,.csv,.doc,.docx,.gif,.heic,.jpeg,.jpg,.md,.odt,.pdf,.png,.ppt,.pptx,.rtf,.svg,.tif,.tiff,.txt,.webp,.xls,.xlsx'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getFileExtension(filename) {
  return filename.split('.').pop()?.toUpperCase() || 'FILE'
}

export default function Files() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [confirmingFile, setConfirmingFile] = useState(null)
  const [sharingFile, setSharingFile] = useState(null)
  const [downloadPassword, setDownloadPassword] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function refreshFiles() {
    try {
      setFiles(await api.listEncryptedFiles())
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refreshFiles()
  }, [])

  function chooseFile(file) {
    if (!file) return
    setSelectedFile(file)
    setError('')
    setSuccess('')
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    chooseFile(event.dataTransfer.files[0])
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!selectedFile) return
    const uploadForm = event.currentTarget

    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const result = await api.uploadEncryptedFile(selectedFile)
      setSuccess(`${result.original_filename} was encrypted and stored securely.`)
      setSelectedFile(null)
      uploadForm.reset()
      await refreshFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(event) {
    event.preventDefault()
    if (!confirmingFile || !downloadPassword) return

    setBusyId(confirmingFile.id)
    setError('')
    try {
      await api.downloadEncryptedFile(
        confirmingFile.id,
        confirmingFile.original_filename,
        downloadPassword,
      )
      setConfirmingFile(null)
      setDownloadPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(file) {
    if (!confirm(`Permanently delete "${file.original_filename}"?`)) return

    setBusyId(file.id)
    setError('')
    setSuccess('')
    try {
      await api.deleteEncryptedFile(file.id)
      setFiles((current) => current.filter((item) => item.id !== file.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page files-page">
      <div className="page-head files-page-head">
        <div>
          <div className="files-eyebrow"><span /> ENCRYPTED FILE VAULT</div>
          <h1>Protect images &amp; documents</h1>
          <p className="muted">
            Encrypt private files with a unique AES-256 key. Video encryption remains in its own module.
          </p>
        </div>
        <div className="files-count" aria-live="polite">
          <strong>{files.length}</strong>
          <span>protected {files.length === 1 ? 'file' : 'files'}</span>
        </div>
      </div>

      {error && <div className="alert-error files-alert" role="alert">{error}</div>}
      {success && <div className="alert-success files-alert" role="status">{success}</div>}

      <div className="files-layout">
        <form className="card files-upload-panel" onSubmit={handleUpload}>
          <div className="files-panel-heading">
            <span className="files-step">01</span>
            <div>
              <h2>Encrypt a file</h2>
              <p>Images and common office or text documents, up to 100 MB.</p>
            </div>
          </div>

          <label
            className={`files-dropzone ${dragging ? 'is-dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
            htmlFor="encrypted-file-input"
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              id="encrypted-file-input"
              className="files-native-input"
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={(event) => chooseFile(event.target.files[0])}
            />
            <span className="files-drop-icon" aria-hidden="true">⇧</span>
            <span className="files-drop-copy">
              <strong>{selectedFile ? selectedFile.name : 'Choose an image or document'}</strong>
              <span>{selectedFile ? formatBytes(selectedFile.size) : 'Browse or drag a file here'}</span>
            </span>
            <span className="files-browse-button">Browse files</span>
          </label>

          <div className="files-upload-footer">
            <span>Accepted formats: PDF, DOCX, XLSX, PNG, JPG, SVG and more</span>
            <button className="btn btn-primary" type="submit" disabled={!selectedFile || uploading}>
              {uploading ? 'Encrypting…' : 'Encrypt & Store'}
            </button>
          </div>
        </form>

        <section className="card files-library-panel" aria-labelledby="files-library-title">
          <div className="files-panel-heading files-library-heading">
            <span className="files-step">02</span>
            <div>
              <h2 id="files-library-title">Protected files</h2>
              <p>Encrypted copies stay in your private vault.</p>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="files-empty-state">
              <span aria-hidden="true">▧</span>
              <strong>No protected files yet</strong>
              <p>Your encrypted images and documents will appear here.</p>
            </div>
          ) : (
            <div className="files-list">
              {files.map((file) => (
                <article className="encrypted-file-row" key={file.id}>
                  <span className="encrypted-file-type">{getFileExtension(file.original_filename)}</span>
                  <div className="encrypted-file-details">
                    <strong title={file.original_filename}>{file.original_filename}</strong>
                    <span>{formatBytes(file.size_bytes)} <i>•</i> {formatDate(file.uploaded_at)}</span>
                  </div>
                  <div className="encrypted-file-actions">
                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      disabled={busyId === file.id}
                      onClick={() => setSharingFile(file)}
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      disabled={busyId === file.id}
                      onClick={() => {
                        setConfirmingFile(file)
                        setDownloadPassword('')
                      }}
                    >
                      Decrypt &amp; Download
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      disabled={busyId === file.id}
                      onClick={() => handleDelete(file)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {confirmingFile && (
        <div className="modal-backdrop" onClick={() => setConfirmingFile(null)}>
          <div
            className="modal-card files-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="files-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="files-confirm-heading">
              <span aria-hidden="true">🔐</span>
              <div>
                <h2 id="files-confirm-title">Decrypt &amp; download</h2>
                <p>Enter the same password you use to sign in to VIDEOSEC.</p>
              </div>
            </div>
            <div className="files-confirm-filename">{confirmingFile.original_filename}</div>
            <p className="files-password-note">
              No separate file password was set. Your account password authorizes secure decryption.
            </p>
            {error && <div className="alert-error" role="alert">{error}</div>}
            <form onSubmit={handleDownload}>
              <label htmlFor="files-download-password">VIDEOSEC account password</label>
              <input
                id="files-download-password"
                type="password"
                value={downloadPassword}
                onChange={(event) => setDownloadPassword(event.target.value)}
                placeholder="Your sign-in password"
                autoComplete="current-password"
                autoFocus
                required
              />
              <div className="files-confirm-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmingFile(null)}
                  disabled={busyId === confirmingFile.id}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!downloadPassword || busyId === confirmingFile.id}
                >
                  {busyId === confirmingFile.id ? 'Decrypting…' : 'Verify & Download'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sharingFile && (
        <ShareFileModal file={sharingFile} onClose={() => setSharingFile(null)} />
      )}
    </div>
  )
}
