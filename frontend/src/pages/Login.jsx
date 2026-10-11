import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { api, saveSession } from '../api'
import Logo from '../components/Logo.jsx'

export default function Login() {
  const [step, setStep] = useState('credentials') // 'credentials' | 'otp'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // OTP state
  const [otp, setOtp] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [devOtp, setDevOtp] = useState('')

  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const wasInactive = new URLSearchParams(location.search).get('reason') === 'inactivity'

  async function handleCredentialsSubmit(e) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const loginUsername = String(formData.get('username') || username).trim()
    const loginPassword = String(formData.get('password') || password)
    setError('')
    setInfoMessage('')
    setLoading(true)

    try {
      const data = await api.login(loginUsername, loginPassword)
      if (data.mfa_required) {
        setTempToken(data.temp_token)
        setMaskedEmail(data.masked_email)
        setDeviceName(data.device_name || 'Current Device')
        if (data.dev_otp) setDevOtp(data.dev_otp)
        setStep('otp')
      } else {
        saveSession(data.token, data.user)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setLoading(true)

    try {
      const data = await api.verifyOtp(tempToken, otp.trim(), trustDevice)
      saveSession(data.token, data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    setError('')
    setInfoMessage('')
    setResending(true)
    try {
      const res = await api.resendOtp(tempToken)
      if (res.dev_otp) setDevOtp(res.dev_otp)
      setInfoMessage(`A fresh 6-digit code was sent to ${res.masked_email || maskedEmail}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  function handleBackToCredentials() {
    setStep('credentials')
    setOtp('')
    setError('')
    setInfoMessage('')
  }

  return (
    <div className="auth-page auth-login-page">
      <div className="auth-login-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <div className="auth-story-eyebrow">
            <span /> PRIVATE VIDEO VAULT
          </div>
          <h2 id="auth-story-title">
            Security built around <span>your videos.</span>
          </h2>
          <p>
            Encrypt, store, and share confidential videos with strong protection at every step.
          </p>
          <div className="auth-story-assurance">
            <span><strong>AES-256</strong> video encryption</span>
            <span><strong>Private</strong> by design</span>
          </div>
        </section>

      {step === 'credentials' ? (
        <form className="card auth-card auth-login-card" onSubmit={handleCredentialsSubmit} autoComplete="on" noValidate>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Logo size="large" showBadge />
          </div>

          <h1>Welcome back</h1>
          <p className="muted">Log in to manage your encrypted videos.</p>

          {wasInactive && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#fbbf24',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.86rem',
                lineHeight: '1.4',
                marginBottom: '14px',
              }}
            >
              ⏱️ <strong>Session Locked:</strong> You were signed out after 10 minutes of inactivity for your security.
            </div>
          )}

          {error && <div className="alert-error">{error}</div>}

          <label htmlFor="videosec-username-field">Username or email</label>
          <div className="input-with-icon">
            <span className="input-leading-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              id="videosec-username-field"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alex"
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <label htmlFor="videosec-password-field">Password</label>
          <div className="input-with-icon password-input-wrap">
            <span className="input-leading-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id="videosec-password-field"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              spellCheck={false}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <button className="btn btn-primary" disabled={loading} style={{ marginTop: '10px' }}>
            {loading ? 'Verifying credentials…' : 'Log In'}
          </button>

          <p className="muted center">
            No account? <Link to="/register">Register</Link>
          </p>
        </form>
      ) : (
        <form className="card auth-card auth-login-card" onSubmit={handleOtpSubmit} autoComplete="off">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Device Verification</h1>
          </div>

          <p className="muted" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            A verification code was dispatched to protect your vault.
            We sent a 6-digit code to <strong>{maskedEmail}</strong>.
          </p>

          {!devOtp ? (
            <div
              style={{
                background: 'rgba(34, 211, 238, 0.07)',
                border: '1px solid rgba(34, 211, 238, 0.28)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ color: '#22d3ee', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                🔒 Two-Factor Challenge Active
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                For your security against unauthorized access, verification is required. Check your email (or check the secure <strong>backend server console</strong> in local development mode).
              </p>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(34, 211, 238, 0.08)',
                border: '1px solid rgba(34, 211, 238, 0.35)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ color: '#22d3ee', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                💡 Demo Mode (Email SMTP not configured in .env)
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                Since SMTP is not yet configured, use this one-time code to authorize this browser:
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '4px', color: '#fff' }}>
                  {devOtp}
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => setOtp(devOtp)}
                >
                  ⚡ Auto-Fill Code
                </button>
              </div>
            </div>
          )}

          {error && <div className="alert-error">{error}</div>}
          {infoMessage && (
            <div
              style={{
                background: 'rgba(45, 212, 167, 0.12)',
                border: '1px solid rgba(45, 212, 167, 0.3)',
                color: '#2dd4a7',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '12px',
              }}
            >
              {infoMessage}
            </div>
          )}

          <label>6-Digit Verification Code</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            autoFocus
            style={{
              fontSize: '1.5rem',
              letterSpacing: '6px',
              textAlign: 'center',
              fontWeight: 700,
            }}
            required
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              marginTop: '12px',
              marginBottom: '16px',
              fontSize: '0.88rem',
              color: 'var(--text)',
            }}
          >
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer' }}
            />
            <span>Trust this browser (skip verification next time)</span>
          </label>

          <button
            className="btn btn-primary"
            disabled={loading || otp.length < 6}
            style={{ width: '100%' }}
          >
            {loading ? 'Verifying Code…' : 'Verify & Access Vault'}
          </button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '18px',
              fontSize: '0.85rem',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              onClick={handleBackToCredentials}
            >
              ← Back
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              disabled={resending}
              onClick={handleResendOtp}
            >
              {resending ? 'Sending…' : 'Resend Code'}
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  )
}
