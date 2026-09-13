/**
 * daily-reset.js — Fase 2.5: "kapan harian saya reset?" dalam SATU modul murni.
 *
 * Semua fitur harian di game ini memakai KUNCI TANGGAL UTC yang sama:
 *   • mission-system.js   → `d:${now.toISOString().slice(0, 10)}`
 *   • monetization.js     → kuota iklan per tanggal UTC
 *   • imun-economy.js     → dayKey drip
 *   • body-system.js      → todayStr peluruhan
 *   • battlepass-system.js→ todayKey
 * Karena itu batas reset harian = TENGAH MALAM UTC BERIKUTNYA. Modul ini
 * menurunkan angka dari konvensi tersebut — tidak ada jam reset karangan,
 * dan tidak ada angka keras: ambang "segera" dibaca dari
 * data/retention-config.json → dailyAnchor.warnWhenHoursLeft.
 *
 * Murni (tidak menyentuh DOM/STATE) → aman diuji headless.
 */

import { getRetentionConfig } from '../core/data-store.js';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/**
 * Anchor harian dari data/retention-config.json (dailyAnchor).
 * Default dipakai HANYA bila field absen — nilai sumber tetap data.
 */
export function getDailyAnchor() {
  const a = (getRetentionConfig() || {}).dailyAnchor || {};
  return {
    showCountdown: a.showCountdown !== false,
    surfaces: Array.isArray(a.countdownSurfaces) && a.countdownSurfaces.length
      ? a.countdownSurfaces
      : ['dashboard', 'gameover', 'hud-mission-panel'],
    warnHours: typeof a.warnWhenHoursLeft === 'number' && a.warnWhenHoursLeft >= 0
      ? a.warnWhenHoursLeft
      : 4,
  };
}

/**
 * Info hitung mundur reset harian pada waktu `now` (ms epoch).
 * @returns {{showCountdown:boolean, surfaces:string[], warnHours:number,
 *            resetTs:number, msLeft:number, hoursLeft:number,
 *            urgent:boolean, hms:string}}
 */
export function getDailyResetInfo(now = Date.now()) {
  const anchor = getDailyAnchor();
  const d = new Date(now);
  // Tengah malam UTC berikutnya — tanggal UTC +1, jam/menit/detik = 0.
  const resetTs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  const msLeft = Math.min(DAY_MS, Math.max(0, resetTs - now));
  const hoursLeft = msLeft / HOUR_MS;
  return {
    ...anchor,
    resetTs,
    msLeft,
    hoursLeft,
    urgent: hoursLeft < anchor.warnHours, // "kurang dari" — persis di ambang TIDAK urgent
    hms: formatCountdown(msLeft),
  };
}

/** mm/jam selalu 2 digit: 3661000 ms → "01:01:01". Sisa < 1 detik → "00:00:00". */
export function formatCountdown(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
