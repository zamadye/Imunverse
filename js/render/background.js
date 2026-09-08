/**
 * background.js — Latar gameplay ala reference user:
 * "air tubuh" teal dengan arena heksagon cream di pusat dunia, siluet
 * terumbu/rumput laut/sel (ASET PNG parallax: prop_reef, prop_weed,
 * prop_cell, prop_dots) dan gelembung prosedural yang naik pelan.
 *
 * MAP AGENT (data-driven per-map; scope "MAP" = arena + lingkungan):
 *  - Seluruh layar = PERMUKAAN ORGAN tanpa batas (tak ada tambalan/ring):
 *    dasar jaringan fullscreen + isi anatomi world-anchored mengikuti kamera.
 *  - Isi tiap organ sesuai anatominya (palette.ground.features): lambung =
 *    rugae + makanan + kolam asam; paru = bronkiolus + alveoli + kapiler;
 *    jantung = serat otot + aliran darah; limfe = nodul + limfosit; saraf =
 *    berkas akson + mielin + sinapsis. Deterministik, tanpa aset baru.
 *  - Di atas jaringan mengambang materi fluida (ambient/elemen/gelembung) —
 *    TERPISAH dari partikel combat foreground (effects-system.js).
 *  - Ritme DETAK JANTUNG (lub-dub) global: glow, bercak, dan isi tanah
 *    naik-turun mengikuti denyut. Semua parameter motif-detail dibaca dari
 *    data/arenas.json → palette; kode hanya berisi DEFAULT fallback
 *    (lihat docs/map-environment-schema.md).
 */

import { drawSprite } from './sprite-loader.js';
import { PERSP } from './camera.js';

/** Gelapkan/terangkan warna hex "#rrggbb" dengan faktor (clamp 0..255). */
function hexShade(hex, f) {
  const n = parseInt(String(hex || '#888888').slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function hash2(ix, iy) {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

/** Path heksagon membulat di sekitar (cx, cy) dengan radius R. */
function roundHexPath(ctx, cx, cy, R, round) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (Math.PI / 3) * i;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  // poligon membulat: quad antar titik dengan arc di sudut
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % 6];
    const x0 = p0[0] + (p1[0] - p0[0]) * 0.5;
    const y0 = p0[1] + (p1[1] - p0[1]) * 0.5;
    if (i === 0) ctx.moveTo(x0, y0);
    const q = pts[(i + 2) % 6];
    const x1 = p1[0] + (q[0] - p1[0]) * 0.5;
    const y1 = p1[1] + (q[1] - p1[1]) * 0.5;
    ctx.arcTo(p1[0], p1[1], x1, y1, round);
  }
  ctx.closePath();
}

/**
 * Gambar latar (screen-space). camX/camY = posisi kamera; w/h = viewport.
 */
// Palet arena aktif — diganti saat run dimulai lewat setArenaPalette()
// (dari data/arenas.json). Semua key punya fallback agar aman.
let PALETTE = {
  hex: '#e2ecc9', hexEdge: '#b9c795', vignette: 'rgba(24,70,52,0.28)',
  props: ['prop_weed.png', 'prop_cell.png'],
};

// DEFAULT fallback bila entri arena di data/arenas.json belum membawa
// blok ambient/pulse (backward compatible — arena lama tetap jalan).
const AMBIENT_DEFAULTS = {
  density: 0.55,   // peluang sel grid terisi (0..1)
  spacing: 250,    // jarak grid (px) — makin besar makin sedikit partikel
  size: 26,        // diameter dasar (px)
  drift: 9,        // kecepatan hanyut ke atas (px/detik)
  opacity: 0.16,   // alpha maksimum — rendah agar tak ganggu combat
  parallax: 0.08,  // paling lambat = paling "jauh"
  tint: '255,255,255', // triplet rgb badan partikel
  shade: '16,64,58',   // triplet rgb inti (efek sel darah: inti gelap)
};
const PULSE_DEFAULTS = {
  bpm: 64,         // detak per menit saat tenang
  strength: 1.0,   // pengali intensitas breathing (0 = mati)
  glowAlpha: 0.05, // alpha puncak overlay napas layar-penuh
};

/** Set palet arena (dipanggil game.js saat run dimulai). */
export function setArenaPalette(p) {
  PALETTE = { ...PALETTE, ...p };
}

