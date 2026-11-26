import { Suspense, lazy, useEffect, useState } from 'react'
import Home from './pages/Home.jsx'
import Sandbox from './pages/Sandbox.jsx'

// La Découverte (et le code de simulation du prototype qu'elle utilise)
// n'est chargée qu'à la demande.
const Discover = lazy(() => import('./discover/Discover.jsx'))
const Explore = lazy(() => import('./discover/Explore.jsx'))
const Quiz = lazy(() => import('./discover/Quiz.jsx'))
const Applications = lazy(() => import('./applications/Applications.jsx'))
const DiskTutorial = lazy(() => import('./applications/DiskTutorial.jsx'))
const Speaker = lazy(() => import('./applications/Speaker.jsx'))
const DiskFree = lazy(() => import('./applications/DiskFree.jsx'))

// Navigation par l'ancre de l'URL (mêmes noms que le prototype Aimantarium),
// compatible avec un hébergement statique (GitHub Pages) :
//   #accueil · #decouverte · #explore-<chapitre> (atelier) ·
//   #guide-<chapitre> (quiz) · #application · #guide-disk (tutoriel du disque) ·
//   #xp-disk (disque, pour aller plus loin) · #guide-haut-parleur · #xp-sandbox
function currentRoute() {
  const r = window.location.hash.replace(/^#\/?/, '')
  if (/^(explore|guide)-[\w-]+$/.test(r) || ['decouverte', 'application', 'xp-disk', 'xp-sandbox'].includes(r)) return r
  return 'accueil'
}

function Page({ route }) {
  if (route === 'xp-sandbox') return <Sandbox />
  if (route === 'decouverte') return <Discover />
  if (route === 'application') return <Applications />
  if (route === 'guide-disk') return <DiskTutorial />
  // L'ancien compteur de vélo (V18) est remplacé par le haut-parleur (V19).
  if (route === 'guide-haut-parleur' || route === 'guide-capteur') return <Speaker />
  if (route === 'xp-disk') return <DiskFree />
  if (route.startsWith('explore-')) return <Explore id={route.slice(8)} />
  if (route.startsWith('guide-')) return <Quiz id={route.slice(6)} />
  return <Home />
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <Suspense fallback={<div className="page" />}>
      <Page key={route} route={route} />
    </Suspense>
  )
}
