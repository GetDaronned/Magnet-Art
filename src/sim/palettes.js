// Palettes de couleurs. Chaque palette est une liste de couleurs régulièrement
// espacées ; `cyclic` indique qu'elle boucle (utilisable pour la direction φ).
export const PALETTES = {
  // --- cycliques : direction dans le plan ---
  hsl: { label: 'Arc-en-ciel', cyclic: true, stops: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'] },
  twilight: { label: 'Crépuscule', cyclic: true, stops: ['#e2d9e2', '#9eb3c7', '#6a85c0', '#5d4fae', '#4a1e6e', '#6b1e52', '#a2414b', '#c78d6a', '#dbc5bb'] },
  neon: { label: 'Néon', cyclic: true, stops: ['#ff2a6d', '#ffb800', '#05d9e8', '#7b2cff'] },
  aurora: { label: 'Aurore', cyclic: true, stops: ['#00ffa3', '#00b3ff', '#8a2be2', '#ff4fd8', '#ffd166'] },
  duo: { label: 'Bicolore', cyclic: true, stops: ['#ff5a1f', '#ffffff', '#1f8bff', '#000000'] },

  // --- linéaires : composantes mx, my, mz (de −1 à +1) ---
  redblue: { label: 'Bleu / rouge', cyclic: false, stops: ['#2896ff', '#000000', '#ff4632'] },
  viridis: { label: 'Viridis', cyclic: false, stops: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'] },
  magma: { label: 'Magma', cyclic: false, stops: ['#000004', '#1c1044', '#4f127b', '#812581', '#b5367a', '#e55964', '#fb8761', '#fec287', '#fcfdbf'] },
  inferno: { label: 'Inferno', cyclic: false, stops: ['#000004', '#1f0c48', '#550f6d', '#88226a', '#ba3655', '#e35933', '#f9950a', '#f8c932', '#fcffa4'] },
  fire: { label: 'Feu', cyclic: false, stops: ['#000000', '#7a0000', '#ff4500', '#ffb000', '#fff6d0'] },
  ice: { label: 'Glace', cyclic: false, stops: ['#000000', '#0b2a5b', '#1e7bd8', '#8fd3ff', '#ffffff'] },
  gray: { label: 'Niveaux de gris', cyclic: false, stops: ['#000000', '#ffffff'] },
}

export const CYCLIC_PALETTES = Object.keys(PALETTES).filter((k) => PALETTES[k].cyclic)
export const LINEAR_PALETTES = Object.keys(PALETTES).filter((k) => !PALETTES[k].cyclic)

export const LUT_SIZE = 256

function hex(c) {
  const v = parseInt(c.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

// Table de 256 couleurs RGBA, interpolées linéairement entre les étapes.
export function buildLut(id) {
  const pal = PALETTES[id] || PALETTES.hsl
  const stops = pal.stops.map(hex)
  if (pal.cyclic) stops.push(stops[0])
  const out = new Uint8Array(LUT_SIZE * 4)
  const segs = stops.length - 1
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = pal.cyclic ? i / LUT_SIZE : i / (LUT_SIZE - 1)
    const x = t * segs
    const k = Math.min(Math.floor(x), segs - 1)
    const f = x - k
    const a = stops[k]
    const b = stops[k + 1]
    out[i * 4] = a[0] + (b[0] - a[0]) * f
    out[i * 4 + 1] = a[1] + (b[1] - a[1]) * f
    out[i * 4 + 2] = a[2] + (b[2] - a[2]) * f
    out[i * 4 + 3] = 255
  }
  return out
}
