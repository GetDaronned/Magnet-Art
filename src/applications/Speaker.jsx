import { useEffect, useRef, useState } from 'react'
import Layout from '../pages/Layout.jsx'
import { SpeakerWorkshop } from '../discover/vendor/aimantarium.js'
import './applications.css'

// Haut-parleur (Aimantarium V19). Aimantarium ajoute sur le dessin ce que fait
// l'aimant : ses lignes de champ, guidées par les pièces en fer jusqu'à
// l'entrefer où se trouve la bobine, et le sens du courant dans le fil.
//
// Physique représentée : l'aimant (aimanté le long de l'axe, N côté
// membrane) crée dans l'entrefer un champ B dirigé vers l'axe (vers le bas
// au-dessus de l'axe, vers le haut en dessous). Le courant I circule dans la
// bobine perpendiculairement au dessin (⊗ entre dans l'écran, ⊙ en sort). La
// force de Laplace F = I·L × B est alors parallèle à l'axe. Repère direct :
// x vers l'air, y vers le haut, z sortant de l'écran. Au-dessus de l'axe,
// B = −y ; pour F = +x il faut I = +z (⊙). En dessous, B = +y et I = −z (⊗).
// C'est le « Sens 1 » du prototype, qui pousse la bobine vers l'air ; le
// « Sens 2 » inverse le courant et la force.

const W = 340 // repère du dessin du prototype (speaker-diagram.js)
const H = 222
const FIELD = 'rgba(31, 94, 170, 0.85)'

function arrowHead(ctx, x, y, dx, dy, size = 4) {
  const l = Math.hypot(dx, dy)
  const ux = dx / l
  const uy = dy / l
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - ux * size - uy * size * 0.7, y - uy * size + ux * size * 0.7)
  ctx.lineTo(x - ux * size + uy * size * 0.7, y - uy * size - ux * size * 0.7)
  ctx.closePath()
  ctx.fill()
}

// Une boucle de champ, au-dessus (s = 1) ou en dessous (s = −1) de l'axe y = 116.
function fieldLoop(ctx, s, gapX) {
  const y = (v) => 116 - s * (116 - v)
  ctx.beginPath()
  ctx.moveTo(gapX, y(100)) // entrefer, côté plaque
  ctx.lineTo(gapX, y(110)) // traverse la bobine vers l'axe
  ctx.quadraticCurveTo(gapX, y(113), gapX - 4, y(113))
  ctx.lineTo(48, y(113)) // retour dans le noyau central
  ctx.quadraticCurveTo(43, y(113), 43, y(108))
  ctx.lineTo(43, y(94)) // remonte dans la plaque arrière
  ctx.quadraticCurveTo(43, y(90), 48, y(90))
  ctx.lineTo(92, y(90)) // traverse l'aimant de S vers N
  ctx.quadraticCurveTo(gapX, y(90), gapX, y(100)) // plaque avant, jusqu'à l'entrefer
  ctx.stroke()
  // flèches : dans l'aimant (vers la membrane) et dans l'entrefer (vers l'axe)
  arrowHead(ctx, 76, y(90), 1, 0)
  arrowHead(ctx, gapX, y(108), 0, s)
}

function currentSymbol(ctx, x, y, out) {
  ctx.beginPath()
  ctx.arc(x, y, 4.2, 0, 2 * Math.PI)
  ctx.fillStyle = '#fffdf8'
  ctx.fill()
  ctx.strokeStyle = '#17140f'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.fillStyle = '#17140f'
  if (out) {
    ctx.beginPath()
    ctx.arc(x, y, 1.4, 0, 2 * Math.PI)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(x - 2.6, y - 2.6)
    ctx.lineTo(x + 2.6, y + 2.6)
    ctx.moveTo(x + 2.6, y - 2.6)
    ctx.lineTo(x - 2.6, y + 2.6)
    ctx.stroke()
  }
}

function drawMagnetField(root, displacement, current) {
  const canvas = root.querySelector('.speaker-cutaway')
  if (!canvas || !canvas.width) return
  const ctx = canvas.getContext('2d')
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
  const dx = displacement * 9

  // pôles de l'aimant
  ctx.font = '800 9px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fffdf8'
  for (const y of [93.5, 144.5]) {
    ctx.fillText('S', 57, y)
    ctx.fillText('N', 88, y)
  }

  // lignes de champ
  ctx.save()
  ctx.strokeStyle = FIELD
  ctx.fillStyle = FIELD
  ctx.lineWidth = 1.6
  ctx.setLineDash([4, 3])
  for (const s of [1, -1]) fieldLoop(ctx, s, 104)
  ctx.restore()
  ctx.fillStyle = FIELD
  ctx.font = '700 11px system-ui, sans-serif'
  ctx.fillText('B', 22, 120)

  // sens du courant dans la bobine
  if (current) {
    currentSymbol(ctx, 121 + dx, 102.5, current > 0)
    currentSymbol(ctx, 121 + dx, 129.5, current < 0)
  }
}

class MagnetSpeaker extends SpeakerWorkshop {
  draw() {
    super.draw()
    if (this.showField === false) return
    // Pendant la vibration, le courant suit le mouvement de la membrane.
    const current = this.vibrating ? Math.sign(this.displacement) : this.current
    drawMagnetField(this.root, this.displacement, current)
  }
}

export default function Speaker() {
  const root = useRef(null)
  const speaker = useRef(null)
  const [showField, setShowField] = useState(true)

  useEffect(() => {
    const s = new MagnetSpeaker(root.current)
    speaker.current = s
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      s.frame(Math.min(0.05, (now - last) / 1000 || 0.016))
      last = now
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      s.destroy()
      speaker.current = null
    }
  }, [])

  const toggleField = (on) => {
    setShowField(on)
    if (speaker.current) {
      speaker.current.showField = on
      speaker.current.draw()
    }
  }

  return (
    <Layout current="application" wide>
      <div ref={root} />
      <section className="app-explain speaker-magnet" aria-labelledby="speaker-magnet-title">
        <h2 id="speaker-magnet-title">Le rôle de l’aimant</h2>
        <label className="speaker-field-toggle">
          <input type="checkbox" checked={showField} onChange={(e) => toggleField(e.target.checked)} /> Montrer le champ de l’aimant sur le dessin
        </label>
        <div className="speaker-magnet-grid">
          <div>
            <h3>Un champ guidé jusqu’à la bobine</h3>
            <p>
              L’aimant (en rouge, avec ses pôles S et N) reste fixe. Son champ magnétique, en pointillés bleus, est guidé par les pièces en fer qui l’entourent
              jusqu’à une fente étroite, l’entrefer. C’est là que se trouve la bobine : le champ la traverse.
            </p>
          </div>
          <div>
            <h3>Un courant dans un champ : une force</h3>
            <p>
              Quand un courant passe dans le fil de la bobine (⊗ : il entre dans l’écran, ⊙ : il en sort), le champ de l’aimant pousse sur le fil. C’est la force
              de Laplace. Elle pousse la bobine, et la membrane collée à elle, vers l’air ou vers l’aimant.
            </p>
          </div>
          <div>
            <h3>Inverser le courant inverse la force</h3>
            <p>
              Change le sens du courant : les symboles ⊙ et ⊗ s’échangent et la bobine part de l’autre côté. Un courant qui change de sens en boucle fait donc
              vibrer la membrane. Plus le courant est fort, ou plus l’aimant est puissant, plus la poussée est grande.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  )
}
