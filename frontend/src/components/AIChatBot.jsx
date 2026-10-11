import { useState, useRef, useEffect } from 'react'

const SUGGESTIONS = [
  '🔐 How do I encrypt a video?',
  '🔓 How does offline (.vsec) decryption work?',
  '🔗 How do I share videos securely?',
  '👁️ What does the eye icon in password do?',
  '🎈 Why does the welcome card float?',
  '🎨 How do I switch themes & custom colors?',
  '🛡️ How does two-factor verification (MFA) work?',
  '📁 What video formats are supported?',
]

function getAIResponse(rawQuery) {
  const query = rawQuery.toLowerCase().trim()

  // 1. Greetings & Identity
  if (/^(hi|hello|hey|greetings|who are you|what can you do|help me|howdy)/.test(query)) {
    return `👋 **Hello! I am your VIDEOSEC AI Assistant.**

I'm here to clear any doubt about our web-based secure video vault. You can ask me about:
• **Encrypting & Uploading:** How AES-256-GCM protects your videos
• **Offline Decryption:** Unlocking \`.vsec\` files without internet
• **Secure Sharing:** Generating expiring links & passcodes
• **Theme Engine:** Choosing from our 10 cyber neon palettes
• **Password Features:** The eye visibility toggle & security
• **Device MFA:** How two-factor authentication keeps your vault safe

Feel free to click any suggestion above or type your question below!`
  }

  // 2. Encryption & Uploading
  if (/encrypt|upload|how to upload|passphrase|aes|cipher|algorithm|security|zero.?knowledge/.test(query)) {
    return `🔐 **How Video Encryption Works in VIDEOSEC:**

1. **Navigate:** Click **"Encrypt Video"** in the top navigation bar.
2. **Choose File:** Drag & drop your video file (supports \`.mp4\`, \`.webm\`, \`.mov\`, \`.mkv\`, \`.avi\` up to 500MB).
3. **Set Title:** Enter a clear name for your video.
4. **Passphrase (Optional):** You can add a custom decryption passphrase for double-layer protection.
5. **Encrypt & Upload:** Click the green **"Encrypt & Upload"** button.

🛡️ **Under the Hood:**
Your file is encrypted with **AES-256-GCM** (Galois/Counter Mode), generating a 256-bit key, unique initialization vector (IV), and authentication tag. Plaintext video is **never** stored unencrypted on the server!`
  }

  // 3. Offline Decryption & .vsec files
  if (/offline|vsec|\.vsec|without internet|download|unlock/i.test(query)) {
    return `🔓 **Offline Decryption & .vsec Files:**

**What is a .vsec file?**
A \`.vsec\` file is a standalone encrypted binary container holding your video ciphertext, salt, IV, and cryptographic tag.

**How to Decrypt Completely Offline:**
1. Download the \`.vsec\` file from your **"My Videos"** page.
2. In the navigation bar, click **"Unlock .vsec"** (available even before logging in!).
3. Drag & drop your \`.vsec\` file into the decryption box.
4. Enter your account password (and custom passphrase if you created one).
5. Click **"Decrypt & Play Offline"**.

🌐 **Zero Internet Required:** The decryption is performed directly inside your browser memory using the Web Crypto API. The server does not need to be running, and you can be totally disconnected from the internet!`
  }

  // 4. Sharing Videos
  if (/share|sharing|public link|send to|expiry|expiration|passcode/.test(query)) {
    return `🔗 **How Secure Video Sharing Works:**

You have two powerful options to share encrypted videos:

1. **Direct User Sharing:**
   • Click **"Share"** on any video card in *My Videos*.
   • Enter the recipient's registered username.
   • It will immediately appear under their **"Shared Videos"** tab!

2. **Encrypted Public Share Links:**
   • Select **"Generate Public Link"**.
   • **Expiry Time:** Choose when the link expires (**1 Hour**, **24 Hours**, or **7 Days**).
   • **Optional Passcode:** Protect the link with a unique access password.
   • Share the link with anyone. When they open it, they can stream the video securely until the link expires.`
  }

  // 5. Eye Icon in Password
  if (/eye|icon|eye icon|see password|show password|hide password|peek|password view/.test(query)) {
    return `👁️ **Password Visibility Eye Icon:**

On both the **Login** and **Register** pages, the password input features an integrated eye toggle button on the right side:

• **Closed / Standard Eye (👁️):** Password characters are concealed as security dots (\`••••••••\`).
• **Slashed Eye (🙈):** Clicking it reveals your plaintext password so you can check for typos before submitting.
• **Privacy Safe:** Clicking it again immediately conceals the password.
• Typed text will never collide with or slide under the eye icon.`
  }

  // 6. Floating Welcome Card & Hover-Pause
  if (/float|floating|welcome card|hover|stop moving|moving|pause|shake|bobbing/.test(query)) {
    return `🎈 **Floating Welcome Card with Hover-Pause:**

**Why does it float?**
The "Welcome back" card floats gently in zero-gravity space with a smooth 5-second ease cycle to give VIDEOSEC a futuristic, living cyber aesthetic.

**How does hover-pause work?**
Whenever you **move your mouse cursor over the card**, the animation automatically freezes in place (\`animation-play-state: paused\`). This ensures 100% stability so you can click inputs, type passwords, and submit without any motion!`
  }

  // 7. Themes & Custom Colors
  if (/theme|themes|color|colors|palette|obsidian|emerald|sakura|blood moon|gold|acid|aurora|customization/.test(query)) {
    return `🎨 **Dynamic Theme Engine & Laser Spotlight:**

VIDEOSEC features **10 handcrafted cyber themes**:
1. 🌌 **Obsidian Stealth (Default):** Onyx black + Electric Cyan & Hyper Indigo laser
2. 🟢 **Emerald Matrix:** Cyber Vault + Mint & Jade Emerald laser
3. 🟣 **Cosmic Amethyst:** Neon Galaxy + Radiant Fuchsia & Violet laser
4. 🌊 **Midnight Sapphire:** Abyssal Navy + Arctic Ice & Royal Cobalt laser
5. 🌅 **Sunset Amber:** Solar Flare + Amber Gold laser
6. 🌸 **Cyber Sakura:** Neo Tokyo + Electric Pink & Holo Cyan laser
7. 🩸 **Blood Moon:** Hyper Crimson + Molten Ruby Ember laser
8. 👑 **Sovereign Gold:** Royal Vault + Imperial Gold & Champagne laser
9. 🧪 **Acid Overdrive:** Cyberpunk + Radioactive Lime & Neon Emerald laser
10. ❄️ **Glacial Aurora:** Boreal Deep + Glacial Teal & Mystic Violet laser

**How to change themes:**
Click the **"🎨 Theme"** button in the top navigation bar. Your selection is saved to browser storage and updates the interactive laser cursor spotlight!`
  }

  // 8. Device MFA & Verification Codes
  if (/mfa|otp|2fa|verification|code|email|device|trust|demo mode|6-digit/.test(query)) {
    return `🛡️ **Two-Factor Device Verification (MFA):**

**How it protects you:**
When you log in from an unrecognized browser or computer, VIDEOSEC generates a secure **6-digit verification code** sent to your email.

⚡ **Demo Mode Support:**
If SMTP email is not configured in the \`.env\`, VIDEOSEC shows an on-screen cyan demo card displaying your code with an **"Auto-Fill Code"** button for quick testing!

**Trusting your device:**
Check *"Trust this browser"* to save your device signature so you won't need an OTP on your next login from this machine.`
  }

  // 9. Profile Photo & Customization
  if (/profile|avatar|photo|picture|camera|image|change photo/.test(query)) {
    return `📷 **Custom Profile Picture Upload:**

1. Log in and look at the top-right corner of the navigation bar.
2. Click your username (**"Hi, [username]"**) to open your profile popup.
3. Click the **avatar circle** (or click the **"📷 Choose Photo"** pill button).
4. Select any image from your computer (PNG, JPG, WebP).
5. VIDEOSEC automatically crops, resizes, and saves your photo to your browser profile!`
  }

  // 10. Supported Formats & Limits
  if (/format|formats|file size|size limit|mp4|mov|mkv|webm|avi|limit|upload size/.test(query)) {
    return `📁 **Supported Video Formats & Limits:**

• **Supported Video File Extensions:**
  \`MP4\` (\`.mp4\`), \`WebM\` (\`.webm\`), \`QuickTime\` (\`.mov\`), \`Matroska\` (\`.mkv\`), \`AVI\` (\`.avi\`)
• **File Size Limit:** Up to **500 MB** per video upload.
• **Playback:** Decrypted video streams are rendered via HTML5 video with full playback controls (play, pause, scrub, fullscreen, volume).`
  }

  // 11. Fallback Smart Response
  return `🤖 **VIDEOSEC AI Assistant:**

I understand you're asking about **"${rawQuery}"**. Here is a quick guide to how VIDEOSEC works:

• **To Encrypt a Video:** Go to *"Encrypt Video"* in the navbar, choose a file (\`.mp4\`, \`.mov\`, \`.webm\`, etc.), and click Upload.
• **To Decrypt Offline:** Click *"Unlock .vsec"* to decrypt downloaded files locally with zero internet required.
• **To Share Videos:** Click *"Share"* on any video in *My Videos* to generate expiring public links or share with other users.
• **To Switch Themes:** Click *"🎨 Theme"* in the top navigation bar to pick between 10 cyber neon palettes.
• **Password Eye Icon:** Click the \`👁️\` icon in the password field to toggle masked dots and visible text.
• **Hover to Pause Card:** Hover your cursor over the floating login card to freeze it for comfortable typing.

💡 *Try clicking one of the suggested questions above for specific step-by-step guidance!*`
}

