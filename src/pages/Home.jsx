import { Suspense, lazy, useState } from 'react'
import Layout from './Layout.jsx'
import { shuffledFacts } from './facts.js'

// L'aimant à manipuler (et le code de simulation du prototype) est chargé à
// part : le texte de l'accueil s'affiche tout de suite.
const HeroMagnet = lazy(() => import('./HeroMagnet.jsx'))

export default function Home() {
  const [facts] = useState(shuffledFacts)
  const [k, setK] = useState(0)
  const step = (d) => setK((i) => (i + d + facts.length) % facts.length)

  return (
    <Layout current="accueil">
      <div className="welcome-head">
        <h1>Un aimant, ça se voit, ça se tord, et ça se souvient.</h1>
        <p className="lead">
          Attrape l’aimant : la limaille dessine son champ invisible. Ensuite, descends à l’échelle du nanomètre, là où ton disque dur range tes données.
        </p>
      </div>

      <div className="hero-band">
        <div className="hero-canvas">
          <Suspense fallback={null}>
            <HeroMagnet />
          </Suspense>
        </div>
        <p className="fig-cap">
          <b>Essaie</b> : attrape l’aimant par le milieu pour le déplacer, par un bout pour le tourner.
        </p>
      </div>

      <div className="doors">
        <a className="door" href="#decouverte">
          <span className="door-n">1</span>
          <h2>Découvrir</h2>
          <p>Essaie les cinq réglages du bac à sable et observe comment ils changent les motifs magnétiques.</p>
          <strong>Commencer →</strong>
        </a>
        <a className="door" href="#xp-sandbox">
          <span className="door-n">2</span>
          <h2>Bac à sable</h2>
          <p>Trois textures magnétiques à explorer. Cinq paramètres pour les transformer. Une nappe sonore pour les écouter.</p>
          <strong>Jouer →</strong>
        </a>
        <a className="door" href="#application">
          <span className="door-n">3</span>
          <h2>Applications</h2>
          <p>Écris une lettre sur un disque dur et fais vibrer la membrane d’un haut-parleur.</p>
          <strong>Expérimenter →</strong>
        </a>
      </div>

      <section className="did" aria-labelledby="did-title">
        <span className="did-mark" aria-hidden="true">
          ?
        </span>
        <h2 id="did-title">LE SAVAIS-TU ?</h2>
        <p className="did-fact" aria-live="polite">
          {facts[k]}
        </p>
        <div className="did-nav">
          <button className="btn" onClick={() => step(-1)} aria-label="Fait précédent">
            ←
          </button>
          <span className="did-count">
            {k + 1} / {facts.length}
          </span>
          <button className="btn" onClick={() => step(1)} aria-label="Fait suivant">
            →
          </button>
        </div>
      </section>

      <footer className="project-footer">
        <h2>Crédits</h2>
        <p>Magnet’Art / Aimantarium — Alexis Pécheux, Axel Arnaud, Abderrazzaq Moufidi et Bernard Chacinski.</p>
        <details>
          <summary>Comment ça marche ?</summary>
          <p>Dans le bac à sable, le film magnétique est découpé en petites cellules. Chacune porte une aimantation représentée par un vecteur de longueur constante, dont le calcul fait évoluer la direction.</p>
          <p>Les motifs résultent de la compétition entre plusieurs interactions :</p>
          <ul>
            <li><b>Échange (A) :</b> favorise l’alignement entre cellules voisines.</li>
            <li><b>Anisotropie (K) :</b> favorise certaines directions d’aimantation (hors du plan ou dans le plan selon le signe de K).</li>
            <li><b>Interaction de Dzyaloshinskii–Moriya (DMI, D) :</b> favorise une rotation de l’aimantation avec un sens privilégié.</li>
            <li><b>Champ extérieur :</b> tend à orienter l’aimantation dans sa direction.</li>
            <li><b>Champ démagnétisant :</b> représente l’interaction magnétostatique entre les différentes parties du film, lorsqu’il est activé.</li>
          </ul>
          <p>Le moteur calcule le champ effectif associé à ces interactions par différences finies sur une grille 2D et, pour le champ démagnétisant, par transformées de Fourier rapides (FFT) avec un modèle de film uniforme dans son épaisseur. L’équation de Landau–Lifshitz–Gilbert décrit la précession de l’aimantation autour de ce champ et son amortissement. Elle est intégrée par Runge–Kutta d’ordre 4 (RK4), puis chaque vecteur est renormalisé.</p>
          <p>Pour conserver une simulation interactive sur téléphone, la grille est fixe pendant l’évolution, le champ démagnétisant est réactualisé tous les deux pas d’intégration lorsqu’il est activé, et reste constant entre ces mises à jour, y compris pendant les sous-étapes RK4. Les couleurs représentent la direction de l’aimantation (ou la composante sélectionnée) ; les flèches permettent de visualiser son orientation.</p>
          <p><b>Limites :</b> si deux cellules voisines présentent un angle d’environ 30° ou plus, une alerte indique que la variation spatiale de l’aimantation risque d’être mal résolue. Ce seuil est indicatif, et l’absence d’alerte ne garantit pas la convergence numérique. Cette application vise à comprendre qualitativement la formation des structures magnétiques, pas à prédire les propriétés d’un matériau réel.</p>
        </details>
      </footer>
    </Layout>
  )
}
