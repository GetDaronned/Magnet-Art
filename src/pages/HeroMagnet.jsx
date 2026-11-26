import { useState } from 'react'
import Stage from '../discover/Stage.jsx'
import { FilingsSim } from '../discover/vendor/aimantarium.js'
import { makeHost } from '../discover/sim.js'

// L'aimant de l'accueil (Aimantarium V19) : de la limaille de fer et ses
// lignes de champ autour d'un aimant qu'on attrape par le milieu pour le
// déplacer, ou par un bout pour le tourner.
export default function HeroMagnet() {
  const [sim] = useState(() => new FilingsSim(makeHost(() => {}), { scene: 'bar', disp: 'all' }, { hero: true }))
  return <Stage sim={sim} interactive label="Limaille de fer autour d’un aimant que l’on peut déplacer" />
}
