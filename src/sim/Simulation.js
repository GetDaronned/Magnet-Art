// Logique de simulation extraite du Sandbox du prototype MicroMag.
// Aucune dépendance à React ni au DOM : le solveur LLG est dans FilmCore.
import { FilmCore } from './FilmCore.js'
import { TAU, clamp } from './math.js'

// Unités : Ms kA/m, A pJ/m, K kJ/m³, D mJ/m², B mT, longueurs nm.
// Trois « mondes » ; seuls A, K, D, B et le champ démagnétisant sont réglables.
// arrows : flèches affichées par défaut en arrivant dans le monde (la case
// « Flèches » du panneau reste modifiable ensuite).
export const WORLDS = {
  // DMI au-delà du seuil Dc = 4√(AK)/π ≈ 1,7 mJ/m² : parois d'énergie négative,
  // le film se remplit de domaines en labyrinthe. Échange faible (A = 3) :
  // bandes fines, d'environ 10 nm (3 cellules).
  labyrinth: { label: 'Labyrinthe', Ms: 580, A: 3, K: 600, D: 4.2, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 0, demag: true, radius: 25, shape: 'rectangle', fill: true, initial: 'random', arrows: false },
  // Co/Pt effectif (K ≈ Ku − μ0Ms²/2) sous faible champ : skyrmion isolé.
  skyrmion: { label: 'Skyrmion', Ms: 580, A: 15, K: 600, D: 3.5, alpha: 0.3, thick: 1, Lx: 192, Ly: 192, nx: 64, ny: 64, Bx: 0, By: 0, Bz: 20, demag: true, radius: 25, shape: 'rectangle', fill: true, initial: 'skyrmion', arrows: false },
  // Paroi de domaine dans un ruban (comme le tutoriel « Domaines et parois ») :
  // une seule rangée de 160 cellules de 3 nm. À gauche le domaine ↑, à droite
  // le domaine ↓. Le champ Bz pousse la paroi ; D la rend de type Néel. Vue
  // dédiée (view: 'wall') : ruban vu de dessus et flèches vues de côté.
  // Sans champ démagnétisant (noDemag) : inutile et très coûteux en 1D.
  wall: { label: 'Paroi', Ms: 580, A: 15, K: 500, D: 2, alpha: 0.3, thick: 1, Lx: 480, Ly: 3, nx: 160, ny: 1, Bx: 0, By: 0, Bz: 10, demag: false, radius: 25, shape: 'rectangle', fill: false, initial: 'wall', arrows: false, view: 'wall', noDemag: true },
  // Disque de permalloy : la magnétostatique enroule l'aimantation en vortex.
  vortex: { label: 'Vortex', Ms: 800, A: 13, K: 0, D: 0, alpha: 0.05, thick: 10, Lx: 200, Ly: 200, nx: 48, ny: 48, Bx: 0, By: 0, Bz: 0, demag: true, radius: 25, shape: 'disk', fill: false, initial: 'vortex', arrows: true },
}

// Paramètres réglables en direct : [clé, libellé, unité, min, max, pas]
export const PHYS_SPEC = [
  ['A', 'Échange', 'pJ/m', 1, 40, 0.5],
  ['K', 'Anisotropie', 'kJ/m³', -300, 1500, 10],
  ['D', 'DMI', 'mJ/m²', -6, 6, 0.1],
  ['Bz', 'Hors plan (Bz)', 'mT', -500, 500, 5],
]
// Rayon du joystick (champ dans le plan, mT).
export const B_INPLANE_MAX = 200

export const PHYS_KEYS = ['A', 'K', 'D', 'Bx', 'By', 'Bz', 'demag']

export function worldPhys(id) {
  const w = WORLDS[id]
  return Object.fromEntries(PHYS_KEYS.map((k) => [k, w[k]]))
}

// Ramène les paramètres réglables dans leur domaine valide.
export function sanitize(raw) {
  const p = { ...raw }
  for (const [key, , , min, max] of PHYS_SPEC) {
    const v = Number(p[key])
    p[key] = Number.isFinite(v) ? clamp(v, min, max) : 0
  }
  for (const key of ['Bx', 'By']) {
    const v = Number(p[key])
    p[key] = Number.isFinite(v) ? clamp(v, -B_INPLANE_MAX, B_INPLANE_MAX) : 0
  }
  p.demag = !!p.demag && !p.noDemag
  return p
}

