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

const NCH = 24, NSEG = 96, NOBS = 16;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform vec2 u_cam;
uniform float u_scale;
uniform float u_time;
uniform float u_beat;
uniform vec2 u_center;
uniform vec2 u_player;
uniform vec4 u_ch[${NCH}];    // chamber: xy, radius, motif
uniform int u_nCh;
uniform vec4 u_seg[${NSEG}];  // koridor: x0,y0,x1,y1
uniform float u_segw[${NSEG}];
uniform int u_nSeg;
uniform vec4 u_obs[${NOBS}];  // obstacle: xy, r, kind(0 pilar gelap, 1 segel katup)
uniform int u_nObs;
uniform vec3 u_glow;
uniform vec3 u_glowHot;
uniform vec3 u_fill;
uniform vec3 u_deep;
uniform float u_state;    // 0 lockdown 1 swarm 2 purified 3 open
uniform float u_shock;
uniform float u_door;
uniform float u_open;
uniform float u_vents[8];
uniform int u_nVents;
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
float segD(vec2 w, vec4 s) {
  vec2 pa = w - s.xy, ba = s.zw - s.xy;
  float h = clamp(dot(pa, ba) / max(1e-6, dot(ba, ba)), 0.0, 1.0);
  return length(pa - ba * h);
}

