/**
 * body-gl.js — RENDERER BIO-CHAMBER TERTUTUP VIA WEBGL2 (SDF radial terdeformasi).
 *
 * Mencetak ARENA (bukan MAP): satu chamber tertutup per visual. Geometri dinding
 * dibaca dari array radii hasil simulasi spring-mass `BioChamber` (satu sumber
 * kebenaran dengan collision), sehingga dinding yang PENYOK saat ditabrak juga
 * terlihat penyok di layar (soft-body mesh). Shading per-piksel mengikuti pilar
 * visual referensi: interior backlit + haze + ray + massa honeycomb, pita
 * crimson glossy berspecular + rumbai tuft, mosaik voronoi tissue ber-grout
 * gelap + AO, vignette lipat, grain, pulsasi BPM, plus efek state-machine:
 * nada infeksi saat LOCKDOWN, pori SPORE VENTS menyala saat SWARM, cincin
 * shockwave bioluminesensi saat PURIFIED, dan mulut pintu teal saat OPEN.
 *
 * Fallback: Canvas 2D (body-micro.js) bila WebGL2 tiada (jsdom/perangkat lama).
 */
import { heartbeat, cameraOf } from './background.js';
import { CHAMBER_POINTS } from '../systems/bio-chamber.js';

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
uniform vec2 u_center;
uniform float u_radii[${CHAMBER_POINTS}];
uniform vec3 u_glow;      // interior glow rgb
uniform vec3 u_glowHot;
uniform vec3 u_fill;      // palet organ
uniform vec3 u_deep;
uniform float u_state;    // 0 lockdown 1 swarm 2 purified 3 open
uniform float u_shock;    // 0..1
uniform float u_door;     // sudut pintu
uniform float u_open;     // 0..1
uniform float u_vents[8];
uniform int u_nVents;
uniform vec3 u_pill[12];   // pilar internal xy+radius (massa gelap non-konveks)
uniform int u_nPill;
uniform float u_motif;     // 0 cobble 1 fringe paru 2 striasi jantung 3 rugae 4 mielin 5 folikel
out vec4 frag;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
vec3 vor(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0, h1 = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; h1 = hash(i + g + 3.3); } else if (d < f2) { f2 = d; }
  }
  return vec3(sqrt(f2) - sqrt(f1), h1, f1);
}
float radAt(float a) {
  float f = fract(a / 6.2831853) * ${CHAMBER_POINTS}.0;
  int i = int(floor(f)) % ${CHAMBER_POINTS};
  int j = (i + 1) % ${CHAMBER_POINTS};
  float t = f - floor(f);
  return u_radii[i] * (1.0 - t) + u_radii[j] * t;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 w = u_cam + vec2(px.x - u_res.x * 0.5, u_res.y * 0.5 - px.y) / u_scale;
  vec2 q = w - u_center;
  float r = length(q);
  float a = atan(q.y, q.x);
  float d = r - radAt(a);                       // SDF dinding terdeformasi
  float W = 16.0 * (1.0 + 0.05 * u_beat);
  d += 6.0 * (fbm(w * 0.012) - 0.5);            // kelok organik

  // sektor pintu terbuka = mulut keluar (dinding menghilang, glow teal)
  float da = abs(mod(a - u_door + 3.14159265, 6.2831853) - 3.14159265);
  float doorMask = u_open * smoothstep(0.34, 0.10, da);

  // PILAR internal: SDF komplemen — ruang main = dalam dinding DI LUAR pilar
  float dP = 1e9;
  for (int i = 0; i < 12; i++) {
    if (i >= u_nPill) break;
    dP = min(dP, length(w - u_pill[i].xy) - u_pill[i].z);
  }
  if (u_nPill > 0) d = max(d, -dP);

  // ---- INTERIOR ----
  // PILAR 3 SPEC: DISTORSI UV PERLIN BERDENYUT — jaringan interior "bernapas"
  // mengikuti heartbeat (u_beat), bukan w statis.
  vec2 wi = w + (vec2(fbm(w * 0.008 + vec2(u_time * 0.05, 0.0)),
                      fbm(w * 0.008 + vec2(0.0, u_time * 0.05))) - 0.5)
              * (22.0 + 40.0 * u_beat);
  vec3 colIn = mix(u_glowHot, u_fill * 1.10, smoothstep(-150.0, -16.0, d));
  colIn += 0.12 * fbm(wi * 0.006 + vec2(0.0, u_time * 0.03)) * vec3(1.0, 0.75, 0.45);
  colIn += pow(max(0.0, sin(wi.x * 0.018 + fbm(wi * 0.004) * 4.0)), 8.0) * 0.16 * vec3(1.0, 0.85, 0.55);
  float cm = r / max(1.0, radAt(a));
  if (cm < 0.55) {
    vec3 v = vor(wi * 0.052);
    vec3 mass = mix(vec3(0.40, 0.23, 0.19), vec3(0.56, 0.35, 0.26), v.y);
    mass *= 0.72 + 0.28 * smoothstep(0.0, 0.14, v.x);
    colIn = mix(colIn, mass, smoothstep(0.52, 0.30, cm) * 0.60);
  }
  colIn += pow(noise(wi * 0.14 - vec2(0.0, u_time * 0.6)), 14.0) * 0.35;   // debu
  // PILAR 2 SPEC: BIOLUMINESSENSI pengembara di sepanjang membran dalam —
  // tiga titik cahaya teal mengarungi cincin, hanya di dalam dinding.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float la = u_time * (0.11 + 0.047 * fi) + fi * 2.094;
    vec2 lp = u_center + vec2(cos(la), sin(la)) * max(40.0, radAt(la) - 52.0);
    float ld = length(w - lp);
    colIn += exp(-pow(ld / 115.0, 2.0)) * vec3(0.30, 1.0, 0.82)
           * (0.26 + 0.18 * sin(u_time * 2.1 + fi * 2.4)) * (1.0 - step(0.0, d));
  }
  // LOCKDOWN: nada infeksi gelap merah-oranye
  colIn = mix(colIn, colIn * vec3(1.25, 0.55, 0.35) * 0.75, (1.0 - step(0.5, u_state)) * 0.55);
  // SPORE VENTS menyala saat SWARM
  for (int i = 0; i < 8; i++) {
    if (i >= u_nVents) break;
    float va = u_vents[i];
    float vd = abs(mod(a - va + 3.14159265, 6.2831853) - 3.14159265);
    float ring = exp(-pow((d + 34.0) / 26.0, 2.0));
    colIn += step(0.5, u_state) * (1.0 - step(1.5, u_state)) *
             exp(-pow(vd / 0.16, 2.0)) * ring * vec3(1.0, 0.55, 0.25) * (0.6 + 0.4 * sin(u_time * 9.0 + float(i)));
  }
  // SHOCKWAVE purified: cincin bioluminesensi menyapu
  float shockR = u_shock * (radAt(a) + 60.0);
  colIn += (1.0 - step(0.0, u_shock - 0.001)) * 0.0; // placeholder no-op
  colIn += step(1.5, u_state) * (1.0 - step(2.5, u_state)) *
           exp(-pow((r - shockR) / 34.0, 2.0)) * vec3(0.45, 1.0, 0.85) * (1.0 - u_shock) * 1.2;
  // mulut pintu: glow teal
  colIn = mix(colIn, vec3(0.30, 0.88, 0.82), doorMask * smoothstep(-20.0, -120.0, d) * 0.7);

  // ---- BAND DINDING ----
  float t = clamp((d + W) / (2.0 * W), 0.0, 1.0);
  vec3 wDark = vec3(0.32, 0.04, 0.10), wBright = vec3(0.86, 0.11, 0.17);
  vec3 colBand = mix(wDark, wBright, smoothstep(0.0, 0.38, t));
  colBand = mix(colBand, wDark * 0.75, smoothstep(0.72, 1.0, t));
  colBand += exp(-pow((t - 0.30) * 9.0, 2.0)) * vec3(1.0, 0.55, 0.55) * 0.55;
  float fr = fbm(w * 0.013);
  colBand = mix(colBand, vec3(0.74, 0.26, 0.19), smoothstep(0.44, 0.76, fr) * smoothstep(0.35, 1.0, t));
  colBand = mix(colBand, colBand * vec3(1.2, 0.6, 0.4), (1.0 - step(0.5, u_state)) * 0.4); // infeksi

  // ---- MOTIF DINDING PER-ORGAN (analisis Pathogenic: dinding bermotif organ) ----
  float arc = a * 340.0;
  if (u_motif < 0.5) {           // 0: cobblestone endotel (pembuluh/kapiler)
    vec3 vv = vor(vec2(arc * 0.06, d * 0.06));
    colBand = mix(colBand, colBand * (0.75 + 0.5 * smoothstep(0.0, 0.25, vv.x)), 0.7);
    colBand += (1.0 - smoothstep(0.02, 0.10, vv.x)) * vec3(0.35, 0.10, 0.10) * 0.5;
  } else if (u_motif < 1.5) {    // 1: fringe silia berayun (paru)
    float fr2 = sin(arc * 0.9 + sin(u_time * 3.0 + arc * 0.13) * 2.0);
    float fringe = smoothstep(0.2, 0.9, fr2) * smoothstep(-W - 30.0, -W - 4.0, d) * step(d, -W + 8.0);
    colBand += fringe * vec3(1.0, 0.45, 0.55) * 0.55;
    colIn += fringe * vec3(1.0, 0.40, 0.55) * 0.35;
  } else if (u_motif < 2.5) {    // 2: striasi serat otot (jantung)
    float st2 = sin(arc * 0.35) * 0.5 + 0.5;
    colBand *= 0.80 + 0.35 * st2;
  } else if (u_motif < 3.5) {    // 3: lipatan rugae (lambung)
    float rg = sin(arc * 0.12 + sin(d * 0.05) * 2.0);
    colBand *= 0.82 + 0.30 * smoothstep(0.3, 0.9, rg);
  } else if (u_motif < 4.5) {    // 4: pita mielin (saraf)
    float my = step(0.5, fract(arc * 0.045));
    colBand = mix(colBand, colBand * vec3(1.25, 1.15, 0.95), my * 0.5);
  } else {                       // 5: nodul folikel (limfe)
    float nd = sin(arc * 0.22) * sin(d * 0.22);
    colBand += smoothstep(0.55, 0.95, nd) * vec3(0.45, 0.35, 0.15) * 0.5;
  }

  // ---- TISSUE LUAR ----
  vec3 v3 = vor(w * 0.046 + 0.45 * vec2(sin(w.y * 0.017), cos(w.x * 0.017)));
  vec3 c1 = vec3(0.15, 0.31, 0.62), c2 = vec3(0.09, 0.48, 0.53), c3 = vec3(0.70, 0.19, 0.22);
  vec3 tc = v3.y < 0.55 ? c1 : (v3.y < 0.80 ? c2 : c3);
  tc *= 0.70 + 0.55 * fract(v3.y * 7.31);
  vec3 colOut = mix(vec3(0.05, 0.02, 0.07), tc, smoothstep(0.0, 0.11, v3.x));
  colOut += 0.16 * smoothstep(0.55, 1.0, fract(v3.y * 3.7)) * tc;
  colOut += 0.22 * (1.0 - smoothstep(0.05, 0.42, v3.z)) * tc;
  colOut *= 0.16 + 0.84 * smoothstep(0.0, 95.0, d);
  colOut *= 0.50 + 0.50 * smoothstep(0.25, 0.75, fbm(w * 0.0016));

  // ---- komposisi + pintu melubangi dinding ----
  vec3 col = mix(colIn, colBand, smoothstep(-W - 2.0, -W + 2.0, d));
  col = mix(col, colOut, smoothstep(W - 2.0, W + 2.0, d));
  col = mix(col, vec3(0.25, 0.85, 0.80) * (0.7 + 0.3 * u_beat), doorMask * smoothstep(W + 4.0, -W - 4.0, -abs(d)) * 0.9);

  // massa pilar: gelap ber-rim menyala (cover bullet-hell ala chamber jantung)
  if (u_nPill > 0) {
    vec3 pc = mix(vec3(0.12, 0.04, 0.08), vec3(0.32, 0.08, 0.14), smoothstep(-60.0, 0.0, dP));
    pc += exp(-pow(dP / 12.0, 2.0)) * vec3(1.0, 0.45, 0.38) * 0.55;
    pc += 0.10 * fbm(w * 0.02);
    col = mix(col, pc, step(dP, 0.0));
  }

  vec2 qn = px / u_res;
  col *= 0.22 + 0.78 * pow(clamp(16.0 * qn.x * qn.y * (1.0 - qn.x) * (1.0 - qn.y), 0.0, 1.0), 0.30);
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
      for (const n of ['u_res', 'u_cam', 'u_scale', 'u_time', 'u_beat', 'u_center', 'u_radii', 'u_glow', 'u_glowHot', 'u_fill', 'u_deep', 'u_state', 'u_shock', 'u_door', 'u_open', 'u_vents', 'u_nVents', 'u_pill', 'u_nPill', 'u_motif']) {
        this.u[n] = gl.getUniformLocation(prog, n);
      }
      this.radii = new Float32Array(CHAMBER_POINTS);
      this.vents = new Float32Array(8);
      this.ok = true;
    } catch (err) {
      this.ok = false;
      this.err = String((err && err.message) || err);
    }
  }

  /** Palet chamber dari definisi arena (data-driven). */
  setPalette(def) {
    const MOTIF = { kapiler: 0, aliran_darah: 0, paru: 1, jantung: 2, lambung: 3, saraf: 4, limfe: 5 };
    this.motif = MOTIF[(def && def.id) || ''] != null ? MOTIF[(def && def.id) || ''] : 0;
    if (!this.ok) return;
    const wall = (def && def.wall) || {};
    const it = wall.interior || {};
    const rgb = (s, d) => (s || d).split(',').map((v) => Number(v) / 255);
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniform3fv(this.u.u_glow, rgb(it.glow, '255,186,104'));
    gl.uniform3fv(this.u.u_glowHot, rgb(it.glowHot, '255,232,168'));
    gl.uniform3fv(this.u.u_fill, rgb(it.edge, '214,116,58'));
    gl.uniform3fv(this.u.u_deep, rgb(it.mottle, '196,120,84'));
  }

  render(run, P, time, chamber) {
    if (!this.ok || !chamber) return false;
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
    gl.uniform1f(this.u.u_beat, heartbeat(time, chamber.bpm || 72));
    gl.uniform2f(this.u.u_center, chamber.cx, chamber.cy);
    gl.uniform1fv(this.u.u_radii, chamber.radiiArray(this.radii));
    const st = chamber.state === 'lockdown' || chamber.state === 'entry' ? 0
      : chamber.state === 'swarm' ? 1 : chamber.state === 'purified' ? 2 : 3;
    gl.uniform1f(this.u.u_state, st);
    gl.uniform1f(this.u.u_shock, chamber.shock || 0);
    gl.uniform1f(this.u.u_door, chamber.doorAngle);
    gl.uniform1f(this.u.u_open, chamber.openAmt || 0);
    const pills = new Float32Array(36);
    const np = Math.min(12, (chamber.pillars || []).length);
    for (let i = 0; i < np; i++) {
      const pl = chamber.pillars[i];
      pills[i * 3] = pl.x; pills[i * 3 + 1] = pl.y; pills[i * 3 + 2] = pl.r;
    }
    gl.uniform3fv(this.u.u_pill, pills);
    gl.uniform1i(this.u.u_nPill, np);
    gl.uniform1f(this.u.u_motif, this.motif || 0);
    for (let i = 0; i < 8; i++) this.vents[i] = i < chamber.vents.length ? chamber.vents[i].a : 0;
    gl.uniform1fv(this.u.u_vents, this.vents);
    gl.uniform1i(this.u.u_nVents, Math.min(8, chamber.vents.length));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return gl.getError() === gl.NO_ERROR;
  }
}