export default function AIChatBot() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: `👋 **Welcome to the VIDEOSEC AI Security Assistant!**

I can clear any doubt about our web-based video vault, cryptography, file sharing, offline decryption, themes, or UI features.

Click a question below or ask me anything!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function handleSend(queryText) {
    const textToSend = queryText || inputValue.trim()
    if (!textToSend) return

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Simulate natural AI thinking delay
    setTimeout(() => {
      const responseText = getAIResponse(textToSend)
      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: responseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, aiMessage])
      setIsTyping(false)
    }, 450)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleClearChat() {
    setMessages([
      {
        id: Date.now(),
        sender: 'ai',
        text: `Chat cleared! Ask me anything about VIDEOSEC or click a suggestion below.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  // Format message text with markdown-like bold, code tags, and bullets
  function renderFormattedText(text) {
    const lines = text.split('\n')
    return lines.map((line, lineIdx) => {
      // Bullet items
      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-')
      // Render line with bold **word** and code `code`
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g)

      return (
        <div
          key={lineIdx}
          style={{
            minHeight: line.trim() === '' ? '8px' : 'auto',
            marginBottom: '3px',
            paddingLeft: isBullet ? '8px' : '0',
          }}
        >
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={partIdx} style={{ color: 'var(--text)', fontWeight: 700 }}>
                  {part.slice(2, -2)}
                </strong>
              )
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code
                  key={partIdx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--primary)',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    fontSize: '0.84rem',
                  }}
                >
                  {part.slice(1, -1)}
                </code>
              )
            }
            return <span key={partIdx}>{part}</span>
          })}
        </div>
      )
    })
  }

  return (
    <div className="ai-chatbot-container">
      {/* Chat header bar */}
      <div className="ai-chat-topbar">
        <div className="ai-chat-status">
          <span className="ai-live-indicator" />
          <div>
            <div className="ai-chat-botname">VIDEOSEC Cyber AI</div>
            <div className="ai-chat-botsub">Interactive Vault Knowledge Base • Online</div>
          </div>
        </div>
        <button
          type="button"
          className="btn-ai-clear"
          onClick={handleClearChat}
          title="Reset conversation"
        >
          🗑️ Clear Chat
        </button>
      </div>

      {/* Suggested Questions Carousel/Chips */}
      <div className="ai-suggestions-bar">
        <span className="ai-suggestions-label">💡 Quick Doubts:</span>
        <div className="ai-chips-scroll">
          {SUGGESTIONS.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              className="ai-suggestion-chip"
              onClick={() => handleSend(sug)}
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Message Stream */}
      <div className="ai-messages-stream">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ai-message-row ${msg.sender === 'user' ? 'user-row' : 'ai-row'}`}
          >
            {msg.sender === 'ai' && (
              <div className="ai-avatar-icon" title="VIDEOSEC AI">
                🤖
              </div>
            )}

            <div className={`ai-message-bubble ${msg.sender === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
              <div className="ai-message-text">{renderFormattedText(msg.text)}</div>
              <div className="ai-message-time">{msg.time}</div>
            </div>

            {msg.sender === 'user' && (
              <div className="user-avatar-icon" title="You">
                👤
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="ai-message-row ai-row">
            <div className="ai-avatar-icon">🤖</div>
            <div className="ai-message-bubble ai-bubble ai-typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '6px' }}>
                Analyzing vault knowledge...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="ai-chat-input-bar">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask any doubt about VIDEOSEC (e.g. How do I decrypt offline?)..."
          className="ai-chat-input"
          autoFocus
        />
        <button
          type="button"
          className="btn btn-primary btn-ai-send"
          onClick={() => handleSend()}
          disabled={!inputValue.trim() || isTyping}
          title="Send query"
        >
          <span>Send</span>
          <span style={{ fontSize: '1rem' }}>➔</span>
        </button>
      </div>
    </div>
  )
}
