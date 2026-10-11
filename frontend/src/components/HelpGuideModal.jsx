import { useState, useEffect } from 'react'
import AIChatBot from './AIChatBot.jsx'

export default function HelpGuideModal({ isOpen, onClose, defaultTab = 'how-to-use' }) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab)
  }, [defaultTab])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div
        className="help-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Header */}
        <div className="help-modal-header">
          <div className="help-modal-title-wrap">
            <span className="help-modal-icon">💡</span>
            <div>
              <h2 id="help-modal-title" className="help-modal-title">
                VIDEOSEC User Guide & AI Help Hub
              </h2>
              <p className="help-modal-subtitle">
                Master the end-to-end encrypted video vault & clear any doubts with our AI bot
              </p>
            </div>
          </div>
          <button
            type="button"
            className="help-modal-close"
            onClick={onClose}
            aria-label="Close Guide"
            title="Close Guide (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="help-modal-nav-bar">
          <button
            type="button"
            className={`help-nav-tab ${activeTab === 'how-to-use' ? 'active' : ''}`}
            onClick={() => setActiveTab('how-to-use')}
          >
            <span className="help-tab-icon">📖</span>
            <span className="help-tab-text">How to Use (Step-by-Step)</span>
            {activeTab === 'how-to-use' && <span className="help-tab-indicator" />}
          </button>

          <button
            type="button"
            className={`help-nav-tab ${activeTab === 'help' ? 'active' : ''}`}
            onClick={() => setActiveTab('help')}
          >
            <span className="help-tab-icon">❓</span>
            <span className="help-tab-text">Help & FAQ (New Users)</span>
            {activeTab === 'help' && <span className="help-tab-indicator" />}
          </button>

          <button
            type="button"
            className={`help-nav-tab ${activeTab === 'ai-chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai-chat')}
          >
            <span className="help-tab-icon">🤖</span>
            <span className="help-tab-text">AI Assistant (Ask Doubts)</span>
            <span className="ai-nav-tab-badge">AI</span>
            {activeTab === 'ai-chat' && <span className="help-tab-indicator" />}
          </button>
        </div>

        {/* Content Body */}
        <div className="help-modal-body">
          {activeTab === 'how-to-use' ? (
            <div className="help-guide-section">
              <div className="help-intro-banner">
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <div>
                  <strong>Welcome to VIDEOSEC!</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.84rem', opacity: 0.88, lineHeight: 1.4 }}>
                    This web application provides military-grade <strong>AES-256-GCM</strong> encryption for your personal and confidential video files. Follow this quick walkthrough to get started.
                  </p>
                </div>
              </div>

              <div className="guide-steps-list">
                {/* Step 1 */}
                <div className="guide-step-card">
                  <div className="step-badge">01</div>
                  <div className="step-content">
                    <h3>Create Your Account & Secure Your Vault</h3>
                    <p>
                      Click <strong>Register</strong> to choose your username, email, and a secure password (minimum 8 characters).
                    </p>
                    <div className="step-tip">
                      💡 <strong>Eye Icon (👁️):</strong> Click the eye icon in the password field anytime to double-check what you typed before submitting!
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="guide-step-card">
                  <div className="step-badge">02</div>
                  <div className="step-content">
                    <h3>Two-Factor Device Verification (MFA)</h3>
                    <p>
                      When logging in from a new browser or computer, VIDEOSEC detects your device signature and sends a <strong>6-digit security code</strong> to your registered email.
                    </p>
                    <div className="step-tip">
                      ⚡ <strong>Demo Mode:</strong> If email SMTP is not configured in your environment, an instant cyan helper box will display the one-time code on screen with an <strong>"Auto-Fill Code"</strong> button.
                    </div>
                    <p style={{ marginTop: '8px', fontSize: '0.84rem', color: 'var(--muted)' }}>
                      Check <em>"Trust this browser"</em> so you won't need an OTP on your next login from this machine.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="guide-step-card">
                  <div className="step-badge">03</div>
                  <div className="step-content">
                    <h3>Encrypt & Upload Your First Video</h3>
                    <p>
                      Go to the top navigation bar and select <strong>"Encrypt Video"</strong>:
                    </p>
                    <ul className="step-checklist">
                      <li>Drag & drop your video file (supports <code>.mp4</code>, <code>.webm</code>, <code>.mov</code>, <code>.mkv</code>, <code>.avi</code>).</li>
                      <li>Give your video a descriptive title.</li>
                      <li>(Optional) Add a custom <strong>Decryption Passphrase</strong> for double-layer protection.</li>
                      <li>Click <strong>"Encrypt & Upload"</strong>. The file is encrypted using AES-256-GCM before storage.</li>
                    </ul>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="guide-step-card">
                  <div className="step-badge">04</div>
                  <div className="step-content">
                    <h3>Streaming Decryption & Vault Management</h3>
                    <p>
                      Visit <strong>"My Videos"</strong> to view your collection.
                    </p>
                    <p>
                      Click <strong>"Watch"</strong> on any encrypted video. VIDEOSEC decrypts the video stream on the fly right inside your browser window without writing unencrypted video to your disk.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="guide-step-card">
                  <div className="step-badge">05</div>
                  <div className="step-content">
                    <h3>Secure Sharing with Expiry & Passwords</h3>
                    <p>
                      Want to share a video without exposing your raw master file?
                    </p>
                    <ul className="step-checklist">
                      <li><strong>Direct User Share:</strong> Share directly with another registered username. It appears in their <em>"Shared Videos"</em> tab.</li>
                      <li><strong>Public Share Links:</strong> Generate an encrypted public link with custom expiration (1 hr, 24 hrs, 7 days) and an optional access passcode.</li>
                    </ul>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="guide-step-card">
                  <div className="step-badge">06</div>
                  <div className="step-content">
                    <h3>Offline Decryption (Zero Internet Required)</h3>
                    <p>
                      You can download any encrypted video as a raw <code>.vsec</code> file.
                    </p>
                    <p>
                      Click <strong>"Unlock .vsec"</strong> in the top navigation bar anytime — even if your internet is completely disconnected or the server is turned off! Drop the <code>.vsec</code> file, type your password, and watch it play offline.
                    </p>
                  </div>
                </div>

                {/* Step 7 */}
                <div className="guide-step-card">
                  <div className="step-badge">07</div>
                  <div className="step-content">
                    <h3>Personalize Your Cyber Workspace</h3>
                    <p>
                      Click the <strong>"🎨 Theme"</strong> button in the top navigation bar to choose from <strong>10 handcrafted aesthetics</strong> (Obsidian, Emerald, Cyber Sakura, Blood Moon, Sovereign Gold, Acid Overdrive, and more).
                    </p>
                    <p>
                      Click your profile in the top-right to upload a custom avatar photo directly from your PC!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'faq' ? (
            <div className="help-faq-section">
              <div className="faq-grid">
                <div className="faq-card">
                  <h4>🌟 I am a brand new user. Where should I start?</h4>
                  <p>
                    Click the <strong>Register</strong> button in the top navigation bar. Fill in your username, email, and password. Once registered, head straight to <strong>"Encrypt Video"</strong> to upload and protect your first file!
                  </p>
                </div>

                <div className="faq-card">
                  <h4>👁️ What does the Eye Icon in the password field do?</h4>
                  <p>
                    Clicking the eye icon toggles password visibility. An open eye (👁️) shows your password characters so you can catch typos; a slashed eye (🙈) conceals it back into security dots.
                  </p>
                </div>

                <div className="faq-card">
                  <h4>🎈 Why does the Welcome Card float, and how do I stop it?</h4>
                  <p>
                    The welcome card gently floats in zero-gravity space to match our futuristic cyber theme. Simply <strong>hover your cursor over the card</strong>, and the floating animation automatically freezes in place so you can type and click with 100% stability.
                  </p>
                </div>

                <div className="faq-card">
                  <h4>🛡️ What is a .vsec file?</h4>
                  <p>
                    A <code>.vsec</code> file is a cryptographically secured binary package generated by VIDEOSEC. It contains the AES-256 encrypted payload, initialization vector (IV), and authentication tag. Without the encryption key, it is unreadable gibberish.
                  </p>
                </div>

                <div className="faq-card">
                  <h4>⚡ How do I authorize a new device in Demo Mode?</h4>
                  <p>
                    If email delivery is not configured, VIDEOSEC automatically shows a glowing cyan demo box containing your 6-digit verification code. Click <strong>"⚡ Auto-Fill Code"</strong> to instantly authenticate.
                  </p>
                </div>

                <div className="faq-card">
                  <h4>🎨 Will my selected theme stay active when I reload?</h4>
                  <p>
                    Yes! Your chosen UI theme (e.g. Obsidian, Emerald, Cyber Sakura, Blood Moon, Sovereign Gold) is automatically saved to your browser storage and will persist whenever you return.
                  </p>
                </div>

                <div className="faq-card">
                  <h4>📷 How do I upload or change my profile photo?</h4>
                  <p>
                    When logged in, click your username in the top right corner of the navigation bar. Click on your avatar circle or click <strong>"📷 Choose Photo"</strong> to pick any picture from your PC.
                  </p>
                </div>

                <div className="faq-card">
                  <h4>🔒 Can the server or administrator see my decrypted video?</h4>
                  <p>
                    No. Decryption occurs inside your client browser using Web Crypto. When you play a video, decryption happens in memory without storing plaintext on unauthorized media servers.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AIChatBot />
          )}
        </div>

        {/* Footer */}
        <div className="help-modal-footer">
          <div className="help-footer-status">
            <span className="help-pulse-dot" />
            <span>VIDEOSEC Cryptographic Vault v2.4 • Active</span>
          </div>
          <button type="button" className="btn btn-primary btn-small" onClick={onClose}>
            Got it, Let's Go! →
          </button>
        </div>
      </div>
    </div>
  )
}
