// Outils de rendu partagés + rendu de secours en canvas 2D (si WebGL2 absent).
import { TAU, clamp } from './math.js'
import { buildLut, LUT_SIZE } from './palettes.js'

// Mélange vers le blanc (mz > 0) ou le noir (mz < 0) pour le mode direction.
export const MZ_SHADE = 0.92

// Netteté des parois : courbe en S sur mz (affichage seulement, la physique
// n'est pas touchée). La bande de transition entre ↑ et ↓ se resserre à
// l'écran. 0 = désactivé ; vers 2,5 les parois paraissent nettement plus fines.
export const MZ_SHARP = 2.5
const SHARP_NORM = Math.tanh(MZ_SHARP)
export const sharpMz = (z) => (MZ_SHARP > 0 ? Math.tanh(MZ_SHARP * z) / SHARP_NORM : z)

// Position du film à l'écran, en pixels CSS. cover : remplit tout l'écran.
// Sur téléphone (≤ 640 px, panneau en bas), un film qui ne remplit pas l'écran
// est collé en haut, avec la même marge qu'à gauche et à droite.
export function computeLayout(nx, ny, W, H, cover) {
  const s = cover ? Math.max(W / nx, H / ny) : Math.min((W * 0.88) / nx, (H * 0.88) / ny)
  const x0 = (W - nx * s) / 2
  const top = !cover && W <= 640
  return { s, x0, y0: top ? Math.max(x0, 12) : (H - ny * s) / 2, nx, ny }
}

// Coordonnées écran (px CSS) -> coordonnées de cellule (j vers le haut).
export function toCell(lay, x, y) {
  const ix = (x - lay.x0) / lay.s
  const iy = lay.ny - (y - lay.y0) / lay.s
  if (ix < 0 || ix >= lay.nx || iy < 0 || iy >= lay.ny) return null
  return [ix, iy]
}

// Échelle adaptative pour mx / my (qui peuvent rester petits) ; 1 pour mz.
export class ComponentScale {
  constructor() {
    this.vmax = 1
  }
  update(core, mode) {
    if (mode !== 'mx' && mode !== 'my') return (this.vmax = 1)
    const comp = mode === 'mx' ? core.mx : core.my
    let vm = 0
    for (let i = 0; i < core.n; i++) vm = Math.max(vm, Math.abs(comp[i]))
    this.vmax = Math.max(this.vmax * 0.985, vm, 0.01)
    return this.vmax
  }
}

// Tracé en deux passes : contour sombre puis trait clair, lisible sur le blanc
// (mz > 0) comme sur le noir (mz < 0).
function strokeTwice(ctx, strokes, fills, width) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = width + 1.2
  for (const p of strokes) ctx.stroke(p)
  for (const p of fills) ctx.stroke(p)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = width
  for (const p of strokes) ctx.stroke(p)
  for (const p of fills) ctx.fill(p)
}