function ambientCfg() {
  return { ...AMBIENT_DEFAULTS, ...(PALETTE.ambient || {}) };
}

function pulseCfg() {
  return { ...PULSE_DEFAULTS, ...(PALETTE.pulse || {}) };
}

// DEFAULT elemen khas map (palette.element) — signature visual tiap organ
// sesuai anatominya. Tipe: flow|acid|breath|spark|pulsering.
const ELEMENT_DEFAULTS = {
  type: null,      // null = tak ada lapisan elemen (entri lama)
  color: '255,255,255',  // triplet rgb utama
  color2: '255,255,255', // triplet rgb sekunder (inti/sorot)
  breathSec: 4,    // (breath) durasi satu siklus napas
  density: 0.5, spacing: 300, size: 30, speed: 10, alpha: 0.15,
  parallax: 0.3,   // midground — antara reef jauh & dekat
};
const BUBBLE_DEFAULTS = {
  c1: 'rgba(255,255,255,0.10)',
  c2: 'rgba(255,255,255,0.16)',
};

function elementCfg() {
  return { ...ELEMENT_DEFAULTS, ...(PALETTE.element || {}) };
}

function bubblesCfg() {
  return { ...BUBBLE_DEFAULTS, ...(PALETTE.bubbles || {}) };
}

// DEFAULT tanah organ (palette.ground): bayangan + DAFTAR FITUR anatomi
// world-anchored. Tipe fitur: blotch|fold|chunk|pool|sacs|thread|flowcell.
const GROUND_DEFAULTS = {
  shade: '80,90,80', // triplet rgb bayangan jaringan
  features: [],      // [] = dasar polos (entri lama tetap jalan)
};

function groundCfg() {
  return { ...GROUND_DEFAULTS, ...(PALETTE.ground || {}) };
}

/**
 * Envelope DETAK JANTUNG (lub-dub) 0..1 — motif "Pulse Cell".
 * Dua puncak gaussian per siklus: lub kuat (12% siklus) + dub lemah (34%).
 * Murni fungsi waktu — tanpa aset, tanpa state, murah (2× exp per panggil).
 */
export function heartbeat(time, bpm) {
  const ph = (((time * bpm) / 60) % 1 + 1) % 1;
  const lub = Math.exp(-((ph - 0.12) * (ph - 0.12)) / 0.004);
  const dub = 0.55 * Math.exp(-((ph - 0.34) * (ph - 0.34)) / 0.006);
  return Math.min(1, lub + dub);
}

