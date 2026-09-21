/**
 * body-gl.js — RENDERER DUNIA KONTINU VIA WEBGL2 (SDF fragment shader).
 *
 * Alasan: bahasa visual video referensi (mosaik voronoi multi-hue, pita crimson
 * glossy berspecular, fringe fbm irregular, interior haze + ray + massa
 * honeycomb, AO celah, vignette lipat, grain) adalah operasi PER-PIKSEL yang
 * tidak terjangkau Canvas 2D gradients. Shader ini menghitung union SDF
 * chamber+pembuluh dari DATA YANG SAMA dengan body-world.js (satu sumber
 * kebenaran geometri) dan men-shading tiap piksel.
 *
 * Fallback: bila WebGL2 tidak tersedia (jsdom, perangkat lama) game.js kembali
 * ke renderer Canvas 2D (body-micro.js). Entitas/HUD tetap di canvas utama;
 * lapisan GL di-drawImage ke bawahnya.
 */
import { heartbeat, cameraOf } from './background.js';

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform vec2 u_cam;
uniform float u_scale;
uniform float u_time;
uniform float u_beat;
uniform int u_nCh;
uniform vec4 u_ch[16];
uniform vec3 u_chFill[16];
uniform vec3 u_chDeep[16];
uniform int u_nSeg;
uniform vec4 u_seg[64];
uniform float u_segR[64];
uniform float u_segK[64];
out vec4 frag;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// voronoi: F2-F1 (edge) + hash sel
vec3 vor(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0, h1 = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; h1 = hash(i + g + 3.3); }
    else if (d < f2) { f2 = d; }
  }
  return vec3(sqrt(f2) - sqrt(f1), h1, f1);
}
float sdEll(vec2 p, vec4 e) { vec2 q = (p - e.xy) / e.zw; return (length(q) - 1.0) * min(e.z, e.w); }
float sdSeg(vec2 p, vec4 s) {
  vec2 a = s.xy, b = s.zw; vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(1e-6, dot(ba, ba)), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 w = u_cam + vec2(px.x - u_res.x * 0.5, u_res.y * 0.5 - px.y) / u_scale;

  // ---- union SDF lumen + palette chamber terdekat ----
  float d = 1e9; vec3 fill = vec3(0.85, 0.45, 0.30); vec3 deep = vec3(0.45, 0.15, 0.15);
  float cm = 1e9;
  for (int i = 0; i < 16; i++) {
    if (i >= u_nCh) break;
    float di = sdEll(w, u_ch[i]);
    if (di < d) { d = di; fill = u_chFill[i]; deep = u_chDeep[i]; }
    float rn = length((w - u_ch[i].xy) / u_ch[i].zw + 0.30 * vec2(fbm(w * 0.008 + float(i)) - 0.5));
    cm = min(cm, rn);
  }
  float routeD = 1e9;
  for (int i = 0; i < 64; i++) {
    if (i >= u_nSeg) break;
    float di = sdSeg(w, u_seg[i]) - u_segR[i];
    if (di < d) d = di;
    if (u_segK[i] > 2.5) routeD = min(routeD, sdSeg(w, u_seg[i]) - u_segR[i] * 0.5);
  }

  d += 7.0 * (fbm(w * 0.010) - 0.5); // kelok organik boundary (video tidak mulus)
  float W = 15.0 * (1.0 + 0.05 * u_beat);

  // ---- INTERIOR: amber backlit + haze + ray + massa honeycomb + debu ----
  vec3 glowHot = vec3(1.0, 0.76, 0.40);
  float pool = fbm(w * 0.006 + vec2(0.0, u_time * 0.03));
  vec3 colIn = mix(glowHot, fill * 1.10, smoothstep(-140.0, -18.0, d));
  colIn += 0.12 * pool * vec3(1.0, 0.75, 0.45);
  float ray = pow(max(0.0, sin(w.x * 0.018 + fbm(w * 0.004) * 4.0)), 8.0);
  colIn += ray * 0.16 * vec3(1.0, 0.85, 0.55);
  if (cm < 0.52) {
    vec3 v = vor(w * 0.052);
    vec3 mass = mix(vec3(0.40, 0.23, 0.19), vec3(0.56, 0.35, 0.26), v.y);
    mass *= 0.72 + 0.28 * smoothstep(0.0, 0.14, v.x);
    colIn = mix(colIn, mass, smoothstep(0.50, 0.28, cm) * 0.62);
  }
  float dust = pow(noise(w * 0.14 - vec2(0.0, u_time * 0.6)), 14.0);
  colIn += dust * 0.35;
  float tuft = smoothstep(0.55, 0.86, fbm(w * 0.035));
  float lipIn = exp(-pow((d + W * 1.1) / (W * 0.9), 2.0));
  colIn = mix(colIn, vec3(0.46, 0.13, 0.11), tuft * lipIn * 0.85);
  float inRoute = smoothstep(10.0, -30.0, routeD);
  colIn = mix(colIn, vec3(0.30, 0.85, 0.80), inRoute * 0.55);
  float chv = smoothstep(0.55, 0.95, sin((w.x + w.y) * 0.045 - u_time * 2.6)) * smoothstep(10.0, -18.0, routeD);
  colIn += chv * vec3(0.15, 0.65, 0.55) * 0.55;

  // ---- BAND DINDING: pita crimson glossy 3-nada + specular + fringe fbm ----
  float t = clamp((d + W) / (2.0 * W), 0.0, 1.0);
  vec3 wDark = vec3(0.32, 0.04, 0.10), wBright = vec3(0.86, 0.11, 0.17);
  vec3 colBand = mix(wDark, wBright, smoothstep(0.0, 0.38, t));
  colBand = mix(colBand, wDark * 0.75, smoothstep(0.72, 1.0, t));
  float spec = exp(-pow((t - 0.30) * 9.0, 2.0));
  colBand += spec * vec3(1.0, 0.55, 0.55) * 0.55;
  float fr = fbm(w * 0.013);
  colBand = mix(colBand, vec3(0.74, 0.26, 0.19), smoothstep(0.44, 0.76, fr) * smoothstep(0.35, 1.0, t));

  // ---- TISSUE: mosaik voronoi multi-hue + grout gelap + AO + lipatan ----
  vec3 v3 = vor(w * 0.046 + 0.45 * vec2(sin(w.y * 0.017), cos(w.x * 0.017)));
  vec3 c1 = vec3(0.15, 0.31, 0.62), c2 = vec3(0.09, 0.48, 0.53), c3 = vec3(0.70, 0.19, 0.22);
  vec3 tc = v3.y < 0.55 ? c1 : (v3.y < 0.80 ? c2 : c3);
  tc *= 0.70 + 0.55 * fract(v3.y * 7.31);
  float grout = smoothstep(0.0, 0.11, v3.x);
  vec3 colOut = mix(vec3(0.05, 0.02, 0.07), tc, grout);
  colOut += 0.16 * smoothstep(0.55, 1.0, fract(v3.y * 3.7)) * tc; // kilau sel
  colOut += 0.22 * (1.0 - smoothstep(0.05, 0.42, v3.z)) * tc; // punggung sel membulat
  float ao = smoothstep(0.0, 95.0, d);
  colOut *= 0.16 + 0.84 * ao;
  float fold = fbm(w * 0.0016);
  colOut *= 0.50 + 0.50 * smoothstep(0.25, 0.75, fold);

  // ---- komposisi wilayah (AA alami per-pixel) ----
  vec3 col = mix(colIn, colBand, smoothstep(-W - 2.0, -W + 2.0, d));
  col = mix(col, colOut, smoothstep(W - 2.0, W + 2.0, d));

  // ---- vignette lipat gelap + grain ----
  vec2 q = px / u_res;
  float vig = pow(clamp(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.0, 1.0), 0.30);
  col *= 0.22 + 0.78 * vig;
  col += (hash(px + fract(u_time) * 61.7) - 0.5) * 0.035;

  frag = vec4(col, 1.0);
}`;

export class BodyGL {
  constructor() {
    this.ok = false;
    if (typeof document === 'undefined') return;
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) return;
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
      return sh;
    };
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
      this.prog = prog;
      gl.useProgram(prog);
      this.u = {};
      for (const n of ['u_res', 'u_cam', 'u_scale', 'u_time', 'u_beat', 'u_nCh', 'u_ch', 'u_chFill', 'u_chDeep', 'u_nSeg', 'u_seg', 'u_segR', 'u_segK']) {
        this.u[n] = gl.getUniformLocation(prog, n);
      }
      this.ok = true;
    } catch (err) {
      this.ok = false;
      this.err = String(err && err.message || err);
    }
  }

  /** Muat geometri dunia (sekali) ke uniform array. */
  setData(world) {
    if (!this.ok || !world) return false;
    const def = world.def;
    const W = def.world.w, H = def.world.h;
    const XY = (nx, ny) => [nx * W, (1 - ny) * H];
    const gl = this.gl;
    const ch = new Float32Array(16 * 4), fill = new Float32Array(16 * 3), deep = new Float32Array(16 * 3);
    const organs = (def.organs || []).slice(0, 16);
    organs.forEach((o, i) => {
      const [cx, cy] = XY(o.x, o.y);
      ch.set([cx, cy, o.rx * W, o.ry * H], i * 4);
      const rgb = (s, d) => (s || d).split(',').map((v) => Number(v) / 255);
      fill.set(rgb(o.palette && o.palette.fill, '214,110,90'), i * 3);
      deep.set(rgb(o.palette && o.palette.deep, '140,50,44'), i * 3);
    });
    const KIND = { artery: 0, vein: 1, lymph: 2, route: 3 };
    const seg = [], segR = [], segK = [];
    for (const v of def.vessels || []) {
      const pts = (v.points || []).map(([nx, ny]) => XY(nx, ny));
      for (let i = 0; i + 1 < pts.length && seg.length / 4 < 64; i++) {
        seg.push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        segR.push(v.r || 40);
        segK.push(KIND[v.kind] == null ? 1 : KIND[v.kind]);
      }
    }
    this.nCh = organs.length;
    this.nSeg = segR.length;
    this.ch = ch; this.fill = fill; this.deep = deep;
    this.seg = new Float32Array(seg); this.segR = new Float32Array(segR); this.segK = new Float32Array(segK);
    gl.useProgram(this.prog);
    gl.uniform4fv(this.u.u_ch, ch);
    gl.uniform3fv(this.u.u_chFill, fill);
    gl.uniform3fv(this.u.u_chDeep, deep);
    gl.uniform1i(this.u.u_nCh, this.nCh);
    gl.uniform4fv(this.u.u_seg, this.seg);
    gl.uniform1fv(this.u.u_segR, this.segR);
    gl.uniform1fv(this.u.u_segK, this.segK);
    gl.uniform1i(this.u.u_nSeg, this.nSeg);
    return true;
  }

  /** Render satu frame; return true bila sukses (game.js drawImage lapisan ini). */
  render(run, P, time) {
    if (!this.ok) return false;
    const gl = this.gl;
    const w = Math.max(2, Math.round(P.w)), h = Math.max(2, Math.round(P.h));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    const cam = cameraOf(P);
    const s = P.project(cam.x, cam.y).s;
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.u_res, w, h);
    gl.uniform2f(this.u.u_cam, cam.x, cam.y);
    gl.uniform1f(this.u.u_scale, s);
    gl.uniform1f(this.u.u_time, time);
    gl.uniform1f(this.u.u_beat, heartbeat(time, 68));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return gl.getError() === gl.NO_ERROR;
  }
}
