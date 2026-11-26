import { useCallback, useEffect, useRef, useState } from 'react'
import FieldCanvas from '../components/FieldCanvas.jsx'
import ControlPanel from '../components/ControlPanel.jsx'
import { WORLDS, Simulation, fitToAspect, worldPhys } from '../sim/Simulation.js'
import { AmbientEngine } from '../audio/AmbientEngine.js'
import { PhyphoxSource } from '../sensors/PhyphoxSource.js'

const DEFAULT_WORLD = 'skyrmion'

// Monde + paramètres réglables. Plein écran : le film prend le ratio de la fenêtre.
function makeSim(world, phys) {
  const params = { ...WORLDS[world], ...phys }
  const p = params.fill ? fitToAspect(params, window.innerHeight / window.innerWidth) : params
  return new Simulation(p)
}

export default function Sandbox() {
  const [world, setWorld] = useState(DEFAULT_WORLD)
  const [phys, setPhysState] = useState(() => worldPhys(DEFAULT_WORLD))
  const [sim, setSim] = useState(() => makeSim(DEFAULT_WORLD, worldPhys(DEFAULT_WORLD)))
  const [running, setRunning] = useState(true)
  const [view, setView] = useState({ mode: 'wheel', wheelPalette: 'twilight', linearPalette: 'redblue', arrows: WORLDS[DEFAULT_WORLD].arrows })
  const [speed, setSpeed] = useState(1)
  // Interaction au toucher : graine de skyrmion (clic) ou aimant (suit le pointeur).
  const [tool, setTool] = useState({ kind: 'skyrmion', strength: 2500, height: 12, pole: 'N' })
  // Son : le moteur est créé au premier clic (les navigateurs l'exigent).
  const engine = useRef(null)
  const [audio, setAudioState] = useState({ on: false, volume: 0.6, scale: 'auto' })

  const setAudio = useCallback(async (next) => {
    setAudioState(next)
    if (next.on && !engine.current) engine.current = new AmbientEngine()
    const e = engine.current
    if (!e) return
    e.setVolume(next.volume)
    if (e.scale !== next.scale) e.setScale(next.scale)
    if (next.on && !e.wanted) await e.start()
    else if (!next.on && e.wanted) await e.stop()
  }, [])

  // Magnétomètre d'un téléphone, en direct via phyphox : sa perturbation
  // (champ moins champ ambiant) s'ajoute au champ extérieur, amplifiée
  // (gain = mT simulés par mT réel).
  const mag = useRef(null)
  const [phone, setPhoneState] = useState(() => ({
    on: false,
    address: localStorage.getItem('phyphox-address') || '',
    gain: 100,
    status: '',
  }))
  const [phoneDelta, setPhoneDelta] = useState([0, 0, 0])

  const setPhone = useCallback((next) => {
    if (next.on && !mag.current) {
      localStorage.setItem('phyphox-address', next.address)
      mag.current = new PhyphoxSource(next.address, (status) => setPhoneState((p) => ({ ...p, status })))
      mag.current.connect()
    } else if (!next.on && mag.current) {
      mag.current.stop()
      mag.current = null
      setPhoneDelta([0, 0, 0])
    }
    setPhoneState((p) => ({ ...next, status: next.on ? p.status : '' }))
  }, [])

  const recalibrate = useCallback(() => mag.current?.recalibrate(), [])
  const startMeasure = useCallback(() => mag.current?.startMeasure(), [])

  useEffect(() => {
    if (!phone.on) {
      sim.setPhoneField([0, 0, 0])
      return
    }
    const id = setInterval(() => {
      if (!mag.current) return
      const d = mag.current.delta() // µT
      const k = phone.gain / 1000 // µT réels -> mT simulés
      const lim = (v, m) => Math.max(-m, Math.min(m, v))
      sim.setPhoneField([lim(d[0] * k, 300), lim(d[1] * k, 300), lim(d[2] * k, 500)])
      setPhoneDelta(d)
    }, 100)
    return () => clearInterval(id)
  }, [phone.on, phone.gain, sim])

  // A, K, D, B, démag : appliqués en direct, sans réinitialiser le film.
  const setPhys = useCallback(
    (next) => {
      setPhysState(next)
      sim.setPhysics(next)
    },
    [sim],
  )

  const chooseWorld = useCallback((id) => {
    const p = worldPhys(id)
    setWorld(id)
    setPhysState(p)
    setSim(makeSim(id, p))
    setView((v) => ({ ...v, arrows: WORLDS[id].arrows }))
    setRunning(true)
  }, [])

  // Relance le monde courant avec les réglages actuels.
  const launch = useCallback(() => {
    setSim(makeSim(world, phys))
    setRunning(true)
  }, [world, phys])

  const toggle = useCallback(() => setRunning((r) => !r), [])

  // En quittant le bac à sable : couper le son et réafficher le panneau.
  useEffect(
    () => () => {
      engine.current?.ctx.close()
      engine.current = null
      mag.current?.stop()
      mag.current = null
      document.body.classList.remove('hide-ui')
    },
    [],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea')) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'r' || e.key === 'R') {
        launch()
      } else if (e.key === 'h' || e.key === 'H') {
        document.body.classList.toggle('hide-ui')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launch, toggle])

  return (
    <>
      <a className="sb-close" href="#accueil" title="Quitter le bac à sable" aria-label="Quitter le bac à sable, retour à l’accueil">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </a>
      <FieldCanvas sim={sim} running={running} view={view} speed={speed} tool={tool} engine={engine} />
      <ControlPanel
        world={world}
        onWorld={chooseWorld}
        phys={phys}
        setPhys={setPhys}
        running={running}
        onLaunch={launch}
        onToggle={toggle}
        view={view}
        setView={setView}
        speed={speed}
        setSpeed={setSpeed}
        tool={tool}
        setTool={setTool}
        audio={audio}
        setAudio={setAudio}
        phone={phone}
        setPhone={setPhone}
        phoneDelta={phoneDelta}
        onRecalibrate={recalibrate}
        onStartMeasure={startMeasure}
      />
    </>
  )
}