export function drawBackground(ctx, camX, camY, w, h, time) {
  // ---- dasar JARINGAN ORGAN (fullscreen — tanah tanpa batas) ----
  // Bukan lagi "dinding + tambalan lantai": seluruh layar = permukaan organ.
  // Gradien halus memberi kedalaman; isi anatomi (lipatan/makanan/sel)
  // digambar world-anchored di drawArena3D mengikuti kamera.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hexShade(PALETTE.hex, 1.03));
  g.addColorStop(0.5, PALETTE.hex || '#e2ecc9');
  g.addColorStop(1, hexShade(PALETTE.hex, 0.86));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ---- denyut global frame ini (dihitung SEKALI, dipakai semua lapisan) ----
  const pc = pulseCfg();
  const beat = heartbeat(time, pc.bpm) * (pc.strength || 0);

  // ---- LAPISAN 0 (paling belakang): ambient sel darah/dust prosedural ----
  // Terpisah total dari partikel combat (effects-system): tanpa spawn dinamis,
  // tanpa state — posisi deterministik hash-grid + hanyut waktu. Opacity
  // rendah + parallax paling lambat → jauh, tenang, tak ganggu keterbacaan.
  drawAmbientLayer(ctx, camX, camY, w, h, time, beat);

  drawCellLayer(ctx, camX, camY, w, h, time, beat);
  const props = PALETTE.props && PALETTE.props.length ? PALETTE.props : ['prop_reef.png', 'prop_weed.png'];
  drawReefLayer(ctx, camX, camY, w, h, 0.22, 820, props[0], 210, time);
  // ---- LAPISAN ELEMEN KHAS MAP (data-driven: palette.element) ----
  drawElementLayer(ctx, camX, camY, w, h, time, beat);
  const bc = bubblesCfg();
  drawBubbleLayer(ctx, camX, camY, w, h, time, 0.5, 190, bc.c1, 5);
  drawReefLayer(ctx, camX, camY, w, h, 0.4, 620, props[1] || props[0], 170, time);
  drawBubbleLayer(ctx, camX, camY, w, h, time, 0.72, 130, bc.c2, 8);

  // ---- arena heksagon: kini digambar TERPROYEKSI (drawArena3D) dari game.js ----

  // ---- dekor sudut ala mockup: rumput laut & karang BESAR menempel di sudut
  //      bawah layar (screen-anchored, goyang pelan) ----
  drawCornerDeco(ctx, w, h, time);

  // ---- NAPAS LAYAR: glow radial mengikuti denyut (brand Pulse Cell) ----
  // Satu gradient + satu fill per frame; alpha puncak kecil (default 0.05).
  if (pc.glowAlpha > 0 && beat > 0.01) {
    const br = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
    br.addColorStop(0, `rgba(255,255,255,${(pc.glowAlpha * beat).toFixed(3)})`);
    br.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = br;
    ctx.fillRect(0, 0, w, h);
  }

  // ---- vignette lembut tepi layar ----
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(16,64,58,0)');
  vg.addColorStop(1, PALETTE.vignette);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Lapisan ambient: sel darah/dust melayang pelan di kejauhan.
 * Anggaran performa: grid jarang (default spacing 250px → ±20 kandidat,
 * ±11 tergambar di 844×390), 2 arc fill per partikel, TANPA shadowBlur /
 * gradient per partikel. Total < 25 path fill — jauh di bawah budget.
 */
function drawAmbientLayer(ctx, camX, camY, w, h, time, beat) {
  const a = ambientCfg();
  const ox = camX * a.parallax;
  const oy = camY * a.parallax;
  const spacing = a.spacing;
  const drift = (time * a.drift) % spacing; // hanyut ke atas perlahan
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2 - drift) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2 - drift) / spacing) + 1;
  // denyut global mengembang-kerutkan ambient ±8% — latar ikut "bernapas"
  const breathe = 1 + beat * 0.08;

  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix * 13 + 71, iy * 17 - 43);
      if (r1 > a.density) continue;
      const r2 = hash2(ix - 31, iy + 57);
      const wx = ix * spacing + (r1 - 0.5) * spacing * 0.7 - ox + w / 2
        + Math.sin(time * 0.5 + r2 * 9) * 10; // goyang horizontal pelan
      const wy = iy * spacing + (r2 - 0.5) * spacing * 0.7 - oy - drift + h / 2;
      // dua populasi: sel (lebih besar, berinti) & dust (kecil, polos)
      const isCell = r2 > 0.45;
      const s = a.size * (isCell ? 0.7 + r1 * 0.7 : 0.22 + r2 * 0.25) * breathe;
      const alpha = a.opacity * (isCell ? 0.75 + r2 * 0.5 : 0.5 + r1 * 0.5)
        * (0.85 + beat * 0.3);
      ctx.fillStyle = `rgba(${a.tint},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(wx, wy, s, 0, Math.PI * 2);
      ctx.fill();
      if (isCell) {
        // inti sel lebih gelap — siluet sel darah merah yang samar
        ctx.fillStyle = `rgba(${a.shade},${(alpha * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(wx + s * 0.12, wy - s * 0.1, s * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Lapisan ELEMEN KHAS map — signature visual tiap organ sesuai anatominya.
 * Anggaran: grid jarang (±8-12 sel aktif), ≤3 shape/sel, tanpa shadowBlur.
 * Deterministik (hash-grid + waktu) — tanpa state, tanpa spawn dinamis.
 */
function drawElementLayer(ctx, camX, camY, w, h, time, beat) {
  const e = elementCfg();
  if (!e.type) return;
  if (e.type === 'breath') return drawElementBreath(ctx, camX, camY, w, h, time, e);
  const boost = 1 + beat * 0.2; // denyut global ikut menghidupkan elemen
  const spacing = e.spacing;
  const ox = camX * e.parallax, oy = camY * e.parallax;
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2) / spacing) + 1;
  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix * 29 + 5, iy * 31 - 3);
      if (r1 > e.density) continue;
      const r2 = hash2(ix - 77, iy + 51);
      const wx = ix * spacing + (r1 - 0.5) * spacing * 0.6 - ox + w / 2;
      const wy = iy * spacing + (r2 - 0.5) * spacing * 0.6 - oy + h / 2;
      if (e.type === 'flow') elementFlow(ctx, wx, wy, time, r1, r2, e, boost);
      else if (e.type === 'acid') elementAcid(ctx, wx, wy, time, r1, r2, e, boost);
      else if (e.type === 'spark') elementSpark(ctx, wx, wy, time, ix, iy, r1, r2, e, boost);
      else if (e.type === 'pulsering') elementPulseRing(ctx, wx, wy, time, r1, r2, e, boost);
    }
  }
}

