/**
 * weekly-strain-system.js — ADDENDUM §3.5: Strain of the Week.
 *
 * Setiap Senin (minggu Unix), satu trait mutasi musuh aktif GLOBAL untuk
 * semua pemain — pengalaman bersama, build mingguan berbeda, bahan konten.
 * Bukan server-side: seed murni dari tanggal → deterministik di semua klien.
 * Diterapkan ke 15% musuh mulai wave 4 (lihat maybeApplyTrait).
 */

import { getData } from '../core/data-store.js';

/** Trait yang boleh jadi strain mingguan (acak_bermutasi dikecualikan). */
const WEEKLY_POOL = [
  'penembak_asam',
  'kebal_membran',
  'beracun_saat_diserap',
  'kebal_knockback',
  'pemurni',
];

/** Indeks minggu Unix (berapa Senin sejak epoch). */
export function currentWeekIndex(nowMs) {
  const t = typeof nowMs === 'number' ? nowMs : Date.now();
  return Math.floor(t / 604800000);
}

/** Id trait strain minggu ini (deterministik dari tanggal). */
export function currentStrainId(nowMs) {
  const pool = WEEKLY_POOL.filter((id) => traitExists(id));
  const list = pool.length > 0 ? pool : WEEKLY_POOL;
  return list[currentWeekIndex(nowMs) % list.length];
}

/** Apakah trait ada di data enemy-mutations (guard data usang)? */
function traitExists(id) {
  try {
    const traits = (getData().enemyMutations && getData().enemyMutations.traits) || [];
    return traits.some((t) => t.id === id);
  } catch {
    return true;
  }
}

/** Peluang strain mingguan per musuh (15%) & wave minimum (4). */
export const WEEKLY_STRAIN_CHANCE = 0.15;
export const WEEKLY_STRAIN_MIN_WAVE = 4;
