import { useEffect, useRef, useState } from 'react'
import Layout from '../pages/Layout.jsx'
import { DiskPlayground } from '../discover/vendor/aimantarium.js'
import { makeHost } from '../discover/sim.js'
import DiskSchema from './DiskSchema.jsx'
import './applications.css'

// « Pour aller plus loin » du disque dur (Aimantarium V19) : la même lettre
// écrite sur trois pistes, puis relue après dix ans simulés. Le balisage
// est celui du prototype ; DiskPlayground le pilote. Aimantarium ajoute le fil
// conducteur (le défi des ingénieurs) et ce que montre chaque piste.

// Ce que chaque piste permet de montrer, dans l'ordre de l'histoire.
const MEDIA = {
  standard: {
    step: 1,
    title: 'Grains classiques : la référence',
    text: 'Ce sont des grains d’environ 9 nm, comme dans beaucoup de disques actuels. Ils sont assez gros pour que la chaleur ambiante ne les retourne pas : ta lettre doit tenir dix ans sans bouger.',
    try: 'Écris une lettre, laisse passer dix ans, puis passe aux petits grains.',
  },
  fragile: {
    step: 2,
    title: 'Petits grains : plus de mémoire…',
    text: 'Des grains de 4 nm au lieu de 9 nm prennent environ cinq fois moins de place. On peut donc ranger environ cinq fois plus de bits sur la même surface : c’est ce qui fait grandir la capacité des disques. Mais un petit grain est plus fragile : la chaleur ambiante peut le retourner tout seul.',
    try: 'Écris la même lettre, laisse passer dix ans et compare les bits avec ceux du départ.',
  },
  hard: {
    step: 3,
    title: 'Petits grains résistants (FePt) : la solution… à condition de chauffer',
    text: 'Le FePt est un matériau magnétique bien plus « dur » : même ses petits grains gardent leur orientation. On garde donc les petits grains, et donc la grande capacité. Le problème, c’est que la tête n’est plus assez forte pour les retourner. L’idée des ingénieurs : chauffer le grain un instant avec un laser, juste le temps d’écrire. C’est l’enregistrement assisté par la chaleur (HAMR).',
    try: 'Écris d’abord sans flash, puis avec le flash, et regarde la différence.',
  },
}