// Flèches de la composante dans le plan (mx, my) : longueur ∝ |m∥|, pointe
// pleine. Quand m est presque hors du plan : ⊙ (mz > 0) ou ⊗ (mz < 0).
export function drawArrows(ctx, core, lay) {
  const { x0, y0, s } = lay
  const { nx, ny, mask, mx, my, mz } = core
  const step = Math.max(1, Math.round(34 / s))
  const pitch = s * step
  const len = pitch * 0.7
  const head = Math.min(pitch * 0.2, 5.5)
  const i0 = Math.floor(((nx - 1) % step) / 2)
  const j0 = Math.floor(((ny - 1) % step) / 2)
  const shafts = new Path2D()
  const heads = new Path2D()
  const marks = new Path2D()
  const dots = new Path2D()
  for (let j = j0; j < ny; j += step) {
    for (let i = i0; i < nx; i += step) {
      const id = j * nx + i
      if (mask && mask[id] !== 1) continue
      const cx = x0 + (i + 0.5) * s
      const cy = y0 + (ny - j - 0.5) * s
      const p = Math.hypot(mx[id], my[id])
      if (p < 0.25) {
        const r = Math.max(1.6, head * 0.35)
        if (mz[id] >= 0) {
          dots.moveTo(cx + r * 0.45, cy)
          dots.arc(cx, cy, r * 0.45, 0, TAU)
        } else {
          marks.moveTo(cx - r, cy - r)
          marks.lineTo(cx + r, cy + r)
          marks.moveTo(cx + r, cy - r)
          marks.lineTo(cx - r, cy + r)
        }
        continue
      }
      // Direction à l'écran (y vers le bas).
      const ux = mx[id] / p
      const uy = -my[id] / p
      const L = len * p
      const hs = head * Math.min(1, 0.45 + p * 0.6)
      const tx = cx + ux * L * 0.5
      const ty = cy + uy * L * 0.5
      const bx = tx - ux * hs
      const by = ty - uy * hs
      shafts.moveTo(cx - ux * L * 0.5, cy - uy * L * 0.5)
      shafts.lineTo(bx, by)
      heads.moveTo(tx, ty)
      heads.lineTo(bx - uy * hs * 0.45, by + ux * hs * 0.45)
      heads.lineTo(bx + uy * hs * 0.45, by - ux * hs * 0.45)
      heads.closePath()
    }
  }
  strokeTwice(ctx, [shafts, marks], [heads, dots], 1)
}

// Rendu CPU : une couleur par cellule, puis agrandissement lissé.
export class CpuRenderer {
  constructor(ctx) {
    this.ctx = ctx
    this.off = document.createElement('canvas')
    this.octx = this.off.getContext('2d')
    this.img = null
    this.nx = 0
    this.ny = 0
    this.lutId = null
    this.lut = null
  }

  render(core, lay, W, H, opts) {
    const { nx, ny, mx, my, mz, mask } = core
    if (nx !== this.nx || ny !== this.ny) {
      this.nx = nx
      this.ny = ny
      this.off.width = nx
      this.off.height = ny
      this.img = this.octx.createImageData(nx, ny)
    }
    if (opts.palette !== this.lutId) {
      this.lutId = opts.palette
      this.lut = buildLut(opts.palette)
    }
    const lut = this.lut
    const d = this.img.data
    const comp = opts.mode === 'mx' ? mx : opts.mode === 'my' ? my : opts.mode === 'mz' ? mz : null
    for (let j = 0; j < ny; j++) {
      const row = ny - 1 - j
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i
        const o = (row * nx + i) * 4
        if (mask && mask[id] !== 1) {
          d[o + 3] = 0
          continue
        }
        let r, g, b
        if (comp) {
          const v = comp === mz ? sharpMz(mz[id]) : comp[id]
          const t = clamp((v / opts.vmax) * 0.5 + 0.5, 0, 1)
          const k = Math.round(t * (LUT_SIZE - 1)) * 4
          r = lut[k]
          g = lut[k + 1]
          b = lut[k + 2]
        } else {
          const phi = Math.atan2(my[id], mx[id]) / TAU
          const k = (Math.floor((phi - Math.floor(phi)) * LUT_SIZE) % LUT_SIZE) * 4
          const z = sharpMz(mz[id]) * MZ_SHADE
          const target = z > 0 ? 255 : 0
          const f = Math.abs(z)
          r = lut[k] + (target - lut[k]) * f
          g = lut[k + 1] + (target - lut[k + 1]) * f
          b = lut[k + 2] + (target - lut[k + 2]) * f
        }
        d[o] = r
        d[o + 1] = g
        d[o + 2] = b
        d[o + 3] = 255
      }
    }
    this.octx.putImageData(this.img, 0, 0)
    const ctx = this.ctx
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.off, lay.x0, lay.y0, nx * lay.s, ny * lay.s)
  }
}