// LABIRIN LUMEN (2026-09-22): satu kesatuan koridor+chamber, art direction
// DARK WET CHAMBER dipertahankan: interior gelap basah, rim putih-panas,
// luar near-black, segel katup teal saat lockdown.
void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 w = u_cam + vec2(px.x - u_res.x * 0.5, u_res.y * 0.5 - px.y) / u_scale;

  float dCh = 1e9, dSeg = 1e9, best = 1e9, motif = 0.0, bestR = 120.0;
  vec2 bestC = u_center;
  for (int i = 0; i < ${NCH}; i++) {
    if (i >= u_nCh) break;
    float rr = u_ch[i].z + 3.0 * u_beat;
    float dd = length(w - u_ch[i].xy) - rr;
    if (dd < best) { best = dd; motif = u_ch[i].w; bestC = u_ch[i].xy; bestR = u_ch[i].z; }
    dCh = min(dCh, dd);
  }
  for (int i = 0; i < ${NSEG}; i++) {
    if (i >= u_nSeg) break;
    dSeg = min(dSeg, segD(w, u_seg[i]) - u_segw[i]);
  }
  float d = min(dCh, dSeg);
  d += 4.0 * (fbm(w * 0.014) - 0.5);
  float dO = 1e9, kind = 0.0;
  for (int i = 0; i < ${NOBS}; i++) {
    if (i >= u_nObs) break;
    float dd = length(w - u_obs[i].xy) - u_obs[i].z;
    if (dd < dO) { dO = dd; kind = u_obs[i].w; }
    dO = min(dO, dd);
  }
  if (u_nObs > 0) d = max(d, -dO);

  vec2 q = w - bestC;
  float a = atan(q.y, q.x);
  float W = 24.0 * (1.0 + 0.05 * u_beat);
  float da = abs(mod(a - u_door + 3.14159265, 6.2831853) - 3.14159265);
  float doorMask = u_open * smoothstep(0.34, 0.10, da);
  float pool = exp(-pow(length(w - u_player) / 330.0, 2.0));

  // ---- INTERIOR gelap basah ----
  vec3 vv = vor(w * 0.045);
  vec3 colIn = u_fill * 0.34;
  colIn *= 0.78 + 0.34 * smoothstep(0.0, 0.18, vv.x);
  colIn = mix(colIn * 0.45, colIn, smoothstep(0.0, 0.06, vv.x));
  colIn += u_deep * 0.12 * fbm(w * 0.02);
  float vein = pow(max(0.0, sin(a * 9.0 + length(q) * 0.05 + fbm(w * 0.01) * 3.0)), 6.0);
  colIn = mix(colIn, u_deep * 0.40, vein * 0.35);
  colIn *= mix(0.50, 1.0, smoothstep(-150.0, -26.0, d));
  float spec = pow(noise(vec2(w.x * 0.09, w.y * 0.03 - u_time * 0.5)), 16.0);
  colIn += spec * (0.22 + 0.55 * pool) * vec3(1.0, 0.55, 0.45);
  colIn *= 0.62 + 0.70 * pool;
  colIn += u_glow * 0.16 * pool;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float la = u_time * (0.11 + 0.047 * fi) + fi * 2.094;
    vec2 lp = bestC + vec2(cos(la), sin(la)) * max(26.0, bestR * 0.62);
    float ld = length(w - lp);
    colIn += exp(-pow(ld / max(34.0, bestR * 0.42), 2.0)) * vec3(0.30, 1.0, 0.82)
           * (0.10 + 0.08 * sin(u_time * 2.1 + fi * 2.4)) * (1.0 - step(0.0, d));
  }
  colIn = mix(colIn, colIn * vec3(1.30, 0.55, 0.32) * 0.85, (1.0 - step(0.5, u_state)) * 0.45);
  for (int i = 0; i < 8; i++) {
    if (i >= u_nVents) break;
    float va = u_vents[i];
    float vd = abs(mod(a - va + 3.14159265, 6.2831853) - 3.14159265);
    float ring = exp(-pow((d + 30.0) / 24.0, 2.0));
    colIn += step(0.5, u_state) * (1.0 - step(1.5, u_state)) *
             exp(-pow(vd / 0.20, 2.0)) * ring * vec3(1.0, 0.55, 0.25) * (0.6 + 0.4 * sin(u_time * 9.0 + float(i)));
  }
  float shockR = u_shock * 260.0;
  colIn += step(1.5, u_state) * (1.0 - step(2.5, u_state)) *
           exp(-pow((length(q) - shockR) / 34.0, 2.0)) * vec3(0.45, 1.0, 0.85) * (1.0 - u_shock) * 1.2;
  colIn = mix(colIn, vec3(0.30, 0.88, 0.82), doorMask * smoothstep(-20.0, -120.0, d) * 0.7);

  // ---- PITA DINDING daging + rim panas ----
  float t = clamp((d + W) / (2.0 * W), 0.0, 1.0);
  vec3 colBand = mix(u_fill * 0.55, u_fill * 0.16, smoothstep(0.0, 0.85, t));
  colBand += u_deep * 0.12 * fbm(w * 0.05);
  float arc = a * 340.0;
  if (motif < 0.5) {
    vec3 mv = vor(vec2(arc * 0.06, d * 0.06));
    colBand *= 0.72 + 0.50 * smoothstep(0.0, 0.25, mv.x);
  } else if (motif < 1.5) {
    float fr2 = sin(arc * 0.9 + sin(u_time * 3.0 + arc * 0.13) * 2.0);
    colBand += smoothstep(0.2, 0.9, fr2) * smoothstep(-W - 26.0, -W - 4.0, d) * step(d, -W + 8.0) * u_glow * 0.45;
  } else if (motif < 2.5) {
    colBand *= 0.78 + 0.38 * (sin(arc * 0.35) * 0.5 + 0.5);
  } else if (motif < 3.5) {
    colBand *= 0.80 + 0.32 * smoothstep(0.3, 0.9, sin(arc * 0.12 + sin(d * 0.05) * 2.0));
  } else if (motif < 4.5) {
    colBand = mix(colBand, colBand * vec3(1.30, 1.18, 0.95), step(0.5, fract(arc * 0.045)) * 0.45);
  } else {
    colBand += smoothstep(0.55, 0.95, sin(arc * 0.22) * sin(d * 0.22)) * u_glow * 0.30;
  }
  colBand += u_glowHot * exp(-pow((d + 1.5) / 5.0, 2.0)) * 1.25;
  colBand *= 1.0 - 0.55 * smoothstep(0.75, 1.0, t);

  // ---- LUAR near-black ----
  vec3 v3 = vor(w * 0.03);
  vec3 colOut = u_deep * 0.08 + u_fill * 0.05 * smoothstep(0.0, 0.2, v3.x);
  colOut += u_glow * 0.05 * pow(fbm(w * 0.006), 3.0);
  colOut *= 0.35 + 0.65 * exp(-max(0.0, d) / 420.0);

  vec3 col = mix(colIn, colBand, smoothstep(-W - 2.0, -W + 2.0, d));
  col = mix(col, colOut, smoothstep(W - 2.0, W + 2.0, d));
  col = mix(col, vec3(0.25, 0.85, 0.80) * (0.7 + 0.3 * u_beat), doorMask * smoothstep(W + 4.0, -W - 4.0, -abs(d)) * 0.9);

  // obstacle: pilar massa gelap / SEGEL KATUP teal menyala
  if (u_nObs > 0 && dO < 0.0) {
    if (kind > 0.5) {
      float g = 0.6 + 0.4 * sin(u_time * 6.0);
      col = mix(col, vec3(0.20, 0.75, 0.72) * g, 0.85);
      col += u_glowHot * exp(-pow(dO / 6.0, 2.0)) * 0.8;
    } else {
      vec3 pc = vec3(0.05, 0.015, 0.03) + u_deep * 0.06 * fbm(w * 0.03);
      pc += u_glowHot * 0.35 * exp(-pow(dO / 7.0, 2.0));
      col = mix(col, pc, 0.92);
    }
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
      for (const n of ['u_res', 'u_cam', 'u_scale', 'u_time', 'u_beat', 'u_center', 'u_player', 'u_ch', 'u_nCh', 'u_seg', 'u_segw', 'u_nSeg', 'u_obs', 'u_nObs', 'u_glow', 'u_glowHot', 'u_fill', 'u_deep', 'u_state', 'u_shock', 'u_door', 'u_open', 'u_vents', 'u_nVents']) {
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
    const MOTIF = { kapiler: 0, aliran_darah: 0, paru: 1, jantung: 2, lambung: 3, saraf: 4, limfe: 5, usus_halus: 3, usus_besar: 0, ginjal: 5, pankreas: 5, hati: 0, goal: 1 };
    this.motif = MOTIF[(def && def.id) || ''] != null ? MOTIF[(def && def.id) || ''] : 0;
    if (!this.ok) return;
    // FASE B: data arena menyimpan palet di shape.wall.interior (def labirin
    // per-room memakai def.wall.interior) — dukung kedua path.
    const wall = (def && ((def.shape && def.shape.wall) || def.wall)) || {};
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
    // LABIRIN LUMEN: upload chamber/koridor/obstacle sebagai array SDF
    const ch = this._chBuf || (this._chBuf = new Float32Array(24 * 4));
    const sg = this._segBuf || (this._segBuf = new Float32Array(96 * 4));
    const sw = this._swBuf || (this._swBuf = new Float32Array(96));
    const ob = this._obsBuf || (this._obsBuf = new Float32Array(16 * 4));
    let nCh = 0, nSeg = 0, nObs = 0;
    if (chamber.isLabyrinth) {
      for (const n of chamber.nodes.values()) {
        if (nCh >= 24) break;
        ch[nCh * 4] = n.x; ch[nCh * 4 + 1] = n.y; ch[nCh * 4 + 2] = n.r; ch[nCh * 4 + 3] = n.motif || 0;
        nCh++;
      }
      for (const sgm of chamber.segs) {
        if (nSeg >= 96) break;
        sg[nSeg * 4] = sgm.x0; sg[nSeg * 4 + 1] = sgm.y0; sg[nSeg * 4 + 2] = sgm.x1; sg[nSeg * 4 + 3] = sgm.y1;
        sw[nSeg] = sgm.w; nSeg++;
      }
      for (const pl of (chamber.pillars || [])) {
        if (nObs >= 16) break;
        ob[nObs * 4] = pl.x; ob[nObs * 4 + 1] = pl.y; ob[nObs * 4 + 2] = pl.r; ob[nObs * 4 + 3] = 0; nObs++;
      }
      for (const sl of (chamber.seals || [])) {
        if (nObs >= 16) break;
        ob[nObs * 4] = sl.x; ob[nObs * 4 + 1] = sl.y; ob[nObs * 4 + 2] = sl.r; ob[nObs * 4 + 3] = 1; nObs++;
      }
    } else {
      const rr = chamber.R || 300;
      ch[0] = chamber.cx; ch[1] = chamber.cy; ch[2] = rr; ch[3] = this.motif || 0; nCh = 1;
      for (const pl of (chamber.pillars || [])) {
        if (nObs >= 16) break;
        ob[nObs * 4] = pl.x; ob[nObs * 4 + 1] = pl.y; ob[nObs * 4 + 2] = pl.r; ob[nObs * 4 + 3] = 0; nObs++;
      }
    }
    gl.uniform4fv(this.u.u_ch, ch);
    gl.uniform1i(this.u.u_nCh, nCh);
    gl.uniform4fv(this.u.u_seg, sg);
    gl.uniform1fv(this.u.u_segw, sw);
    gl.uniform1i(this.u.u_nSeg, nSeg);
    gl.uniform4fv(this.u.u_obs, ob);
    gl.uniform1i(this.u.u_nObs, nObs);
    const st = chamber.state === 'lockdown' || chamber.state === 'entry' ? 0
      : chamber.state === 'swarm' ? 1 : chamber.state === 'purified' ? 2 : 3;
    gl.uniform1f(this.u.u_state, st);
    gl.uniform1f(this.u.u_shock, chamber.shock || 0);
    gl.uniform1f(this.u.u_door, chamber.doorAngle);
    gl.uniform1f(this.u.u_open, chamber.openAmt || 0);
    for (let i = 0; i < 8; i++) this.vents[i] = i < chamber.vents.length ? chamber.vents[i].a : 0;
    gl.uniform1fv(this.u.u_vents, this.vents);
    gl.uniform1i(this.u.u_nVents, Math.min(8, chamber.vents.length));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return gl.getError() === gl.NO_ERROR;
  }
}
