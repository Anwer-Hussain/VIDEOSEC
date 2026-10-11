import { useEffect, useState } from 'react'
import { api, getOrCreateDeviceId } from '../api'

function formatDate(iso) {
  if (!iso) return 'Just now'
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SecurityModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('devices') // 'devices' | 'logs'
  const [devices, setDevices] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revokingId, setRevokingId] = useState(null)
  const currentDeviceId = getOrCreateDeviceId()

  function loadData() {
    setLoading(true)
    setError('')
    Promise.all([api.listDevices(), api.getSecurityLogs()])
      .then(([devs, lg]) => {
        setDevices(devs || [])
        setLogs(lg || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadData, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleRevoke(deviceId) {
    if (!confirm('Are you sure you want to revoke trust for this device? It will be challenged with an OTP on next login.')) {
      return
    }
    setRevokingId(deviceId)
    try {
      await api.revokeDevice(deviceId)
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId && d.id !== deviceId))
    } catch (err) {
      setError(err.message)
    } finally {
      setRevokingId(null)
    }
  }

  function renderEventBadge(eventType) {
    switch (eventType) {
      case 'login_success':
        return <span className="badge" style={{ background: 'rgba(45, 212, 167, 0.2)', color: '#2dd4a7' }}>Login Success</span>
      case 'login_mfa_success':
        return <span className="badge" style={{ background: 'rgba(34, 211, 238, 0.2)', color: '#22d3ee' }}>OTP Verified</span>
      case 'login_mfa_challenge':
        return <span className="badge" style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' }}>New Device OTP</span>
      case 'video_downloaded':
        return <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>Video Downloaded</span>
      case 'video_viewed':
        return <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8' }}>Video Viewed</span>
      case 'download_blocked':
      case 'login_failed':
      case 'otp_failed':
        return <span className="badge" style={{ background: 'rgba(255, 107, 129, 0.2)', color: '#ff6b81' }}>Blocked / Failed</span>
      default:
        return <span className="badge">{eventType}</span>
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🛡️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Account Security & Audit</h2>
              <div className="muted" style={{ fontSize: '0.82rem' }}>
                Trusted Devices • Access Logs • Threat Detection
              </div>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '16px', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`btn btn-small ${activeTab === 'devices' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('devices')}
          >
            💻 Trusted Devices ({devices.length})
          </button>
          <button
            type="button"
            className={`btn btn-small ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('logs')}
          >
            📋 Security Audit Log
          </button>
        </div>

        {loading && (
          <div className="loading-state" style={{ padding: '24px 0' }}>
            <span className="spinner" /> Loading security data…
          </div>
        )}

        {!loading && activeTab === 'devices' && (
          <div>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
              These browsers are authorized to log into your account without requiring an Email OTP code.
              If you do not recognize a device, revoke it immediately.
            </p>

            {devices.length === 0 ? (
              <div className="muted center" style={{ padding: '20px' }}>
                No registered trusted devices yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
                {devices.map((d) => {
                  const isCurrent = d.device_id === currentDeviceId
                  return (
                    <div
                      key={d.id}
                      style={{
                        background: isCurrent ? 'rgba(139, 92, 246, 0.08)' : 'var(--surface-2)',
                        border: isCurrent ? '1px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.device_name}</span>
                          {isCurrent && (
                            <span className="badge" style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.72rem' }}>
                              This Browser
                            </span>
                          )}
                        </div>
                        <div className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                          IP: {d.ip_address || '127.0.0.1'} • Last active: {formatDate(d.last_used_at)}
                        </div>
                      </div>

                      <button
                        className="btn btn-small btn-danger"
                        disabled={revokingId === d.device_id}
                        onClick={() => handleRevoke(d.device_id)}
                      >
                        {revokingId === d.device_id ? '…' : 'Revoke'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'logs' && (
          <div>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
              Real-time audit records of logins, OTP challenges, and decrypted video downloads.
            </p>

            {logs.length === 0 ? (
              <div className="muted center" style={{ padding: '20px' }}>
                No security log events recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {logs.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {renderEventBadge(item.event_type)}
                        <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{formatDate(item.created_at)}</span>
                      </div>
                      <span className="muted" style={{ fontSize: '0.78rem' }}>IP: {item.ip_address || '127.0.0.1'}</span>
                    </div>
                    {item.details && <div style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{item.details}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
