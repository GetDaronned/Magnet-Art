// Indicateur pédagogique : pour |m| = 1, |m_j - m_i|² = 2(1 - cos θ).
// Ce saut discrétisé est aussi |∂m/∂x| dx (ou |∂m/∂y| dy).
// Les seuils de 30°/25° sont heuristiques, pas un test de convergence.
const ENTER = 2 * (1 - Math.cos(Math.PI / 6))
const EXIT = 2 * (1 - Math.cos(25 * Math.PI / 180))

export function meshUnderResolved(core, wasWarning = false) {
  const { act, mx, my, mz, nbR, nbU } = core
  const limit = wasWarning ? EXIT : ENTER
  for (let q = 0; q < act.length; q++) {
    const i = act[q]
    const x = mx[i], y = my[i], z = mz[i]
    // Les voisins absents (bords, masque, dimension 1D) renvoient i.
    // Droite et haut suffisent pour inspecter les paires réelles du maillage.
    const r = nbR[i], u = nbU[i]
    if (r !== i) {
      const a = mx[r] - x, b = my[r] - y, c = mz[r] - z
      if (a * a + b * b + c * c >= limit) return true
    }
    if (u !== i) {
      const a = mx[u] - x, b = my[u] - y, c = mz[u] - z
      if (a * a + b * b + c * c >= limit) return true
    }
  }
  return false
}
