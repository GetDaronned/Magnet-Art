// Magnétomètre d'un téléphone, lu en direct via l'« accès à distance » de
// phyphox (https://phyphox.org/docs/remote-interface/).
//
// Dans phyphox : ouvrir l'expérience « Magnétomètre », menu ⋮ > « Autoriser
// l'accès à distance ». L'app affiche une adresse du type
// http://192.168.1.42:8080 (port 8080 par défaut sur Android, 80 sur iOS).
//
// Contraintes :
//  - le serveur de phyphox parle HTTP (pas HTTPS). Un navigateur refuse
//    qu'une page chargée en https l'interroge : il faut ouvrir Aimantarium en
//    http (en local : npm run dev). phyphox envoie
//    Access-Control-Allow-Origin: *, donc la requête est permise depuis
//    une page http ;
//  - l'ordinateur et le téléphone doivent être sur le même réseau.
//
// API utilisée : /config (noms des buffers), /get?x&y&z (dernière valeur de
// chaque buffer), /control?cmd=start (lancer la mesure).
//
// Mesure : champ (µT) dans le repère du téléphone (x vers la droite de son
// écran, y vers le haut, z sortant de l'écran). Téléphone posé à plat, écran
// vers le haut : c'est le repère du film vu de dessus. On ne garde que la
// PERTURBATION : le champ ambiant (Terre, environnement) est moyenné au
// début, et sur « Recalibrer », puis pris comme zéro.

const PERIOD = 80 // ms entre deux requêtes (une seule en vol à la fois)
const CALIB_SAMPLES = 8
const SMOOTH = 0.35
const DEADZONE = 3 // µT : en dessous, la perturbation est ignorée

// « 192.168.1.42:8080 », « http://192.168.1.42:8080/ »… -> URL de base.
export function phyphoxBase(address) {
  let a = address.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(a)) a = 'http://' + a
  return a
}

// Cherche les buffers x, y, z du magnétomètre dans la configuration.
function findBuffers(config) {
  const names = (config.buffers || []).map((b) => (typeof b === 'string' ? b : b.name)).filter(Boolean)
  for (const pattern of [/^mag([XYZ])$/i, /mag.*?([XYZ])$/i, /^b([XYZ])$/i]) {
    const pick = ['x', 'y', 'z'].map((ax) => names.find((n) => (n.match(pattern) || [])[1]?.toLowerCase() === ax))
    if (pick.every(Boolean)) return pick
  }
  return null
}

export class PhyphoxSource {
  constructor(address, onStatus) {
    this.base = phyphoxBase(address)
    this.onStatus = onStatus
    this.names = ['magX', 'magY', 'magZ']
    this.alive = false
    this.zero = null
    this.acc = []
    this.d = [0, 0, 0]
    this.measuring = null
  }

  async connect() {
    this.alive = true
    if (window.location.protocol === 'https:') {
      this.onStatus('Cette page est en https : le navigateur bloque l’accès à phyphox (http). Ouvre Aimantarium en local (npm run dev).')
      this.alive = false
      return
    }
    this.onStatus('Connexion à ' + this.base + '…')
    try {
      const config = await this.json('/config')
      const found = findBuffers(config)
      if (found) this.names = found
      else if (config.title) {
        this.onStatus(`Expérience « ${config.localTitle || config.title} » ouverte dans phyphox : ouvre plutôt « Magnétomètre ».`)
        this.alive = false
        return
      }
    } catch (err) {
      // /config indisponible : on tente directement les noms habituels.
      if (err.name === 'TypeError' || err.name === 'AbortError') {
        this.onStatus('Téléphone injoignable. Vérifie l’adresse, le même Wi-Fi, et l’accès à distance activé dans phyphox.')
        this.alive = false
        return
      }
    }
    this.recalibrate()
    this.loop()
  }

  async json(path) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    try {
      const r = await fetch(this.base + path, { signal: ctrl.signal, cache: 'no-store' })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return await r.json()
    } finally {
      clearTimeout(timer)
    }
  }

  async loop() {
    let fails = 0
    while (this.alive) {
      const t0 = performance.now()
      try {
        const res = await this.json('/get?' + this.names.map(encodeURIComponent).join('&'))
        fails = 0
        const measuring = res.status ? !!res.status.measuring : true
        if (measuring !== this.measuring) {
          this.measuring = measuring
          if (!measuring) this.onStatus('Mesure en pause dans phyphox : appuie sur ▶ dans l’app, ou sur « Démarrer la mesure ».')
          else if (this.zero) this.onStatus('ok')
        }
        const v = this.names.map((n) => {
          const b = res.buffer && res.buffer[n] && res.buffer[n].buffer
          return b && b.length ? b[b.length - 1] : null
        })
        if (measuring && v.every((x) => typeof x === 'number' && Number.isFinite(x))) this.onReading(v)
      } catch {
        if (++fails === 3) this.onStatus('Plus de réponse du téléphone (écran éteint ? phyphox fermé ?). Nouvel essai en continu…')
      }
      const wait = PERIOD - (performance.now() - t0)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    }
  }

  async startMeasure() {
    try {
      await this.json('/control?cmd=start')
    } catch {
      this.onStatus('Impossible de lancer la mesure à distance.')
    }
  }

  stop() {
    this.alive = false
    this.d = [0, 0, 0]
  }

  // Le champ ambiant actuel devient le zéro (à refaire si on tourne le téléphone).
  recalibrate() {
    this.zero = null
    this.acc = []
    this.d = [0, 0, 0]
    this.onStatus('Calibration… téléphone immobile, loin des aimants.')
  }

  onReading(v) {
    if (!this.zero) {
      this.acc.push(v)
      if (this.acc.length >= CALIB_SAMPLES) {
        const n = this.acc.length
        this.zero = [0, 1, 2].map((k) => this.acc.reduce((s, a) => s + a[k], 0) / n)
        this.onStatus('ok')
      }
      return
    }
    for (let k = 0; k < 3; k++) this.d[k] += (v[k] - this.zero[k] - this.d[k]) * SMOOTH
  }

  // Perturbation lissée (µT), nulle sous le seuil de bruit.
  delta() {
    const [x, y, z] = this.d
    return Math.hypot(x, y, z) < DEADZONE ? [0, 0, 0] : [x, y, z]
  }
}
