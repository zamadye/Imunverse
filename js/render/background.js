/**
 * background.js — Latar gameplay ala reference user:
 * "air tubuh" teal dengan arena heksagon cream di pusat dunia, siluet
 * terumbu/rumput laut/sel (ASET PNG parallax: prop_reef, prop_weed,
 * prop_cell, prop_dots) dan gelembung prosedural yang naik pelan.
 *
 * MAP AGENT (data-driven per-map; scope "MAP" = arena + lingkungan):
 *  - Lapisan paling belakang = AMBIENT (sel darah/dust prosedural,
 *    parallax paling lambat, opacity rendah) — TERPISAH dari partikel
 *    combat foreground (effects-system.js) yang hidup di layer dunia.
 *  - Lapisan ELEMEN KHAS (palette.element): signature visual tiap organ —
 *    aliran limfe, asam lambung, napas paru, sinyal saraf, detak jantung.
 *  - Ritme DETAK JANTUNG (lub-dub) global mengatur "breathing" latar:
 *    sel, bercak map, elemen khas, dan glow naik-turun mengikuti denyut.
 *  - Semua parameter motif-detail (ambient, pulse, element, bubbles, organ)
 *    dibaca dari data/arenas.json → palette; kode ini hanya berisi DEFAULT
 *    fallback sehingga map baru cukup tambah data (lihat
 *    docs/map-environment-schema.md). Tanpa aset baru: murni timer/canvas.
 */

import { drawSprite } from './sprite-loader.js';

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
  top: '#2b9284', mid: '#23857a', bot: '#1d7268',
  hex: '#fdf6e3', hexEdge: '#e9dfc0', vignette: 'rgba(16,64,58,0.28)',
  props: ['prop_reef.png', 'prop_weed.png'],
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

// DEFAULT tanah clearing (palette.ground) — tint detail tiap organ.
const GROUND_DEFAULTS = {
  detail: '120,140,120', // triplet rgb sel/serat tanah
  spotA: '170,205,150',  // triplet rgb bercak tipe 1
  spotB: '200,220,180',  // triplet rgb bercak tipe 2
  shade: '50,100,70',    // triplet rgb bayangan + gradasi kedalaman
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
  // ---- dasar gradien air tubuh (warna per arena) ----
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.top);
  g.addColorStop(0.55, PALETTE.mid);
  g.addColorStop(1, PALETTE.bot);
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
/** Sampel titik CLEARING ORGANIK (gumpalan tak beraturan, bukan heksagon). */
function blobPoints(R, n = 96) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    // wobble deterministik ±8% — bahasa visual "explorer", bukan ring tanding
    const r = R * (1 + 0.05 * Math.sin(3 * t + 1.7) + 0.03 * Math.sin(5 * t + 0.6));
    pts.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  return pts;
}

/** Trace path clearing dunia (cx,cy,R) melewati proyektor P. */
function traceBlob3D(ctx, P, cx, cy, R) {
  const pts = blobPoints(R);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const q = P.project(cx + pts[i][0], cy + pts[i][1]);
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  }
  ctx.closePath();
}

/**
 * Clearing organik tempat run dimulai (pusat dunia = 0,0) — BUKAN ring
 * arena: gumpalan tanah tak beraturan, tepi berbulu menyatu dinding organ,
 * tanpa dinding/ring keras (eksplorasi bebas — batas gerak memang tak ada).
 * Dipanggil dari game.render SEBELUM entitas, SETELAH latar.
 */
export function drawArena3D(ctx, P, time) {
  const w = P.w, h = P.h;
  const c = P.project(0, 0);
  // culling kasar
  if (c.x < -700 || c.x > w + 700 || c.y < -700 || c.y > h + 900) return;
  const pcA = pulseCfg();
  const beatA = heartbeat(time, pcA.bpm) * (pcA.strength || 0);
  const gc = groundCfg();

  // ---- bayangan lembut di bawah clearing (2 lapis offset) ----
  ctx.fillStyle = `rgba(${gc.shade},0.20)`;
  traceBlob3D(ctx, P, 0, 30, 296); ctx.fill();
  ctx.fillStyle = `rgba(${gc.shade},0.22)`;
  traceBlob3D(ctx, P, 0, 14, 284); ctx.fill();

  // ---- tanah clearing (tint per-map — bukan putih polos) ----
  ctx.fillStyle = PALETTE.hex || '#faf1dc';
  traceBlob3D(ctx, P, 0, 0, 270); ctx.fill();

  // ---- isi tanah: ter-clip dalam blob ----
  ctx.save();
  traceBlob3D(ctx, P, 0, 0, 270);
  ctx.clip();

  // gradasi kedalaman: sisi jauh lebih gelap (petunjuk 3D pengganti grid)
  const far = P.project(0, -260), near = P.project(0, 260);
  const dg = ctx.createLinearGradient(0, far.y, 0, near.y);
  dg.addColorStop(0, `rgba(${gc.shade},0.20)`);
  dg.addColorStop(0.55, `rgba(${gc.shade},0)`);
  dg.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.fillStyle = dg;
  ctx.fillRect(0, 0, w, h);

  // bercak organik (tint per-map, bernapas mengikuti denyut)
  const spots = 26;
  for (let i = 0; i < spots; i++) {
    const a = hash2(i * 7 + 1, i * 3 + 2) * Math.PI * 2;
    const rr = Math.sqrt(hash2(i * 11 + 5, i * 13 + 7)) * (270 * 0.86);
    const wx = Math.cos(a) * rr, wy = Math.sin(a) * rr;
    const q = P.project(wx, wy);
    const srad = 18 + hash2(i + 40, i + 41) * 46;
    const pulse = 0.75 + 0.25 * Math.sin(time * 0.8 + i * 1.7) + beatA * 0.15;
    ctx.fillStyle = i % 3 === 0 ? `rgba(${gc.spotA},${(0.16 * pulse).toFixed(3)})` : `rgba(${gc.spotB},${(0.22 * pulse).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, srad * q.s * pulse, srad * q.s * pulse * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // detail tanah: sel/serat kecil terproyeksi (khas tiap organ)
  for (let i = 0; i < 44; i++) {
    const a = hash2(i * 3 + 91, i * 5 - 7) * Math.PI * 2;
    const rr = Math.sqrt(hash2(i * 7 + 13, i * 11 + 29)) * 250;
    const q = P.project(Math.cos(a) * rr, Math.sin(a) * rr);
    const s = (3 + hash2(i + 61, i + 67) * 5) * q.s;
    ctx.fillStyle = `rgba(${gc.detail},${(0.10 + hash2(i + 71, i + 73) * 0.10).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, s, s * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // tepi berbulu: bayangan dalam lebar (lembut, bukan ring keras)
  ctx.strokeStyle = `rgba(${gc.shade},0.16)`;
  ctx.lineWidth = 26;
  traceBlob3D(ctx, P, 0, 0, 270);
  ctx.stroke();
  ctx.restore();

  // garis napas tepi: tipis + kilau denyut (satu-satunya garis, sangat subtle)
  ctx.strokeStyle = PALETTE.hexEdge || '#e9dfc0';
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  traceBlob3D(ctx, P, 0, 0, 266);
  ctx.stroke();
  if (beatA > 0.02) {
    ctx.globalAlpha = Math.min(0.45, beatA * 0.35);
    ctx.lineWidth = 5;
    traceBlob3D(ctx, P, 0, 0, 266);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
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
