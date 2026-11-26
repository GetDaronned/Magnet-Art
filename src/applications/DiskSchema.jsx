// Schéma d'un disque dur : le plateau vu de dessus, puis une piste vue en
// coupe, de très près. Les grains sont des colonnes aimantées vers le haut
// (rouge, 1) ou vers le bas (bleu, 0) ; un groupe de grains orientés pareil
// forme un bit, et 8 bits forment une lettre (ici « M » = 01001101).

const BITS = [0, 1, 0, 0, 1, 1, 0, 1]
const GRAINS_PER_BIT = 3
// Largeurs irrégulières, fixes, pour que les grains ne soient pas des briques.
const JITTER = [0.9, 1.15, 0.95, 1.05, 0.85, 1.1, 1, 0.92, 1.08, 1.12, 0.88, 1, 0.95, 1.06, 0.99, 1.1, 0.9, 1.01, 1.04, 0.93, 1.03, 0.97, 1.09, 0.94]

const X0 = 385
const X1 = 775
const BIT_W = (X1 - X0) / BITS.length
const TRACK_TOP = 150
const TRACK_H = 46

function grains() {
  const out = []
  BITS.forEach((bit, b) => {
    const js = JITTER.slice(b * GRAINS_PER_BIT, (b + 1) * GRAINS_PER_BIT)
    const total = js.reduce((s, v) => s + v, 0)
    let x = X0 + b * BIT_W
    js.forEach((j, g) => {
      const w = (BIT_W * j) / total
      out.push({ x, w, bit, key: b * GRAINS_PER_BIT + g })
      x += w
    })
  })
  return out
}

