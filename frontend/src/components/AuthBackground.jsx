import { useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext.jsx'

/**
 * AuthBackground
 * Renders an animated high-tech cybersecurity atmosphere with:
 * 1. Deep perspective cyber grid
 * 2. Floating luminous aurora glow orbs
 * 3. Interactive particle constellation canvas with moving dots & neural network connections
 * 4. Ambient scanline beam
 */
export default function AuthBackground() {
  const { currentThemeMeta } = useTheme()
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: -999, y: -999, active: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId
    let width = (canvas.width = canvas.offsetWidth)
    let height = (canvas.height = canvas.offsetHeight)

    // Handle high DPI displays
    function handleResize() {
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth
      height = canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', handleResize)

    // Track mouse coordinates for interactive particle connections
    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
      mouseRef.current.active = true
    }

    function handleMouseLeave() {
      mouseRef.current.active = false
      mouseRef.current.x = -999
      mouseRef.current.y = -999
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    // Colors based on the active theme
    const themeColor1 = currentThemeMeta?.color1 || '#00f0ff'
    const themeColor2 = currentThemeMeta?.color2 || '#6366f1'

    // Initialize moving particles (dots)
    const particleCount = Math.min(Math.floor((width * height) / 12000), 85) || 60
    const particles = []

    for (let i = 0; i < particleCount; i++) {
      const isAlt = i % 2 === 0
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.9,
        radius: Math.random() * 2.2 + 1.2,
        baseAlpha: Math.random() * 0.5 + 0.4,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        pulsePhase: Math.random() * Math.PI * 2,
        color: isAlt ? themeColor1 : themeColor2,
      })
    }

    // Main animation loop
    function render(time) {
      ctx.clearRect(0, 0, width, height)

      const mouse = mouseRef.current

      // 1. Update and draw particles (moving dots)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Move particle
        p.x += p.vx
        p.y += p.vy

        // Wrap around boundaries smoothly
        if (p.x < -10) p.x = width + 10
        else if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        else if (p.y > height + 10) p.y = -10

        // Soft pulsing glow
        const currentAlpha = p.baseAlpha + Math.sin(time * 0.002 + p.pulsePhase) * 0.2
        const clampedAlpha = Math.max(0.2, Math.min(0.95, currentAlpha))

        // Draw particle dot with glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = clampedAlpha
        ctx.shadowBlur = 10
        ctx.shadowColor = p.color
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1.0

        // Connect nearby particles with glowing cyber lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 115) {
            const lineAlpha = (1 - dist / 115) * 0.28
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = p.color
            ctx.globalAlpha = lineAlpha
            ctx.lineWidth = 0.85
            ctx.stroke()
            ctx.globalAlpha = 1.0
          }
        }

        // Connect particles to mouse cursor when nearby
        if (mouse.active) {
          const mdx = p.x - mouse.x
          const mdy = p.y - mouse.y
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy)

          if (mDist < 140) {
            const mAlpha = (1 - mDist / 140) * 0.45
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.strokeStyle = themeColor1
            ctx.globalAlpha = mAlpha
            ctx.lineWidth = 1.2
            ctx.stroke()
            ctx.globalAlpha = 1.0
          }
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [currentThemeMeta])

  return (
    <div className="auth-animated-bg" aria-hidden="true">
      {/* Deep cyber grid pattern */}
      <div className="auth-cyber-grid" />

      {/* Dynamic floating luminous aurora orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      {/* Interactive moving dots & neural network canvas */}
      <canvas ref={canvasRef} className="auth-particle-canvas" />

      {/* Ambient cyber scanline beam */}
      <div className="auth-scan-beam" />
    </div>
  )
}
