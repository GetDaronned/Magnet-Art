import { useState } from 'react'
import { PALETTES, CYCLIC_PALETTES, LINEAR_PALETTES } from '../sim/palettes.js'
import { SCALES } from '../audio/AmbientEngine.js'
import { WORLDS, PHYS_SPEC, B_INPLANE_MAX, worldPhys } from '../sim/Simulation.js'
import Joystick from './Joystick.jsx'

// Curseur : libellé et valeur au-dessus, glissière en dessous.
function Slider({ label, unit, min, max, step, value, onChange, format }) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <span className="unit">
          {format ? format(value) : value} {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

// Boutons exclusifs (choix du monde, du pôle…).
function Segmented({ options, value, onChange, grid }) {
  return (
    <div className={'segmented' + (grid ? ' grid' : '')}>
      {options.map(([id, label]) => (
        <button key={id} className={id === value ? 'on' : ''} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// Aperçu CSS d'une palette.
function gradient(id) {
  const { stops, cyclic } = PALETTES[id]
  return `linear-gradient(90deg, ${(cyclic ? [...stops, stops[0]] : stops).join(', ')})`
}

function Group({ title, children }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {children}
    </fieldset>
  )
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export default function ControlPanel({
  world,
  onWorld,
  phys,
  setPhys,
  running,
  onLaunch,
  onToggle,
  view,
  setView,
  speed,
  setSpeed,
  tool,
  setTool,
  audio,
  setAudio,
  phone,
  setPhone,
  phoneDelta,
  onRecalibrate,
  onStartMeasure,
}) {
  // Sur téléphone, le panneau démarre replié pour laisser voir la simulation.
  const [open, setOpen] = useState(() => window.innerWidth > 640)

  const wheel = view.mode === 'wheel'
  const paletteKey = wheel ? 'wheelPalette' : 'linearPalette'
  const paletteId = view[paletteKey]
  const paletteIds = wheel ? CYCLIC_PALETTES : LINEAR_PALETTES

  const set = (key, value) => setPhys({ ...phys, [key]: value })
  // Monde « Paroi » : vue dédiée, sans geste dans l'image ni réglages de rendu.
  const wallWorld = WORLDS[world].view === 'wall'
  const bPlane = Math.hypot(phys.Bx, phys.By)
  const bAngle = Math.round((Math.atan2(phys.By, phys.Bx) * 180) / Math.PI)

  return (
    <aside className={'panel' + (open ? '' : ' closed')}>
      <header>
        <button
          className="ghost"
          onClick={() => setOpen(!open)}
          title="Afficher / masquer les réglages"
          aria-label={open ? 'Replier les réglages' : 'Déplier les réglages'}
        >
          {open ? '–' : '+'}
        </button>
        <span className="panel-title">Réglages</span>
        <button
          className="ghost play"
          onClick={onToggle}
          aria-label={running ? 'Pause' : 'Reprendre'}
          title={running ? 'Pause (Espace)' : 'Reprendre (Espace)'}
        >
          {running ? '❚❚' : '▶'}
        </button>
      </header>

      {open && (
        <div className="body">
          <Group title="Monde">
            <Segmented options={Object.entries(WORLDS).map(([id, w]) => [id, w.label])} value={world} onChange={onWorld} grid />
            {wallWorld && (
              <p className="hint">
                Une paroi entre un domaine ↑ et un domaine ↓, dans un ruban de 480 nm. Le champ Bz la pousse ; D la rend de type Néel. « Relancer » la remet au
                départ.
              </p>
            )}
          </Group>

          <Group title="Matériau">
            {PHYS_SPEC.filter(([k]) => k !== 'Bz').map(([key, label, unit, min, max, step]) => (
              <Slider key={key} label={label} unit={unit} min={min} max={max} step={step} value={phys[key]} format={fmt} onChange={(v) => set(key, v)} />
            ))}
            {!WORLDS[world].noDemag && (
              <label className="row check">
                <input type="checkbox" checked={phys.demag} onChange={(e) => set('demag', e.target.checked)} />
                <span>Champ démagnétisant</span>
              </label>
            )}
          </Group>

          <Group title="Champ extérieur">
            {PHYS_SPEC.filter(([k]) => k === 'Bz').map(([key, label, unit, min, max, step]) => (
              <Slider key={key} label={label} unit={unit} min={min} max={max} step={step} value={phys[key]} onChange={(v) => set(key, v)} />
            ))}
            <div className="joy-row">
              <Joystick x={phys.Bx} y={phys.By} max={B_INPLANE_MAX} onChange={(Bx, By) => setPhys({ ...phys, Bx, By })} />
              <div className="joy-info">
                <span>Dans le plan</span>
                <span className="unit">{Math.round(bPlane)} mT</span>
                <span className="unit">{bPlane > 0 ? `${bAngle}°` : '—'}</span>
                <button onClick={() => setPhys({ ...phys, Bx: 0, By: 0 })} disabled={bPlane === 0}>
                  Zéro
                </button>
              </div>
            </div>
            <button className="link" onClick={() => setPhys(worldPhys(world))}>
              Valeurs par défaut du monde
            </button>
          </Group>

          <Group title="Téléphone (phyphox)">
            {!phone.on ? (
              <>
                <p className="hint">
                  Dans phyphox : expérience « Magnétomètre », menu ⋮ › « Autoriser l’accès à distance », puis recopie l’adresse affichée. Même Wi-Fi que
                  l’ordinateur.
                </p>
                <div className="phy-row">
                  <input
                    type="text"
                    placeholder="192.168.1.42:8080"
                    value={phone.address}
                    onChange={(e) => setPhone({ ...phone, address: e.target.value })}
                    aria-label="Adresse de phyphox"
                  />
                  <button onClick={() => setPhone({ ...phone, on: true })} disabled={!phone.address.trim()}>
                    Connecter
                  </button>
                </div>
              </>
            ) : (
              <>
                {phone.status && phone.status !== 'ok' && <p className="hint">{phone.status}</p>}
                <p className="hint mag-read">
                  ΔB mesuré {phoneDelta.map((v) => Math.round(v)).join(' / ')} µT
                  <br />
                  ajouté au film {phoneDelta.map((v) => Math.round((v * phone.gain) / 1000)).join(' / ')} mT (x / y / z)
                </p>
                <Slider label="Amplification" unit="×" min={10} max={1000} step={10} value={phone.gain} onChange={(gain) => setPhone({ ...phone, gain })} />
                <div className="phy-row">
                  <button onClick={onRecalibrate}>Recalibrer</button>
                  <button onClick={onStartMeasure}>Démarrer la mesure</button>
                  <button onClick={() => setPhone({ ...phone, on: false })}>Déconnecter</button>
                </div>
              </>
            )}
          </Group>

          {!wallWorld && (
            <Group title="Interaction">
              <Segmented
                options={[
                  ['magnet', 'Aimant'],
                  ['skyrmion', 'Skyrmion'],
                ]}
                value={tool.kind}
                onChange={(kind) => setTool({ ...tool, kind })}
              />
              {tool.kind === 'magnet' && (
                <>
                  <Slider
                    label="Force"
                    unit="mT"
                    min={0}
                    max={5000}
                    step={100}
                    value={Number(tool.strength)}
                    onChange={(strength) => setTool({ ...tool, strength })}
                  />
                  <Segmented
                    options={[
                      ['N', 'Nord (B ↓)'],
                      ['S', 'Sud (B ↑)'],
                    ]}
                    value={tool.pole}
                    onChange={(pole) => setTool({ ...tool, pole })}
                  />
                </>
              )}
              <p className="hint">
                {tool.kind === 'magnet' ? 'L’aimant suit la souris, ou le doigt posé sur l’écran' : 'Toucher le film : injecter un skyrmion'}
              </p>
            </Group>
          )}

          <Group title="Affichage">
            {!wallWorld && (
              <>
                <label className="row">
                  <span className="lbl">Voir</span>
                  <select value={view.mode} onChange={(e) => setView({ ...view, mode: e.target.value })}>
                    <option value="wheel">Direction</option>
                    <option value="mz">mz</option>
                    <option value="mx">mx</option>
                    <option value="my">my</option>
                  </select>
                </label>
                <label className="row">
                  <span className="lbl">Palette</span>
                  <select value={paletteId} onChange={(e) => setView({ ...view, [paletteKey]: e.target.value })}>
                    {paletteIds.map((id) => (
                      <option key={id} value={id}>
                        {PALETTES[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="swatch" style={{ background: gradient(paletteId) }} />
                <label className="row check">
                  <input type="checkbox" checked={view.arrows} onChange={(e) => setView({ ...view, arrows: e.target.checked })} />
                  <span>Flèches</span>
                </label>
              </>
            )}
            <label className="row">
              <span className="lbl">Vitesse</span>
              <input type="range" min="0.1" max="4" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              <span className="unit">×{speed.toFixed(1)}</span>
            </label>
          </Group>

          <Group title="Son">
            <label className="row check">
              <input type="checkbox" checked={audio.on} onChange={(e) => setAudio({ ...audio, on: e.target.checked })} />
              <span>Nappe ambient</span>
            </label>
            {audio.on && (
              <>
                <label className="row">
                  <span className="lbl">Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audio.volume}
                    onChange={(e) => setAudio({ ...audio, volume: Number(e.target.value) })}
                  />
                  <span className="unit">{Math.round(audio.volume * 100)}</span>
                </label>
                <label className="row">
                  <span className="lbl">Gamme</span>
                  <select value={audio.scale} onChange={(e) => setAudio({ ...audio, scale: e.target.value })}>
                    {Object.entries(SCALES).map(([id, sc]) => (
                      <option key={id} value={id}>
                        {sc.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </Group>

          <div className="actions">
            <button className="primary" onClick={onLaunch} title="Relancer (R)">
              Relancer
            </button>
            <button onClick={onToggle} title="Pause (Espace)">
              {running ? 'Pause' : 'Reprendre'}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
