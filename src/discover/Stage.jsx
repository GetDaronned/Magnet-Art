import { useEffect, useRef } from 'react'

// Canvas d'une simulation du prototype : boucle d'animation et, si
// `interactive`, gestes dans l'image (déplacer un aimant…).
export default function Stage({ sim, interactive, label }) {
  const ref = useRef(null)
  const live = useRef(interactive)
  useEffect(() => {
    live.current = interactive
  }, [interactive])

  useEffect(() => {
    const c = ref.current
    const ctx = c.getContext('2d')
    let w = 0
    let h = 0
    let dpr = 1
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      // Dernier argument « guidé » : comme le prototype V19 dans la
      // Découverte (libellés simplifiés de la paroi, thermomètre de Curie).
      sim.draw(ctx, w, h, true)
    }
    // Redimensionner efface le canvas : on redessine aussitôt.
    const fit = () => {
      const r = c.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(10, r.width)
      h = Math.max(10, r.height)
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      draw()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(c)

    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
      last = now
      try {
        sim.update(dt, 1)
        draw()
      } catch (err) {
        console.error(err)
        cancelAnimationFrame(raf)
      }
    }
    fit()
    raf = requestAnimationFrame(frame)

    let drag = null
    const pos = (e) => {
      const r = c.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const down = (e) => {
      if (!live.current) return
      drag = { x: e.clientX, y: e.clientY }
      c.setPointerCapture(e.pointerId)
      if (sim.pointer) sim.pointer('down', ...pos(e))
    }
    const move = (e) => {
      if (!live.current) return
      if (sim.pointer) sim.pointer(drag ? 'move' : 'hover', ...pos(e))
      if (!drag) return
      sim.drag(e.clientX - drag.x, e.clientY - drag.y)
      drag = { x: e.clientX, y: e.clientY }
    }
    const end = () => {
      drag = null
      if (sim.pointer) sim.pointer('up', 0, 0)
    }
    const leave = () => {
      if (!drag && sim.pointer) sim.pointer('leave', 0, 0)
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    c.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', end)
      c.removeEventListener('pointercancel', end)
      c.removeEventListener('pointerleave', leave)
    }
  }, [sim])

  return <canvas ref={ref} className={'d-canvas' + (interactive ? ' interactive' : '')} aria-label={label} />
}

// Légende des couleurs de l'aimantation.
export function Legend({ flat }) {
  return (
    <div className="d-legend" aria-label="Couleurs de l’aimantation">
      <span>
        <b className="up">↑</b> Rouge vers le haut
      </span>
      <span>
        <b className="down">↓</b> Bleu vers le bas
      </span>
      {flat && (
        <span>
          <b className="flat">→</b> Blanc presque à plat
        </span>
      )}
    </div>
  )
}
