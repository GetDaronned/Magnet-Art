// Nappe de synthétiseur ambient pilotée par l'état du film magnétique.
// Web Audio pur, sans dépendance.
//
// LE SON EST UN POINT SUR UNE CARTE. Trois archétypes sonores (le trou du
// skyrmion, le dédale du labyrinthe, le tourbillon du vortex) jouent en
// permanence, chacun dans sa couche de voix, dans une tonalité commune. La
// position du film sur la carte (soundMap.js : aimantation couchée ou non,
// texture) donne le poids de chaque couche. Tous les réglages continus
// (filtre, souffle, écho, réverb, rotation…) sont des mélanges pondérés.
// Peu importe comment on arrive à un état (bouton de monde ou curseurs) :
// seul ce que fait le film compte.
//
// Deux échelles de temps :
//  - en continu (~10 fois par seconde), le TIMBRE suit le film, lissé sur ~1 s ;
//  - l'HARMONIE (accord, mode, nombre de notes, tonalité) ne change que sur un
//    PIC DE CHANGEMENT de l'état du film (peaks.js). Plus le pic est fort,
//    plus le saut est grand. Le mode et la progression viennent alors de
//    l'archétype dominant.
//
// Entrées (update) : activity, mz, inPlane, planar, texture,
// circulation, Q, magnet { x, strength ∈ [0,1], pole } ou null.

import { PeakDetector, featureVector } from './peaks.js'
import { ARCHETYPES, soundMap } from './soundMap.js'

// Modes (intervalles en demi-tons depuis la tonique).
export const SCALES = {
  auto: { label: 'Auto (selon le film)' },
  penta: { label: 'Pentatonique', steps: [0, 2, 4, 7, 9] },
  lydian: { label: 'Lydien', steps: [0, 2, 4, 6, 7, 9, 11] },
  ionian: { label: 'Majeur', steps: [0, 2, 4, 5, 7, 9, 11] },
  mixolydian: { label: 'Mixolydien', steps: [0, 2, 4, 5, 7, 9, 10] },
  dorian: { label: 'Dorien', steps: [0, 2, 3, 5, 7, 9, 10] },
  aeolian: { label: 'Mineur', steps: [0, 2, 3, 5, 7, 8, 10] },
  phrygian: { label: 'Phrygien', steps: [0, 1, 3, 5, 7, 8, 10] },
}