// Adapte le film au rapport hauteur/largeur de l'écran : même taille de cellule
// (Lx/Nx) et à peu près le même nombre de cellules, pour un coût de calcul inchangé.
export function fitToAspect(p, aspect) {
  const cell = p.Lx / p.nx
  const n = p.nx * p.ny
  let nx = Math.round(Math.sqrt(n / aspect))
  let ny = Math.round(nx * aspect)
  const k = Math.min(1, 128 / Math.max(nx, ny))
  nx = clamp(Math.round(nx * k), 12, 128)
  ny = clamp(Math.round(ny * k), 12, 128)
  return { ...p, nx, ny, Lx: nx * cell, Ly: ny * cell }
}

export class Simulation {
  constructor(params) {
    this.p = sanitize(params)
    this.t = 0
    // Temps simulé (s) par seconde réelle à vitesse 1.
    this.timeScale = 1.8e-9
    // Champ ajouté par le magnétomètre du téléphone (mT), en plus du réglage.
    this.phoneB = [0, 0, 0]
    this.build()
    this.init(this.p.initial)
  }

  build() {
    const p = this.p
    const nx = p.nx
    const ny = p.ny
    const dx = (p.Lx * 1e-9) / nx
    const dy = (p.Ly * 1e-9) / ny
    let mask = null
    if (p.shape === 'disk') {
      mask = new Uint8Array(nx * ny)
      const cx = p.Lx * 0.5
      const cy = p.Ly * 0.5
      const r = 0.49 * Math.min(p.Lx, p.Ly)
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = ((i + 0.5) * p.Lx) / nx - cx
          const y = ((j + 0.5) * p.Ly) / ny - cy
          mask[j * nx + i] = x * x + y * y <= r * r ? 1 : 0
        }
      }
    }
    const c = new FilmCore(nx, ny, dx, { dy, mask, thickness: p.thick * 1e-9, demag: p.demag })
    // Contour exact du disque, en unités de cellules (utilisé par le rendu).
    if (mask) {
      const r = 0.49 * Math.min(p.Lx, p.Ly)
      c.disk = { rx: (r * nx) / p.Lx, ry: (r * ny) / p.Ly }
    }
    c.Ms = p.Ms * 1e3
    c.alpha.fill(p.alpha)
    this.core = c
    this.nx = nx
    this.ny = ny
    this.applyPhysics()
  }

  applyPhysics() {
    const p = this.p
    const c = this.core
    c.A = p.A * 1e-12
    c.Kc = p.K * 1e3
    c.D = p.D * 1e-3
    this.setFieldOnCore()
    c.prepare()
    this.preparedB = Math.hypot(c.Bx, c.By, c.Bz)
    this.lex = Math.sqrt((2 * c.A) / (4e-7 * Math.PI * c.Ms * c.Ms))
  }

  setFieldOnCore() {
    const p = this.p
    const c = this.core
    const pb = this.phoneB || [0, 0, 0]
    c.Bx = (p.Bx + pb[0]) * 1e-3
    c.By = (p.By + pb[1]) * 1e-3
    c.Bz = (p.Bz + pb[2]) * 1e-3
  }

  // Champ du téléphone (mT, repère de l'écran), ajouté au champ réglé. Appelé
  // ~10 fois par seconde : on ne recalcule le pas de temps (et le noyau FFT)
  // que si le champ total dépasse nettement celui du dernier calcul.
  setPhoneField(b) {
    this.phoneB = b
    this.setFieldOnCore()
    const c = this.core
    if (Math.hypot(c.Bx, c.By, c.Bz) > this.preparedB + 0.05) {
      c.prepare()
      this.preparedB = Math.hypot(c.Bx, c.By, c.Bz)
    }
  }

  // Modifie A, K, D, B ou le champ démagnétisant sans réinitialiser
  // l'aimantation : la configuration actuelle évolue sous les nouveaux paramètres.
  setPhysics(raw) {
    const next = sanitize({ ...this.p, ...raw })
    const rebuild = next.demag !== this.p.demag
    this.p = next
    if (!rebuild) {
      this.applyPhysics()
      return
    }
    // Le noyau FFT n'existe que si demag est actif à la construction.
    const old = this.core
    this.build()
    const c = this.core
    c.mx.set(old.mx)
    c.my.set(old.my)
    c.mz.set(old.mz)
    c.invalidate()
  }

  init(kind) {
    const c = this.core
    const { nx, ny } = this
    c.mx.fill(0)
    c.my.fill(0)
    c.mz.fill(1)
    if (kind === 'inplane') {
      c.mx.fill(1)
      c.mz.fill(0)
    } else if (kind === 'stripes') {
      const period = Math.max(6, nx / 3)
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          c.mz[j * nx + i] = Math.sin((TAU * (i + 0.5)) / period) >= 0 ? 1 : -1
        }
      }
    } else if (kind === 'random') {
      c.randomize()
    } else if (kind === 'wall') {
      // Paroi au tiers du ruban : ↑ à gauche, ↓ à droite (profil en tanh).
      const w = Math.max(this.lex, Math.sqrt(c.A / Math.max(c.Kc, 1e3)))
      const x0 = 0.3 * nx * c.dx
      for (let i = 0; i < nx; i++) {
        const u = ((i + 0.5) * c.dx - x0) / w
        for (let j = 0; j < ny; j++) {
          const id = j * nx + i
          c.mz[id] = -Math.tanh(u)
          c.my[id] = 1 / Math.cosh(u)
          c.mx[id] = 0
        }
      }
      this.wallHist = []
    } else if (kind === 'vortex') {
      // Enroulement dans le plan autour du centre, cœur hors du plan (+z).
      const core = Math.max(this.lex, c.dx) * 1.5
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const id = j * nx + i
          const x = (i + 0.5 - nx / 2) * c.dx
          const y = (j + 0.5 - ny / 2) * c.dy
          const r = Math.hypot(x, y)
          c.mx[id] = -y
          c.my[id] = x
          c.mz[id] = 2 * core * Math.exp(-(r * r) / (core * core))
        }
      }
    }
    c.normalizeAll()
    if (kind === 'skyrmion') this.placeSeed(nx / 2, ny / 2)
    c.invalidate()
    this.t = 0
    this.computeStats()
  }

  // Graine chirale de skyrmion centrée en (cx, cy), coordonnées en cellules.
  placeSeed(cx, cy) {
    const c = this.core
    const { nx, ny } = this
    const radius = this.p.radius * 1e-9
    const width = Math.max(Math.min(this.lex, radius / 3), Math.min(c.dx, c.dy))
    const chirality = this.p.D < 0 ? -1 : 1
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i
        if (c.mask && c.mask[id] !== 1) continue
        const x = (i + 0.5 - cx) * c.dx
        const y = (j + 0.5 - cy) * c.dy
        const r = Math.hypot(x, y)
        if (r > radius + 4 * width) continue
        const theta = 2 * Math.atan(Math.exp(clamp((radius - r) / width, -35, 35)))
        const phi = Math.atan2(y, x)
        c.mx[id] = chirality * Math.sin(theta) * Math.cos(phi)
        c.my[id] = chirality * Math.sin(theta) * Math.sin(phi)
        c.mz[id] = Math.cos(theta)
      }
    }
    c.normalizeAll()
    c.invalidate()
  }

  // Aimant virtuel : dipôle ponctuel vertical placé à la hauteur h au-dessus
  // du point (cx, cy) (en cellules). `strength` = |B| sous l'aimant (mT).
  // pole 'N' : pôle nord face au film, le champ sous l'aimant pointe vers −z.
  // null : retire l'aimant.
  setMagnet(m) {
    const c = this.core
    if (!m || !(m.strength > 0)) {
      c.localOn = false
      return
    }
    // Le pas de temps stable dépend du champ maximal : on le recalcule si besoin.
    const bound = m.strength * 1e-3
    if (bound > c.extraFieldBound * 1.001 || bound < c.extraFieldBound * 0.5) {
      c.extraFieldBound = bound
      c.prepare()
    }
    const { nx, ny } = this
    const h = Math.max(m.height, 1) * 1e-9
    const amp = m.strength * 1e-3 * 0.5 * h * h * h * (m.pole === 'S' ? 1 : -1)
    const h2 = h * h
    for (let j = 0; j < ny; j++) {
      const y = (j + 0.5 - m.cy) * c.dy
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i
        const x = (i + 0.5 - m.cx) * c.dx
        const r2 = x * x + y * y + h2
        const ir3 = 1 / (r2 * Math.sqrt(r2))
        const ir5 = ir3 / r2
        // B = amp · (3 (ẑ·r) r / r⁵ − ẑ / r³), avec r = (x, y, −h)
        c.lbx[id] = amp * -3 * h * x * ir5
        c.lby[id] = amp * -3 * h * y * ir5
        c.lbz[id] = amp * (3 * h2 * ir5 - ir3)
      }
    }
    c.localOn = true
  }

  // Avance la simulation d'un intervalle réel `dtReal` (s), budget CPU ~11 ms.
  advance(dtReal, speed) {
    const c = this.core
    const dt = c.dt
    const target = this.timeScale * speed * dtReal
    const t0 = performance.now()
    let adv = 0
    let k = 0
    while (adv < target) {
      c.step(dt, this.t)
      this.t += dt
      adv += dt
      k++
      // Avec la FFT une étape coûte cher : on vérifie le budget à chaque fois.
      if ((c.demagOn || (k & 3) === 0) && performance.now() - t0 > 11) break
    }
  }

  // Mesures sur la paroi du monde « Paroi » (première rangée du ruban).
  // xw : position (nm) où mz change de signe, ou null si la paroi est sortie ;
  // width : Δ = √(A/K) (nm) ; v : vitesse (m/s, sur ~0,3 ns simulées) ;
  // type : Néel (rotation dans le plan x–z, favorisée par D), Bloch (dans le
  // plan y–z), intermédiaire, ou « en précession » : sans DMI ni anisotropie
  // dans le plan, rien ne fixe l'angle interne φ de la paroi ; poussée par un
  // champ, elle tourne sur elle-même (φ défile) et avance beaucoup moins vite.
  // Alertes si D dépasse le seuil Dc = 4√(AK)/π
  // (la paroi n'est plus stable) ou si la paroi est plus fine qu'une cellule.
  wallInfo() {
    const c = this.core
    const { nx } = this
    const mz = c.mz
    let xw = null
    let ic = 0
    for (let i = 0; i < nx - 1; i++) {
      if ((mz[i] > 0) !== (mz[i + 1] > 0)) {
        const f = mz[i] / (mz[i] - mz[i + 1])
        xw = (i + 0.5 + f) * c.dx
        ic = f < 0.5 ? i : i + 1
        break
      }
    }
    // Historique sur ~0,3 ns simulées : [t, position, angle φ déroulé].
    const h = (this.wallHist = this.wallHist || [])
    let v = null
    let spin = 0
    let type = null
    if (xw !== null) {
      let phi = Math.atan2(c.my[ic], c.mx[ic])
      if (h.length) {
        const prev = h[h.length - 1][2]
        phi += 2 * Math.PI * Math.round((prev - phi) / (2 * Math.PI))
      }
      h.push([this.t, xw, phi])
      while (h.length > 2 && h[h.length - 1][0] - h[0][0] > 0.3e-9) h.shift()
      const [t0, x0, p0] = h[0]
      if (this.t - t0 > 0.05e-9) {
        v = (xw - x0) / (this.t - t0)
        spin = (phi - p0) / (this.t - t0)
      }
      const ip = Math.hypot(c.mx[ic], c.my[ic])
      if (Math.abs(spin) > 0.5e9) type = 'en précession'
      else if (ip > 0.3) {
        const cx = Math.abs(c.mx[ic]) / ip
        type = cx > 0.85 ? 'Néel' : cx < 0.53 ? 'Bloch' : 'intermédiaire'
      }
    } else h.length = 0
    const K = c.Kc
    const width = K > 0 ? Math.sqrt(c.A / K) : null
    const Dc = K > 0 ? (4 / Math.PI) * Math.sqrt(c.A * K) : 0
    return {
      xw: xw === null ? null : xw * 1e9,
      length: nx * c.dx * 1e9,
      width: width === null ? null : width * 1e9,
      v,
      type,
      unstable: K > 0 && Math.abs(c.D) > Dc,
      tooThin: width !== null && width < 1.2 * c.dx,
      inPlane: K <= 0,
      Dc: Dc * 1e3,
    }
  }

  // Grandeurs pour la sonification. `elapsed` = temps réel (s) depuis l'appel
  // précédent. activity : |Δm| moyen ramené à 100 ms, en échelle log
  // (≈ 0 au repos, ≈ 0.5 pour un skyrmion poussé, 1 pour un état désordonné).
  audioFeatures(elapsed) {
    const c = this.core
    const { act, mx, my, mz } = c
    const n = act.length
    if (!this.prevM || this.prevM.length !== 3 * c.n) {
      this.prevM = new Float64Array(3 * c.n)
      this.prevM.set(mx, 0)
      this.prevM.set(my, c.n)
      this.prevM.set(mz, 2 * c.n)
    }
    const pm = this.prevM
    const o1 = c.n
    const o2 = 2 * c.n
    let d = 0
    let walls = 0
    let sz = 0
    let sx = 0
    let sy = 0
    let circ = 0
    let planar = 0
    let texture = 0
    const { nbR, nbU } = c
    const cx = c.nx / 2
    const cy = c.ny / 2
    const R = Math.max(c.nx, c.ny) / 2
    for (let q = 0; q < n; q++) {
      const i = act[q]
      const ax = mx[i] - pm[i]
      const ay = my[i] - pm[o1 + i]
      const az = mz[i] - pm[o2 + i]
      d += Math.sqrt(ax * ax + ay * ay + az * az)
      pm[i] = mx[i]
      pm[o1 + i] = my[i]
      pm[o2 + i] = mz[i]
      if (Math.abs(mz[i]) < 0.5) walls++
      sz += mz[i]
      sx += mx[i]
      sy += my[i]
      // Enroulement autour du centre : (r × m)_z, r en unités du demi-film.
      const x = ((i % c.nx) + 0.5 - cx) / R
      const y = (Math.floor(i / c.nx) + 0.5 - cy) / R
      circ += x * my[i] - y * mx[i]
      planar += 1 - mz[i] * mz[i]
      // Texture : écart de m avec ses voisins de droite et du haut.
      const r = nbR[i]
      const u = nbU[i]
      texture +=
        (mx[i] - mx[r]) ** 2 + (my[i] - my[r]) ** 2 + (mz[i] - mz[r]) ** 2 +
        (mx[i] - mx[u]) ** 2 + (my[i] - my[u]) ** 2 + (mz[i] - mz[u]) ** 2
    }
    d = ((d / n) * 0.1) / Math.max(elapsed, 0.02)
    const activity = clamp((Math.log10(d + 1e-9) + 2.6) / 2.2, 0, 1)
    // inPlane : |⟨m∥⟩|, nul pour un vortex centré, croît quand son cœur se décale.
    return {
      activity,
      walls: walls / n,
      mz: sz / n,
      inPlane: Math.hypot(sx, sy) / n,
      // circulation > 0 : enroulement antihoraire (≈ 0,6 pour un vortex).
      circulation: circ / n,
      // planar : ⟨1 − mz²⟩, 0 hors du plan, 1 couché dans le plan.
      planar: planar / n,
      // texture : ⟨|∇m|²⟩ par cellule, 0 pour tout état uniforme.
      texture: texture / n,
      // Charge topologique (≈ nombre de skyrmions), recalculée à chaque mesure.
      Q: c.topoCharge(),
      // Temps simulé : s'il recule, la simulation a été relancée.
      simTime: this.t,
    }
  }

  computeStats() {
    const c = this.core
    const n = c.act.length
    let mz = 0
    for (let q = 0; q < n; q++) mz += c.mz[c.act[q]]
    this.stats = { t: this.t, mz: mz / n, Q: c.topoCharge() }
    return this.stats
  }
}
