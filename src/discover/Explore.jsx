import { useEffect, useState } from 'react'
import Layout from '../pages/Layout.jsx'
import Stage, { Legend } from './Stage.jsx'
import { DECOUVERTE } from './vendor/aimantarium.js'
import { applySet, createSim, makeHost, markQty, rememberSetting, savedSettings } from './sim.js'
import './discover.css'

// Atelier libre d'un chapitre : la simulation, une mesure en direct et les
// réglages commentés ; le quiz est proposé en option.

// Valeur affichée, avec les flèches ↑ ↓ en plus gros (elles sont minuscules
// dans la plupart des polices).
function withArrows(text) {
  return String(text)
    .split(/([↑↓])/)
    .map((part, i) =>
      part === '↑' || part === '↓' ? (
        <span key={i} className="d-arrow">
          {part}
        </span>
      ) : (
        part
      ),
    )
}

function Control({ control, value, onChange }) {
  const id = 'ctl-' + control.id
  const hint = control.help && <p className="d-hint">{control.help}</p>
  if (control.type === 'check') {
    return (
      <div className="d-control">
        <label className="d-toggle">
          <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> <strong>{control.label}</strong>
        </label>
        {hint}
      </div>
    )
  }
  if (control.options) {
    return (
      <div className="d-control">
        <label htmlFor={id}>{control.label}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {control.options.map(([v, caption]) => (
            <option key={v} value={v}>
              {caption}
            </option>
          ))}
        </select>
        {hint}
      </div>
    )
  }
  const shown = control.format(value)
  return (
    <div className="d-control">
      <div className="d-control-head">
        <label htmlFor={id}>{control.label}</label>
        <output htmlFor={id}>{withArrows(shown)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {hint}
    </div>
  )
}

function Workshop({ chapter }) {
  const free = chapter.free
  const [toast, setToast] = useState('')
  // Téléphone : réglages dans un tiroir en bas de l'écran.
  const [drawer, setDrawer] = useState(false)
  const [sim] = useState(() => {
    const s = createSim(free.mode || chapter.id, makeHost(setToast))
    const init = { ...free.setup, ...savedSettings(chapter.id) }
    if (init.mat === s.p.mat) delete init.mat
    applySet(s, init, free.reset)
    return s
  })
  // Les grandeurs de l'atelier entrent dans le carnet des notions.
  useEffect(() => markQty(free.qty), [free])
  // Rafraîchit la mesure (la simulation évolue sans React).
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3400)
    return () => clearTimeout(t)
  }, [toast])

  const change = (control, value) => {
    if (!control.options && control.type !== 'check' && !Number.isFinite(value)) return
    rememberSetting(chapter.id, control.id, value)
    applySet(sim, { [control.id]: value })
    setTick((n) => n + 1)
  }

  return (
    <Layout current="decouverte" wide>
      <a className="d-back" href="#decouverte">
        ← Découverte
      </a>
      <h1 className="d-title">{chapter.short}</h1>
      {free.intro && <p className="d-intro">{free.intro}</p>}
      <div className={'d-lab d-explore' + (drawer ? ' drawer-open' : '')}>
        <div className="d-main">
          <div className="d-stage">
            <Stage sim={sim} interactive={!!free.gesture} label={free.caption} />
            {toast && (
              <div className="d-toast" role="status">
                {toast}
              </div>
            )}
          </div>
          {free.legend && <Legend flat={free.mode === 'sandbox'} />}
          <p className="d-caption">{free.caption}</p>
          {free.measure && <p className="d-measure">{free.measure(sim)}</p>}
          <a className="btn primary" href={'#guide-' + chapter.id}>
            Teste ta compréhension →
          </a>
        </div>
        <section className="d-panel" aria-label="Réglages">
          <button className="d-drawer-toggle" type="button" aria-expanded={drawer} aria-controls="d-drawer-body" onClick={() => setDrawer(!drawer)}>
            <span>Réglages</span>
            <span className="d-drawer-arrow" aria-hidden="true">
              ⌃
            </span>
          </button>
          <div className="d-drawer-body" id="d-drawer-body">
            <h2>À toi de régler</h2>
            <div className="d-controls">
              {free.controls.map((control) => (
                <Control key={control.id} control={control} value={sim.p[control.id]} onChange={(v) => change(control, v)} />
              ))}
            </div>
            <div className="d-links">
              {free.action && (
                <button
                  className="btn"
                  onClick={() => {
                    sim.action(free.action.id)
                    setTick((n) => n + 1)
                  }}
                >
                  {free.action.label}
                </button>
              )}
              {free.mode === 'sandbox' && (
                <a className="link" href="#xp-sandbox">
                  Ouvrir le bac à sable
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}

export default function Explore({ id }) {
  const chapter = DECOUVERTE.find((c) => c.id === id)
  if (!chapter) {
    return (
      <Layout current="decouverte">
        <p>
          Chapitre introuvable. <a href="#decouverte">Retour à la Découverte</a>
        </p>
      </Layout>
    )
  }
  return <Workshop key={id} chapter={chapter} />
}