export default function DiskFree() {
  const root = useRef(null)
  const [medium, setMedium] = useState('standard')

  useEffect(() => {
    const play = new DiskPlayground(root.current, makeHost(() => {}))
    let shown = play.medium
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      play.frame(Math.min(0.05, (now - last) / 1000 || 0.016))
      last = now
      if (play.medium !== shown) {
        shown = play.medium
        setMedium(shown)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const m = MEDIA[medium]

  return (
    <Layout current="application" wide>
      <div ref={root}>
        <header className="workshop-head">
          <a className="back" href="#application">
            ← Applications
          </a>
          <p className="section-label">Disque dur · pour aller plus loin</p>
          <h1>Ta lettre tient-elle dans le temps ?</h1>
          <p>
            La chaleur peut retourner les grains qui portent les bits. Compare la même lettre sur plusieurs pistes pour voir laquelle la conserve.
          </p>
        </header>

        <section className="app-explain disk-goal" aria-labelledby="disk-goal-title">
          <h2 id="disk-goal-title">Le défi : stocker plus, sans rien perdre</h2>
          <p>
            Pour mettre plus de données sur un disque de même taille, il faut des bits plus petits, donc des grains plus petits. Mais plus un grain est petit, plus
            il est facile à retourner par la simple chaleur ambiante : les données s’effacent peu à peu. Les trois pistes racontent ce compromis, et la solution
            utilisée aujourd’hui.
          </p>
          <ol className="disk-steps">
            {Object.entries(MEDIA).map(([id, s]) => (
              <li key={id} className={id === medium ? 'on' : undefined}>
                {s.title}
              </li>
            ))}
          </ol>
          <div className="disk-why" aria-live="polite">
            <strong>
              Étape {m.step} · {m.title}
            </strong>
            <p>{m.text}</p>
            <p className="disk-try">À faire : {m.try}</p>
          </div>
        </section>

        <div className="workshop-grid disk-free-grid">
          <form className="workshop-controls" aria-label="Écriture sur le disque">
            <div id="free-disk-compare-intro">
              <h2>Compare les pistes</h2>
              <p>Écris une lettre avec les grains classiques, puis laisse passer dix ans. Recommence avec la même lettre sur la piste à petits grains.</p>
            </div>
            <label htmlFor="free-disk-letter">Ta lettre (A à Z)</label>
            <input
              className="disk-letter-input"
              id="free-disk-letter"
              type="text"
              maxLength={1}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            <fieldset className="disk-media">
              <legend>Sur quelle piste ?</legend>
              <div className="disk-media-options">
                <button type="button" className="guide-action" data-disk-medium="standard" aria-pressed="true">
                  Grains classiques
                </button>
                <button type="button" className="guide-action" data-disk-medium="fragile" aria-pressed="false">
                  Petits grains
                </button>
                <button type="button" className="guide-action" data-disk-medium="hard" aria-pressed="false">
                  Petits grains résistants (FePt)
                </button>
              </div>
            </fieldset>
            <div id="free-disk-laser-control" className="disk-laser-experiment" hidden>
              <h2>Que change le flash laser ?</h2>
              <ol>
                <li>Laisse le flash coupé et appuie sur « Écrire ».</li>
                <li>Coche « Activer le flash laser », puis écris la même lettre.</li>
              </ol>
              <label className="disk-laser-toggle" htmlFor="free-disk-laser">
                <input id="free-disk-laser" type="checkbox" /> Activer le flash laser
              </label>
              <p>
                La barrière d’énergie est l’énergie nécessaire pour retourner un grain. Le flash chauffe les grains et abaisse la barrière le temps d’écrire. En
                refroidissant, les grains gardent mieux leur orientation.
              </p>
            </div>
            <button className="btn primary" type="submit" id="free-disk-write" disabled>
              Écrire la lettre
            </button>
          </form>
          <section className="workshop-visual" aria-label="Résultat sur la piste">
            <div className="track-header">
              <strong>Piste magnétique</strong>
              <span className="track-state" id="free-disk-heat" />
            </div>
            <dl className="disk-letter-pair">
              <div>
                <dt>Lettre demandée</dt>
                <dd id="free-disk-target">—</dd>
              </div>
              <div>
                <dt>Lettre lue</dt>
                <dd id="free-disk-recorded">—</dd>
              </div>
            </dl>
            <p className="track-caption" id="free-disk-status" role="status" />
            <button className="btn" type="button" id="free-disk-age" disabled>
              Laisser passer 10 ans
            </button>
            <progress id="free-disk-age-progress" max="10" value="0" aria-label="Années simulées" hidden />
            <div className="disk-time-row">
              <h2 id="free-disk-before-title">Après l’écriture</h2>
              <div className="track-bits" id="free-disk-before-bits" role="img" aria-label="Bits après l’écriture" />
            </div>
            <div className="disk-time-row" id="free-disk-after" hidden>
              <h2 id="free-disk-years">0 an écoulé</h2>
              <div className="track-bits" id="free-disk-after-bits" role="img" aria-label="Bits après le passage du temps" />
              <p className="track-key">Un contour jaune signale un bit qui a changé.</p>
            </div>
            <p className="track-key disk-grain-key">
              Un trait résume les grains de chaque bit. La couleur majoritaire donne le chiffre. Rouge pour 1, bleu pour 0.
            </p>
          </section>
        </div>

        <details className="app-explain disk-schema-reminder">
          <summary>Rappel : qu’est-ce que la piste magnétique ?</summary>
          <DiskSchema />
        </details>

        <nav className="disk-free-links" aria-label="Autres parcours du disque dur">
          <a className="guide-link" href="#guide-disk">
            Revoir le tutoriel
          </a>
        </nav>
      </div>
    </Layout>
  )
}
