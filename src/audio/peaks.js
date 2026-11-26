// Détection des « pics de changement » de l'état du film.
//
// À chaque mesure, on forme un vecteur des grandeurs (activité, parois, ⟨mz⟩,
// |Q|, aimant…) et on calcule sa vitesse de variation r = |Δv| / Δt, lissée.
// Un pic est déclaré quand r dépasse un seuil ADAPTATIF :
//     seuil = max(plancher, moyenne(r) + k · écart-type(r))
// moyenne et écart-type étant suivis sur ~20 s. Le seuil s'ajuste donc au
// monde et à la façon de jouer : atteignable par un vrai geste (aimant posé,
// champ modifié, skyrmion créé), mais pas par l'agitation de fond. Le plancher
// empêche un film presque immobile de déclencher sur son bruit.
// Après un pic, il faut que r redescende sous 70 % du seuil (réarmement) et
// qu'un délai minimal soit écoulé.

export class PeakDetector {
  constructor({ floor = 0.35, k = 2.5, refractory = 4, tauFast = 0.3, tauSlow = 20 } = {}) {
    Object.assign(this, { floor, k, refractory, tauFast, tauSlow })
    this.prev = null
    this.t = null
    this.rate = 0
    this.mean = 0
    this.var = 0
    this.armed = true
    this.last = -Infinity
  }

  // t en secondes, v tableau de grandeurs. Renvoie l'intensité du pic
  // (rapport r / seuil, ≥ 1) ou 0.
  push(t, v) {
    if (!this.prev || this.t === null) {
      this.prev = v.slice()
      this.t = t
      return 0
    }
    const dt = Math.max(t - this.t, 1e-3)
    let d2 = 0
    for (let i = 0; i < v.length; i++) d2 += (v[i] - this.prev[i]) ** 2
    this.prev = v.slice()
    this.t = t
    const raw = Math.sqrt(d2) / dt
    this.rate += (raw - this.rate) * (1 - Math.exp(-dt / this.tauFast))
    const a = 1 - Math.exp(-dt / this.tauSlow)
    const dev = this.rate - this.mean
    this.mean += a * dev
    this.var = (1 - a) * (this.var + a * dev * dev)
    this.threshold = Math.max(this.floor, this.mean + this.k * Math.sqrt(this.var))
    if (!this.armed && this.rate < 0.7 * this.threshold) this.armed = true
    if (this.armed && this.rate > this.threshold && t - this.last > this.refractory) {
      this.armed = false
      this.last = t
      return this.rate / this.threshold
    }
    return 0
  }
}

// Vecteur suivi pour les pics (pondérations : chaque grandeur compte à peu près
// autant pour un changement « franc »).
export function featureVector(f) {
  const m = f.magnet
  return [
    f.activity,
    1.5 * f.walls,
    0.5 * f.mz,
    Math.min(Math.abs(f.Q), 4) / 2,
    f.inPlane,
    f.planar ?? 0,
    2 * Math.min(f.texture ?? 0, 0.4),
    m ? 0.5 + 0.5 * m.strength : 0,
  ]
}
