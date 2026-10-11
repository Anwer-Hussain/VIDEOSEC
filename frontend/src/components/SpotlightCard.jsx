import { useRef } from 'react'

/**
 * SpotlightCard
 * An interactive card that dynamically illuminates under the user's cursor.
 * Features a glowing border and ambient inner spotlight that tracks mouse movement.
 */
export default function SpotlightCard({
  children,
  className = '',
  style = {},
  ...props
}) {
  const cardRef = useRef(null)

  function handleMouseMove(e) {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cardRef.current.style.setProperty('--mouse-x', `${x}px`)
    cardRef.current.style.setProperty('--mouse-y', `${y}px`)
  }

  function handleMouseLeave() {
    if (!cardRef.current) return
    cardRef.current.style.setProperty('--mouse-x', `-999px`)
    cardRef.current.style.setProperty('--mouse-y', `-999px`)
  }

  return (
    <div
      ref={cardRef}
      className={`card spotlight-card ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  )
}
