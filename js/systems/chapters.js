/**
 * chapters.js — Status bab Peta Tubuh (V2: dipakai slideshow dashboard).
 *
 * Dipisah dari campaign-screen.js karena model "stage select → briefing →
 * battle prep" DIBUANG di V2 (PHAGOS_V2_REBUILD.txt §21). Yang tersisa hanya
 * penentu bab aktif/terkunci, dipakai slideshow peta tubuh di dashboard.
 * Sumber data: data/campaign.json → chapters[] (termasuk foto `art`).
 */

import { getData } from '../core/data-store.js';

export function chapters() {
  return getData().campaign.chapters;
}

/** Bab yang sedang aktif (bab pertama yang belum tamat). */
export function currentChapterId(meta) {
  const cleared = meta.campaignCleared || {};
  const list = chapters();
  const next = list.find((c) => cleared[c.id] === undefined);
  return next ? next.id : list[list.length - 1].id;
}

/** Status satu bab: 'cleared' | 'current' | 'locked'. */
export function chapterStatus(ch, meta) {
  const cleared = meta.campaignCleared || {};
  if (cleared[ch.id] !== undefined) return 'cleared';
  return currentChapterId(meta) === ch.id ? 'current' : 'locked';
}

/**
 * Normalisasi pilihan run yang masih dipakai engine (mode/tier/fokus).
 * Dipindah dari prep-screen.js karena layar "battle prep" DIBUANG di V2 §21:
 * pemain tidak lagi ditanya mode/bab/arena sebelum run.
 * @returns {boolean} true bila ada nilai yang dinormalisasi
 */
export function applyRunDefaults(meta, writeSaveFn) {
  let changed = false;
  if (meta.selectedMode !== 'kampanye') { meta.selectedMode = 'kampanye'; changed = true; }
  if (!['normal', 'sulit', 'brutal'].includes(meta.selectedTier)) { meta.selectedTier = 'normal'; changed = true; }
  if (meta.focusRun !== 'seimbang') { meta.focusRun = 'seimbang'; changed = true; }
  if (!meta.selectedChapter) {
    const list = chapters();
    meta.selectedChapter = (list[0] && list[0].id) || null;
    changed = true;
  }
  if (changed && writeSaveFn) writeSaveFn(meta);
  return changed;
}