// Caractère sonore de chaque archétype.
//  octave : transposition de la couche ; voice : oscillateurs de chaque voix
//  (forme, rapport de fréquence, sens du désaccord, niveau) ; chord : degrés
//  de l'accord ; progression : suite d'accords ; mode(f) : gamme en « auto » ;
//  rotation : circulation des voix dans l'espace.
// Couleur générale : chaleureuse, dans l'esprit d'une musique de méditation.
// Gamme pentatonique majeure par défaut (aucun demi-ton : rien ne frotte),
// accords sans tension, désaccords faibles, réverbération moyenne.
export const PROFILES = {
  // Le trou : un skyrmion est un creux dans l'aimantation. Rond et doux
  // (sinus et triangle, filtre assez fermé, sous-basse légère).
  skyrmion: {
    octave: 0,
    voice: [
      { type: 'sine', ratio: 1, cents: 0, level: 0.5 },
      { type: 'triangle', ratio: 1, cents: -1, level: 0.3 },
      { type: 'sine', ratio: 2, cents: 1, level: 0.12 },
    ],
    chord: [0, 2, 4, 6, 8],
    progression: [0, 3, 5, 4, 1, 2],
    // Pentatonique majeure par défaut ; majeur (accords plus riches) si le
    // film pointe nettement vers le haut, mixolydien (plus doux) vers le bas.
    mode: (f) => (f.mz > 0.5 ? 'ionian' : f.mz > -0.5 ? 'penta' : 'mixolydian'),
    detune: [1, 3],
    filter: { base: 650, act: 1800, motifs: 500, q: 0.7 },
    lfo: { rate: 0.04, depth: 60 },
    rotation: { rate: 0.04, pan: 0.2, amp: 0.05, pitch: 0 },
    noise: { level: 0, freq: 3000, q: 1 },
    delay: { time: 0.45, fb: 0.25, send: 0.1 },
    reverb: 0.5,
    sub: 0.08,
  },
  // Le dédale : une dent de scie adoucie par un triangle et un sinus grave,
  // filtre qui respire, souffle léger qui suit les parois, échos.
  labyrinth: {
    octave: 0,
    voice: [
      { type: 'sawtooth', ratio: 1, cents: -1, level: 0.18 },
      { type: 'triangle', ratio: 1, cents: 1, level: 0.35 },
      { type: 'sine', ratio: 0.5, cents: 0, level: 0.3 },
    ],
    chord: [0, 2, 4, 6, 8],
    progression: [0, 5, 3, 1, 4, 2],
    mode: (f) => (f.mz > 0.3 ? 'ionian' : f.mz > -0.3 ? 'penta' : 'mixolydian'),
    detune: [3, 9],
    filter: { base: 650, act: 2000, motifs: 900, q: 1 },
    lfo: { rate: 0.12, depth: 250 },
    rotation: { rate: 0.1, pan: 0.25, amp: 0.1, pitch: 0 },
    noise: { level: 0.025, freq: 1400, q: 0.8 },
    delay: { time: 0.62, fb: 0.35, send: 0.22 },
    reverb: 0.45,
    sub: 0,
  },
  // Le tourbillon : orgue doux (quinte ajoutée), accords en quartes. Les voix
  // tournent autour de l'auditeur, chacune décalée en phase (panoramique et
  // volume, comme une cabine Leslie, avec un très léger effet Doppler), dans
  // le sens de l'enroulement de l'aimantation ; plus vite quand le film
  // s'agite. Sans enroulement (aimantation couchée uniforme), la rotation
  // s'efface.
  vortex: {
    octave: 0,
    voice: [
      { type: 'triangle', ratio: 1, cents: 0, level: 0.4 },
      { type: 'sine', ratio: 1.5, cents: 1, level: 0.18 },
      { type: 'sine', ratio: 0.5, cents: -1, level: 0.35 },
    ],
    chord: [0, 3, 6, 9, 12],
    progression: [0, 4, 1, 5, 3],
    mode: (f) => (f.inPlane > 0.25 ? 'ionian' : 'penta'),
    detune: [2, 4],
    filter: { base: 1200, act: 2500, motifs: 300, q: 1.2 },
    lfo: { rate: 0.08, depth: 150 },
    rotation: { rate: 0.15, pan: 0.9, amp: 0.3, pitch: 2 },
    noise: { level: 0.012, freq: 2500, q: 2 },
    delay: { time: 0.5, fb: 0.35, send: 0.2 },
    reverb: 0.55,
    sub: 0,
  },
}

const ROOT = 50 // ré, tonique commune à toutes les couches
const VOICES = 5
const WARMUP = 3 // s sans pic au démarrage
const FALLBACK = 45 // s : sans aucun pic, l'accord avance quand même
const Q_HYST = 0.75 // écart de Q qui compte comme un vrai changement de topologie
const Q_HOLD = 1.5 // s pendant lesquelles ce nouvel écart doit tenir
const MOD_GAP = 30 // s minimum entre deux modulations
const DOM_HOLD = 2 // s : un nouvel archétype dominant qui tient fait tourner l'harmonie
// Dispositions des voix (octaves ajoutées), variées sur les pics moyens.
const VOICINGS = [
  [0, 0, 0, 0, 0],
  [0, 1, 0, 1, 0],
  [-1, 0, 0, 0, 1],
]

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12)
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

function noteOf(root, steps, degree, octave = 0) {
  const n = steps.length
  const o = Math.floor(degree / n)
  return root + steps[((degree % n) + n) % n] + 12 * (o + octave)
}

// Moyennes pondérées des réglages des archétypes (géométrique pour les
// fréquences, qui se perçoivent en rapport).
function mix(w, get) {
  let s = 0
  for (const id of ARCHETYPES) s += w[id] * get(PROFILES[id])
  return s
}
function mixFreq(w, get) {
  let s = 0
  for (const id of ARCHETYPES) s += w[id] * Math.log(get(PROFILES[id]))
  return Math.exp(s)
}
function dominant(w) {
  return ARCHETYPES.reduce((a, b) => (w[b] > w[a] ? b : a))
}