/** LIMFE — gumpalan getah bening berdenyut pelan, melayang tenang. */
function elementFlow(ctx, wx, wy, time, r1, r2, e, boost) {
  const bob = Math.sin(time * 0.6 + r1 * 9) * 8;
  const s = e.size * (0.7 + r1 * 0.6) * boost;
  ctx.fillStyle = `rgba(${e.color},${(e.alpha).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(wx, wy + bob, s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(${e.color2},${(e.alpha * 1.2).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(wx - s * 0.25, wy + bob - s * 0.25, s * 0.45, 0, Math.PI * 2); ctx.fill();
}

/** LAMBUNG — aliran gelembung asam naik berdenyut (kuning-hijau). */
function elementAcid(ctx, wx, wy, time, r1, r2, e, boost) {
  const travel = 300;
  const rise = (time * e.speed + r2 * travel) % travel;
  const yy = wy + travel / 2 - rise;
  const xx = wx + Math.sin(time * 2 + r1 * 12) * 12;
  const fade = Math.sin((rise / travel) * Math.PI); // pudar di ujung jalur
  const s = e.size * (0.6 + r1 * 0.8) * boost;
  const a = (e.alpha * 2 * fade).toFixed(3);
  ctx.fillStyle = `rgba(${e.color},${a})`;
  ctx.beginPath(); ctx.arc(xx, yy, s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${(e.alpha * 2.2 * fade).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(xx - s * 0.3, yy - s * 0.3, s * 0.28, 0, Math.PI * 2); ctx.fill();
}

/** SARAF — sambaran sinyal listrik: garis patah menyala-kedip cepat. */
function elementSpark(ctx, wx, wy, time, ix, iy, r1, r2, e, boost) {
  const q = Math.floor(time * e.speed + r1 * 8);
  const flick = hash2(ix * 7 + q * 13, iy * 11 - q * 3);
  if (flick < 0.45) return; // mayoritas waktu padam → kesan menyambar
  const segs = 5, len = e.size * (0.8 + r2 * 0.5);
  ctx.strokeStyle = `rgba(${e.color},${(e.alpha * flick * boost).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k <= segs; k++) {
    const yy = wy - len / 2 + (len * k) / segs;
    const xx = wx + (hash2(ix * 3 + k, iy * 5 - k) - 0.5) * len * 0.5;
    if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(${e.color2},${(e.alpha * flick).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(wx, wy - len / 2, 3, 0, Math.PI * 2); ctx.fill();
}

/** JANTUNG — gelombang detak: cincin mengembang memudar dari tiap nodus. */
function elementPulseRing(ctx, wx, wy, time, r1, r2, e, boost) {
  const span = e.size * 2;
  const cyc = (time * e.speed + r1 * span) % span;
  const rad = 10 + cyc;
  const a = (e.alpha * (1 - cyc / span) * boost).toFixed(3);
  ctx.strokeStyle = `rgba(${e.color},${a})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(wx, wy, rad, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(${e.color2},${(e.alpha * 1.5 * (1 - cyc / span)).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI * 2); ctx.fill();
}

/** PARU — napas: kilau mengembang + gugus sakus alveoli (3 gelembung). */
function drawElementBreath(ctx, camX, camY, w, h, time, e) {
  const phase = 0.5 - 0.5 * Math.cos((time * Math.PI * 2) / e.breathSec);
  const br = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7);
  br.addColorStop(0, `rgba(${e.color},${(e.alpha * phase).toFixed(3)})`);
  br.addColorStop(1, `rgba(${e.color},0)`);
  ctx.fillStyle = br;
  ctx.fillRect(0, 0, w, h);
  const spacing = e.spacing;
  const ox = camX * e.parallax, oy = camY * e.parallax;
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2) / spacing) + 1;
  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix * 29 + 5, iy * 31 - 3);
      if (r1 > e.density) continue;
      const r2 = hash2(ix - 77, iy + 51);
      const wx = ix * spacing + (r1 - 0.5) * spacing * 0.6 - ox + w / 2;
      const wy = iy * spacing + (r2 - 0.5) * spacing * 0.6 - oy + h / 2;
      const s = e.size * (0.6 + r1 * 0.6) * (0.8 + 0.35 * phase);
      const a = (e.alpha * (0.6 + 0.6 * phase)).toFixed(3);
      const a2 = (e.alpha * 1.2 * (0.6 + 0.6 * phase)).toFixed(3);
      ctx.fillStyle = `rgba(${e.color},${a})`;
      ctx.beginPath(); ctx.arc(wx, wy, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${e.color2},${a2})`;
      ctx.beginPath(); ctx.arc(wx + s * 0.9, wy + s * 0.3, s * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${e.color},${a})`;
      ctx.beginPath(); ctx.arc(wx - s * 0.7, wy + s * 0.6, s * 0.4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** Lapisan sel transparan (aset prop_cell) samar di kejauhan. */
function drawCellLayer(ctx, camX, camY, w, h, time, beat = 0) {
  const parallax = 0.14;
  const spacing = 640;
  const ox = camX * parallax;
  const oy = camY * parallax;
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2) / spacing) + 1;
  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix * 5 + 3, iy * 7 - 11);
      if (r1 < 0.35) continue;
      const wx = ix * spacing + (r1 - 0.5) * 200 - ox + w / 2;
      const wy = iy * spacing + (hash2(ix - 8, iy + 4) - 0.5) * 200 - oy + h / 2;
      const size = 150 + r1 * 130;
      // napas ganda: ayunan lambat (lama) + denyut jantung (motif Pulse Cell)
      const pulse = 0.8 + 0.2 * Math.sin(time * 0.7 + r1 * 12) + beat * 0.12;
      drawSprite(ctx, 'assets/sprites/prop_cell.png', wx, wy, size * pulse, r1 * Math.PI, { alpha: 0.35 + r1 * 0.2 });
    }
  }
}

/** Siluet terumbu/rumput laut (ASET PNG) tersebar parallax. */
function drawReefLayer(ctx, camX, camY, w, h, parallax, spacing, asset, size, time) {
  const ox = camX * parallax;
  const oy = camY * parallax;
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2) / spacing) + 1;
  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix * 3 + (asset.length), iy * 5 - 7);
      if (r1 < 0.3) continue;
      const wx = ix * spacing + (r1 - 0.5) * spacing * 0.6 - ox + w / 2;
      const wy = iy * spacing + (hash2(ix - 5, iy + 9) - 0.5) * spacing * 0.6 - oy + h / 2;
      const sway = Math.sin(time * 0.9 + r1 * 9) * 0.04;
      const flip = r1 > 0.65 ? -1 : 1;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.scale(flip, 1);
      drawSprite(ctx, `assets/sprites/${asset}`, 0, 0, size * (0.8 + r1 * 0.5), sway);
      ctx.restore();
    }
  }
}

/** Gelembung kecil naik pelan (offset sinus berbasis time). */
function drawBubbleLayer(ctx, camX, camY, w, h, time, parallax, spacing, color, size) {
  const ox = camX * parallax;
  const oy = camY * parallax;
  const drift = (time * 12) % spacing; // naik perlahan
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2 - drift) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2 - drift) / spacing) + 1;

  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix + 91, iy - 17);
      if (r1 < 0.42) continue;
      const wx = ix * spacing + (r1 - 0.5) * spacing * 0.7 - ox + w / 2;
      const wy = iy * spacing + (hash2(ix - 40, iy + 63) - 0.5) * spacing * 0.7 - oy - drift + h / 2;
      const sway = Math.sin(time * 1.4 + r1 * 9) * 6;
      const s = size * (0.5 + r1 * 0.9);
      ctx.globalAlpha = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2 + r1 * 20));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(wx + sway, wy, s, 0, Math.PI * 2);
      ctx.fill();
      // kilau bubble
      ctx.globalAlpha *= 0.9;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(wx + sway - s * 0.3, wy - s * 0.35, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Arena heksagon cream tempat pertempuran dimulai (pusat dunia = 0,0). */
/** Turunkan posisi kamera dunia dari proyektor (eksak — project mengembalikan s). */
function cameraOf(P) {
  const q = P.project(0, 0);
  return {
    x: -(q.x - P.w / 2) / q.s,
    y: -(q.y - P.h / 2) / (q.s * PERSP.YS),
    s: q.s,
  };
}

/**
 * Isi anatomi tanah organ — world-anchored, mengikuti kamera ke mana pun
 * pemain menjelajah (tak ada tambalan/ring; tanah tak bertepi).
 * Nama export dipertahankan (dipanggil game.render setelah latar,
 * sebelum entitas).
 */
export function drawArena3D(ctx, P, time) {
  const w = P.w, h = P.h;
  const gc = groundCfg();
  const feats = gc.features || [];
  if (!feats.length) return;
  const pc = pulseCfg();
  const beat = heartbeat(time, pc.bpm) * (pc.strength || 0);
  const cam = cameraOf(P);
  // kotak pandang dunia + margin (antisipasi variasi perspektif)
  const mx = (w / 2 + 160) / cam.s;
  const my = (h / 2 + 160) / (cam.s * PERSP.YS);
  const vw = { x0: cam.x - mx, x1: cam.x + mx, y0: cam.y - my, y1: cam.y + my };
  for (let fi = 0; fi < feats.length; fi++) {
    drawGroundFeature(ctx, P, vw, cam, w, h, time, beat, feats[fi], fi);
  }
}

/** Sebar satu definisi fitur ke grid-hash dunia dalam kotak pandang. */
function drawGroundFeature(ctx, P, vw, cam, w, h, time, beat, f, fi) {
  if (f.type === 'flowcell') return featFlowField(ctx, P, cam, w, h, time, f, fi);
  const sp = f.spacing || 300;
  const dens = f.density == null ? 0.5 : f.density;
  const ix0 = Math.floor(vw.x0 / sp) - 1, ix1 = Math.floor(vw.x1 / sp) + 1;
  const iy0 = Math.floor(vw.y0 / sp) - 1, iy1 = Math.floor(vw.y1 / sp) + 1;
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      const r1 = hash2(ix * 13 + fi * 101 + 7, iy * 17 - fi * 57 - 3);
      if (r1 > dens) continue;
      const r2 = hash2(ix * 7 - fi * 31 - 11, iy * 11 + fi * 71 + 5);
      const r3 = hash2(ix * 5 + fi * 13 + 1, iy * 3 - fi * 17 + 9);
      const wx = ix * sp + (r1 - 0.5) * sp * 0.7;
      const wy = iy * sp + (r2 - 0.5) * sp * 0.7;
      if (f.type === 'blotch') featBlotch(ctx, P, w, h, wx, wy, r1, r2, f, beat);
      else if (f.type === 'fold') featFold(ctx, P, w, h, wx, wy, time, r1, r2, r3, f);
      else if (f.type === 'chunk') featChunk(ctx, P, w, h, wx, wy, time, r1, r2, r3, f);
      else if (f.type === 'pool') featPool(ctx, P, w, h, wx, wy, time, r1, r2, r3, f);
      else if (f.type === 'sacs') featSacs(ctx, P, w, h, wx, wy, time, r1, r2, f);
      else if (f.type === 'thread') featThread(ctx, P, w, h, wx, wy, time, r1, r2, r3, f);
    }
  }
}

/** Cek titik layar dalam kanvas + margin (culling murah per fitur). */
function onScreen(P, w, h, q, m) {
  return q.x > -m && q.x < w + m && q.y > -m && q.y < h + m;
}

/** Noda lembut jaringan (mottling dasar). */
function featBlotch(ctx, P, w, h, wx, wy, r1, r2, f, beat) {
  const q = P.project(wx, wy);
  if (!onScreen(P, w, h, q, 160)) return;
  const s = (f.size || 70) * (0.6 + r1 * 0.8) * q.s * (1 + beat * 0.1);
  ctx.fillStyle = `rgba(${r2 > 0.5 ? f.color : (f.color2 || f.color)},${(f.alpha || 0.5).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(q.x, q.y, s, s * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Lipatan panjang berombak: rugae lambung / serat otot / berkas akson. */
function featFold(ctx, P, w, h, wx, wy, time, r1, r2, r3, f) {
  const q0 = P.project(wx, wy);
  if (!onScreen(P, w, h, q0, 260)) return;
  const ang = (f.angle || 0) + (r3 - 0.5) * 0.6;
  const L = f.len || 600, N = 12, amp = f.wave || 70;
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const pts = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N - 0.5;
    const off = Math.sin(t * Math.PI * 2 + r1 * 9) * amp;
    pts.push(P.project(wx + dx * L * t + nx * off, wy + dy * L * t + ny * off));
  }
  const lw = (f.width || 24) * q0.s;
  ctx.strokeStyle = `rgba(${f.color},${(f.alpha || 0.85).toFixed(3)})`;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  if (f.color2) { // sorot punggung lipatan
    ctx.strokeStyle = `rgba(${f.color2},0.5)`;
    ctx.lineWidth = Math.max(1.5, lw * 0.32);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p.x - lw * 0.18, y = p.y - lw * 0.24;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

/** Gumpalan: makanan / nodul limfe / mielin — 3 lobus + garis tepi + sorot. */
function featChunk(ctx, P, w, h, wx, wy, time, r1, r2, r3, f) {
  const bob = Math.sin(time * 1.2 + r1 * 12) * (f.bob || 0);
  const q = P.project(wx, wy + bob);
  if (!onScreen(P, w, h, q, 120)) return;
  const cols = f.colors && f.colors.length ? f.colors : [f.color || '200,200,200'];
  const col = cols[Math.floor(r3 * cols.length) % cols.length];
  const s = ((f.size || 28) + (r2 - 0.5) * 2 * (f.var || 0)) * q.s;
  const sq = 0.72;
  ctx.fillStyle = `rgba(${col},0.95)`;
  ctx.beginPath(); ctx.ellipse(q.x, q.y, s, s * sq, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(q.x + s * 0.55, q.y + s * 0.2, s * 0.55, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(q.x - s * 0.45, q.y + s * 0.3, s * 0.4, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(${f.line || '90,70,60'},0.55)`;
  ctx.lineWidth = Math.max(1.5, 2.5 * q.s);
  ctx.beginPath(); ctx.ellipse(q.x, q.y, s, s * sq, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(q.x - s * 0.3, q.y - s * 0.3, s * 0.22, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
}

/** Kolam berkilau: asam / darah / cairan — denyut + gelembung mikro. */
function featPool(ctx, P, w, h, wx, wy, time, r1, r2, r3, f) {
  const q = P.project(wx, wy);
  if (!onScreen(P, w, h, q, 180)) return;
  const s = (f.size || 90) * (0.8 + r1 * 0.4) * q.s * (1 + 0.03 * Math.sin(time * 1.5 + r2 * 9));
  ctx.fillStyle = `rgba(${f.color},0.75)`;
  ctx.beginPath(); ctx.ellipse(q.x, q.y, s, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  if (f.color2) {
    ctx.fillStyle = `rgba(${f.color2},0.5)`;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, s * 0.62, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(q.x - s * 0.3, q.y - s * 0.18, s * 0.18, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  if (f.bubbles) {
    for (let b = 0; b < 3; b++) {
      const ba = time * (0.6 + r3 * 0.5) + r1 * 6.28 + b * 2.1;
      const bx = q.x + Math.cos(ba) * s * 0.4, by = q.y + Math.sin(ba) * s * 0.2;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(bx, by, Math.max(1.5, s * 0.045), 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** Gugus kantung: alveoli paru — 6 gelembung tembus pandang bernapas. */
function featSacs(ctx, P, w, h, wx, wy, time, r1, r2, f) {
  const q = P.project(wx, wy);
  if (!onScreen(P, w, h, q, 120)) return;
  const n = f.n || 6;
  const r = (f.size || 26) * q.s * (0.9 + 0.1 * Math.sin(time * 2 + r1 * 7));
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r2 * 3;
    const d = r * (0.5 + hash2(k * 7 + 1, k * 3 + 5) * 0.6);
    const rr = r * (0.42 + hash2(k * 11 + 2, k * 13 + 7) * 0.3);
    ctx.fillStyle = k % 2 ? `rgba(${f.color2 || f.color},0.55)` : `rgba(${f.color},0.55)`;
    ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.7, rr, 0, Math.PI * 2); ctx.fill();
  }
}

/** Serat melengkung: bronkiolus / kapiler / korda — inti + opsional kedip. */
function featThread(ctx, P, w, h, wx, wy, time, r1, r2, r3, f) {
  const q0 = P.project(wx, wy);
  if (!onScreen(P, w, h, q0, 220)) return;
  const ang = (f.angle != null ? f.angle : 0.5) + (r3 - 0.5) * 0.8;
  const L = (f.len || 350) / 2;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const bow = (r2 - 0.5) * L;
  const p0 = P.project(wx - dx * L, wy - dy * L);
  const p1 = P.project(wx - dy * bow, wy + dx * bow);
  const p2 = P.project(wx + dx * L, wy + dy * L);
  let a = f.alpha || 0.7;
  if (f.flicker) a *= 0.35 + 0.65 * Math.abs(Math.sin(time * 7 + r1 * 20));
  const lw = Math.max(1, (f.width || 4) * q0.s);
  ctx.strokeStyle = `rgba(${f.color},${a.toFixed(3)})`;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y); ctx.stroke();
  if (f.color2) {
    ctx.strokeStyle = `rgba(${f.color2},${(a * 0.8).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, lw * 0.4);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y); ctx.stroke();
  }
}

/** Medan sel HANYUT: darah / limfosit / kimus — mengalir searah + pudar tepi. */
function featFlowField(ctx, P, cam, w, h, time, f, fi) {
  const N = f.count || 20, sp = f.span || 700;
  const dl = Math.hypot(f.dx == null ? 1 : f.dx, f.dy == null ? 0.2 : f.dy) || 1;
  const ux = (f.dx == null ? 1 : f.dx) / dl, uy = (f.dy == null ? 0.2 : f.dy) / dl;
  // jendela mengikuti kamera (snap) — pola periodik span jadi tak terlihat pop
  const snx = Math.round(cam.x / sp) * sp, sny = Math.round(cam.y / sp) * sp;
  for (let k = 0; k < N; k++) {
    const r1 = hash2(k * 3 + 1, fi * 7 + 2), r2 = hash2(k * 5 + 3, fi * 11 + 4);
    const u = ((((r1 * sp + time * (f.speed || 20)) % sp) + sp) % sp) - sp / 2;
    const v = (r2 - 0.5) * sp * 0.8;
    const fade = Math.sin((Math.PI * (u + sp / 2)) / sp);
    const av = Math.cos((Math.PI * v) / (sp * 0.8));
    const a = (f.alpha || 0.8) * Math.max(0, fade) * Math.max(0, av);
    if (a < 0.03) continue;
    const q = P.project(snx + ux * u - uy * v, sny + uy * u + ux * v);
    if (!onScreen(P, w, h, q, 20)) continue;
    ctx.fillStyle = `rgba(${f.color},${a.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.5, (f.size || 6) * q.s * 0.5), 0, Math.PI * 2); ctx.fill();
  }
}


// Dekor sudut ala mockup 12 (gameplay): weed/reef besar di sudut bawah,
// separuh keluar layar, goyang pelan mengikuti waktu. Screen-anchored.
function drawCornerDeco(ctx, w, h, time) {
  const sway = Math.sin(time * 0.9) * 0.06;
  const sway2 = Math.sin(time * 0.7 + 1.7) * 0.05;
  const base = Math.min(w, h);
  // Sprite di-anchor pada DASAR gambar (konten weed/reef ada di bagian bawah kanvas).
  const sizeWeed = base * 0.7;
  const sizeReef = base * 0.6;
  // Aset sudut per-arena dari data (cornerWeed/cornerReef) — fallback bawaan
  // bila entri lama belum membawa kunci tersebut.
  const weedSpr = PALETTE.cornerWeed || 'assets/sprites/deco_weed_big.png';
  const reefSpr = PALETTE.cornerReef || 'assets/sprites/deco_reef_big.png';
  ctx.save();
  ctx.globalAlpha = 0.9;
  // Pusat gambar = dasar layar − setengah tinggi + sedikit celah →
  // konten (40% bawah kanvas PNG) tampak menempel dari tepi bawah.
  ctx.translate(base * 0.14, h - sizeWeed * 0.5 + base * 0.04);
  ctx.rotate(sway);
  drawSprite(ctx, weedSpr, 0, 0, sizeWeed, 0, {});
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.translate(w - base * 0.16, h - sizeReef * 0.5 + base * 0.03);
  ctx.rotate(sway2);
  drawSprite(ctx, reefSpr, 0, 0, sizeReef, 0, {});
  ctx.restore();
}
