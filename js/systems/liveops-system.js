/**
 * liveops-system.js — Fase 7: Konten & Liveops.
 *
 * - Mutator harian: dipilih via SEEDED RNG (mulberry32) dari tanggal kalender —
 *   semua pemain di tanggal yang sama mendapat mutator yang sama, tanpa server.
 * - Mode unlock: Klasik default; Endless terbuka setelah menang Klasik.
 * - Leaderboard lokal: top-10 run per mode, diurut wave → waktu → kill.
 *
 * Semua definisi (daftar mutator, mode) datang dari data/*.json — konten baru
 * = data baru, bukan kode baru.
 */

import { getData } from '../core/data-store.js';
import { isDevMode } from '../core/dev-mode.js';

/** PRNG deterministik mulberry32 (32-bit). @returns {() => number} rng 0..1 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash string → seed 32-bit (djb2). */
export function hashDateSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Tanggal lokal hari ini dalam format YYYY-MM-DD. */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Mutator untuk tanggal tertentu — deterministik (seeded dari tanggal).
 * @returns {object} definisi mutator dari data/mutators.json
 */
export function getMutatorForDate(dateStr) {
  const mutators = getData().mutators.mutators;
  const rng = mulberry32(hashDateSeed(dateStr));
  const idx = Math.floor(rng() * mutators.length) % mutators.length;
  return mutators[idx];
}

/** Mutator hari ini + tanggalnya. */
export function getTodayMutator() {
  const date = todayStr();
  return { date, def: getMutatorForDate(date) };
}

/** Status unlock mode (default / winNormal). */
export function getModeUnlockStatus(modeDef, meta) {
  if (isDevMode()) return { unlocked: true, label: 'DEV MODE' };
  const type = (modeDef.unlock && modeDef.unlock.type) || 'default';
  if (type === 'default') return { unlocked: true, label: '' };
  if (type === 'winNormal') {
    return (meta.stats && meta.stats.wins) > 0
      ? { unlocked: true, label: '' }
      : { unlocked: false, label: 'Menangkan mode Klasik' };
  }
  return { unlocked: false, label: 'Terkunci' };
}

/**
 * Gabungkan mods mutator ke mods run (perk-bijaksana; kunci baru mulai dari 1).
 * mods berlaku di applyBodyModifiers (game.js) — satu jalur modifier untuk
 * kondisi tubuh maupun mutator.
 */
export function mergeMutatorMods(mods, mutatorMods) {
  if (!mutatorMods) return mods;
  for (const [k, v] of Object.entries(mutatorMods)) {
    mods[k] = (mods[k] !== undefined ? mods[k] : 1) * v;
  }
  return mods;
}

/**
 * Catat 1 run ke leaderboard lokal (per mode), keep top-10.
 * Urutan: wave tertinggi → waktu terlama → kill terbanyak.
 * @returns {{isNewBest: boolean}} true bila entry ini jadi #1
 */
export function recordLeaderboardEntry(meta, entry) {
  if (!meta.leaderboard) meta.leaderboard = [];
  const modeId = entry.modeId || 'normal';
  let bucket = meta.leaderboard.find((l) => l.mode === modeId);
  if (!bucket) {
    bucket = { mode: modeId, runs: [] };
    meta.leaderboard.push(bucket);
  }
  bucket.runs.push(entry);
  bucket.runs.sort((a, b) => b.wave - a.wave || b.time - a.time || b.kills - a.kills);
  if (bucket.runs.length > 10) bucket.runs.length = 10;
  return { isNewBest: bucket.runs[0] === entry };
}

/** Ambil daftar run leaderboard untuk mode (array, terbaik dulu). */
export function getLeaderboard(meta, modeId) {
  const bucket = (meta.leaderboard || []).find((l) => l.mode === modeId);
  return bucket ? bucket.runs : [];
}
