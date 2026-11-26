import './pages.css'
import logo from '../assets/logo-aimantarium.png'

// Cadre commun des pages de contenu (accueil, découverte, applications), au style
// d'Aimantarium V18 : en-tête collant, logo tourbillon, menu en pastilles.
export default function Layout({ current, wide, children }) {
  const link = (id, label) => (
    <a href={'#' + id} className={current === id ? 'on' : undefined} aria-current={current === id ? 'page' : undefined}>
      {label}
    </a>
  )
  return (
    <div className="page">
      <header className="page-top">
        <a className="brand" href="#accueil" aria-label="Aimantarium, accueil">
          <img className="logo" src={logo} alt="" aria-hidden="true" />
          <span className="brand-t">Aimantarium</span>
        </a>
        <nav className="nav" aria-label="Navigation principale">
          {link('accueil', 'Accueil')}
          {link('decouverte', 'Découverte')}
          {link('application', 'Applications')}
          {link('xp-sandbox', 'Bac à sable')}
        </nav>
      </header>
      <main className={'page-main' + (wide ? ' wide' : '')}>{children}</main>
    </div>
  )
}
