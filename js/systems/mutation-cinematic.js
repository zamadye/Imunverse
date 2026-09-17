/**
 * mutation-cinematic.js — P2 §9: MUTATION CINEMATIC.
 *
 * Mutasi bukan popup stat: permainan BERHENTI SEJENAK, energi mengumpul,
 * bentuk lama PECAH, lalu bentuk baru muncul dan run berlanjut.
 *
 *   pause → charge → break → reveal → resume
 *
 * Semua durasi dibaca dari data/evolutions.json → cinematic (nol angka di js/).
 * Yang digambar tetap FOTO karakter (`from` → `to`) — pecahannya partikel
 * prosedural, BUKAN sprite tempelan.
 *
 * SKIP VALID: tombol LEWATI aktif setelah `skipAfterSec` (0,2 s). Melompat
 * tidak menghukum pemain — mutasi sudah diterapkan SEBELUM sinematik mulai,
 * jadi melewati adegan hanya mempercepat, tidak mengurangi apa pun.
 */

import { getData } from '../core/data-store.js';
import { drawSprite, hasSprite } from '../render/sprite-loader.js';
import { audio } from './audio-system.js';

const DEF_PHASES = [
  { id: 'pause', durSec: 0.25 },
  { id: 'charge', durSec: 0.85 },
  { id: 'break', durSec: 0.35 },
  { id: 'reveal', durSec: 0.95 },
  { id: 'resume', durSec: 0.25 },
];

let CINE = null;
let tombol = null;

function cfg() {
  const c = (getData() && getData().evolutions && getData().evolutions.cinematic) || {};
  const phases = Array.isArray(c.phases) && c.phases.length ? c.phases : DEF_PHASES;
  return {
    phases: phases.map((p) => ({ id: p.id, durSec: typeof p.durSec === 'number' ? p.durSec : 0.4 })),
    skipAfterSec: typeof c.skipAfterSec === 'number' ? c.skipAfterSec : 0.2,
    shakeAmp: typeof c.shakeAmp === 'number' ? c.shakeAmp : 6,
    shardCount: typeof c.shardCount === 'number' ? c.shardCount : 14,
  };
}

/** Apakah sinematik mutasi sedang berjalan? */
export function cineActive() {
  return !!(CINE && !CINE.done);
}

/** Fase sekarang (untuk HUD/penguji). */
export function cinePhase() {
  return CINE && !CINE.done ? CINE.phases[CINE.idx].id : null;
}

/** Total durasi sinematik (detik) — dipakai penguji. */
export function cineDuration() {
  return cfg().phases.reduce((a, p) => a + p.durSec, 0);
}

/** Progres 0..1 dari seluruh adegan. */
export function cineProgress() {
  if (!CINE) return 0;
  const total = CINE.phases.reduce((a, p) => a + p.durSec, 0);
  let done = 0;
  for (let i = 0; i < CINE.idx; i++) done += CINE.phases[i].durSec;
  return Math.max(0, Math.min(1, (done + CINE.t) / total));
}

function buatTombol() {
  if (tombol || typeof document === 'undefined') return;
  tombol = document.createElement('button');
  tombol.id = 'muta-cine-skip';
  tombol.className = 'muta-cine-skip';
  tombol.type = 'button';
  tombol.textContent = 'LEWATI ▸';
  tombol.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    skipCinematic('tombol');
  });
  document.body.appendChild(tombol);
}

function hapusTombol() {
  if (tombol && tombol.parentNode) tombol.parentNode.removeChild(tombol);
  tombol = null;
}

/**
 * Mulai sinematik mutasi.
 * @param {object} o {from, to, name, stageName, tierColor, onDone}
 */
export function startMutationCinematic(o = {}) {
  const c = cfg();
  CINE = {
    phases: c.phases,
    idx: 0,
    t: 0,
    elapsed: 0,
    from: o.from || null,
    to: o.to || null,
    name: o.name || 'MUTASI',
    stageName: o.stageName || '',
    tierColor: o.tierColor || '#8df7d2',
    shards: [],
    onDone: typeof o.onDone === 'function' ? o.onDone : null,
    done: false,
    skipAfter: c.skipAfterSec,
    shakeAmp: c.shakeAmp,
    shardCount: c.shardCount,
    skipped: false,
    flashed: false,
  };
  buatTombol();
  return CINE;
}

/** Lewati adegan — VALID: mutasi sudah diterapkan, jadi tidak ada yang hilang. */
export function skipCinematic() {
  if (!CINE || CINE.done) return false;
  CINE.skipped = true;
  selesai();
  return true;
}

function selesai() {
  if (!CINE || CINE.done) return;
  CINE.done = true;
  hapusTombol();
  const cb = CINE.onDone;
  CINE = null;
  if (cb) { try { cb(); } catch { /* jangan biarkan sinematik menjatuhkan game */ } }
}

function pecahkan() {
  const n = CINE.shardCount;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    CINE.shards.push({
      a,
      r: 8 + Math.random() * 10,
      v: 90 + Math.random() * 150,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 6,
      size: 5 + Math.random() * 9,
    });
  }
}

