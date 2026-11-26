import { TAU } from './math.js'

// Transformées de Fourier (moteur numérique partagé).
export function makeFFT(n) {
  let bits = 0;
  while ((1 << bits) < n) bits++;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  const cs = new Float64Array(n >> 1), sn = new Float64Array(n >> 1);
  for (let i = 0; i < (n >> 1); i++) {
    cs[i] = Math.cos(TAU * i / n);
    sn[i] = Math.sin(TAU * i / n);
  }
  return function (re, im, inv, o) {
    o = o | 0;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[o + i]; re[o + i] = re[o + j]; re[o + j] = t;
        t = im[o + i]; im[o + i] = im[o + j]; im[o + j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0, w = 0; k < half; k++, w += step) {
          const wr = cs[w], wi = inv ? sn[w] : -sn[w];
          const a = o + start + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inv) {
      const s = 1 / n;
      for (let i = 0; i < n; i++) { re[o + i] *= s; im[o + i] *= s; }
    }
  };
}

export function makeFFT2(P) {
  const f = makeFFT(P);
  const tr = new Float64Array(P), ti = new Float64Array(P);
  return function (re, im, inv) {
    for (let y = 0; y < P; y++) f(re, im, inv, y * P);
    for (let x = 0; x < P; x++) {
      for (let y = 0; y < P; y++) { tr[y] = re[y * P + x]; ti[y] = im[y * P + x]; }
      f(tr, ti, inv, 0);
      for (let y = 0; y < P; y++) { re[y * P + x] = tr[y]; im[y * P + x] = ti[y]; }
    }
  };
}

