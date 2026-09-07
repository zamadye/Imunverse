/**
 * metrics.js — V2 Phase 0: instrumen KPI gameplay lokal (tanpa server).
 *
 * Merekam ringkasan SETIAP run ke localStorage (ring buffer 200 run) supaya
 * keputusan balancing V2 berbasis data, bukan tebakan. Metrik kunci:
 *  - one-more-run rate : run yang dimulai ≤120 dtk setelah gameover
 *                        sebelumnya ditandai `retryOf` (Hukum V2).
 *  - median wave/time  : death point & durasi run.
 *  - distribusi hero   : play-rate per hero.
 *
 * PASIF TOTAL: hanya subscribe event bus (runstart/gameover) — tidak
 * menyentuh game.js maupun save utama. Gagal storage → silent no-op.
 */

import { on } from '../core/ui-bridge.js';
import { STATE } from '../core/state-manager.js';

const KEY = 'imunverse.metrics.v1';
const MAX_RUNS = 200;
const RETRY_WINDOW_MS = 120000; // ≤2 menit setelah gameover = "satu run lagi"

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.runs)) return parsed;
  } catch { /* rusak → mulai baru */ }
  return { runs: [], lastGameoverAt: 0 };
}

function write(db) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch { /* storage penuh/blokir — metrics bukan alasan game rusak */ }
}

let pendingStart = null; // {t, hero, mode, retryOf} — diisi runstart, ditutup gameover

/** Pasang listener sekali dari main.js (setelah data & save siap). */
export function initMetrics() {
  on('runstart', ({ heroDef } = {}) => {
    const db = read();
    const now = Date.now();
    pendingStart = {
      t: now,
      hero: heroDef ? heroDef.id : (STATE.meta && STATE.meta.selectedHero) || null,
      mode: (STATE.meta && STATE.meta.selectedMode) || 'normal',
      retryOf: db.lastGameoverAt && now - db.lastGameoverAt <= RETRY_WINDOW_MS
        ? db.lastGameoverAt : null,
    };
  });

  on('gameover', (summary = {}) => {
    const db = read();
    const start = pendingStart || { t: Date.now(), hero: null, mode: 'normal', retryOf: null };
    pendingStart = null;
    db.runs.push({
      t: start.t,
      hero: start.hero,
      mode: summary.modeId || start.mode,
      wave: summary.wave || 0,
      time: summary.time || 0,
      kills: summary.kills || 0,
      level: summary.level || 1,
      victory: !!summary.victory,
      quit: !!summary.quit,
      retryOf: start.retryOf,
    });
    if (db.runs.length > MAX_RUNS) db.runs.splice(0, db.runs.length - MAX_RUNS);
    db.lastGameoverAt = Date.now();
    write(db);
  });
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Ringkasan KPI untuk Phase 11 / debugging.
 * @returns {{runs:number, oneMoreRunRate:number, medianWave:number,
 *            medianTime:number, victoryRate:number, heroDist:object}}
 */
export function getMetricsSummary() {
  const db = read();
  const runs = db.runs;
  const retries = runs.filter((r) => r.retryOf !== null).length;
  const heroDist = {};
  for (const r of runs) {
    const h = r.hero || '?';
    heroDist[h] = (heroDist[h] || 0) + 1;
  }
  return {
    runs: runs.length,
    // pembagi = gameover yang PUNYA kesempatan retry (semua kecuali run terakhir)
    oneMoreRunRate: runs.length > 1 ? retries / (runs.length - 1) : 0,
    medianWave: median(runs.map((r) => r.wave)),
    medianTime: median(runs.map((r) => r.time)),
    victoryRate: runs.length ? runs.filter((r) => r.victory).length / runs.length : 0,
    heroDist,
  };
}

/** Reset metrics (dipakai testing / opsi dev). */
export function clearMetrics() {
  try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
}
