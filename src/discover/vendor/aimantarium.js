/* eslint-disable */
// Code du prototype Aimantarium V19 (« À toi d'expérimenter »), repris tel
// quel : fichiers js/noyau, js/vue, js/modes et js/catalogue concaténés
// dans un module. Ne pas modifier ici sans raison : c'est la référence
// physique et le contenu des parcours et des applications.
// Bouchons pour ce qui n'est pas repris (capteurs, code Ubermag) :
const Sensors = { real: false, heading: null, start: () => Promise.resolve(), label: () => '' };
const UB_HEAD = '';
const UB = { links: {}, map: {}, cells: {}, code: {}, notes: {} };

// ===== noyau/util.js =====
const TAU = Math.PI * 2;
const GAMMA = 1.760859e11;
const MU0 = 4e-7 * Math.PI;
const GHZ_PER_T = GAMMA / TAU / 1e9;
const DEG = Math.PI / 180;
const KB = 1.380649e-23;
const FONT = 'Atkinson Hyperlegible, system-ui, sans-serif';
const FONTD = 'Archivo, Atkinson Hyperlegible, system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const PAL = {
  paper: '#F4EFE6', card: '#FBF8F2', ink: '#17140F', ink2: '#4A443A', ink3: '#8A8275', rule: '#D8CFBF',
  red: '#D7301F', blue: '#1F4E9C', gold: '#C98A00', plum: '#7B3FA0', leaf: '#2F7D4F', teal: '#0F7C80', ember: '#B4532A',
  x: '#D9480F', y: '#2F7D4F', z: '#1F4E9C'
};

function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

function qs(sel, root) { return (root || document).querySelector(sel); }

function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function mk(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function hsl2rgb(h, s, l) {
  h = h - Math.floor(h);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = function (t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function divRGB(v) {
  const t = clamp(v, -1, 1), w = [247, 243, 236];
  if (t >= 0) return lerp3(w, [215, 48, 31], t);
  return lerp3(w, [31, 78, 156], -t);
}

function arrowRGB(v) {
  const t = clamp(v, -1, 1), k = [40, 36, 30];
  if (t >= 0) return lerp3(k, [215, 48, 31], t);
  return lerp3(k, [31, 78, 156], -t);
}

function rgbStr(c) {
  return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function fnt(px, w, fam) { return (w || 400) + ' ' + px + 'px ' + (fam || FONT); }

function frNum(v, d) {
  if (!isFinite(v)) return '—';
  const k = d === undefined ? 2 : d;
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: k, maximumFractionDigits: k });
}

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

function sciStr(v, d) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e <= 4) return frNum(v, d === undefined ? 2 : d);
  const m = v / Math.pow(10, e);
  return frNum(m, d === undefined ? 1 : d) + '·10' + String(e).split('').map(function (c) { return SUP[c] || c; }).join('');
}

function fmtTime(t) {
  if (Math.abs(t) < 1e-9) return frNum(t * 1e12, 0) + ' ps';
  return frNum(t * 1e9, 2) + ' ns';
}

function fmtSpan(s) {
  const a = Math.abs(s);
  const U = [[3.156e7, 'an'], [86400, 'jour'], [3600, 'h'], [60, 'min'], [1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns'], [1e-12, 'ps'], [1e-15, 'fs']];
  for (let i = 0; i < U.length; i++) {
    const k = U[i][0], n = U[i][1];
    if (a >= k * 0.999 || i === U.length - 1) {
      const v = s / k, d = v < 10 ? 2 : (v < 100 ? 1 : 0);
      let txt = v >= 1e5 ? sciStr(v, 1) : frNum(v, d);
      if (n === 'an' || n === 'jour') txt += ' ' + n + (v >= 2 ? 's' : '');
      else txt += ' ' + n;
      return txt;
    }
  }
  return '0 s';
}

function niceStep(range, target) {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f < 1.5 ? 1 : (f < 3 ? 2 : (f < 7 ? 5 : 10));
  return nice * pow;
}

function tickLabel(v) {
  const s = Math.abs(v) < 1e-12 ? 0 : v;
  return String(parseFloat(s.toPrecision(4))).replace('.', ',');
}

function wrapPi(a) {
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

function xorshift(seed) {
  let x = (seed >>> 0) || 1;
  return function () {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
}

function uni(r) { return function () { return r() / 4294967296; }; }

function gauss(u) {
  let a = u();
  if (a < 1e-12) a = 1e-12;
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(TAU * u());
}

function packRGB(r, g, b) { return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; }

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function download(name, data, mime) {
  const b = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ===== noyau/fft.js =====
function makeFFT(n) {
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

function makeFFT2R(Px, Py) {
  const fx = makeFFT(Px), fy = Py === Px ? fx : makeFFT(Py);
  const tr = new Float64Array(Py), ti = new Float64Array(Py);
  return function (re, im, inv) {
    for (let y = 0; y < Py; y++) fx(re, im, inv, y * Px);
    for (let x = 0; x < Px; x++) {
      for (let y = 0; y < Py; y++) { tr[y] = re[y * Px + x]; ti[y] = im[y * Px + x]; }
      fy(tr, ti, inv, 0);
      for (let y = 0; y < Py; y++) { re[y * Px + x] = tr[y]; im[y * Px + x] = ti[y]; }
    }
  };
}

function makeFFT2(P) { return makeFFT2R(P, P); }

// ===== noyau/macro.js =====
function spectrumOf(sig, Ts) {
  const N = sig.length, re = new Float64Array(N), im = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) mean += sig[i];
  mean /= N;
  for (let i = 0; i < N; i++) re[i] = (sig[i] - mean) * (0.5 - 0.5 * Math.cos(TAU * i / (N - 1)));
  makeFFT(N)(re, im, false, 0);
  const H = N >> 1, mags = new Float64Array(H);
  for (let k = 0; k < H; k++) mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  return { mags: mags, df: 1 / (N * Ts) };
}

function newPhys() {
  return { alpha: 0.1, BK: 0, ux: 0, uy: 0, uz: 1, BP: 0, a: 0, px: 0, py: 0, pz: 1 };
}

function llgMacro(m, B, ph, o) {
  const x = m[0], y = m[1], z = m[2];
  let bx = B[0], by = B[1], bz = B[2];
  if (ph.BK !== 0) {
    const d = ph.BK * (x * ph.ux + y * ph.uy + z * ph.uz);
    bx += d * ph.ux; by += d * ph.uy; bz += d * ph.uz;
  }
  if (ph.BP !== 0) bz -= ph.BP * z;
  const al = ph.alpha, g = GAMMA / (1 + al * al);
  const cx = y * bz - z * by, cy = z * bx - x * bz, cz = x * by - y * bx;
  const ex = y * cz - z * cy, ey = z * cx - x * cz, ez = x * cy - y * cx;
  let dx = -g * (cx + al * ex), dy = -g * (cy + al * ey), dz = -g * (cz + al * ez);
  if (ph.a !== 0) {
    const px = ph.px, py = ph.py, pz = ph.pz;
    const qx = y * pz - z * py, qy = z * px - x * pz, qz = x * py - y * px;
    const rx = y * qz - z * qy, ry = z * qx - x * qz, rz = x * qy - y * qx;
    dx += g * ph.a * (rx - al * qx);
    dy += g * ph.a * (ry - al * qy);
    dz += g * ph.a * (rz - al * qz);
  }
  o[0] = dx; o[1] = dy; o[2] = dz;
}

class MacroIntegrator {
  constructor() {
    this.k1 = [0, 0, 0]; this.k2 = [0, 0, 0]; this.k3 = [0, 0, 0]; this.k4 = [0, 0, 0];
    this.tmp = [0, 0, 0];
    this.B1 = [0, 0, 0]; this.B2 = [0, 0, 0]; this.B3 = [0, 0, 0];
  }
  step(m, t, dt, ph, fieldFn) {
    const k1 = this.k1, k2 = this.k2, k3 = this.k3, k4 = this.k4, tmp = this.tmp;
    const B1 = this.B1, B2 = this.B2, B3 = this.B3;
    fieldFn(t, B1);
    fieldFn(t + 0.5 * dt, B2);
    fieldFn(t + dt, B3);
    llgMacro(m, B1, ph, k1);
    for (let i = 0; i < 3; i++) tmp[i] = m[i] + 0.5 * dt * k1[i];
    llgMacro(tmp, B2, ph, k2);
    for (let i = 0; i < 3; i++) tmp[i] = m[i] + 0.5 * dt * k2[i];
    llgMacro(tmp, B2, ph, k3);
    for (let i = 0; i < 3; i++) tmp[i] = m[i] + dt * k3[i];
    llgMacro(tmp, B3, ph, k4);
    for (let i = 0; i < 3; i++) m[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
    m[0] *= n; m[1] *= n; m[2] *= n;
  }
}

function macroSeries(ph, m0, fieldFn, bScale, Ts, N) {
  const integ = new MacroIntegrator();
  const m = [m0[0], m0[1], m0[2]];
  const dtMax = Math.min(3e-12, 0.08 / (GAMMA * Math.max(bScale, 1e-3)));
  const ns = Math.max(1, Math.ceil(Ts / dtMax)), dt = Ts / ns;
  const sy = new Float64Array(N), sz = new Float64Array(N);
  let t = 0;
  for (let k = 0; k < N; k++) {
    sy[k] = m[1]; sz[k] = m[2];
    for (let s = 0; s < ns; s++) { integ.step(m, t, dt, ph, fieldFn); t += dt; }
  }
  return { sy: sy, sz: sz };
}

// ===== noyau/film.js =====
class FilmCore {
  constructor(nx, ny, dx, o) {
    o = o || {};
    const n = nx * ny;
    this.nx = nx; this.ny = ny; this.n = n; this.dx = dx;
    this.mx = new Float64Array(n); this.my = new Float64Array(n); this.mz = new Float64Array(n);
    this.tx = new Float64Array(n); this.ty = new Float64Array(n); this.tz = new Float64Array(n);
    this.K = [];
    for (let q = 0; q < 4; q++) this.K.push([new Float64Array(n), new Float64Array(n), new Float64Array(n)]);
    this.alpha = new Float64Array(n).fill(0.1);
    this.mask = o.mask || null;
    this.nbL = new Int32Array(n); this.nbR = new Int32Array(n);
    this.nbU = new Int32Array(n); this.nbD = new Int32Array(n);
    const act = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (!this.mask || this.mask[id] === 1) act.push(id);
        this.nbL[id] = this.neighbor(id, i - 1, j, o.px, o.py);
        this.nbR[id] = this.neighbor(id, i + 1, j, o.px, o.py);
        this.nbU[id] = this.neighbor(id, i, j + 1, o.px, o.py);
        this.nbD[id] = this.neighbor(id, i, j - 1, o.px, o.py);
      }
    }
    this.act = Int32Array.from(act);
    this.Ms = 8e5; this.A = 1.3e-11; this.D = 0; this.Kc = 0;
    this.Bx = 0; this.By = 0; this.Bz = 0;
    this.beta = 0; this.ux = 0; this.uy = 0;
    this.acS = null; this.acAmp = 0; this.acOmega = 0; this.acPhi = 0;
    this.acDx = 1; this.acDy = 0; this.acDz = 0;
    this.dt = 1e-13;
    this.demagOn = false;
    this.dmCount = 0;
    this.demagEvery = 2;
    if (o.demag) {
      this.demagOn = true;
      let P = 1;
      while (P < 2 * Math.max(nx, ny)) P <<= 1;
      this.P = P;
      this.fft2 = makeFFT2(P);
      const PP = P * P;
      this.fr1 = new Float64Array(PP); this.fi1 = new Float64Array(PP);
      this.fr2 = new Float64Array(PP); this.fi2 = new Float64Array(PP);
      this.fr3 = new Float64Array(PP); this.fi3 = new Float64Array(PP);
      this.gxx = new Float64Array(PP); this.gxy = new Float64Array(PP);
      this.gyy = new Float64Array(PP); this.gz = new Float64Array(PP);
      this.hdx = new Float64Array(n); this.hdy = new Float64Array(n); this.hdz = new Float64Array(n);
      this.thickness = o.thickness || 20e-9;
    }
  }

  neighbor(id, i, j, px, py) {
    const nx = this.nx, ny = this.ny;
    if (i < 0) i = px ? nx - 1 : 0; else if (i >= nx) i = px ? 0 : nx - 1;
    if (j < 0) j = py ? ny - 1 : 0; else if (j >= ny) j = py ? 0 : ny - 1;
    const q = j * nx + i;
    if (this.mask && this.mask[q] !== 1) return id;
    return q;
  }

  prepare() {
    const dx = this.dx, Ms = this.Ms;
    this.cEx = 2 * this.A / (Ms * dx * dx);
    this.cD = this.D / (Ms * dx);
    this.cK = 2 * this.Kc / Ms;
    this.inv2dx = 1 / (2 * dx);
    const dimf = (this.nx > 1 && this.ny > 1) ? 8 : 4;
    let stiff = dimf * this.cEx + Math.abs(this.cK) + 4 * Math.abs(this.cD);
    stiff += Math.sqrt(this.Bx * this.Bx + this.By * this.By + this.Bz * this.Bz) + this.acAmp;
    stiff += (Math.abs(this.ux) + Math.abs(this.uy)) / (dx * GAMMA);
    if (this.demagOn) {
      stiff += MU0 * Ms;
      this.buildKernel();
    }
    this.dt = 1.0 / (GAMMA * stiff);
  }

  buildKernel() {
    const P = this.P, dx = this.dx, t = this.thickness;
    for (let ky = 0; ky < P; ky++) {
      const iy = ky < P / 2 ? ky : ky - P, kyv = TAU * iy / (P * dx);
      for (let kx = 0; kx < P; kx++) {
        const ix = kx < P / 2 ? kx : kx - P, kxv = TAU * ix / (P * dx);
        const p = ky * P + kx, k2 = kxv * kxv + kyv * kyv;
        if (k2 === 0) {
          this.gxx[p] = 0; this.gxy[p] = 0; this.gyy[p] = 0; this.gz[p] = -1;
          continue;
        }
        const k = Math.sqrt(k2), f = (1 - Math.exp(-k * t)) / (k * t), w = (1 - f) / k2;
        this.gxx[p] = -w * kxv * kxv;
        this.gxy[p] = -w * kxv * kyv;
        this.gyy[p] = -w * kyv * kyv;
        this.gz[p] = -f;
      }
    }
  }

  invalidate() { this.dmCount = 0; }

  updateDemag() {
    const P = this.P, nx = this.nx, ny = this.ny, mask = this.mask;
    const r1 = this.fr1, i1 = this.fi1, r2 = this.fr2, i2 = this.fi2, r3 = this.fr3, i3 = this.fi3;
    r1.fill(0); i1.fill(0); r2.fill(0); i2.fill(0);
    const mx = this.mx, my = this.my, mz = this.mz;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (mask && mask[id] !== 1) continue;
        const p = j * P + i;
        r1[p] = mx[id]; i1[p] = my[id]; r2[p] = mz[id];
      }
    }
    this.fft2(r1, i1, false);
    this.fft2(r2, i2, false);
    const gxx = this.gxx, gxy = this.gxy, gyy = this.gyy, gz = this.gz;
    for (let ky = 0; ky < P; ky++) {
      const qy = ((P - ky) % P) * P;
      for (let kx = 0; kx < P; kx++) {
        const p = ky * P + kx, q = qy + ((P - kx) % P);
        const ar = r1[p], ai = i1[p], br = r1[q], bi = -i1[q];
        const mxr = 0.5 * (ar + br), mxi = 0.5 * (ai + bi);
        const myr = 0.5 * (ai - bi), myi = -0.5 * (ar - br);
        const hxr = gxx[p] * mxr + gxy[p] * myr, hxi = gxx[p] * mxi + gxy[p] * myi;
        const hyr = gxy[p] * mxr + gyy[p] * myr, hyi = gxy[p] * mxi + gyy[p] * myi;
        r3[p] = hxr - hyi; i3[p] = hxi + hyr;
        r2[p] *= gz[p]; i2[p] *= gz[p];
      }
    }
    this.fft2(r3, i3, true);
    this.fft2(r2, i2, true);
    const s = MU0 * this.Ms;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, p = j * P + i;
        if (mask && mask[id] !== 1) { this.hdx[id] = 0; this.hdy[id] = 0; this.hdz[id] = 0; continue; }
        this.hdx[id] = s * r3[p]; this.hdy[id] = s * i3[p]; this.hdz[id] = s * r2[p];
      }
    }
  }

  deriv(ax, ay, az, ox, oy, oz, t) {
    const act = this.act, na = act.length, L = this.nbL, R = this.nbR, U = this.nbU, Dn = this.nbD;
    const cEx = this.cEx, cD = this.cD, cK = this.cK, al = this.alpha;
    const bx0 = this.Bx, by0 = this.By, bz0 = this.Bz;
    const useD = cD !== 0, ux = this.ux, uy = this.uy, useZ = ux !== 0 || uy !== 0;
    const i2 = this.inv2dx, beta = this.beta;
    const useAc = this.acAmp !== 0 && this.acS !== null;
    let acv = 0;
    if (useAc) acv = this.acAmp * Math.sin(this.acOmega * t + this.acPhi);
    const acS = this.acS, adx = this.acDx, ady = this.acDy, adz = this.acDz;
    const dm = this.demagOn, hx = this.hdx, hy = this.hdy, hz = this.hdz;
    for (let q = 0; q < na; q++) {
      const i = act[q], l = L[i], r = R[i], u = U[i], d = Dn[i];
      const x = ax[i], y = ay[i], z = az[i];
      let Bx = bx0 + cEx * (ax[l] + ax[r] + ax[u] + ax[d] - 4 * x);
      let By = by0 + cEx * (ay[l] + ay[r] + ay[u] + ay[d] - 4 * y);
      let Bz = bz0 + cEx * (az[l] + az[r] + az[u] + az[d] - 4 * z) + cK * z;
      if (useD) {
        Bx += cD * (az[r] - az[l]);
        By += cD * (az[u] - az[d]);
        Bz -= cD * (ax[r] - ax[l] + ay[u] - ay[d]);
      }
      if (useAc) {
        const s = acv * acS[i];
        Bx += s * adx; By += s * ady; Bz += s * adz;
      }
      if (dm) { Bx += hx[i]; By += hy[i]; Bz += hz[i]; }
      const a = al[i], g = GAMMA / (1 + a * a);
      const cx = y * Bz - z * By, cy = z * Bx - x * Bz, cz = x * By - y * Bx;
      let tx = -g * (cx + a * (y * cz - z * cy));
      let ty = -g * (cy + a * (z * cx - x * cz));
      let tz = -g * (cz + a * (x * cy - y * cx));
      if (useZ) {
        const Dx = (ux * (ax[r] - ax[l]) + uy * (ax[u] - ax[d])) * i2;
        const Dy = (ux * (ay[r] - ay[l]) + uy * (ay[u] - ay[d])) * i2;
        const Dz = (ux * (az[r] - az[l]) + uy * (az[u] - az[d])) * i2;
        const wx = y * Dz - z * Dy, wy = z * Dx - x * Dz, wz = x * Dy - y * Dx;
        const md = x * Dx + y * Dy + z * Dz;
        const inv = 1 / (1 + a * a);
        const f1 = -(1 + a * beta) * inv, f2 = (beta - a) * inv, f3 = a * beta * inv;
        tx += f1 * Dx + f2 * wx + f3 * md * x;
        ty += f1 * Dy + f2 * wy + f3 * md * y;
        tz += f1 * Dz + f2 * wz + f3 * md * z;
      }
      ox[i] = tx; oy[i] = ty; oz[i] = tz;
    }
  }

  step(dt, t) {
    const act = this.act, na = act.length;
    const mx = this.mx, my = this.my, mz = this.mz, tx = this.tx, ty = this.ty, tz = this.tz;
    const K = this.K, k1 = K[0], k2 = K[1], k3 = K[2], k4 = K[3];
    if (this.demagOn) {
      if (this.dmCount <= 0) { this.updateDemag(); this.dmCount = this.demagEvery; }
      this.dmCount--;
    }
    const h2 = 0.5 * dt;
    this.deriv(mx, my, mz, k1[0], k1[1], k1[2], t);
    for (let q = 0; q < na; q++) {
      const i = act[q];
      tx[i] = mx[i] + h2 * k1[0][i]; ty[i] = my[i] + h2 * k1[1][i]; tz[i] = mz[i] + h2 * k1[2][i];
    }
    this.deriv(tx, ty, tz, k2[0], k2[1], k2[2], t + h2);
    for (let q = 0; q < na; q++) {
      const i = act[q];
      tx[i] = mx[i] + h2 * k2[0][i]; ty[i] = my[i] + h2 * k2[1][i]; tz[i] = mz[i] + h2 * k2[2][i];
    }
    this.deriv(tx, ty, tz, k3[0], k3[1], k3[2], t + h2);
    for (let q = 0; q < na; q++) {
      const i = act[q];
      tx[i] = mx[i] + dt * k3[0][i]; ty[i] = my[i] + dt * k3[1][i]; tz[i] = mz[i] + dt * k3[2][i];
    }
    this.deriv(tx, ty, tz, k4[0], k4[1], k4[2], t + dt);
    const d6 = dt / 6;
    for (let q = 0; q < na; q++) {
      const i = act[q];
      let x = mx[i] + d6 * (k1[0][i] + 2 * k2[0][i] + 2 * k3[0][i] + k4[0][i]);
      let y = my[i] + d6 * (k1[1][i] + 2 * k2[1][i] + 2 * k3[1][i] + k4[1][i]);
      let z = mz[i] + d6 * (k1[2][i] + 2 * k2[2][i] + 2 * k3[2][i] + k4[2][i]);
      const nn = 1 / Math.sqrt(x * x + y * y + z * z);
      mx[i] = x * nn; my[i] = y * nn; mz[i] = z * nn;
    }
  }

  normalizeAll() {
    const act = this.act;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      const n = Math.sqrt(this.mx[i] * this.mx[i] + this.my[i] * this.my[i] + this.mz[i] * this.mz[i]);
      if (n < 1e-12) { this.mx[i] = 0; this.my[i] = 0; this.mz[i] = 1; continue; }
      this.mx[i] /= n; this.my[i] /= n; this.mz[i] /= n;
    }
  }

  randomize() {
    const act = this.act;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      this.mx[i] = Math.random() * 2 - 1;
      this.my[i] = Math.random() * 2 - 1;
      this.mz[i] = Math.random() * 2 - 1;
    }
    this.normalizeAll();
  }

  topoCharge() {
    const act = this.act, L = this.nbL, R = this.nbR, U = this.nbU, D = this.nbD;
    const mx = this.mx, my = this.my, mz = this.mz;
    let s = 0;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      const ax = mx[R[i]] - mx[L[i]], ay = my[R[i]] - my[L[i]], az = mz[R[i]] - mz[L[i]];
      const bx = mx[U[i]] - mx[D[i]], by = my[U[i]] - my[D[i]], bz = mz[U[i]] - mz[D[i]];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      s += mx[i] * cx + my[i] * cy + mz[i] * cz;
    }
    return s / 4 / (4 * Math.PI);
  }
}

// ===== noyau/engine.js =====
const HBAR = 1.054571817e-34;
const QE = 1.602176634e-19;
const GAMMA0 = 2.211e5;

function unit3(v) {
  const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (!(n > 0)) return [0, 0, 1];
  return [v[0] / n, v[1] / n, v[2] / n];
}

function isPow2(n) { return n > 0 && (n & (n - 1)) === 0; }

function zlVec(z) {
  if (!z) return [0, 0];
  return z.ux !== undefined ? [z.ux, z.uy || 0] : [z.u || 0, 0];
}

class Engine {
  constructor(g) {
    const n = g.nx * g.ny;
    this.nx = g.nx; this.ny = g.ny; this.n = n;
    this.c = g.c; this.dz = g.dz; this.Ms = g.Ms;
    this.mask = g.mask || null;
    this.px = !!g.px; this.py = !!g.py;
    this.kmul = null; this.kfac = null;
    this.pulses = []; this.Tc = 0; this.Dth = 1e-5;
    this.hot = false; this.sc = null; this.Tl = null; this.kf2 = null;
    this.mx = new Float64Array(n); this.my = new Float64Array(n); this.mz = new Float64Array(n);
    this.sx = new Float64Array(n); this.sy = new Float64Array(n); this.sz = new Float64Array(n);
    this.Bx = new Float64Array(n); this.By = new Float64Array(n); this.Bz = new Float64Array(n);
    this.fx = new Float64Array(n); this.fy = new Float64Array(n); this.fz = new Float64Array(n);
    this.K = [];
    for (let q = 0; q < 4; q++) this.K.push([new Float64Array(n), new Float64Array(n), new Float64Array(n)]);
    this.alpha = new Float64Array(n);
    this.thx = null; this.thy = null; this.thz = null;
    this.L = new Int32Array(n); this.R = new Int32Array(n); this.U = new Int32Array(n); this.D = new Int32Array(n);
    const act = [];
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const id = j * g.nx + i;
        if (!this.mask || this.mask[id]) act.push(id);
        this.L[id] = this.nb(id, i - 1, j, g.px, g.py);
        this.R[id] = this.nb(id, i + 1, j, g.px, g.py);
        this.U[id] = this.nb(id, i, j + 1, g.px, g.py);
        this.D[id] = this.nb(id, i, j - 1, g.px, g.py);
      }
    }
    this.act = Int32Array.from(act);
    this.terms = [];
    this.dyn = { prec: true, gamma0: GAMMA0, alpha: 0.1, edge: 0, zl: null, sl: null };
    this.T = 0;
    this.t = 0;
    this.dt = 1e-13;
    this.hasDemag = false;
    this.P = 0;
    this.rnd = uni(xorshift(20211));
  }

  nb(id, i, j, px, py) {
    const nx = this.nx, ny = this.ny;
    if (i < 0) { if (!px) return id; i = nx - 1; } else if (i >= nx) { if (!px) return id; i = 0; }
    if (j < 0) { if (!py) return id; j = ny - 1; } else if (j >= ny) { if (!py) return id; j = 0; }
    const q = j * nx + i;
    if (this.mask && !this.mask[q]) return id;
    return q;
  }

  gamma() { return (this.dyn.gamma0 || GAMMA0) / MU0; }

  aJ() {
    const s = this.dyn.sl;
    return s ? HBAR * s.J / (QE * this.dz * this.Ms) : 0;
  }

  setup(terms, dyn, T) {
    this.terms = terms;
    this.dyn = dyn;
    this.T = T || 0;
    this.prepare();
  }

  prepare() {
    const c = this.c, Ms = this.Ms, two = this.nx > 1 && this.ny > 1, macro = this.n === 1;
    let stiff = 0, km = 1;
    if (this.kmul) for (let i = 0; i < this.n; i++) if (this.kmul[i] > km) km = this.kmul[i];
    this.hasDemag = false;
    for (let k = 0; k < this.terms.length; k++) {
      const tm = this.terms[k];
      if (tm.kind === 'exchange') { if (!macro) stiff += (two ? 8 : 4) * 2 * Math.abs(tm.A) / (Ms * c * c); }
      else if (tm.kind === 'dmi') { if (!macro) stiff += 4 * Math.abs(tm.D) / (Ms * c); }
      else if (tm.kind === 'uniaxial') { tm._u = unit3(tm.u); stiff += 2 * km * Math.abs(tm.K) / Ms; }
      else if (tm.kind === 'cubic') {
        const a = unit3(tm.u1);
        let b = unit3(tm.u2);
        const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        b = unit3([b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]]);
        tm._u1 = a; tm._u2 = b;
        tm._u3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        stiff += 4 * km * Math.abs(tm.K) / Ms;
      } else if (tm.kind === 'zeeman') {
        const h = Math.sqrt(tm.H[0] * tm.H[0] + tm.H[1] * tm.H[1] + tm.H[2] * tm.H[2]);
        stiff += MU0 * (tm.phone ? 5 * Math.max(h, 8e4) : h);
        tm._w = null;
        if (tm.region === 'band') {
          const w = new Float64Array(this.n);
          for (let j = 0; j < this.ny; j++) {
            for (let i = 0; i < this.nx; i++) {
              const x = (i + 0.5) * c;
              w[j * this.nx + i] = Math.abs(x - tm.x0) <= tm.w / 2 ? 1 : 0;
            }
          }
          tm._w = w;
        }
      } else if (tm.kind === 'demag') { stiff += MU0 * Ms; this.hasDemag = true; }
    }
    const d = this.dyn;
    if (d.zl) { const u = zlVec(d.zl); stiff += (Math.abs(u[0]) + Math.abs(u[1])) / (c * this.gamma()); }
    if (d.sl) stiff += Math.abs(this.aJ()) * Math.max(1, d.sl.P || 1);
    stiff = Math.max(stiff, 1e-3);
    this.stiff = stiff;
    this.dt = 0.95 / (this.gamma() * stiff);
    this.fillAlpha();
    if (!this.hot) this.kfac = this.kmul;
    if (this.hasDemag) this.ensureDemag();
  }

  setKmul(a) {
    this.kmul = a;
    if (!this.hot) this.kfac = a;
    this.prepare();
  }

  msRel(T) {
    const Tc = this.Tc;
    if (!(Tc > 0)) return 1;
    const f = function (x) { return x >= Tc ? 0 : Math.pow(1 - x / Tc, 0.36); };
    const m0 = Math.max(f(this.T), 1e-3);
    return Math.max(f(T) / m0, 0.02);
  }

  laser(x, y, w, dT, tau) {
    if (this.pulses.length > 7) this.pulses.shift();
    this.pulses.push({ x: x, y: y, w: w, dT: dT, tau: tau, t0: this.t });
  }

  peakT() {
    if (!this.hot) return this.T;
    let m = 0;
    for (let i = 0; i < this.n; i++) if (this.Tl[i] > m) m = this.Tl[i];
    return m;
  }

  coolDown() {
    this.hot = false;
    this.kfac = this.kmul;
  }

  updateHeat() {
    const ps = this.pulses;
    if (!ps.length) { if (this.hot) this.coolDown(); return; }
    const n = this.n, nx = this.nx, ny = this.ny, c = this.c, t = this.t, live = [], keep = [];
    for (let k = 0; k < ps.length; k++) {
      const q = ps[k], dt = Math.max(0, t - q.t0), w2 = q.w * q.w + 8 * this.Dth * dt;
      const a = q.dT * (q.w * q.w / w2) * Math.exp(-dt / q.tau);
      if (a > 0.5) { keep.push(q); live.push([q.x, q.y, w2, a]); }
    }
    this.pulses = keep;
    if (!live.length) { this.coolDown(); return; }
    if (!this.sc) { this.sc = new Float64Array(n); this.Tl = new Float64Array(n); this.kf2 = new Float64Array(n); }
    const sc = this.sc, Tl = this.Tl, kf = this.kf2, km = this.kmul;
    for (let j = 0; j < ny; j++) {
      const y = (j + 0.5) * c;
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * c, id = j * nx + i;
        let T = this.T;
        for (let k = 0; k < live.length; k++) {
          const L = live[k], dx = x - L[0], dy = y - L[1];
          T += L[3] * Math.exp(-2 * (dx * dx + dy * dy) / L[2]);
        }
        const m = this.msRel(T);
        Tl[id] = T; sc[id] = m; kf[id] = (km ? km[id] : 1) * m * m;
      }
    }
    this.hot = true;
    this.kfac = kf;
  }

  fillAlpha() {
    const d = this.dyn, a0 = d.alpha, ew = d.edge || 0, c = this.c, nx = this.nx, ny = this.ny;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let a = a0;
        if (ew > 0) {
          const x = (i + 0.5) * c, y = (j + 0.5) * c, Lx = nx * c, Ly = ny * c;
          let dist = Math.min(x, Lx - x);
          if (ny > 1) dist = Math.min(dist, y, Ly - y);
          const s = clamp((ew - dist) / ew, 0, 1);
          a = a0 + (0.5 - a0) * s * s;
        }
        this.alpha[j * nx + i] = a;
      }
    }
  }

  ensureDemag() {
    const per = this.px && this.py && isPow2(this.nx) && isPow2(this.ny);
    let Px = this.nx, Py = this.ny;
    if (!per) {
      Px = 2; while (Px < 2 * this.nx) Px <<= 1;
      Py = 2; while (Py < 2 * this.ny) Py <<= 1;
    }
    if (this.Px === Px && this.Py === Py && this.gz) {
      if (this._kt !== this.dz) this.buildKernel();
      return;
    }
    this.Px = Px; this.Py = Py; this.per = per; this.P = Px;
    this.fft2 = makeFFT2R(Px, Py);
    const PP = Px * Py;
    this.r1 = new Float64Array(PP); this.i1 = new Float64Array(PP);
    this.r2 = new Float64Array(PP); this.i2 = new Float64Array(PP);
    this.r3 = new Float64Array(PP); this.i3 = new Float64Array(PP);
    this.gxx = new Float64Array(PP); this.gxy = new Float64Array(PP);
    this.gyy = new Float64Array(PP); this.gz = new Float64Array(PP);
    this.hdx = new Float64Array(this.n); this.hdy = new Float64Array(this.n); this.hdz = new Float64Array(this.n);
    this.buildKernel();
  }

  buildKernel() {
    const Px = this.Px, Py = this.Py, c = this.c, t = this.dz;
    this._kt = t;
    for (let ky = 0; ky < Py; ky++) {
      const iy = ky < Py / 2 ? ky : ky - Py, kyv = TAU * iy / (Py * c);
      for (let kx = 0; kx < Px; kx++) {
        const ix = kx < Px / 2 ? kx : kx - Px, kxv = TAU * ix / (Px * c);
        const p = ky * Px + kx, k2 = kxv * kxv + kyv * kyv;
        if (k2 === 0) {
          this.gxx[p] = 0; this.gxy[p] = 0; this.gyy[p] = 0; this.gz[p] = -1;
          continue;
        }
        const k = Math.sqrt(k2), f = (1 - Math.exp(-k * t)) / (k * t), w = (1 - f) / k2;
        this.gxx[p] = -w * kxv * kxv;
        this.gxy[p] = -w * kxv * kyv;
        this.gyy[p] = -w * kyv * kyv;
        this.gz[p] = -f;
      }
    }
  }

  updateDemag(ax, ay, az) {
    const Px = this.Px, Py = this.Py, nx = this.nx, ny = this.ny, mask = this.mask, sc = this.hot ? this.sc : null;
    const r1 = this.r1, i1 = this.i1, r2 = this.r2, i2 = this.i2, r3 = this.r3, i3 = this.i3;
    r1.fill(0); i1.fill(0); r2.fill(0); i2.fill(0);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (mask && !mask[id]) continue;
        const p = j * Px + i, w = sc ? sc[id] : 1;
        r1[p] = w * ax[id]; i1[p] = w * ay[id]; r2[p] = w * az[id];
      }
    }
    this.fft2(r1, i1, false);
    this.fft2(r2, i2, false);
    const gxx = this.gxx, gxy = this.gxy, gyy = this.gyy, gz = this.gz;
    for (let ky = 0; ky < Py; ky++) {
      const qy = ((Py - ky) % Py) * Px;
      for (let kx = 0; kx < Px; kx++) {
        const p = ky * Px + kx, q = qy + ((Px - kx) % Px);
        const ar = r1[p], ai = i1[p], br = r1[q], bi = -i1[q];
        const mxr = 0.5 * (ar + br), mxi = 0.5 * (ai + bi);
        const myr = 0.5 * (ai - bi), myi = -0.5 * (ar - br);
        const hxr = gxx[p] * mxr + gxy[p] * myr, hxi = gxx[p] * mxi + gxy[p] * myi;
        const hyr = gxy[p] * mxr + gyy[p] * myr, hyi = gxy[p] * mxi + gyy[p] * myi;
        r3[p] = hxr - hyi; i3[p] = hxi + hyr;
        r2[p] *= gz[p]; i2[p] *= gz[p];
      }
    }
    this.fft2(r3, i3, true);
    this.fft2(r2, i2, true);
    const s = MU0 * this.Ms;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, p = j * Px + i;
        if (mask && !mask[id]) { this.hdx[id] = 0; this.hdy[id] = 0; this.hdz[id] = 0; continue; }
        this.hdx[id] = s * r3[p]; this.hdy[id] = s * i3[p]; this.hdz[id] = s * r2[p];
      }
    }
  }

  zfun(tm, t) {
    if (tm.func === 'sin') return Math.sin(TAU * tm.f * (t - tm.t0));
    if (tm.func === 'sinc') {
      const x = TAU * tm.f * (t - tm.t0);
      return Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x;
    }
    if (tm.func === 'window') return (t >= tm.t0 && t < tm.t0 + tm.tw) ? 1 : 0;
    if (tm.func === 'ramp') return t < tm.t0 ? 0 : Math.min(1, (t - tm.t0) / Math.max(tm.tw, 1e-15));
    if (tm.func === 'gauss') { const x = (t - tm.t0) / Math.max(tm.tw, 1e-15); return Math.exp(-0.5 * x * x); }
    return 1;
  }

  fieldInto(ax, ay, az, t, Bx, By, Bz, only) {
    const act = this.act, na = act.length, L = this.L, R = this.R, U = this.U, D = this.D;
    const Ms = this.Ms, c = this.c, macro = this.n === 1, hot = this.hot, sc = this.sc, kf = this.kfac;
    for (let q = 0; q < na; q++) { const i = act[q]; Bx[i] = 0; By[i] = 0; Bz[i] = 0; }
    for (let k = 0; k < this.terms.length; k++) {
      if (only >= 0 && k !== only) continue;
      const tm = this.terms[k];
      if (tm.kind === 'exchange') {
        if (macro) continue;
        const f = 2 * tm.A / (Ms * c * c);
        if (hot) {
          for (let q = 0; q < na; q++) {
            const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i];
            const wl = sc[l], wr = sc[r], wu = sc[u], wd = sc[d], x = ax[i], y = ay[i], z = az[i];
            Bx[i] += f * (wl * (ax[l] - x) + wr * (ax[r] - x) + wu * (ax[u] - x) + wd * (ax[d] - x));
            By[i] += f * (wl * (ay[l] - y) + wr * (ay[r] - y) + wu * (ay[u] - y) + wd * (ay[d] - y));
            Bz[i] += f * (wl * (az[l] - z) + wr * (az[r] - z) + wu * (az[u] - z) + wd * (az[d] - z));
          }
          continue;
        }
        for (let q = 0; q < na; q++) {
          const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i];
          Bx[i] += f * (ax[l] + ax[r] + ax[u] + ax[d] - 4 * ax[i]);
          By[i] += f * (ay[l] + ay[r] + ay[u] + ay[d] - 4 * ay[i]);
          Bz[i] += f * (az[l] + az[r] + az[u] + az[d] - 4 * az[i]);
        }
      } else if (tm.kind === 'dmi') {
        if (macro) continue;
        const f = tm.D / (Ms * c);
        if (tm.cls === 'T') {
          for (let q = 0; q < na; q++) {
            const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i], g = hot ? f * sc[i] : f;
            Bx[i] -= g * (az[u] - az[d]);
            By[i] += g * (az[r] - az[l]);
            Bz[i] -= g * ((ay[r] - ay[l]) - (ax[u] - ax[d]));
          }
        } else {
          for (let q = 0; q < na; q++) {
            const i = act[q], l = L[i], r = R[i], u = U[i], d = D[i], g = hot ? f * sc[i] : f;
            Bx[i] += g * (az[r] - az[l]);
            By[i] += g * (az[u] - az[d]);
            Bz[i] -= g * ((ax[r] - ax[l]) + (ay[u] - ay[d]));
          }
        }
      } else if (tm.kind === 'uniaxial') {
        const f = 2 * tm.K / Ms, u = tm._u || unit3(tm.u);
        for (let q = 0; q < na; q++) {
          const i = act[q], p = (kf ? f * kf[i] : f) * (ax[i] * u[0] + ay[i] * u[1] + az[i] * u[2]);
          Bx[i] += p * u[0]; By[i] += p * u[1]; Bz[i] += p * u[2];
        }
      } else if (tm.kind === 'cubic') {
        const f = 4 * tm.K / Ms, a = tm._u1, b = tm._u2, e = tm._u3;
        for (let q = 0; q < na; q++) {
          const i = act[q], x = ax[i], y = ay[i], z = az[i];
          const p1 = x * a[0] + y * a[1] + z * a[2], p2 = x * b[0] + y * b[1] + z * b[2], p3 = x * e[0] + y * e[1] + z * e[2];
          const g = kf ? f * kf[i] : f, c1 = g * p1 * p1 * p1, c2 = g * p2 * p2 * p2, c3 = g * p3 * p3 * p3;
          Bx[i] += c1 * a[0] + c2 * b[0] + c3 * e[0];
          By[i] += c1 * a[1] + c2 * b[1] + c3 * e[1];
          Bz[i] += c1 * a[2] + c2 * b[2] + c3 * e[2];
        }
      } else if (tm.kind === 'zeeman') {
        const g = this.zfun(tm, t);
        if (g === 0) continue;
        const H = tm.Hnow || tm.H, bx = MU0 * H[0] * g, by = MU0 * H[1] * g, bz = MU0 * H[2] * g, w = tm._w;
        for (let q = 0; q < na; q++) {
          const i = act[q], s = w ? w[i] : 1;
          if (s === 0) continue;
          Bx[i] += s * bx; By[i] += s * by; Bz[i] += s * bz;
        }
      } else if (tm.kind === 'demag') {
        const hx = this.hdx, hy = this.hdy, hz = this.hdz;
        for (let q = 0; q < na; q++) {
          const i = act[q];
          Bx[i] += hx[i]; By[i] += hy[i]; Bz[i] += hz[i];
        }
      }
    }
  }

  thermal(dt) {
    const n = this.n;
    if (!this.thx) { this.thx = new Float64Array(n); this.thy = new Float64Array(n); this.thz = new Float64Array(n); }
    const V = this.c * this.c * this.dz, g = this.gamma(), act = this.act, u = this.rnd;
    const Tl = this.hot ? this.Tl : null, sc = this.hot ? this.sc : null;
    for (let q = 0; q < act.length; q++) {
      const i = act[q], T = Tl ? Tl[i] : this.T;
      if (!(T > 0)) { this.thx[i] = 0; this.thy[i] = 0; this.thz[i] = 0; continue; }
      const s = Math.sqrt(2 * Math.max(this.alpha[i], 1e-4) * KB * T / (g * this.Ms * (sc ? Math.max(sc[i], 0.05) : 1) * V * dt));
      this.thx[i] = s * gauss(u); this.thy[i] = s * gauss(u); this.thz[i] = s * gauss(u);
    }
  }

  deriv(ax, ay, az, t, ox, oy, oz, relax, th) {
    this.fieldInto(ax, ay, az, t, this.Bx, this.By, this.Bz, -1);
    const act = this.act, na = act.length, Bx = this.Bx, By = this.By, Bz = this.Bz, al = this.alpha;
    const g = this.gamma(), d = this.dyn, prec = d.prec;
    const zu = zlVec(d.zl), zl = !relax && d.zl && (zu[0] !== 0 || zu[1] !== 0) ? d.zl : null, sl = !relax && d.sl && d.sl.J !== 0 ? d.sl : null;
    const L = this.L, R = this.R, Uu = this.U, Dd = this.D, i2 = 1 / (2 * this.c), zux = zu[0], zuy = zu[1];
    const aj = sl ? this.aJ() : 0, mp = sl ? unit3(sl.mp) : null, P = sl ? sl.P : 0, Lam2 = sl ? sl.Lambda * sl.Lambda : 1, ep = sl ? (sl.eps || 0) : 0;
    const useTh = th && this.thx;
    for (let q = 0; q < na; q++) {
      const i = act[q], x = ax[i], y = ay[i], z = az[i];
      let bx = Bx[i], by = By[i], bz = Bz[i];
      if (useTh) { bx += this.thx[i]; by += this.thy[i]; bz += this.thz[i]; }
      const cx = y * bz - z * by, cy = z * bx - x * bz, cz = x * by - y * bx;
      const ex = y * cz - z * cy, ey = z * cx - x * cz, ez = x * cy - y * cx;
      if (relax) { ox[i] = -g * ex; oy[i] = -g * ey; oz[i] = -g * ez; continue; }
      const a = al[i], inv = 1 / (1 + a * a), k = g * inv;
      let tx = -k * a * ex, ty = -k * a * ey, tz = -k * a * ez;
      if (prec) { tx -= k * cx; ty -= k * cy; tz -= k * cz; }
      let Tx = 0, Ty = 0, Tz = 0;
      if (zl) {
        const l = L[i], r = R[i], uu = Uu[i], dd = Dd[i], beta = zl.beta;
        const Dx = (zux * (ax[r] - ax[l]) + zuy * (ax[uu] - ax[dd])) * i2;
        const Dy = (zux * (ay[r] - ay[l]) + zuy * (ay[uu] - ay[dd])) * i2;
        const Dz = (zux * (az[r] - az[l]) + zuy * (az[uu] - az[dd])) * i2;
        const wx = y * Dz - z * Dy, wy = z * Dx - x * Dz, wz = x * Dy - y * Dx;
        Tx += -Dx + beta * wx; Ty += -Dy + beta * wy; Tz += -Dz + beta * wz;
      }
      if (sl) {
        const mdp = x * mp[0] + y * mp[1] + z * mp[2];
        const eps = P * Lam2 / ((Lam2 + 1) + (Lam2 - 1) * mdp);
        const px = mp[0] - mdp * x, py = mp[1] - mdp * y, pz = mp[2] - mdp * z;
        const qx = y * mp[2] - z * mp[1], qy = z * mp[0] - x * mp[2], qz = x * mp[1] - y * mp[0];
        Tx += g * aj * (eps * px - ep * qx);
        Ty += g * aj * (eps * py - ep * qy);
        Tz += g * aj * (eps * pz - ep * qz);
      }
      if (zl || sl) {
        const mx2 = y * Tz - z * Ty, my2 = z * Tx - x * Tz, mz2 = x * Ty - y * Tx;
        tx += inv * (Tx + a * mx2); ty += inv * (Ty + a * my2); tz += inv * (Tz + a * mz2);
      }
      ox[i] = tx; oy[i] = ty; oz[i] = tz;
    }
  }

  rk4(dt, relax) {
    const act = this.act, na = act.length;
    const mx = this.mx, my = this.my, mz = this.mz, sx = this.sx, sy = this.sy, sz = this.sz;
    const k1 = this.K[0], k2 = this.K[1], k3 = this.K[2], k4 = this.K[3];
    if (!relax) this.updateHeat(); else if (this.hot) this.coolDown();
    const t = this.t, h2 = 0.5 * dt, th = !relax && (this.T > 0 || this.hot);
    if (this.hasDemag) this.updateDemag(mx, my, mz);
    if (th) this.thermal(dt);
    this.deriv(mx, my, mz, t, k1[0], k1[1], k1[2], relax, th);
    for (let q = 0; q < na; q++) { const i = act[q]; sx[i] = mx[i] + h2 * k1[0][i]; sy[i] = my[i] + h2 * k1[1][i]; sz[i] = mz[i] + h2 * k1[2][i]; }
    this.deriv(sx, sy, sz, t + h2, k2[0], k2[1], k2[2], relax, th);
    for (let q = 0; q < na; q++) { const i = act[q]; sx[i] = mx[i] + h2 * k2[0][i]; sy[i] = my[i] + h2 * k2[1][i]; sz[i] = mz[i] + h2 * k2[2][i]; }
    this.deriv(sx, sy, sz, t + h2, k3[0], k3[1], k3[2], relax, th);
    for (let q = 0; q < na; q++) { const i = act[q]; sx[i] = mx[i] + dt * k3[0][i]; sy[i] = my[i] + dt * k3[1][i]; sz[i] = mz[i] + dt * k3[2][i]; }
    this.deriv(sx, sy, sz, t + dt, k4[0], k4[1], k4[2], relax, th);
    const d6 = dt / 6;
    for (let q = 0; q < na; q++) {
      const i = act[q];
      const x = mx[i] + d6 * (k1[0][i] + 2 * k2[0][i] + 2 * k3[0][i] + k4[0][i]);
      const y = my[i] + d6 * (k1[1][i] + 2 * k2[1][i] + 2 * k3[1][i] + k4[1][i]);
      const z = mz[i] + d6 * (k1[2][i] + 2 * k2[2][i] + 2 * k3[2][i] + k4[2][i]);
      const nn = 1 / Math.sqrt(x * x + y * y + z * z);
      mx[i] = x * nn; my[i] = y * nn; mz[i] = z * nn;
    }
    if (!relax) this.t += dt;
  }

  step(dt) { this.rk4(dt, false); }

  relax(nsteps) {
    const dt = 2.2 / (this.gamma() * this.stiff);
    for (let s = 0; s < nsteps; s++) this.rk4(dt, true);
  }

  fields(only) {
    if (this.hasDemag) this.updateDemag(this.mx, this.my, this.mz);
    this.fieldInto(this.mx, this.my, this.mz, this.t, this.fx, this.fy, this.fz, only === undefined ? -1 : only);
    return [this.fx, this.fy, this.fz];
  }

  maxTorque() {
    const f = this.fields(-1), act = this.act, mx = this.mx, my = this.my, mz = this.mz;
    let mt = 0;
    for (let q = 0; q < act.length; q++) {
      const i = act[q], x = mx[i], y = my[i], z = mz[i], bx = f[0][i], by = f[1][i], bz = f[2][i];
      const cx = y * bz - z * by, cy = z * bx - x * bz, cz = x * by - y * bx;
      const v = cx * cx + cy * cy + cz * cz;
      if (v > mt) mt = v;
    }
    return Math.sqrt(mt);
  }

  energies() {
    if (this.hasDemag) this.updateDemag(this.mx, this.my, this.mz);
    const V = this.c * this.c * this.dz, Ms = this.Ms, act = this.act, mx = this.mx, my = this.my, mz = this.mz;
    const out = [];
    let tot = 0;
    for (let k = 0; k < this.terms.length; k++) {
      const tm = this.terms[k];
      let E = 0;
      if (tm.kind === 'cubic') {
        const a = tm._u1, b = tm._u2, e = tm._u3;
        for (let q = 0; q < act.length; q++) {
          const i = act[q], x = mx[i], y = my[i], z = mz[i];
          const p1 = x * a[0] + y * a[1] + z * a[2], p2 = x * b[0] + y * b[1] + z * b[2], p3 = x * e[0] + y * e[1] + z * e[2];
          E -= tm.K * (p1 * p1 * p1 * p1 + p2 * p2 * p2 * p2 + p3 * p3 * p3 * p3) * V;
        }
      } else {
        this.fieldInto(mx, my, mz, this.t, this.fx, this.fy, this.fz, k);
        let s = 0;
        for (let q = 0; q < act.length; q++) { const i = act[q]; s += mx[i] * this.fx[i] + my[i] * this.fy[i] + mz[i] * this.fz[i]; }
        E = (tm.kind === 'zeeman' ? -1 : -0.5) * Ms * V * s;
      }
      out.push(E);
      tot += E;
    }
    return { total: tot, terms: out };
  }

  mean() {
    const act = this.act, na = act.length || 1;
    let x = 0, y = 0, z = 0;
    for (let q = 0; q < act.length; q++) { const i = act[q]; x += this.mx[i]; y += this.my[i]; z += this.mz[i]; }
    return [x / na, y / na, z / na];
  }

  topoCharge() {
    if (this.nx < 2 || this.ny < 2) return 0;
    const act = this.act, L = this.L, R = this.R, U = this.U, D = this.D, mx = this.mx, my = this.my, mz = this.mz;
    let s = 0;
    for (let q = 0; q < act.length; q++) {
      const i = act[q];
      const ax = mx[R[i]] - mx[L[i]], ay = my[R[i]] - my[L[i]], az = mz[R[i]] - mz[L[i]];
      const bx = mx[U[i]] - mx[D[i]], by = my[U[i]] - my[D[i]], bz = mz[U[i]] - mz[D[i]];
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      s += mx[i] * cx + my[i] * cy + mz[i] * cz;
    }
    return s / 4 / (4 * Math.PI);
  }

  snapshot() {
    const n = this.n, s = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) { s[3 * i] = this.mx[i]; s[3 * i + 1] = this.my[i]; s[3 * i + 2] = this.mz[i]; }
    return s;
  }
}

// ===== noyau/sound.js =====
const Snd = {
  on: false, ctx: null, master: null, clickBuf: null, hum: null, clickBudget: 0,

  ensure: function () {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch (e) {
      return false;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const n = Math.floor(this.ctx.sampleRate * 0.035), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.18));
    this.clickBuf = b;
    return true;
  },

  setOn: function (v) {
    this.on = !!v;
    if (this.on) {
      if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume();
    } else {
      this.stopHum();
    }
  },

  tick: function () { this.clickBudget = 7; },

  click: function (a) {
    if (!this.on || !this.ensure() || this.clickBudget <= 0) return;
    this.clickBudget--;
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = this.clickBuf;
    src.playbackRate.value = 0.6 + Math.random() * 0.9;
    g.gain.value = clamp(a, 0, 1) * 0.9;
    src.connect(g);
    g.connect(this.master);
    src.start(c.currentTime + Math.random() * 0.03);
  },

  tone: function (f, dur, vol, type, delay) {
    if (!this.on || !this.ensure()) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (delay || 0);
    o.type = type || 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  ding: function () {
    this.tone(784, 0.35, 0.18, 'triangle');
    this.tone(1175, 0.5, 0.14, 'triangle', 0.09);
  },

  flip: function () {
    this.tone(523, 0.12, 0.16, 'square');
    this.tone(784, 0.18, 0.12, 'square', 0.07);
  },

  setHum: function (f, a) {
    if (!this.on || !this.ensure()) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.hum) {
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o.type = 'triangle';
      o.frequency.value = Math.max(40, f);
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      g.gain.value = 0;
      o.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      o.start();
      this.hum = { o: o, g: g };
    }
    this.hum.o.frequency.setTargetAtTime(clamp(f, 40, 2400), t, 0.05);
    this.hum.g.gain.setTargetAtTime(clamp(a, 0, 1) * 0.22, t, 0.06);
  },

  stopHum: function () {
    if (!this.hum || !this.ctx) { this.hum = null; return; }
    const h = this.hum, t = this.ctx.currentTime;
    h.g.gain.setTargetAtTime(0, t, 0.04);
    try { h.o.stop(t + 0.3); } catch (e) {}
    this.hum = null;
  },

  buzz: function (ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }
};

// ===== vue/viz.js =====
class Plot {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.box = { l: 52, t: 26, r: 14, b: 34 };
    this.xmin = 0; this.xmax = 1; this.ymin = 0; this.ymax = 1;
    this.W = 300; this.H = 160; this.pw = 200; this.ph = 100;
  }

  begin(title, xmin, xmax, ymin, ymax, xlab, ylab) {
    const c = this.c, ctx = this.ctx, dpr = c._dpr || 1;
    const W = c._w || c.clientWidth || 300, H = c._h || c.clientHeight || 160;
    this.W = W; this.H = H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!(xmax > xmin)) xmax = xmin + 1;
    if (!(ymax > ymin)) ymax = ymin + 1;
    this.xmin = xmin; this.xmax = xmax; this.ymin = ymin; this.ymax = ymax;
    const b = this.box;
    this.pw = Math.max(10, W - b.l - b.r);
    this.ph = Math.max(10, H - b.t - b.b);
    ctx.fillStyle = PAL.ink;
    ctx.font = fnt(12.5, 700);
    ctx.textAlign = 'left';
    ctx.fillText(title, b.l, 16);
    const sx = niceStep(xmax - xmin, Math.max(3, Math.round(this.pw / 70))), sy = niceStep(ymax - ymin, 4);
    ctx.lineWidth = 1;
    ctx.font = fnt(11, 400);
    ctx.textAlign = 'center';
    const x0 = Math.ceil(xmin / sx - 1e-9) * sx;
    for (let i = 0; i < 80; i++) {
      const v = x0 + i * sx;
      if (v > xmax + sx * 1e-6) break;
      const x = this.X(v);
      ctx.strokeStyle = 'rgba(23,20,15,0.07)';
      ctx.beginPath(); ctx.moveTo(x, b.t); ctx.lineTo(x, b.t + this.ph); ctx.stroke();
      ctx.fillStyle = PAL.ink3;
      ctx.fillText(tickLabel(v), x, b.t + this.ph + 14);
    }
    ctx.textAlign = 'right';
    const y0 = Math.ceil(ymin / sy - 1e-9) * sy;
    for (let i = 0; i < 80; i++) {
      const v = y0 + i * sy;
      if (v > ymax + sy * 1e-6) break;
      const y = this.Y(v);
      ctx.strokeStyle = Math.abs(v) < sy * 1e-6 ? 'rgba(23,20,15,0.35)' : 'rgba(23,20,15,0.07)';
      ctx.beginPath(); ctx.moveTo(b.l, y); ctx.lineTo(b.l + this.pw, y); ctx.stroke();
      ctx.fillStyle = PAL.ink3;
      ctx.fillText(tickLabel(v), b.l - 6, y + 4);
    }
    ctx.fillStyle = PAL.ink2;
    ctx.textAlign = 'center';
    if (xlab) ctx.fillText(xlab, b.l + this.pw / 2, H - 5);
    if (ylab) {
      ctx.save();
      ctx.translate(12, b.t + this.ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(ylab, 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(23,20,15,0.6)';
    ctx.strokeRect(b.l + 0.5, b.t + 0.5, this.pw, this.ph);
  }

  X(v) { return this.box.l + (v - this.xmin) / (this.xmax - this.xmin) * this.pw; }
  Y(v) { return this.box.t + (1 - (v - this.ymin) / (this.ymax - this.ymin)) * this.ph; }
  invX(px) { return this.xmin + (px - this.box.l) / this.pw * (this.xmax - this.xmin); }
  invY(py) { return this.ymin + (1 - (py - this.box.t) / this.ph) * (this.ymax - this.ymin); }

  clip() {
    const ctx = this.ctx, b = this.box;
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.l, b.t, this.pw, this.ph);
    ctx.clip();
  }
  unclip() { this.ctx.restore(); }

  line(xs, ys, col, lw, dash) {
    const ctx = this.ctx, n = Math.min(xs.length, ys.length);
    if (n < 2) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw || 2;
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(this.X(xs[0]), this.Y(ys[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(this.X(xs[i]), this.Y(ys[i]));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  dots(xs, ys, col, r) {
    const ctx = this.ctx, n = Math.min(xs.length, ys.length), rr = r || 3;
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(this.X(xs[i]), this.Y(ys[i]), rr, 0, TAU);
      ctx.fill();
    }
  }

  dot(x, y, col, r) {
    const ctx = this.ctx;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(this.X(x), this.Y(y), r || 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PAL.card;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  vline(x, col, dash, label) {
    const ctx = this.ctx, b = this.box, px = this.X(x);
    if (px < b.l || px > b.l + this.pw) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash ? [5, 4] : []);
    ctx.beginPath(); ctx.moveTo(px, b.t); ctx.lineTo(px, b.t + this.ph); ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.fillStyle = col;
      ctx.font = fnt(11, 700);
      ctx.textAlign = 'left';
      ctx.fillText(label, px + 4, b.t + 13);
    }
  }

  hline(y, col, dash, label) {
    const ctx = this.ctx, b = this.box, py = this.Y(y);
    if (py < b.t || py > b.t + this.ph) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash ? [5, 4] : []);
    ctx.beginPath(); ctx.moveTo(b.l, py); ctx.lineTo(b.l + this.pw, py); ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.fillStyle = col;
      ctx.font = fnt(11, 700);
      ctx.textAlign = 'right';
      ctx.fillText(label, b.l + this.pw - 4, py - 4);
    }
  }

  text(s, x, y, col, align) {
    const ctx = this.ctx;
    ctx.fillStyle = col || PAL.ink2;
    ctx.font = fnt(11.5, 400);
    ctx.textAlign = align || 'left';
    ctx.fillText(s, x, y);
  }

  legend(defs) {
    const ctx = this.ctx;
    let x = this.W - this.box.r - 4;
    ctx.font = fnt(11, 700);
    ctx.textAlign = 'right';
    for (let i = defs.length - 1; i >= 0; i--) {
      const d = defs[i], w = ctx.measureText(d.label).width;
      ctx.fillStyle = PAL.ink2;
      ctx.fillText(d.label, x, 16);
      ctx.fillStyle = d.col;
      ctx.fillRect(x - w - 16, 11, 11, 4);
      x -= w + 26;
    }
  }
}

function drawSphere(ctx, W, H, view, it) {
  const R = Math.min(W, H) * 0.34, cx = (it.cx !== undefined ? it.cx : W * 0.5), cy = H * 0.53;
  const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const P = function (x, y, z) {
    const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw;
    return [cx + R * x1, cy - R * (y1 * sp + z * cp), -y1 * cp + z * sp];
  };
  ctx.fillStyle = 'rgba(23,20,15,0.07)';
  ctx.beginPath(); ctx.ellipse(cx, cy + R * 1.1, R * 0.78, R * 0.1, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx, cy, R);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(1, 'rgba(216,207,191,0.6)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(23,20,15,0.55)';
  ctx.stroke();

  const ring = function (f, colFront, colBack) {
    let prev = P.apply(null, f(0));
    for (let i = 1; i <= 96; i++) {
      const cur = P.apply(null, f(TAU * i / 96));
      ctx.strokeStyle = (prev[2] + cur[2]) > 0 ? colFront : colBack;
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
      prev = cur;
    }
  };
  ctx.lineWidth = 1;
  ring(function (a) { return [Math.cos(a), Math.sin(a), 0]; }, 'rgba(23,20,15,0.42)', 'rgba(23,20,15,0.10)');
  ring(function (a) { return [Math.cos(a), 0, Math.sin(a)]; }, 'rgba(23,20,15,0.22)', 'rgba(23,20,15,0.06)');
  ring(function (a) { return [0, Math.cos(a), Math.sin(a)]; }, 'rgba(23,20,15,0.22)', 'rgba(23,20,15,0.06)');
  ring(function (a) { return [0.7071 * Math.cos(a), 0.7071 * Math.sin(a), 0.7071]; }, 'rgba(23,20,15,0.13)', 'rgba(23,20,15,0.04)');
  ring(function (a) { return [0.7071 * Math.cos(a), 0.7071 * Math.sin(a), -0.7071]; }, 'rgba(23,20,15,0.13)', 'rgba(23,20,15,0.04)');

  ctx.font = fnt(13, 700);
  ctx.textAlign = 'center';
  const axes = it.axes || [[1.32, 0, 0, 'x'], [0, 1.32, 0, 'y'], [0, 0, 1.32, 'z']];
  for (let k = 0; k < 3; k++) {
    const a = axes[k], p0 = P(-a[0] / 1.32 * 1.15, -a[1] / 1.32 * 1.15, -a[2] / 1.32 * 1.15), p1 = P(a[0] / 1.32 * 1.15, a[1] / 1.32 * 1.15, a[2] / 1.32 * 1.15);
    ctx.strokeStyle = 'rgba(23,20,15,0.22)';
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    const pl = P(a[0], a[1], a[2]);
    ctx.fillStyle = PAL.ink3;
    ctx.fillText(a[3], pl[0], pl[1] + 4);
  }

  const arrow = function (a, b, col, lw, o) {
    o = o || {};
    const p0 = P(a[0], a[1], a[2]), p1 = P(b[0], b[1], b[2]);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.setLineDash(o.dash ? [6, 5] : []);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / L, uy = dy / L, hs = o.head || 11;
    if (!o.nohead) {
      ctx.beginPath();
      ctx.moveTo(p1[0] + ux * hs * 0.6, p1[1] + uy * hs * 0.6);
      ctx.lineTo(p1[0] - ux * hs + uy * hs * 0.5, p1[1] - uy * hs - ux * hs * 0.5);
      ctx.lineTo(p1[0] - ux * hs - uy * hs * 0.5, p1[1] - uy * hs + ux * hs * 0.5);
      ctx.closePath(); ctx.fill();
    }
    if (o.label) {
      ctx.font = fnt(14, 700, FONTD);
      ctx.textAlign = 'center';
      ctx.fillText(o.label, p1[0] + ux * 18, p1[1] + uy * 18 + 5);
    }
  };

  const vecs = it.vecs || [];
  for (let k = 0; k < vecs.length; k++) {
    const v = vecs[k];
    if (v.axis) arrow([-v.v[0], -v.v[1], -v.v[2]], v.v, rgba(PAL.ink, 0.45), 1.5, { dash: true, nohead: true, label: v.label });
    else arrow([0, 0, 0], v.v, v.col, 3.2, { label: v.label, head: 12 });
  }

  const tr = it.trail || [];
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 1; i < tr.length; i++) {
    const a = P(tr[i - 1][0], tr[i - 1][1], tr[i - 1][2]), b = P(tr[i][0], tr[i][1], tr[i][2]);
    const f = i / tr.length, c = lerp3([31, 78, 156], [215, 48, 31], (clamp(tr[i][2], -1, 1) + 1) / 2);
    ctx.strokeStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (Math.pow(f, 1.5) * 0.85).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.lineCap = 'butt';

  const m = it.m;
  if (m) {
    arrow([0, 0, 0], [m[0], m[1], 0], 'rgba(23,20,15,0.25)', 1.2, { dash: true, nohead: true });
    arrow([m[0], m[1], 0], [m[0], m[1], m[2]], 'rgba(23,20,15,0.25)', 1.2, { dash: true, nohead: true });
    const pf = P(m[0], m[1], 0);
    ctx.fillStyle = 'rgba(23,20,15,0.3)';
    ctx.beginPath(); ctx.arc(pf[0], pf[1], 3, 0, TAU); ctx.fill();
    arrow([-0.26 * m[0], -0.26 * m[1], -0.26 * m[2]], [0, 0, 0], PAL.blue, 7, { nohead: true });
    arrow([0, 0, 0], m, PAL.red, 4.6, { head: 15, label: it.mLabel === undefined ? 'm' : it.mLabel });
    const pc = P(0, 0, 0);
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(pc[0], pc[1], 4.2, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.card;
    ctx.beginPath(); ctx.arc(pc[0], pc[1], 1.6, 0, TAU); ctx.fill();
  }
}

class FilmView {
  constructor(nx, ny) {
    this.nx = nx; this.ny = ny;
    this.off = document.createElement('canvas');
    this.off.width = nx; this.off.height = ny;
    this.octx = this.off.getContext('2d');
    this.img = this.octx.createImageData(nx, ny);
    this.vmax = 0.02;
    this.lay = { x0: 0, y0: 0, s: 1 };
  }

  paint(core, mode) {
    const nx = this.nx, ny = this.ny, d = this.img.data;
    const mx = core.mx, my = core.my, mz = core.mz, mask = core.mask;
    let comp = null;
    if (mode === 'mx') comp = mx; else if (mode === 'my') comp = my; else if (mode === 'mz') comp = mz;
    if (comp && mode !== 'mz') {
      let vm = 0;
      for (let i = 0; i < core.n; i++) { const a = Math.abs(comp[i]); if (a > vm) vm = a; }
      this.vmax = Math.max(this.vmax * 0.985, vm, 0.01);
    } else {
      this.vmax = 1;
    }
    const vmax = this.vmax;
    for (let j = 0; j < ny; j++) {
      const row = ny - 1 - j;
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, o = (row * nx + i) * 4;
        if (mask && mask[id] !== 1) { d[o + 3] = 0; continue; }
        let c;
        if (comp) {
          c = divRGB(comp[id] / vmax);
        } else {
          const hue = Math.atan2(my[id], mx[id]) / TAU;
          c = hsl2rgb(hue, 0.82, clamp(0.5 + 0.5 * mz[id], 0.05, 0.97));
        }
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    this.octx.putImageData(this.img, 0, 0);
  }

  draw(ctx, W, H, pad) {
    pad = pad === undefined ? 14 : pad;
    const s = Math.min((W - 2 * pad) / this.nx, (H - 2 * pad) / this.ny);
    this.lay = { s: s, x0: (W - this.nx * s) / 2, y0: (H - this.ny * s) / 2 };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, this.lay.x0, this.lay.y0, this.nx * s, this.ny * s);
    ctx.strokeStyle = 'rgba(23,20,15,0.5)';
    ctx.lineWidth = 1;
    if (!this.noFrame) ctx.strokeRect(this.lay.x0 - 0.5, this.lay.y0 - 0.5, this.nx * s + 1, this.ny * s + 1);
    return this.lay;
  }

  px(i, j) { return [this.lay.x0 + i * this.lay.s, this.lay.y0 + (this.ny - j) * this.lay.s]; }
}

function drawArrowsOver(ctx, core, view, step) {
  const L = view.lay, nx = core.nx, ny = core.ny, s = L.s, len = s * step * 0.42;
  const half = Math.floor(step / 2);
  const pass = function (style, lw) {
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let j = half; j < ny; j += step) {
      for (let i = half; i < nx; i += step) {
        const id = j * nx + i;
        if (core.mask && core.mask[id] !== 1) continue;
        const ax = core.mx[id], ay = core.my[id];
        const cx = L.x0 + (i + 0.5) * s, cy = L.y0 + (ny - j - 0.5) * s;
        ctx.moveTo(cx - ax * len, cy + ay * len);
        ctx.lineTo(cx + ax * len, cy - ay * len);
      }
    }
    ctx.stroke();
  };
  pass('rgba(255,255,255,0.7)', 3);
  pass('rgba(23,20,15,0.9)', 1.3);
  ctx.fillStyle = PAL.ink;
  for (let j = half; j < ny; j += step) {
    for (let i = half; i < nx; i += step) {
      const id = j * nx + i;
      if (core.mask && core.mask[id] !== 1) continue;
      const ax = core.mx[id], ay = core.my[id];
      const cx = L.x0 + (i + 0.5) * s, cy = L.y0 + (ny - j - 0.5) * s;
      ctx.beginPath();
      ctx.arc(cx + ax * len, cy - ay * len, 1.8, 0, TAU);
      ctx.fill();
    }
  }
}

function drawCard(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(251,248,242,0.93)';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(23,20,15,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWheelLegend(ctx, x, y, r) {
  ctx.save();
  drawCard(ctx, x - r - 12, y - r - 12, 2 * r + 80, 2 * r + 46);
  ctx.lineWidth = r * 0.34;
  for (let a = 0; a < 360; a += 4) {
    ctx.strokeStyle = rgbStr(hsl2rgb(a / 360, 0.82, 0.5));
    ctx.beginPath();
    ctx.arc(x, y, r, -a * DEG - 0.09, -a * DEG + 0.02);
    ctx.stroke();
  }
  const bx = x + r + 16, g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(bx, y - r, 9, 2 * r);
  ctx.strokeStyle = 'rgba(23,20,15,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, y - r, 9, 2 * r);
  ctx.fillStyle = PAL.ink2;
  ctx.font = fnt(11, 700);
  ctx.textAlign = 'left';
  ctx.fillText('↑ z', bx + 14, y - r + 9);
  ctx.fillText('↓ z', bx + 14, y + r);
  ctx.textAlign = 'center';
  ctx.font = fnt(10.5, 400);
  ctx.fillText('direction dans le plan', x + 26, y + r + 22);
  ctx.restore();
}

function drawScaleBar(ctx, x, y, px, label) {
  ctx.save();
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
  ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4);
  ctx.stroke();
  ctx.font = fnt(12, 700);
  ctx.textAlign = 'center';
  ctx.fillText(label, x + px / 2, y - 8);
  ctx.restore();
}

function drawLabel(ctx, txt, x, y, o) {
  o = o || {};
  ctx.save();
  ctx.font = o.font || fnt(12, 700);
  const w = ctx.measureText(txt).width + 12, h = 20;
  let x0 = x;
  if (o.align === 'center') x0 = x - w / 2;
  else if (o.align === 'right') x0 = x - w;
  ctx.fillStyle = o.bg || 'rgba(251,248,242,0.92)';
  roundRect(ctx, x0, y - 14, w, h, 4);
  ctx.fill();
  if (o.border !== false) {
    ctx.strokeStyle = o.bd || 'rgba(23,20,15,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = o.col || PAL.ink;
  ctx.textAlign = 'left';
  ctx.fillText(txt, x0 + 6, y);
  ctx.restore();
}

function drawNeedle(ctx, x, y, ang, L, W) {
  const dx = Math.cos(ang), dy = -Math.sin(ang), px = -dy, py = dx;
  ctx.fillStyle = PAL.red;
  ctx.beginPath();
  ctx.moveTo(x + dx * L, y + dy * L);
  ctx.lineTo(x + px * W, y + py * W);
  ctx.lineTo(x - px * W, y - py * W);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.blue;
  ctx.beginPath();
  ctx.moveTo(x - dx * L, y - dy * L);
  ctx.lineTo(x + px * W, y + py * W);
  ctx.lineTo(x - px * W, y - py * W);
  ctx.closePath();
  ctx.fill();
}

// ===== modes/base.js =====
function newHist(k) {
  const v = [];
  for (let i = 0; i < k; i++) v.push([]);
  return { t: [], v: v };
}

function pushHist(h, t, vals, max) {
  h.t.push(t);
  for (let k = 0; k < vals.length; k++) h.v[k].push(vals[k]);
  if (h.t.length > max) {
    h.t.shift();
    for (let k = 0; k < h.v.length; k++) h.v[k].shift();
  }
}

function drawSeries(pl, hist, defs, title, ymin, ymax, ylab) {
  const t = hist.t, n = t.length, tn = new Array(n);
  for (let i = 0; i < n; i++) tn[i] = t[i] * 1e9;
  const x0 = n ? tn[0] : 0;
  let x1 = n > 1 ? tn[n - 1] : x0 + 1;
  if (x1 - x0 < 1e-6) x1 = x0 + 1;
  let lo = ymin, hi = ymax;
  if (lo === null || hi === null) {
    lo = Infinity; hi = -Infinity;
    for (let k = 0; k < defs.length; k++) {
      const a = hist.v[defs[k].i];
      for (let i = 0; i < a.length; i++) {
        if (a[i] < lo) lo = a[i];
        if (a[i] > hi) hi = a[i];
      }
    }
    if (!(hi > lo)) { lo = -1; hi = 1; }
    const pad = (hi - lo) * 0.1;
    lo -= pad; hi += pad;
  }
  pl.begin(title, x0, x1, lo, hi, 't (ns)', ylab || '');
  if (n < 2) return;
  pl.clip();
  for (let k = 0; k < defs.length; k++) pl.line(tn, hist.v[defs[k].i], defs[k].col, 2);
  pl.unclip();
  pl.legend(defs);
}

class SimBase {
  constructor(host, d) {
    this.host = host;
    this.p = Object.assign({}, d);
    this.t = 0;
    this.obs = {};
  }
  setParam(id, v) { this.p[id] = v; this.onParam(id, v); }
  onParam() {}
  action() {}
  hud() { return []; }
  drag() {}
  plotClick() {}
  drawPlots() {}
}

class MacroBase extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.ph = newPhys();
    this.m = [0, 0, 1];
    this.integ = new MacroIntegrator();
    this.trail = [];
    this.view = { yaw: -0.55, pitch: 0.42 };
    this.timeScale = 1.2e-10;
    this.bScale = 0.1;
    this.histMax = 520;
    this.fieldFn = (t, o) => this.fieldAt(t, o);
  }
  dtMax() { return Math.min(3e-12, 0.08 / (GAMMA * Math.max(this.bScale, 1e-3))); }
  tsNow() { return this.timeScale; }
  drag(dx, dy) {
    this.view.yaw -= dx * 0.008;
    this.view.pitch = clamp(this.view.pitch + dy * 0.008, -1.4, 1.4);
  }
  update(dtReal, speed) {
    const tf = this.tsNow() * speed * dtReal;
    const dm = this.dtMax();
    let n = Math.ceil(tf / dm);
    if (n < 1) n = 1;
    if (n > 5000) n = 5000;
    const dt = tf / n;
    for (let i = 0; i < n; i++) this.stepOnce(dt);
    this.afterFrame(tf);
  }
  stepOnce(dt) {
    this.preStep(dt);
    this.integ.step(this.m, this.t, dt, this.ph, this.fieldFn);
    this.t += dt;
    this.postStep(dt);
  }
  preStep() {}
  postStep() {}
  afterFrame() {}
  fieldAt(t, o) { o[0] = 0; o[1] = 0; o[2] = 0; }
  vectors() { return []; }
  pushTrail() {
    this.trail.push([this.m[0], this.m[1], this.m[2]]);
    if (this.trail.length > 260) this.trail.shift();
  }
  draw(ctx, W, H) {
    drawSphere(ctx, W, H, this.view, { m: this.m, trail: this.trail, vecs: this.vectors() });
  }
}

// ===== modes/macro.js =====
class CompassSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.2e-10;
    this.sign = 1;
    this.hist = newHist(4);
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p, th = p.thB * DEG;
    this.ph.alpha = p.alpha;
    this.dir = [Math.sin(th), 0, Math.cos(th)];
    this.perp = [Math.cos(th), 0, -Math.sin(th)];
    this.bScale = Math.max(2e-3, p.B * 1e-3);
  }
  onParam(id) {
    this.applyParams();
    if (id === 'th0') this.reset();
  }
  fieldAt(t, o) {
    const b = this.sign * this.p.B * 1e-3;
    o[0] = b * this.dir[0]; o[1] = b * this.dir[1]; o[2] = b * this.dir[2];
  }
  angleNow() {
    const m = this.m, d = this.dir;
    return Math.acos(clamp(this.sign * (m[0] * d[0] + m[1] * d[1] + m[2] * d[2]), -1, 1)) / DEG;
  }
  reset() {
    const a = this.p.th0 * DEG, d = this.dir, e = this.perp;
    this.sign = 1;
    this.m = [Math.cos(a) * d[0] + Math.sin(a) * e[0], 0, Math.cos(a) * d[2] + Math.sin(a) * e[2]];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(4);
    this.epT0 = 0;
    this.startAngle = this.p.th0;
    this.alignedDur = null;
    this.angle = this.p.th0;
    this.afterFrame();
  }
  action(id) {
    if (id === 'reset') { this.reset(); return; }
    if (id === 'kick') {
      const m = this.m;
      m[0] += 1.4 * (Math.random() - 0.5);
      m[1] += 1.4 * (Math.random() - 0.5);
      m[2] += 1.4 * (Math.random() - 0.5);
      const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
      m[0] *= n; m[1] *= n; m[2] *= n;
    } else if (id === 'flip') {
      this.sign = -this.sign;
    }
    this.epT0 = this.t;
    this.alignedDur = null;
    this.startAngle = this.angleNow();
  }
  afterFrame() {
    const m = this.m;
    this.angle = this.angleNow();
    if (this.alignedDur === null && this.startAngle > 60 && this.angle < 5) this.alignedDur = this.t - this.epT0;
    pushHist(this.hist, this.t, [m[0], m[1], m[2], this.angle], this.histMax);
    this.pushTrail();
    this.obs = {
      f: GHZ_PER_T * this.p.B * 1e-3,
      angle: this.angle,
      alignedDur: this.alignedDur,
      sinceEvent: this.t - this.epT0
    };
  }
  vectors() {
    const s = this.sign, d = this.dir, L = 0.4 + 0.8 * this.p.B / 400;
    return [{ v: [s * d[0] * L, s * d[1] * L, s * d[2] * L], col: PAL.gold, label: 'B' }];
  }
  sonify() {
    return { f: 120 + 45 * this.obs.f, a: Math.sin(clamp(this.angle, 0, 180) * DEG) };
  }
  hud() {
    return [
      ['Fréquence de Larmor', this.obs.f.toFixed(2) + ' GHz', 'hot'],
      ['Angle entre m et B', this.angle.toFixed(0) + '°'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: PAL.x, label: 'mx' },
      { i: 1, col: PAL.y, label: 'my' },
      { i: 2, col: PAL.z, label: 'mz' }
    ], 'Composantes de l’aimantation', -1.1, 1.1, 'm');
    drawSeries(p2, this.hist, [{ i: 3, col: PAL.gold, label: 'angle m–B' }], 'Angle entre m et B (°)', 0, 180, '°');
  }
}

class HysteresisSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 2.0e-9;
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p, ps = p.psi * DEG;
    this.ph.alpha = p.alpha;
    this.ph.BK = p.BK * 1e-3;
    this.ph.ux = 0; this.ph.uy = 0; this.ph.uz = 1;
    this.h = [Math.sin(ps), 0, Math.cos(ps)];
    this.bScale = (p.Bmax + p.BK) * 1e-3;
    this.th = Math.pow(Math.pow(Math.cos(ps), 2 / 3) + Math.pow(Math.sin(ps), 2 / 3), -1.5) * p.BK;
  }
  onParam(id, v) {
    this.applyParams();
    if (id === 'BK' || id === 'psi' || id === 'alpha') { this.reset(); return; }
    if (id === 'Bmax') this.Bm = clamp(this.Bm, -v, v);
    if (id === 'B') {
      if (this.p.auto) {
        this.p.auto = false;
        this.host.setParamUI('auto', false);
      }
      if (v !== this.Bm) this.mdir = v < this.Bm ? -1 : 1;
      this.Bm = v;
    }
    if (id === 'auto' && v) {
      this.Bm = clamp(this.Bm, -this.p.Bmax, this.p.Bmax);
      this.dir = this.Bm > 0 ? -1 : 1;
    }
  }
  reset() {
    this.Bm = this.p.Bmax;
    this.dir = -1;
    this.mdir = -1;
    this.m = [0, 0, 1];
    this.t = 0;
    this.trail = [];
    this.loop = { B: [], M: [], br: [] };
    this.swField = null;
    this.prevS = 1;
    this.host.setParamUI('B', this.Bm);
    this.afterFrame();
  }
  preStep(dt) {
    const p = this.p;
    if (p.auto) {
      this.Bm += this.dir * p.rate * dt * 1e9;
      if (this.Bm <= -p.Bmax) { this.Bm = -p.Bmax; this.dir = 1; }
      else if (this.Bm >= p.Bmax) { this.Bm = p.Bmax; this.dir = -1; }
    }
  }
  postStep() {
    const s = this.m[2] > 0 ? 1 : -1;
    if (s !== this.prevS) { this.swField = this.Bm; this.prevS = s; }
  }
  fieldAt(t, o) {
    const b = this.Bm * 1e-3;
    o[0] = b * this.h[0]; o[1] = 0; o[2] = b * this.h[2];
  }
  afterFrame() {
    const m = this.m, h = this.h;
    const M = m[0] * h[0] + m[1] * h[1] + m[2] * h[2];
    const lp = this.loop;
    lp.B.push(this.Bm); lp.M.push(M); lp.br.push(this.p.auto ? this.dir : this.mdir);
    if (lp.B.length > 3000) { lp.B.splice(0, 600); lp.M.splice(0, 600); lp.br.splice(0, 600); }
    this.pushTrail();
    if (this.p.auto) this.host.setParamUI('B', this.Bm);
    this.M = M;
    this.obs = {
      sw: this.swField,
      swAbs: this.swField === null ? null : Math.abs(this.swField),
      th: this.th
    };
  }
  vectors() {
    const p = this.p, s = this.Bm >= 0 ? 1 : -1, L = 0.35 + 0.8 * Math.min(1, Math.abs(this.Bm) / Math.max(p.Bmax, 1));
    return [
      { v: [s * this.h[0] * L, 0, s * this.h[2] * L], col: PAL.gold, label: 'B' },
      { v: [0, 0, 1.2], col: PAL.blue, label: 'axe facile', axis: true }
    ];
  }
  hud() {
    const o = this.obs;
    return [
      ['Champ B', this.Bm.toFixed(0) + ' mT', 'hot'],
      ['Aimantation M∥', this.M.toFixed(2)],
      ['Retournement mesuré', o.sw === null ? '—' : o.sw.toFixed(0) + ' mT'],
      ['Théorie Stoner-Wohlfarth', '±' + this.th.toFixed(0) + ' mT']
    ];
  }
  drawPlots(p1, p2) {
    const p = this.p, Bm = p.Bmax * 1.08, lp = this.loop;
    p1.begin('Cycle d’hystérésis  M∥(B)', -Bm, Bm, -1.15, 1.15, 'B (mT)', 'M∥ = m·h');
    p1.clip();
    p1.vline(this.th, 'rgba(201,138,0,0.55)', true);
    p1.vline(-this.th, 'rgba(201,138,0,0.55)', true);
    const ctx = p1.ctx;
    ctx.lineWidth = 2.2;
    for (let pass = 0; pass < 3; pass++) {
      const col = pass === 0 ? PAL.red : (pass === 1 ? PAL.blue : PAL.ink3);
      const want = pass === 0 ? -1 : (pass === 1 ? 1 : 0);
      ctx.strokeStyle = col;
      ctx.beginPath();
      let pen = false;
      for (let i = 1; i < lp.B.length; i++) {
        if (lp.br[i] !== want || Math.abs(lp.B[i] - lp.B[i - 1]) > 0.5 * p.Bmax) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p1.X(lp.B[i - 1]), p1.Y(lp.M[i - 1])); pen = true; }
        ctx.lineTo(p1.X(lp.B[i]), p1.Y(lp.M[i]));
      }
      ctx.stroke();
    }
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(p1.X(this.Bm), p1.Y(this.M), 5, 0, TAU); ctx.fill();
    p1.unclip();

    const ps = p.psi * DEG, bk = p.BK;
    p2.begin('Astroïde : zone où deux états coexistent', -1.25, 1.25, -1.25, 1.25, 'B⊥ / B_K', 'B∥ / B_K');
    const c2 = p2.ctx;
    c2.beginPath();
    for (let i = 0; i <= 120; i++) {
      const s = TAU * i / 120, cs = Math.cos(s), sn = Math.sin(s);
      const hx = Math.sign(sn) * Math.pow(Math.abs(sn), 3), hz = Math.sign(cs) * Math.pow(Math.abs(cs), 3);
      if (i === 0) c2.moveTo(p2.X(hx), p2.Y(hz)); else c2.lineTo(p2.X(hx), p2.Y(hz));
    }
    c2.closePath();
    c2.fillStyle = 'rgba(31,78,156,0.12)';
    c2.fill();
    c2.strokeStyle = PAL.blue;
    c2.lineWidth = 2;
    c2.stroke();
    p2.clip();
    c2.strokeStyle = 'rgba(201,138,0,0.55)';
    c2.setLineDash([5, 4]);
    c2.lineWidth = 1.5;
    c2.beginPath();
    c2.moveTo(p2.X(-p.Bmax * Math.sin(ps) / bk), p2.Y(-p.Bmax * Math.cos(ps) / bk));
    c2.lineTo(p2.X(p.Bmax * Math.sin(ps) / bk), p2.Y(p.Bmax * Math.cos(ps) / bk));
    c2.stroke();
    c2.setLineDash([]);
    c2.fillStyle = PAL.gold;
    c2.beginPath(); c2.arc(p2.X(this.Bm * Math.sin(ps) / bk), p2.Y(this.Bm * Math.cos(ps) / bk), 6, 0, TAU); c2.fill();
    p2.unclip();
  }
  action(id) {
    if (id === 'reset') this.reset();
    else if (id === 'up' || id === 'down') {
      const v = clamp(Math.round(this.Bm) + (id === 'up' ? 5 : -5), -400, 400);
      this.setParam('B', v);
      this.host.setParamUI('B', v);
    }
  }
}

class FmrSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.5e-10;
    this.phase = 0;
    this.omega = TAU * this.p.f * 1e9;
    this.spec = null;
    this.specDirty = true;
    this.specStamp = 0;
    this.specPeak = null;
    this.hist = newHist(2);
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p;
    this.BP = { py: 1.0, cofeb: 1.6, yig: 0.175 }[p.mat] || 1.0;
    this.ph.alpha = p.alpha;
    this.ph.BP = this.BP;
    this.ph.BK = 0;
    this.ph.a = 0;
    this.omega = TAU * p.f * 1e9;
    this.bScale = (p.B0 + p.bac) * 1e-3 + this.BP;
    this.fres = GHZ_PER_T * Math.sqrt(p.B0 * 1e-3 * (p.B0 * 1e-3 + this.BP));
  }
  onParam(id) {
    this.applyParams();
    if (id === 'B0' || id === 'mat' || id === 'alpha') {
      this.specDirty = true;
      this.specStamp = performance.now();
    }
  }
  fieldAt(t, o) {
    o[0] = this.p.B0 * 1e-3;
    o[1] = this.p.bac * 1e-3 * Math.sin(this.phase + this.omega * (t - this.t));
    o[2] = 0;
  }
  postStep(dt) {
    this.phase += this.omega * dt;
    if (this.phase > 1e4) this.phase = this.phase % TAU;
  }
  reset() {
    const n = 1 / Math.sqrt(1 + 0.02 * 0.02);
    this.m = [n, 0.02 * n, 0];
    this.t = 0;
    this.phase = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.ampHold = 0;
    this.specDirty = true;
    this.specStamp = 0;
    this.afterFrame(0);
  }
  action(id) {
    if (id === 'kick') {
      const m = this.m;
      m[1] += 0.35; m[2] += 0.25;
      const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
      m[0] *= n; m[1] *= n; m[2] *= n;
    } else if (id === 'tune') {
      const f = clamp(this.fres, 1, 40);
      this.host.setParamUI('f', f);
      this.setParam('f', f);
    }
  }
  computeSpec() {
    const p = this.p, ph = newPhys();
    ph.alpha = p.alpha; ph.BP = this.BP;
    const B0 = p.B0 * 1e-3;
    const m0 = [1, 0.05, 0], n = 1 / Math.sqrt(1.0025);
    m0[0] *= n; m0[1] *= n;
    const N = 512, Ts = 1e-11;
    const r = macroSeries(ph, m0, function (t, o) { o[0] = B0; o[1] = 0; o[2] = 0; }, B0 + this.BP, Ts, N);
    this.spec = spectrumOf(r.sy, Ts);
    let kb = 1, vb = 0;
    const mg = this.spec.mags;
    for (let k = 1; k < mg.length - 1; k++) if (mg[k] > vb) { vb = mg[k]; kb = k; }
    let d = 0;
    const a = mg[kb - 1], b = mg[kb], c = mg[kb + 1];
    if (a - 2 * b + c !== 0) d = clamp(0.5 * (a - c) / (a - 2 * b + c), -1, 1);
    this.specPeak = (kb + d) * this.spec.df / 1e9;
    this.specMax = vb;
    this.specDirty = false;
  }
  update(dtReal, speed) {
    if (this.specDirty && performance.now() - this.specStamp > 150) this.computeSpec();
    super.update(dtReal, speed);
  }
  afterFrame(tf) {
    const m = this.m, cur = Math.sqrt(m[1] * m[1] + m[2] * m[2]);
    const tau = Math.max(2e-10, 3 / (this.p.f * 1e9));
    this.ampHold = Math.max(cur, (this.ampHold || 0) * Math.exp(-(tf || 0) / tau));
    pushHist(this.hist, this.t, [m[1], m[2]], this.histMax);
    this.pushTrail();
    this.obs = {
      amp: this.ampHold,
      f: this.p.f,
      fres: this.fres,
      B0: this.p.B0
    };
  }
  sonify() {
    return { f: 120 + 45 * this.p.f, a: clamp(this.ampHold * 2.5, 0, 1) };
  }
  vectors() {
    return [
      { v: [0.9, 0, 0], col: PAL.gold, label: 'B' },
      { v: [0, 0.55 * Math.sin(this.phase), 0], col: PAL.teal, label: 'b(t)' }
    ];
  }
  hud() {
    const o = this.obs, amp = Math.asin(Math.min(1, o.amp)) / DEG;
    const near = Math.abs(o.f - o.fres) < 0.06 * Math.max(o.fres, 1);
    return [
      ['Fréquence de résonance (Kittel)', o.fres.toFixed(2) + ' GHz', 'hot'],
      ['Fréquence de pilotage', o.f.toFixed(1) + ' GHz'],
      ['Amplitude du cône', amp.toFixed(1) + '°', near ? 'good' : ''],
      ['Pic du spectre libre', this.specPeak === null ? '—' : this.specPeak.toFixed(2) + ' GHz']
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: PAL.y, label: 'my' },
      { i: 1, col: PAL.z, label: 'mz' }
    ], 'Oscillations de l’aimantation', null, null, 'm');
    const xmax = Math.max(20, Math.min(50, this.fres * 1.6 + 5));
    p2.begin('Spectre libre : la « note » de l’aimant', 0, xmax, 0, 1.12, 'fréquence (GHz)', 'amplitude');
    if (this.spec) {
      const mg = this.spec.mags, df = this.spec.df / 1e9, xs = [], ys = [];
      for (let k = 0; k < mg.length; k++) {
        if (k * df > xmax) break;
        xs.push(k * df); ys.push(mg[k] / (this.specMax || 1));
      }
      p2.clip();
      p2.line(xs, ys, PAL.blue, 2);
      p2.vline(this.fres, PAL.gold, true, 'Kittel');
      p2.vline(this.p.f, PAL.red, false, 'pilotage');
      p2.unclip();
    }
  }
}

class PulseSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 6e-11;
    this.hist = newHist(2);
    this.phase = 'ready';
    this.result = null;
    this.dur = 0;
    this.map = null;
    this.mapJob = null;
    this.mapStamp = performance.now();
    this.mapDirty = true;
    this.mph = newPhys();
    this.mint = new MacroIntegrator();
    this.NX = 40;
    this.NY = 40;
    this.BPMAX = 500;
    this.TAUMAX = 400;
    this.applyParams();
    const tau = this.findTau();
    if (tau !== null) {
      this.p.tau = tau;
      this.host.setParamUI('tau', tau);
    }
    this.fire();
  }
  applyParams() {
    const p = this.p;
    this.ph.alpha = p.alpha;
    this.ph.BK = p.BK * 1e-3;
    this.ph.ux = 0; this.ph.uy = 0; this.ph.uz = 1;
    this.bScale = (p.BK + p.Bp) * 1e-3;
  }
  onParam(id) {
    this.applyParams();
    if (id === 'BK' || id === 'alpha') {
      this.map = null;
      this.mapJob = null;
      this.mapDirty = true;
      this.mapStamp = performance.now();
    }
  }
  tsNow() {
    if (this.phase === 'pulse') return 6e-11;
    return this.result === null ? 3e-10 : 1.2e-9;
  }
  fieldAt(t, o) {
    o[0] = this.phase === 'pulse' ? this.p.Bp * 1e-3 : 0;
    o[1] = 0; o[2] = 0;
  }
  fire() {
    this.m = [0, 0, 1];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.phase = 'pulse';
    this.dur = this.p.tau * 1e-12;
    this.result = null;
    this.firedBp = this.p.Bp;
    this.firedTau = this.p.tau;
    this.afterFrame();
  }
  simFlip(Bp, tau, BK, alpha) {
    const ph = this.mph, integ = this.mint;
    ph.alpha = alpha; ph.BK = BK; ph.ux = 0; ph.uy = 0; ph.uz = 1; ph.a = 0; ph.BP = 0;
    const m = [0, 0, 1];
    const f1 = function (t, o) { o[0] = Bp; o[1] = 0; o[2] = 0; };
    const f0 = function (t, o) { o[0] = 0; o[1] = 0; o[2] = 0; };
    const dtb = Math.min(3e-12, 0.1 / (GAMMA * (BK + Bp + 1e-3)));
    const n = Math.max(1, Math.ceil(tau / dtb)), dt = tau / n;
    let t = 0;
    for (let i = 0; i < n; i++) { integ.step(m, t, dt, ph, f1); t += dt; }
    const nmax = Math.ceil(6e-9 / dtb);
    for (let i = 0; i < nmax; i++) {
      if (Math.abs(m[2]) > 0.2) break;
      integ.step(m, t, dtb, ph, f0);
      t += dtb;
    }
    return m[2] < 0;
  }
  findTau() {
    const BK = this.p.BK * 1e-3, Bp = this.p.Bp * 1e-3, al = this.p.alpha;
    const res = [];
    for (let tau = 8; tau <= 400; tau += 4) res.push(this.simFlip(Bp, tau * 1e-12, BK, al));
    let i = 0;
    while (i < res.length) {
      if (!res[i]) { i++; continue; }
      let j = i;
      while (j + 1 < res.length && res[j + 1]) j++;
      if (j - i >= 1) return 8 + 4 * Math.round((i + j) / 2);
      i = j + 1;
    }
    return null;
  }
  stepMap(budget) {
    const job = this.mapJob;
    if (!job) return;
    const t0 = performance.now(), total = this.NX * this.NY;
    while (job.i < total && performance.now() - t0 < budget) {
      const jx = job.i % this.NX, jy = Math.floor(job.i / this.NX);
      const Bp = (jx + 0.5) / this.NX * this.BPMAX * 1e-3;
      const tau = (jy + 0.5) / this.NY * this.TAUMAX * 1e-12;
      job.data[job.i] = this.simFlip(Bp, tau, job.BK, job.alpha) ? 1 : 0;
      job.i++;
    }
    if (job.i >= total) { this.map = job; this.mapJob = null; }
  }
  update(dtReal, speed) {
    const now = performance.now();
    if (this.mapDirty && !this.mapJob && now - this.mapStamp > 400) {
      this.mapJob = { i: 0, data: new Uint8Array(this.NX * this.NY), BK: this.p.BK * 1e-3, alpha: this.p.alpha };
      this.mapDirty = false;
    }
    if (this.mapJob) this.stepMap(8);
    const tf = this.tsNow() * speed * dtReal, dm = this.dtMax();
    let rem = tf, guard = 0;
    while (rem > 1e-18 && guard++ < 20000) {
      if (this.phase === 'pulse' && this.t >= this.dur - 1e-18) this.phase = 'free';
      let dt = Math.min(dm, rem);
      if (this.phase === 'pulse' && this.t + dt > this.dur) dt = Math.max(this.dur - this.t, 1e-16);
      this.integ.step(this.m, this.t, dt, this.ph, this.fieldFn);
      this.t += dt;
      rem -= dt;
      if (this.phase === 'pulse' && this.t >= this.dur - 1e-18) this.phase = 'free';
      if (this.phase === 'free' && this.result === null) {
        if (Math.abs(this.m[2]) > 0.2 || this.t > this.dur + 8e-9) {
          this.result = this.m[2] < 0 ? 'flip' : 'noflip';
          if (this.result === 'flip') this.host.sfx('flip');
          this.host.toast(this.result === 'flip' ? '↻ Retourné ! L’aimant est passé de ↑ à ↓' : '✗ Raté : l’aimant est retombé du même côté');
        }
      }
    }
    this.afterFrame(tf);
  }
  afterFrame() {
    pushHist(this.hist, this.t, [this.m[2], this.m[0]], 4000);
    this.pushTrail();
    this.obs = {
      flipped: this.result === 'flip',
      decided: this.result !== null,
      Bp: this.firedBp,
      tau: this.firedTau
    };
  }
  action(id) {
    if (id === 'fire') this.fire();
    else if (id === 'cal') {
      const tau = this.findTau();
      if (tau === null) { this.host.toast('Aucune durée ne marche : augmente B_p (au moins B_K / 2)'); return; }
      this.p.tau = tau;
      this.host.setParamUI('tau', tau);
      this.fire();
    } else if (id === 'long') {
      const tau = this.findTau();
      if (tau === null) { this.host.toast('Aucune durée ne marche : augmente B_p'); return; }
      this.p.tau = Math.min(400, 2 * tau);
      this.host.setParamUI('tau', this.p.tau);
      this.fire();
    }
  }
  plotClick(which, px, py, pl) {
    if (which !== 2) return;
    const bp = pl.invX(px), tau = pl.invY(py);
    if (bp < 0 || bp > this.BPMAX || tau < 0 || tau > this.TAUMAX) return;
    this.p.Bp = Math.max(0, Math.round(bp));
    this.p.tau = Math.max(10, Math.round(tau));
    this.host.setParamUI('Bp', this.p.Bp);
    this.host.setParamUI('tau', this.p.tau);
    this.applyParams();
    this.fire();
  }
  vectors() {
    const out = [{ v: [0, 0, 1.2], col: PAL.blue, label: 'axe facile', axis: true }];
    if (this.phase === 'pulse') out.push({ v: [0.4 + 0.8 * this.p.Bp / 500, 0, 0], col: PAL.gold, label: 'B_p' });
    return out;
  }
  hud() {
    let st = 'impulsion en cours…', cl = 'hot';
    if (this.phase === 'free' && this.result === null) st = 'relaxation…';
    if (this.result === 'flip') { st = 'RETOURNÉ ✓'; cl = 'good'; }
    if (this.result === 'noflip') { st = 'raté ✗'; cl = 'bad'; }
    return [
      ['Résultat', st, cl],
      ['Seuil théorique B_p', '> ' + (this.p.BK / 2).toFixed(0) + ' mT'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  drawPlots(p1, p2) {
    const tn = this.hist.t.map(function (v) { return v * 1e9; });
    const x1 = Math.max(1.5, tn.length ? tn[tn.length - 1] : 1.5, this.dur * 1e9 * 1.2);
    p1.begin('Aimantation pendant et après l’impulsion', 0, x1, -1.1, 1.1, 't (ns)', 'm');
    p1.ctx.fillStyle = 'rgba(201,138,0,0.16)';
    p1.ctx.fillRect(p1.X(0), p1.box.t, p1.X(this.dur * 1e9) - p1.X(0), p1.ph);
    p1.clip();
    p1.line(tn, this.hist.v[0], PAL.blue, 2.2);
    p1.line(tn, this.hist.v[1], PAL.red, 1.6);
    p1.unclip();
    p1.legend([{ col: PAL.blue, label: 'mz' }, { col: PAL.red, label: 'mx' }, { col: PAL.gold, label: 'impulsion' }]);

    p2.begin('Carte de retournement (clique dessus !)', 0, this.BPMAX, 0, this.TAUMAX, 'amplitude B_p (mT)', 'durée (ps)');
    const job = this.map || this.mapJob;
    if (job) {
      const ctx = p2.ctx, cw = p2.pw / this.NX, ch = p2.ph / this.NY, total = this.NX * this.NY;
      const upto = this.map ? total : job.i;
      for (let i = 0; i < upto; i++) {
        const jx = i % this.NX, jy = Math.floor(i / this.NX);
        ctx.fillStyle = job.data[i] ? 'rgba(215,48,31,0.85)' : 'rgba(23,20,15,0.06)';
        ctx.fillRect(p2.box.l + jx * cw, p2.box.t + p2.ph - (jy + 1) * ch, cw + 0.6, ch + 0.6);
      }
    } else {
      p2.text('calcul de la carte…', p2.box.l + 10, p2.box.t + 20, PAL.ink3);
    }
    const ctx2 = p2.ctx;
    ctx2.strokeStyle = PAL.ink;
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(p2.X(this.p.Bp), p2.Y(this.p.tau), 6, 0, TAU);
    ctx2.stroke();
    p2.vline(this.p.BK / 2, 'rgba(201,138,0,0.8)', true, 'B_K/2');
  }
}

class SttSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.5e-9;
    this.hist = newHist(2);
    this.scatter = { a: [], m: [] };
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p;
    this.ph.alpha = p.alpha;
    this.ph.BK = p.BK * 1e-3;
    this.ph.ux = 0; this.ph.uy = 0; this.ph.uz = 1;
    this.ph.px = 0; this.ph.py = 0; this.ph.pz = 1;
    this.acUp = p.alpha * (p.BK + p.Bz);
    this.acDn = p.alpha * (p.BK - p.Bz);
    this.bScale = (p.BK + Math.abs(p.Bz) + 45) * 1e-3;
  }
  onParam() { this.applyParams(); }
  aEff() { return this.auto ? this.auto.val : this.p.aJ; }
  preStep() { this.ph.a = this.aEff() * 1e-3; }
  fieldAt(t, o) { o[0] = 0; o[1] = 0; o[2] = this.p.Bz * 1e-3; }
  reset() {
    const n = 1 / Math.sqrt(1 + 0.06 * 0.06 + 0.02 * 0.02);
    this.m = [0.06 * n, 0.02 * n, n];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.scatter = { a: [], m: [] };
    this.auto = null;
    this.swAmp = null;
    this.prevS = 1;
    this.sawDown = false;
    this.cycle = false;
    this.afterFrame();
  }
  postStep() {
    const s = this.m[2] > 0 ? 1 : -1;
    if (s !== this.prevS) { this.swAmp = this.aEff(); this.prevS = s; this.host.sfx('flip'); }
    const a = this.auto;
    if (a && (a.target * this.m[2] > 0.95 || this.t > a.t0 + 12e-9)) this.auto = null;
  }
  action(id) {
    if (id === 'reset') { this.reset(); return; }
    if (id === 'writeDown') this.auto = { val: 1.6 * Math.max(this.acUp, 0.5), target: -1, t0: this.t };
    if (id === 'writeUp') {
      if (this.acDn <= 0) { this.host.toast('Le champ de biais est trop fort : l’état ↓ n’est pas stable'); return; }
      this.auto = { val: -1.6 * Math.max(this.acDn, 0.5), target: 1, t0: this.t };
    }
  }
  afterFrame() {
    const mz = this.m[2], a = this.aEff();
    if (mz < -0.9) this.sawDown = true;
    if (this.sawDown && mz > 0.9) this.cycle = true;
    pushHist(this.hist, this.t, [mz, a / 40], this.histMax);
    this.scatter.a.push(a); this.scatter.m.push(mz);
    if (this.scatter.a.length > 1600) { this.scatter.a.splice(0, 300); this.scatter.m.splice(0, 300); }
    this.pushTrail();
    this.obs = { mz: mz, swAmp: this.swAmp, cycle: this.cycle };
  }
  vectors() {
    const out = [
      { v: [0, 0, 1.2], col: PAL.blue, label: '', axis: true },
      { v: [0, 0, 0.62], col: PAL.plum, label: 'p' }
    ];
    if (Math.abs(this.p.Bz) > 0.1) out.push({ v: [0, 0, Math.sign(this.p.Bz) * (0.35 + Math.abs(this.p.Bz) / 80)], col: PAL.gold, label: 'B' });
    return out;
  }
  draw(ctx, W, H) {
    super.draw(ctx, W, H);
    const up = this.m[2] > 0, x = W - 86, y = 16;
    ctx.fillStyle = up ? 'rgba(215,48,31,0.12)' : 'rgba(31,78,156,0.12)';
    ctx.strokeStyle = up ? PAL.red : PAL.blue;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, 70, 78, 14) : ctx.rect(x, y, 70, 78);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = up ? PAL.red : PAL.blue;
    ctx.font = '700 40px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(up ? '↑' : '↓', x + 35, y + 42);
    ctx.font = '600 12px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.fillText('bit = ' + (up ? '1' : '0'), x + 35, y + 64);
  }
  hud() {
    const a = this.aEff();
    return [
      ['Torque de spin a_J', a.toFixed(1) + ' mT', Math.abs(a) > 0.01 ? 'hot' : ''],
      ['Seuil ↑→↓', '≈ ' + this.acUp.toFixed(1) + ' mT'],
      ['Seuil ↓→↑', this.acDn > 0 ? '≈ −' + this.acDn.toFixed(1) + ' mT' : 'état ↓ instable'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: PAL.blue, label: 'mz' },
      { i: 1, col: PAL.gold, label: 'courant' }
    ], 'Aimantation et courant au cours du temps', -1.2, 1.2, '');
    const lim = 40;
    p2.begin('Trace  mz  en fonction du courant', -lim, lim, -1.15, 1.15, 'torque de spin a_J (mT)', 'mz');
    p2.clip();
    p2.vline(this.acUp, 'rgba(201,138,0,0.6)', true);
    if (this.acDn > 0) p2.vline(-this.acDn, 'rgba(201,138,0,0.6)', true);
    const ctx = p2.ctx, sa = this.scatter.a, sm = this.scatter.m;
    for (let i = 0; i < sa.length; i++) {
      ctx.fillStyle = 'rgba(215,48,31,' + (0.25 + 0.6 * i / sa.length).toFixed(2) + ')';
      ctx.fillRect(p2.X(sa[i]) - 1.5, p2.Y(sm[i]) - 1.5, 3, 3);
    }
    p2.unclip();
  }
}

class StoSim extends MacroBase {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1.5e-10;
    this.hist = newHist(2);
    this.orbit = [];
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p;
    this.ph.alpha = p.alpha;
    this.ph.BP = p.mu0Ms;
    this.ph.BK = 0;
    this.ph.a = p.aJ * 1e-3;
    this.ph.px = 1; this.ph.py = 0; this.ph.pz = 0;
    this.bScale = (p.B + p.aJ) * 1e-3 + p.mu0Ms;
    const B = p.B * 1e-3;
    this.f0 = GHZ_PER_T * Math.sqrt(B * (B + p.mu0Ms));
    this.ac = p.alpha * (p.B + p.mu0Ms * 500);
  }
  onParam() {
    this.applyParams();
    this.cross = [];
  }
  fieldAt(t, o) { o[0] = this.p.B * 1e-3; o[1] = 0; o[2] = 0; }
  reset() {
    const n = 1 / Math.sqrt(1 + 0.12 * 0.12 + 0.05 * 0.05);
    this.m = [n, 0.12 * n, 0.05 * n];
    this.t = 0;
    this.trail = [];
    this.hist = newHist(2);
    this.orbit = [];
    this.cross = [];
    this.prevY = this.m[1];
    this.ampHold = 0;
    this.afterFrame(0);
  }
  postStep(dt) {
    const y = this.m[1];
    if (this.prevY < 0 && y >= 0) {
      this.cross.push(this.t - dt * y / (y - this.prevY));
      if (this.cross.length > 9) this.cross.shift();
    }
    this.prevY = y;
  }
  action(id) {
    if (id === 'kick') {
      const m = this.m;
      m[1] += 0.4; m[2] += 0.3;
      const n = 1 / Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
      m[0] *= n; m[1] *= n; m[2] *= n;
    } else if (id === 'reset') this.reset();
  }
  afterFrame(tf) {
    const m = this.m, cur = Math.sqrt(m[1] * m[1] + m[2] * m[2]);
    this.ampHold = Math.max(cur, (this.ampHold || 0) * Math.exp(-(tf || 0) / 5e-10));
    pushHist(this.hist, this.t, [m[1], m[2]], this.histMax);
    this.orbit.push([m[1], m[2]]);
    if (this.orbit.length > 700) this.orbit.shift();
    this.pushTrail();
    let f = null;
    const c = this.cross;
    if (c.length >= 3) {
      const per = (c[c.length - 1] - c[0]) / (c.length - 1);
      if (this.t - c[c.length - 1] < 3 * per) f = 1 / per / 1e9;
    }
    this.fMeas = f;
    this.obs = { amp: this.ampHold, f: f, ac: this.ac };
  }
  sonify() {
    return { f: 120 + 45 * (this.fMeas || this.f0), a: clamp(this.ampHold * 1.8, 0, 1) };
  }
  vectors() {
    return [
      { v: [1.25, 0, 0], col: PAL.gold, label: 'B' },
      { v: [0.62, 0, 0], col: PAL.plum, label: 'p' }
    ];
  }
  hud() {
    const o = this.obs, amp = Math.asin(Math.min(1, o.amp)) / DEG;
    const on = o.amp > 0.15 && this.p.aJ > this.ac;
    return [
      ['Seuil a_c = α(B + μ₀Ms/2)', this.ac.toFixed(1) + ' mT', 'hot'],
      ['Courant a_J', this.p.aJ.toFixed(1) + ' mT'],
      ['Fréquence mesurée', o.f === null ? '—' : o.f.toFixed(2) + ' GHz', on ? 'good' : ''],
      ['Amplitude', amp.toFixed(0) + '°', on ? 'good' : '']
    ];
  }
  drawPlots(p1, p2) {
    drawSeries(p1, this.hist, [
      { i: 0, col: PAL.y, label: 'my' },
      { i: 1, col: PAL.z, label: 'mz' }
    ], 'Signal micro-onde produit', null, null, 'm');
    let lim = 0.2;
    for (let i = 0; i < this.orbit.length; i++) lim = Math.max(lim, Math.abs(this.orbit[i][0]), Math.abs(this.orbit[i][1]));
    lim *= 1.2;
    p2.begin('Portrait de phase (my, mz) : cycle limite', -lim, lim, -lim, lim, 'my', 'mz');
    p2.clip();
    const ctx = p2.ctx, o = this.orbit;
    ctx.lineWidth = 2;
    for (let i = 1; i < o.length; i++) {
      ctx.strokeStyle = 'hsla(' + (10 + 210 * i / o.length).toFixed(0) + ',70%,42%,' + (0.15 + 0.85 * i / o.length).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(p2.X(o[i - 1][0]), p2.Y(o[i - 1][1]));
      ctx.lineTo(p2.X(o[i][0]), p2.Y(o[i][1]));
      ctx.stroke();
    }
    if (o.length) {
      ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(p2.X(o[o.length - 1][0]), p2.Y(o[o.length - 1][1]), 5, 0, TAU); ctx.fill();
    }
    p2.unclip();
  }
}

// ===== modes/film.js =====
class FilmSimBase extends SimBase {
  update(dtReal, speed) {
    const c = this.core, dt = c.dt, target = this.timeScale * speed * dtReal;
    const t0 = performance.now();
    let adv = 0, k = 0;
    this.beforeFrame();
    while (adv < target) {
      c.step(dt, this.t);
      this.t += dt;
      adv += dt;
      k++;
      if ((k & 3) === 0 && performance.now() - t0 > 11) break;
    }
    this.afterFrame();
  }
  beforeFrame() {}
  afterFrame() {}
}

class WallSim extends FilmSimBase {
  constructor(host, d) {
    super(host, d);
    this.nx = 160;
    this.dx = 3e-9;
    this.timeScale = 2.5e-9;
    this.core = new FilmCore(this.nx, 1, this.dx, { px: false, py: true });
    this.core.Ms = 5.8e5;
    this.hist = { t: [], x: [] };
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const p = this.p, c = this.core;
    c.A = p.A * 1e-12;
    c.D = p.D * 1e-3;
    c.Kc = p.K * 1e3;
    c.Bx = 0; c.By = 0; c.Bz = p.Bz * 1e-3;
    c.alpha.fill(p.alpha);
    c.prepare();
    this.wallW = Math.sqrt(c.A / c.Kc);
    this.Dc = 4 / Math.PI * Math.sqrt(c.A * c.Kc);
  }
  onParam() { this.applyParams(); }
  action(id) { if (id === 'reset') this.reset(); }
  reset() {
    const c = this.core, w = this.wallW, x0 = 0.3 * this.nx * this.dx;
    for (let i = 0; i < this.nx; i++) {
      const u = ((i + 0.5) * this.dx - x0) / w;
      c.mz[i] = -Math.tanh(u);
      c.my[i] = 1 / Math.cosh(u);
      c.mx[i] = 0;
    }
    c.normalizeAll();
    this.t = 0;
    this.hist = { t: [], x: [] };
    this.afterFrame();
  }
  wallPos() {
    const mz = this.core.mz;
    for (let i = 0; i < this.nx - 1; i++) {
      if (mz[i] > 0 && mz[i + 1] <= 0) return (i + 0.5 + mz[i] / (mz[i] - mz[i + 1])) * this.dx;
    }
    return null;
  }
  afterFrame() {
    const c = this.core, h = this.hist, xw = this.wallPos();
    this.xw = xw;
    this.phi = null;
    if (xw !== null) {
      h.t.push(this.t);
      h.x.push(xw);
      if (h.t.length > 900) { h.t.shift(); h.x.shift(); }
      const ic = clamp(Math.round(xw / this.dx - 0.5), 0, this.nx - 1);
      this.phi = Math.atan2(c.my[ic], c.mx[ic]);
    }
    let v = null;
    const n = h.t.length;
    if (n > 2) {
      let k = n - 1;
      while (k > 0 && h.t[n - 1] - h.t[k] < 0.3e-9) k--;
      if (h.t[n - 1] - h.t[k] > 0.05e-9) v = (h.x[n - 1] - h.x[k]) / (h.t[n - 1] - h.t[k]);
    }
    this.v = v;
    let type = '—';
    if (this.phi !== null) {
      const cc = Math.abs(Math.cos(this.phi)), ss = Math.abs(Math.sin(this.phi));
      type = cc > 0.85 ? 'Néel' : (ss > 0.85 ? 'Bloch' : 'intermédiaire');
    }
    this.type = type;
    this.obs = { v: v, type: type, wallW: this.wallW, D: this.p.D };
  }
  hud() {
    const out = [
      ['Position de la paroi', this.xw === null ? 'sortie' : (this.xw * 1e9).toFixed(0) + ' nm'],
      ['Vitesse', this.v === null ? '—' : this.v.toFixed(0) + ' m/s', 'hot'],
      ['Type de paroi', this.type + (this.phi === null ? '' : ' (' + (this.phi / DEG).toFixed(0) + '°)'), this.type === 'Néel' ? 'good' : ''],
      ['Largeur Δ = √(A/K)', (this.wallW * 1e9).toFixed(1) + ' nm'],
      ['D / D_c', (this.p.D * 1e-3 / this.Dc).toFixed(2), this.p.D * 1e-3 > this.Dc ? 'bad' : '']
    ];
    if (this.p.D * 1e-3 > this.Dc) out.push(['Alerte', 'D > D_c : la paroi devient instable', 'bad']);
    if (this.wallW < 1.2 * this.dx) out.push(['Alerte', 'paroi trop fine pour la grille', 'bad']);
    return out;
  }
  draw(ctx, W, H, guided = false) {
    const c = this.core, nx = this.nx, pad = 22, w = W - 2 * pad, cw = w / nx;
    const yR = H * 0.13, hR = H * 0.17;
    for (let i = 0; i < nx; i++) {
      ctx.fillStyle = rgbStr(divRGB(c.mz[i]));
      ctx.fillRect(pad + i * cw, yR, cw + 0.8, hR);
    }
    ctx.strokeStyle = 'rgba(23,20,15,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, yR, w, hR);
    ctx.fillStyle = PAL.ink2;
    ctx.font = '12px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const topView = W < 560 ? 'vue de dessus : rouge ↑, bleu ↓, blanc = paroi' :
      'vue de dessus : rouge = aimantation vers le haut ↑, bleu = vers le bas ↓, blanc = la paroi';
    ctx.fillText(guided ? 'Vue de dessus · les couleurs' : topView, pad, guided ? Math.max(13, yR - 8) : yR - 8);
    const cy = H * 0.66, st = 4, L = cw * st * 0.46;
    ctx.fillStyle = PAL.ink2;
    const sideView = W < 560 ? 'vue de côté : une flèche par groupe de spins' :
      'vue de côté : chaque flèche montre l’aimantation locale (rouge ↑, bleu ↓, sombre = couchée)';
    ctx.fillText(guided ? 'Vue de côté · le sens des petits aimants' : sideView, pad, cy - H * 0.2);
    ctx.lineWidth = 2.2;
    for (let i = 2; i < nx; i += st) {
      const cx = pad + (i + 0.5) * cw, ax = c.mx[i] * L, ay = -c.mz[i] * L;
      const col = rgbStr(arrowRGB(c.mz[i]));
      ctx.strokeStyle = col; ctx.fillStyle = col;
      const len = Math.sqrt(ax * ax + ay * ay);
      if (len < 0.25 * L) {
        ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, TAU); ctx.fill();
        continue;
      }
      const ux = ax / len, uy = ay / len;
      ctx.beginPath(); ctx.moveTo(cx - ax, cy - ay); ctx.lineTo(cx + ax, cy + ay); ctx.stroke();
      const hx = cx + ax, hy = cy + ay, hs = 5;
      ctx.beginPath();
      ctx.moveTo(hx + ux * hs, hy + uy * hs);
      ctx.lineTo(hx - ux * hs + uy * hs * 0.7, hy - uy * hs - ux * hs * 0.7);
      ctx.lineTo(hx - ux * hs - uy * hs * 0.7, hy - uy * hs + ux * hs * 0.7);
      ctx.closePath(); ctx.fill();
    }
    if (this.xw !== null) {
      const X = pad + this.xw / (nx * this.dx) * w, wl = this.wallW / (nx * this.dx) * w;
      ctx.strokeStyle = 'rgba(201,138,0,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(X, yR + hR + 6); ctx.lineTo(X, cy + H * 0.2); ctx.stroke();
      ctx.setLineDash([]);
      const by = cy + H * 0.2;
      ctx.beginPath();
      ctx.moveTo(X - wl, by - 5); ctx.lineTo(X - wl, by + 5);
      ctx.moveTo(X - wl, by); ctx.lineTo(X + wl, by);
      ctx.moveTo(X + wl, by - 5); ctx.lineTo(X + wl, by + 5);
      ctx.stroke();
      ctx.fillStyle = PAL.gold;
      ctx.textAlign = 'center';
      ctx.fillText('Δ = ' + (this.wallW * 1e9).toFixed(1) + ' nm', X, by + 18);
    }
    ctx.fillStyle = PAL.red;
    ctx.textAlign = 'left';
    ctx.font = '600 13px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.fillText('domaine ↑', pad + 6, H - 14);
    ctx.fillStyle = PAL.blue;
    ctx.textAlign = 'right';
    ctx.fillText('domaine ↓', W - pad - 6, H - 14);
    drawScaleBar(ctx, W / 2 - cw * 16.7, H - 18, cw * 33.3, '100 nm');
  }
  drawPlots(p1, p2) {
    const c = this.core, xs = [], a = [], b = [], d = [];
    for (let i = 0; i < this.nx; i++) {
      xs.push((i + 0.5) * this.dx * 1e9);
      a.push(c.mx[i]); b.push(c.my[i]); d.push(c.mz[i]);
    }
    p1.begin('Profil de la paroi', 0, this.nx * this.dx * 1e9, -1.1, 1.1, 'x (nm)', 'm');
    p1.clip();
    p1.line(xs, a, PAL.x, 2);
    p1.line(xs, b, PAL.y, 2);
    p1.line(xs, d, PAL.z, 2);
    p1.unclip();
    p1.legend([{ col: PAL.x, label: 'mx' }, { col: PAL.y, label: 'my' }, { col: PAL.z, label: 'mz' }]);
    const h = this.hist, tn = h.t.map(function (v) { return v * 1e9; }), xn = h.x.map(function (v) { return v * 1e9; });
    const x0 = tn.length ? tn[0] : 0, x1 = tn.length > 1 ? tn[tn.length - 1] : x0 + 1;
    p2.begin('Position de la paroi au cours du temps', x0, x1, 0, this.nx * this.dx * 1e9, 't (ns)', 'x (nm)');
    p2.clip();
    p2.line(tn, xn, PAL.gold, 2.4);
    p2.unclip();
  }
}

class VortexSim extends FilmSimBase {
  constructor(host, d) {
    super(host, d);
    this.nx = 32;
    this.dx = 5e-9;
    this.timeScale = 6e-10;
    this.fv = new FilmView(this.nx, this.nx);
    this.mode = 'vortex';
    this.pulse = null;
    this.build();
  }
  build() {
    const nx = this.nx, mask = new Uint8Array(nx * nx), Rc = this.p.diam * 0.5e-9 / this.dx;
    for (let j = 0; j < nx; j++) {
      for (let i = 0; i < nx; i++) {
        const a = i + 0.5 - nx / 2, b = j + 0.5 - nx / 2;
        mask[j * nx + i] = a * a + b * b <= Rc * Rc ? 1 : 0;
      }
    }
    this.Rc = Rc;
    const c = new FilmCore(nx, nx, this.dx, { mask: mask, demag: true, thickness: this.p.thick * 1e-9 });
    c.Ms = 8e5;
    c.A = 1.3e-11;
    this.core = c;
    this.applyParams();
    this.init(this.mode);
  }
  applyParams() {
    const c = this.core, p = this.p;
    this.baseBx = p.Bx * 1e-3;
    this.baseBy = p.By * 1e-3;
    c.Bx = this.baseBx; c.By = this.baseBy; c.Bz = 0;
    c.alpha.fill(p.alpha);
    c.prepare();
  }
  onParam(id) {
    if (id === 'diam' || id === 'thick') this.build();
    else this.applyParams();
  }
  action(id) {
    if (id === 'pulse') this.pulse = { t0: this.t, dur: 120e-12 };
    else if (id === 'random') this.init('random');
    else if (id === 'uniform') this.init('uniform');
    else if (id === 'vortex') this.init('vortex');
  }
  init(mode) {
    this.mode = mode;
    const c = this.core, nx = this.nx, dx = this.dx;
    c.mx.fill(0); c.my.fill(0); c.mz.fill(0);
    if (mode === 'random') {
      c.randomize();
    } else {
      for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
          const id = j * nx + i;
          if (c.mask[id] !== 1) continue;
          if (mode === 'uniform') { c.mx[id] = 1; continue; }
          const x = (i + 0.5 - nx / 2 - 3) * dx, y = (j + 0.5 - nx / 2) * dx, r = Math.sqrt(x * x + y * y);
          const pz = Math.exp(-r * r / 128e-18), inpl = Math.sqrt(Math.max(0, 1 - pz * pz));
          if (r < 1e-12) c.mz[id] = 1;
          else { c.mx[id] = -y / r * inpl; c.my[id] = x / r * inpl; c.mz[id] = pz; }
        }
      }
    }
    c.normalizeAll();
    c.invalidate();
    this.t = 0;
    this.trail = [];
    this.ah = [];
    this.angU = 0;
    this.prevAng = null;
    this.fG = null;
    this.pulse = null;
    this.measure();
    this.obs = { mode: this.mode, circAbs: Math.abs(this.circ), coreR: this.coreR, fG: null, t: 0 };
  }
  reset() { this.init(this.mode); }
  beforeFrame() {
    const c = this.core, pl = this.pulse;
    if (pl && this.t < pl.t0 + pl.dur) c.Bx = this.baseBx + 0.1;
    else { c.Bx = this.baseBx; this.pulse = null; }
  }
  measure() {
    const c = this.core, nx = this.nx, dx = this.dx, act = c.act;
    let best = act[0], bv = 0;
    for (let q = 0; q < act.length; q++) {
      const id = act[q], v = Math.abs(c.mz[id]);
      if (v > bv) { bv = v; best = id; }
    }
    const pol = c.mz[best] >= 0 ? 1 : -1;
    let sx = 0, sy = 0, sw = 0, circ = 0, norm = 0;
    for (let q = 0; q < act.length; q++) {
      const id = act[q], i = id % nx, j = (id - i) / nx;
      const w = pol * c.mz[id] - 0.3;
      if (w > 0) { sx += w * (i + 0.5); sy += w * (j + 0.5); sw += w; }
      const rx = i + 0.5 - nx / 2, ry = j + 0.5 - nx / 2;
      circ += rx * c.my[id] - ry * c.mx[id];
      norm += Math.sqrt(rx * rx + ry * ry) * Math.sqrt(c.mx[id] * c.mx[id] + c.my[id] * c.my[id]);
    }
    const bi = best % nx, bj = Math.floor(best / nx);
    const cx = sw > 0 ? sx / sw : bi + 0.5, cy = sw > 0 ? sy / sw : bj + 0.5;
    this.coreX = (cx - nx / 2) * dx * 1e9;
    this.coreY = (cy - nx / 2) * dx * 1e9;
    this.coreR = Math.sqrt(this.coreX * this.coreX + this.coreY * this.coreY);
    this.pol = pol;
    this.mzmax = bv;
    this.circ = norm > 1e-9 ? circ / norm : 0;
    this.has = bv > 0.5 && Math.abs(this.circ) > 0.3;
    if (!this.has) { this.trail = []; this.prevAng = null; this.fG = null; return; }
    this.trail.push([cx, cy]);
    if (this.trail.length > 420) this.trail.shift();
    const ang = Math.atan2(this.coreY, this.coreX);
    if (this.prevAng !== null) this.angU += wrapPi(ang - this.prevAng);
    this.prevAng = ang;
    this.ah.push({ t: this.t, a: this.angU, r: this.coreR });
    if (this.ah.length > 400) this.ah.shift();
    const last = this.ah[this.ah.length - 1];
    let k = this.ah.length - 1;
    while (k > 0 && last.t - this.ah[k].t < 0.6e-9) k--;
    const dt = last.t - this.ah[k].t;
    this.fG = (dt > 0.15e-9 && last.r > 3) ? Math.abs(last.a - this.ah[k].a) / (TAU * dt) / 1e9 : null;
  }
  afterFrame() {
    this.measure();
    this.obs = { mode: this.mode, circAbs: Math.abs(this.circ), coreR: this.coreR, fG: this.fG, t: this.t };
  }
  hud() {
    const circTxt = Math.abs(this.circ) < 0.3 ? 'pas de vortex' : (this.circ > 0 ? 'anti-horaire ↺' : 'horaire ↻');
    return [
      ['Circulation', circTxt, Math.abs(this.circ) > 0.6 ? 'good' : ''],
      ['Polarité du cœur', this.pol > 0 ? '↑ (blanc)' : '↓ (noir)'],
      ['Cœur à', this.has ? this.coreR.toFixed(0) + ' nm du centre' : 'pas de cœur', this.has ? 'hot' : 'bad'],
      ['Fréquence gyrotropique', this.fG === null ? '—' : this.fG.toFixed(2) + ' GHz'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  draw(ctx, W, H) {
    this.fv.paint(this.core, this.p.disp === 'mz' ? 'mz' : 'wheel');
    const L = this.fv.draw(ctx, W, H, 22);
    const nx = this.nx, s = L.s;
    ctx.strokeStyle = 'rgba(23,20,15,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(L.x0 + nx / 2 * s, L.y0 + nx / 2 * s, this.Rc * s, 0, TAU);
    ctx.stroke();
    if (this.p.arrows) drawArrowsOver(ctx, this.core, this.fv, 2);
    const tr = this.trail;
    ctx.lineWidth = 2.4;
    for (let i = 1; i < tr.length; i++) {
      const a = this.fv.px(tr[i - 1][0], tr[i - 1][1]), b = this.fv.px(tr[i][0], tr[i][1]);
      ctx.strokeStyle = 'rgba(23,20,15,' + (0.9 * i / tr.length).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    if (this.has && tr.length) {
      const q = this.fv.px(tr[tr.length - 1][0], tr[tr.length - 1][1]);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, TAU); ctx.stroke();
    } else if (!this.has) {
      drawLabel(ctx, 'Plus de cœur de vortex', W / 2, L.y0 + 18, { align: 'center' });
    }
    drawWheelLegend(ctx, 46, 54, 24);
    drawScaleBar(ctx, W - 110, H - 16, 50e-9 / this.dx * s, '50 nm');
  }
  drawPlots(p1, p2) {
    const tr = this.trail, xs = [], ys = [];
    for (let i = 0; i < tr.length; i++) {
      xs.push((tr[i][0] - this.nx / 2) * this.dx * 1e9);
      ys.push((tr[i][1] - this.nx / 2) * this.dx * 1e9);
    }
    const R = this.p.diam / 2;
    p2.begin('Trajectoire du cœur (nm)', -R, R, -R, R, 'x (nm)', 'y (nm)');
    p2.clip();
    p2.line(xs, ys, PAL.gold, 2);
    p2.unclip();
    const c = p2.ctx;
    c.strokeStyle = 'rgba(23,20,15,0.3)';
    c.beginPath();
    c.arc(p2.X(0), p2.Y(0), Math.min(p2.pw / 2, p2.ph / 2), 0, TAU);
    c.stroke();
    const a = this.ah, tn = [], rv = [];
    for (let i = 0; i < a.length; i++) { tn.push(a[i].t * 1e9); rv.push(a[i].r); }
    const x0 = tn.length ? tn[0] : 0, x1 = tn.length > 1 ? tn[tn.length - 1] : x0 + 1;
    p1.begin('Distance du cœur au centre', x0, x1, 0, Math.max(10, R), 't (ns)', 'r (nm)');
    p1.clip();
    p1.line(tn, rv, PAL.blue, 2.2);
    p1.unclip();
  }
}

class SkyrmionSim extends FilmSimBase {
  constructor(host, d, mode) {
    super(host, d);
    this.mode = mode;
    this.nx = 40;
    this.ny = 40;
    this.dx = 6e-9;
    this.timeScale = 2e-9;
    this.core = new FilmCore(40, 40, 6e-9, { px: true, py: true });
    this.core.Ms = 5.8e5;
    this.core.A = 1.5e-11;
    this.fv = new FilmView(40, 40);
    this.hist = newHist(2);
    this.sp = { t: [], x: [], y: [] };
    this.vh = newHist(1);
    this.applyParams();
    this.reset();
  }
  applyParams() {
    const c = this.core, p = this.p;
    if (this.mode === 'static') {
      c.D = p.D * 1e-3; c.Kc = p.K * 1e3; c.Bz = p.Bz * 1e-3;
      c.ux = 0; c.uy = 0; c.beta = 0;
    } else {
      c.D = 3.5e-3; c.Kc = 6e5; c.Bz = 0;
      c.ux = p.u * Math.cos(p.dir * DEG);
      c.uy = p.u * Math.sin(p.dir * DEG);
      c.beta = p.ratio * p.alpha;
    }
    c.alpha.fill(p.alpha);
    c.prepare();
    this.Dc = 4 / Math.PI * Math.sqrt(c.A * c.Kc);
  }
  onParam() { this.applyParams(); }
  action(id) {
    if (id === 'seed' || id === 'reset') this.init('seed');
    else if (id === 'random') this.init('random');
    else if (id === 'uniform') this.init('uniform');
    else if (id === 'clear') { this.sp = { t: [], x: [], y: [] }; this.trail = []; this.pos = null; }
  }
  reset() { this.init('seed'); }
  init(kind) {
    const c = this.core, nx = this.nx, dx = this.dx;
    c.mx.fill(0); c.my.fill(0); c.mz.fill(1);
    if (kind === 'random') {
      c.randomize();
    } else if (kind === 'seed') {
      const s = c.D < 0 ? -1 : 1, cx = nx * dx * 0.5, cy = cx, R = 16e-9, w = 7e-9;
      for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
          const x = (i + 0.5) * dx - cx, y = (j + 0.5) * dx - cy, r = Math.sqrt(x * x + y * y);
          const th = 2 * Math.atan2(Math.sinh(R / w), Math.sinh(r / w));
          const ph = Math.atan2(y, x), sn = Math.sin(th), id = j * nx + i;
          c.mx[id] = s * sn * Math.cos(ph);
          c.my[id] = s * sn * Math.sin(ph);
          c.mz[id] = Math.cos(th);
        }
      }
    }
    c.normalizeAll();
    c.invalidate();
    this.t = 0;
    this.hist = newHist(2);
    this.vh = newHist(1);
    this.trail = [];
    this.pos = null;
    this.lost = false;
    this.sp = { t: [], x: [], y: [] };
    this.afterFrame();
  }
  track() {
    const c = this.core, nx = this.nx, ny = this.ny, mz = c.mz;
    let best = 0, bv = 2;
    for (let i = 0; i < c.n; i++) if (mz[i] < bv) { bv = mz[i]; best = i; }
    if (bv > -0.3 || Math.abs(this.Q) < 0.5) { this.pos = null; this.lost = true; return; }
    if (!this.pos) this.pos = { x: (best % nx) + 0.5, y: Math.floor(best / nx) + 0.5 };
    let sx = 0, sy = 0, sw = 0;
    const px = this.pos.x, py = this.pos.y;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const w = -mz[j * nx + i];
        if (w <= 0.2) continue;
        let ddx = i + 0.5 - px, ddy = j + 0.5 - py;
        ddx -= nx * Math.round(ddx / nx);
        ddy -= ny * Math.round(ddy / ny);
        if (ddx * ddx + ddy * ddy > 144) continue;
        sx += w * ddx; sy += w * ddy; sw += w;
      }
    }
    if (sw > 0.5) {
      this.pos.x += sx / sw;
      this.pos.y += sy / sw;
      this.lost = false;
    } else {
      this.lost = true;
      this.pos = null;
    }
  }
  afterFrame() {
    const c = this.core, Q = c.topoCharge();
    let mzs = 0, neg = 0;
    for (let i = 0; i < c.n; i++) { mzs += c.mz[i]; if (c.mz[i] < 0) neg++; }
    this.Q = Q;
    this.mzMean = mzs / c.n;
    this.frac = neg / c.n;
    this.v = null;
    this.hall = null;
    if (this.mode === 'current') {
      this.track();
      if (this.lost) this.trail = [];
      if (!this.lost) {
        const X = this.pos.x * this.dx * 1e9, Y = this.pos.y * this.dx * 1e9;
        const sp = this.sp;
        sp.t.push(this.t); sp.x.push(X); sp.y.push(Y);
        if (sp.t.length > 1500) { sp.t.shift(); sp.x.shift(); sp.y.shift(); }
        this.trail.push([this.pos.x, this.pos.y]);
        if (this.trail.length > 1500) this.trail.shift();
        const n = sp.t.length;
        if (n > 2) {
          let k = n - 1;
          while (k > 0 && sp.t[n - 1] - sp.t[k] < 0.3e-9) k--;
          const dtn = (sp.t[n - 1] - sp.t[k]) * 1e9;
          if (dtn > 0.05) {
            const vx = (sp.x[n - 1] - sp.x[k]) / dtn, vy = (sp.y[n - 1] - sp.y[k]) / dtn;
            this.v = Math.sqrt(vx * vx + vy * vy);
            this.hall = wrapPi(Math.atan2(vy, vx) - this.p.dir * DEG) / DEG;
          }
        }
      }
      pushHist(this.vh, this.t, [this.v === null ? 0 : this.v], 700);
    } else {
      pushHist(this.hist, this.t, [Q, this.mzMean], 700);
    }
    this.obs = {
      Q: Q, t: this.t, frac: this.frac,
      maze: this.frac > 0.25 && this.frac < 0.75 && Math.abs(Q) < 2 && this.t > 4e-10,
      v: this.v, hall: this.hall
    };
  }
  hud() {
    if (this.mode === 'current') {
      return [
        ['Vitesse du skyrmion', this.v === null ? '—' : this.v.toFixed(0) + ' m/s', 'hot'],
        ['Angle de Hall', this.hall === null ? '—' : this.hall.toFixed(0) + '°', 'good'],
        ['Vitesse des électrons u', this.p.u.toFixed(0) + ' m/s'],
        ['Charge topologique Q', this.Q.toFixed(2)],
        ['β', (this.p.ratio * this.p.alpha).toFixed(3) + ' (α = ' + this.p.alpha.toFixed(2) + ')'],
        ['État', this.lost ? 'skyrmion disparu' : 'suivi du skyrmion', this.lost ? 'bad' : '']
      ];
    }
    return [
      ['Charge topologique Q', this.Q.toFixed(2), Math.abs(Math.abs(this.Q) - 1) < 0.2 ? 'good' : 'hot'],
      ['Skyrmions ≈', String(Math.round(Math.abs(this.Q)))],
      ['Aimantation moyenne ⟨mz⟩', this.mzMean.toFixed(2)],
      ['D / D_c', (this.core.D / this.Dc).toFixed(2), this.core.D > this.Dc ? 'bad' : ''],
      ['Temps', fmtTime(this.t)]
    ];
  }
  draw(ctx, W, H) {
    this.fv.paint(this.core, this.p.disp === 'mz' ? 'mz' : 'wheel');
    const L = this.fv.draw(ctx, W, H, 16), s = L.s, nx = this.nx, ny = this.ny;
    if (this.p.arrows) drawArrowsOver(ctx, this.core, this.fv, 2);
    if (this.mode === 'current') {
      const tr = this.trail;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const ax = tr[i - 1][0], ay = tr[i - 1][1], bx = tr[i][0], by = tr[i][1];
        if (Math.abs(bx - ax) > nx / 2 || Math.abs(by - ay) > ny / 2) continue;
        const wx = ((ax % nx) + nx) % nx, wy = ((ay % ny) + ny) % ny;
        const wx2 = wx + (bx - ax), wy2 = wy + (by - ay);
        const a = this.fv.px(wx, wy), b = this.fv.px(wx2, wy2);
        ctx.strokeStyle = 'rgba(23,20,15,' + (0.85 * i / tr.length).toFixed(2) + ')';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      if (this.lost) drawLabel(ctx, 'Skyrmion disparu · ↺ pour en recréer un', W / 2, L.y0 + 18, { align: 'center' });
      if (this.pos && !this.lost) {
        const q = this.fv.px(((this.pos.x % nx) + nx) % nx, ((this.pos.y % ny) + ny) % ny);
        ctx.strokeStyle = PAL.gold;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, TAU); ctx.stroke();
      }
      const ang = this.p.dir * DEG, cx0 = L.x0 + 40, cy0 = L.y0 + 40;
      ctx.strokeStyle = PAL.teal; ctx.fillStyle = PAL.teal;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx0 - Math.cos(ang) * 22, cy0 + Math.sin(ang) * 22);
      ctx.lineTo(cx0 + Math.cos(ang) * 22, cy0 - Math.sin(ang) * 22);
      ctx.stroke();
      ctx.beginPath();
      const tx = cx0 + Math.cos(ang) * 22, ty = cy0 - Math.sin(ang) * 22;
      ctx.moveTo(tx + Math.cos(ang) * 8, ty - Math.sin(ang) * 8);
      ctx.lineTo(tx - Math.cos(ang) * 4 - Math.sin(ang) * 6, ty + Math.sin(ang) * 4 - Math.cos(ang) * 6);
      ctx.lineTo(tx - Math.cos(ang) * 4 + Math.sin(ang) * 6, ty + Math.sin(ang) * 4 + Math.cos(ang) * 6);
      ctx.closePath(); ctx.fill();
      ctx.font = '12px Atkinson Hyperlegible, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('électrons', cx0, cy0 + 40);
    }
    drawWheelLegend(ctx, W - 100, 54, 24);
    drawScaleBar(ctx, L.x0 + 12, H - 14, 100e-9 / this.dx * s, '100 nm');
  }
  drawPlots(p1, p2) {
    const c = this.core, nx = this.nx;
    if (this.mode === 'current') {
      drawSeries(p1, this.vh, [{ i: 0, col: PAL.gold, label: 'v' }], 'Vitesse du skyrmion (m/s)', null, null, 'm/s');
      const sp = this.sp;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < sp.x.length; i++) {
        x0 = Math.min(x0, sp.x[i]); x1 = Math.max(x1, sp.x[i]);
        y0 = Math.min(y0, sp.y[i]); y1 = Math.max(y1, sp.y[i]);
      }
      if (!(x1 > x0)) { x0 = 0; x1 = 100; y0 = 0; y1 = 100; }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max(60, (x1 - x0) / 2 * 1.2, (y1 - y0) / 2 * 1.2);
      p2.begin('Trajectoire du skyrmion (nm)', cx - half, cx + half, cy - half, cy + half, 'x (nm)', 'y (nm)');
      p2.clip();
      p2.line(sp.x, sp.y, PAL.gold, 2.4);
      const ang = this.p.dir * DEG;
      p2.ctx.strokeStyle = 'rgba(23,20,15,0.45)';
      p2.ctx.setLineDash([5, 4]);
      p2.ctx.beginPath();
      if (sp.x.length) {
        p2.ctx.moveTo(p2.X(sp.x[0]), p2.Y(sp.y[0]));
        p2.ctx.lineTo(p2.X(sp.x[0] + Math.cos(ang) * half * 3), p2.Y(sp.y[0] + Math.sin(ang) * half * 3));
      }
      p2.ctx.stroke();
      p2.ctx.setLineDash([]);
      p2.unclip();
      p2.text('pointillé : direction du courant', p2.box.l + 8, p2.box.t + p2.ph - 8, 'rgba(23,20,15,0.6)');
    } else {
      drawSeries(p1, this.hist, [
        { i: 0, col: PAL.red, label: 'Q' },
        { i: 1, col: PAL.blue, label: '⟨mz⟩' }
      ], 'Charge topologique et aimantation moyenne', null, null, '');
      const xs = [], ys = [], j = Math.floor(this.ny / 2);
      for (let i = 0; i < nx; i++) { xs.push((i + 0.5) * this.dx * 1e9); ys.push(c.mz[j * nx + i]); }
      p2.begin('Coupe de mz le long de la ligne centrale', 0, nx * this.dx * 1e9, -1.1, 1.1, 'x (nm)', 'mz');
      p2.clip();
      p2.line(xs, ys, PAL.z, 2.4);
      p2.unclip();
    }
  }
}

class SpinWaveSim extends FilmSimBase {
  constructor(host, d) {
    super(host, d);
    this.nx = 80;
    this.ny = 48;
    this.dx = 10e-9;
    this.timeScale = 6e-10;
    const c = new FilmCore(this.nx, this.ny, this.dx, { px: false, py: false });
    c.Ms = 8e5;
    c.A = 1.3e-11;
    c.Kc = 0.5 * c.Ms * 0.04;
    c.acS = new Float64Array(c.n);
    c.acDx = 1; c.acDy = 0; c.acDz = 0;
    c.acPhi = 0;
    this.core = c;
    this.fv = new FilmView(this.nx, this.ny);
    this.applyParams();
    this.reset();
  }
  buildSource() {
    const c = this.core, nx = this.nx, ny = this.ny, S = c.acS, cyc = ny / 2;
    S.fill(0);
    const blob = function (cx, cy) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const r2 = (i + 0.5 - cx) * (i + 0.5 - cx) + (j + 0.5 - cy) * (j + 0.5 - cy);
          S[j * nx + i] += Math.exp(-r2 / (2 * 1.6 * 1.6));
        }
      }
    };
    const src = this.p.src;
    if (src === 'line') {
      for (let j = 0; j < ny; j++) {
        const e = Math.min(j, ny - 1 - j), wgt = clamp((e - 8) / 8, 0, 1);
        S[j * nx + 14] = wgt; S[j * nx + 15] = wgt;
      }
    } else if (src === 'two') {
      blob(20, cyc - 8);
      blob(20, cyc + 8);
    } else {
      blob(20, cyc);
    }
  }
  applyParams() {
    const c = this.core, p = this.p, nx = this.nx, ny = this.ny, wc = 10;
    c.Bz = p.B * 1e-3;
    c.acAmp = p.b0 * 1e-3;
    c.acOmega = TAU * p.f * 1e9;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const dist = Math.min(i, nx - 1 - i, j, ny - 1 - j);
        const s = clamp((wc - dist) / wc, 0, 1);
        c.alpha[j * nx + i] = p.alpha + (0.35 - p.alpha) * s * s;
      }
    }
    c.prepare();
    this.buildSource();
    const Btot = p.B * 1e-3 + 2 * c.Kc / c.Ms, cex = 2 * c.A / c.Ms;
    this.f0 = GHZ_PER_T * Btot;
    const kk = (TAU * p.f * 1e9 / GAMMA - Btot) / cex;
    if (kk > 0) {
      this.k = Math.sqrt(kk);
      this.lambda = TAU / this.k;
      this.vg = 2 * GAMMA * cex * this.k;
    } else {
      this.k = null; this.lambda = null; this.vg = null;
    }
    this.Btot = Btot;
    this.cex = cex;
  }
  onParam(id) {
    if (id === 'f') this.core.acPhi += (this.core.acOmega - TAU * this.p.f * 1e9) * this.t;
    this.applyParams();
  }
  sonify() {
    return { f: 120 + 45 * this.p.f, a: this.k !== null ? 0.45 : 0.06 };
  }
  action(id) { if (id === 'reset') this.reset(); }
  reset() {
    const c = this.core;
    c.mx.fill(0); c.my.fill(0); c.mz.fill(1);
    c.acPhi = 0;
    this.t = 0;
    this.fv.vmax = 0.01;
    this.afterFrame();
  }
  afterFrame() {
    this.obs = {
      prop: this.k !== null,
      f: this.p.f, f0: this.f0, lambda: this.lambda, t: this.t
    };
  }
  hud() {
    const o = this.obs;
    return [
      ['Fréquence de coupure f₀', this.f0.toFixed(2) + ' GHz', 'hot'],
      ['Fréquence de la source', this.p.f.toFixed(1) + ' GHz'],
      ['Longueur d’onde', o.prop ? (this.lambda * 1e9).toFixed(0) + ' nm' : '— (pas de propagation)', o.prop ? 'good' : 'bad'],
      ['Vitesse de groupe', o.prop ? (this.vg).toFixed(0) + ' m/s' : '—'],
      ['Temps', fmtTime(this.t)]
    ];
  }
  draw(ctx, W, H) {
    this.fv.paint(this.core, 'mx');
    const L = this.fv.draw(ctx, W, H, 10), s = L.s, nx = this.nx, ny = this.ny;
    ctx.strokeStyle = 'rgba(23,20,15,0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(L.x0 + 10 * s, L.y0 + 10 * s, (nx - 20) * s, (ny - 20) * s);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(23,20,15,0.6)';
    ctx.font = '11px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('zone absorbante (pas de réflexion)', L.x0 + 6, L.y0 + ny * s - 6);
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 2.4;
    const src = this.p.src, cyc = ny / 2;
    const ring = function (cx, cy) {
      const q = [L.x0 + cx * s, L.y0 + (ny - cy) * s];
      ctx.beginPath(); ctx.arc(q[0], q[1], 2.6 * s, 0, TAU); ctx.stroke();
    };
    if (src === 'line') {
      ctx.beginPath();
      ctx.moveTo(L.x0 + 15 * s, L.y0 + 10 * s);
      ctx.lineTo(L.x0 + 15 * s, L.y0 + (ny - 10) * s);
      ctx.stroke();
    } else if (src === 'two') {
      ring(20, cyc - 8);
      ring(20, cyc + 8);
    } else {
      ring(20, cyc);
    }
    drawScaleBar(ctx, W - 120, H - 14, 200e-9 / this.dx * s, '200 nm');
    ctx.fillStyle = 'rgba(201,138,0,0.95)';
    ctx.textAlign = 'left';
    ctx.fillText('antenne', L.x0 + 22 * s, L.y0 + (ny - cyc) * s - 3 * s);
  }
  drawPlots(p1, p2) {
    const xmax = 120, ymax = 24, cex = this.cex, B = this.Btot;
    p1.begin('Relation de dispersion  f(k)', 0, xmax, 0, ymax, 'nombre d’onde k (rad/µm)', 'f (GHz)');
    const kl = 2 * Math.PI / (6 * this.dx) / 1e6;
    p1.ctx.fillStyle = 'rgba(215,48,31,0.10)';
    p1.ctx.fillRect(p1.X(kl), p1.box.t, p1.X(xmax) - p1.X(kl), p1.ph);
    const ks = [], fs = [];
    for (let k = 0; k <= xmax; k += 2) { ks.push(k); fs.push(GHZ_PER_T * (B + cex * Math.pow(k * 1e6, 2))); }
    p1.clip();
    p1.line(ks, fs, PAL.blue, 2.4);
    p1.hline(this.p.f, PAL.red, true);
    p1.hline(this.f0, PAL.gold, true, 'f₀');
    if (this.k !== null) {
      const q = p1.ctx;
      q.fillStyle = PAL.ink;
      q.beginPath(); q.arc(p1.X(this.k * 1e-6), p1.Y(this.p.f), 6, 0, TAU); q.fill();
    }
    p1.unclip();
    p1.text('zone rouge : maille trop grossière', p1.X(kl) - 6, p1.box.t + p1.ph - 8, PAL.red, 'right');
    const c = this.core, nx = this.nx, j = Math.floor(this.ny / 2), xs = [], ys = [];
    let lim = 0.01;
    for (let i = 0; i < nx; i++) {
      xs.push((i + 0.5) * this.dx * 1e9);
      const v = c.mx[j * nx + i];
      ys.push(v);
      lim = Math.max(lim, Math.abs(v));
    }
    lim *= 1.2;
    p2.begin('Coupe de mx le long de la ligne centrale', 0, nx * this.dx * 1e9, -lim, lim, 'x (nm)', 'mx');
    p2.clip();
    p2.line(xs, ys, PAL.x, 2.2);
    p2.unclip();
  }
}

// ===== modes/extra.js =====
class FilingsSim extends SimBase {
  constructor(host, d, opt) {
    super(host, d);
    this.hero = !!(opt && opt.hero);
    this.W = 0; this.H = 0; this.sc = 40;
    this.mags = [];
    this.fil = null;
    this.lines = null;
    this.linesDirty = true;
    this.hover = null;
    this.grab = null;
    this.idle = 0;
    this.prof = null;
    this.P = [];
    this.dirty = true;
    this.kT = 0.036;
    this.bRef = 1;
    this.rnd = uni(xorshift(99));
    this.obs = { neutral: false, repel: false, strong: false, Bh: null };
    this.setScene(this.p.scene || 'bar');
  }
  timeInfo() { return 'Champ statique : rien ne bouge tout seul'; }
  setScene(s) {
    this.p.scene = s;
    const M = function (x, y, a, L, w, q) { return { x: x, y: y, a: a, L: L || 4, w: w || 1.1, q: q || 1, kind: 'bar' }; };
    this.earth = false;
    if (s === 'attract') this.mags = [M(-3.1, 0, 0), M(3.1, 0, 0)];
    else if (s === 'repel') this.mags = [M(-3.1, 0, 0), M(3.1, 0, Math.PI)];
    else if (s === 'halbach') {
      this.mags = [];
      for (let k = 0; k < 5; k++) this.mags.push(M(-2.8 + 1.4 * k, 0.6, -k * Math.PI / 2, 1.3, 1.3, 0.45));
    } else if (s === 'horseshoe') {
      const u = M(0, -0.8, Math.PI / 2, 3.6, 1.0, 1.1);
      u.kind = 'u';
      this.mags = [u];
    } else if (s === 'earth') {
      const e = M(0, 0, -Math.PI / 2 + 11 * DEG, 2.2, 0.7, 2.2);
      e.kind = 'earth';
      this.mags = [e];
      this.earth = true;
    } else {
      this.mags = [M(0, 0, 0)];
    }
    if (this.hero) this.mags[0].a = 0.35;
    this.dirty = true;
    this.fil = null;
    this.poles();
  }
  poles() {
    const P = [];
    for (let k = 0; k < this.mags.length; k++) {
      const m = this.mags[k], c = Math.cos(m.a), s = Math.sin(m.a);
      if (m.kind === 'u') {
        const rx = s, ry = -c;
        P.push(m.x + c * 1.4 - rx * 0.95, m.y + s * 1.4 - ry * 0.95, m.q);
        P.push(m.x + c * 1.4 + rx * 0.95, m.y + s * 1.4 + ry * 0.95, -m.q);
      } else {
        const h = m.L * 0.42;
        P.push(m.x + c * h, m.y + s * h, m.q);
        P.push(m.x - c * h, m.y - s * h, -m.q);
      }
    }
    this.P = P;
    if (this.earth) {
      const tmp = [0, 0], b = this.field(0, 3.05, tmp);
      this.kT = b > 0 ? 47e-6 / b : 1e-6;
    } else {
      this.kT = 0.036;
    }
  }
  field(x, y, out) {
    const P = this.P;
    let bx = 0, by = 0;
    for (let i = 0; i < P.length; i += 3) {
      const dx = x - P[i], dy = y - P[i + 1], r2 = dx * dx + dy * dy + 0.03, inv = P[i + 2] / (r2 * Math.sqrt(r2));
      bx += dx * inv; by += dy * inv;
    }
    out[0] = bx; out[1] = by;
    return Math.sqrt(bx * bx + by * by);
  }
  local(m, x, y) {
    const c = Math.cos(m.a), s = Math.sin(m.a), dx = x - m.x, dy = y - m.y;
    return [dx * c + dy * s, dx * s - dy * c];
  }
  insideOne(m, x, y, mg) {
    if (m.kind === 'earth') {
      const dx = x - m.x, dy = y - m.y;
      return dx * dx + dy * dy < (3 + mg) * (3 + mg);
    }
    const l = this.local(m, x, y), f = l[0], r = l[1];
    if (m.kind === 'u') {
      const ar = Math.abs(r);
      const legs = ar >= 0.6 - mg && ar <= 1.3 + mg && f >= -1.0 - mg && f <= 1.75 + mg;
      const base = ar <= 1.3 + mg && f >= -1.35 - mg && f <= -0.3 + mg;
      return legs || base;
    }
    return Math.abs(f) <= m.L / 2 + mg && Math.abs(r) <= m.w / 2 + mg;
  }
  inside(x, y) {
    for (let k = 0; k < this.mags.length; k++) if (this.insideOne(this.mags[k], x, y, 0)) return true;
    return false;
  }
  hit(x, y) {
    for (let k = this.mags.length - 1; k >= 0; k--) if (this.insideOne(this.mags[k], x, y, 0.3)) return k;
    return -1;
  }
  toPx(x, y) { return [this.W / 2 + x * this.sc, this.H / 2 - y * this.sc]; }
  toW(px, py) { return [(px - this.W / 2) / this.sc, (this.H / 2 - py) / this.sc]; }
  genFilings() {
    const W = this.W, H = this.H, n = this.hero ? 1500 : 2400, out = [], tmp = [0, 0], rnd = this.rnd;
    const m0 = this.mags[0], rp = this.P.length ? [this.P[0] + Math.cos(m0.a) * 2, this.P[1] + Math.sin(m0.a) * 2] : [2, 0];
    this.bRef = Math.max(1e-6, this.field(rp[0], rp[1], tmp));
    let tries = 0;
    while (out.length < n * 3 && tries < n * 8) {
      tries++;
      const px = rnd() * W, py = rnd() * H, wx = (px - W / 2) / this.sc, wy = (H / 2 - py) / this.sc;
      if (this.inside(wx, wy)) continue;
      const b = this.field(wx, wy, tmp);
      const acc = clamp(0.2 + 0.55 * Math.pow(b / this.bRef, 0.35), 0, 1);
      if (rnd() > acc) continue;
      out.push(px, py, 0.6 + 0.8 * rnd());
    }
    this.fil = new Float32Array(out);
  }
  traceLines() {
    const P = this.P, out = [], tmp = [0, 0], hw = this.W / (2 * this.sc) + 1, hh = this.H / (2 * this.sc) + 1;
    const seeds = this.hero ? 12 : 16;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 2] <= 0) continue;
      const ns = Math.max(5, Math.round(seeds * Math.min(1.4, P[i + 2])));
      for (let k = 0; k < ns; k++) {
        const a = TAU * (k + 0.5) / ns;
        let x = P[i] + 0.22 * Math.cos(a), y = P[i + 1] + 0.22 * Math.sin(a);
        const pts = [x, y];
        for (let st = 0; st < 700; st++) {
          let b = this.field(x, y, tmp);
          if (b < 1e-9) break;
          const h = clamp(0.04 + 0.02 * Math.sqrt(x * x + y * y), 0.04, 0.14);
          const mx = x + tmp[0] / b * h * 0.5, my = y + tmp[1] / b * h * 0.5;
          b = this.field(mx, my, tmp);
          if (b < 1e-9) break;
          x += tmp[0] / b * h;
          y += tmp[1] / b * h;
          pts.push(x, y);
          if (Math.abs(x) > hw || Math.abs(y) > hh) break;
          let hitS = false;
          for (let j = 0; j < P.length; j += 3) {
            if (P[j + 2] >= 0) continue;
            const ddx = x - P[j], ddy = y - P[j + 1];
            if (ddx * ddx + ddy * ddy < 0.04) { hitS = true; break; }
          }
          if (hitS) break;
        }
        out.push(pts);
      }
    }
    this.lines = out;
  }
  update(dtReal) {
    this.t += dtReal;
    this.idle += dtReal;
    if (this.hero && !this.grab) {
      const m = this.mags[0];
      if (Sensors.real && Sensors.heading !== null) {
        const target = Math.PI / 2 + Sensors.heading * DEG;
        m.a += wrapPi(target - m.a) * Math.min(1, dtReal * 3);
        this.dirty = true;
      } else if (this.idle > 3) {
        m.a += dtReal * 0.22;
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.poles();
      this.linesDirty = true;
      if (!this.hero) this.profile();
      this.dirty = false;
    }
    this.measure();
  }
  measure() {
    const o = this.obs, tmp = [0, 0];
    o.Bh = null; o.neutral = false; o.strong = false;
    if (this.hover && !this.inside(this.hover[0], this.hover[1])) {
      const b = this.field(this.hover[0], this.hover[1], tmp) * this.kT;
      o.Bh = b;
      const r = Math.sqrt(this.hover[0] * this.hover[0] + this.hover[1] * this.hover[1]);
      o.neutral = this.mags.length >= 2 && !this.earth && b < 5e-4 && r < 4.5;
      o.strong = !this.earth && b > 0.047;
    }
    o.repel = false;
    const P = this.P;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 2] <= 0) continue;
      for (let j = i + 3; j < P.length; j += 3) {
        if (P[j + 2] <= 0) continue;
        const dx = P[i] - P[j], dy = P[i + 1] - P[j + 1];
        if (dx * dx + dy * dy < 2.9 && Math.abs(P[i + 2]) >= 1 && Math.abs(P[j + 2]) >= 1) o.repel = true;
      }
    }
  }
  profile() {
    const m = this.mags[0], tmp = [0, 0], ox = this.P[0], oy = this.P[1], dx = Math.cos(m.a), dy = Math.sin(m.a);
    const r = [], b = [], f = this.earth ? 1e6 : 1e3;
    for (let d = 0.3; d <= 12; d *= 1.06) {
      r.push(d);
      b.push(this.field(ox + dx * d, oy + dy * d, tmp) * this.kT * f);
    }
    this.prof = { r: r, b: b };
  }
  fmtB(T) {
    if (T >= 1e-3) return frNum(T * 1e3, T >= 0.01 ? 0 : 1) + ' mT';
    return frNum(T * 1e6, T >= 1e-5 ? 0 : 1) + ' µT';
  }
  draw(ctx, W, H) {
    if (W !== this.W || H !== this.H) {
      this.W = W; this.H = H;
      this.sc = Math.min(W, H) / (this.hero ? 9 : 12);
      if (this.hero) {
        const wide = W > 760;
        this.mags[0].x = wide ? Math.min(4.5, (W / this.sc) * 0.17) : 0;
        this.mags[0].y = wide ? 0.5 : 0.6;
        this.poles();
      }
      this.fil = null;
      this.linesDirty = true;
    }
    if (!this.P.length) this.poles();
    if (!this.fil) this.genFilings();
    const disp = this.p.disp || 'filings';
    if (this.earth) this.drawEarth(ctx);
    if (disp === 'lines' || disp === 'all') {
      if (this.linesDirty || !this.lines) { this.traceLines(); this.linesDirty = false; }
      this.drawLines(ctx, disp === 'all' ? (this.hero ? 0.22 : 0.3) : 0.75);
    }
    if (disp === 'filings' || disp === 'all') this.drawFilings(ctx);
    if (disp === 'compass') this.drawCompasses(ctx);
    this.drawMagnets(ctx);
    if (this.hover && !this.hero) this.drawProbe(ctx);
    if (!this.hero && Sensors.real && Sensors.heading !== null) this.drawRealCompass(ctx, W, H);
    if (!this.hero) drawScaleBar(ctx, W - 22 - 2 * this.sc, H - 16, 2 * this.sc, this.earth ? '≈ 4 000 km' : '2 cm');
  }
  drawFilings(ctx) {
    const f = this.fil, tmp = [0, 0], base = this.hero ? 6.5 : 7.5, n = f.length / 3, W = this.W, H = this.H, sc = this.sc;
    const bucket = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < n; i++) {
      const px = f[3 * i], py = f[3 * i + 1], wx = (px - W / 2) / sc, wy = (H / 2 - py) / sc;
      if (this.inside(wx, wy)) continue;
      const b = this.field(wx, wy, tmp);
      if (b < 1e-12) continue;
      const L = base * f[3 * i + 2] * 0.5, ux = tmp[0] / b, uy = -tmp[1] / b;
      const lv = Math.log10(b / this.bRef);
      const k = lv < -1.3 ? 0 : (lv < -0.7 ? 1 : (lv < 0 ? 2 : 3));
      bucket[k].moveTo(px - ux * L, py - uy * L);
      bucket[k].lineTo(px + ux * L, py + uy * L);
    }
    const al = [0.2, 0.4, 0.62, 0.86];
    ctx.lineCap = 'round';
    ctx.lineWidth = this.hero ? 1.5 : 1.6;
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = 'rgba(23,20,15,' + al[k] + ')';
      ctx.stroke(bucket[k]);
    }
    ctx.lineCap = 'butt';
  }
  drawCompasses(ctx) {
    const tmp = [0, 0], st = 38, W = this.W, H = this.H;
    for (let py = st / 2; py < H; py += st) {
      for (let px = st / 2; px < W; px += st) {
        const w = this.toW(px, py);
        if (this.inside(w[0], w[1])) continue;
        this.field(w[0], w[1], tmp);
        ctx.fillStyle = 'rgba(23,20,15,0.08)';
        ctx.beginPath(); ctx.arc(px, py, 13, 0, TAU); ctx.fill();
        drawNeedle(ctx, px, py, Math.atan2(tmp[1], tmp[0]), 12, 3.2);
      }
    }
  }
  drawLines(ctx, a, color = '23,20,15') {
    const L = this.lines || [];
    ctx.strokeStyle = 'rgba(' + color + ',' + a + ')';
    ctx.fillStyle = 'rgba(' + color + ',' + Math.min(1, a + 0.15) + ')';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (p.length < 6) continue;
      ctx.beginPath();
      let q = this.toPx(p[0], p[1]);
      ctx.moveTo(q[0], q[1]);
      for (let k = 2; k < p.length; k += 2) {
        q = this.toPx(p[k], p[k + 1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
      const mi = 2 * Math.floor(p.length / 6);
      if (mi + 3 < p.length) {
        const a0 = this.toPx(p[mi], p[mi + 1]), a1 = this.toPx(p[mi + 2], p[mi + 3]);
        const dx = a1[0] - a0[0], dy = a1[1] - a0[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l;
        ctx.beginPath();
        ctx.moveTo(a1[0] + ux * 4, a1[1] + uy * 4);
        ctx.lineTo(a1[0] - ux * 4 + uy * 3.5, a1[1] - uy * 4 - ux * 3.5);
        ctx.lineTo(a1[0] - ux * 4 - uy * 3.5, a1[1] - uy * 4 + ux * 3.5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  drawEarth(ctx) {
    const c = this.toPx(0, 0), R = 3 * this.sc;
    ctx.fillStyle = 'rgba(31,78,156,0.08)';
    ctx.beginPath(); ctx.arc(c[0], c[1], R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(23,20,15,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(23,20,15,0.3)';
    ctx.beginPath(); ctx.moveTo(c[0] - R, c[1]); ctx.lineTo(c[0] + R, c[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c[0], c[1] - R - 16); ctx.lineTo(c[0], c[1] + R + 16); ctx.stroke();
    ctx.setLineDash([]);
    drawLabel(ctx, 'Nord géographique', c[0], c[1] - R - 22, { align: 'center' });
    drawLabel(ctx, 'Sud géographique', c[0], c[1] + R + 34, { align: 'center' });
  }
  drawMagnets(ctx) {
    for (let k = 0; k < this.mags.length; k++) {
      const m = this.mags[k], c = this.toPx(m.x, m.y), s = this.sc;
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.rotate(-m.a);
      if (m.kind === 'u') {
        ctx.strokeStyle = '#6B655B';
        ctx.lineWidth = 0.72 * s;
        ctx.beginPath();
        ctx.moveTo(1.0 * s, -0.95 * s);
        ctx.lineTo(-0.25 * s, -0.95 * s);
        ctx.arc(-0.25 * s, 0, 0.95 * s, -Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(1.0 * s, 0.95 * s);
        ctx.stroke();
        ctx.fillStyle = PAL.red;
        ctx.fillRect(1.0 * s, -1.31 * s, 0.75 * s, 0.72 * s);
        ctx.fillStyle = PAL.blue;
        ctx.fillRect(1.0 * s, 0.59 * s, 0.75 * s, 0.72 * s);
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1.0 * s, -1.31 * s, 0.75 * s, 0.72 * s);
        ctx.strokeRect(1.0 * s, 0.59 * s, 0.75 * s, 0.72 * s);
        ctx.fillStyle = '#fff';
        ctx.font = fnt(Math.max(10, 0.45 * s), 800, FONTD);
        ctx.textAlign = 'center';
        ctx.fillText('N', 1.37 * s, -0.8 * s);
        ctx.fillText('S', 1.37 * s, 1.1 * s);
      } else {
        const L = m.L * s, w = m.w * s;
        ctx.fillStyle = PAL.red;
        ctx.fillRect(0, -w / 2, L / 2, w);
        ctx.fillStyle = PAL.blue;
        ctx.fillRect(-L / 2, -w / 2, L / 2, w);
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(-L / 2, -w / 2, L, w);
        ctx.fillStyle = '#fff';
        if (L > 60) {
          ctx.font = fnt(Math.max(11, Math.min(22, w * 0.55)), 800, FONTD);
          ctx.textAlign = 'center';
          ctx.fillText('N', L / 4, w * 0.2);
          ctx.fillText('S', -L / 4, w * 0.2);
        } else {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-L * 0.3, 0); ctx.lineTo(L * 0.3, 0);
          ctx.moveTo(L * 0.3, 0); ctx.lineTo(L * 0.12, -w * 0.18);
          ctx.moveTo(L * 0.3, 0); ctx.lineTo(L * 0.12, w * 0.18);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  drawProbe(ctx) {
    const h = this.hover, tmp = [0, 0];
    if (this.inside(h[0], h[1])) return;
    const b = this.field(h[0], h[1], tmp), p = this.toPx(h[0], h[1]);
    ctx.fillStyle = 'rgba(251,248,242,0.92)';
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p[0], p[1], 23, 0, TAU); ctx.fill(); ctx.stroke();
    drawNeedle(ctx, p[0], p[1], Math.atan2(tmp[1], tmp[0]), 18, 4.6);
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, TAU); ctx.fill();
    drawLabel(ctx, this.fmtB(b * this.kT), p[0] + 28, p[1] - 12);
  }
  drawRealCompass(ctx, W, H) {
    const x = 48, y = H - 52, r = 30;
    ctx.fillStyle = PAL.card;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    drawNeedle(ctx, x, y, Math.PI / 2 + Sensors.heading * DEG, r - 6, 5);
    drawLabel(ctx, 'nord réel', x - 26, y - r - 10);
  }
  pointer(type, x, y) {
    const w = this.toW(x, y);
    if (type === 'down') {
      const k = this.hit(w[0], w[1]);
      this.hover = w;
      if (k >= 0) {
        const m = this.mags[k], l = this.local(m, w[0], w[1]);
        const rot = m.kind === 'earth' || (m.kind === 'bar' && Math.abs(l[0]) > m.L * 0.28 && m.L > 2);
        this.grab = { k: k, rot: rot, ox: w[0] - m.x, oy: w[1] - m.y, a0: m.a - Math.atan2(w[1] - m.y, w[0] - m.x) };
        this.idle = 0;
      }
    } else if (type === 'move' || type === 'hover') {
      this.hover = w;
      if (this.grab && type === 'move') {
        const m = this.mags[this.grab.k];
        if (this.grab.rot) m.a = Math.atan2(w[1] - m.y, w[0] - m.x) + this.grab.a0;
        else {
          const lim = this.W / (2 * this.sc) - 1, limy = this.H / (2 * this.sc) - 0.6;
          m.x = clamp(w[0] - this.grab.ox, -lim, lim);
          m.y = clamp(w[1] - this.grab.oy, -limy, limy);
        }
        this.dirty = true;
        this.idle = 0;
        this.haptic();
      }
    } else if (type === 'up') {
      this.grab = null;
    } else if (type === 'leave') {
      this.grab = null;
      this.hover = null;
    }
  }
  haptic() {
    if (this.hero || this.mags.length < 2) return;
    this.poles();
    const P = this.P, per = 3;
    let dOpp = Infinity, dSame = Infinity;
    for (let a = 0; a < P.length; a += per) {
      for (let b = a + per; b < P.length; b += per) {
        if (Math.floor(a / (2 * per)) === Math.floor(b / (2 * per))) continue;
        const d = Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1]);
        if (P[a + 2] * P[b + 2] < 0) dOpp = Math.min(dOpp, d); else dSame = Math.min(dSame, d);
      }
    }
    const lv = dOpp < 0.9 ? 3 : (dOpp < 1.5 ? 2 : (dOpp < 2.3 ? 1 : 0));
    const rp = dSame < 1.5 ? 1 : 0, now = performance.now();
    if (lv > (this.hapLv || 0) && now - (this.hapT || 0) > 220) {
      this.hapT = now;
      if (lv === 3) { this.host.buzz([70, 40, 110]); this.host.click(1); }
      else this.host.buzz(lv === 2 ? 40 : 18);
    } else if (rp && !this.hapRp && now - (this.hapT || 0) > 220) {
      this.hapT = now;
      this.host.buzz([12, 50, 12, 50, 12]);
    }
    this.hapLv = lv;
    this.hapRp = rp;
  }
  onParam(id, v) {
    if (id === 'scene') this.setScene(v);
    if (id === 'disp') this.linesDirty = true;
  }
  action(id) {
    if (id === 'tap') { this.fil = null; this.host.click(0.6); }
    else if (id === 'flip') { this.mags[0].a += Math.PI; this.dirty = true; }
    else if (id === 'add') {
      if (this.mags.length >= 4 || this.earth) { this.host.toast('Maximum atteint pour cette scène'); return; }
      this.mags.push({ x: (this.rnd() - 0.5) * 6, y: (this.rnd() - 0.5) * 4, a: this.rnd() * TAU, L: 3, w: 0.9, q: 0.8, kind: 'bar' });
      this.dirty = true;
    } else if (id === 'reset') this.setScene(this.p.scene);
  }
  hud() {
    const o = this.obs;
    return [
      ['Champ au curseur', o.Bh === null ? 'promène le doigt' : this.fmtB(o.Bh), 'hot'],
      ['Comparé à la Terre', o.Bh === null ? '—' : '× ' + sciStr(o.Bh / 47e-6, 0)],
      ['Aimants', String(this.mags.length)],
      ['Astuce', 'milieu : déplacer · bout : tourner']
    ];
  }
  drawPlots(p1, p2) {
    const pr = this.prof;
    if (!pr) return;
    const unit = this.earth ? 'µT' : 'mT';
    let ymax = 0;
    for (let i = 0; i < pr.b.length; i++) if (pr.b[i] > ymax) ymax = pr.b[i];
    p1.begin('Champ sur l’axe, depuis le pôle Nord (' + unit + ')', 0, 12, 0, ymax * 1.08 || 1, 'distance au pôle N (cm)', unit);
    p1.clip();
    p1.line(pr.r, pr.b, PAL.red, 2.4);
    p1.unclip();
    const lx = [], ly = [];
    for (let i = 0; i < pr.r.length; i++) {
      if (pr.b[i] <= 0) continue;
      lx.push(Math.log10(pr.r[i]));
      ly.push(Math.log10(pr.b[i]));
    }
    if (lx.length < 2) return;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < ly.length; i++) { lo = Math.min(lo, ly[i]); hi = Math.max(hi, ly[i]); }
    p2.begin('Même courbe, échelle log : la pente dit tout', -0.6, 1.1, lo - 0.3, hi + 0.3, 'log₁₀ distance (cm)', 'log₁₀ B');
    p2.clip();
    const x0 = lx[0], y0 = ly[0], xe = lx[lx.length - 1], ye = ly[ly.length - 1];
    p2.line([x0, x0 + 0.9], [y0, y0 - 1.8], PAL.ink3, 1.4, true);
    p2.line([xe - 1.0, xe], [ye + 3.0, ye], PAL.gold, 1.4, true);
    p2.line(lx, ly, PAL.red, 2.4);
    p2.unclip();
    p2.text('pente −2 (près du pôle)', p2.X(x0 + 0.1), p2.Y(y0 - 0.05) + 16, PAL.ink3);
    p2.text('pente −3 (dipôle, loin)', p2.X(xe) - 4, p2.Y(ye + 0.4), PAL.gold, 'right');
  }
}

class MagnetoSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.view = { yaw: -0.5, pitch: 0.5 };
    this.trail = [];
    this.h = { t: [], b: [], x: [], y: [], z: [] };
    this.vec = [0, 20.6, -42.2];
    this.Bm = 47;
    this.src = 'virtuel';
    this.acc = 0;
    this.stable = 0;
    this.maxB = 0;
    this.obs = {};
  }
  timeInfo() { return 'Temps réel'; }
  drag(dx, dy) {
    this.view.yaw -= dx * 0.008;
    this.view.pitch = clamp(this.view.pitch + dy * 0.008, -1.4, 1.4);
  }
  earthVec(hd) {
    const h = hd * DEG, Bh = 20.6, Bv = 42.2;
    return [-Bh * Math.sin(h), Bh * Math.cos(h), -Bv];
  }
  action(id) {
    const self = this;
    if (id === 'sensors') Sensors.start().then(function () { self.host.toast(Sensors.label()); });
    else if (id === 'zero') {
      this.h = { t: [], b: [], x: [], y: [], z: [] };
      this.maxB = 0;
      this.trail = [];
    }
  }
  update(dtReal) {
    this.t += dtReal;
    const S = Sensors, p = this.p;
    let v, src;
    if (p.src !== 'virt' && S.hasMag && S.B) {
      v = S.B.slice();
      src = 'magnétomètre';
    } else if (p.src !== 'virt' && S.real && S.heading !== null) {
      v = this.earthVec(S.heading);
      const k = 1 + 40 * S.magnet;
      v = [v[0] * k, v[1] * k, v[2] * k];
      src = 'boussole du téléphone';
    } else {
      v = this.earthVec(p.head);
      if (p.magOn) v[0] += 2e4 / Math.pow(p.dist, 3);
      src = 'virtuel';
    }
    this.vec = v;
    this.src = src;
    this.Bm = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    this.maxB = Math.max(this.maxB, this.Bm);
    this.acc += dtReal;
    if (this.acc > 0.05) {
      this.acc = 0;
      const h = this.h;
      h.t.push(this.t); h.b.push(this.Bm); h.x.push(v[0]); h.y.push(v[1]); h.z.push(v[2]);
      while (h.t.length && this.t - h.t[0] > 30) { h.t.shift(); h.b.shift(); h.x.shift(); h.y.shift(); h.z.shift(); }
      const n = 1 / (this.Bm || 1);
      this.trail.push([v[0] * n, v[1] * n, v[2] * n]);
      if (this.trail.length > 200) this.trail.shift();
    }
    const earthLike = this.Bm > 22 && this.Bm < 70;
    this.stable = (src === 'magnétomètre' && earthLike) ? this.stable + dtReal : 0;
    const hd = src === 'virtuel' ? p.head : S.heading;
    this.heading = hd;
    this.obs = { real: src === 'magnétomètre', compass: src !== 'virtuel', B: this.Bm, maxB: this.maxB, heading: hd, earthOK: this.stable > 2 };
  }
  draw(ctx, W, H) {
    const n = 1 / (this.Bm || 1), m = [this.vec[0] * n, this.vec[1] * n, this.vec[2] * n];
    const wide = W > H * 1.15;
    const sw = wide ? W * 0.56 : W, sh = wide ? H : H * 0.6;
    drawSphere(ctx, sw, sh, this.view, { m: m, trail: this.trail, mLabel: 'B' });
    ctx.fillStyle = PAL.ink3;
    ctx.font = fnt(11, 400);
    ctx.textAlign = 'center';
    ctx.fillText('repère du téléphone : x → droite · y → haut de l’écran · z → vers toi', sw / 2, sh - 8);
    if (wide) this.drawGauge(ctx, W * 0.58, 18, W * 0.4, H - 36);
    else this.drawGauge(ctx, 14, sh + 4, W - 28, H - sh - 14);
  }
  drawGauge(ctx, x, y, w, h) {
    drawCard(ctx, x, y, w, h);
    const pad = 14, S = Sensors;
    const rc = Math.max(18, Math.min(h * 0.26, w * 0.17));
    const cx = x + w - pad - rc, cy = y + pad + rc + 4;
    ctx.fillStyle = PAL.ink3;
    ctx.font = fnt(11, 700);
    ctx.textAlign = 'left';
    ctx.fillText('CHAMP · ' + this.src.toUpperCase(), x + pad, y + pad + 8);
    const fs = Math.max(20, Math.min(44, h * 0.2));
    const big = this.Bm >= 1000 ? frNum(this.Bm / 1000, 2) + ' mT' : frNum(this.Bm, 1) + ' µT';
    ctx.fillStyle = PAL.ink;
    ctx.font = fnt(fs, 800, FONTD);
    ctx.fillText(big, x + pad, y + pad + 14 + fs);
    ctx.fillStyle = PAL.ink2;
    ctx.font = fnt(12, 400);
    ctx.fillText('= ' + frNum(this.Bm / 47, 1) + ' × le champ terrestre', x + pad, y + pad + 34 + fs);
    ctx.fillStyle = PAL.card;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rc, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.ink3;
    ctx.font = fnt(10, 700);
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - rc + 11);
    if (this.heading !== null && this.heading !== undefined) {
      drawNeedle(ctx, cx, cy, Math.PI / 2 + this.heading * DEG, rc - 8, Math.max(3, rc * 0.14));
    } else {
      ctx.fillStyle = PAL.ink3;
      ctx.font = fnt(18, 800, FONTD);
      ctx.fillText('?', cx, cy + 6);
    }
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, TAU); ctx.fill();
    const bx = x + pad, bw = w - 2 * pad, by = y + h - 50;
    if (by < cy + rc + 8) return;
    const pos = function (v) { return bx + bw * clamp(Math.log10(Math.max(v, 1)) / 6, 0, 1); };
    ctx.fillStyle = 'rgba(23,20,15,0.08)';
    ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(bx, by, pos(this.Bm) - bx, 10);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 10);
    const marks = [[47, 'Terre'], [1000, '1 mT'], [10000, 'aimant de frigo'], [400000, 'néodyme']];
    ctx.font = fnt(10, 700);
    for (let i = 0; i < marks.length; i++) {
      const px = pos(marks[i][0]);
      ctx.beginPath(); ctx.moveTo(px, by - 3); ctx.lineTo(px, by + 13); ctx.stroke();
      ctx.fillStyle = PAL.ink2;
      ctx.textAlign = i === marks.length - 1 ? 'right' : 'center';
      ctx.fillText(marks[i][1], i === marks.length - 1 ? Math.min(px + 20, bx + bw) : px, by + 26);
    }
    ctx.fillStyle = PAL.ink3;
    ctx.textAlign = 'left';
    ctx.fillText('1 µT', bx, by - 6);
    ctx.textAlign = 'right';
    ctx.fillText('1 T', bx + bw, by - 6);
    if (S.state().magnet > 0.3 || this.Bm > 200) drawLabel(ctx, 'Aimant détecté !', x + pad, by - 14, { col: '#fff', bg: PAL.red, bd: PAL.red });
  }
  hud() {
    const o = this.obs, S = Sensors;
    const inc = Math.atan2(-this.vec[2], Math.sqrt(this.vec[0] * this.vec[0] + this.vec[1] * this.vec[1])) / DEG;
    const det = S.state().magnet > 0.3 || this.Bm > 200;
    const caps = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const hd = o.heading;
    return [
      ['|B|', (this.Bm >= 1000 ? frNum(this.Bm / 1000, 2) + ' mT' : frNum(this.Bm, 1) + ' µT') + (this.src === 'boussole du téléphone' ? ' (estimé)' : ''), 'hot'],
      ['Comparé à la Terre', '× ' + frNum(this.Bm / 47, 1)],
      ['Cap (nord = 0°)', hd === null || hd === undefined ? '—' : frNum(hd, 0) + '° ' + caps[Math.round(hd / 45) % 8]],
      ['Inclinaison du champ', frNum(inc, 0) + '°'],
      ['Source', this.src, this.src === 'magnétomètre' ? 'good' : ''],
      ['Aimant détecté ?', det ? 'OUI' : 'non', det ? 'bad' : '']
    ];
  }
  drawPlots(p1, p2) {
    const h = this.h, tl = h.t.length ? h.t[h.t.length - 1] : 30, t0 = tl - 30, ts = h.t.map(function (v) { return v - t0; });
    const lb = h.b.map(function (v) { return Math.log10(Math.max(v, 0.1)); });
    p1.begin('|B| sur 30 s (échelle log, en µT)', 0, 30, 0, 5, 'temps (s)', 'log₁₀ B');
    p1.hline(Math.log10(47), PAL.leaf, true, 'Terre');
    p1.clip();
    p1.line(ts, lb, PAL.red, 2.2);
    p1.unclip();
    let lim = 60;
    for (let i = 0; i < h.t.length; i++) lim = Math.max(lim, Math.abs(h.x[i]), Math.abs(h.y[i]), Math.abs(h.z[i]));
    lim *= 1.15;
    p2.begin('Composantes du champ (µT)', 0, 30, -lim, lim, 'temps (s)', 'µT');
    p2.clip();
    p2.line(ts, h.x, PAL.x, 2);
    p2.line(ts, h.y, PAL.y, 2);
    p2.line(ts, h.z, PAL.z, 2);
    p2.unclip();
    p2.legend([{ col: PAL.x, label: 'Bx' }, { col: PAL.y, label: 'By' }, { col: PAL.z, label: 'Bz' }]);
  }
}

const CURIE_TC = 2 / Math.log(1 + Math.SQRT2);

class CurieSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.N = 128;
    this.n = 16384;
    this.s = new Int8Array(this.n);
    this.cv = document.createElement('canvas');
    this.cv.width = this.N; this.cv.height = this.N;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(this.N, this.N);
    this.u32 = new Uint32Array(this.img.data.buffer);
    this.r = xorshift(12345);
    this.acc = new Float64Array(10);
    this.cUp = packRGB(215, 48, 31);
    this.cDn = packRGB(31, 78, 156);
    this.extraT = 0;
    this.bins = new Float64Array(80);
    this.binN = new Float64Array(80);
    this.Tstamp = 0;
    this.lastT = null;
    this.anneal = null;
    this.annealDone = false;
    this.wasMag = false;
    this.crit = 0;
    this.shakeMax = 0;
    this.M = 1;
    this.init('up');
  }
  timeInfo() { return 'Temps Monte-Carlo (pas d’horloge réelle)'; }
  Teff() { return clamp(this.p.T + this.extraT, 0.05, 8); }
  init(kind) {
    const s = this.s, r = this.r;
    for (let i = 0; i < this.n; i++) s[i] = kind === 'up' ? 1 : ((r() & 1) ? 1 : -1);
    this.sweeps = 0;
    this.hist = { t: [], m: [], a: [] };
    this.M = this.mag();
    this.Tstamp = 0;
  }
  mag() {
    let m = 0;
    for (let i = 0; i < this.n; i++) m += this.s[i];
    return m / this.n;
  }
  celsius(T) {
    const tc = { fe: 1043, ni: 627, gd: 293, nd: 585 }[this.p.mat] || 1043;
    return T / CURIE_TC * tc - 273.15;
  }
  update(dtReal, speed) {
    const p = this.p;
    if (this.anneal) {
      this.anneal.k += dtReal / 22;
      const T = 3.6 - 3.0 * Math.min(1, this.anneal.k);
      p.T = T;
      this.host.setParamUI('T', T);
      if (this.anneal.k >= 1) { this.anneal = null; this.annealDone = true; }
    }
    this.extraT *= Math.exp(-dtReal / 1.5);
    if (this.extraT < 0.01) this.extraT = 0;
    const T = this.Teff(), h = p.h;
    if (this.lastT === null || Math.abs(T - this.lastT) > 0.04) { this.lastT = T; this.Tstamp = 0; } else this.Tstamp += dtReal;
    const acc = this.acc;
    for (let si = 0; si < 2; si++) {
      const sv = si === 0 ? -1 : 1;
      for (let k = 0; k < 5; k++) {
        const dE = 2 * sv * ((2 * k - 4) + h);
        acc[si * 5 + k] = dE <= 0 ? 1 : Math.exp(-dE / T);
      }
    }
    const s = this.s, r = this.r;
    const nsw = Math.max(1, Math.round(p.speed * speed));
    const tot = nsw * 16384;
    for (let k = 0; k < tot; k++) {
      const i = r() & 16383;
      const x = i & 127, y = i >> 7;
      const sum = s[(y << 7) | ((x + 1) & 127)] + s[(y << 7) | ((x + 127) & 127)] + s[(((y + 1) & 127) << 7) | x] + s[(((y + 127) & 127) << 7) | x];
      const si = s[i];
      const a = acc[(si > 0 ? 5 : 0) + ((sum + 4) >> 1)];
      if (a >= 1 || r() < a * 4294967296) s[i] = -si;
    }
    this.sweeps += nsw;
    const M = this.mag(), A = Math.abs(M);
    this.M = M;
    if (A > 0.8) this.wasMag = true;
    if (Math.abs(T - CURIE_TC) < 0.11) this.crit += dtReal;
    if (this.Tstamp > 0.8) {
      const b = Math.min(79, Math.floor(T * 10));
      this.bins[b] += A;
      this.binN[b] += 1;
    }
    const hs = this.hist;
    hs.t.push(this.sweeps); hs.m.push(M); hs.a.push(A);
    if (hs.t.length > 500) { hs.t.shift(); hs.m.shift(); hs.a.shift(); }
    this.obs = { T: T, A: A, wasMag: this.wasMag, annealDone: this.annealDone, crit: this.crit, shakeMax: this.shakeMax };
  }
  onParam(id) {
    if (id === 'T') this.anneal = null;
  }
  action(id) {
    if (id === 'up') this.init('up');
    else if (id === 'random') this.init('random');
    else if (id === 'anneal') { this.init('random'); this.anneal = { k: 0 }; this.annealDone = false; }
    else if (id === 'heat') { this.anneal = null; this.p.T = 4; this.host.setParamUI('T', 4); }
    else if (id === 'quench') { this.anneal = null; this.init('random'); this.p.T = 1.2; this.host.setParamUI('T', 1.2); }
    else if (id === 'reset') { this.bins.fill(0); this.binN.fill(0); this.init('up'); }
  }
  draw(ctx, W, H, guided = false) {
    const s = this.s, u = this.u32, cu = this.cUp, cd = this.cDn;
    for (let i = 0; i < this.n; i++) u[i] = s[i] > 0 ? cu : cd;
    this.cx.putImageData(this.img, 0, 0);
    const side = Math.max(60, Math.min(W - 130, H - 28)), x0 = Math.max(10, (W - 100 - side) / 2), y0 = (H - side) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, x0, y0, side, side);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, side + 1, side + 1);
    this.drawThermo(ctx, x0 + side + 46, y0 + 6, side - 40, guided);
    if (this.extraT > 0.15) drawLabel(ctx, 'Secousse = chaleur ! +' + frNum(this.extraT, 1), x0 + 10, y0 + 26, { col: '#fff', bg: PAL.red, bd: PAL.red });
    if (this.anneal) drawLabel(ctx, 'Refroidissement lent…', x0 + 10, y0 + side - 12);
  }
  drawThermo(ctx, x, y, h, guided) {
    const T = this.Teff(), f = clamp(T / 5, 0, 1), w = 18;
    ctx.fillStyle = PAL.card;
    roundRect(ctx, x - w / 2, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const g = ctx.createLinearGradient(0, y + h, 0, y);
    // Aimantarium : pas de vert dans la charte, même dans la Découverte.
    g.addColorStop(0, PAL.blue);
    g.addColorStop(0.5, '#8E4A8C');
    g.addColorStop(1, PAL.red);
    ctx.fillStyle = g;
    const fh = Math.max(4, f * (h - 6));
    roundRect(ctx, x - w / 2 + 3, y + h - 3 - fh, w - 6, fh, 5);
    ctx.fill();
    const yc = y + h - 3 - (CURIE_TC / 5) * (h - 6);
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, yc); ctx.lineTo(x + w / 2 + 8, yc); ctx.stroke();
    ctx.fillStyle = PAL.ink;
    ctx.font = fnt(11, 800);
    ctx.textAlign = 'right';
    ctx.fillText(guided ? 'Curie' : 'T_C', x - w / 2 - 10, yc + 4);
    ctx.textAlign = 'center';
    ctx.font = fnt(12, 700);
    ctx.fillText(guided ? frNum(T, 1) : frNum(this.celsius(T), 0) + ' °C', x, y + h + 18);
    ctx.font = fnt(10, 400);
    ctx.fillStyle = PAL.ink3;
    ctx.fillText('chaud', x, y - 6);
  }
  hud() {
    const T = this.Teff(), r = T / CURIE_TC;
    const mat = { fe: 'fer', ni: 'nickel', gd: 'gadolinium', nd: 'néodyme-fer-bore' }[this.p.mat] || 'fer';
    const ph = r < 0.93 ? 'aimant (ferro)' : (r < 1.07 ? 'critique !' : 'désordonné (para)');
    return [
      ['Température', frNum(T, 2) + '  (T/T_C = ' + frNum(r, 2) + ')', 'hot'],
      ['Équivalent ' + mat, '≈ ' + frNum(this.celsius(T), 0) + ' °C'],
      ['Aimantation M', frNum(this.M, 2), Math.abs(this.M) > 0.8 ? 'good' : ''],
      ['Phase', ph, (r >= 0.93 && r < 1.07) ? 'bad' : ''],
      ['Balayages Monte-Carlo', frNum(this.sweeps, 0)]
    ];
  }
  drawPlots(p1, p2) {
    const h = this.hist, x0 = h.t.length ? h.t[0] : 0, x1 = h.t.length > 1 ? h.t[h.t.length - 1] : x0 + 1;
    p1.begin('Aimantation au fil des balayages', x0, x1, -1.05, 1.05, 'balayages Monte-Carlo', 'M');
    p1.clip();
    p1.line(h.t, h.a, PAL.ink3, 1.5);
    p1.line(h.t, h.m, PAL.red, 2.2);
    p1.unclip();
    p1.legend([{ col: PAL.red, label: 'M' }, { col: PAL.ink3, label: '|M|' }]);
    p2.begin('Courbe M(T) : la transition de phase', 0, 5, 0, 1.05, 'température (unités J/k_B)', '|M|');
    const ox = [], oy = [];
    for (let T = 0.1; T < CURIE_TC; T += 0.02) { ox.push(T); oy.push(Math.pow(Math.max(0, 1 - Math.pow(Math.sinh(2 / T), -4)), 0.125)); }
    ox.push(CURIE_TC); oy.push(0); ox.push(5); oy.push(0);
    p2.clip();
    p2.line(ox, oy, PAL.ink3, 1.6, true);
    const bx = [], by = [];
    for (let b = 0; b < 80; b++) if (this.binN[b] > 5) { bx.push((b + 0.5) / 10); by.push(this.bins[b] / this.binN[b]); }
    p2.dots(bx, by, PAL.red, 3.5);
    p2.dot(this.Teff(), Math.abs(this.M), PAL.ink, 5);
    p2.unclip();
    p2.vline(CURIE_TC, PAL.gold, true, 'T_C');
    p2.text('pointillé : solution exacte d’Onsager (1944)', p2.box.l + 8, p2.box.t + p2.ph - 8, PAL.ink3);
  }
}

class BarkhausenSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.N = 96;
    this.n = 9216;
    const N = this.N, n = this.n;
    this.s = new Int8Array(n);
    this.hr = new Float32Array(n);
    this.fl = new Float32Array(n);
    this.q = new Int32Array(n);
    this.nbr = new Int32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const x = i % N, y = (i - x) / N;
      this.nbr[4 * i] = y * N + (x + 1) % N;
      this.nbr[4 * i + 1] = y * N + (x + N - 1) % N;
      this.nbr[4 * i + 2] = ((y + 1) % N) * N + x;
      this.nbr[4 * i + 3] = ((y + N - 1) % N) * N + x;
    }
    this.cv = document.createElement('canvas');
    this.cv.width = N; this.cv.height = N;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(N, N);
    this.u32 = new Uint32Array(this.img.data.buffer);
    this.u = uni(xorshift(777));
    this.build();
  }
  timeInfo() { return 'Champ balayé lentement (quasi-statique)'; }
  build() {
    const R = this.p.R;
    for (let i = 0; i < this.n; i++) this.hr[i] = R * gauss(this.u);
    this.reset();
  }
  reset() {
    this.s.fill(-1);
    this.Hmax = 3.5 + 1.2 * this.p.R;
    this.H = -this.Hmax;
    this.dir = 1;
    this.sum = -this.n;
    this.M = -1;
    this.loopH = [];
    this.loopM = [];
    this.bins = new Float64Array(16);
    this.nAv = 0;
    this.maxAv = 0;
    this.last = 0;
    this.half = { c: 0, m: 0 };
    this.lastHalf = null;
    this.snap = false;
    this.fl.fill(0);
    this.obs = {};
  }
  locf(i) {
    const nb = this.nbr, s = this.s, k = 4 * i;
    return s[nb[k]] + s[nb[k + 1]] + s[nb[k + 2]] + s[nb[k + 3]] + this.hr[i] + this.H;
  }
  aval(seed, d) {
    const s = this.s, q = this.q, fl = this.fl, nb = this.nbr;
    s[seed] = d;
    fl[seed] = 1;
    q[0] = seed;
    let head = 0, tail = 1;
    while (head < tail) {
      const k = 4 * q[head++];
      for (let e = 0; e < 4; e++) {
        const j = nb[k + e];
        if (s[j] === -d && d * this.locf(j) > 0) {
          s[j] = d;
          fl[j] = 1;
          q[tail++] = j;
        }
      }
    }
    return tail;
  }
  rampTo(Hn, out) {
    if (Hn === this.H) return;
    const d = Hn > this.H ? 1 : -1, s = this.s;
    this.H = Hn;
    this.dir = d;
    for (let i = 0; i < this.n; i++) {
      if (s[i] === -d && d * this.locf(i) > 0) {
        const sz = this.aval(i, d);
        this.sum += 2 * d * sz;
        out.push(sz);
      }
    }
    this.loopH.push(this.H);
    this.loopM.push(this.sum / this.n);
    if (this.loopH.length > 9000) { this.loopH.splice(0, 1500); this.loopM.splice(0, 1500); }
  }
  record(sz) {
    this.nAv++;
    this.last = sz;
    if (sz > this.maxAv) this.maxAv = sz;
    this.bins[Math.min(15, Math.floor(Math.log2(sz)))]++;
    this.half.c++;
    if (sz > this.half.m) this.half.m = sz;
    if (sz > this.n / 2) this.snap = true;
  }
  halfDone() {
    this.lastHalf = this.half;
    this.half = { c: 0, m: 0 };
  }
  update(dtReal, speed) {
    const p = this.p, out = [], step = 0.004;
    if (p.auto) {
      const dH = p.rate * 0.55 * dtReal * speed;
      const nsub = Math.min(80, Math.max(1, Math.ceil(dH / step)));
      const hs = dH / nsub;
      for (let k = 0; k < nsub; k++) {
        const Hn = this.H + this.dir * hs;
        if (Hn >= this.Hmax) { this.rampTo(this.Hmax, out); this.dir = -1; this.halfDone(); break; }
        if (Hn <= -this.Hmax) { this.rampTo(-this.Hmax, out); this.dir = 1; this.halfDone(); break; }
        this.rampTo(Hn, out);
      }
      p.H = this.H;
      this.host.setParamUI('H', this.H);
    } else {
      const tgt = clamp(p.H, -this.Hmax, this.Hmax);
      let k = 0;
      while (k < 80 && Math.abs(tgt - this.H) > 1e-9) {
        const st = clamp(tgt - this.H, -step, step);
        this.rampTo(this.H + st, out);
        k++;
      }
    }
    if (out.length) {
      for (let i = 0; i < out.length; i++) this.record(out[i]);
      const top = out.slice().sort(function (a, b) { return b - a; }).slice(0, 6);
      for (let i = 0; i < top.length; i++) this.host.click(clamp(0.1 + 0.25 * Math.log10(top[i] + 1), 0, 1));
      if (top[0] > 300) this.host.buzz(Math.min(120, 20 + top[0] / 40));
    }
    const fl = this.fl;
    for (let i = 0; i < this.n; i++) fl[i] *= 0.9;
    this.M = this.sum / this.n;
    const lh = this.lastHalf;
    this.obs = {
      snap: this.snap,
      crackle: !!(lh && lh.c >= 200),
      smooth: !!(lh && lh.c >= 60 && lh.m <= 20),
      maxAv: this.maxAv
    };
  }
  onParam(id) {
    if (id === 'R') this.build();
    if (id === 'H' && this.p.auto) {
      this.p.auto = false;
      this.host.setParamUI('auto', false);
    }
  }
  action(id) {
    if (id === 'newdis') this.build();
    else if (id === 'reset') this.reset();
  }
  draw(ctx, W, H) {
    const s = this.s, fl = this.fl, u = this.u32;
    for (let i = 0; i < this.n; i++) {
      let r, g, b;
      if (s[i] > 0) { r = 215; g = 48; b = 31; } else { r = 31; g = 78; b = 156; }
      const f = fl[i];
      if (f > 0.03) { r += (242 - r) * f; g += (188 - g) * f; b += (36 - b) * f; }
      u[i] = packRGB(r | 0, g | 0, b | 0);
    }
    this.cx.putImageData(this.img, 0, 0);
    const side = Math.max(60, Math.min(W - 24, H - 24)), x0 = (W - side) / 2, y0 = (H - side) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, x0, y0, side, side);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, side + 1, side + 1);
    drawLabel(ctx, 'H = ' + frNum(this.H, 2) + (this.dir > 0 ? '  ↑' : '  ↓'), x0 + 10, y0 + 26);
    if (!Snd.on) drawLabel(ctx, 'Active le son (en haut) pour entendre craquer', x0 + 10, y0 + side - 12, { col: PAL.ink2 });
  }
  hud() {
    const lh = this.lastHalf, hm = lh ? lh.m : this.half.m;
    let reg = '—';
    if (this.nAv > 20) reg = hm > this.n / 2 ? 'claquement géant (snap)' : (hm > 40 ? 'craquements (crackle)' : 'petits « pops »');
    return [
      ['Champ H', frNum(this.H, 2), 'hot'],
      ['Aimantation M', frNum(this.M, 2)],
      ['Dernière avalanche', this.last + ' spins'],
      ['Record', this.maxAv + ' spins'],
      ['Régime', reg]
    ];
  }
  drawPlots(p1, p2) {
    p1.begin('Cycle d’hystérésis M(H) : un escalier', -this.Hmax, this.Hmax, -1.08, 1.08, 'champ H', 'M');
    p1.clip();
    p1.line(this.loopH, this.loopM, PAL.ink, 1.6);
    p1.dot(this.H, this.M, PAL.red, 5);
    p1.unclip();
    const xs = [], ys = [];
    for (let b = 0; b < 16; b++) {
      if (this.bins[b] <= 0) continue;
      const S = Math.pow(2, b) * 1.5, w = Math.pow(2, b);
      xs.push(Math.log10(S));
      ys.push(Math.log10(this.bins[b] / w / Math.max(1, this.nAv)));
    }
    let lo = -6;
    for (let i = 0; i < ys.length; i++) lo = Math.min(lo, ys[i]);
    p2.begin('Tailles des avalanches (log-log)', 0, 4.2, lo - 0.3, 0.3, 'log₁₀ taille (spins)', 'log₁₀ fréquence');
    p2.clip();
    if (xs.length) p2.line([xs[0], xs[0] + 3], [ys[0], ys[0] - 4.5], PAL.gold, 1.4, true);
    p2.dots(xs, ys, PAL.red, 4);
    p2.unclip();
    p2.text('pointillé : loi de puissance, pente −3/2', p2.box.l + 8, p2.box.t + p2.ph - 8, PAL.gold);
  }
}

const DISK_MAT = {
  hdd: { K: 3.5e5, Ms: 4e5, Tc: 700, h: 12e-9, d: 9, name: 'CoCrPt (disque dur)' },
  card: { K: 1.6e4, Ms: 3e5, Tc: 850, h: 40e-9, d: 30, name: 'oxyde de fer (carte)' },
  hamr: { K: 4.5e6, Ms: 1e6, Tc: 750, h: 10e-9, d: 4, name: 'FePt (HAMR)' }
};
const DISK_CLOCK = { rt: [1, '1 s ici = 1 s'], min: [60, '1 s ici = 1 min'], day: [86400, '1 s ici = 1 jour'], year: [3.156e7, '1 s ici = 1 an'], kyear: [3.156e10, '1 s ici = 1 000 ans'] };
const HEAD_T = 2.0;

class DiskSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.G = 5;
    this.ng = 480;
    this.s = new Int8Array(this.ng);
    this.df = new Float64Array(this.ng);
    this.u = uni(xorshift(4242));
    for (let i = 0; i < this.ng; i++) {
      this.df[i] = Math.exp(0.08 * gauss(this.u));
      this.s[i] = this.u() < 0.5 ? 1 : -1;
    }
    this.gx = new Float64Array(this.ng);
    this.gy = new Float64Array(this.ng);
    this.ref = null;
    this.simT = 0;
    this.writing = null;
    this.heatT = 0;
    this.mag = null;
    this.extraHeat = 0;
    this.phoneB = 0;
    this.magUsed = false;
    this.wrote = false;
    this.writeOk = false;
    this.laserAtWrite = false;
    this.rec = { t: [], c: [] };
    this.recAcc = 0;
    this.correct = 0;
    this.bits = [];
    this.chars = [];
    this.text = '';
    this.writeWord(this.p.word, true);
    this.read();
    this.obs = {};
  }
  M() { return DISK_MAT[this.p.mat] || DISK_MAT.hdd; }
  red(Tk) {
    const tc = this.M().Tc;
    if (Tk >= tc) return 0;
    return Math.pow(1 - Tk / tc, 0.4) / Math.pow(1 - 300 / tc, 0.4);
  }
  Kof(Tk) { return this.M().K * Math.pow(this.red(Tk), 3); }
  HKof(Tk) { const m = this.M(), r = this.red(Tk); return 2 * m.K / m.Ms * r * r; }
  vol(i) { const m = this.M(), d = this.p.d * 1e-9 * this.df[i]; return Math.PI / 4 * d * d * m.h; }
  Tk() { return this.p.T + 273.15 + this.extraHeat + (this.heatT > 0 ? 300 : 0); }
  timeInfo() { return this.writing ? 'Écriture en cours (temps réel)' : (DISK_CLOCK[this.p.clock] || DISK_CLOCK.year)[1]; }
  bitsOf(word) {
    let w = String(word || '');
    if (w.normalize) w = w.normalize('NFD').replace(/[̀-ͯ]/g, '');
    w = (w + '            ').slice(0, 12);
    const bits = [];
    for (let c = 0; c < 12; c++) {
      let code = w.charCodeAt(c);
      if (code > 126 || code < 32) code = 63;
      for (let b = 7; b >= 0; b--) bits.push((code >> b) & 1);
    }
    return bits;
  }
  canWrite() {
    const Tw = this.p.laser ? 0.97 * this.M().Tc : this.Tk();
    return this.HKof(Tw) < HEAD_T;
  }
  applyWrite(bits, a, b) {
    const ok = this.canWrite();
    if (!ok) return false;
    for (let k = a; k < b; k++) for (let g = 0; g < this.G; g++) this.s[k * this.G + g] = bits[k] ? 1 : -1;
    return true;
  }
  finishWrite(bits, fail) {
    this.ref = bits;
    this.wrote = true;
    this.writeOk = !fail;
    this.simT = 0;
    this.rec = { t: [], c: [] };
  }
  writeWord(word, instant) {
    const bits = this.bitsOf(word);
    this.magUsed = false;
    if (instant) {
      const ok = this.applyWrite(bits, 0, 96);
      this.finishWrite(bits, !ok);
    } else {
      this.writing = { pos: 0, bits: bits, fail: false };
      this.laserAtWrite = !!this.p.laser;
    }
  }
  read() {
    const G = this.G, bits = new Array(96);
    let correct = 0;
    for (let k = 0; k < 96; k++) {
      let sum = 0;
      for (let g = 0; g < G; g++) sum += this.s[k * G + g];
      bits[k] = sum > 0 ? 1 : 0;
      if (this.ref && bits[k] === this.ref[k]) correct++;
    }
    const chars = [];
    for (let c = 0; c < 12; c++) {
      let code = 0;
      for (let b = 0; b < 8; b++) code = (code << 1) | bits[c * 8 + b];
      chars.push(code);
    }
    this.bits = bits;
    this.chars = chars;
    this.correct = this.ref ? correct : 0;
    this.text = chars.map(function (c) { return (c >= 32 && c <= 126) ? String.fromCharCode(c) : '·'; }).join('');
  }
  update(dtReal, speed) {
    const p = this.p, clk = (DISK_CLOCK[p.clock] || DISK_CLOCK.year)[0];
    this.heatT -= dtReal;
    this.extraHeat *= Math.exp(-dtReal / 1.2);
    if (this.extraHeat < 0.5) this.extraHeat = 0;
    if (this.writing) {
      const w = this.writing, np = Math.min(96, w.pos + dtReal * 48);
      const a = Math.floor(w.pos), b = Math.floor(np);
      if (b > a && !this.applyWrite(w.bits, a, b)) w.fail = true;
      w.pos = np;
      this.laserAtWrite = !!p.laser;
      if (w.pos >= 96) {
        this.finishWrite(w.bits, w.fail);
        this.writing = null;
        if (w.fail) this.host.toast('Écriture impossible : μ₀H_K = ' + frNum(this.HKof(this.Tk()), 1) + ' T, plus que les 2 T de la tête. Allume le laser !');
        else { this.host.toast('Mot écrit ! Laisse maintenant passer le temps…'); this.host.sfx('flip'); }
      }
    }
    const dts = this.writing ? dtReal : dtReal * clk * speed;
    if (!this.writing) this.simT += dts;
    const Tk = this.Tk(), K = this.Kof(Tk), HK = this.HKof(Tk), kT = KB * Tk, Ms = this.M().Ms * this.red(Tk);
    const mg = this.mag, r0 = 46;
    let flips = 0;
    for (let i = 0; i < this.ng; i++) {
      let Bz = this.phoneB;
      if (mg && p.Bm > 0) {
        const dx = this.gx[i] - mg[0], dy = this.gy[i] - mg[1], q = 1 + (dx * dx + dy * dy) / (r0 * r0);
        Bz += p.Bm / (q * Math.sqrt(q));
      }
      const si = this.s[i];
      if (HK <= 1e-6) {
        const ns = this.u() < 0.5 ? 1 : -1;
        if (ns !== si) { this.s[i] = ns; flips++; }
        continue;
      }
      const al = si * Bz / HK;
      if (al <= -1) { this.s[i] = -si; flips++; continue; }
      const V = this.vol(i), x = K * V * (1 + al) * (1 + al) / kT;
      const pr = 1e9 * Math.exp(-Math.min(x, 700)) * dts;
      if (pr > 4) {
        const dE = 2 * Ms * V * Bz / kT, pu = 1 / (1 + Math.exp(-clamp(dE, -50, 50)));
        const ns = this.u() < pu ? 1 : -1;
        if (ns !== si) { this.s[i] = ns; flips++; }
      } else if (pr > 1e-12 && this.u() < 1 - Math.exp(-pr)) {
        this.s[i] = -si;
        flips++;
      }
    }
    if ((mg && p.Bm > 0.05) || this.phoneB > 0.05) this.magUsed = true;
    for (let k = 0; k < Math.min(4, flips); k++) this.host.click(0.12 + 0.1 * Math.random());
    this.read();
    this.recAcc += dtReal;
    if (this.recAcc > 0.2 && this.wrote && !this.writing) {
      this.recAcc = 0;
      this.rec.t.push(Math.log10(Math.max(1, this.simT)));
      this.rec.c.push(this.correct / 96);
      if (this.rec.t.length > 800) { this.rec.t.shift(); this.rec.c.shift(); }
    }
    this.obs = { wrote: this.wrote, ok: this.writeOk, correct: this.correct, simT: this.simT, mat: p.mat, laser: this.laserAtWrite, magUsed: this.magUsed, hot: p.T > 60 };
  }
  onParam(id, v) {
    if (id === 'mat') {
      const m = DISK_MAT[v] || DISK_MAT.hdd;
      this.p.d = m.d;
      this.host.setParamUI('d', m.d);
    }
  }
  action(id) {
    if (id === 'write') {
      if (this.writing) return;
      this.writeWord(this.p.word, false);
    } else if (id === 'heat') {
      this.heatT = 2;
    } else if (id === 'wipe') {
      for (let i = 0; i < this.ng; i++) this.s[i] = this.u() < 0.5 ? 1 : -1;
      this.ref = null;
      this.wrote = false;
      this.writeOk = false;
      this.writing = null;
    }
  }
  pointer(type, x, y) {
    if (type === 'down' || type === 'move') this.mag = [x, y];
    else if (type === 'up' || type === 'leave') this.mag = null;
  }
  medianDelta(Tk) {
    const K = this.Kof(Tk), kT = KB * Tk, arr = [];
    for (let i = 0; i < this.ng; i += 4) arr.push(K * this.vol(i) / kT);
    arr.sort(function (a, b) { return a - b; });
    return arr[arr.length >> 1];
  }
  draw(ctx, W, H) {
    const padX = 16, top = 46, rows = 4, perRow = 120, sw = (W - 2 * padX) / perRow;
    const rowH = (H - top - 10) / rows, gh = clamp(rowH * 0.34, 9, 40), fs = clamp(rowH * 0.3, 12, 30);
    drawLabel(ctx, 'Grains de ' + frNum(this.p.d, 1) + ' nm · ' + this.M().name + ' · ' + frNum(this.Tk() - 273.15, 0) + ' °C', padX, 28);
    if (!this.mag) drawLabel(ctx, 'glisse le doigt = aimant', W - padX, 28, { align: 'right', col: PAL.ink3 });
    for (let r = 0; r < rows; r++) {
      const y0 = top + r * rowH, yc = y0 + gh / 2 + 4;
      ctx.fillStyle = 'rgba(23,20,15,0.06)';
      ctx.fillRect(padX, y0, W - 2 * padX, gh + 8);
      for (let k = 0; k < perRow; k++) {
        const i = r * perRow + k, cx = padX + (k + 0.5) * sw;
        this.gx[i] = cx;
        this.gy[i] = yc;
        const w = Math.min(sw * 0.94, sw * 0.8 * this.df[i]), hh = gh * clamp(0.75 * this.df[i], 0.4, 1);
        ctx.fillStyle = this.s[i] > 0 ? PAL.red : PAL.blue;
        ctx.fillRect(cx - w / 2, yc - hh / 2, w, hh);
      }
      ctx.strokeStyle = 'rgba(23,20,15,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let b = 0; b <= 24; b++) {
        const x = padX + b * 5 * sw, big = b % 8 === 0;
        ctx.moveTo(x, y0 + (big ? -3 : 2));
        ctx.lineTo(x, y0 + gh + (big ? 12 : 6));
      }
      ctx.stroke();
      for (let c = 0; c < 3; c++) {
        const ci = r * 3 + c, cx = padX + (c * 40 + 20) * sw, ch = this.chars[ci];
        let ok = true;
        if (this.ref) for (let j = 0; j < 8; j++) if (this.bits[ci * 8 + j] !== this.ref[ci * 8 + j]) ok = false;
        const txt = (ch >= 32 && ch <= 126) ? String.fromCharCode(ch) : '·';
        ctx.font = fnt(fs, 800, FONTD);
        ctx.textAlign = 'center';
        ctx.fillStyle = ok ? PAL.ink : PAL.red;
        ctx.fillText(txt === ' ' ? '␣' : txt, cx, y0 + gh + 12 + fs);
        if (rowH > 92) {
          ctx.font = fnt(9.5, 400, MONO);
          ctx.fillStyle = PAL.ink3;
          ctx.fillText(this.bits.slice(ci * 8, ci * 8 + 8).join(''), cx, y0 + gh + 28 + fs);
        }
      }
    }
    if (this.writing) {
      const k = Math.min(95, Math.floor(this.writing.pos)), r = Math.floor(k / 24), x = padX + ((k % 24) * 5 + 2.5) * sw, y = top + r * rowH;
      if (this.p.laser) {
        ctx.fillStyle = 'rgba(242,188,36,0.45)';
        ctx.beginPath(); ctx.arc(x, y + gh / 2 + 4, 16, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = PAL.ink;
      roundRect(ctx, x - 12, y - 20, 24, 15, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = fnt(9, 800);
      ctx.textAlign = 'center';
      ctx.fillText('tête', x, y - 9);
    }
    if (this.mag) {
      ctx.strokeStyle = PAL.red;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.mag[0], this.mag[1], 46, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = PAL.red;
      ctx.beginPath(); ctx.arc(this.mag[0], this.mag[1], 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = fnt(14, 800, FONTD);
      ctx.textAlign = 'center';
      ctx.fillText('N', this.mag[0], this.mag[1] + 5);
    }
  }
  hud() {
    const Tk = this.Tk(), HK = this.HKof(this.p.laser ? 0.97 * this.M().Tc : Tk), med = this.medianDelta(Tk), cw = this.canWrite();
    return [
      ['Mot lu', '« ' + this.text.replace(/\s+$/, '') + ' »', 'hot'],
      ['Bits corrects', this.ref ? this.correct + ' / 96' : '—', this.correct === 96 ? 'good' : (this.ref && this.correct < 70 ? 'bad' : '')],
      ['Temps écoulé', fmtSpan(this.simT)],
      ['Barrière médiane KV/k_BT', frNum(med, 0), med >= 60 ? 'good' : (med < 40 ? 'bad' : '')],
      ['Écriture (tête 2 T)', cw ? 'possible' + (this.p.laser ? ' (laser)' : '') : 'impossible : μ₀H_K = ' + frNum(HK, 1) + ' T', cw ? 'good' : 'bad'],
      ['Température', frNum(Tk - 273.15, 0) + ' °C']
    ];
  }
  drawPlots(p1, p2) {
    p1.begin('Bits corrects au fil du temps', 0, 12, 0, 1.05, 'log₁₀ du temps écoulé (s)', 'fraction');
    p1.vline(Math.log10(86400), PAL.ink3, true, '1 j');
    p1.vline(Math.log10(3.156e7), PAL.ink3, true, '1 an');
    p1.vline(Math.log10(3.156e10), PAL.ink3, true, '1000 ans');
    p1.hline(0.5, PAL.ink3, true, 'hasard');
    p1.clip();
    p1.line(this.rec.t, this.rec.c, PAL.red, 2.4);
    p1.unclip();
    const Tk = this.Tk(), K = this.Kof(Tk), kT = KB * Tk, ds = [];
    let dmax = 0;
    for (let i = 0; i < this.ng; i++) { const d = K * this.vol(i) / kT; ds.push(d); if (d > dmax) dmax = d; }
    const xmax = clamp(Math.ceil(dmax / 50) * 50, 200, 3000), bw = xmax / 40, bins = new Float64Array(40);
    for (let i = 0; i < ds.length; i++) bins[Math.min(39, Math.floor(ds[i] / bw))]++;
    let mx = 1;
    for (let b = 0; b < 40; b++) mx = Math.max(mx, bins[b]);
    p2.begin('Barrières d’énergie des grains', 0, xmax, 0, mx * 1.15, 'KV / k_BT', 'grains');
    const ctx = p2.ctx;
    for (let b = 0; b < 40; b++) {
      if (!bins[b]) continue;
      const x0 = b * bw, c = x0 < 37 ? PAL.red : (x0 < 60 ? PAL.gold : PAL.leaf);
      ctx.fillStyle = c;
      ctx.fillRect(p2.X(x0) + 1, p2.Y(bins[b]), Math.max(1, p2.X(x0 + bw) - p2.X(x0) - 2), p2.Y(0) - p2.Y(bins[b]));
    }
    p2.vline(37.4, PAL.red, true, '1 an');
    p2.vline(60, PAL.leaf, true, 'règle : 60');
  }
}

// ===== modes/engine_base.js =====
class EngineSim extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.eng = null;
    this.fv = null;
    this.timeScale = 1e-9;
    this.budget = 11;
    this.relaxMode = false;
    this.relaxSteps = 0;
    this.torque = 0;
    this.flashes = [];
    this.heat = null;
    this.Tc = 0;
    this.stepRate = 0;
  }

  build(g, terms, dyn, T) {
    const e = new Engine(g);
    e.Tc = this.Tc || 0;
    e.setup(terms, dyn, T);
    this.eng = e;
    this.fv = new FilmView(g.nx, g.ny);
    this.heat = null;
    return e;
  }

  preStep() {}
  beforeFrame() {}
  afterFrame() {}

  update(dtReal, speed) {
    const e = this.eng;
    if (!e) return;
    this.beforeFrame(dtReal);
    const t0 = performance.now();
    let k = 0;
    if (this.relaxMode) {
      while (k < 2000 && performance.now() - t0 < this.budget) { this.preStep(0); e.relax(2); k += 2; }
      this.relaxSteps += k;
    } else {
      const target = this.timeScale * speed * dtReal;
      let done = 0;
      while (done < target && performance.now() - t0 < this.budget) {
        this.preStep(e.dt);
        e.step(e.dt);
        done += e.dt;
        k++;
      }
    }
    this.stepRate = k / Math.max(dtReal, 1e-3);
    this.t = e.t;
    this.torque = e.maxTorque();
    this.afterFrame(dtReal);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].a -= dtReal * 1.8;
      if (this.flashes[i].a <= 0) this.flashes.splice(i, 1);
    }
  }

  converged() { return this.torque < 2e-4; }

  fire(x, y, w, dT, tau) {
    const e = this.eng;
    if (!e) return;
    e.laser(x, y, w, dT, tau);
    this.flashes.push({ x: x, y: y, w: w, a: 1 });
    this.host.sfx('laser');
  }

  cellAt(px, py) {
    const L = this.fv.lay, e = this.eng;
    const i = (px - L.x0) / L.s, j = e.ny - (py - L.y0) / L.s;
    if (i < 0 || j < 0 || i >= e.nx || j >= e.ny) return null;
    return [i, j];
  }

  drawHeat(ctx) {
    const e = this.eng;
    if (!e || !e.hot) return;
    const nx = e.nx, ny = e.ny;
    if (!this.heat) {
      const c = document.createElement('canvas');
      c.width = nx; c.height = ny;
      this.heat = { c: c, x: c.getContext('2d') };
      this.heat.img = this.heat.x.createImageData(nx, ny);
    }
    const d = this.heat.img.data, Tl = e.Tl, T0 = e.T, Tc = e.Tc > T0 ? e.Tc : T0 + 500;
    for (let j = 0; j < ny; j++) {
      const row = ny - 1 - j;
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, o = (row * nx + i) * 4, r = (Tl[id] - T0) / (Tc - T0);
        if (r < 0.03 || (e.mask && !e.mask[id])) { d[o + 3] = 0; continue; }
        const hot = r >= 1;
        d[o] = 255; d[o + 1] = hot ? 236 : Math.round(150 + 60 * r); d[o + 2] = hot ? 170 : 40;
        d[o + 3] = Math.round(255 * clamp(hot ? 0.62 : 0.5 * r, 0, 0.7));
      }
    }
    this.heat.x.putImageData(this.heat.img, 0, 0);
    const L = this.fv.lay;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.heat.c, L.x0, L.y0, nx * L.s, ny * L.s);
    ctx.restore();
  }

  drawFlashes(ctx) {
    const e = this.eng, L = this.fv.lay;
    for (let k = 0; k < this.flashes.length; k++) {
      const f = this.flashes[k], a = f.a;
      const x = L.x0 + f.x / e.c * L.s, y = L.y0 + (e.ny - f.y / e.c) * L.s, r = Math.max(14, 2.2 * f.w / e.c * L.s) * (1.6 - 0.6 * a);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,240,' + (0.95 * a).toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(255,214,90,' + (0.7 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(215,48,31,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(23,20,15,' + (0.5 * a).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, f.w / e.c * L.s, 0, TAU); ctx.stroke();
    }
  }

  baseLimits(extra) {
    const e = this.eng;
    if (!e) return [];
    const g = Object.assign({ c: e.c, dz: e.dz, Ms: e.Ms, nx: e.nx, ny: e.ny, px: e.px, py: e.py, T: e.T, Tc: e.Tc, dt: this.relaxMode ? 0 : e.dt }, extra);
    return physLimits(g);
  }
}

function grains(nx, ny, c, size, sigma, seed, px, py) {
  const rnd = uni(xorshift(seed)), n = nx * ny, out = new Float64Array(n);
  const gx = Math.max(1, Math.round(nx * c / size)), gy = Math.max(1, Math.round(ny * c / size));
  const cx = [], cy = [], val = [];
  for (let k = 0; k < gx * gy; k++) {
    const a = k % gx, b = (k - a) / gx;
    cx.push((a + rnd()) * nx / gx); cy.push((b + rnd()) * ny / gy);
    val.push(Math.max(0.05, 1 + sigma * gauss(rnd)));
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < cx.length; k++) {
        let dx = i + 0.5 - cx[k], dy = j + 0.5 - cy[k];
        if (px) dx -= nx * Math.round(dx / nx);
        if (py) dy -= ny * Math.round(dy / ny);
        const d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = k; }
      }
      out[j * nx + i] = val[best];
    }
  }
  return out;
}

function minorityStats(e, sign) {
  const nx = e.nx, ny = e.ny, n = e.n, mz = e.mz, mask = e.mask, px = e.px, py = e.py;
  const lab = new Int32Array(n).fill(-1), qx = new Int32Array(n), qy = new Int32Array(n), qi = new Int32Array(n);
  const comps = [];
  let area = 0, wall = 0;
  const minor = function (id) { return (!mask || mask[id]) && sign * mz[id] < 0; };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      if (mask && !mask[id]) continue;
      const a = minor(id);
      if (a) area++;
      if (i + 1 < nx || px) { const r = j * nx + ((i + 1) % nx); if ((!mask || mask[r]) && minor(r) !== a) wall++; }
      if (j + 1 < ny || py) { const u = ((j + 1) % ny) * nx + i; if ((!mask || mask[u]) && minor(u) !== a) wall++; }
    }
  }
  for (let s = 0; s < n; s++) {
    if (lab[s] >= 0 || !minor(s)) continue;
    const k = comps.length;
    let h = 0, tl = 0, cnt = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    lab[s] = k; qi[tl] = s; qx[tl] = s % nx; qy[tl] = (s - (s % nx)) / nx; tl++;
    while (h < tl) {
      const id = qi[h], ux = qx[h], uy = qy[h];
      h++;
      cnt++; sx += ux; sy += uy; sxx += ux * ux; syy += uy * uy; sxy += ux * uy;
      if (ux < x0) x0 = ux; if (ux > x1) x1 = ux; if (uy < y0) y0 = uy; if (uy > y1) y1 = uy;
      const i = id % nx, j = (id - i) / nx;
      const nb = [[i - 1, j, -1, 0], [i + 1, j, 1, 0], [i, j - 1, 0, -1], [i, j + 1, 0, 1]];
      for (let q = 0; q < 4; q++) {
        let a = nb[q][0], b = nb[q][1];
        if (a < 0) { if (!px) continue; a += nx; } else if (a >= nx) { if (!px) continue; a -= nx; }
        if (b < 0) { if (!py) continue; b += ny; } else if (b >= ny) { if (!py) continue; b -= ny; }
        const m = b * nx + a;
        if (lab[m] >= 0 || !minor(m)) continue;
        lab[m] = k; qi[tl] = m; qx[tl] = ux + nb[q][2]; qy[tl] = uy + nb[q][3]; tl++;
      }
    }
    const mx = sx / cnt, my = sy / cnt, vxx = sxx / cnt - mx * mx, vyy = syy / cnt - my * my, vxy = sxy / cnt - mx * my;
    const tr = vxx + vyy, det = vxx * vyy - vxy * vxy, dd = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + dd, l2 = Math.max(tr / 2 - dd, 1e-6);
    const span = (x1 - x0 + 1) >= nx || (y1 - y0 + 1) >= ny;
    const bubble = !span && cnt >= 3 && Math.sqrt(l1 / l2) < 1.9;
    comps.push({ n: cnt, bubble: bubble, cx: ((mx % nx) + nx) % nx, cy: ((my % ny) + ny) % ny });
  }
  let nb = 0, ns = 0, dsum = 0;
  for (let k = 0; k < comps.length; k++) {
    if (comps[k].bubble) { nb++; dsum += 2 * Math.sqrt(comps[k].n / Math.PI); } else if (comps[k].n >= 3) ns++;
  }
  return {
    area: area, wall: wall, comps: comps, nBub: nb, nStr: ns,
    w: wall > 0 ? 2 * area / wall * e.c : 0,
    dBub: nb ? dsum / nb * e.c : 0
  };
}

// ===== modes/pinning.js =====
const PIN_MAT = { Ms: 5.8e5, A: 1.5e-11, Ku: 4.5e5, dz: 1e-9, c: 4e-9, nx: 128, ny: 24 };
const PIN_X = [160e-9, 288e-9, 416e-9];

class PinningSim extends EngineSim {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 2e-9;
    this.seed = 7;
    this.rebuild();
  }

  keff() { return PIN_MAT.Ku - 0.5 * MU0 * PIN_MAT.Ms * PIN_MAT.Ms; }

  makeMask() {
    const g = PIN_MAT, W = g.ny * g.c, d = this.p.notch * 1e-9, m = new Uint8Array(g.nx * g.ny);
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const x = (i + 0.5) * g.c, y = (j + 0.5) * g.c;
        let keep = 1;
        for (let k = 0; k < PIN_X.length && d > 0; k++) {
          const depth = d - Math.abs(x - PIN_X[k]);
          if (depth > 0 && (y < depth || y > W - depth)) keep = 0;
        }
        m[j * g.nx + i] = keep;
      }
    }
    return m;
  }

  rebuild() {
    const g = PIN_MAT, p = this.p;
    this.zee = { kind: 'zeeman', H: [0, 0, p.Bz * 1e-3 / MU0], func: 'none' };
    const terms = [
      { kind: 'exchange', A: g.A },
      { kind: 'dmi', D: p.D * 1e-3, cls: 'Cnv_z' },
      { kind: 'uniaxial', K: this.keff(), u: [0, 0, 1] },
      this.zee
    ];
    const e = this.build({ nx: g.nx, ny: g.ny, c: g.c, dz: g.dz, Ms: g.Ms, mask: this.makeMask() }, terms, this.dyn(), p.T);
    if (p.dis > 0) e.setKmul(grains(g.nx, g.ny, g.c, 15e-9, p.dis / 100, this.seed, false, false));
    this.fv.noFrame = true;
    this.resetWall();
  }

  dyn() {
    const p = this.p;
    return { prec: true, gamma0: GAMMA0, alpha: p.alpha, edge: 0, zl: p.u ? { ux: p.u, uy: 0, beta: p.alpha } : null, sl: null };
  }

  resetWall(x0 = 64e-9) {
    const e = this.eng, g = PIN_MAT, dl = Math.sqrt(g.A / this.keff()), s = this.p.D >= 0 ? -1 : 1;
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const id = j * g.nx + i, x = (i + 0.5) * g.c, th = 2 * Math.atan(Math.exp((x - x0) / dl));
        e.mx[id] = s * Math.sin(th); e.my[id] = 0; e.mz[id] = Math.cos(th);
      }
    }
    e.t = 0;
    e.pulses = [];
    e.coolDown();
    this.t = 0;
    this.hist = newHist(1);
    this.path = { B: [], x: [] };
    this.dep = PIN_X.map(function () { return null; });
    this.dwell = PIN_X.map(function () { return 0; });
    this.xw = x0; this.v = 0; this.state = '';
    this.exited = false;
    this._lt = 0;
    this.depCurrent = false;
    this.pinnedAt = -1;
    this.measure();
  }

  onParam(id, v) {
    const p = this.p, e = this.eng;
    if (id === 'Bz') { this.zee.H[2] = v * 1e-3 / MU0; if (p.auto && !this._auto) { p.auto = false; this.host.setParamUI('auto', false); } return; }
    if (id === 'notch' || id === 'dis') { this.rebuild(); return; }
    if (id === 'D') { e.terms[1].D = v * 1e-3; e.prepare(); return; }
    if (id === 'alpha' || id === 'u') { e.dyn = this.dyn(); e.prepare(); return; }
    if (id === 'T') { e.T = v; return; }
  }

  action(id) {
    if (id === 'reset') this.resetWall();
    else if (id === 'zero') this.setB(0);
    else if (id === 'up' || id === 'down') this.setB(Math.round(this.p.Bz) + (id === 'up' ? 2 : -2));
    else if (id === 'newdis') { this.seed += 11; this.rebuild(); }
  }

  setB(v) {
    v = clamp(v, -150, 150);
    this.p.Bz = v;
    this.zee.H[2] = v * 1e-3 / MU0;
    this.host.setParamUI('Bz', v);
  }

  preStep(dt) {
    const p = this.p;
    if (p.auto && !this.exited) {
      this._auto = true;
      const v = Math.min(150, p.Bz + p.rate * dt * 1e9);
      p.Bz = v;
      this.zee.H[2] = v * 1e-3 / MU0;
      this._auto = false;
    }
  }

  wallX() {
    const e = this.eng, nx = e.nx, ny = e.ny, mz = e.mz, mask = e.mask, c = e.c;
    let s = 0, n = 0;
    for (let j = 0; j < ny; j++) {
      let prev = -1;
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i;
        if (mask && !mask[id]) continue;
        if (prev >= 0 && mz[prev] >= 0 && mz[id] < 0) {
          const a = mz[prev], b = mz[id], pi = prev % nx;
          const f = a / (a - b);
          s += (pi + 0.5 + f * (i - pi)) * c;
          n++;
          break;
        }
        prev = id;
      }
    }
    if (n) return s / n;
    return e.mean()[2] > 0 ? nx * c : 0;
  }

  measure() {
    const e = this.eng, x = this.wallX(), t = e.t;
    pushHist(this.hist, t, [x * 1e9], 900);
    const h = this.hist, n = h.t.length;
    let k = n - 1;
    while (k > 0 && h.t[n - 1] - h.t[k] < 0.2e-9) k--;
    const dts = h.t[n - 1] - h.t[k];
    this.v = dts > 0.05e-9 ? (h.v[0][n - 1] - h.v[0][k]) * 1e-9 / dts : 0;
    this.xw = x;
    const L = e.nx * e.c;
    this.exited = x >= L - 2e-9;
    this.pinnedAt = -1;
    for (let q = 0; q < PIN_X.length; q++) {
      const near = Math.abs(x - PIN_X[q]) < 28e-9;
      if (near && Math.abs(this.v) < 5) this.pinnedAt = q;
      if (this.dep[q] === null && x > PIN_X[q] + 30e-9) {
        this.dep[q] = this.dwell[q] > 0.25e-9 ? this.p.Bz : 'libre';
        if (this.dwell[q] > 0.25e-9 && Math.abs(this.p.Bz) < 1 && this.p.u > 0) this.depCurrent = true;
        if (this.dwell[q] > 0.25e-9) this.host.sfx('flip');
      }
    }
    if (this.exited) this.state = 'sortie à droite';
    else if (x <= 1e-9) this.state = 'sortie à gauche';
    else if (this.pinnedAt >= 0) this.state = 'accrochée à l’entaille ' + (this.pinnedAt + 1);
    else if (Math.abs(this.v) < 3) this.state = this.p.dis > 0 ? 'bloquée par le désordre' : 'immobile';
    else this.state = 'en mouvement';
    const pa = this.path;
    if (!pa.B.length || Math.abs(pa.B[pa.B.length - 1] - this.p.Bz) > 0.05 || Math.abs(pa.x[pa.x.length - 1] - x * 1e9) > 1) {
      pa.B.push(this.p.Bz); pa.x.push(x * 1e9);
      if (pa.B.length > 3000) { pa.B.shift(); pa.x.shift(); }
    }
  }

  afterFrame() {
    this.measure();
    if (this.pinnedAt >= 0) this.dwell[this.pinnedAt] += Math.max(0, this.eng.t - this._lt);
    this._lt = this.eng.t;
    if (this.p.auto) this.host.setParamUI('Bz', this.p.Bz);
    const dc = this.dep.filter(function (v) { return typeof v === 'number'; }).length;
    this.obs = { pinnedAt: this.pinnedAt, B: this.p.Bz, depCount: dc, exited: this.exited, depCurrent: this.depCurrent, v: this.v };
  }

  hud() {
    const dp = this.dep.map(function (v) { return v === null ? '—' : (v === 'libre' ? 'passée' : frNum(v, 0)); }).join(' · ');
    return [
      ['Champ B_z', frNum(this.p.Bz, 1) + ' mT', 'hot'],
      ['Position de la paroi', frNum(this.xw * 1e9, 0) + ' nm'],
      ['Vitesse', frNum(this.v, 0) + ' m/s'],
      ['État', this.state, this.pinnedAt >= 0 ? 'good' : ''],
      ['Décrochage (mT) 1 · 2 · 3', dp],
      ['Temps simulé', fmtTime(this.t)]
    ];
  }

  limits() {
    return this.baseLimits({ A: PIN_MAT.A, K: PIN_MAT.Ku, Ktype: 'uni', Kaxis: 'z', D: this.p.D * 1e-3, demag: true });
  }

  drawGrains(ctx, L) {
    const e = this.eng, km = e.kmul;
    if (!km || !(this.p.dis > 0)) { this.grainImg = null; return; }
    if (!this.grainImg || this.grainImg.km !== km) {
      const nx = e.nx, ny = e.ny, c = document.createElement('canvas');
      c.width = nx; c.height = ny;
      const x = c.getContext('2d'), img = x.createImageData(nx, ny), d = img.data;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const id = j * nx + i, o = ((ny - 1 - j) * nx + i) * 4;
          if (e.mask && !e.mask[id]) continue;
          const edge = (i + 1 < nx && km[id + 1] !== km[id]) || (j + 1 < ny && km[id + nx] !== km[id]);
          if (edge) { d[o] = 23; d[o + 1] = 20; d[o + 2] = 15; d[o + 3] = 120; }
          else if (km[id] < 0.92) { d[o] = 255; d[o + 1] = 214; d[o + 2] = 90; d[o + 3] = Math.round(clamp((1 - km[id]) * 260, 0, 150)); }
        }
      }
      x.putImageData(img, 0, 0);
      this.grainImg = { km: km, c: c };
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.grainImg.c, L.x0, L.y0, e.nx * L.s, e.ny * L.s);
    ctx.restore();
    drawLabel(ctx, 'traits fins : les grains · jaune : grains plus « mous » (K plus faible)', L.x0, L.y0 + e.ny * L.s + 44, {});
  }

  draw(ctx, W, H) {
    const e = this.eng;
    this.fv.paint(e, this.p.disp === 'wheel' ? 'wheel' : 'mz');
    const L = this.fv.draw(ctx, W, H, 26), s = L.s, Hh = e.ny * s;
    ctx.strokeStyle = 'rgba(23,20,15,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L.x0 - 0.5, L.y0 - 0.5, e.nx * s + 1, Hh + 1);
    ctx.font = fnt(12, 700);
    ctx.textAlign = 'center';
    for (let k = 0; k < PIN_X.length; k++) {
      const x = L.x0 + PIN_X[k] / e.c * s;
      ctx.fillStyle = this.dep[k] !== null ? PAL.ink3 : PAL.ink;
      ctx.fillText(String(k + 1), x, L.y0 - 8);
    }
    this.drawGrains(ctx, L);
    this.drawHeat(ctx);
    const xw = L.x0 + this.xw / e.c * s;
    ctx.strokeStyle = PAL.gold;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xw, L.y0 - 2); ctx.lineTo(xw, L.y0 + Hh + 2); ctx.stroke();
    ctx.setLineDash([]);
    const b = this.p.Bz;
    drawLabel(ctx, 'B = ' + frNum(b, 1) + ' mT ' + (b > 0.5 ? '⊙ (vers toi)' : (b < -0.5 ? '⊗ (s’éloigne)' : '')), L.x0, L.y0 + Hh + 24, {});
    if (this.p.u) drawLabel(ctx, 'électrons u = ' + frNum(this.p.u, 0) + ' m/s →', L.x0 + e.nx * s, L.y0 + Hh + 24, { align: 'right', col: PAL.teal });
    drawScaleBar(ctx, L.x0 + e.nx * s - 110, L.y0 - 10, 100e-9 / e.c * s, '100 nm');
  }

  drawPlots(p1, p2) {
    const e = this.eng, Lnm = e.nx * e.c * 1e9;
    drawSeries(p1, this.hist, [{ i: 0, col: PAL.gold, label: 'x paroi' }], 'Position de la paroi (nm)', 0, Lnm, 'x (nm)');
    for (let k = 0; k < PIN_X.length; k++) p1.hline(PIN_X[k] * 1e9, 'rgba(23,20,15,0.35)', true);
    const pa = this.path;
    let b0 = -10, b1 = 40;
    for (let i = 0; i < pa.B.length; i++) { b0 = Math.min(b0, pa.B[i]); b1 = Math.max(b1, pa.B[i]); }
    p2.begin('Position en fonction du champ', b0 - 2, b1 + 2, 0, Lnm, 'B (mT)', 'x (nm)');
    for (let k = 0; k < PIN_X.length; k++) p2.hline(PIN_X[k] * 1e9, 'rgba(23,20,15,0.35)', true, 'entaille ' + (k + 1));
    p2.clip();
    p2.line(pa.B, pa.x, PAL.blue, 2);
    for (let k = 0; k < PIN_X.length; k++) if (typeof this.dep[k] === 'number') p2.vline(this.dep[k], 'rgba(215,48,31,0.6)', true);
    if (pa.B.length) p2.dot(pa.B[pa.B.length - 1], pa.x[pa.x.length - 1], PAL.ink, 4);
    p2.unclip();
  }
}

// ===== modes/labyrinth.js =====
const LAB_MAT = { Ms: 1e6, A: 1e-11, dz: 1e-9, c: 4e-9, Tc: 600, alpha: 0.3 };

class LabySim extends EngineSim {
  constructor(host, d) {
    super(host, d);
    this.timeScale = 1e-9;
    this.Tc = LAB_MAT.Tc;
    this.seed = 3;
    this.rebuild();
  }

  rebuild() {
    const g = LAB_MAT, p = this.p, n = parseInt(p.res, 10) || 64;
    this.zee = { kind: 'zeeman', H: [0, 0, p.Bz * 1e-3 / MU0], func: 'none' };
    const terms = [
      { kind: 'exchange', A: g.A },
      { kind: 'dmi', D: p.D * 1e-3, cls: 'Cnv_z' },
      { kind: 'uniaxial', K: p.K * 1e3, u: [0, 0, 1] },
      { kind: 'demag' },
      this.zee
    ];
    this.build({ nx: n, ny: n, c: g.c, dz: g.dz, Ms: g.Ms, px: true, py: true }, terms, this.dyn(), p.drv === 'llg' ? p.T : 0);
    this.relaxMode = p.drv !== 'llg';
    this.fv.noFrame = false;
    this.pathReset();
    this.demag();
  }

  dyn() { return { prec: true, gamma0: GAMMA0, alpha: LAB_MAT.alpha, edge: 0, zl: null, sl: null }; }

  pathReset() {
    this.path = { B: [], mz: [], w: [], d: [], ph: [] };
    this.pending = true;
    this.since = 0;
    this.stat = null;
    this.phase = '';
    this.maxBub = 0;
    this.sawMaze = false;
  }

  demag() {
    const e = this.eng, r = uni(xorshift(this.seed++));
    for (let i = 0; i < e.n; i++) {
      const z = 2 * r() - 1, ph = TAU * r(), s = Math.sqrt(1 - z * z);
      e.mx[i] = s * Math.cos(ph); e.my[i] = s * Math.sin(ph); e.mz[i] = z;
    }
    e.t = 0;
    this.pending = true;
    this.since = 0;
  }

  saturate() {
    const e = this.eng;
    for (let i = 0; i < e.n; i++) { e.mx[i] = 0; e.my[i] = 0; e.mz[i] = 1; }
    this.pending = true;
    this.since = 0;
  }

  setB(v) {
    v = clamp(Math.round(v * 10) / 10, -400, 400);
    this.p.Bz = v;
    this.zee.H[2] = v * 1e-3 / MU0;
    this.host.setParamUI('Bz', v);
    this.pending = true;
    this.since = 0;
  }

  onParam(id, v) {
    const e = this.eng, p = this.p;
    if (id === 'Bz') { this.zee.H[2] = v * 1e-3 / MU0; this.pending = true; this.since = 0; return; }
    if (id === 'res') { this.rebuild(); return; }
    if (id === 'D') { e.terms[1].D = v * 1e-3; e.prepare(); this.pending = true; this.since = 0; return; }
    if (id === 'K') { e.terms[2].K = v * 1e3; e.prepare(); this.pending = true; this.since = 0; return; }
    if (id === 'drv') { this.relaxMode = v !== 'llg'; e.T = v === 'llg' ? p.T : 0; return; }
    if (id === 'T') { if (p.drv === 'llg') e.T = v; return; }
  }

  action(id) {
    const p = this.p;
    if (id === 'demag') this.demag();
    else if (id === 'sat') this.saturate();
    else if (id === 'up') this.setB(p.Bz + p.step);
    else if (id === 'down') this.setB(p.Bz - p.step);
    else if (id === 'zero') this.setB(0);
    else if (id === 'clear') this.pathReset();
    else if (id === 'flash') this.flashAt(this.eng.nx * this.eng.c / 2, this.eng.ny * this.eng.c / 2);
  }

  flashAt(x, y) {
    if (this.p.drv !== 'llg') {
      this.p.drv = 'llg';
      this.host.setParamUI('drv', 'llg');
      this.onParam('drv', 'llg');
      this.host.toast('Impulsion laser : passage en dynamique LLG (le temps doit avancer pour que ça refroidisse).');
    }
    this.fire(x, y, 40e-9, 900, 0.25e-9);
    this.pending = true;
  }

  pointer(kind, px, py) {
    if (kind !== 'down' || !this.fv) return;
    const q = this.cellAt(px, py);
    if (q) this.flashAt(q[0] * this.eng.c, q[1] * this.eng.c);
  }

  beforeFrame() {
    const p = this.p;
    if (!p.auto) return;
    const ready = this.relaxMode ? (this.torque < 1e-3 || this.since > 5000) : this.since > 180;
    if (ready && !this.pending && p.Bz + p.step <= p.Bmax + 1e-9) this.setB(p.Bz + p.step);
    else if (ready && !this.pending && p.Bz + p.step > p.Bmax) { p.auto = false; this.host.setParamUI('auto', false); this.host.toast('Balayage terminé.'); }
  }

  afterFrame() {
    const e = this.eng;
    this.since += this.relaxMode ? this.relaxSteps - (this._rs || 0) : 1;
    this._rs = this.relaxSteps;
    const m = e.mean(), sign = m[2] >= 0 ? 1 : -1, st = minorityStats(e, sign);
    this.mz = m[2];
    this.Q = e.topoCharge();
    this.stat = st;
    if (st.area === 0) this.phase = 'saturé';
    else if (st.nStr === 0 && st.nBub > 0) this.phase = 'bulles';
    else if (st.nBub === 0) this.phase = 'labyrinthe';
    else this.phase = 'bandes + bulles';
    if (this.phase === 'labyrinthe' && st.area > 0.15 * e.n) this.sawMaze = true;
    const ok = this.relaxMode ? (this.torque < 1e-3 || this.since > 5000) : this.since > 90;
    if (this.pending && ok) {
      const pa = this.path;
      pa.B.push(this.p.Bz); pa.mz.push(this.mz); pa.w.push(st.w * 1e9); pa.d.push(st.dBub * 1e9); pa.ph.push(this.phase);
      if (pa.B.length > 400) { for (const k in pa) pa[k].shift(); }
      this.pending = false;
      if (st.nBub > this.maxBub) this.maxBub = st.nBub;
    }
    if (this.p.auto) this.host.setParamUI('Bz', this.p.Bz);
    this.obs = { phase: this.phase, nBub: st.nBub, sawMaze: this.sawMaze, maxBub: this.maxBub, B: this.p.Bz, Q: this.Q, mz: this.mz, conv: !this.pending };
  }

  hud() {
    const st = this.stat || { w: 0, nBub: 0, nStr: 0, dBub: 0 };
    return [
      ['Champ B_z', frNum(this.p.Bz, 1) + ' mT', 'hot'],
      ['Structure', this.phase, this.phase === 'bulles' ? 'good' : ''],
      ['⟨m_z⟩', frNum(this.mz || 0, 2)],
      ['Largeur des bandes', st.w ? frNum(st.w * 1e9, 0) + ' nm' : '—'],
      ['Bulles', st.nBub + (st.nBub ? ' (Ø ' + frNum(st.dBub * 1e9, 0) + ' nm)' : '')],
      ['Charge topologique Q', frNum(this.Q || 0, 1)],
      [this.relaxMode ? 'Convergence |m×B|' : 'Temps simulé', this.relaxMode ? (this.pending ? frNum(this.torque * 1e3, 2) + ' mT…' : 'équilibre ✓') : fmtTime(this.t), this.relaxMode && !this.pending ? 'good' : '']
    ];
  }

  limits() {
    return this.baseLimits({ A: LAB_MAT.A, K: this.p.K * 1e3, Ktype: 'uni', Kaxis: 'z', D: this.p.D * 1e-3, demag: true });
  }

  draw(ctx, W, H) {
    const e = this.eng;
    this.fv.paint(e, this.p.disp === 'wheel' ? 'wheel' : 'mz');
    const L = this.fv.draw(ctx, W, H, 18);
    this.drawHeat(ctx);
    const st = this.stat;
    if (st && this.p.marks) {
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 2;
      for (let k = 0; k < st.comps.length; k++) {
        const c = st.comps[k];
        if (!c.bubble) continue;
        const r = Math.max(5, Math.sqrt(c.n / Math.PI) * L.s + 4), q = this.fv.px(c.cx + 0.5, c.cy + 0.5);
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, TAU); ctx.stroke();
      }
    }
    this.drawFlashes(ctx);
    drawScaleBar(ctx, L.x0 + 12, L.y0 + e.ny * L.s - 12, 100e-9 / e.c * L.s, '100 nm');
    drawLabel(ctx, 'B = ' + frNum(this.p.Bz, 0) + ' mT ⊙', L.x0 + 8, L.y0 + 22, {});
  }

  drawPlots(p1, p2) {
    const pa = this.path, cols = { 'labyrinthe': PAL.blue, 'bandes + bulles': PAL.plum, 'bulles': PAL.red, 'saturé': PAL.ink3 };
    let b0 = 0, b1 = 100;
    for (let i = 0; i < pa.B.length; i++) { b0 = Math.min(b0, pa.B[i]); b1 = Math.max(b1, pa.B[i]); }
    p1.begin('Aimantation à l’équilibre ⟨m_z⟩(B)', b0 - 5, b1 + 5, -1.05, 1.05, 'B (mT)', '⟨m_z⟩');
    p1.clip();
    p1.line(pa.B, pa.mz, 'rgba(23,20,15,0.35)', 1.2);
    for (let i = 0; i < pa.B.length; i++) p1.dot(pa.B[i], pa.mz[i], cols[pa.ph[i]] || PAL.ink, 4);
    p1.dot(this.p.Bz, this.mz || 0, PAL.gold, 3);
    p1.unclip();
    p1.legend([{ col: PAL.blue, label: 'labyrinthe' }, { col: PAL.plum, label: 'mélange' }, { col: PAL.red, label: 'bulles' }]);
    let hi = 40;
    for (let i = 0; i < pa.B.length; i++) hi = Math.max(hi, pa.w[i], pa.d[i]);
    p2.begin('Taille des domaines minoritaires', b0 - 5, b1 + 5, 0, hi * 1.15, 'B (mT)', 'nm');
    p2.clip();
    const bw = [], ww = [], bd = [], dd = [];
    for (let i = 0; i < pa.B.length; i++) {
      if (pa.w[i] > 0) { bw.push(pa.B[i]); ww.push(pa.w[i]); }
      if (pa.d[i] > 0) { bd.push(pa.B[i]); dd.push(pa.d[i]); }
    }
    p2.line(bw, ww, PAL.blue, 2);
    p2.dots(bd, dd, PAL.red, 4);
    p2.unclip();
    p2.legend([{ col: PAL.blue, label: 'largeur moyenne (2·aire/paroi)' }, { col: PAL.red, label: 'diamètre des bulles' }]);
  }
}

// ===== modes/sandbox.js =====
const MATS = {
  py: { name: 'Permalloy Ni₈₀Fe₂₀, vortex (Shinjo et al. 2000)', Ms: 800, A: 13, Ktype: 'uni', K: 0, Kaxis: 'z', Dtype: 'Cnv_z', D: 0, alpha: 0.15, Tc: 0, demag: true, geo: { shape: 'disk', Lx: 400, Ly: 400, tz: 40, cell: 5, bc: 'open', init: 'vortex', drv: 'relax', Bx: 0, By: 0, Bz: 0, disp: 'wheel' } },
  copt: { name: 'Co/Pt, skyrmion (Sampaio et al. 2013)', Ms: 580, A: 15, Ktype: 'uni', K: 800, Kaxis: 'z', Dtype: 'Cnv_z', D: 3, alpha: 0.3, Tc: 0, demag: true, geo: { shape: 'disk', Lx: 160, Ly: 160, tz: 1, cell: 2.5, bc: 'open', init: 'sky', drv: 'relax', Bx: 0, By: 0, Bz: 0, disp: 'mz' } },
  ircopt: { name: 'Ir/Co/Pt : textures de domaines, inspiré de Moreau-Luchaire 2016', Ms: 956, A: 10, Ktype: 'uni', K: 717, Kaxis: 'z', Dtype: 'Cnv_z', D: 1.9, alpha: 0.3, Tc: 0, demag: true, geo: { shape: 'rect', Lx: 256, Ly: 256, tz: 1, cell: 4, bc: 'pbc', init: 'maze', drv: 'relax', Bx: 0, By: 0, Bz: 0, disp: 'mz' } }
};

const SB_GEO = ['shape', 'Lx', 'Ly', 'tz', 'cell', 'bc'];
const SB_MATP = ['Ms', 'A', 'Ktype', 'K', 'Kaxis', 'Dtype', 'D', 'alpha', 'Tc', 'demag'];
const SB_TERM = ['Ms', 'A', 'Ktype', 'K', 'Kaxis', 'Dtype', 'D', 'alpha', 'Tc', 'T', 'demag', 'Bx', 'By', 'Bz', 'fun', 'bx', 'by', 'bz', 'f', 't0', 'tw'];
const TERM_FR = { exchange: 'Échange', dmi: 'DMI', uniaxial: 'Anisotropie', cubic: 'Anis. cubique', zeeman: 'Zeeman', demag: 'Démag' };

class SandboxSim extends EngineSim {
  constructor(host, d) {
    const k = MATS[d.mat] ? d.mat : 'copt';
    super(host, Object.assign({}, MATS[k], MATS[k].geo, d, { mat: k, T: 0, Tc: 0, drv: 'relax' }));
    this.timeScale = 1e-9;
    this.budget = 5;
    this.dirtyGeo = false;
    this.dirtyTerms = false;
    this.tooBig = false;
    this.seed = 1;
    this.rebuild();
  }

  axis() { return this.p.Kaxis === 'x' ? [1, 0, 0] : (this.p.Kaxis === 'y' ? [0, 1, 0] : [0, 0, 1]); }

  grid() {
    const p = this.p, c = p.cell * 1e-9;
    return { c: c, nx: Math.max(1, Math.round(p.Lx / p.cell)), ny: Math.max(1, Math.round(p.Ly / p.cell)), dz: p.tz * 1e-9, px: p.bc === 'pbc', py: p.bc === 'pbc' };
  }

  makeMask(g) {
    const sh = this.p.bc === 'pbc' ? 'rect' : this.p.shape;
    if (sh === 'rect') return null;
    const m = new Uint8Array(g.nx * g.ny), ax = g.nx / 2, ay = g.ny / 2;
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const u = (i + 0.5 - ax) / ax, v = (j + 0.5 - ay) / ay, r2 = u * u + v * v;
        let k = 1;
        if (sh === 'disk') k = r2 <= 1 ? 1 : 0;
        else if (sh === 'ring') k = r2 <= 1 && r2 >= 0.2 ? 1 : 0;
        else if (sh === 'notch') {
          const depth = 0.5 - Math.abs(u) * ax / ay * 0.5;
          k = depth > 0 && (v < -1 + depth || v > 1 - depth) ? 0 : 1;
        }
        m[j * g.nx + i] = k;
      }
    }
    return m;
  }

  terms() {
    const p = this.p;
    const t = [{ kind: 'exchange', A: p.A * 1e-12 }];
    if (p.D) t.push({ kind: 'dmi', D: p.D * 1e-3, cls: 'Cnv_z' });
    if (p.K) t.push({ kind: 'uniaxial', K: p.K * 1e3, u: [0, 0, 1] });
    if (p.demag) t.push({ kind: 'demag' });
    this.zs = { kind: 'zeeman', H: [0, 0, p.Bz * 1e-3 / MU0], func: 'none', name: 'Hdc' };
    t.push(this.zs);
    this.zd = null;
    return t;
  }

  dyn() { return { prec: true, gamma0: GAMMA0, alpha: this.p.alpha, edge: 0, zl: null, sl: null }; }

  rebuild() {
    const g = this.grid(), p = this.p;
    this.dirtyGeo = false;
    this.dirtyTerms = false;
    this.tooBig = g.nx * g.ny > 16384;
    this.gridNow = g;
    if (this.tooBig) {
      this.host.toast('Trop de cellules (' + frNum(g.nx * g.ny, 0) + '). Grossis la cellule ou réduis la taille.');
      if (this.eng) return;
      g.nx = Math.min(g.nx, 128); g.ny = Math.min(g.ny, 128);
    }
    this.Tc = 0;
    g.Ms = p.Ms * 1e3;
    g.mask = this.makeMask(g);
    this.build(g, this.terms(), this.dyn(), 0);
    this.relaxMode = true;
    this.initState();
  }

  retune() {
    const e = this.eng, p = this.p;
    this.dirtyTerms = false;
    if (!e) return;
    e.Ms = p.Ms * 1e3;
    e.Tc = 0;
    this.Tc = 0;
    e.setup(this.terms(), this.dyn(), 0);
  }

  initState() {
    const e = this.eng, p = this.p, nx = e.nx, ny = e.ny, c = e.c, cx = nx * c / 2, cy = ny * c / 2;
    const r = uni(xorshift(this.seed++)), A = p.A * 1e-12, D = Math.abs(p.D * 1e-3);
    const lam = D > 0 ? 4 * Math.PI * A / D : 50e-9, R = Math.min(nx, ny) * c / 6, w = Math.max(2 * c, R / 3);
    const sD = p.D >= 0 ? 1 : -1, bulk = p.Dtype === 'T';
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const id = j * nx + i, x = (i + 0.5) * c - cx, y = (j + 0.5) * c - cy, rr = Math.sqrt(x * x + y * y);
        let a = 0, b = 0, z = 1;
        if (p.init === 'ux') { a = 1; z = 0; }
        else if (p.init === 'rand') { z = 2 * r() - 1; const ph = TAU * r(), s = Math.sqrt(1 - z * z); a = s * Math.cos(ph); b = s * Math.sin(ph); }
        else if (p.init === 'vortex') {
          const core = Math.max(2 * c, 8e-9), pz = Math.exp(-rr * rr / (core * core)), s = Math.sqrt(1 - pz * pz);
          z = pz; if (rr > 0) { a = -y / rr * s; b = x / rr * s; }
        } else if (p.init === 'sky') {
          const th = 2 * Math.atan2(Math.sinh(R / w), Math.sinh(rr / w)), ph = Math.atan2(y, x) + (bulk ? Math.PI / 2 : 0) + (sD < 0 ? Math.PI : 0);
          a = Math.sin(th) * Math.cos(ph); b = Math.sin(th) * Math.sin(ph); z = Math.cos(th);
        } else if (p.init === 'stripes') { const q = TAU * x / lam; z = Math.cos(q); a = bulk ? 0 : Math.sin(q); b = bulk ? Math.sin(q) : 0; }
        else if (p.init === 'maze') {
          // Condition initiale en domaines courbes, analytique et reproductible.
          // Les courbes de niveau sont choisies pour donner une structure riche,
          // puis la dynamique réduit l'énergie du modèle micromagnétique.
          const q1 = TAU / 96e-9, q2 = TAU / 135e-9;
          const q3 = TAU / 90e-9, q4 = TAU / 140e-9, q5 = TAU / 170e-9;
          const v = q2*y + 0.9 * Math.sin(q4*x);
          const u = q1*x + 1.75 * Math.sin(v);
          const v2 = q3*y + 1.2 * Math.sin(q4*x);
          const w2 = q5*(x-y), cv = Math.cos(v), c4 = Math.cos(q4*x);
          const f = Math.sin(u) + 0.53*Math.cos(v2) + 0.4*Math.sin(w2);
          const ux = q1 + 1.75*cv*0.9*q4*c4, uy = 1.75*cv*q2;
          const gx = Math.cos(u)*ux - 0.53*Math.sin(v2)*1.2*q4*c4 + 0.4*Math.cos(w2)*q5;
          const gy = Math.cos(u)*uy - 0.53*Math.sin(v2)*q3 - 0.4*Math.cos(w2)*q5;
          const nm = Math.hypot(gx,gy)||1;
          z = Math.tanh(1.9*f);
          const inplane = Math.sqrt(Math.max(0,1-z*z));
          a = inplane * gx/nm * sD;
          b = inplane * gy/nm * sD;
        }
        else if (p.init === 'twodom') { const dl = Math.max(c, 3e-9), th = 2 * Math.atan(Math.exp(x / dl)); z = Math.cos(th); a = Math.sin(th); }
        e.mx[id] = a; e.my[id] = b; e.mz[id] = z;
      }
    }
    for (let i = 0; i < e.n; i++) {
      const nn = Math.sqrt(e.mx[i] * e.mx[i] + e.my[i] * e.my[i] + e.mz[i] * e.mz[i]) || 1;
      e.mx[i] /= nn; e.my[i] /= nn; e.mz[i] /= nn;
    }
    e.t = 0;
    e.pulses = [];
    e.coolDown();
    this.t = 0;
    this.relaxSteps = 0;
    this.hist = newHist(3);
    this.ehist = { x: [], v: [], names: [] };
    this.eStamp = 0;
    this.Q = 0;
    this.E = null;
    this.peakT = 0;
    this.brushed = false;
  }

  applyPreset(k) {
    const m = MATS[k];
    if (!m) return;
    const set = Object.assign({}, m, m.geo);
    delete set.geo; delete set.name;
    set.mat = k; set.T = 0; set.Tc = 0; set.drv = 'relax';
    Object.keys(set).forEach(function (q) { this.p[q] = set[q]; this.host.setParamUI(q, set[q]); }, this);
    this.rebuild();
    this.host.toast('Matériau : ' + m.name);
  }

  onParam(id, v) {
    if (id === 'mat') { this.applyPreset(v); return; }
    if (id === 'A' || id === 'K' || id === 'D' || id === 'Bz' || id === 'demag') this.dirtyTerms = true;
  }

  reset() { this.initState(); }

  action(id) {
    if (id === 'init' || id === 'reset') this.initState();
    else if (id === 'uniform') { this.p.init = 'uz'; this.initState(); }
    else if (id === 'seed') this.seedAt((this.eng.nx / 2) | 0, (this.eng.ny / 2) | 0);
  }

  // La brosse dessine une condition initiale, pas une nucléation laser ou courant.
  seedAt(ix, iy) {
    const e = this.eng, p = this.p;
    const x0 = (ix + 0.5) * e.c, y0 = (iy + 0.5) * e.c;
    const R = Math.max(5 * e.c, Math.min(34e-9, e.nx * e.c / 4)), sign = p.D < 0 ? -1 : 1;
    const mid = Math.min(e.ny - 1, Math.max(0, iy)) * e.nx + Math.min(e.nx - 1, Math.max(0, ix));
    const bg = e.mz[mid] < 0 ? -1 : 1;
    for (let j = 0; j < e.ny; j++) for (let i = 0; i < e.nx; i++) {
      const id = j * e.nx + i;
      if (e.mask && !e.mask[id]) continue;
      let x = (i + 0.5) * e.c - x0, y = (j + 0.5) * e.c - y0;
      if (e.px) x -= Math.round(x / (e.nx * e.c)) * e.nx * e.c;
      if (e.py) y -= Math.round(y / (e.ny * e.c)) * e.ny * e.c;
      const rr = Math.hypot(x, y);
      if (rr >= R) continue;
      if (p.mat === 'py') {
        const v = Math.max(0, 1 - rr / R), ang = 0.7 * Math.PI * v;
        const a = e.mx[id], b = e.my[id];
        e.mx[id] = Math.cos(ang) * a - Math.sin(ang) * b;
        e.my[id] = Math.sin(ang) * a + Math.cos(ang) * b;
      } else {
        const theta = Math.PI * (1 - rr / R), rad = rr > 1e-15 ? 1 / rr : 0;
        const xx = sign * bg * Math.sin(theta) * x * rad;
        const yy = sign * bg * Math.sin(theta) * y * rad;
        const zz = bg * Math.cos(theta);
        const a = Math.min(1, Math.max(0, (R - rr) / (2 * e.c)));
        e.mx[id] = e.mx[id] * (1 - a) + xx * a;
        e.my[id] = e.my[id] * (1 - a) + yy * a;
        e.mz[id] = e.mz[id] * (1 - a) + zz * a;
      }
      const norm = Math.hypot(e.mx[id], e.my[id], e.mz[id]) || 1;
      e.mx[id] /= norm; e.my[id] /= norm; e.mz[id] /= norm;
    }
    this.brushed = true;
  }

  pointer(kind, px, py) {
    if ((kind !== 'down' && kind !== 'move') || !this.fv || !this.eng) return;
    const q = this.cellAt(px, py);
    if (q) this.seedAt(Math.floor(q[0]), Math.floor(q[1]));
  }

  setPhoneB(bx, by) {
    // Pas de pilotage téléphone dans ce bac à sable : H est uniquement perpendiculaire.
  }

  beforeFrame() {
    if (this.dirtyGeo) this.rebuild();
    else if (this.dirtyTerms) this.retune();
  }

  afterFrame() {
    // Le bac à sable n'affiche aucune courbe ni énergie globale.
    // La texture est la sortie principale ; ne pas calculer les observables
    // coûteuses à chaque image améliore la fluidité des interactions.
    this.m = this.eng.mean();
    this.obs = { mz: this.m[2], brushed: !!this.brushed };
  }

  hud() {
    const m = this.m || [0, 0, 0], g = this.gridNow;
    const out = [
      ['⟨m⟩', '(' + frNum(m[0], 2) + ' ; ' + frNum(m[1], 2) + ' ; ' + frNum(m[2], 2) + ')', 'hot'],
      ['Charge topologique Q', frNum(this.Q, 2)],
      ['Énergie totale', this.E ? sciStr(this.E.total, 2) + ' J' : '—'],
      [this.relaxMode ? 'Convergence |m×B|' : 'Temps simulé', this.relaxMode ? frNum(this.torque * 1e3, 2) + ' mT' : fmtTime(this.t), this.relaxMode && this.torque < 1e-3 ? 'good' : ''],
      ['Maillage', this.eng.nx + ' × ' + this.eng.ny + ' × 1' + (this.tooBig ? ' (refusé : ' + g.nx + ' × ' + g.ny + ')' : ''), this.tooBig ? 'bad' : '']
    ];
    return out;
  }

  limits() {
    const p = this.p, g = this.grid();
    const rows = physLimits({ c: g.c, dz: g.dz, Ms: p.Ms * 1e3, A: p.A * 1e-12, K: p.K * 1e3, Ktype: p.Ktype, Kaxis: p.Kaxis, D: p.Dtype === 'none' ? 0 : p.D * 1e-3, demag: p.demag, nx: g.nx, ny: g.ny, px: g.px, py: g.py, T: 0, Tc: 0, dt: this.relaxMode || !this.eng ? 0 : this.eng.dt });
    if (p.shape !== 'rect' && p.bc === 'pbc') rows.push({ lab: 'Forme et périodicité', val: p.shape, rule: 'Bords périodiques : seule la forme rectangle a un sens. Rectangle utilisé.', lvl: 'warn', src: ['pbcub'] });
    return rows;
  }

  draw(ctx, W, H) {
    const e = this.eng, p = this.p;
    this.fv.paint(e, p.disp);
    const L = this.fv.draw(ctx, W, H, 22);
    if (p.arrows) drawArrowsOver(ctx, e, this.fv, Math.max(2, Math.round(Math.max(e.nx, e.ny) / 24)));
    const span = Math.max(e.nx, e.ny) * e.c, bar = niceStep(span / 4);
    drawScaleBar(ctx, L.x0 + 10, L.y0 + e.ny * L.s + 16, bar / e.c * L.s, frNum(bar * 1e9, 0) + ' nm');
    // La légende des couleurs est dans la fiche du preset, pas sur la texture.
    if (this.tooBig) drawLabel(ctx, 'Maillage refusé : trop de cellules', W / 2, L.y0 + 18, { align: 'center', col: PAL.red });
  }

  drawPlots(p1, p2) {
    const h = this.hist, xs = [], k = this.relaxMode ? 1e-3 : 1e9, xl = this.relaxMode ? 'itérations (milliers)' : 't (ns)';
    for (let i = 0; i < h.t.length; i++) xs.push(h.t[i] * k);
    const x0 = xs.length ? xs[0] : 0, x1 = xs.length > 1 ? Math.max(xs[xs.length - 1], x0 + 1e-6) : x0 + 1;
    p1.begin('Aimantation moyenne', x0, x1, -1.05, 1.05, xl, '⟨m⟩');
    p1.clip();
    p1.line(xs, h.v[0], PAL.red, 2); p1.line(xs, h.v[1], PAL.leaf, 2); p1.line(xs, h.v[2], PAL.blue, 2);
    p1.unclip();
    p1.legend([{ col: PAL.red, label: 'm_x' }, { col: PAL.leaf, label: 'm_y' }, { col: PAL.blue, label: 'm_z' }]);
    const eh = this.ehist, ex = [];
    for (let i = 0; i < eh.x.length; i++) ex.push(eh.x[i] * k);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < eh.v.length; i++) for (let q = 0; q < eh.v[i].length; q++) { lo = Math.min(lo, eh.v[i][q]); hi = Math.max(hi, eh.v[i][q]); }
    if (!(hi > lo)) { lo = -1; hi = 1; }
    const pad = (hi - lo) * 0.1;
    const e0 = ex.length ? ex[0] : 0, e1 = ex.length > 1 ? Math.max(ex[ex.length - 1], e0 + 1e-6) : e0 + 1;
    p2.begin('Énergies par terme (aJ)', e0, e1, lo - pad, hi + pad, xl, 'E (aJ)');
    p2.clip();
    const cols = [PAL.ink, PAL.plum, PAL.gold, PAL.teal, PAL.red, PAL.blue, PAL.leaf], defs = [];
    for (let q = 0; q < eh.names.length; q++) {
      const ys = eh.v.map(function (r) { return r[q]; });
      p2.line(ex, ys, cols[q % cols.length], 2);
      defs.push({ col: cols[q % cols.length], label: eh.names[q] });
    }
    p2.unclip();
    p2.legend(defs);
  }
}

// ===== catalogue/models.js =====
function flickOnce(sim, s) {
  if (sim._fl === undefined) { sim._fl = s.flickN; return false; }
  if (s.flickN !== sim._fl) { sim._fl = s.flickN; return true; }
  return false;
}

function phoneSet(sim, id, v, tol) {
  if (Math.abs(v - sim.p[id]) <= (tol || 0)) return false;
  sim.setParam(id, v);
  sim.host.setParamUI(id, v);
  return true;
}

const MODELS = [
  {
    id: 'limaille', name: 'La limaille de fer',
    params: [
      { id: 'scene', type: 'select', label: 'Scène', value: 'bar', options: [['bar', 'Un aimant droit'], ['attract', 'Deux aimants qui s’attirent'], ['repel', 'Deux aimants qui se repoussent'], ['horseshoe', 'Aimant en U'], ['halbach', 'Aimant de frigo (Halbach)'], ['earth', 'La Terre']], help: 'Chaque scène place de nouveaux aimants.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'filings', options: [['filings', 'Limaille'], ['compass', 'Boussoles'], ['lines', 'Lignes de champ'], ['all', 'Limaille + lignes']], help: 'Les boussoles montrent le sens du champ, la limaille seulement sa direction.' }
    ],
    buttons: [{ id: 'tap', label: 'Tapoter la plaque' }, { id: 'flip', label: 'Retourner l’aimant' }, { id: 'add', label: 'Ajouter un aimant' }, { id: 'reset', label: 'Remettre en place' }],
    whatIf: [
      { label: 'Et deux aimants qui s’attirent ?', set: { scene: 'attract' } },
      { label: 'Et un aimant de frigo ?', set: { scene: 'halbach' } },
      { label: 'Et la Terre entière ?', set: { scene: 'earth' } },
      { label: 'Et un aimant en U ?', set: { scene: 'horseshoe' } }
    ],
    challenges: [
      { id: 'lim1', text: 'Trouve le point neutre entre deux aimants (|B| ≈ 0)', test: function (o) { return o.neutral; } },
      { id: 'lim2', text: 'Mets deux pôles Nord face à face', test: function (o) { return o.repel; } },
      { id: 'lim3', text: 'Mesure un champ 1 000 fois plus fort que celui de la Terre', test: function (o) { return o.strong; } }
    ],
    phone: { uses: ['compass'], hint: 'Active les capteurs : la vraie boussole de ton téléphone s’affiche dans le coin de la plaque.', apply: function () {} },
    create: function (h, d) { return new FilingsSim(h, d); }
  },
  {
    id: 'magneto', name: 'Le magnétomètre de ta poche',
    params: [
      { id: 'src', type: 'select', label: 'Source', value: 'auto', options: [['auto', 'Capteur du téléphone (si dispo)'], ['virt', 'Simulation virtuelle']], help: 'Sans capteur, la simulation imite la Terre et un aimant.' },
      { id: 'head', label: 'Cap du téléphone virtuel', unit: '°', min: 0, max: 359, step: 1, value: 0, digits: 0, help: '0° : le haut du téléphone pointe vers le nord.' },
      { id: 'magOn', type: 'check', label: 'Aimant virtuel à côté', value: false, help: 'Un aimant posé à droite du téléphone.' },
      { id: 'dist', label: 'Distance de l’aimant virtuel', unit: 'cm', min: 1, max: 30, step: 0.5, value: 5, digits: 1, help: 'Le champ décroît en 1/r³.' }
    ],
    buttons: [{ id: 'sensors', label: 'Activer les capteurs' }, { id: 'zero', label: 'Effacer les courbes' }],
    whatIf: [
      { label: 'Et un aimant à 3 cm ?', set: { src: 'virt', magOn: true, dist: 3 } },
      { label: 'Et à 6 cm ?', set: { src: 'virt', magOn: true, dist: 6 } },
      { label: 'Et tourné vers l’est ?', set: { src: 'virt', head: 90 } }
    ],
    challenges: [
      { id: 'mag1', text: 'Mesure le champ terrestre avec un vrai capteur (25 à 70 µT)', test: function (o) { return o.earthOK; } },
      { id: 'mag2', text: 'Détecte un aimant : plus de 500 µT', test: function (o) { return o.B > 500; } },
      { id: 'mag3', text: 'Pointe le haut du téléphone vers le nord (±10°)', test: function (o) { return o.compass && o.heading !== null && (o.heading < 10 || o.heading > 350); } }
    ],
    phone: { uses: ['compass', 'magnet'], native: true, hint: 'Ici, tout vient des capteurs de ton téléphone. Active-les, puis approche un aimant.', apply: function () {} },
    create: function (h, d) { return new MagnetoSim(h, d); }
  },
  {
    id: 'compass', name: 'Boussole et précession',
    params: [
      { id: 'B', label: 'Champ magnétique B', unit: 'mT', min: 0, max: 400, step: 1, value: 100, digits: 0, help: 'Plus B est fort, plus m tourne vite autour de lui.' },
      { id: 'thB', label: 'Inclinaison du champ', unit: '°', min: 0, max: 90, step: 1, value: 0, digits: 0, help: '0° : champ vertical. 90° : champ horizontal.' },
      { id: 'alpha', label: 'Frottement α (amortissement)', unit: '', min: 0, max: 1, step: 0.01, value: 0.1, digits: 2, help: 'α = 0 : aucune perte. α grand : m se range presque directement.' },
      { id: 'th0', label: 'Angle de départ de m', unit: '°', min: 5, max: 175, step: 1, value: 60, digits: 0, help: 'Angle initial entre m et B (relance la simulation).' }
    ],
    buttons: [{ id: 'kick', label: 'Pichenette' }, { id: 'flip', label: 'Inverser le champ' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et sans frottement ?', set: { alpha: 0 } },
      { label: 'Et un champ ×4 ?', set: { B: 400 } },
      { label: 'Et un frottement énorme ?', set: { alpha: 1 } }
    ],
    challenges: [
      { id: 'cmp1', text: 'Fais précesser l’aimantation à plus de 10 GHz', test: function (o) { return o.f > 10; } },
      { id: 'cmp2', text: 'Aligne m sur B en moins de 0,5 ns (départ à plus de 60°)', test: function (o) { return o.alignedDur !== null && o.alignedDur < 0.5e-9; } },
      { id: 'cmp3', text: 'Précession éternelle : α = 0 et rien ne s’aligne pendant 3 ns', test: function (o, p) { return p.alpha === 0 && o.sinceEvent > 3e-9 && o.angle > 30; } }
    ],
    phone: {
      uses: ['tilt', 'magnet'], hint: 'Penche le téléphone : le champ B suit la pente et m part en toupie. Approche un aimant : B se renforce.',
      apply: function (sim, s) {
        const tx = s.tilt.x, ty = s.tilt.y, z = Math.sqrt(Math.max(0.04, 1 - Math.min(1, tx * tx + ty * ty)));
        const n = Math.sqrt(tx * tx + ty * ty + z * z);
        sim.dir = [tx / n, ty / n, z / n];
        const B = Math.round(100 + 300 * s.magnet);
        if (B !== sim.p.B) {
          sim.p.B = B;
          sim.bScale = Math.max(2e-3, B * 1e-3);
          sim.host.setParamUI('B', B);
        }
      }
    },
    create: function (h, d) { return new CompassSim(h, d); }
  },
  {
    id: 'hysteresis', name: 'Hystérésis',
    params: [
      { id: 'BK', label: 'Anisotropie B_K (dureté)', unit: 'mT', min: 20, max: 300, step: 5, value: 100, digits: 0, help: 'Champ qu’il faut pour retourner l’aimant quand le champ est le long de l’axe facile.' },
      { id: 'psi', label: 'Angle ψ entre champ et axe facile', unit: '°', min: 0, max: 90, step: 1, value: 20, digits: 0, help: '0° : champ le long de l’axe. 90° : champ perpendiculaire.' },
      { id: 'Bmax', label: 'Champ maximal du balayage', unit: 'mT', min: 50, max: 400, step: 5, value: 200, digits: 0, help: 'Trop petit : l’aimant ne se retourne jamais.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.5, digits: 2, help: 'Un frottement élevé rend le balayage quasi statique.' },
      { id: 'rate', label: 'Vitesse de balayage', unit: 'mT/ns', min: 10, max: 200, step: 5, value: 40, digits: 0, help: 'Plus lent = plus proche de la théorie statique.' },
      { id: 'B', label: 'Champ appliqué B', unit: 'mT', min: -400, max: 400, step: 1, value: 200, digits: 0, help: 'C’est toi qui balaies le champ. Descends lentement, regarde quand m bascule.' },
      { id: 'auto', type: 'check', label: 'Balayage automatique', value: false, help: 'Optionnel : la machine balaie à ta place.' }
    ],
    buttons: [{ id: 'down', label: 'B − 5 mT' }, { id: 'up', label: 'B + 5 mT' }, { id: 'reset', label: 'Nouveau cycle' }],
    whatIf: [
      { label: 'Cycle carré (ψ = 0°)', set: { psi: 0 } },
      { label: 'ψ = 45° : le plus facile', set: { psi: 45 } },
      { label: 'Champ perpendiculaire (ψ = 90°)', set: { psi: 90 } }
    ],
    challenges: [
      { id: 'hys1', text: 'Retourne l’aimant avec un champ ≤ 60 % de B_K', test: function (o, p) { return o.swAbs !== null && o.swAbs <= 0.6 * p.BK; } },
      { id: 'hys2', text: 'Supprime l’hystérésis : champ perpendiculaire à l’axe', test: function (o, p) { return p.psi >= 89; } },
      { id: 'hys3', text: 'Mesure un retournement à ±10 % de la formule théorique', test: function (o, p) { return o.swAbs !== null && p.psi < 89 && Math.abs(o.swAbs - o.th) < 0.1 * o.th; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone à gauche ou à droite : tu pilotes le champ toi-même et tu dessines le cycle.',
      apply: function (sim, s) { phoneSet(sim, 'B', Math.round(s.tilt.x * sim.p.Bmax), 0.5); }
    },
    create: function (h, d) { return new HysteresisSim(h, d); }
  },
  {
    id: 'curie', name: 'Température de Curie',
    params: [
      { id: 'T', label: 'Température (en unités J/k_B)', unit: '', min: 0.3, max: 5, step: 0.01, value: 1.6, digits: 2, help: 'La température critique vaut T_C ≈ 2,27.' },
      { id: 'h', label: 'Champ appliqué h', unit: '', min: -1, max: 1, step: 0.01, value: 0, digits: 2, help: 'Un petit champ choisit le camp gagnant.' },
      { id: 'speed', label: 'Vitesse de calcul', unit: 'balayages/image', min: 1, max: 12, step: 1, value: 3, digits: 0, help: 'Plus de balayages = évolution plus rapide.' },
      { id: 'mat', type: 'select', label: 'Matériau (pour les °C)', value: 'fe', options: [['fe', 'Fer (T_C = 770 °C)'], ['ni', 'Nickel (354 °C)'], ['gd', 'Gadolinium (20 °C)'], ['nd', 'Néodyme-fer-bore (312 °C)']], help: 'Change seulement la conversion en degrés.' }
    ],
    buttons: [{ id: 'up', label: 'Tout aligner ↑' }, { id: 'random', label: 'Désordre total' }, { id: 'anneal', label: 'Refroidir lentement' }, { id: 'quench', label: 'Trempe brutale' }, { id: 'heat', label: 'Chauffer fort' }, { id: 'reset', label: 'Effacer M(T)' }],
    whatIf: [
      { label: 'Et juste à T_C ?', set: { T: 2.27 } },
      { label: 'Et du gadolinium ?', set: { mat: 'gd' } },
      { label: 'Et un petit champ ?', set: { h: 0.1 } }
    ],
    challenges: [
      { id: 'cur1', text: 'Désaimante l’aimant en le chauffant au-dessus de T_C', test: function (o) { return o.wasMag && o.T > 2.4 && o.A < 0.1; } },
      { id: 'cur2', text: 'Recuit réussi : refroidis lentement jusqu’à |M| > 0,9', test: function (o) { return o.annealDone && o.A > 0.9; } },
      { id: 'cur3', text: 'Reste 3 secondes près du point critique (±5 %)', test: function (o) { return o.crit > 3; } },
      { id: 'cur4', text: 'Secoue le téléphone (ou le bouton) jusqu’à désaimanter', test: function (o) { return o.shakeMax > 0.5 && o.wasMag && o.A < 0.2; } }
    ],
    phone: {
      uses: ['shake', 'tilt'], hint: 'Secoue le téléphone : tu chauffes l’aimant ! Penche-le : tu ajoutes un champ h.',
      apply: function (sim, s) {
        sim.extraT = Math.max(sim.extraT, s.shake * 3.5);
        sim.shakeMax = Math.max(sim.shakeMax, s.shake);
        phoneSet(sim, 'h', Math.round(s.tilt.x * 12) / 20, 0.01);
      }
    },
    create: function (h, d) { return new CurieSim(h, d); }
  },
  {
    id: 'barkhausen', name: 'Bruit de Barkhausen',
    params: [
      { id: 'R', label: 'Désordre R (impuretés)', unit: '', min: 0.2, max: 3, step: 0.05, value: 0.9, digits: 2, help: 'Change l’échantillon : un nouveau tirage de défauts.' },
      { id: 'rate', label: 'Vitesse du balayage', unit: '', min: 0.1, max: 3, step: 0.01, value: 1, digits: 2, log: true, help: 'Lent : on distingue chaque avalanche.' },
      { id: 'auto', type: 'check', label: 'Balayage automatique', value: false, help: 'Optionnel : la machine balaie à ta place.' },
      { id: 'H', label: 'Champ H (manuel)', unit: '', min: -8, max: 8, step: 0.01, value: -4.6, digits: 2, help: 'Toucher ce curseur passe en mode manuel.' }
    ],
    buttons: [{ id: 'newdis', label: 'Nouvel échantillon' }, { id: 'reset', label: 'Recommencer le cycle' }],
    whatIf: [
      { label: 'Et presque sans défaut ?', set: { R: 0.35 } },
      { label: 'Et très désordonné ?', set: { R: 2.6 } },
      { label: 'Et au point critique ?', set: { R: 0.9 } }
    ],
    challenges: [
      { id: 'brk1', text: 'Un « clac » géant : une avalanche de plus de la moitié des spins', test: function (o) { return o.snap; } },
      { id: 'brk2', text: 'Fais craquer : au moins 200 avalanches en un demi-cycle', test: function (o) { return o.crackle; } },
      { id: 'brk3', text: 'Cycle lisse : demi-cycle sans avalanche de plus de 20 spins', test: function (o) { return o.smooth; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche lentement le téléphone : tu balaies le champ H. Active le son, sens les vibrations.',
      apply: function (sim, s) { phoneSet(sim, 'H', Math.round(s.tilt.x * sim.Hmax * 100) / 100, 0.005); }
    },
    create: function (h, d) { return new BarkhausenSim(h, d); }
  },
  {
    id: 'disk', name: 'Le disque dur qui oublie',
    params: [
      { id: 'word', type: 'text', label: 'Ton mot (12 caractères max)', value: 'BONJOUR', max: 12, help: 'Puis clique sur « Écrire le mot ».' },
      { id: 'mat', type: 'select', label: 'Support', value: 'hdd', options: [['hdd', 'Disque dur (CoCrPt)'], ['card', 'Piste de carte bancaire'], ['hamr', 'FePt (support pour le HAMR)']], help: 'Chaque support a sa barrière et son champ d’anisotropie.' },
      { id: 'd', label: 'Taille des grains', unit: 'nm', min: 2, max: 40, step: 0.1, value: 9, digits: 1, log: true, help: 'Volume ∝ d² : la barrière d’énergie aussi.' },
      { id: 'T', label: 'Température', unit: '°C', min: 20, max: 700, step: 5, value: 25, digits: 0, help: 'La chaleur fournit l’énergie k_BT.' },
      { id: 'clock', type: 'select', label: 'Le temps défile…', value: 'year', options: [['rt', '1 s = 1 s'], ['min', '1 s = 1 minute'], ['day', '1 s = 1 jour'], ['year', '1 s = 1 an'], ['kyear', '1 s = 1 000 ans']], help: 'Accélère pour tester la durée de vie des données.' },
      { id: 'Bm', label: 'Force de l’aimant (ton doigt)', unit: 'T', min: 0, max: 1.5, step: 0.05, value: 0.3, digits: 2, help: 'Glisse le doigt sur le disque pour l’approcher.' },
      { id: 'laser', type: 'check', label: 'Laser de chauffage (HAMR)', value: false, help: 'Chauffe chaque grain pendant l’écriture.' }
    ],
    buttons: [{ id: 'write', label: 'Écrire le mot' }, { id: 'heat', label: 'Coup de chaleur' }, { id: 'wipe', label: 'Disque vierge' }],
    whatIf: [
      { label: 'Et des grains de 6 nm ?', set: { d: 6 } },
      { label: 'Et à 300 °C ?', set: { T: 300 } },
      { label: 'Et une carte bancaire ?', set: { mat: 'card' } },
      { label: 'Tester le HAMR', set: { mat: 'hamr', laser: true } }
    ],
    challenges: [
      { id: 'dsk1', text: 'Garde ton mot intact pendant 10 ans', test: function (o) { return o.wrote && o.ok && o.simT >= 3.156e8 && o.correct === 96; } },
      { id: 'dsk2', text: 'Atteins la limite superparamagnétique : moins de 60 bits justes, sans chauffer', test: function (o) { return o.wrote && o.ok && o.correct < 60 && !o.magUsed && !o.hot; } },
      { id: 'dsk3', text: 'Efface une piste de carte bancaire avec un aimant', test: function (o) { return o.mat === 'card' && o.wrote && o.magUsed && o.correct < 60; } },
      { id: 'dsk4', text: 'Écris sur du FePt grâce au laser (HAMR)', test: function (o) { return o.mat === 'hamr' && o.wrote && o.ok && o.laser; } }
    ],
    phone: {
      uses: ['shake', 'magnet'], hint: 'Secoue : tu chauffes le disque. Approche un vrai aimant : il efface les bits fragiles.',
      apply: function (sim, s) {
        sim.extraHeat = Math.max(sim.extraHeat, s.shake * 350);
        sim.phoneB = s.magnet * 0.45;
      }
    },
    create: function (h, d) { return new DiskSim(h, d); }
  },
  {
    id: 'wall', name: 'Paroi de domaine',
    params: [
      { id: 'A', label: 'Échange A', unit: 'pJ/m', min: 8, max: 30, step: 1, value: 15, digits: 0, help: 'Veut élargir la paroi : les voisins veulent rester parallèles.' },
      { id: 'K', label: 'Anisotropie K', unit: 'kJ/m³', min: 150, max: 800, step: 10, value: 500, digits: 0, help: 'Veut rétrécir la paroi : les spins préfèrent ↑ ou ↓.' },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 5, step: 0.1, value: 2, digits: 1, help: 'Impose un sens de rotation (chiralité).' },
      { id: 'Bz', label: 'Champ B_z', unit: 'mT', min: -100, max: 100, step: 1, value: 40, digits: 0, help: 'Pousse la paroi : le domaine aligné sur le champ grandit.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.02, max: 1, step: 0.01, value: 0.3, digits: 2, log: true, help: 'Freine la paroi.' }
    ],
    buttons: [{ id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et sans DMI ?', set: { D: 0 } },
      { label: 'Et beaucoup de DMI ?', set: { D: 4.5 } },
      { label: 'Et un champ nul ?', set: { Bz: 0 } }
    ],
    challenges: [
      { id: 'wal1', text: 'Obtiens une paroi de Néel', test: function (o, p) { return p.D > 0.5 && o.type === 'Néel'; } },
      { id: 'wal2', text: 'Fais avancer la paroi à plus de 150 m/s', test: function (o) { return o.v !== null && o.v > 150; } },
      { id: 'wal3', text: 'Amincis la paroi sous 4 nm', test: function (o) { return o.wallW < 4e-9; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone : la paroi roule du côté où tu penches.',
      apply: function (sim, s) {
        const v = Math.round(s.tilt.x * 100);
        if (v !== sim.p.Bz) { sim.p.Bz = v; sim.core.Bz = v * 1e-3; sim.host.setParamUI('Bz', v); }
      }
    },
    create: function (h, d) { return new WallSim(h, d); }
  },
  {
    id: 'vortex', name: 'Vortex dans un disque',
    params: [
      { id: 'diam', label: 'Diamètre du disque', unit: 'nm', min: 60, max: 150, step: 5, value: 120, digits: 0, help: 'Relance la simulation.' },
      { id: 'thick', label: 'Épaisseur', unit: 'nm', min: 5, max: 40, step: 1, value: 20, digits: 0, help: 'Relance la simulation.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.5, step: 0.005, value: 0.05, digits: 3, log: true, help: 'Petit α : le cœur fait beaucoup de tours.' },
      { id: 'Bx', label: 'Champ B_x (dans le plan)', unit: 'mT', min: -150, max: 150, step: 1, value: 0, digits: 0, help: 'Décale le cœur… perpendiculairement au champ.' },
      { id: 'By', label: 'Champ B_y (dans le plan)', unit: 'mT', min: -150, max: 150, step: 1, value: 0, digits: 0, help: 'Même effet, dans l’autre direction.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'wheel', options: [['wheel', 'Roue des couleurs'], ['mz', 'Composante z']], help: 'La roue montre la direction dans le plan.' },
      { id: 'arrows', type: 'check', label: 'Afficher les flèches', value: false, help: '' }
    ],
    buttons: [{ id: 'pulse', label: 'Impulsion de champ' }, { id: 'vortex', label: 'Vortex décalé' }, { id: 'random', label: 'État aléatoire' }, { id: 'uniform', label: 'Uniforme' }],
    whatIf: [
      { label: 'Et un frottement minuscule ?', set: { alpha: 0.008 } },
      { label: 'Et un disque plus épais ?', set: { thick: 35 } },
      { label: 'Et un champ fort ?', set: { Bx: 120 } }
    ],
    challenges: [
      { id: 'vor1', text: 'Fais naître un vortex depuis l’état aléatoire', test: function (o) { return o.mode === 'random' && o.circAbs > 0.6 && o.t > 3e-10; } },
      { id: 'vor2', text: 'Déplace le cœur à plus de 25 nm du centre', test: function (o) { return o.coreR > 25 && o.circAbs > 0.4; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone : tu appliques un champ dans le plan. Surprise, le cœur ne va pas où tu penches !',
      apply: function (sim, s) {
        const bx = Math.round(s.tilt.x * 120), by = Math.round(s.tilt.y * 120);
        if (bx !== sim.p.Bx || by !== sim.p.By) {
          sim.p.Bx = bx; sim.p.By = by;
          sim.baseBx = bx * 1e-3; sim.baseBy = by * 1e-3;
          sim.core.By = sim.baseBy;
          sim.host.setParamUI('Bx', bx);
          sim.host.setParamUI('By', by);
        }
      }
    },
    create: function (h, d) { return new VortexSim(h, d); }
  },
  {
    id: 'skyrmion', name: 'Skyrmions',
    params: [
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 6, step: 0.1, value: 3.5, digits: 1, help: 'Favorise l’enroulement. Au-dessus de D_c, l’état uniforme devient instable.' },
      { id: 'K', label: 'Anisotropie effective K', unit: 'kJ/m³', min: 300, max: 1000, step: 10, value: 600, digits: 0, help: 'Garde l’aimantation perpendiculaire au film.' },
      { id: 'Bz', label: 'Champ perpendiculaire B_z', unit: 'mT', min: -50, max: 250, step: 5, value: 0, digits: 0, help: 'Un champ ↑ fait rétrécir les zones ↓.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.1, max: 1, step: 0.01, value: 0.5, digits: 2, log: true, help: 'Fort α : relaxation rapide.' },
      { id: 'disp', type: 'select', label: 'Affichage', value: 'wheel', options: [['wheel', 'Roue des couleurs'], ['mz', 'Composante z (rouge ↑, bleu ↓)']], help: '' },
      { id: 'arrows', type: 'check', label: 'Afficher les flèches', value: false, help: '' }
    ],
    buttons: [{ id: 'seed', label: 'Un skyrmion' }, { id: 'random', label: 'Aléatoire' }, { id: 'uniform', label: 'Uniforme' }],
    whatIf: [
      { label: 'Et plus de DMI ? (labyrinthe)', set: { D: 4.6 }, act: 'random' },
      { label: 'Et un champ fort ?', set: { Bz: 220 } },
      { label: 'Et sans DMI ?', set: { D: 0 } }
    ],
    challenges: [
      { id: 'sky1', text: 'Crée un skyrmion stable : |Q| ≈ 1 après 0,4 ns', test: function (o) { return Math.abs(Math.abs(o.Q) - 1) < 0.2 && o.t > 4e-10; } },
      { id: 'sky2', text: 'Fais naître un labyrinthe de rubans', test: function (o) { return o.maze; } },
      { id: 'sky3', text: 'Fabrique au moins 4 skyrmions (|Q| ≥ 4)', test: function (o) { return Math.abs(o.Q) >= 3.6 && o.t > 4e-10; } }
    ],
    phone: {
      uses: ['magnet', 'shake'], hint: 'Approche un aimant : le champ B_z écrase les skyrmions. Secoue : tu ajoutes du désordre.',
      apply: function (sim, s) {
        if (sim._pb === undefined) sim._pb = sim.p.Bz;
        const v = clamp(Math.round((sim._pb + s.magnet * 220) / 5) * 5, -50, 250);
        if (v !== sim.p.Bz) { sim.p.Bz = v; sim.core.Bz = v * 1e-3; sim.host.setParamUI('Bz', v); }
        if (s.shake > 0.25) {
          const c = sim.core, k = Math.floor(c.n * 0.04 * s.shake), a = 1.2 * s.shake;
          for (let q = 0; q < k; q++) {
            const i = (Math.random() * c.n) | 0;
            c.mx[i] += a * (Math.random() - 0.5);
            c.my[i] += a * (Math.random() - 0.5);
            c.mz[i] += a * (Math.random() - 0.5);
          }
          c.normalizeAll();
        }
      }
    },
    create: function (h, d) { return new SkyrmionSim(h, d, 'static'); }
  },
  {
    id: 'fmr', name: 'Résonance ferromagnétique',
    params: [
      { id: 'B0', label: 'Champ statique B₀ (dans le plan)', unit: 'mT', min: 0, max: 300, step: 1, value: 100, digits: 0, help: 'Fixe la note de l’aimant.' },
      { id: 'mat', type: 'select', label: 'Matériau', value: 'py', options: [['py', 'Permalloy (μ₀Mₛ = 1,0 T)'], ['cofeb', 'CoFeB (1,6 T)'], ['yig', 'YIG (0,18 T)']], help: 'μ₀Mₛ change la fréquence de résonance.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.002, max: 0.2, step: 0.001, value: 0.02, digits: 3, log: true, help: 'Petit α : résonance fine et haute.' },
      { id: 'f', label: 'Fréquence de pilotage', unit: 'GHz', min: 1, max: 40, step: 0.1, value: 5, digits: 1, help: 'Fréquence du champ micro-onde.' },
      { id: 'bac', label: 'Amplitude du champ micro-onde', unit: 'mT', min: 0.1, max: 5, step: 0.1, value: 1, digits: 1, help: 'Le « coup de marteau » à chaque période.' }
    ],
    buttons: [{ id: 'tune', label: 'Accorder sur la résonance' }, { id: 'kick', label: 'Taper l’aimant' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et un matériau très amorti ?', set: { alpha: 0.2 } },
      { label: 'Et un amortissement minimal ?', set: { alpha: 0.002 } },
      { label: 'Et du CoFeB ?', set: { mat: 'cofeb' } }
    ],
    challenges: [
      { id: 'fmr1', text: 'Fais osciller l’aimantation de plus de 15°', test: function (o) { return o.amp > 0.26; } },
      { id: 'fmr2', text: 'Fais résonner l’aimant à 20 GHz (±1)', test: function (o, p) { return Math.abs(o.fres - 20) < 1 && Math.abs(p.f - o.fres) < 1 && o.amp > 0.08; } },
      { id: 'fmr3', text: 'Résonance très fine : α ≤ 0,005 et amplitude > 30°', test: function (o, p) { return p.alpha <= 0.0051 && o.amp > 0.5; } }
    ],
    phone: {
      uses: ['flick', 'tilt'], hint: 'Donne une pichenette au téléphone : tu « tapes » l’aimant. Penche-le : tu changes B₀.',
      apply: function (sim, s) {
        if (flickOnce(sim, s)) sim.action('kick');
        phoneSet(sim, 'B0', Math.round(clamp(150 + s.tilt.x * 150, 0, 300) / 5) * 5, 0.5);
      }
    },
    create: function (h, d) { return new FmrSim(h, d); }
  },
  {
    id: 'pulse', name: 'Retournement éclair',
    params: [
      { id: 'BK', label: 'Anisotropie B_K', unit: 'mT', min: 20, max: 400, step: 5, value: 200, digits: 0, help: 'Hauteur de la barrière qui garde l’aimant ↑.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.3, step: 0.005, value: 0.02, digits: 3, log: true, help: 'Petit α : précession longue.' },
      { id: 'Bp', label: 'Amplitude de l’impulsion B_p', unit: 'mT', min: 0, max: 500, step: 1, value: 150, digits: 0, help: 'Doit dépasser B_K/2.' },
      { id: 'tau', label: 'Durée de l’impulsion', unit: 'ps', min: 10, max: 400, step: 1, value: 100, digits: 0, help: 'Environ un demi-tour de précession.' }
    ],
    buttons: [{ id: 'fire', label: 'Tirer l’impulsion' }, { id: 'cal', label: 'Trouver la durée idéale' }],
    whatIf: [
      { label: 'Et une impulsion trop courte ?', set: { tau: 20 }, act: 'fire' },
      { label: 'Et une impulsion trop faible ?', set: { Bp: 60 }, act: 'fire' },
      { label: 'Et un aimant plus mou ?', set: { BK: 60 } }
    ],
    challenges: [
      { id: 'pul1', text: 'Retourne l’aimant avec une impulsion', test: function (o) { return o.flipped; } },
      { id: 'pul2', text: 'Retourne avec une impulsion de moins de 60 ps', test: function (o) { return o.flipped && o.tau < 60; } },
      { id: 'pul3', text: 'Retourne avec une impulsion de moins de 50 mT', test: function (o) { return o.flipped && o.Bp < 50; } }
    ],
    phone: {
      uses: ['flick'], hint: 'Donne une pichenette au téléphone pour tirer l’impulsion.',
      apply: function (sim, s) { if (flickOnce(sim, s)) sim.action('fire'); }
    },
    create: function (h, d) { return new PulseSim(h, d); }
  },
  {
    id: 'swave', name: 'Ondes de spin',
    params: [
      { id: 'f', label: 'Fréquence de l’antenne', unit: 'GHz', min: 1, max: 12, step: 0.1, value: 7, digits: 1, help: 'Au-dessus de f₀, l’onde se propage. En dessous : rien.' },
      { id: 'B', label: 'Champ perpendiculaire B', unit: 'mT', min: 0, max: 300, step: 1, value: 100, digits: 0, help: 'Déplace la fréquence de coupure f₀ : un interrupteur magnétique.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.001, max: 0.05, step: 0.001, value: 0.005, digits: 3, log: true, help: 'L’amortissement fait mourir l’onde.' },
      { id: 'b0', label: 'Puissance de l’antenne', unit: 'mT', min: 0.5, max: 10, step: 0.5, value: 4, digits: 1, help: 'Amplitude du champ de l’antenne.' },
      { id: 'src', type: 'select', label: 'Source', value: 'point', options: [['point', 'Point (ondes circulaires)'], ['line', 'Ligne (onde plane)'], ['two', 'Deux points (interférences)']], help: '' }
    ],
    buttons: [{ id: 'reset', label: 'Relancer' }],
    whatIf: [
      { label: 'Et deux sources ?', set: { src: 'two' } },
      { label: 'Et une onde plane ?', set: { src: 'line' } },
      { label: 'Et sous la fréquence de coupure ?', set: { f: 2 } }
    ],
    challenges: [
      { id: 'sw1', text: 'Fais propager une onde de spin', test: function (o) { return o.prop && o.t > 3e-10; } },
      { id: 'sw2', text: 'Coupe la propagation : fréquence sous le gap f₀', test: function (o) { return !o.prop && o.f < o.f0 - 0.3; } },
      { id: 'sw3', text: 'Fabrique une onde de longueur d’onde < 90 nm', test: function (o) { return o.prop && o.lambda < 90e-9; } },
      { id: 'sw4', text: 'Fais des interférences avec deux sources', test: function (o, p) { return p.src === 'two' && o.prop && o.t > 3e-10; } }
    ],
    phone: {
      uses: ['tilt', 'magnet'], hint: 'Penche : tu règles la fréquence de l’antenne. Approche un aimant : le champ coupe les ondes.',
      apply: function (sim, s) {
        phoneSet(sim, 'f', Math.round((6.5 + s.tilt.x * 5.5) * 10) / 10, 0.05);
        phoneSet(sim, 'B', Math.round((100 + 200 * s.magnet) / 5) * 5, 0.5);
      }
    },
    create: function (h, d) { return new SpinWaveSim(h, d); }
  },
  {
    id: 'stt', name: 'Écrire avec un courant',
    params: [
      { id: 'BK', label: 'Anisotropie B_K', unit: 'mT', min: 20, max: 300, step: 5, value: 100, digits: 0, help: 'Dureté de l’aimant.' },
      { id: 'Bz', label: 'Champ de biais B_z', unit: 'mT', min: -50, max: 50, step: 1, value: 0, digits: 0, help: 'Favorise ↑ ou ↓.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.3, step: 0.005, value: 0.05, digits: 3, log: true, help: 'Le courant doit vaincre ce frottement.' },
      { id: 'aJ', label: 'Courant (couple de spin a_J)', unit: 'mT', min: -40, max: 40, step: 0.5, value: 0, digits: 1, help: 'Positif : éloigne m du polariseur p. Négatif : l’en rapproche.' }
    ],
    buttons: [{ id: 'writeDown', label: 'Écrire ↓ (0)' }, { id: 'writeUp', label: 'Écrire ↑ (1)' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et un frottement minuscule ?', set: { alpha: 0.01 } },
      { label: 'Et un aimant plus mou ?', set: { BK: 40 } },
      { label: 'Et un champ de biais fort ?', set: { Bz: 40 } }
    ],
    challenges: [
      { id: 'stt1', text: 'Fais basculer l’aimant vers le bas (↓)', test: function (o) { return o.mz < -0.9; } },
      { id: 'stt2', text: 'Écris ↓ puis réécris ↑ : un cycle complet', test: function (o) { return o.cycle; } },
      { id: 'stt3', text: 'Fais basculer avec un courant inférieur à 3 mT', test: function (o) { return o.swAmp !== null && Math.abs(o.swAmp) < 3; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche à droite : courant positif (écrit ↓). À gauche : courant négatif (écrit ↑).',
      apply: function (sim, s) { phoneSet(sim, 'aJ', Math.round(s.tilt.x * 80) / 2, 0.25); }
    },
    create: function (h, d) { return new SttSim(h, d); }
  },
  {
    id: 'sto', name: 'Nano-oscillateur',
    params: [
      { id: 'B', label: 'Champ dans le plan B', unit: 'mT', min: 20, max: 300, step: 1, value: 100, digits: 0, help: 'Règle la fréquence.' },
      { id: 'mu0Ms', label: 'Aimantation μ₀Mₛ', unit: 'T', min: 0.2, max: 1.6, step: 0.05, value: 1.0, digits: 2, help: 'Matériau de la couche libre.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.005, max: 0.1, step: 0.001, value: 0.02, digits: 3, log: true, help: 'Fixe le seuil.' },
      { id: 'aJ', label: 'Courant (couple de spin a_J)', unit: 'mT', min: 0, max: 40, step: 0.5, value: 16, digits: 1, help: 'Au-dessus du seuil a_c, l’oscillateur démarre.' }
    ],
    buttons: [{ id: 'kick', label: 'Pichenette' }, { id: 'reset', label: 'Recommencer' }],
    whatIf: [
      { label: 'Et sous le seuil ?', set: { aJ: 5 } },
      { label: 'Et un champ fort ?', set: { B: 250 } },
      { label: 'Et un faible amortissement ?', set: { alpha: 0.008, aJ: 8 } }
    ],
    challenges: [
      { id: 'sto1', text: 'Allume l’oscillateur : amplitude entretenue > 20°', test: function (o) { return o.amp > 0.34; } },
      { id: 'sto2', text: 'Fais osciller à plus de 15 GHz', test: function (o) { return o.f !== null && o.f > 15 && o.amp > 0.2; } },
      { id: 'sto3', text: 'Accorde 10 GHz (±0,5)', test: function (o) { return o.f !== null && Math.abs(o.f - 10) < 0.5 && o.amp > 0.2; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Plus tu penches, plus il y a de courant. Active le son pour écouter ton émetteur.',
      apply: function (sim, s) {
        const m = Math.min(1, Math.sqrt(s.tilt.x * s.tilt.x + s.tilt.y * s.tilt.y));
        phoneSet(sim, 'aJ', Math.round(m * 80) / 2, 0.25);
      }
    },
    create: function (h, d) { return new StoSim(h, d); }
  },
  {
    id: 'skcur', name: 'Skyrmion sous courant',
    params: [
      { id: 'u', label: 'Vitesse des électrons u', unit: 'm/s', min: 0, max: 400, step: 5, value: 150, digits: 0, help: 'Proportionnelle à la densité de courant.' },
      { id: 'dir', label: 'Direction du courant', unit: '°', min: 0, max: 360, step: 5, value: 0, digits: 0, help: '0° : vers la droite. 90° : vers le haut.' },
      { id: 'ratio', label: 'β / α (non-adiabaticité)', unit: '', min: 0, max: 2, step: 0.05, value: 0.2, digits: 2, help: 'β = α : plus d’effet Hall.' },
      { id: 'alpha', label: 'Frottement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.3, digits: 2, help: 'Un fort α réduit l’angle de Hall.' }
    ],
    buttons: [{ id: 'seed', label: 'Nouveau skyrmion' }, { id: 'clear', label: 'Effacer la trace' }],
    whatIf: [
      { label: 'Et β = α ?', set: { ratio: 1 } },
      { label: 'Et un courant vers le haut ?', set: { dir: 90 } },
      { label: 'Et un très fort frottement ?', set: { alpha: 1 } }
    ],
    challenges: [
      { id: 'skc1', text: 'Fais avancer le skyrmion à plus de 30 m/s', test: function (o) { return o.v !== null && o.v > 30; } },
      { id: 'skc2', text: 'Annule l’effet Hall : angle < 5°', test: function (o) { return o.hall !== null && o.v > 10 && Math.abs(o.hall) < 5; } },
      { id: 'skc3', text: 'Fais dévier le skyrmion de plus de 45°', test: function (o) { return o.hall !== null && o.v > 10 && Math.abs(o.hall) > 45; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone : le courant coule vers le bas de la pente. Le skyrmion roule… de travers !',
      apply: function (sim, s) {
        const m = Math.min(1, Math.sqrt(s.tilt.x * s.tilt.x + s.tilt.y * s.tilt.y));
        const u = Math.round(m * 80) * 5;
        const dir = m > 0.05 ? Math.round((((Math.atan2(s.tilt.y, s.tilt.x) / DEG) + 360) % 360) / 5) * 5 : sim.p.dir;
        if (u !== sim.p.u || dir !== sim.p.dir) {
          sim.p.u = u; sim.p.dir = dir;
          sim.core.ux = u * Math.cos(dir * DEG);
          sim.core.uy = u * Math.sin(dir * DEG);
          sim.host.setParamUI('u', u);
          sim.host.setParamUI('dir', dir);
          sim._pp = (sim._pp || 0) + 1;
          if (sim._pp % 15 === 0) sim.core.prepare();
        }
      }
    },
    create: function (h, d) { return new SkyrmionSim(h, d, 'current'); }
  }
];


// ===== catalogue/modes_new.js =====
function pyVec(v) { return '(' + v.map(py).join(', ') + ')'; }

function ubAxis(a) { return a === 'x' ? '(1, 0, 0)' : (a === 'y' ? '(0, 1, 0)' : '(0, 0, 1)'); }

function ubInitPy(p) {
  const k = p.init;
  if (k === 'ux') return 'm_init = (1, 0, 0)';
  if (k === 'rand') return 'rng = np.random.default_rng(1)\n\ndef m_init(point):\n    return 2 * rng.random(3) - 1';
  if (k === 'vortex') return 'def m_init(point):\n    x, y, z = point\n    return (-(y - Ly / 2), x - Lx / 2, 10e-9)';
  if (k === 'sky') return 'def m_init(point):\n    x, y, z = point\n    if (x - Lx / 2) ** 2 + (y - Ly / 2) ** 2 < (min(Lx, Ly) / 6) ** 2:\n        return (0, 0, -1)\n    return (0, 0, 1)';
  if (k === 'maze') return 'def m_init(point):\n    x, y, z0 = point\n    x -= Lx/2; y -= Ly/2\n    q1, q2, q3, q4, q5 = [2*np.pi/s for s in (96e-9, 135e-9, 90e-9, 140e-9, 170e-9)]\n    v = q2*y + 0.9*np.sin(q4*x)\n    u = q1*x + 1.75*np.sin(v)\n    v2 = q3*y + 1.2*np.sin(q4*x)\n    w = q5*(x-y)\n    f = np.sin(u) + 0.53*np.cos(v2) + 0.4*np.sin(w)\n    ux = q1 + 1.75*np.cos(v)*0.9*q4*np.cos(q4*x)\n    uy = 1.75*np.cos(v)*q2\n    gx = np.cos(u)*ux - 0.53*np.sin(v2)*1.2*q4*np.cos(q4*x) + 0.4*np.cos(w)*q5\n    gy = np.cos(u)*uy - 0.53*np.sin(v2)*q3 - 0.4*np.cos(w)*q5\n    n = np.hypot(gx,gy) or 1\n    mz = np.tanh(1.9*f)\n    xy = np.sqrt(max(0,1-mz*mz))\n    return (xy*gx/n, xy*gy/n, mz)';
  if (k === 'stripes') return 'lam = ' + py(p.D ? 4 * Math.PI * p.A * 1e-12 / Math.abs(p.D * 1e-3) : 50e-9) + '\n\ndef m_init(point):\n    x, y, z = point\n    return (np.sin(2 * np.pi * x / lam), 0, np.cos(2 * np.pi * x / lam))';
  if (k === 'twodom') return 'def m_init(point):\n    x, y, z = point\n    return (0, 0, 1) if x < Lx / 2 else (0, 0, -1)';
  return 'm_init = (0, 0, 1)';
}

function ubNormPy(p) {
  const sh = p.bc === 'pbc' ? 'rect' : p.shape;
  if (sh === 'rect') return 'norm = Ms';
  if (sh === 'disk') return 'def norm(point):\n    x, y, z = point\n    if ((x - Lx / 2) / (Lx / 2)) ** 2 + ((y - Ly / 2) / (Ly / 2)) ** 2 <= 1:\n        return Ms\n    return 0';
  if (sh === 'ring') return 'def norm(point):\n    x, y, z = point\n    r2 = ((x - Lx / 2) / (Lx / 2)) ** 2 + ((y - Ly / 2) / (Ly / 2)) ** 2\n    return Ms if 0.2 <= r2 <= 1 else 0';
  return 'def norm(point):\n    x, y, z = point\n    depth = Ly / 4 - abs(x - Lx / 2) * 0.5\n    if depth > 0 and (y < depth or y > Ly - depth):\n        return 0\n    return Ms';
}

function ubZeePy(p) {
  const out = ['mm.Zeeman(H=' + pyVec([0, 0, p.Bz].map(function (b) { return b * 1e-3 / MU0; })) + ', name="Hdc")'];
  let pre = '';
  if (p.fun !== 'none' && (p.bx || p.by || p.bz)) {
    const H = pyVec([p.bx, p.by, p.bz].map(function (b) { return b * 1e-3 / MU0; }));
    if (p.fun === 'sin' || p.fun === 'sinc') out.push('mm.Zeeman(H=' + H + ', func="' + p.fun + '", f=' + py(p.f * 1e9) + ', t0=' + py(p.t0 * 1e-9) + ', name="Hac")');
    else {
      const t0 = py(p.t0 * 1e-9), tw = py(p.tw * 1e-9);
      if (p.fun === 'window') pre = 'def f_t(t):\n    return 1 if ' + t0 + ' <= t < ' + t0 + ' + ' + tw + ' else 0\n\n';
      else if (p.fun === 'ramp') pre = 'def f_t(t):\n    return min(1, max(0, (t - ' + t0 + ') / ' + tw + '))\n\n';
      else pre = 'def f_t(t):\n    return np.exp(-0.5 * ((t - ' + t0 + ') / ' + tw + ') ** 2)\n\n';
      out.push('mm.Zeeman(H=' + H + ', func=f_t, dt=1e-13, name="Hac")');
    }
  }
  return { pre: pre, terms: out };
}

function ubSandboxPy(p) {
  const t = [], z = ubZeePy(p); 
  t.push('mm.Exchange(A=' + py(p.A * 1e-12) + ')');
  if (p.D) t.push('mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="Cnv_z")');
  if (p.K) t.push('mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=(0, 0, 1))');
  if (p.demag) t.push('mm.Demag()');
  const all = t.concat(z.terms);
  let s = 'Lx, Ly, t = ' + py(p.Lx * 1e-9) + ', ' + py(p.Ly * 1e-9) + ', ' + py(p.tz * 1e-9) + '\ncell = ' + py(p.cell * 1e-9) + '\nMs = ' + py(p.Ms * 1e3) + '\n\n';
  s += 'region = df.Region(p1=(0, 0, 0), p2=(Lx, Ly, t))\nmesh = df.Mesh(region=region, cell=(cell, cell, t)' + (p.bc === 'pbc' ? ', bc="xy"' : '') + ')\n\n';
  s += ubNormPy(p) + '\n\n' + ubInitPy(p) + '\n\n' + z.pre;
  s += 'system = mm.System(name="bac_a_sable"' + '' + ')\nsystem.energy = (\n    ' + all.join('\n    + ') + '\n)\n';
  s += 'system.dynamics = mm.Precession(gamma0=mm.consts.gamma0) + mm.Damping(alpha=' + py(p.alpha) + ')\n';
  s += 'system.m = df.Field(mesh, nvdim=3, value=m_init, norm=norm, valid="norm")';
  let d;
  d = 'md = oc.MinDriver()\nmd.drive(system)\nsystem.m.z.sel("z").mpl()';
  return [s, d];
}

// Le bac à sable ne possède qu'un seul ensemble de commandes, sans panneau « expert ».
// Les paramètres géométriques, Ms et alpha sont fixés par le cas de départ.
const SANDBOX_PARAMS = [
  { id: 'mat', type: 'select', label: 'Structure de départ', value: 'ircopt', options: [
    ['py', 'Vortex de permalloy'], ['ircopt', 'Labyrinthe Ir/Co/Pt'], ['copt', 'Skyrmion Co/Pt']
  ] },
  { id: 'A', label: 'Échange A', unit: 'pJ/m', min: 1, max: 30, step: 0.25, value: 10, digits: 2 },
  { id: 'K', label: 'Anisotropie K_u', unit: 'kJ/m³', min: -300, max: 1400, step: 1, value: 717, digits: 0 },
  { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: -5, max: 5, step: 0.05, value: 1.9, digits: 2 },
  { id: 'Bz', label: 'Champ μ₀H_z', unit: 'mT', min: -400, max: 400, step: 2, value: 0, digits: 0 },
  { id: 'demag', type: 'check', label: 'Champ démagnétisant', value: true }
];

MODELS.push(
  {
    id: 'sandbox', name: 'Bac à sable micromagnétique',
    params: SANDBOX_PARAMS,
    buttons: [],
    whatIf: [],
    challenges: [],
    create: function (h, d) { return new SandboxSim(h, d); }
  },
  {
    id: 'paroi_pin', name: 'Paroi et ancrage (pinning)',
    params: [
      { id: 'Bz', label: 'Champ B_z', unit: 'mT', min: -150, max: 150, step: 0.5, value: 0, digits: 1, help: 'Positif : le domaine rouge ↑ grossit, la paroi va à droite.' },
      { id: 'notch', label: 'Profondeur des entailles', unit: 'nm', min: 0, max: 36, step: 4, value: 16, digits: 0, help: 'Trois paires d’entailles en triangle. Reconstruit la piste.' },
      { id: 'dis', label: 'Désordre : grains de 15 nm', unit: '%', min: 0, max: 40, step: 1, value: 0, digits: 0, help: 'Écart type de l’anisotropie d’un grain à l’autre.' },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 2, step: 0.05, value: 1, digits: 2 },
      { id: 'alpha', label: 'Amortissement α', unit: '', min: 0.05, max: 1, step: 0.05, value: 0.3, digits: 2 },
      { id: 'u', label: 'Courant : vitesse u des électrons', unit: 'm/s', min: 0, max: 400, step: 5, value: 0, digits: 0, help: 'Couple de Zhang-Li, β = α.' },
      { id: 'T', label: 'Température', unit: 'K', min: 0, max: 300, step: 5, value: 0, digits: 0, help: 'Bruit thermique : la paroi peut décrocher sous le seuil (reptation).' },
      { id: 'auto', type: 'check', label: 'Rampe automatique de B', value: false, help: 'Optionnel. Par défaut, c’est toi qui montes le champ.' },
      { id: 'rate', label: 'Vitesse de la rampe', unit: 'mT/ns', min: 1, max: 50, step: 1, value: 10, digits: 0 },
      { id: 'disp', type: 'select', label: 'Couleurs', value: 'mz', options: [['mz', 'm_z, comme au microscope Kerr'], ['wheel', 'direction']] }
    ],
    buttons: [{ id: 'down', label: 'B − 2 mT' }, { id: 'up', label: 'B + 2 mT' }, { id: 'zero', label: 'B = 0' }, { id: 'reset', label: 'Paroi au départ' }, { id: 'newdis', label: 'Nouveau désordre' }],
    whatIf: [
      { label: 'Piste parfaite', set: { notch: 0, dis: 0 } },
      { label: 'Désordre seul, comme un vrai film', set: { notch: 0, dis: 25 } },
      { label: 'Entailles profondes', set: { notch: 32, dis: 0 } },
      { label: 'Pousser au courant', set: { Bz: 0, u: 250 } }
    ],
    challenges: [
      { id: 'pin1', text: 'Bloque la paroi sur l’entaille 1 avec B > 5 mT', test: function (o) { return o.pinnedAt === 0 && o.B > 5; } },
      { id: 'pin2', text: 'Mesure un champ de décrochage', test: function (o) { return o.depCount >= 1; } },
      { id: 'pin3', text: 'Fais sortir la paroi au bout de la piste', test: function (o) { return o.exited; } },
      { id: 'pin4', text: 'Décroche-la au courant seul, B = 0', test: function (o) { return o.depCurrent; } }
    ],
    phone: {
      uses: ['tilt'], hint: 'Penche le téléphone à droite ou à gauche : tu règles B_z (±100 mT).',
      apply: function (sim, s) { const v = Math.round(s.tilt.x * 200) / 2; if (Math.abs(v - sim.p.Bz) >= 0.5) sim.setB(v); }
    },
    create: function (h, d) { return new PinningSim(h, d); }
  },
  {
    id: 'labyrinthe', name: 'Labyrinthe et bulles',
    params: [
      { id: 'Bz', label: 'Champ B_z', unit: 'mT', min: -400, max: 400, step: 1, value: 0, digits: 0, help: 'Chaque changement relance la relaxation.' },
      { id: 'step', label: 'Pas de champ', unit: 'mT', min: 1, max: 50, step: 1, value: 10, digits: 0 },
      { id: 'auto', type: 'check', label: 'Balayage pas à pas automatique', value: false, help: 'Optionnel : monte d’un pas à chaque équilibre.' },
      { id: 'Bmax', label: 'Champ final du balayage', unit: 'mT', min: 50, max: 400, step: 10, value: 250, digits: 0 },
      { id: 'D', label: 'DMI D', unit: 'mJ/m²', min: 0, max: 3, step: 0.05, value: 1.9, digits: 2 },
      { id: 'K', label: 'Anisotropie K_u', unit: 'kJ/m³', min: 640, max: 1000, step: 2, value: 778, digits: 0, help: 'Sous 628 kJ/m³ (μ₀Ms²/2), l’aimantation se couche dans le plan.' },
      { id: 'res', type: 'select', label: 'Maillage', value: '64', options: [['64', '64 × 64 : 256 nm, rapide'], ['128', '128 × 128 : 512 nm, lent']] },
      { id: 'drv', type: 'select', label: 'Pilote', value: 'relax', options: [['relax', 'relaxation à chaque champ (MinDriver)'], ['llg', 'dynamique LLG (TimeDriver)']] },
      { id: 'T', label: 'Température (LLG)', unit: 'K', min: 0, max: 300, step: 5, value: 0, digits: 0 },
      { id: 'marks', type: 'check', label: 'Entourer les bulles détectées', value: true },
      { id: 'disp', type: 'select', label: 'Couleurs', value: 'mz', options: [['mz', 'm_z'], ['wheel', 'direction']] }
    ],
    buttons: [{ id: 'demag', label: 'Désaimanter' }, { id: 'sat', label: 'Saturer ↑' }, { id: 'down', label: 'B − pas' }, { id: 'up', label: 'B + pas' }, { id: 'zero', label: 'B = 0' }, { id: 'flash', label: 'Flash laser' }, { id: 'clear', label: 'Effacer les courbes' }],
    whatIf: [
      { label: 'Sans DMI : dipolaire seul', set: { D: 0 }, act: 'demag' },
      { label: 'DMI plus forte', set: { D: 2.6 }, act: 'demag' },
      { label: 'Anisotropie plus forte', set: { K: 900 }, act: 'demag' }
    ],
    challenges: [
      { id: 'lab1', text: 'Fais pousser un labyrinthe', test: function (o) { return o.sawMaze; } },
      { id: 'lab2', text: 'Transforme les bandes en au moins 3 bulles', test: function (o) { return o.sawMaze && o.maxBub >= 3; } },
      { id: 'lab3', text: 'Sature le film : ⟨m_z⟩ > 0,98 après les bulles', test: function (o) { return o.maxBub >= 1 && o.mz > 0.98 && o.B > 0; } }
    ],
    phone: {
      uses: ['tilt', 'flick'], hint: 'Penche le téléphone à droite : le champ monte (0 à 300 mT). Pichenette : flash laser.',
      apply: function (sim, s) {
        const v = Math.round(clamp(s.tilt.x, 0, 1) * 60) * 5;
        if (Math.abs(v - sim.p.Bz) >= 5) sim.setB(v);
        if (flickOnce(sim, s)) sim.action('flash');
      }
    },
    create: function (h, d) { return new LabySim(h, d); }
  }
);

UB.links.sandbox = ['first', 'energy', 'dmi', 'uniax', 'pbc', 'apiZeeman'];
UB.links.paroi_pin = ['dwpair', 'svp1', 'svp2', 'dmi', 'apiZL', 'sttdw'];
UB.links.labyrinthe = ['hyst', 'pbc', 'dmi', 'tools', 'apiHD', 'ltem'];

UB.map.sandbox = function (p) {
  const r = [['Ms = ' + p.Ms + ' kA/m', 'norm=' + py(p.Ms * 1e3)], ['A = ' + p.A + ' pJ/m', 'mm.Exchange(A=' + py(p.A * 1e-12) + ')']];
  if (p.Ktype !== 'none') r.push(['K = ' + p.K + ' kJ/m³', p.Ktype === 'uni' ? 'mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=' + ubAxis(p.Kaxis) + ')' : 'mm.CubicAnisotropy(K=' + py(p.K * 1e3) + ', …)']);
  if (p.Dtype !== 'none') r.push(['D = ' + p.D + ' mJ/m²', 'mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="' + p.Dtype + '")']);
  r.push(['Cellule ' + p.cell + ' nm, épaisseur ' + p.tz + ' nm', 'df.Mesh(..., cell=(' + py(p.cell * 1e-9) + ', ' + py(p.cell * 1e-9) + ', ' + py(p.tz * 1e-9) + '))']);
  r.push(['B statique (mT)', 'mm.Zeeman(H=' + pyVec([p.Bx, p.By, p.Bz].map(function (b) { return b * 1e-3 / MU0; })) + ')']);
  if (p.fun !== 'none') r.push(['h(t) = h·f(t)', p.fun === 'sin' || p.fun === 'sinc' ? 'func="' + p.fun + '", f=' + py(p.f * 1e9) : 'func=f_t, dt=1e-13']);
  r.push(['Pilote', p.drv === 'relax' ? 'oc.MinDriver()' : 'oc.TimeDriver()']);
  r.push(['Impulsion lumineuse', 'pas d’équivalent direct']);
  return r;
};
UB.map.paroi_pin = function (p) {
  return [['Piste 512 × 96 × 1 nm', 'df.Mesh(..., cell=(4e-9, 4e-9, 1e-9))'], ['Entailles ' + p.notch + ' nm', 'norm = fonction de (x, y)'], ['Désordre ' + p.dis + ' %', 'K = df.Field(mesh, nvdim=1, value=...)'], ['Champ B_z', 'system.energy.zeeman.H = (0, 0, B / mu0)'], ['Courant u = ' + p.u + ' m/s', 'mm.ZhangLi(u=' + py(p.u) + ', beta=' + py(p.alpha) + ')']];
};
UB.map.labyrinthe = function (p) {
  return [['Film infini', 'df.Mesh(..., bc="xy")'], ['D = ' + p.D + ' mJ/m²', 'mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="Cnv_z")'], ['K_u = ' + p.K + ' kJ/m³', 'mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=(0, 0, 1))'], ['Démagnétisant', 'mm.Demag()'], ['Balayage par pas de ' + p.step + ' mT', 'boucle + oc.MinDriver()'], ['Nombre de bulles', 'df.tools.topological_charge(...)']];
};

UB.cells.sandbox = function (p) {
  const c = ubSandboxPy(p);
  return [
    { md: '# Bac à sable\nTrois configurations fixes, cinq leviers A, K, D, H_z, démagnétisation. Modèle 2D, T = 0 K. Les motifs initiaux sont imposés puis relaxés.' },
    { py: UB_HEAD },
    { py: c[0] },
    { py: c[1] },
    { md: 'Le clic dans le navigateur modifie artificiellement la condition initiale locale. Il ne modélise ni laser, ni courant, ni barrière de nucléation. Ce notebook ne reproduit pas ces coups de pinceau.' }
  ];
};

UB.cells.paroi_pin = function (p) {
  const dis = p.dis > 0;
  let s = 'Lx, Ly, t = 512e-9, 96e-9, 1e-9\nMs, A, Ku = 5.8e5, 1.5e-11, 4.5e5\nnotch = ' + py(p.notch * 1e-9) + '\ncentres = [160e-9, 288e-9, 416e-9]\n\n';
  s += 'region = df.Region(p1=(0, 0, 0), p2=(Lx, Ly, t))\nmesh = df.Mesh(region=region, cell=(4e-9, 4e-9, 1e-9))\n\n';
  s += 'def norm(point):\n    x, y, z = point\n    for xc in centres:\n        depth = notch - abs(x - xc)\n        if depth > 0 and (y < depth or y > Ly - depth):\n            return 0\n    return Ms\n\n';
  s += 'def m_init(point):\n    x, y, z = point\n    return (0, 0, 1) if x < 64e-9 else (0, 0, -1)\n\n';
  if (dis) s += 'rng = np.random.default_rng(7)\nK = df.Field(mesh, nvdim=1, value=lambda point: Ku * max(0.05, 1 + ' + py(p.dis / 100) + ' * rng.standard_normal()))\n\n';
  s += 'system = mm.System(name="paroi_pinning"' + (p.T > 0 ? ', T=' + py(p.T) : '') + ')\nsystem.energy = (\n    mm.Exchange(A=A)\n    + mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="Cnv_z")\n    + mm.UniaxialAnisotropy(K=' + (dis ? 'K' : 'Ku') + ', u=(0, 0, 1))\n    + mm.Demag()\n    + mm.Zeeman(H=(0, 0, 0))\n)\n';
  s += 'system.dynamics = mm.Precession(gamma0=mm.consts.gamma0) + mm.Damping(alpha=' + py(p.alpha) + ')' + (p.u ? ' + mm.ZhangLi(u=' + py(p.u) + ', beta=' + py(p.alpha) + ')' : '') + '\nsystem.m = df.Field(mesh, nvdim=3, value=m_init, norm=norm, valid="norm")\noc.MinDriver().drive(system)';
  const d = 'td = oc.TimeDriver()\nB_list, x_list = [], []\nfor B in np.arange(0, 0.1, 2e-3):\n    system.energy.zeeman.H = (0, 0, B / mm.consts.mu0)\n    td.drive(system, t=0.5e-9, n=5)\n    x_w = Lx * (1 + system.m.z.mean() / Ms) / 2\n    B_list.append(B * 1e3)\n    x_list.append(x_w * 1e9)\n\nplt.plot(B_list, x_list, "o-")\nplt.xlabel("B (mT)")\nplt.ylabel("position de la paroi (nm)")\nplt.show()';
  return [{ md: '# Paroi et ancrage\nPiste Co/Pt avec entailles. On monte B par pas et on suit la paroi.' }, { py: UB_HEAD }, { py: s }, { py: d }];
};

UB.cells.labyrinthe = function (p) {
  const n = parseInt(p.res, 10) || 64, L = n * 4;
  let s = 'L = ' + py(L * 1e-9) + '\nMs = 1e6\nregion = df.Region(p1=(0, 0, 0), p2=(L, L, 1e-9))\nmesh = df.Mesh(region=region, cell=(4e-9, 4e-9, 1e-9), bc="xy")\n\n';
  s += 'system = mm.System(name="labyrinthe")\nsystem.energy = (\n    mm.Exchange(A=1e-11)\n    + mm.DMI(D=' + py(p.D * 1e-3) + ', crystalclass="Cnv_z")\n    + mm.UniaxialAnisotropy(K=' + py(p.K * 1e3) + ', u=(0, 0, 1))\n    + mm.Demag()\n    + mm.Zeeman(H=(0, 0, 0))\n)\n';
  s += 'rng = np.random.default_rng(3)\nsystem.m = df.Field(mesh, nvdim=3, value=lambda point: 2 * rng.random(3) - 1, norm=Ms)\nmd = oc.MinDriver()\nmd.drive(system)\nsystem.m.z.sel("z").mpl()';
  const d = 'champs, mz, Q = [], [], []\nfor B in np.arange(0, ' + py(p.Bmax * 1e-3) + ' + 1e-9, ' + py(p.step * 1e-3) + '):\n    system.energy.zeeman.H = (0, 0, B / mm.consts.mu0)\n    md.drive(system)\n    champs.append(B * 1e3)\n    mz.append(system.m.z.mean() / Ms)\n    Q.append(df.tools.topological_charge(system.m.sel("z")))\n\nplt.plot(champs, mz, "o-")\nplt.xlabel("B (mT)")\nplt.ylabel("<m_z>")\nplt.show()\nsystem.m.z.sel("z").mpl()';
  return [{ md: '# Du labyrinthe aux bulles\nFilm infini, DMI interfaciale. On part d’un état désaimanté, puis on monte B_z en relaxant à chaque pas.' }, { py: UB_HEAD }, { py: s }, { py: d }];
};

// ===== catalogue/sources.js =====
const REFS = {
  openfields: ['OpenStax, University Physics Vol. 2, §11.2 : champs et lignes magnétiques (cours ouvert)', 'https://openstax.org/books/university-physics-volume-2/pages/11-2-magnetic-fields-and-lines'],
  nistdw: ['D. C. Ralph et M. D. Stiles, Spin Transfer Torques (NIST), introduction aux parois magnétiques, accès libre', 'https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=620024'],
  jagla: ['E. A. Jagla, Numerical simulations of two-dimensional magnetic domain patterns, Phys. Rev. E 70, 046204 (2004), prépublication libre', 'https://arxiv.org/abs/cond-mat/0402406'],
  ubermag: ['M. Beg, M. Lang, H. Fangohr, « Ubermag: Toward more effective micromagnetic workflows », IEEE Trans. Magn. 58, 7300205 (2022)', 'https://doi.org/10.1109/TMAG.2021.3078896'],
  ubdyn: ['Documentation Ubermag : l’équation de dynamique (LLG)', 'https://ubermag.github.io/getting-started/notebooks/dynamics-equation.html'],
  ubenergy: ['Documentation Ubermag : l’équation d’énergie', 'https://ubermag.github.io/getting-started/notebooks/energy-equation.html'],
  pbcub: ['Documentation Ubermag : conditions aux limites périodiques', 'https://ubermag.github.io/examples/notebooks/periodic-boundary-conditions.html'],
  gilbert: ['T. L. Gilbert, « A phenomenological theory of damping in ferromagnetic materials », IEEE Trans. Magn. 40, 3443 (2004)', 'https://doi.org/10.1109/TMAG.2004.836740'],
  brown: ['W. F. Brown, « Thermal fluctuations of a single-domain particle », Phys. Rev. 130, 1677 (1963)', 'https://doi.org/10.1103/PhysRev.130.1677'],
  abo: ['G. S. Abo et al., « Definition of magnetic exchange length », IEEE Trans. Magn. 49, 4937 (2013)', 'https://doi.org/10.1109/TMAG.2013.2258028'],
  mumag: ['µMAG (NIST), problème standard n°4 : Permalloy, A = 1,3×10⁻¹¹ J/m, Ms = 8,0×10⁵ A/m, α = 0,02', 'https://www.ctcms.nist.gov/~rdm/std4/spec4.html'],
  kalinikos: ['B. A. Kalinikos, A. N. Slavin, J. Phys. C 19, 7013 (1986) : champ dipolaire d’un film mince', 'https://doi.org/10.1088/0022-3719/19/35/014'],
  hubert: ['A. Hubert, R. Schäfer, « Magnetic Domains », Springer (1998)', 'https://doi.org/10.1007/978-3-540-85054-0'],
  rohart: ['S. Rohart, A. Thiaville, « Skyrmion confinement in ultrathin film nanostructures in the presence of DMI », Phys. Rev. B 88, 184422 (2013)', 'https://doi.org/10.1103/PhysRevB.88.184422'],
  bogdanov: ['A. Bogdanov, A. Hubert, « Thermodynamically stable magnetic vortex states in magnetic crystals », J. Magn. Magn. Mater. 138, 255 (1994)', 'https://doi.org/10.1016/0304-8853(94)90046-9'],
  callen: ['H. B. Callen, E. Callen, « The present status of the temperature dependence of magnetocrystalline anisotropy », J. Phys. Chem. Solids 27, 1271 (1966)', 'https://doi.org/10.1016/0022-3697(66)90012-6'],
  crit: ['J. C. Le Guillou, J. Zinn-Justin, Phys. Rev. B 21, 3976 (1980) : exposant critique β ≈ 0,36 (Heisenberg 3D)', 'https://doi.org/10.1103/PhysRevB.21.3976'],
  beaurepaire: ['E. Beaurepaire et al., « Ultrafast spin dynamics in ferromagnetic nickel », Phys. Rev. Lett. 76, 4250 (1996)', 'https://doi.org/10.1103/PhysRevLett.76.4250'],
  je: ['S.-G. Je et al., « Creation of magnetic skyrmion bubble lattices by ultrafast laser in ultrathin films », Nano Lett. 18, 7362 (2018)', 'https://doi.org/10.1021/acs.nanolett.8b03653'],
  sampaio: ['J. Sampaio et al., « Nucleation, stability and current-induced motion of isolated magnetic skyrmions in nanostructures », Nat. Nanotechnol. 8, 839 (2013)', 'https://doi.org/10.1038/nnano.2013.210'],
  boulle: ['O. Boulle et al., « Room-temperature chiral magnetic skyrmions in ultrathin magnetic nanostructures », Nat. Nanotechnol. 11, 449 (2016)', 'https://doi.org/10.1038/nnano.2015.315'],
  moreau: ['C. Moreau-Luchaire et al., « Additive interfacial chiral interaction in multilayers for stabilization of small individual skyrmions at room temperature », Nat. Nanotechnol. 11, 444 (2016) : A = 10 pJ/m, D = 1,9 mJ/m²', 'https://doi.org/10.1038/nnano.2015.313'],
  woo: ['S. Woo et al., « Observation of room-temperature magnetic skyrmions and their current-driven dynamics in ultrathin metallic ferromagnets », Nat. Mater. 15, 501 (2016)', 'https://doi.org/10.1038/nmat4593'],
  seul: ['M. Seul, D. Andelman, « Domain shapes and patterns: the phenomenology of modulated phases », Science 267, 476 (1995)', 'https://doi.org/10.1126/science.267.5197.476'],
  jiang15: ['W. Jiang et al., « Blowing magnetic skyrmion bubbles », Science 349, 283 (2015)', 'https://doi.org/10.1126/science.aaa1442'],
  beg: ['M. Beg et al., « Ground state search, hysteretic behaviour, and reversal mechanism of skyrmionic textures in confined helimagnetic nanostructures », Sci. Rep. 5, 17137 (2015) : FeGe', 'https://doi.org/10.1038/srep17137'],
  chumak: ['A. V. Chumak, A. A. Serga, B. Hillebrands, « Magnonic crystals for data processing », J. Phys. D 50, 244001 (2017) : tableau YIG, Py, CoFeB', 'https://arxiv.org/abs/1702.06701'],
  yigcofeb: ['Paramètres YIG (Ms = 140 kA/m, A = 3,5 pJ/m, α = 2×10⁻⁴) et CoFeB (1 250 kA/m, 15 pJ/m, α = 4×10⁻³) utilisés dans arXiv:2412.08383', 'https://arxiv.org/abs/2412.08383'],
  weller: ['D. Weller, A. Moser, « Thermal effect limits in ultrahigh-density magnetic recording », IEEE Trans. Magn. 35, 4423 (1999)', 'https://doi.org/10.1109/20.809134'],
  metaxas: ['P. J. Metaxas et al., « Creep and flow regimes of magnetic domain-wall motion in ultrathin Pt/Co/Pt films », Phys. Rev. Lett. 99, 217208 (2007)', 'https://doi.org/10.1103/PhysRevLett.99.217208'],
  hayashi: ['M. Hayashi et al., « Dependence of current and field driven depinning of domain walls on their structure and chirality in permalloy nanowires », Phys. Rev. Lett. 97, 207205 (2006)', 'https://doi.org/10.1103/PhysRevLett.97.207205'],
  gao: ['Y. Gao et al., « Depinning of domain walls in permalloy nanowires with asymmetric notches », Sci. Rep. 6, 32617 (2016)', 'https://doi.org/10.1038/srep32617'],
  thiaville12: ['A. Thiaville et al., « Dynamics of Dzyaloshinskii domain walls in ultrathin magnetic films », EPL 100, 57002 (2012)', 'https://doi.org/10.1209/0295-5075/100/57002'],
  walker: ['N. L. Schryer, L. R. Walker, « The motion of 180° domain walls in uniform dc magnetic fields », J. Appl. Phys. 45, 5406 (1974)', 'https://doi.org/10.1063/1.1663252'],
  zhangli: ['S. Zhang, Z. Li, « Roles of nonequilibrium conduction electrons on the magnetization dynamics of ferromagnets », Phys. Rev. Lett. 93, 127204 (2004)', 'https://doi.org/10.1103/PhysRevLett.93.127204'],
  thiaville05: ['A. Thiaville et al., « Micromagnetic understanding of current-driven domain wall motion in patterned nanowires », EPL 69, 990 (2005)', 'https://doi.org/10.1209/epl/i2004-10452-6'],
  slonc: ['J. C. Slonczewski, « Current-driven excitation of magnetic multilayers », J. Magn. Magn. Mater. 159, L1 (1996)', 'https://doi.org/10.1016/0304-8853(96)00062-5'],
  sw: ['E. C. Stoner, E. P. Wohlfarth, « A mechanism of magnetic hysteresis in heterogeneous alloys », Phil. Trans. R. Soc. A 240, 599 (1948)', 'https://doi.org/10.1098/rsta.1948.0007'],
  kittel: ['C. Kittel, « On the theory of ferromagnetic resonance absorption », Phys. Rev. 73, 155 (1948)', 'https://doi.org/10.1103/PhysRev.73.155'],
  back: ['C. H. Back et al., « Minimum field strength in precessional magnetization reversal », Science 285, 864 (1999)', 'https://doi.org/10.1126/science.285.5429.864'],
  damon: ['R. W. Damon, J. R. Eshbach, « Magnetostatic modes of a ferromagnet slab », J. Phys. Chem. Solids 19, 308 (1961)', 'https://doi.org/10.1016/0022-3697(61)90041-5'],
  sun: ['J. Z. Sun, « Spin-current interaction with a monodomain magnetic body: A model study », Phys. Rev. B 62, 570 (2000)', 'https://doi.org/10.1103/PhysRevB.62.570'],
  kiselev: ['S. I. Kiselev et al., « Microwave oscillations of a nanomagnet driven by a spin-polarized current », Nature 425, 380 (2003)', 'https://doi.org/10.1038/nature01967'],
  shinjo: ['T. Shinjo et al., « Magnetic vortex core observation in circular dots of permalloy », Science 289, 930 (2000)', 'https://doi.org/10.1126/science.289.5481.930'],
  guslienko: ['K. Yu. Guslienko et al., « Eigenfrequencies of vortex state excitations in magnetic submicron-size disks », J. Appl. Phys. 91, 8037 (2002)', 'https://doi.org/10.1063/1.1450816'],
  litzius: ['K. Litzius et al., « Skyrmion Hall effect revealed by direct time-resolved X-ray microscopy », Nat. Phys. 13, 170 (2017)', 'https://doi.org/10.1038/nphys4000'],
  jiang17: ['W. Jiang et al., « Direct observation of the skyrmion Hall effect », Nat. Phys. 13, 162 (2017)', 'https://doi.org/10.1038/nphys3883'],
  onsager: ['L. Onsager, « Crystal statistics. I. A two-dimensional model with an order-disorder transition », Phys. Rev. 65, 117 (1944)', 'https://doi.org/10.1103/PhysRev.65.117'],
  metropolis: ['N. Metropolis et al., « Equation of state calculations by fast computing machines », J. Chem. Phys. 21, 1087 (1953)', 'https://doi.org/10.1063/1.1699114'],
  sethna93: ['J. P. Sethna et al., « Hysteresis and hierarchies: dynamics of disorder-driven first-order phase transformations », Phys. Rev. Lett. 70, 3347 (1993)', 'https://doi.org/10.1103/PhysRevLett.70.3347'],
  sethna01: ['J. P. Sethna, K. A. Dahmen, C. R. Myers, « Crackling noise », Nature 410, 242 (2001)', 'https://doi.org/10.1038/35065675'],
  kryder: ['M. H. Kryder et al., « Heat assisted magnetic recording », Proc. IEEE 96, 1810 (2008)', 'https://doi.org/10.1109/JPROC.2008.2004315'],
  wmm: ['NOAA, World Magnetic Model : champ terrestre 25 à 65 µT', 'https://www.ncei.noaa.gov/products/world-magnetic-model'],
  w3cmag: ['W3C, Magnetometer API (Generic Sensor)', 'https://www.w3.org/TR/magnetometer/'],
  w3cori: ['W3C, DeviceOrientation Event Specification', 'https://www.w3.org/TR/orientation-event/']
};

const MODE_SRC = {
  sandbox: ['ubermag', 'ubenergy', 'ubdyn', 'gilbert', 'abo', 'mumag', 'kalinikos', 'rohart', 'brown', 'beaurepaire', 'je', 'callen', 'crit', 'sampaio', 'moreau', 'beg', 'chumak', 'yigcofeb', 'weller'],
  paroi_pin: ['hayashi', 'gao', 'metaxas', 'thiaville12', 'walker', 'sampaio', 'zhangli', 'thiaville05', 'abo'],
  labyrinthe: ['seul', 'woo', 'jiang15', 'moreau', 'rohart', 'bogdanov', 'je', 'kalinikos', 'ubermag'],
  wall: ['walker', 'thiaville12', 'hubert'],
  vortex: ['shinjo', 'guslienko'],
  skyrmion: ['rohart', 'sampaio', 'boulle', 'bogdanov'],
  skcur: ['zhangli', 'thiaville05', 'litzius', 'jiang17', 'sampaio'],
  compass: ['gilbert', 'ubdyn'],
  hysteresis: ['sw'],
  fmr: ['kittel'],
  pulse: ['back'],
  swave: ['damon', 'kalinikos', 'chumak'],
  stt: ['slonc', 'sun'],
  sto: ['slonc', 'kiselev'],
  limaille: ['wmm'],
  magneto: ['w3cmag', 'w3cori', 'wmm'],
  curie: ['onsager', 'metropolis'],
  barkhausen: ['sethna93', 'sethna01'],
  disk: ['weller', 'kryder', 'brown']
};

const MODE_MODEL = {
  sandbox: [
    'Énergie : échange, DMI (interfaciale C_nv ou de volume T), anisotropie uniaxiale ou cubique, Zeeman statique + Zeeman × f(t), démagnétisant.',
    'Dynamique : LLG (RK4, pas fixe) ou relaxation par plus grande pente (comme oc.MinDriver). Bruit thermique de Brown si T > 0.',
    'Démagnétisant : film mince d’une cellule, noyau de Fourier f(k) = (1 − e^{−kt})/(kt). Périodique si bords périodiques et tailles en puissance de 2.',
    'Impulsion lumineuse : chauffage gaussien T(r, t) = T₀ + ΔT·w²/w(t)²·e^{−2r²/w(t)²}·e^{−t/τ}, w(t)² = w² + 8D_th·t, D_th = 10⁻⁵ m²/s (ordre de grandeur pour un métal). On en déduit m_s(T) = (1 − T/T_C)^0,36, puis A ∝ m_s², K ∝ m_s³, D ∝ m_s², et un bruit thermique local.',
    'T_C des matériaux : valeurs indicatives (ordre de grandeur), à remplacer par une mesure sur ton échantillon.'
  ],
  paroi_pin: [
    'Piste 512 × 96 nm, épaisseur 1 nm, cellule 4 nm. Ms = 580 kA/m et A = 15 pJ/m (type Co/Pt, Sampaio 2013).',
    'K_u = 0,45 MJ/m³, plus faible que dans Sampaio (0,8) : la paroi δ = √(A/K_eff) ≈ 8 nm couvre ainsi 2 cellules. Avec K_u = 0,8 il faudrait des cellules de 2 nm.',
    'Démagnétisant remplacé par K_eff = K_u − μ₀Ms²/2 (film ultramince). La DMI interfaciale fixe des parois de Néel et repousse le seuil de Walker.',
    'Accrochage : trois paires d’entailles triangulaires et des grains de 15 nm dont l’anisotropie varie de ± σ.'
  ],
  labyrinthe: [
    'Film périodique 256 × 256 nm (64²) ou 512 × 512 nm (128²), épaisseur 1 nm, cellule 4 nm, démagnétisant complet.',
    'A = 10 pJ/m et D = 1,9 mJ/m² mesurés par Moreau-Luchaire 2016 (Ir/Co/Pt). Ms = 1 MA/m et K_u = 0,78 MJ/m³ choisis pour avoir Q > 1 et D légèrement au-dessus de D_c.',
    'Balayage quasi statique : à chaque champ on relaxe jusqu’à |m × B| < 1 mT, comme oc.HysteresisDriver.',
    'Mesures : largeur moyenne des domaines minoritaires = 2 × aire / longueur de paroi ; une « bulle » est un domaine fermé et presque rond (rapport des axes < 1,9).'
  ]
};

// ===== catalogue/parcours.js =====
const GRANDEURS = {
  B: { sym: 'B', name: 'Champ magnétique', role: 'Il peut tourner l’aimantation ou faire grandir un domaine.' },
  m: { sym: 'm', name: 'Aimantation', role: 'Elle décrit la direction et l’intensité du magnétisme d’une région. Des moments opposés peuvent se compenser.' },
  A: { sym: 'A', name: 'Échange', role: 'Il favorise des voisins qui pointent dans le même sens.' },
  K: { sym: 'K', name: 'Anisotropie', role: 'Elle indique à quel point une orientation est favorisée. Un axe vertical favorise les deux sens ↑ et ↓.' },
  D: { sym: 'D', name: 'Interaction DMI', role: 'Elle favorise un sens de rotation précis entre voisins et peut stabiliser des motifs.' },
  demag: { sym: 'H_d', name: 'Champ démagnétisant', role: 'L’aimantation du matériau crée ce champ. Dans une couche mince, il peut favoriser des zones d’orientations différentes ou des flèches couchées.' },
  T: { sym: 'T', name: 'Température', role: 'La chaleur augmente l’agitation des moments. Ils s’alignent moins et l’aimantation d’ensemble peut disparaître.' }
};

function guideFieldLabel(value) {
  return value === 0 ? '0 mT · champ extérieur nul' : Math.abs(value) + ' mT ' + (value > 0 ? '↑' : '↓');
}

function guideWallRedArea(sim) {
  const red = sim.core.mz.reduce((count, z) => count + (z > 0 ? 1 : 0), 0);
  return frNum(100 * red / sim.nx, 0) + ' % de rouge';
}

function guideWallWidth(sim) {
  return 'Largeur de la paroi · ' + frNum(sim.wallW * 1e9, 1) + ' nm';
}

function guideCurieTemperature(value) {
  return frNum(value, 1) + (value < 1.4 ? ' · froid' : value > 3 ? ' · chaud' : '');
}

function guideCurieField(value) {
  return value === 0 ? '0 · champ appliqué nul' : frNum(Math.abs(value), 2) + (value > 0 ? ' ↑' : ' ↓');
}

function guideVerticalMagnetization(sim) {
  const mz = sim.eng.mean()[2];
  const total = Math.round(Math.abs(mz) * 100);
  return 'Aimantation verticale d’ensemble · ' + total + ' %' + (total === 0 ? '' : mz > 0 ? ' ↑' : ' ↓');
}

function guideCurieMeasure(sim) {
  const red = Math.round(50 * (1 + sim.M));
  const blue = 100 - red;
  const total = Math.abs(red - blue);
  const direction = total === 0 ? '' : red > blue ? ' ↑' : ' ↓';
  return red + ' % rouge ↑ · ' + blue + ' % bleu ↓. Aimantation d’ensemble ' + total + ' %' + direction;
}

const GUIDE_TEXTURE_CONTROLS = [
  {
    id: 'A', label: 'Échange A', format: v => frNum(v, 2) + ' pJ/m',
    help: 'Quand A augmente, les flèches voisines s’orientent davantage ensemble. Les changements de direction deviennent plus progressifs.'
  },
  {
    id: 'K', label: 'Anisotropie K', format: v => frNum(v, 0) + ' kJ/m³',
    help: 'K positif favorise les deux sens de la verticale, ↑ et ↓. K négatif favorise les flèches couchées dans le plan du film.'
  },
  {
    id: 'D', label: 'Interaction DMI D', format: v => frNum(v, 2) + ' mJ/m²',
    help: 'D favorise un sens de rotation entre flèches voisines. Éloigne D de zéro pour voir si les bandes ou les bulles changent.'
  },
  {
    id: 'demag', label: 'Champ démagnétisant',
    help: 'L’aimantation du film crée ce champ, même si le champ extérieur vaut zéro. Il peut favoriser des flèches couchées ou des domaines d’orientations différentes.'
  },
  {
    id: 'Bz', label: 'Champ extérieur', format: guideFieldLabel,
    help: 'Tu appliques ce champ depuis l’extérieur. Vers le haut, il favorise le rouge ↑. Vers le bas, il favorise le bleu ↓.'
  }
].map(control => ({ ...SANDBOX_PARAMS.find(param => param.id === control.id), ...control }));

const DOMAIN_INTRO = 'Imagine de minuscules aimants dans le matériau. Un domaine magnétique est une zone où ils pointent presque tous dans le même sens. La paroi est la transition entre deux domaines.';

const DECOUVERTE = [
  {
    id: 'limaille', short: 'Voir l’invisible', icon: '🧲',
    summary: 'Déplace les aimants et observe le champ avec de la limaille ou des boussoles.',
    free: {
      setup: { scene: 'bar', disp: 'filings' }, reset: 'reset', gesture: true,
      caption: 'Fais glisser un aimant ou retourne-le. Les boussoles indiquent dans quel sens pointe le champ.',
      controls: [
        { id: 'scene', label: 'Disposition des aimants', options: [
          ['bar', 'Un aimant'], ['attract', 'Nord face au sud'], ['repel', 'Nord face au nord']
        ] },
        { id: 'disp', label: 'Outil d’observation', options: [
          ['filings', 'Limaille de fer'], ['compass', 'Petites boussoles'], ['lines', 'Lignes de champ']
        ] }
      ],
      action: { id: 'flip', label: 'Retourner le premier aimant' }
    },
    steps: [
      {
        name: 'Peux-tu repérer un aimant retourné ?',
        question: 'Si tu retournes un aimant sur place, quel outil permet de voir que le champ a changé de sens ?',
        choices: ['La limaille de fer', 'Les petites boussoles'],
        answer: 1,
        hint: 'Quel outil a une pointe qui peut se retourner ?',
        observe: 'Les petites boussoles ont une pointe. La limaille dessine des traits.',
        setup: { scene: 'bar', disp: 'compass' },
        explain: 'La pointe d’une boussole indique le sens du champ. Elle fait un demi-tour quand on retourne l’aimant. Les traits de limaille gardent la même forme.',
        qty: ['B'],
        limit: 'Les pôles sont représentés dans un plan.',
        sources: ['openfields', 'hubert']
      },
      {
        name: 'Le pont de limaille',
        question: 'Quels pôles faut-il placer face à face pour voir un pont de limaille entre deux aimants ?',
        choices: ['Nord face au sud', 'Nord face au nord'],
        answer: 0,
        hint: 'Pense à ce que tu as observé lorsque les lignes traversaient l’espace entre les deux aimants.',
        observe: 'Observe la forme des traits entre les deux aimants.',
        setup: { scene: 'attract', disp: 'filings' },
        explain: 'Entre un nord et un sud, les deux champs se renforcent et les traits traversent l’espace entre les pôles. Entre deux nords identiques, les champs se compensent au milieu.',
        qty: ['B'],
        limit: 'Ce dessin montre l’orientation du champ. La force entre aimants n’est pas calculée ici.',
        sources: ['openfields', 'hubert']
      }
    ]
  },
  {
    id: 'wall', short: 'Domaines et parois', icon: '↕',
    summary: 'Repère les groupes de flèches et fais bouger leur frontière.',
    free: {
      setup: { Bz: 0, A: 20, K: 350, D: 0 }, reset: 'reset', legend: true,
      intro: DOMAIN_INTRO,
      caption: 'Au départ, le domaine rouge pointe vers le haut ↑ et le bleu vers le bas ↓. Dans la bande claire qui les sépare, les petits aimants changent progressivement d’orientation.',
      controls: [
        { id: 'Bz', label: 'Champ magnétique', min: -40, max: 40, step: 2, format: guideFieldLabel },
        { id: 'A', label: 'Accord entre voisins (échange)', min: 8, max: 30, step: 1, format: v => frNum(v, 0) + ' pJ/m' },
        { id: 'K', label: 'Préférence pour la verticale (↑ ou ↓)', min: 150, max: 800, step: 10, format: v => frNum(v, 0) + ' kJ/m³' }
      ],
      action: { id: 'reset', label: 'Remettre la paroi au départ' },
      measure: s => s.xw === null ? guideWallRedArea(s) : guideWallWidth(s) + ' · ' + guideWallRedArea(s)
    },
    steps: [
      {
        name: 'Repère les domaines',
        intro: DOMAIN_INTRO,
        question: 'Combien de domaines vois-tu dans le ruban au début de l’expérience ?',
        choices: ['Deux, un rouge ↑ et un bleu ↓', 'Un seul, car c’est un seul matériau'],
        answer: 0,
        hint: 'Compte les zones où les flèches pointent ensemble. La bande claire est la transition entre elles.',
        observe: 'Les flèches sous la bande montrent le sens de l’aimantation à chaque endroit.',
        setup: { Bz: 0, A: 30, K: 350 },
        reset: 'reset',
        legend: true,
        explain: 'Un même matériau peut contenir plusieurs domaines. Ici, le rouge pointe vers le haut et le bleu vers le bas. Dans la paroi, les petits aimants tournent progressivement de l’un à l’autre.',
        qty: ['m'],
        limit: 'Les flèches et les couleurs représentent l’aimantation locale.',
        sources: ['hubert', 'nistdw']
      },
      {
        name: 'La largeur de la paroi',
        intro: 'K mesure la préférence pour la verticale (↑ ou ↓). A mesure la tendance des voisins à s’orienter ensemble.',
        question: 'Quel réglage peut rendre la paroi plus étroite ?',
        choices: ['Augmenter K, la préférence pour la verticale', 'Augmenter A, l’accord entre voisins'],
        answer: 0,
        hint: 'Pour rendre la paroi plus étroite, il faut réduire la place occupée par les flèches inclinées.',
        observe: 'Les flèches inclinées se trouvent dans la bande claire.',
        setup: { Bz: 0, A: 30, K: 350 },
        reset: 'reset',
        legend: true,
        explain: 'Augmenter K favorise les flèches verticales et resserre la zone inclinée. Augmenter A étale la transition pour que deux voisines aient des directions plus proches.',
        qty: ['A', 'K'],
        limit: 'La largeur affichée est une estimation pour une paroi idéalisée à une dimension.',
        sources: ['hubert', 'nistdw']
      },
      {
        name: 'Le champ et les domaines',
        question: 'Quel champ extérieur aide le domaine rouge (↑) à grandir ?',
        choices: ['Un champ vers le haut ↑', 'Un champ vers le bas ↓'],
        answer: 0,
        hint: 'Pense au champ qui pointe dans le même sens que le domaine rouge.',
        observe: 'Le trait doré repère la paroi entre les deux domaines.',
        setup: { Bz: 0, A: 15, K: 500 },
        reset: 'reset',
        legend: true,
        explain: 'Le champ favorise le domaine orienté dans le même sens que lui. Vers le haut il fait grandir le rouge, vers le bas il fait grandir le bleu.',
        qty: ['B'],
        limit: 'Ce ruban idéal ne contient ni défauts ni agitation thermique.',
        sources: ['walker', 'nistdw']
      }
    ]
  },
  {
    id: 'labyrinthe', short: 'Bandes et bulles', icon: '▧',
    summary: 'Explore les cinq réglages du bac à sable et observe leurs effets sur les domaines.',
    free: {
      mode: 'sandbox', setup: { mat: 'ircopt' }, reset: 'reset', legend: true,
      caption: 'Rouge ↑ et bleu ↓ montrent les deux sens de l’aimantation verticale. Les zones claires ont une aimantation presque couchée dans le film. Change un réglage et observe comment le motif évolue.',
      controls: GUIDE_TEXTURE_CONTROLS,
      action: { id: 'reset', label: 'Relancer le motif avec ces réglages' },
      measure: guideVerticalMagnetization,
      qty: ['A', 'K', 'D', 'demag', 'B']
    },
    steps: [
      {
        name: 'Le rôle de la DMI',
        question: 'Quelle préférence le réglage D ajoute-t-il aux petits aimants voisins ?',
        choices: ['Un sens de rotation quand leur orientation change', 'Un sens pour le champ extérieur'],
        answer: 0,
        hint: 'Pense aux flèches qui tournent en passant d’un domaine à l’autre.',
        observe: 'Les bords des zones colorées se trouvent là où les petits aimants changent progressivement d’orientation.',
        setup: { Bz: 0, auto: false, D: 1.9 },
        reset: 'demag',
        legend: true,
        explain: 'La DMI favorise un sens de rotation entre voisins. Elle peut contribuer à la formation de bandes ou de bulles. Le champ extérieur a son propre réglage.',
        qty: ['D', 'B'],
        limit: 'Les motifs dépendent aussi des autres réglages et de l’état de départ.',
        sources: ['rohart', 'moreau']
      },
      {
        name: 'Deux champs, deux origines',
        question: 'Un champ démagnétisant peut-il exister quand le champ extérieur vaut zéro ?',
        choices: ['Non, les deux champs disparaissent ensemble', 'Oui, l’aimantation du film le crée'],
        answer: 1,
        hint: 'Un aimant crée son propre champ. Les petits aimants du film aussi.',
        observe: 'Le film contient des régions aimantées dans des sens différents.',
        setup: { Bz: 0, auto: false, D: 1.9 },
        reset: 'demag',
        legend: true,
        explain: 'Le matériau aimanté produit le champ démagnétisant. Il peut favoriser des domaines d’orientations différentes ou des flèches couchées. Le champ extérieur est celui qu’on applique au matériau.',
        qty: ['demag', 'B'],
        limit: 'La forme du matériau compte dans le calcul du champ démagnétisant.',
        sources: ['hubert', 'ubenergy']
      }
    ]
  },
  {
    id: 'curie', short: 'L’aimant et la chaleur', icon: '♨', optional: true,
    summary: 'Chauffe, refroidis et observe comment les orientations s’additionnent ou se compensent.',
    free: {
      setup: { T: 1, h: 0 }, reset: 'up', legend: true,
      caption: 'Chaque case rouge pointe vers le haut et chaque bleue vers le bas. La chaleur les fait changer de sens plus souvent. Quand les deux couleurs s’équilibrent, l’aimantation d’ensemble est proche de zéro.',
      controls: [
        { id: 'T', label: 'Température', min: 0.7, max: 4.2, step: 0.1, format: guideCurieTemperature },
        { id: 'h', label: 'Champ magnétique', min: -0.9, max: 0.9, step: 0.05, format: guideCurieField }
      ],
      action: { id: 'up', label: 'Tout orienter vers le haut' },
      measure: guideCurieMeasure
    },
    steps: [
      {
        name: 'L’effet de la chaleur',
        intro: 'Chaque case montre le sens d’un petit aimant. Le rouge pointe vers le haut et le bleu vers le bas.',
        question: 'Pourquoi l’aimantation d’ensemble peut-elle diminuer quand on chauffe sans appliquer de champ ?',
        choices: ['Les petits aimants pointent tous plus fortement vers le haut', 'Davantage de petits aimants pointent dans des sens opposés et se compensent'],
        answer: 1,
        hint: 'Un petit aimant ↑ et un petit aimant ↓ ont des effets qui se compensent.',
        observe: 'Une grille avec autant de rouge que de bleu a une aimantation d’ensemble proche de zéro.',
        setup: { T: 3.7, h: 0 },
        reset: 'random',
        legend: true,
        explain: 'La chaleur rend les changements d’orientation plus fréquents. Quand les deux sens s’équilibrent, leurs contributions se compensent. Au-dessus de la température de Curie, l’aimantation spontanée disparaît dans ce modèle sans champ appliqué.',
        qty: ['T', 'm'],
        limit: 'Dans les unités de ce modèle d’Ising, le seuil de Curie se situe vers 2,27.',
        sources: ['onsager', 'metropolis']
      },
      {
        name: 'Retrouve une aimantation',
        intro: 'Après le refroidissement, un champ peut aider les petits aimants à s’accorder dans un sens.',
        question: 'Quel champ aide la grille à devenir surtout bleue (↓) ?',
        choices: ['Un champ vers le haut ↑', 'Un champ vers le bas ↓'],
        answer: 1,
        hint: 'Cherche le champ qui pointe dans le même sens que les cases bleues.',
        observe: 'Le bleu et le rouge indiquent les deux sens possibles de l’aimantation.',
        setup: { T: 1.5, h: 0 },
        reset: 'random',
        legend: true,
        explain: 'Quand le matériau refroidit, les petits aimants voisins s’alignent plus facilement. Le champ vers le bas favorise le bleu. Le sens qui domine donne celui de l’aimantation d’ensemble.',
        qty: ['B', 'T'],
        limit: 'La vitesse de l’animation ne donne pas une durée de refroidissement réelle.',
        sources: ['onsager', 'metropolis']
      }
    ]
  }
];

// ===== vue/disk-playground.js =====
const DISK_PLAY_MEDIA = {
  standard: { mat: 'hdd', d: 9 },
  fragile: { mat: 'hdd', d: 4 },
  hard: { mat: 'hamr', d: 4 }
};
const DISK_AGE_YEARS = 10;
const DISK_AGE_DURATION = 2;

function normalizeDiskLetter(value) {
  return String(value || '').normalize('NFD').replace(/[^a-z]/gi, '').charAt(0).toUpperCase();
}

function recordDiskLetter(sim, target, laser) {
  sim.setParam('word', target);
  sim.setParam('laser', laser);
  sim.writeWord(target, true);
  sim.read();
}

function createDiskTrial(host, config, target, previous = '') {
  const sim = new DiskSim(host, { word: previous, mat: 'hdd', d: 9, T: 25, clock: 'rt', laser: false, Bm: 0 });
  // Prépare la même piste de départ avant de comparer les conditions d’écriture.
  Object.assign(sim.p, { mat: config.mat, d: config.d });
  recordDiskLetter(sim, target, Boolean(config.laser));
  return { sim, target, previous };
}

class DiskPlayground {
  constructor(root, host) {
    this.root = root;
    this.host = host;
    this.medium = 'standard';
    this.trial = null;
    this.pending = null;
    this.ageElapsed = null;
    this.years = 0;
    this.beforeCells = [];
    this.field = qs('#free-disk-letter', root);
    this.laser = qs('#free-disk-laser', root);
    this.write = qs('#free-disk-write', root);
    this.age = qs('#free-disk-age', root);
    this.compareIntro = qs('#free-disk-compare-intro', root);
    this.beforeTitle = qs('#free-disk-before-title', root);
    this.beforeRow = qs('#free-disk-before-bits', root);
    this.afterRow = qs('#free-disk-after-bits', root);
    this.after = qs('#free-disk-after', root);
    this.yearsLabel = qs('#free-disk-years', root);
    this.ageProgress = qs('#free-disk-age-progress', root);
    this.status = qs('#free-disk-status', root);
    this.heat = qs('#free-disk-heat', root);
    this.target = qs('#free-disk-target', root);
    this.recorded = qs('#free-disk-recorded', root);
    this.media = qsa('[data-disk-medium]', root);
    this.field.value = '';
    this.laser.checked = false;
    this.field.oninput = () => {
      this.field.value = normalizeDiskLetter(this.field.value);
      this.update();
    };
    this.media.forEach(button => {
      button.onclick = () => {
        if (this.pending || this.ageElapsed !== null || this.medium === button.dataset.diskMedium) return;
        this.medium = button.dataset.diskMedium;
        this.trial = null;
        this.resetAging();
        this.laser.checked = false;
        this.update();
      };
    });
    qs('form', root).onsubmit = event => {
      event.preventDefault();
      if (this.pending || this.ageElapsed !== null || !this.field.value) return;
      const laser = this.medium === 'hard' && this.laser.checked;
      this.resetAging();
      this.pending = { letter: this.field.value, laser, time: laser ? 1.25 : 0.4 };
      this.update();
      this.status.scrollIntoView({ block: 'nearest' });
    };
    this.age.onclick = () => {
      if (this.age.disabled) return;
      this.ageElapsed = 0;
      this.update();
      this.after.scrollIntoView({ block: 'nearest' });
    };
    this.update();
  }

  resetAging() {
    this.ageElapsed = null;
    this.years = 0;
    this.beforeCells = [];
  }

  readCells(sim) {
    return sim.bits.slice(0, 8).map((bit, i) => ({
      bit,
      grains: Array.from(sim.s.subarray(i * sim.G, (i + 1) * sim.G))
    }));
  }

  renderBits(row, cells, before = []) {
    row.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const cell = cells[i];
      const bit = cell?.bit;
      const orientation = bit === undefined ? 'blank' : bit ? 'up' : 'down';
      const previous = before[i];
      const changed = previous && bit !== previous.bit;
      const upShare = cell && 100 * cell.grains.filter(spin => spin > 0).length / cell.grains.length;
      const mark = cell ? '<span class="disk-grain-mark" style="--grain-up: ' + upShare + '%"></span>' : '';
      return '<span class="track-bit ' + orientation + (changed ? ' changed' : '') + '" aria-hidden="true">' +
        (bit === undefined ? '–' : bit) + mark + '</span>';
    }).join('');
    const label = row === this.beforeRow ? 'Bits au départ' : 'Bits relus';
    const bits = cells.map(cell => cell.bit).join(' ');
    row.setAttribute('aria-label', label + ', ' + (bits || 'en attente de l’écriture'));
  }

  agingFeedback(afterCells) {
    const changedBits = afterCells.filter((cell, i) => cell.bit !== this.beforeCells[i].bit).length;
    let changedGrains = 0;
    let grainsCount = 0;
    afterCells.forEach((cell, i) => {
      grainsCount += cell.grains.length;
      changedGrains += cell.grains.filter((spin, j) => spin !== this.beforeCells[i].grains[j]).length;
    });
    const grainSummary = changedGrains === 1 ? '1 grain sur ' + grainsCount + ' a changé de sens.' :
      changedGrains > 1 ? changedGrains + ' grains sur ' + grainsCount + ' ont changé de sens.' :
        'Les grains ont gardé leur orientation.';
    if (changedBits > 0) {
      const summary = changedBits === 1 ? '1 bit modifié sur 8.' : changedBits + ' bits modifiés sur 8.';
      return summary + ' ' + grainSummary;
    }
    const reason = changedGrains > 0 ? ' La majorité est restée la même dans chaque case.' : '';
    const next = this.medium === 'fragile' ? ' Compare avec une autre piste.' : ' Essaie les petits grains pour comparer.';
    return '0 bit modifié sur 8. ' + grainSummary + reason + next;
  }

  update() {
    const pending = this.pending, trial = this.trial;
    const aging = this.ageElapsed !== null;
    const busy = Boolean(pending) || aging;
    const writingLaser = Boolean(pending && pending.laser);
    const cooled = !pending && trial && trial.laser;
    const letter = this.field.value;
    const recorded = trial ? trial.sim.text[0].trim() : '';
    this.media.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.diskMedium === this.medium));
      button.disabled = busy;
    });
    this.field.readOnly = busy;
    this.laser.disabled = busy;
    qs('#free-disk-laser-control', this.root).hidden = this.medium !== 'hard';
    this.compareIntro.hidden = this.medium === 'hard';
    this.write.disabled = !letter;
    if (busy) this.write.setAttribute('aria-disabled', 'true');
    else this.write.removeAttribute('aria-disabled');
    this.write.textContent = pending ? 'Écriture en cours…' : letter ? 'Écrire « ' + letter + ' »' : 'Écrire la lettre';
    this.target.textContent = pending ? pending.letter : trial ? trial.target : letter || '—';
    this.recorded.textContent = recorded === '·' ? 'Illisible' : recorded || '—';
    this.heat.dataset.heat = writingLaser ? 'hot' : 'cold';
    this.heat.textContent = writingLaser ? 'Flash laser' : cooled ? 'Piste refroidie' : 'À température ambiante';
    const failed = !busy && trial && !trial.sim.writeOk;
    this.beforeTitle.textContent = failed ? 'Après la tentative d’écriture' : 'Après l’écriture';
    this.age.disabled = busy || this.years === DISK_AGE_YEARS || !trial || !trial.sim.writeOk;
    this.after.hidden = !aging && this.years === 0;
    this.ageProgress.hidden = !aging;
    this.ageProgress.value = this.years;
    this.yearsLabel.textContent = this.years === 0 ? 'Au départ' : this.years === 1 ? '1 an après' : this.years + ' ans après';
    const afterCells = this.after.hidden ? [] : this.readCells(trial.sim);
    this.renderBits(this.beforeRow, this.beforeCells);
    this.renderBits(this.afterRow, afterCells, this.after.hidden ? [] : this.beforeCells);
    let feedback = 'Choisis une lettre et lance l’écriture.';
    if (writingLaser) {
      feedback = 'Le flash chauffe la piste. La barrière baisse et la tête peut retourner les grains.';
    } else if (pending) {
      feedback = 'La tête essaie d’orienter les grains.';
    } else if (aging) {
      feedback = 'Le temps avance. Compare les bits relus à ceux du départ.';
    } else if (trial) {
      if (!trial.sim.writeOk) {
        feedback = 'La lettre n’a pas été enregistrée. À température ambiante, la barrière est trop haute pour la tête. Active le flash et essaie d’écrire la même lettre.';
      } else if (this.years === DISK_AGE_YEARS) {
        feedback = this.agingFeedback(afterCells);
      } else if (cooled) {
        feedback = 'La lettre est enregistrée. Le flash a abaissé la barrière et la tête a pu retourner les grains. La barrière est remontée au refroidissement.';
      } else {
        feedback = 'La lettre est enregistrée. Fais passer dix ans pour voir si elle tient.';
      }
    }
    if (this.status.textContent !== feedback) this.status.textContent = feedback;
  }

  frame(dt) {
    if (this.ageElapsed !== null) {
      this.ageElapsed += dt;
      const years = Math.min(DISK_AGE_YEARS, Math.floor(this.ageElapsed * DISK_AGE_YEARS / DISK_AGE_DURATION));
      if (years === this.years) return;
      while (this.years < years) {
        this.trial.sim.update(DISK_CLOCK.year[0], 1);
        this.years++;
      }
      if (years === DISK_AGE_YEARS) this.ageElapsed = null;
      this.update();
      return;
    }
    const pending = this.pending;
    if (!pending) return;
    pending.time -= dt;
    if (pending.time > 0) return;
    if (this.trial) {
      recordDiskLetter(this.trial.sim, pending.letter, pending.laser);
      this.trial.target = pending.letter;
    } else {
      this.trial = createDiskTrial(this.host, { ...DISK_PLAY_MEDIA[this.medium], laser: pending.laser }, pending.letter);
    }
    this.trial.laser = pending.laser;
    this.pending = null;
    this.beforeCells = this.readCells(this.trial.sim);
    if (this.trial.sim.writeOk) this.host.sfx('flip');
    this.update();
  }
}

// ===== vue/workshops.js =====
class ApplicationWorkshop {
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.word = normalizeDiskLetter(callbacks.readDiskLetter?.() || '');
    this.reset();
  }

  reset() {
    this.trial = null;
    this.pending = null;
    this.read = false;
    this.answer = null;
    this.revealed = false;
    this.render();
  }

  header(title, intro) {
    return '<header class="workshop-head"><a class="back" href="#application">← Applications</a>' +
      '<div class="guided-meta"><span>Disque dur</span></div>' +
      '<h1 id="workshop-title" tabindex="-1">' + title + '</h1><p>' + intro + '</p></header>';
  }

  render(focus) {
    const writing = Boolean(this.pending);
    const recorded = this.read ? this.trial.sim.text[0] : this.trial ? 'À relire' : '—';
    let message = 'Choisis une lettre, puis lance l’écriture.';
    if (writing) message = 'La tête oriente les grains de la piste.';
    else if (this.read) message = 'Lettre relue · « ' + recorded + ' »';
    else if (this.trial) message = 'La tête a écrit ta lettre. Relis la piste pour la retrouver.';

    this.root.innerHTML = this.header('Comment le disque garde ta lettre',
      'Écris une lettre et relis-la. Le disque la code en huit bits (des 0 et des 1) grâce au sens de petits aimants dans la piste. On appelle ces petits aimants des grains.') +
      '<div class="workshop-grid disk-tutorial-grid"><section class="workshop-visual" aria-label="Piste d’écriture">' +
        '<div class="track-header"><b>Piste magnétique</b></div>' +
        '<dl class="disk-letter-pair"><div><dt>Lettre demandée</dt><dd id="disk-target-letter">' + escHtml(this.word || '—') +
        '</dd></div><div><dt>Lettre sur la piste</dt><dd id="disk-recorded-letter">' + escHtml(recorded) + '</dd></div></dl>' +
        '<div class="track-bits" aria-label="Huit groupes de grains">' +
        Array.from({ length: 8 }, (_, i) => {
          const bit = this.trial ? this.trial.sim.bits[i] : null;
          return '<div class="track-bit ' + (bit === null ? 'blank' : bit ? 'up' : 'down') + '">' +
            '<div aria-hidden="true">' + (bit === null ? '·' : bit ? '↑' : '↓') + '</div>' +
            '<span>' + (this.read ? bit : '–') + '</span></div>';
        }).join('') + '</div>' +
        '<p class="track-key"><span>↑ Rouge · 1</span><span>↓ Bleu · 0</span></p>' +
        '<p id="track-status" class="track-caption" role="status" tabindex="-1">' + escHtml(message) + '</p></section>' +
      '<section class="workshop-controls" aria-label="Commandes du disque"><h2>À toi d’écrire</h2>' +
        '<div class="disk-letter-form"><label for="disk-word">Lettre à écrire (A à Z)</label><input id="disk-word" type="text" maxlength="1" ' +
        'autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + escHtml(this.word) + '"' + (writing ? ' readonly' : '') + '>' +
        '<div class="workshop-actions"><button class="btn primary" id="disk-write" type="button"' + (writing ? ' aria-disabled="true"' : '') + '></button>' +
        '<button class="btn" id="disk-read" type="button"' + (!this.trial || writing ? ' disabled' : '') + '>Relire la piste</button>' +
        '</div></div><div id="disk-bilan">' + this.review() + '</div></section></div>';

    const input = qs('#disk-word', this.root);
    input.oninput = () => {
      input.value = normalizeDiskLetter(input.value);
      this.word = input.value;
      this.updateControls();
    };
    input.onkeydown = event => {
      if (event.key === 'Enter') qs('#disk-write', this.root).click();
    };
    qs('#disk-write', this.root).onclick = () => {
      if (this.pending || !this.word) return;
      this.trial = null;
      this.read = false;
      this.answer = null;
      this.revealed = false;
      this.pending = { target: this.word, seconds: 0.85 };
      this.callbacks.saveDiskLetter?.(this.word);
      this.render('#disk-write');
    };
    qs('#disk-read', this.root).onclick = () => {
      this.read = true;
      this.render('#track-status');
    };
    qsa('[data-disk-answer]', this.root).forEach(button => {
      button.onclick = () => {
        this.answer = Number(button.dataset.diskAnswer);
        this.render(this.answer === 1 ? '#disk-explain' : '[data-disk-answer="0"]');
      };
    });
    const reveal = qs('#disk-reveal', this.root);
    if (reveal) reveal.onclick = () => { this.revealed = true; this.render('#disk-explain'); };
    const next = qs('#disk-next', this.root);
    if (next) next.onclick = () => this.complete();
    this.updateControls();
    if (focus) {
      const element = qs(focus, this.root);
      element.focus({ preventScroll: focus === '#track-status' || focus === '#disk-write' });
      if (focus === '#track-status') element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }

  updateControls() {
    const write = qs('#disk-write', this.root);
    write.disabled = !this.word;
    write.textContent = this.pending ? 'Écriture en cours…' : this.word ? 'Écrire « ' + this.word + ' »' : 'Écrire la lettre';
    qs('#disk-target-letter', this.root).textContent = this.word || '—';
    qs('#disk-bilan', this.root).hidden = !this.read || this.trial.target !== this.word;
  }

  review() {
    if (!this.read) return '';
    const correct = this.answer === 1;
    let html = '<div class="guide-question"><h3>Que détecte la tête de lecture ?</h3><div class="guide-options">' +
      ['La forme de ma lettre', 'Le sens des petits aimants sur la piste'].map((choice, i) =>
        '<button class="guide-option" type="button" data-disk-answer="' + i + '" aria-pressed="' +
        (this.answer === i) + '">' + choice + '</button>'
      ).join('') + '</div>';
    if (correct || this.revealed) {
      html += '<div id="disk-explain" class="guide-explain" tabindex="-1"><h3>Ce que montre la piste</h3>' +
        '<p>La tête d’écriture oriente les grains magnétiques. La tête de lecture repère leurs orientations. ' +
        'L’ordinateur transforme ensuite les 0 et les 1 en lettre.</p></div>' +
        '<p><button id="disk-next" class="btn primary" type="button">Terminer l’activité →</button></p>';
    } else if (this.answer !== null) {
      html += '<p class="guide-fb no" role="status">Regarde les flèches sur la piste et les 0 et 1 qui apparaissent quand tu lis.</p>' +
        '<button id="disk-reveal" class="guide-link" type="button">Voir l’explication</button>';
    }
    return html + '</div>';
  }

  complete() {
    this.callbacks.complete();
    this.root.innerHTML = this.header('Tu as écrit et relu une lettre',
      'Le disque garde la lettre grâce à l’orientation de ses grains magnétiques.') +
      '<div class="workshop-end"><div class="guide-foot"><a class="btn primary" href="#xp-disk">Pour aller plus loin →</a>' +
      '<a class="btn" href="#guide-haut-parleur">Découvrir le haut-parleur →</a>' +
      '<button class="guide-link" id="disk-replay" type="button">Rejouer</button></div></div>';
    qs('#disk-replay', this.root).onclick = () => {
      this.reset();
      qs('#workshop-title', this.root).focus();
    };
    qs('#workshop-title', this.root).focus();
  }

  frame(dt) {
    if (!this.pending) return;
    this.pending.seconds -= dt;
    if (this.pending.seconds > 0) return;
    this.trial = createDiskTrial(this.callbacks.diskHost, DISK_PLAY_MEDIA.standard, this.pending.target);
    this.pending = null;
    this.callbacks.diskHost.sfx('flip');
    this.render(document.activeElement.id === 'disk-write' ? '#track-status' : null);
  }
}

// ===== vue/speaker-diagram.js =====
const SPEAKER_DIAGRAM_WIDTH = 340;
const SPEAKER_DIAGRAM_HEIGHT = 222;

function speakerDiagramMarkup() {
  return '<figure class="speaker-diagram" style="margin:0">' +
    '<canvas class="speaker-cutaway" width="' + SPEAKER_DIAGRAM_WIDTH + '" height="' + SPEAKER_DIAGRAM_HEIGHT + '" ' +
    'role="img" aria-label="Coupe d’un haut-parleur. L’aimant reste fixe. La bobine et la membrane se déplacent ensemble. La membrane fait vibrer l’air devant elle." ' +
    'style="display:block;width:100%;height:auto;border-radius:12px;background:#eef2e8">' +
    'L’aimant reste fixe. La bobine entraîne la membrane qui met l’air en mouvement.</canvas>' +
    '</figure>';
}

function speakerStroke(ctx, color, width, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawSpeakerBody(ctx) {
  const edge = '#526c66';
  speakerStroke(ctx, edge, 4, [[53, 81], [95, 78], [209, 49], [214, 49], [214, 69]]);
  speakerStroke(ctx, edge, 4, [[53, 151], [95, 154], [209, 183], [214, 183], [214, 163]]);

  ctx.fillStyle = '#6f8780';
  ctx.fillRect(37, 81, 13, 70);
  ctx.fillRect(50, 108, 59, 16);
  ctx.fillStyle = '#91a49d';
  for (const y of [79, 96, 130, 147]) ctx.fillRect(50, y, 48, 5);

  for (const y of [84, 135]) {
    ctx.fillStyle = '#a52e2d';
    ctx.fillRect(51, y, 43, 12);
    for (let x = 55; x < 91; x += 8) {
      speakerStroke(ctx, '#efd1b4', 1.25, [[x, y + 9], [x + 4, y + 3]]);
    }
  }
}

function drawSpeakerMovingParts(ctx, dx, direction) {
  ctx.fillStyle = '#e2ba63';
  ctx.fillRect(99 + dx, 98, 33, 9);
  ctx.fillRect(99 + dx, 125, 33, 9);
  for (const y of [98, 125]) {
    for (let x = 100; x <= 130; x += 5) {
      speakerStroke(ctx, '#87420e', 2.3, [[x + dx, y], [x + dx, y + 9]]);
    }
  }

  ctx.beginPath();
  ctx.moveTo(128 + dx, 102);
  ctx.lineTo(196 + dx, 67);
  ctx.lineTo(196 + dx, 165);
  ctx.lineTo(128 + dx, 130);
  ctx.closePath();
  ctx.fillStyle = 'rgba(153, 192, 128, .23)';
  ctx.fill();
  speakerStroke(ctx, '#2e6149', 4.5, [[196 + dx, 67], [128 + dx, 102], [128 + dx, 130], [196 + dx, 165]]);
  ctx.beginPath();
  ctx.moveTo(128 + dx, 102);
  ctx.bezierCurveTo(145 + dx, 102, 145 + dx, 130, 128 + dx, 130);
  ctx.strokeStyle = '#2e6149';
  ctx.lineWidth = 3;
  ctx.stroke();

  for (const [y, curl] of [[67, -11], [165, 11]]) {
    ctx.beginPath();
    ctx.moveTo(196 + dx, y);
    ctx.quadraticCurveTo((410 + dx) / 2, y + curl, 214, y);
    ctx.strokeStyle = '#526c66';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  if (direction) {
    const end = 159 + dx + 11 * direction;
    speakerStroke(ctx, '#285943', 2, [[159 + dx - 11 * direction, 116], [end, 116]]);
    speakerStroke(ctx, '#285943', 2, [[end - 6 * direction, 111], [end, 116], [end - 6 * direction, 121]]);
  }
}

function drawSpeakerAir(ctx, showAir, phase) {
  const progress = phase / (2 * Math.PI);
  const cycle = progress - Math.floor(progress);
  ctx.fillStyle = '#658c7e';
  for (let x = 224; x < 321; x += 13) {
    const shift = showAir ? 1.8 * Math.sin(phase - (x - 218) / 31 * (2 * Math.PI)) : 0;
    for (let y = 73; y < 176; y += 17) {
      ctx.beginPath();
      ctx.arc(x + shift, y + (x % 3) * 3, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!showAir) return;
  for (let i = 0; i < 3; i++) {
    const distance = (i + cycle) * 35;
    const x = 223 + distance;
    const height = 24 + 0.22 * distance;
    ctx.globalAlpha = Math.min(1, distance / 13, (105 - distance) / 22);
    ctx.beginPath();
    ctx.moveTo(x, 116 - height);
    ctx.quadraticCurveTo(x + 14, 116, x, 116 + height);
    ctx.strokeStyle = '#226961';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSpeakerLabels(ctx, displacement) {
  const connector = '#496760';
  speakerStroke(ctx, connector, 1.25, [[52, 34], [52, 61], [70, 89]]);
  speakerStroke(ctx, connector, 1.25, [[167, 34], [167, 53], [174 + displacement, 78]]);
  speakerStroke(ctx, connector, 1.25, [[88, 190], [101 + displacement, 168], [112 + displacement, 130]]);
  ctx.fillStyle = '#173c35';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Aimant fixe', 52, 27);
  ctx.fillText('Membrane', 167, 27);
  ctx.fillText('Air', 271, 27);
  ctx.fillText('Bobine', 87, 207);
}

function updateSpeakerDiagram(root, displacement, direction, showAir, phase = 0) {
  const canvas = root.querySelector('.speaker-cutaway');
  const displayWidth = canvas?.clientWidth;
  if (!displayWidth) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(displayWidth * pixelRatio);
  const height = Math.round(width * SPEAKER_DIAGRAM_HEIGHT / SPEAKER_DIAGRAM_WIDTH);
  if (width !== canvas.width || height !== canvas.height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dx = displacement * 9;
  ctx.setTransform(width / SPEAKER_DIAGRAM_WIDTH, 0, 0, height / SPEAKER_DIAGRAM_HEIGHT, 0, 0);
  ctx.fillStyle = '#eef2e8';
  ctx.fillRect(0, 0, SPEAKER_DIAGRAM_WIDTH, SPEAKER_DIAGRAM_HEIGHT);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawSpeakerAir(ctx, showAir, phase);
  drawSpeakerBody(ctx);
  drawSpeakerMovingParts(ctx, dx, direction);
  drawSpeakerLabels(ctx, dx);
}

// ===== vue/speaker-workshop.js =====
class SpeakerWorkshop {
  constructor(root) {
    this.root = root;
    this.mode = 'motion';
    this.current = 0;
    this.displacement = 0;
    this.vibrating = false;
    this.pitch = 240;
    this.phase = 0;
    this.tone = null;
    root.innerHTML = `
      <header class="workshop-head speaker-head">
        <a class="back" href="#application">← Applications</a>
        <h1 id="workshop-title">Comment le haut-parleur produit du son</h1>
        <p>Dans une enceinte ou un casque, un aimant aide à transformer un courant électrique en son.</p>
      </header>
      <div class="workshop-grid speaker-grid">
        <section class="workshop-visual speaker-visual" aria-label="Haut-parleur vu de côté">
          ${speakerDiagramMarkup()}
          <p id="speaker-motion-status" role="status"></p>
        </section>
        <div class="speaker-controls">
          <div class="speaker-modes" role="group" aria-label="Expériences du haut-parleur">
            <button class="btn" id="speaker-mode-motion" type="button" aria-controls="speaker-motion-controls">Déplacer</button>
            <button class="btn" id="speaker-mode-vibration" type="button" aria-controls="speaker-vibration-controls">Faire vibrer</button>
          </div>
          <section id="speaker-motion-controls" aria-labelledby="speaker-motion-title">
            <h2 id="speaker-motion-title">Déplace la membrane</h2>
            <p>La bobine est un fil enroulé. Elle est attachée à la membrane, la pièce qui pousse l’air. Inverse le courant dans le fil et regarde quelles pièces bougent.</p>
            <div class="speaker-current" role="group" aria-label="Courant dans la bobine">
              <button class="btn" id="speaker-current-out" type="button">Sens 1</button>
              <button class="btn" id="speaker-current-off" type="button">Courant coupé</button>
              <button class="btn" id="speaker-current-in" type="button">Sens 2</button>
            </div>
            <p id="speaker-force-help" hidden>L’aimant reste fixe. Son champ exerce une force sur la bobine quand le courant passe. Inverse le courant et la force change de sens. Avec un courant de sens constant, la membrane reste décalée.</p>
          </section>
          <section id="speaker-vibration-controls" aria-labelledby="speaker-vibration-title" hidden>
            <h2 id="speaker-vibration-title">Fais vibrer la membrane</h2>
            <p>Si le courant change de sens en boucle, la membrane va et vient. Elle comprime puis relâche l’air. Cette vibration se propage jusqu’à l’oreille.</p>
            <div class="speaker-actions">
              <button class="btn" id="speaker-vibration" type="button"></button>
              <button class="btn" id="speaker-listen" type="button"></button>
            </div>
            <p class="speaker-audio-error" id="speaker-audio-error" role="status" hidden>Le son est indisponible dans ce navigateur. Le dessin montre toujours la vibration de l’air.</p>
            <label class="speaker-pitch-label" for="speaker-pitch"><strong>Vitesse des allers-retours</strong> <output id="speaker-pitch-value" for="speaker-pitch">240 Hz</output></label>
            <input id="speaker-pitch" type="range" min="180" max="720" step="10" value="240" aria-describedby="speaker-pitch-help">
            <div class="speaker-range-labels" aria-hidden="true"><span>Plus grave</span><span>Plus aigu</span></div>
            <p id="speaker-pitch-help">240 Hz veut dire 240 allers-retours par seconde. Le dessin ralentit le mouvement pour qu’on puisse le suivre.</p>
          </section>
          <details id="speaker-quiz" class="speaker-quiz">
            <summary>Teste ta compréhension</summary>
            <p>D’où vient le son qui arrive à ton oreille ?</p>
            <div class="guide-options">
              <button class="guide-option" type="button" data-speaker-answer="0" aria-pressed="false">De l’aimant qui vibre</button>
              <button class="guide-option" type="button" data-speaker-answer="1" aria-pressed="false">De l’air mis en vibration par la membrane</button>
            </div>
            <p id="speaker-feedback" role="status" hidden></p>
          </details>
        </div>
      </div>`;

    const elements = this.el = {};
    for (const key of ['mode-motion', 'mode-vibration', 'motion-controls', 'vibration-controls',
      'current-out', 'current-off', 'current-in', 'force-help', 'motion-status', 'vibration', 'listen',
      'audio-error', 'pitch', 'pitch-value', 'pitch-help', 'feedback']) {
      elements[key] = qs('#speaker-' + key, root);
    }
    elements['mode-motion'].onclick = () => this.setMode('motion');
    elements['mode-vibration'].onclick = () => this.setMode('vibration');
    elements['current-out'].onclick = () => this.setCurrent(1);
    elements['current-in'].onclick = () => this.setCurrent(-1);
    elements['current-off'].onclick = () => this.setCurrent(0);
    elements.vibration.onclick = () => {
      this.vibrating = !this.vibrating;
      if (!this.vibrating) this.stopAudio();
      this.refresh();
    };
    elements.listen.onclick = () => {
      if (this.tone) this.stopAudio();
      else {
        this.vibrating = true;
        this.startAudio();
      }
      this.refresh();
    };
    elements.pitch.oninput = () => this.setPitch(Number(elements.pitch.value));

    const answers = qsa('[data-speaker-answer]', root);
    answers.forEach(button => {
      button.onclick = () => {
        const correct = button.dataset.speakerAnswer === '1';
        answers.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
        elements.feedback.className = correct ? 'guide-fb ok' : 'guide-fb no';
        elements.feedback.hidden = false;
        elements.feedback.textContent = correct
          ? 'Bien vu ! L’aimant reste fixe. La membrane suit les mouvements de la bobine et fait vibrer l’air.'
          : 'Regarde l’aimant pendant la vibration. Quelle pièce bouge au contact de l’air ?';
      };
    });
    this.onVisibilityChange = () => {
      if (!document.hidden || !this.tone) return;
      this.stopAudio();
      this.refresh();
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(qs('.speaker-cutaway', root));
    this.setPitch(this.pitch);
    this.refresh();
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.stopAudio();
    this.vibrating = false;
    this.current = 0;
    this.mode = mode;
    this.refresh();
  }

  setCurrent(current) {
    this.current = current;
    if (current) this.el['force-help'].hidden = false;
    this.refresh();
  }

  setPitch(pitch) {
    this.pitch = pitch;
    this.el['pitch-value'].textContent = pitch + ' Hz';
    this.el.pitch.setAttribute('aria-valuetext', pitch + ' allers-retours par seconde');
    this.el['pitch-help'].textContent = pitch + ' Hz veut dire ' + pitch +
      ' allers-retours par seconde. Le dessin ralentit le mouvement pour qu’on puisse le suivre.';
    if (this.tone) this.tone.oscillator.frequency.setTargetAtTime(pitch, Snd.ctx.currentTime, 0.02);
  }

  startAudio() {
    const error = this.el['audio-error'];
    error.hidden = Snd.ensure();
    if (!error.hidden) return;

    const ctx = Snd.ctx;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.frequency.value = this.pitch;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setTargetAtTime(0.055, ctx.currentTime, 0.015);
    oscillator.connect(gain);
    gain.connect(Snd.master);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    oscillator.start();
    this.tone = { oscillator, gain };
    if (ctx.state !== 'running') ctx.resume().catch(() => {
      if (this.tone?.oscillator !== oscillator) return;
      this.stopAudio();
      error.hidden = false;
      this.refresh();
    });
  }

  stopAudio() {
    if (!this.tone) return;
    const { oscillator, gain } = this.tone;
    const ctx = Snd.ctx;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
    oscillator.stop(ctx.currentTime + 0.07);
    this.tone = null;
  }

  refresh() {
    const direct = this.mode === 'motion';
    const el = this.el;
    const press = (key, value) => el[key].setAttribute('aria-pressed', String(value));
    press('mode-motion', direct);
    press('mode-vibration', !direct);
    el['motion-controls'].hidden = !direct;
    el['vibration-controls'].hidden = direct;
    press('current-out', this.current === 1);
    press('current-in', this.current === -1);
    press('current-off', this.current === 0);
    press('vibration', this.vibrating);
    press('listen', Boolean(this.tone));
    el.vibration.textContent = this.vibrating ? 'Arrêter la vibration' : 'Lancer la vibration';
    el.listen.textContent = this.tone ? 'Couper le son' : 'Écouter le son';
    el['motion-status'].textContent = this.vibrating ? 'La membrane va et vient. L’air vibre.' :
      this.current === 1 ? 'La bobine et la membrane se décalent vers l’air.' :
      this.current === -1 ? 'La bobine et la membrane se décalent vers l’aimant.' : 'Courant coupé. La membrane est au repos.';
    this.draw();
  }

  draw() {
    updateSpeakerDiagram(this.root, this.displacement, this.current, this.vibrating, this.phase);
  }

  frame(dt) {
    const target = this.current;
    if (this.vibrating) {
      this.phase = (this.phase + 2 * Math.PI * this.pitch * dt / 240) % (2 * Math.PI);
      this.displacement = Math.sin(this.phase) * 0.76;
    } else {
      if (this.displacement === target) return;
      this.displacement += (target - this.displacement) * (1 - Math.exp(-16 * dt));
      if (Math.abs(this.displacement - target) < 0.004) this.displacement = target;
    }
    this.draw();
  }

  destroy() {
    this.stopAudio();
    this.resize.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}

export { MODELS, DECOUVERTE, GRANDEURS, REFS, PAL, frNum, ApplicationWorkshop, DiskPlayground, SpeakerWorkshop, FilingsSim };
