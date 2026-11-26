import { useEffect, useRef, useState } from 'react'
import { meshUnderResolved } from '../sim/meshResolution.js'
import { GLRenderer } from '../sim/glRenderer.js'
import { CpuRenderer, ComponentScale, computeLayout, drawArrows, toCell } from '../sim/renderer.js'
import { drawWall } from '../sim/wallView.js'

// Paramètres de l'aimant pour Simulation.setMagnet ; position en cellules
// (sans borne : un aimant hors du film agit encore sur ses bords).
function magnetAt(tool, p, lay) {
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' ? Number(v) : d)
  return {
    cx: (p.x - lay.x0) / lay.s,
    cy: lay.ny - (p.y - lay.y0) / lay.s,
    strength: Math.min(Math.max(num(tool.strength, 0), 0), 5000),
    height: Math.min(Math.max(num(tool.height, 30), 1), 500),
    pole: tool.pole,
  }
}

// Repère discret : cercle de rayon h (zone où le champ de l'aimant est fort).
function drawMagnet(ctx, p, r) {
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(r, 6), 0, Math.PI * 2)
  ctx.stroke()
}

// Plein écran : boucle d'animation, intégration LLG et rendu.
// Canvas du dessous : champ (WebGL2, ou 2D en secours). Canvas du dessus : flèches.
export default function FieldCanvas({ sim, running, view, speed, tool, engine }) {
  const [meshWarning, setMeshWarning] = useState(false)
  const glRef = useRef(null)
  const overlayRef = useRef(null)
  const live = useRef({ sim, running, view, speed, tool, engine })

  useEffect(() => {
    live.current = { sim, running, view, speed, tool, engine }
  }, [sim, running, view, speed, tool, engine])

  useEffect(() => {
    const glCanvas = glRef.current
    const overlay = overlayRef.current
    const octx = overlay.getContext('2d')
    let gl = null
    let cpu = null
    try {
      gl = new GLRenderer(glCanvas)
    } catch (err) {
      console.warn('Rendu WebGL2 indisponible, rendu 2D de secours :', err)
      glCanvas.style.display = 'none'
      cpu = new CpuRenderer(octx)
    }
    const scale = new ComponentScale()
    let W = 0
    let H = 0
    let dpr = 1
    let lay = null
    let raf = 0
    let last = performance.now()
    let lastAudio = 0
    let lastMeshCheck = -Infinity
    let lastMeshCore = null
    let meshWarning = false
    // Position du pointeur (px CSS) quand l'aimant est actif, sinon null.
    let pointer = null

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      W = overlay.clientWidth
      H = overlay.clientHeight
      for (const c of [glCanvas, overlay]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(overlay)
    resize()

    const frame = (now) => {
      const { sim, running, view, speed, tool } = live.current
      const dtReal = Math.min(0.05, (now - last) / 1000)
      last = now
      if (sim) {
        const core = sim.core
        // Monde « Paroi » : vue dédiée (ruban + flèches vues de côté), sans
        // geste dans l'image. Le calque du dessus, opaque, cache le rendu WebGL.
        const wallView = sim.p.view === 'wall'
        lay = computeLayout(core.nx, core.ny, W, H, sim.p.fill)
        const magnet = !wallView && tool.kind === 'magnet' && pointer ? magnetAt(tool, pointer, lay) : null
        sim.setMagnet(magnet)
        if (running) sim.advance(dtReal, speed)
        // Diagnostic seulement : au plus 4 contrôles/s hors changement de film.
        // Aucun calcul ajouté aux sous-étapes RK4, ni FFT supplémentaire.
        if (core !== lastMeshCore || now - lastMeshCheck >= 250) {
          const next = meshUnderResolved(core, core === lastMeshCore && meshWarning)
          lastMeshCore = core
          lastMeshCheck = now
          if (next !== meshWarning) {
            meshWarning = next
            setMeshWarning(next)
          }
        }
        if (wallView) {
          drawWall(octx, core, sim.wallInfo(), W, H)
        } else {
          const palette = view.mode === 'wheel' ? view.wheelPalette : view.linearPalette
          const opts = { mode: view.mode, palette, vmax: scale.update(core, view.mode) }
          if (gl) {
            gl.render(core, lay, dpr, opts)
            octx.clearRect(0, 0, W, H)
          } else {
            cpu.render(core, lay, W, H, opts)
          }
          if (view.arrows) drawArrows(octx, core, lay)
          if (magnet) drawMagnet(octx, pointer, (magnet.height * 1e-9 * lay.s) / core.dx)
        }
        const audio = live.current.engine.current
        if (audio && audio.running && now - lastAudio > 100) {
          const f = sim.audioFeatures((now - lastAudio) / 1000)
          lastAudio = now
          f.magnet = magnet && { x: Math.min(Math.max(magnet.cx / core.nx, 0), 1), strength: magnet.strength / 5000, pole: magnet.pole }
          audio.update(f)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const pos = (e) => {
      const rect = overlay.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    // Souris : l'aimant suit le curseur sans clic. Doigt / stylet : tant qu'il touche l'écran.
    const onDown = (e) => {
      const { sim, tool } = live.current
      if (!sim || !lay || sim.p.view === 'wall') return
      if (tool.kind === 'magnet') {
        pointer = pos(e)
        if (e.pointerType !== 'mouse') overlay.setPointerCapture(e.pointerId)
        return
      }
      const p = pos(e)
      const cell = toCell(lay, p.x, p.y)
      if (cell) sim.placeSeed(cell[0], cell[1])
    }
    const onMove = (e) => {
      if (e.pointerType === 'mouse' || pointer) pointer = pos(e)
    }
    const onUp = (e) => {
      if (e.pointerType !== 'mouse') pointer = null
    }
    const onLeave = () => {
      pointer = null
    }
    overlay.addEventListener('pointerdown', onDown)
    overlay.addEventListener('pointermove', onMove)
    overlay.addEventListener('pointerup', onUp)
    overlay.addEventListener('pointercancel', onLeave)
    overlay.addEventListener('pointerleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      overlay.removeEventListener('pointerdown', onDown)
      overlay.removeEventListener('pointermove', onMove)
      overlay.removeEventListener('pointerup', onUp)
      overlay.removeEventListener('pointercancel', onLeave)
      overlay.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <>
      <canvas ref={glRef} className="field" />
      <canvas ref={overlayRef} className="field overlay" />
      <div className="mesh-warning" role="status" aria-live="polite">
        {meshWarning && (
          <span><strong>⚠ Maillage potentiellement trop grossier.</strong> L’aimantation varie fortement entre deux cellules ; interprète le résultat qualitativement.</span>
        )}
      </div>
    </>
  )
}
