/**
 * narrative-system.js — R2 (Rebuild): barks RIA runtime.
 *
 * RIA (Respons Imun Adaptif) = pemandu mikro dua-lapis (story doc §3.2):
 * satu karakter untuk tutorial DAN story — hemat produksi, konsisten suara.
 * Modul ini menangani barks non-blocking saat gameplay:
 *  - bossBark(chapterId): 3-5 dtk sebelum/saat boss bab muncul (doc §7.3)
 *  - runEndBark(victory): 1 baris kontekstual di layar hasil, bervariasi
 * Semua copy dari data/narrative.json — konten baru = data baru.
 */

import { getNarrative } from '../core/data-store.js';
import { emit } from '../core/ui-bridge.js';

let bossBarkShownForRun = false;

/** Reset penanda per-run (dipanggil saat runstart). */
export function resetNarrativeRun() {
  bossBarkShownForRun = false;
}

/**
 * Bark RIA saat boss bab muncul — maks 1× per run, non-blocking (toast).
 * @returns {string|null} teks bark (null bila sudah tampil run ini)
 */
export function bossBark(chapterId) {
  if (bossBarkShownForRun) return null;
  const n = getNarrative();
  if (!n) return null;
  const text = (n.bossBarks && (n.bossBarks[chapterId] || n.bossBarks.default)) || null;
  if (!text) return null;
  bossBarkShownForRun = true;
  emit('toast', { message: text, kind: 'ria' });
  return text;
}

/**
 * Bark RIA 1 baris untuk layar hasil (menang/kalah) — variasi round-robin
 * berbasis jumlah run agar tidak monoton.
 * @returns {string} teks bark
 */
export function runEndBark(victory, totalRuns = 0) {
  const n = getNarrative();
  if (!n) return '';
  const pool = victory ? (n.winBarks || []) : (n.loseBarks || []);
  if (!pool.length) return '';
  return pool[totalRuns % pool.length];
}

/** Nama pemandu (untuk header coach / UI). */
export function guideName() {
  const n = getNarrative();
  return n && n.guide ? n.guide : { name: 'RIA', full: 'Respons Imun Adaptif' };
}
