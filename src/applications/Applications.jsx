import Layout from '../pages/Layout.jsx'
import { diskComplete } from './progress.js'
import '../discover/discover.css'
import './applications.css'

// Page Applications (Aimantarium V19) : le disque dur et le haut-parleur.
export default function Applications() {
  return (
    <Layout current="application">
      <div className="d-hero">
        <div className="d-hero-copy">
          <p className="d-label">Applications</p>
          <h1>Les aimants en action.</h1>
          <p>Écris une lettre sur un disque dur et découvre comment un haut-parleur produit du son.</p>
        </div>
        <div className="application-track" aria-hidden="true">
          <span>↑</span>
          <span>↓</span>
          <span>↓</span>
          <span>↑</span>
          <span>↓</span>
          <span>↑</span>
        </div>
      </div>
      <div className="application-cards">
        <article className="application-card">
          <div className="app-illustration platter" aria-hidden="true">
            <span />
          </div>
          <div className="application-card-content">
            <h2>Le disque dur</h2>
            <p>Écris une lettre puis relis-la. Regarde comment le disque la garde en mémoire avec de petits aimants.</p>
            <a className="btn primary" href="#guide-disk">
              {diskComplete() ? 'Réécrire une lettre →' : 'Écrire une lettre →'}
            </a>
          </div>
        </article>
        <article className="application-card">
          <div className="app-illustration speaker-thumbnail" aria-hidden="true">
            <span />
          </div>
          <div className="application-card-content">
            <h2>Le haut-parleur</h2>
            <p>Inverse le courant et observe le mouvement. Fais ensuite vibrer la membrane et écoute la note changer.</p>
            <a className="btn primary" href="#guide-haut-parleur">
              Essayer le haut-parleur →
            </a>
          </div>
        </article>
      </div>
    </Layout>
  )
}
