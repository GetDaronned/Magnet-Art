// Rendu WebGL2 haute définition.
// La grille m = (mx, my, mz) est envoyée au GPU dans une texture flottante.
// Pour chaque pixel de l'écran, le shader interpole le VECTEUR m par une
// interpolation bicubique (Catmull-Rom, 4×4 cellules), le renormalise (|m| = 1),
// puis le convertit en couleur via une palette (texture 256×1).
import { buildLut, LUT_SIZE, PALETTES } from './palettes.js'
import { MZ_SHADE, MZ_SHARP } from './renderer.js'

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uM;     // xyz = m, w = masque (1 dans le film)
uniform sampler2D uLut;   // palette
uniform vec2 uGrid;       // nx, ny
uniform vec3 uLay;        // x0, y0, taille d'une cellule (px écran)
uniform float uH;         // hauteur du canvas (px)
uniform int uMode;        // 0 direction, 1 mx, 2 my, 3 mz
uniform float uVmax;
uniform float uLutScale;  // échantillonnage linéaire / cyclique de la palette
uniform float uLutOffset;
uniform vec2 uDisk;       // demi-axes du disque (cellules) ; 0 = rectangle
out vec4 outColor;

const float TAU = 6.283185307179586;

vec4 cell(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uGrid) - 1);
  vec4 v = texelFetch(uM, p, 0);
  return vec4(v.xyz * v.w, v.w);
}

vec4 catmull(float f) {
  return vec4(
    f * (-0.5 + f * (1.0 - 0.5 * f)),
    1.0 + f * f * (-2.5 + 1.5 * f),
    f * (0.5 + f * (2.0 - 1.5 * f)),
    f * f * (-0.5 + 0.5 * f));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uH - gl_FragCoord.y);
  vec2 g = (frag - uLay.xy) / uLay.z;
  g.y = uGrid.y - g.y;
  if (g.x < 0.0 || g.y < 0.0 || g.x > uGrid.x || g.y > uGrid.y) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec2 p = g - 0.5;
  vec2 b = floor(p);
  vec2 f = p - b;
  ivec2 i0 = ivec2(b) - 1;
  vec4 wx = catmull(f.x);
  vec4 wy = catmull(f.y);
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++) {
    vec4 row = wx.x * cell(i0 + ivec2(0, j)) + wx.y * cell(i0 + ivec2(1, j))
             + wx.z * cell(i0 + ivec2(2, j)) + wx.w * cell(i0 + ivec2(3, j));
    acc += wy[j] * row;
  }
  float inside = 1.0;
  if (uDisk.x > 0.0) {
    // Bord du disque : cercle exact, anticrénelé sur ~1 pixel.
    vec2 q = (g - 0.5 * uGrid) / uDisk;
    float edge = (1.0 - length(q)) * min(uDisk.x, uDisk.y) * uLay.z;
    inside = clamp(edge + 0.5, 0.0, 1.0);
  }
  float len = length(acc.xyz);
  vec3 m = len > 1e-6 ? acc.xyz / len : vec3(0.0, 0.0, 1.0);
  // Courbe en S sur mz (MZ_SHARP, renderer.js) : parois plus fines à l'écran.
  float mzs = ${MZ_SHARP > 0 ? `tanh(${MZ_SHARP.toFixed(3)} * m.z) / ${Math.tanh(MZ_SHARP).toFixed(6)}` : 'm.z'};

  vec3 c;
  if (uMode == 0) {
    float phi = fract(atan(m.y, m.x) / TAU);
    c = texture(uLut, vec2(phi, 0.5)).rgb;
    float z = mzs * ${MZ_SHADE.toFixed(3)};
    c = z > 0.0 ? mix(c, vec3(1.0), z) : mix(c, vec3(0.0), -z);
  } else {
    float v = uMode == 1 ? m.x : (uMode == 2 ? m.y : mzs);
    float t = clamp(v / uVmax * 0.5 + 0.5, 0.0, 1.0);
    c = texture(uLut, vec2(t * uLutScale + uLutOffset, 0.5)).rgb;
  }
  outColor = vec4(c * inside, 1.0);
}`

const MODES = { wheel: 0, mx: 1, my: 2, mz: 3 }

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
  return s
}

export class GLRenderer {
  // Lève une exception si WebGL2 n'est pas disponible.
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false })
    if (!gl) throw new Error('WebGL2 indisponible')
    this.gl = gl
    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
    this.prog = prog
    gl.useProgram(prog)

    // Triangle unique couvrant tout l'écran.
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    this.u = {}
    for (const name of ['uM', 'uLut', 'uGrid', 'uLay', 'uH', 'uMode', 'uVmax', 'uLutScale', 'uLutOffset', 'uDisk']) {
      this.u[name] = gl.getUniformLocation(prog, name)
    }
    gl.uniform1i(this.u.uM, 0)
    gl.uniform1i(this.u.uLut, 1)

    this.texM = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texM)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    this.texLut = gl.createTexture()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texLut)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    this.nx = 0
    this.ny = 0
    this.data = null
    this.lutId = null
  }

  setPalette(id) {
    if (id === this.lutId) return
    this.lutId = id
    const gl = this.gl
    const cyclic = PALETTES[id]?.cyclic
    gl.activeTexture(gl.TEXTURE1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, LUT_SIZE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildLut(id))
    const wrap = cyclic ? gl.REPEAT : gl.CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // Palette linéaire : centres des texels extrêmes pour t = 0 et t = 1.
    gl.uniform1f(this.u.uLutScale, cyclic ? 1 : (LUT_SIZE - 1) / LUT_SIZE)
    gl.uniform1f(this.u.uLutOffset, cyclic ? 0 : 0.5 / LUT_SIZE)
  }

  upload(core) {
    const gl = this.gl
    const { nx, ny, n, mx, my, mz, mask } = core
    const resized = nx !== this.nx || ny !== this.ny
    if (resized) {
      this.nx = nx
      this.ny = ny
      this.data = new Float32Array(n * 4)
    }
    const d = this.data
    for (let i = 0; i < n; i++) {
      const o = i * 4
      const on = !mask || mask[i] === 1
      d[o] = mx[i]
      d[o + 1] = my[i]
      d[o + 2] = mz[i]
      d[o + 3] = on ? 1 : 0
    }
    gl.activeTexture(gl.TEXTURE0)
    if (resized) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, nx, ny, 0, gl.RGBA, gl.FLOAT, d)
    else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nx, ny, gl.RGBA, gl.FLOAT, d)
  }

  // lay en pixels CSS ; dpr = rapport pixels physiques / CSS.
  render(core, lay, dpr, opts) {
    const gl = this.gl
    this.setPalette(opts.palette)
    this.upload(core)
    const W = gl.drawingBufferWidth
    const H = gl.drawingBufferHeight
    gl.viewport(0, 0, W, H)
    gl.uniform2f(this.u.uGrid, core.nx, core.ny)
    gl.uniform3f(this.u.uLay, lay.x0 * dpr, lay.y0 * dpr, lay.s * dpr)
    gl.uniform1f(this.u.uH, H)
    gl.uniform1i(this.u.uMode, MODES[opts.mode] ?? 0)
    gl.uniform1f(this.u.uVmax, opts.vmax)
    gl.uniform2f(this.u.uDisk, core.disk ? core.disk.rx : 0, core.disk ? core.disk.ry : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
