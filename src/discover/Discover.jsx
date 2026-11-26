import Layout from '../pages/Layout.jsx'
import { DECOUVERTE, GRANDEURS } from './vendor/aimantarium.js'
import { seenQty } from './sim.js'
import './discover.css'

function Mission({ chapter }) {
  return (
    <a className="d-mission" href={'#explore-' + chapter.id}>
      <span className="d-mission-icon" aria-hidden="true">
        {chapter.icon}
      </span>
      <span className="d-mission-copy">
        <h3>{chapter.short}</h3>
        <p>{chapter.summary}</p>
      </span>
      <span className="d-mission-arrow" aria-hidden="true">
        →
      </span>
    </a>
  )
}

export default function Discover() {
  const base = DECOUVERTE.filter((c) => !c.optional)
  const more = DECOUVERTE.filter((c) => c.optional)
  const keys = Object.keys(GRANDEURS)
  const seen = seenQty()
  return (
    <Layout current="decouverte">
      <div className="d-hero">
        <div className="d-hero-copy">
          <p className="d-label">Découverte</p>
          <h1>À toi de mener l’expérience.</h1>
          <p>Découvre les cinq réglages du bac à sable. Déplace les aimants, essaie les curseurs et regarde ce qui change.</p>
          <a className="btn primary big" href={'#explore-' + base[0].id}>
            Explorer le champ →
          </a>
        </div>
        <div className="d-field" aria-hidden="true">
          <span className="d-loop" />
          <span className="d-loop" />
          <span className="d-loop" />
          <span className="d-magnet">
            <b>N</b>
            <b>S</b>
          </span>
        </div>
      </div>

      <h2 className="d-section">Les bases du bac à sable</h2>
      <div className="d-missions">
        {base.map((c) => (
          <Mission key={c.id} chapter={c} />
        ))}
      </div>

      {more.length > 0 && (
        <>
          <h2 className="d-section">Pour aller plus loin</h2>
          <div className="d-missions">
            {more.map((c) => (
              <Mission key={c.id} chapter={c} />
            ))}
          </div>
        </>
      )}

      {/* Carnet des notions (V19) : une grandeur se débloque quand on la
          rencontre dans un atelier ou un quiz. */}
      <details className="d-notebook">
        <summary>
          Carnet des notions
          <span className="d-notebook-count">
            {keys.filter((k) => seen[k]).length} / {keys.length}
          </span>
        </summary>
        <div className="carnet">
          <p>Retrouve les notions vues dans les expériences et les quiz.</p>
          <div className="carnet-grid">
            {keys.map((k) => {
              const q = GRANDEURS[k]
              return (
                <div key={k} className={'carnet-card' + (seen[k] ? ' on' : '')}>
                  <b>{q.sym}</b>
                  <strong>{q.name}</strong>
                  <p>{seen[k] ? q.role : 'À découvrir dans un chapitre.'}</p>
                </div>
              )
            })}
          </div>
        </div>
      </details>
    </Layout>
  )
}
