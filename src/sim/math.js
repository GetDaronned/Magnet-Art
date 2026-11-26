export const TAU = Math.PI * 2
export const GAMMA = 1.760859e11
export const MU0 = 4e-7 * Math.PI

export function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x
}
