import { useEffect, useRef } from 'react'
import Layout from '../pages/Layout.jsx'
import { ApplicationWorkshop } from '../discover/vendor/aimantarium.js'
import DiskSchema from './DiskSchema.jsx'
import { diskLetter, markDiskComplete, saveDiskLetter } from './progress.js'
import './applications.css'

// Tutoriel du disque dur (Aimantarium V19) : écrire une lettre, la relire,
// comprendre ce que détecte la tête. Le composant du prototype construit son
// contenu dans `root` ; le schéma de la piste s'intercale entre son titre et
// l'activité (voir .app-flow dans applications.css).
export default function DiskTutorial() {
  const root = useRef(null)

  useEffect(() => {
    const el = root.current
    const workshop = new ApplicationWorkshop(el, {
      diskHost: { click() {}, sfx() {} },
      readDiskLetter: diskLetter,
      saveDiskLetter,
      complete: markDiskComplete,
    })
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      workshop.frame(Math.min(0.05, (now - last) / 1000 || 0.016))
      last = now
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      el.textContent = ''
    }
  }, [])

  return (
    <Layout current="application" wide>
      <div className="app-flow">
        <div ref={root} className="app-flow-root" />
        <section className="app-explain app-flow-insert" aria-labelledby="disk-schema-title">
          <h2 id="disk-schema-title">Qu’est-ce que la piste magnétique ?</h2>
          <DiskSchema />
        </section>
      </div>
    </Layout>
  )
}
