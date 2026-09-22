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
uniform vec2 u_player;
uniform float u_radii[${CHAMBER_POINTS}];
uniform vec3 u_glow;      // tint cahaya organ
uniform vec3 u_glowHot;   // rim menyala (putih panas)
uniform vec3 u_fill;      // jaringan dasar (GELAP jenuh)
uniform vec3 u_deep;      // bayangan/grout
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

// DESIGN ULANG 2026-09-22 - "DARK WET CHAMBER": interior jaringan GELAP basah
// dengan kolam cahaya di sekeliling pemain, rim membran putih-panas, pita dinding
// berdaging tebal, dan luar near-black. Kontras tinggi ala chamber Pathogenic.
void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 w = u_cam + vec2(px.x - u_res.x * 0.5, u_res.y * 0.5 - px.y) / u_scale;
  vec2 q = w - u_center;
  float r = length(q);
  float a = atan(q.y, q.x);
  float d = r - radAt(a);                       // SDF dinding terdeformasi
  float W = 26.0 * (1.0 + 0.05 * u_beat);       // pita dinding TEBAL (daging)
  d += 5.0 * (fbm(w * 0.014) - 0.5);            // kelok organik

  // sektor pintu terbuka = mulut keluar (glow teal)
  float da = abs(mod(a - u_door + 3.14159265, 6.2831853) - 3.14159265);
  float doorMask = u_open * smoothstep(0.34, 0.10, da);

  // PILAR internal: ruang main = dalam dinding DI LUAR pilar
  float dP = 1e9;
  for (int i = 0; i < 12; i++) {
    if (i >= u_nPill) break;
    dP = min(dP, length(w - u_pill[i].xy) - u_pill[i].z);
  }
  if (u_nPill > 0) d = max(d, -dP);

  // kolam cahaya pemain (baca bullet-hell + mood gua organ)
  float pool = exp(-pow(length(w - u_player) / 330.0, 2.0));

  // ---- INTERIOR: jaringan gelap basah ----
  vec3 vv = vor(w * 0.045);
  vec3 colIn = u_fill * 0.34;
  colIn *= 0.78 + 0.34 * smoothstep(0.0, 0.18, vv.x);
  colIn = mix(colIn * 0.45, colIn, smoothstep(0.0, 0.06, vv.x));
  colIn += u_deep * 0.12 * fbm(w * 0.02);
  float vein = pow(max(0.0, sin(a * 9.0 + r * 0.05 + fbm(w * 0.01) * 3.0)), 6.0);
  colIn = mix(colIn, u_deep * 0.40, vein * 0.35);
  colIn *= mix(0.50, 1.0, smoothstep(-150.0, -26.0, d));
  float spec = pow(noise(vec2(w.x * 0.09, w.y * 0.03 - u_time * 0.5)), 16.0);
  colIn += spec * (0.22 + 0.55 * pool) * vec3(1.0, 0.55, 0.45);
  colIn *= 0.55 + 0.75 * pool;
  colIn += u_glow * 0.16 * pool;
  // bioluminesensi pengembara (redup, menjaga hidup membran)
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float la = u_time * (0.11 + 0.047 * fi) + fi * 2.094;
    vec2 lp = u_center + vec2(cos(la), sin(la)) * max(40.0, radAt(la) - 52.0);
    float ld = length(w - lp);
    colIn += exp(-pow(ld / 115.0, 2.0)) * vec3(0.30, 1.0, 0.82)
           * (0.16 + 0.12 * sin(u_time * 2.1 + fi * 2.4)) * (1.0 - step(0.0, d));
  }
  // LOCKDOWN: nada infeksi
  colIn = mix(colIn, colIn * vec3(1.30, 0.55, 0.32) * 0.85, (1.0 - step(0.5, u_state)) * 0.45);
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
  colIn += step(1.5, u_state) * (1.0 - step(2.5, u_state)) *
           exp(-pow((r - shockR) / 34.0, 2.0)) * vec3(0.45, 1.0, 0.85) * (1.0 - u_shock) * 1.2;
  // mulut pintu: glow teal
  colIn = mix(colIn, vec3(0.30, 0.88, 0.82), doorMask * smoothstep(-20.0, -120.0, d) * 0.7);

  // ---- PITA DINDING: daging tebal + rim putih-panas ----
  float t = clamp((d + W) / (2.0 * W), 0.0, 1.0);
  vec3 colBand = mix(u_fill * 0.55, u_fill * 0.16, smoothstep(0.0, 0.85, t));
  colBand += u_deep * 0.12 * fbm(w * 0.05);
  float arc = a * 340.0;
  if (u_motif < 0.5) {
    vec3 mv = vor(vec2(arc * 0.06, d * 0.06));
    colBand *= 0.72 + 0.50 * smoothstep(0.0, 0.25, mv.x);
  } else if (u_motif < 1.5) {
    float fr2 = sin(arc * 0.9 + sin(u_time * 3.0 + arc * 0.13) * 2.0);
    float fringe = smoothstep(0.2, 0.9, fr2) * smoothstep(-W - 30.0, -W - 4.0, d) * step(d, -W + 8.0);
    colBand += fringe * u_glow * 0.45;
    colIn += fringe * u_glow * 0.30;
  } else if (u_motif < 2.5) {
    colBand *= 0.78 + 0.38 * (sin(arc * 0.35) * 0.5 + 0.5);
  } else if (u_motif < 3.5) {
    colBand *= 0.80 + 0.32 * smoothstep(0.3, 0.9, sin(arc * 0.12 + sin(d * 0.05) * 2.0));
  } else if (u_motif < 4.5) {
    colBand = mix(colBand, colBand * vec3(1.30, 1.18, 0.95), step(0.5, fract(arc * 0.045)) * 0.45);
  } else {
    colBand += smoothstep(0.55, 0.95, sin(arc * 0.22) * sin(d * 0.22)) * u_glow * 0.30;
  }
  colBand += u_glowHot * exp(-pow((d + 1.5) / 5.0, 2.0)) * 1.25;
  colBand *= 1.0 - 0.55 * smoothstep(0.75, 1.0, t);

  // ---- LUAR: daging near-black ----
  vec3 v3 = vor(w * 0.03);
  vec3 colOut = u_deep * 0.08 + u_fill * 0.05 * smoothstep(0.0, 0.2, v3.x);
  colOut += u_glow * 0.05 * pow(fbm(w * 0.006), 3.0);
  colOut *= 0.35 + 0.65 * exp(-max(0.0, d) / 420.0);

  // ---- komposisi ----
  vec3 col = mix(colIn, colBand, smoothstep(-W - 2.0, -W + 2.0, d));
  col = mix(col, colOut, smoothstep(W - 2.0, W + 2.0, d));
  col = mix(col, vec3(0.25, 0.85, 0.80) * (0.7 + 0.3 * u_beat), doorMask * smoothstep(W + 4.0, -W - 4.0, -abs(d)) * 0.9);

  // pilar: massa near-black ber-rim tipis menyala
  if (u_nPill > 0) {
    vec3 pc = vec3(0.05, 0.015, 0.03) + u_deep * 0.06 * fbm(w * 0.03);
    pc += u_glowHot * 0.35 * exp(-pow(dP / 7.0, 2.0));
    col = mix(col, pc, step(dP, 0.0));
  }

  vec2 qn = px / u_res;
  col *= 0.25 + 0.75 * pow(clamp(16.0 * qn.x * qn.y * (1.0 - qn.x) * (1.0 - qn.y), 0.0, 1.0), 0.35);
  col += (hash(px + fract(u_time) * 61.7) - 0.5) * 0.03;
  col = col / (1.0 + col * 0.55);
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
      for (const n of ['u_res', 'u_cam', 'u_scale', 'u_time', 'u_beat', 'u_center', 'u_player', 'u_radii', 'u_glow', 'u_glowHot', 'u_fill', 'u_deep', 'u_state', 'u_shock', 'u_door', 'u_open', 'u_vents', 'u_nVents', 'u_pill', 'u_nPill', 'u_motif']) {
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
    gl.uniform3fv(this.u.u_glow, rgb(it.glow, '255,110,90'));
    gl.uniform3fv(this.u.u_glowHot, rgb(it.glowHot, '255,220,190'));
    gl.uniform3fv(this.u.u_fill, rgb(it.edge, '132,20,24'));
    gl.uniform3fv(this.u.u_deep, rgb(it.mottle, '58,8,10'));
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
    const plr = (run && run.player) || { x: chamber.cx, y: chamber.cy };
    gl.uniform2f(this.u.u_player, plr.x || chamber.cx, plr.y || chamber.cy);
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
