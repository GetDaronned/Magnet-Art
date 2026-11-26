// La carte des sons : position du film entre les trois archétypes sonores,
// calculée uniquement à partir de l'état mesuré de l'aimantation (et non du
// bouton de monde choisi).
//
// Deux axes :
//  - planar = ⟨1 − mz²⟩ : aimantation hors du plan (0) ou couchée (1) ;
//  - texture = ⟨|∇m|²⟩ par cellule : uniforme (0) ou pleine de motifs.
//
// Valeurs mesurées (scénarios de calibration, 64 à 85 cellules de large) :
//   skyrmion isolé          planar 0,04  texture 0,013
//   bulles sous fort champ  planar 0,06  texture 0,03
//   labyrinthe (A = 15)     planar 0,30  texture 0,14 à 0,40
//   labyrinthe fin (A = 3)  planar 0,44  texture 1,7
//   labyrinthe qui se couche (K < 0)    planar 0,60  texture 0,16
//   vortex                  planar 1,00  texture 0,014
//   uniforme dans le plan   planar 1,00  texture 0
//
//            texture faible ───────────────► forte
//   hors plan   skyrmion (trous, bulles)  →  labyrinthe
//       │
//   couché      vortex (tourbillon ; sans enroulement, la rotation s'efface)

export const ARCHETYPES = ['skyrmion', 'labyrinth', 'vortex']

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Poids des trois archétypes (somme 1).
export function soundMap(f) {
  const v = smooth(0.5, 0.85, f.planar ?? 0)
  const l = smooth(0.04, 0.15, f.texture ?? 0)
  return { skyrmion: (1 - v) * (1 - l), labyrinth: (1 - v) * l, vortex: v }
}