export default function DiskSchema() {
  // Tête au-dessus de la piste mise en valeur (rayon 88, angle −40°).
  const hx = 150 + 88 * Math.cos((-40 * Math.PI) / 180)
  const hy = 170 + 88 * Math.sin((-40 * Math.PI) / 180)
  return (
    <figure className="disk-schema">
      <svg viewBox="0 0 820 330" role="img" aria-label="Schéma d’un disque dur : le plateau, la tête, et la piste agrandie où des grains aimantés vers le haut ou vers le bas codent les bits d’une lettre.">
        {/* ---- plateau vu de dessus ---- */}
        <circle cx="150" cy="170" r="118" fill="#e4ebe5" stroke="#17140f" strokeWidth="2" />
        {[40, 48, 56, 64, 72, 80, 96, 104, 112].map((r) => (
          <circle key={r} cx="150" cy="170" r={r} fill="none" stroke="#b6c5bd" strokeWidth="0.8" />
        ))}
        <circle cx="150" cy="170" r="88" fill="none" stroke="#d7301f" strokeWidth="3.5" />
        <circle cx="150" cy="170" r="18" fill="#8a9a93" stroke="#17140f" strokeWidth="1.5" />
        <path d="M 150 40 A 130 130 0 0 1 270 105" fill="none" stroke="#4a443a" strokeWidth="1.5" markerEnd="url(#ds-arrow)" />
        <text x="232" y="52" className="ds-small">rotation</text>
        {/* bras et tête */}
        <line x1="310" y1="290" x2={hx + 4} y2={hy + 4} stroke="#3d4a46" strokeWidth="9" strokeLinecap="round" />
        <circle cx="310" cy="290" r="11" fill="#3d4a46" />
        <rect x={hx - 7} y={hy - 5} width="14" height="10" rx="2" fill="#c98a00" stroke="#17140f" strokeWidth="1.2" />
        <text x="150" y="320" textAnchor="middle" className="ds-label">
          Plateau (≈ 7 200 tours par minute)
        </text>
        <text x="300" y="318" textAnchor="start" className="ds-label">
          Bras et tête
        </text>
        <line x1="20" y1="92" x2="62" y2="160" stroke="#d7301f" strokeWidth="1.2" />
        <text x="8" y="86" className="ds-label red">
          Une piste
        </text>

        {/* ---- zoom ---- */}
        <rect x={hx - 12} y={hy - 12} width="24" height="24" fill="none" stroke="#17140f" strokeWidth="1.2" strokeDasharray="3 2" />
        <line x1={hx + 12} y1={hy - 12} x2="360" y2="32" stroke="#17140f" strokeWidth="0.8" strokeDasharray="3 3" />
        <line x1={hx + 12} y1={hy + 12} x2="360" y2="298" stroke="#17140f" strokeWidth="0.8" strokeDasharray="3 3" />

        {/* ---- la piste vue en coupe ---- */}
        <rect x="360" y="32" width="440" height="266" rx="12" fill="#fbf8f2" stroke="#17140f" strokeWidth="1.5" />
        <text x="580" y="54" textAnchor="middle" className="ds-label">
          La piste vue en coupe, agrandie environ un million de fois
        </text>
        {/* tête et son champ d'écriture */}
        <rect x="548" y="70" width="64" height="30" rx="4" fill="#3d4a46" />
        <rect x="574" y="100" width="12" height="10" fill="#c98a00" />
        <text x="624" y="84" className="ds-small">
          tête : écrit et lit les grains
        </text>
        <text x="624" y="98" className="ds-small">
          vole à quelques nanomètres
        </text>
        {[-14, 0, 14].map((d) => (
          <path key={d} d={`M ${580 + d / 2} 112 Q ${580 + d} 128 ${580 + d * 1.6} ${TRACK_TOP - 3}`} fill="none" stroke="#c98a00" strokeWidth="1.4" strokeDasharray="3 2" />
        ))}
        <path d="M 400 128 L 470 128" stroke="#4a443a" strokeWidth="1.4" markerEnd="url(#ds-arrow)" />
        <text x="398" y="120" className="ds-small">
          la piste défile sous la tête
        </text>

        {/* grains en colonnes */}
        {grains().map((g) => (
          <g key={g.key}>
            <rect
              x={g.x + 0.8}
              y={TRACK_TOP}
              width={g.w - 1.6}
              height={TRACK_H}
              rx="3"
              fill={g.bit ? '#c8463a' : '#2f5ea6'}
              stroke="#17140f"
              strokeWidth="0.8"
            />
            <text x={g.x + g.w / 2} y={TRACK_TOP + TRACK_H / 2 + 5} textAnchor="middle" className="ds-arrow">
              {g.bit ? '↑' : '↓'}
            </text>
          </g>
        ))}
        <rect x={X0} y={TRACK_TOP + TRACK_H} width={X1 - X0} height="8" fill="#b6c5bd" />
        <text x={X1} y={TRACK_TOP + TRACK_H + 20} textAnchor="end" className="ds-small">
          support du plateau
        </text>

        {/* regroupement en bits */}
        {BITS.map((bit, b) => {
          const x = X0 + b * BIT_W
          const y = TRACK_TOP + TRACK_H + 30
          return (
            <g key={b}>
              <path d={`M ${x + 3} ${y - 6} L ${x + 3} ${y} L ${x + BIT_W - 3} ${y} L ${x + BIT_W - 3} ${y - 6}`} fill="none" stroke="#17140f" strokeWidth="1.2" />
              <text x={x + BIT_W / 2} y={y + 18} textAnchor="middle" className={'ds-bit ' + (bit ? 'red' : 'blue')}>
                {bit}
              </text>
            </g>
          )
        })}
        <text x="580" y="270" textAnchor="middle" className="ds-small">
          1 grain ≈ 10 nm · 1 bit = un groupe de grains orientés pareil
        </text>
        <text x="580" y="286" textAnchor="middle" className="ds-small">
          8 bits = 1 lettre (ici « M » = 01001101)
        </text>

        <defs>
          <marker id="ds-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a443a" />
          </marker>
        </defs>
      </svg>
      <figcaption>
        Un disque dur range tes données sur des plateaux couverts d’une fine couche magnétique. Cette couche est faite de minuscules grains, chacun aimanté vers le
        haut (rouge, 1) ou vers le bas (bleu, 0). La tête oriente les grains pour écrire, puis repère leur orientation pour relire.
      </figcaption>
    </figure>
  )
}