/** Satu langkah sinematik; dipanggil dari loop utama ( dunia sedang beku ). */
export function updateMutationCinematic(dt) {
  if (!CINE || CINE.done) return;
  CINE.elapsed += dt;
  CINE.t += dt;
  let guard = 0;
  while (CINE && !CINE.done && guard++ < 8) {
    const dur = CINE.phases[CINE.idx].durSec;
    if (CINE.t < dur) break;
    CINE.t -= dur;
    if (CINE.idx >= CINE.phases.length - 1) { selesai(); return; }
    CINE.idx += 1;
    const id = CINE.phases[CINE.idx].id;
    if (id === 'break') {
      pecahkan();
      try { audio.evolve(); } catch { /* audio opsional */ }
    }
  }
}

function alphaOverlay(fase, t, dur) {
  const p = dur > 0 ? Math.min(1, t / dur) : 1;
  if (fase === 'pause') return 0.15 + p * 0.45;
  if (fase === 'charge') return 0.6 + p * 0.2;
  if (fase === 'break') return 0.8;
  if (fase === 'reveal') return 0.8 - p * 0.45;
  return Math.max(0, 0.35 * (1 - p)); // resume
}

function gambarFoto(ctx, path, cx, cy, size, alpha, scale) {
  if (!path || !hasSprite(path)) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  drawSprite(ctx, path, cx, cy, size * scale, 0, {});
  ctx.restore();
}

/** Gambar adegan di atas dunia yang sedang dibekukan. */
export function drawMutationCinematic(ctx, w, h, time = 0) {
  if (!CINE || CINE.done) return;
  const fase = CINE.phases[CINE.idx].id;
  const dur = CINE.phases[CINE.idx].durSec;
  const t = CINE.t;
  const p = dur > 0 ? Math.min(1, t / dur) : 1;
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.min(w, h) * 0.34;

  // 1. Redupkan dunia
  const a = alphaOverlay(fase, t, dur);
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, Math.max(w, h) * 0.75);
  g.addColorStop(0, `rgba(4,16,20,${a * 0.55})`);
  g.addColorStop(1, `rgba(2,8,12,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2. Cincin energi mengerucut (charge) / melebar (reveal)
  if (fase === 'charge' || fase === 'reveal') {
    const shrink = fase === 'charge';
    const rr = shrink ? size * (1.5 - p * 0.75) : size * (0.35 + p * 1.25);
    ctx.save();
    ctx.globalAlpha = shrink ? 0.25 + p * 0.5 : Math.max(0, 0.8 - p * 0.7);
    ctx.strokeStyle = CINE.tierColor;
    ctx.lineWidth = 2 + p * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Foto: bentuk lama → pecah → bentuk baru
  if (fase === 'pause' || fase === 'charge') {
    gambarFoto(ctx, CINE.from, cx, cy, size, 1, 1 - p * 0.12);
    // kilau energi yang makin terang
    ctx.save();
    ctx.globalAlpha = 0.15 + p * 0.5;
    ctx.fillStyle = CINE.tierColor;
    ctx.beginPath();
    ctx.arc(cx, cy, size * (0.55 - p * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (fase === 'break') {
    // Bentuk lama hilang, pecahan terbang keluar
    gambarFoto(ctx, CINE.from, cx, cy, size, Math.max(0, 0.5 - p * 0.5), 1 - p * 0.25);
    for (const s of CINE.shards) {
      const d = s.r + p * s.v;
      const x = cx + Math.cos(s.a) * d;
      const y = cy + Math.sin(s.a) * d;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.rot + p * s.vr);
      ctx.globalAlpha = Math.max(0, 0.9 - p * 0.9);
      ctx.fillStyle = CINE.tierColor;
      ctx.beginPath();
      ctx.moveTo(-s.size * 0.5, -s.size * 0.4);
      ctx.lineTo(s.size * 0.6, -s.size * 0.1);
      ctx.lineTo(0, s.size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (p < 0.35) {
      ctx.save();
      ctx.globalAlpha = 1 - p / 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  } else if (fase === 'reveal' || fase === 'resume') {
    const pop = p < 0.4 ? 0.62 + (p / 0.4) * 0.46 : 1.08 - ((p - 0.4) / 0.6) * 0.08;
    gambarFoto(ctx, CINE.to, cx, cy, size, 1, pop);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.5 - p * 0.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, size * (0.4 + p * 0.9), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Teks: nama mutasi + tahap evolusi
  if (fase === 'reveal' || fase === 'resume') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = fase === 'reveal' ? Math.min(1, p * 3) : Math.max(0, 1 - p * 1.4);
    ctx.fillStyle = '#eafff8';
    ctx.font = `700 ${Math.round(Math.min(w, h) * 0.045)}px system-ui, sans-serif`;
    ctx.fillText(CINE.name.toUpperCase(), cx, cy + size * 0.95);
    if (CINE.stageName) {
      ctx.fillStyle = CINE.tierColor;
      ctx.font = `800 ${Math.round(Math.min(w, h) * 0.032)}px system-ui, sans-serif`;
      ctx.fillText(CINE.stageName.toUpperCase(), cx, cy + size * 1.28);
    }
    ctx.restore();
  }

  // 5. Penanda LEWATI (kanvas) — tombol DOM-nya menempel di atasnya
  if (CINE.elapsed >= CINE.skipAfter) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eafff8';
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.026)}px system-ui, sans-serif`;
    ctx.fillText('Tekan LEWATI untuk langsung bertempur', cx, h - Math.max(46, h * 0.09));
    ctx.restore();
  }
  void time;
}

/** Untuk penguji: bersihkan sisa adegan. */
export function resetCinematic() {
  hapusTombol();
  CINE = null;
}
