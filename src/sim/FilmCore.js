import { TAU, GAMMA, MU0 } from './math.js'
import { makeFFT2 } from './fft.js'

// Moteur micromagnétique 2D commun à tous les modes films et Sandbox.
export class FilmCore {
  constructor(nx, ny, dx, o) {
    o = o || {};
    const n = nx * ny;
    this.nx = nx; this.ny = ny; this.n = n; this.dx = dx; this.dy = o.dy || dx;
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
    // Optionnel : anisotropie spatiale (J/m³), utilisée pour le pinning.
    // Le terme d’énergie est K_i (1 - m_z²).
    this.Kmap = null;
    this.extraFieldBound = 0;
    // Champ local (T) par cellule, ex. aimant virtuel ; null = inactif.
    this.localOn = false;
    this.lbx = new Float64Array(n); this.lby = new Float64Array(n); this.lbz = new Float64Array(n);
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
    const dx = this.dx, dy = this.dy, Ms = this.Ms;
    this.cEx = 2 * this.A / (Ms * dx * dx);
    this.cExY = 2 * this.A / (Ms * dy * dy);
    this.cD = this.D / (Ms * dx);
    this.cDY = this.D / (Ms * dy);
    // Convention: w_D = D[m_z div(m) - (m · grad)m_z].
    // Natural edge condition: partial_n m = -(D/2A) [(z cross n) cross m].
    // Implemented via one-sided finite-volume ghost cells (cell-centered mesh).
    this.dmiEdgeSlope = this.A > 0 ? this.D / (2 * this.A) : 0;
    this.cK = 2 * this.Kc / Ms;
    this.cKmap = null;
    let maxK = Math.abs(this.Kc);
    if (this.Kmap) {
      this.cKmap = new Float64Array(this.n);
      for (let i = 0; i < this.n; i++) {
        this.cKmap[i] = 2 * this.Kmap[i] / Ms;
        maxK = Math.max(maxK, Math.abs(this.Kmap[i]));
      }
    }
    this.inv2dx = 1 / (2 * dx); this.inv2dy = 1 / (2 * dy);
    let stiff = 4 * (this.cEx + this.cExY) + 2 * maxK / Ms + 2 * (Math.abs(this.cD) + Math.abs(this.cDY));
    stiff += Math.sqrt(this.Bx * this.Bx + this.By * this.By + this.Bz * this.Bz) + this.acAmp + (this.extraFieldBound || 0);
    stiff += (Math.abs(this.ux) / dx + Math.abs(this.uy) / dy) / GAMMA;
    if (this.demagOn) {
      stiff += MU0 * Ms;
      this.buildKernel();
    }
    this.dt = 1.0 / (GAMMA * stiff);
  }

  buildKernel() {
    const P = this.P, dx = this.dx, dy = this.dy, t = this.thickness;
    for (let ky = 0; ky < P; ky++) {
      const iy = ky < P / 2 ? ky : ky - P, kyv = TAU * iy / (P * dy);
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
    const cEx = this.cEx, cExY = this.cExY, cD = this.cD, cDY = this.cDY, cK = this.cK, cKmap = this.cKmap, al = this.alpha;
    const bx0 = this.Bx, by0 = this.By, bz0 = this.Bz;
    const useD = cD !== 0, ux = this.ux, uy = this.uy, useZ = ux !== 0 || uy !== 0;
    const i2 = this.inv2dx, j2 = this.inv2dy, beta = this.beta;
    const useAc = this.acAmp !== 0 && this.acS !== null;
    let acv = 0;
    if (useAc) acv = this.acAmp * Math.sin(this.acOmega * t + this.acPhi);
    const acS = this.acS, adx = this.acDx, ady = this.acDy, adz = this.acDz;
    const dm = this.demagOn, hx = this.hdx, hy = this.hdy, hz = this.hdz;
    const lf = this.localOn, lbx = this.lbx, lby = this.lby, lbz = this.lbz;
    for (let q = 0; q < na; q++) {
      const i = act[q], l = L[i], r = R[i], u = U[i], d = Dn[i];
      const x = ax[i], y = ay[i], z = az[i];
      let lx = ax[l], ly = ay[l], lz = az[l];
      let rx = ax[r], ry = ay[r], rz = az[r];
      let uxv = ax[u], uyv = ay[u], uz = az[u];
      let dxv = ax[d], dyv = ay[d], dz = az[d];
      // Cell-centered finite-volume edges. The previous code repeated the
      // boundary cell (zero normal derivative), although interfacial DMI
      // requires an edge canting. Here the missing neighbors are ghost spins
      // satisfying the natural exchange+DMI boundary condition to O(dx,dy).
      // For D=0, the original free-exchange boundary condition is retained.
      if (useD && this.dmiEdgeSlope !== 0) {
        const sx = this.dmiEdgeSlope * this.dx;
        const sy = this.dmiEdgeSlope * this.dy;
        if (this.nx > 1 && l === i) { lx = x + sx * z; lz = z - sx * x; }
        if (this.nx > 1 && r === i) { rx = x - sx * z; rz = z + sx * x; }
        if (this.ny > 1 && d === i) { dyv = y + sy * z; dz = z - sy * y; }
        if (this.ny > 1 && u === i) { uyv = y - sy * z; uz = z + sy * y; }
      }
      let Bx = bx0 + cEx * (lx + rx - 2 * x) + cExY * (dxv + uxv - 2 * x);
      let By = by0 + cEx * (ly + ry - 2 * y) + cExY * (dyv + uyv - 2 * y);
      let Bz = bz0 + cEx * (lz + rz - 2 * z) + cExY * (dz + uz - 2 * z) + (cKmap ? cKmap[i] : cK) * z;
      if (useD) {
        Bx += cD * (rz - lz);
        By += cDY * (uz - dz);
        Bz -= cD * (rx - lx) + cDY * (uyv - dyv);
      }
      if (useAc) {
        const s = acv * acS[i];
        Bx += s * adx; By += s * ady; Bz += s * adz;
      }
      if (dm) { Bx += hx[i]; By += hy[i]; Bz += hz[i]; }
      if (lf) { Bx += lbx[i]; By += lby[i]; Bz += lbz[i]; }
      const a = al[i], g = GAMMA / (1 + a * a);
      const cx = y * Bz - z * By, cy = z * Bx - x * Bz, cz = x * By - y * Bx;
      let tx = -g * (cx + a * (y * cz - z * cy));
      let ty = -g * (cy + a * (z * cx - x * cz));
      let tz = -g * (cz + a * (x * cy - y * cx));
      if (useZ) {
        const Dx = ux * (ax[r] - ax[l]) * i2 + uy * (ax[u] - ax[d]) * j2;
        const Dy = ux * (ay[r] - ay[l]) * i2 + uy * (ay[u] - ay[d]) * j2;
        const Dz = ux * (az[r] - az[l]) * i2 + uy * (az[u] - az[d]) * j2;
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
