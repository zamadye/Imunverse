/**
 * walk-anim.js — Animasi jalan 8 arah (rebuild karakter hero & virus).
 *
 * Spesifikasi pemilik game:
 *  - Siklus jalan digambar ulang untuk 5 arah UNIK: Depan (S), Belakang (N),
 *    Samping (E), dan dua diagonal (NE, SE) — sheet assets/sprites/walk/
 *    (grid 5 kolom x 4 frame, dikonfigurasi di data/walk-anim.json).
 *  - Arah W, NW, SW TIDAK disimpan — di-mirror horizontal di runtime
 *    (W=E, NW=NE, SW=SE). Memakai sheet yang sama = kualitas sama.
 *  - Input joystick/gerak TETAP kontinu 360°. Hanya ANIMASI yang dibulatkan
 *    ke kelipatan 45° terdekat (8 pilihan visual) — karakter bergerak bebas.
 *  - Timing gerak ALAMI beda per arah (bukan sekadar rotasi gambar):
 *    bob/lunge/squash berbeda di gambar, dan tempo siklusnya berbeda lewat
 *    `dirSpeed` (data/walk-anim.json) — langkah samping lebih panjang
 *    (lebih lambat) daripada bob maju-mundur.
 */

import { drawSheetCell } from './sprite-loader.js';

// Konvensi screen (y-down): angle = atan2(dy, dx) — 0° = E, +90° = S, +180° = W.
// Index arah = round(angle / 45°) mod 8.
export const DIR8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

// Arah → kolom sumber sheet (5 unik) + apakah perlu mirror horizontal.
const MIRROR_SRC = { E: 'E', SE: 'SE', S: 'S', SW: 'SE', W: 'E', NW: 'NE', N: 'N', NE: 'NE' };
const IS_MIRROR = new Set(['W', 'NW', 'SW']);

/**
 * Bulatkan sudut kontinu (rad, screen y-down) ke index 8 arah terdekat.
 * Contoh: 30° → 1 (SE), 315° → 7 (NE), -135° → 5 (NW).
 */
export function snapDirIndex(angle) {
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

/**
 * Arah mana pun → { col (index kolom sheet), mirror }.
 * @param {number} dirIndex 0..7 (lihat DIR8)
 * @param {string[]} sheetDirections kolom sheet, mis. ["E","NE","N","SE","S"]
 */
export function resolveDirection(dirIndex, sheetDirections) {
  const name = DIR8[dirIndex] || 'S';
  return { col: sheetDirections.indexOf(MIRROR_SRC[name]), mirror: IS_MIRROR.has(name) };
}

/**
 * Fase siklus [0..1) → index frame (0..frames-1).
 * phase bertambah oleh entitas saat bergerak (lihat player.js/enemy.js).
 */
export function walkFrame(phase, frames) {
  const p = ((phase % 1) + 1) % 1;
  return Math.min(frames - 1, Math.floor(p * frames));
}

/** Pengali tempo siklus per arah (mirror mengwarisi tempo arah sumbernya). */
export function dirCycleSpeed(dirIndex, dirSpeed) {
  const name = DIR8[dirIndex] || 'S';
  return dirSpeed?.[MIRROR_SRC[name]] ?? 1;
}

/**
 * Ambil konfigurasi walk untuk satu karakter.
 * @returns {?{sheet:string, fps:number, frames:number, cols:number, dirSpeed:object}}
 */
export function walkCfg(set, id, walkAnim, defaultFps = 6) {
  const entry = walkAnim?.[set]?.[id];
  if (!walkAnim || !entry?.sheet) return null;
  return {
    sheet: entry.sheet,
    fps: entry.fps ?? defaultFps ?? 6,
    frames: walkAnim.frames || 4,
    cols: (walkAnim.sheetDirections || []).length || 5,
    dirSpeed: walkAnim.dirSpeed || {},
  };
}

/**
 * Gambar satu frame walk + kembalikan info sel (untuk debug/e2e).
 * Jika cfg null (karakter tanpa sheet) — tidak menggambar apa pun.
 */
export function drawWalkFrame(ctx, cfg, sheetDirections, x, y, size, dirIndex, phase, opts = {}) {
  const { col, mirror } = resolveDirection(dirIndex, sheetDirections);
  const row = walkFrame(phase, cfg ? cfg.frames : 4);
  const info = { col, row, mirror, dirIndex };
  if (!cfg || !cfg.sheet) return info;
  drawSheetCell(ctx, cfg.sheet, x, y, size, col, row, cfg.cols, cfg.frames, {
    mirror,
    image: opts.image,          // override gambar (mis. canvas tint skin)
    alpha: opts.alpha,
    flash: opts.flash,
    flashColor: opts.flashColor,
  });
  return info;
}