// Sinusoïde déphasée de φ, pour des LFO synchrones décalés entre les voix.
function phaseWave(ctx, phi) {
  const real = new Float32Array([0, Math.sin(phi)])
  const imag = new Float32Array([0, Math.cos(phi)])
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true })
}

// Réponse impulsionnelle stéréo : bruit à décroissance exponentielle.
function impulse(ctx, seconds) {
  const len = Math.round(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  return buf
}

export class AmbientEngine {
  constructor() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.ctx = ctx
    this.scale = 'auto'
    this.volume = 0.6

    // Sortie : master -> compresseur -> haut-parleurs.
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)

    // Réverbération longue + délai filtré, en parallèle du signal direct.
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = impulse(ctx, 5)
    this.wet = ctx.createGain()
    this.reverb.connect(this.wet).connect(this.master)

    this.delay = ctx.createDelay(2)
    this.fb = ctx.createGain()
    const fbTone = ctx.createBiquadFilter()
    fbTone.type = 'lowpass'
    fbTone.frequency.value = 3200
    this.delay.connect(fbTone).connect(this.fb).connect(this.delay)
    this.delaySend = ctx.createGain()
    this.delaySend.connect(this.delay)
    this.delay.connect(this.reverb)
    this.delay.connect(this.master)

    // Nappe : couches -> filtre résonant commun -> panoramique (aimant) ->
    // volume -> direct / délai / réverb.
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 400
    this.pan = ctx.createStereoPanner()
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.3
    const dry = ctx.createGain()
    dry.gain.value = 0.35
    this.filter.connect(this.pan).connect(this.padGain)
    this.padGain.connect(dry).connect(this.master)
    this.padGain.connect(this.reverb)
    this.padGain.connect(this.delaySend)

    // LFO sur la coupure : la nappe « respire ».
    this.lfo = ctx.createOscillator()
    this.lfoAmt = ctx.createGain()
    this.lfo.connect(this.lfoAmt).connect(this.filter.frequency)
    this.lfo.start()

    // Souffle : bruit blanc en boucle, filtré en bande.
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = nb
    noise.loop = true
    this.noiseBand = ctx.createBiquadFilter()
    this.noiseBand.type = 'bandpass'
    this.noiseGain = ctx.createGain()
    this.noiseGain.gain.value = 0
    noise.connect(this.noiseBand).connect(this.noiseGain).connect(this.pan)
    noise.start()

    // Une couche de 5 voix par archétype. Voix : 3 oscillateurs -> niveau de
    // la note -> trémolo -> panoramique propre -> volume de la couche.
    // Rotation : chaque voix a deux LFO de même fréquence, déphasés de
    // 2π·v/5 d'une voix à l'autre. Le premier la promène gauche/droite, le
    // second (en quadrature) module son volume (devant/derrière) et sa hauteur
    // (Doppler). Les voix circulent ainsi l'une après l'autre.
    this.layers = {}
    for (const id of ARCHETYPES) {
      const P = PROFILES[id]
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(this.filter)
      const voices = []
      for (let v = 0; v < VOICES; v++) {
        const g = ctx.createGain()
        g.gain.value = 0
        const trem = ctx.createGain()
        trem.gain.value = 1 - P.rotation.amp
        const vp = ctx.createStereoPanner()
        g.connect(trem).connect(vp).connect(gain)
        const lfoPan = ctx.createOscillator()
        const lfoQuad = ctx.createOscillator()
        const panAmt = ctx.createGain()
        const ampAmt = ctx.createGain()
        const pitchAmt = ctx.createGain()
        panAmt.gain.value = P.rotation.pan
        ampAmt.gain.value = P.rotation.amp
        pitchAmt.gain.value = P.rotation.pitch
        lfoPan.connect(panAmt).connect(vp.pan)
        lfoQuad.connect(ampAmt).connect(trem.gain)
        lfoQuad.connect(pitchAmt)
        const oscs = P.voice.map((d) => {
          const osc = ctx.createOscillator()
          osc.type = d.type
          const lv = ctx.createGain()
          lv.gain.value = d.level
          osc.connect(lv).connect(g)
          pitchAmt.connect(osc.detune)
          osc.start()
          return { osc, ratio: d.ratio, cents: d.cents }
        })
        lfoPan.start()
        lfoQuad.start()
        voices.push({ g, trem, oscs, midi: null, lfoPan, lfoQuad, panAmt, ampAmt, pitchAmt })
      }
      this.layers[id] = { gain, voices }
    }
    this.setRotationDir(1)

    // Sous-basse : sinus, gonfle avec la force de l'aimant.
    this.sub = ctx.createOscillator()
    this.sub.type = 'sine'
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0
    this.sub.connect(this.subGain).connect(this.master)
    this.sub.start()

    // État harmonique, commun à toutes les couches.
    this.w = { skyrmion: 1, labyrinth: 0, vortex: 0 }
    this.chordIdx = 0
    this.progression = PROFILES.skyrmion.progression
    this.key = 0 // transposition accumulée par les grands pics (demi-tons)
    this.voicing = VOICINGS[0]
    this.mode = 'penta'
    this.nNotes = 3
    this.poleShift = 0
    this.detune = 4
    this.qShown = null
    this.qSince = 0
    this.lastMod = -Infinity
    this.peaks = new PeakDetector()
    this.started = null
    this.lastChange = 0
    this.fresh = true
    this.harmDom = 'skyrmion' // archétype qui a fixé l'harmonie en cours
    this.domSince = 0
    this.lastSimT = null
    this.applyChord(true)
  }

  // Simulation relancée (monde choisi, « Relancer ») : on oublie l'ancien Q,
  // nouvelle statistique des pics, harmonie reprise de l'état mesuré.
  reset(t) {
    this.qShown = null
    this.qSince = 0
    this.started = t
    this.peaks = new PeakDetector()
    this.fresh = true
  }

  get running() {
    return this.ctx.state === 'running'
  }

  async start() {
    this.wanted = true
    await this.ctx.resume()
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 1.5)
  }

  async stop() {
    this.wanted = false
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3)
    await new Promise((r) => setTimeout(r, 1200))
    if (!this.wanted) await this.ctx.suspend()
  }

  setVolume(v) {
    this.volume = v
    if (this.running) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2)
  }

  setScale(id) {
    this.scale = id
    this.applyChord(false)
  }

  steps() {
    return SCALES[this.scale === 'auto' ? this.mode : this.scale].steps
  }

  // Sens de rotation : l'ordre des phases entre voix fixe le sens de circulation.
  setRotationDir(dir) {
    this.rotDir = dir
    for (const id of ARCHETYPES) {
      this.layers[id].voices.forEach((voice, v) => {
        const phi = (dir * 2 * Math.PI * v) / VOICES
        voice.lfoPan.setPeriodicWave(phaseWave(this.ctx, phi))
        voice.lfoQuad.setPeriodicWave(phaseWave(this.ctx, phi + Math.PI / 2))
      })
    }
  }

  // Répartit les notes de l'accord courant sur les voix de chaque couche
  // (même degré et même gamme ; chaque couche garde sa forme d'accord).
  applyChord(instant) {
    const t = this.ctx.currentTime
    const steps = this.steps()
    const root = ROOT + this.key + this.poleShift
    const deg = this.progression[this.chordIdx % this.progression.length]
    for (const id of ARCHETYPES) {
      const P = PROFILES[id]
      this.layers[id].voices.forEach((voice, v) => {
        voice.midi = noteOf(root, steps, deg + P.chord[v], P.octave + this.voicing[v])
        this.tune(voice, instant ? 0 : 0.8)
        // Les voix au-delà du nombre de notes voulu s'éteignent doucement.
        const on = v < this.nNotes ? 0.22 / Math.sqrt(this.nNotes) : 0
        voice.g.gain.setTargetAtTime(on, t, instant ? 0.01 : 2.5)
      })
    }
    this.sub.frequency.setTargetAtTime(midiHz(root - 12), t, instant ? 0.01 : 0.8)
  }

  tune(voice, tau) {
    const t = this.ctx.currentTime
    for (const o of voice.oscs) {
      const f = midiHz(voice.midi) * o.ratio * 2 ** ((o.cents * this.detune) / 1200)
      if (tau === 0) o.osc.frequency.setValueAtTime(f, t)
      else o.osc.frequency.setTargetAtTime(f, t, tau)
    }
  }

  // Pic de changement : l'harmonie avance, d'autant plus loin que le pic est fort.
  //  < 2,2 : accord suivant ; 2,2 à 3,5 : saut de deux accords et nouvelle
  //  disposition ; ≥ 3,5 : modulation (quarte ou quinte), retour au premier
  //  degré — au plus une modulation toutes les 30 s.
  harmonicStep(strength, pending) {
    const t = this.ctx.currentTime
    Object.assign(this, pending)
    this.harmDom = dominant(this.w)
    this.domSince = 0
    if (strength >= 3.5 && t - this.lastMod > MOD_GAP) {
      this.lastMod = t
      const moves = [5, -5, 7, -7].filter((m) => Math.abs(this.key + m) <= 7)
      this.key += moves[Math.floor(Math.random() * moves.length)]
      this.chordIdx = 0
      this.voicing = VOICINGS[0]
    } else if (strength >= 2.2) {
      this.chordIdx += 2
      this.voicing = VOICINGS[1 + Math.floor(Math.random() * 2)]
    } else {
      this.chordIdx += 1
    }
    this.lastChange = t
    this.applyChord(false)
    // Accent : le filtre s'ouvre d'un coup puis se referme (~2 s).
    const accent = Math.min(1200, 400 * strength)
    this.filter.detune.cancelScheduledValues(t)
    this.filter.detune.setValueAtTime(accent, t)
    this.filter.detune.setTargetAtTime(0, t + 0.05, 0.8)
  }

  update(f) {
    if (!this.running) return
    const t = this.ctx.currentTime
    if (this.started === null) {
      this.started = t
      this.lastChange = t
    }
    if (f.simTime !== undefined) {
      if (this.lastSimT !== null && f.simTime < this.lastSimT) this.reset(t)
      this.lastSimT = f.simTime
    }
    const a = clamp01(f.activity)
    // Densité de motifs (parois, bandes, bulles), d'après la texture : ≈ 0,1
    // pour un skyrmion isolé ou un vortex, 1 pour un labyrinthe.
    const dens = clamp01((f.texture ?? 0) / 0.15)
    const inPlane = clamp01(f.inPlane || 0)
    const m = f.magnet

    // --- Position sur la carte : poids des trois couches ---
    const w = soundMap(f)
    this.w = w
    for (const id of ARCHETYPES) this.layers[id].gain.gain.setTargetAtTime(Math.sqrt(w[id]), t, 1.5)

    // --- Timbre, en continu, mélange pondéré des archétypes ---
    this.padGain.gain.setTargetAtTime(0.18 + 0.5 * a, t, 1.2)
    const cutoff = mixFreq(w, (P) => P.filter.base) + mix(w, (P) => P.filter.act) * a * a + mix(w, (P) => P.filter.motifs) * dens
    this.filter.frequency.setTargetAtTime(cutoff, t, 1.5)
    this.filter.Q.setTargetAtTime(mix(w, (P) => P.filter.q), t, 1.5)
    this.lfo.frequency.setTargetAtTime(mix(w, (P) => P.lfo.rate), t, 2)
    this.lfoAmt.gain.setTargetAtTime(mix(w, (P) => P.lfo.depth), t, 2)
    this.detune = mix(w, (P) => P.detune[0]) + mix(w, (P) => P.detune[1]) * dens
    for (const id of ARCHETYPES) for (const voice of this.layers[id].voices) this.tune(voice, 1)
    this.delay.delayTime.setTargetAtTime(mix(w, (P) => P.delay.time), t, 3)
    this.fb.gain.setTargetAtTime(mix(w, (P) => P.delay.fb), t, 2)
    this.delaySend.gain.setTargetAtTime(mix(w, (P) => P.delay.send) * (0.6 + 1.5 * dens), t, 2)
    this.wet.gain.setTargetAtTime(mix(w, (P) => P.reverb), t, 2)
    this.noiseBand.frequency.setTargetAtTime(mixFreq(w, (P) => P.noise.freq), t, 2)
    this.noiseBand.Q.setTargetAtTime(mix(w, (P) => P.noise.q), t, 2)
    this.noiseGain.gain.setTargetAtTime(mix(w, (P) => P.noise.level) * (0.25 + 1.5 * dens) * (0.3 + a), t, 1)
    this.pan.pan.setTargetAtTime(m ? (m.x * 2 - 1) * 0.7 : 0, t, 0.6)
    this.subGain.gain.setTargetAtTime(mix(w, (P) => P.sub) + (m ? 0.25 * m.strength : 0), t, m ? 0.8 : 2)

    // Rotation : vitesse selon l'agitation et le décalage du cœur ; sens selon
    // l'enroulement. Pour la couche tourbillon, l'amplitude suit l'enroulement
    // mesuré (≈ 0,65 pour un vortex, 0 pour une aimantation couchée uniforme).
    const circ = f.circulation || 0
    const swirl = 0.15 + 0.85 * Math.min(1, Math.abs(circ) / 0.5)
    for (const id of ARCHETYPES) {
      const R = PROFILES[id].rotation
      const rate = R.rate * (1 + 3 * a + 2 * inPlane)
      const k = id === 'vortex' ? swirl : 1
      for (const voice of this.layers[id].voices) {
        voice.lfoPan.frequency.setTargetAtTime(rate, t, 2)
        voice.lfoQuad.frequency.setTargetAtTime(rate, t, 2)
        if (id === 'vortex') {
          voice.panAmt.gain.setTargetAtTime(R.pan * k, t, 1.5)
          voice.ampAmt.gain.setTargetAtTime(R.amp * k, t, 1.5)
          voice.trem.gain.setTargetAtTime(1 - R.amp * k, t, 1.5)
          voice.pitchAmt.gain.setTargetAtTime(R.pitch * k, t, 1.5)
        }
      }
    }
    if (Math.abs(circ) > 0.2 && Math.sign(circ) !== this.rotDir) this.setRotationDir(Math.sign(circ))

    // --- Q retenu (nombre de skyrmions) : ne change que si l'écart tient ---
    if (this.qShown === null) this.qShown = f.Q
    if (Math.abs(f.Q - this.qShown) > Q_HYST) {
      if (!this.qSince) this.qSince = t
      if (t - this.qSince > Q_HOLD) {
        this.qShown = f.Q
        this.qSince = 0
      }
    } else this.qSince = 0

    // --- Harmonie, seulement sur un pic (ou après un long calme) ---
    const dom = PROFILES[dominant(w)]
    const pending = {
      mode: dom.mode({ ...f, inPlane }),
      progression: dom.progression,
      nNotes: Math.min(VOICES, 2 + Math.min(Math.round(Math.abs(this.qShown)), 2) + (dens > 0.5 ? 1 : 0)),
      poleShift: m && m.pole === 'S' ? 7 : 0,
    }
    if (this.fresh) {
      // Démarrage ou relance : l'harmonie part directement de l'état mesuré.
      this.fresh = false
      Object.assign(this, pending)
      this.harmDom = dominant(w)
      this.lastChange = t
      this.applyChord(false)
    }
    // Le film a changé de nature (archétype dominant différent depuis 2 s) :
    // l'harmonie bascule vers celle du nouvel archétype.
    const domNow = dominant(w)
    let domShift = false
    if (domNow !== this.harmDom) {
      if (!this.domSince) this.domSince = t
      domShift = t - this.domSince > DOM_HOLD
    } else this.domSince = 0
    const peak = this.peaks.push(t, featureVector({ ...f, inPlane }))
    if (peak && t - this.started > WARMUP) this.harmonicStep(peak, pending)
    else if (domShift) this.harmonicStep(1.6, pending)
    else if (t - this.lastChange > FALLBACK) this.harmonicStep(1, pending)
  }
}
