import React from 'react'

export default function Logo({ size = 'default', showBadge = false, className = '' }) {
  const iconSize = size === 'large' ? 42 : size === 'compact' ? 28 : 34
  const fontSize = size === 'large' ? '1.5rem' : size === 'compact' ? '1.15rem' : '1.32rem'

  return (
    <div
      className={`videosec-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'compact' ? '9px' : '11px',
        textDecoration: 'none',
        userSelect: 'none',
      }}
    >
      <div
        className="videosec-brandmark-wrap"
        style={{
          position: 'relative',
          width: iconSize,
          height: iconSize,
          flexShrink: 0,
        }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="videosec-logo-svg"
        >
          <defs>
            <linearGradient id="vsec-shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary, #00f0ff)" />
              <stop offset="50%" stopColor="var(--primary-hover, #38bdf8)" />
              <stop offset="100%" stopColor="var(--primary-2, #6366f1)" />
            </linearGradient>

            <linearGradient id="vsec-play-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="var(--primary, #00f0ff)" />
              <stop offset="100%" stopColor="var(--primary-2, #6366f1)" />
            </linearGradient>

            <linearGradient id="vsec-glass-bg" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.10)" />
              <stop offset="100%" stopColor="rgba(5, 8, 17, 0.85)" />
            </linearGradient>

            <filter id="vsec-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <path
            d="M20 2.8 35.2 9.4v11.1c0 8-6.2 13.2-15.2 16.5C11 33.7 4.8 28.5 4.8 20.5V9.4L20 2.8Z"
            fill="url(#vsec-glass-bg)"
            stroke="url(#vsec-shield-grad)"
            strokeWidth="1.4"
            strokeLinejoin="round"
            className="vsec-shield-path"
          />
          <path
            d="M8.7 9.8c.1 7 1 16.6 5.2 18.3 2.4 1 4.1-5.1 6.8-12.1C23.2 9 26.1 5.6 32 7.8"
            stroke="url(#vsec-shield-grad)"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M11.4 28.6c4 5.1 8.2 4.7 11.9 2.1l5.4-3.8c3.3-2.3 3.2-6.2-.1-8.7L19 12.2"
            stroke="url(#vsec-shield-grad)"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="m17.3 18.7 8.2 4.7-8.2 4.7v-9.4Z"
            fill="url(#vsec-play-grad)"
            filter="url(#vsec-glow)"
            className="vsec-play-prism"
          />
        </svg>
        <div className="vsec-glow-ambient" />
      </div>

      <div
        className="videosec-wordmark"
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize,
          lineHeight: 1,
        }}
      >
        <span className="vsec-word-video">VIDEO</span>
        <span className="vsec-word-sec">SEC</span>
        {showBadge && (
          <span className="vsec-badge-tag">VAULT</span>
        )}
      </div>
    </div>
  )
}
