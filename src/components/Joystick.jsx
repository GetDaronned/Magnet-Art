import { useRef } from 'react'

// Joystick circulaire : (x, y) ∈ disque de rayon `max` (y vers le haut).
// Glisser pour diriger, double-clic pour revenir à zéro.
export default function Joystick({ x, y, max, onChange }) {
  const ref = useRef(null)

  const fromEvent = (e) => {
    const r = ref.current.getBoundingClientRect()
    let u = ((e.clientX - r.left) / r.width) * 2 - 1
    let v = -(((e.clientY - r.top) / r.height) * 2 - 1)
    const len = Math.hypot(u, v)
    if (len > 1) {
      u /= len
      v /= len
    }
    // Petite zone morte au centre : revenir à zéro facilement.
    if (len < 0.06) u = v = 0
    onChange(Math.round(u * max), Math.round(v * max))
  }

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    fromEvent(e)
  }
  const onMove = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) fromEvent(e)
  }

  const kx = 50 + (x / max) * 50
  const ky = 50 - (y / max) * 50

  return (
    <div
      ref={ref}
      className="joystick"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onDoubleClick={() => onChange(0, 0)}
      role="slider"
      aria-label="Champ dans le plan"
      aria-valuetext={`Bx ${x} mT, By ${y} mT`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="49" className="joy-ring" />
        <circle cx="50" cy="50" r="24.5" className="joy-ring inner" />
        <line x1="50" y1="2" x2="50" y2="98" className="joy-axis" />
        <line x1="2" y1="50" x2="98" y2="50" className="joy-axis" />
        <line x1="50" y1="50" x2={kx} y2={ky} className="joy-vec" />
        <circle cx={kx} cy={ky} r="6" className="joy-knob" />
      </svg>
    </div>
  )
}
