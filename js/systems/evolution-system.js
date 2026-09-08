/**
 * evolution-system.js — Evolusi hero berbasis drop bagian (parts) dari musuh.
 *
 * Hero berevolusi 5 tahap (Common → Legendary). Setiap tahap butuh kombinasi
 * bagian (silia/pseudopodia/mikropedang/inti_elemen) yang di-drop musuh saat
 * pertempuran — jadi visual & kekuatan hero berubah sebanding rajinnya user
 * bermain. Tahap membuka: mult damage/HP (nyata di computePlayerStats), gaya
 * efek kill, satu kemampuan aktif (lihat ability-system.js).
 */

import { getData } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';

export function getEvoStageDef(meta = STATE.meta) {
  const stage = meta.evoStage || 0;
  return getData().evolutions.stages.find((s) => s.stage === stage)
    || getData().evolutions.stages[0];
}

export function getNextEvoStageDef(meta = STATE.meta) {
  const stage = meta.evoStage || 0;
  return getData().evolutions.stages.find((s) => s.stage === stage + 1) || null;
}

export function getPartDef(partId) {
  return getData().evolutions.parts.find((p) => p.id === partId) || null;
}

/** Apakah bagian meta.evoParts cukup untuk evolusi ke tahap berikutnya? */
export function canEvolve(meta = STATE.meta) {
  const next = getNextEvoStageDef(meta);
  if (!next) return false;
  return Object.entries(next.cost).every(([partId, need]) => (meta.evoParts[partId] || 0) >= need);
}

/** Konsumsi bagian & naikkan tahap. @returns {object|null} stage baru bila sukses. */
export function evolve(meta = STATE.meta) {
  if (!canEvolve(meta)) return null;
  const next = getNextEvoStageDef(meta);
  for (const [partId, need] of Object.entries(next.cost)) {
    meta.evoParts[partId] -= need;
  }
  meta.evoStage = next.stage;
  writeSave(meta);
  return next;
}

/** Id kemampuan aktif yang terbuka pada tahap sekarang (kumulatif). */
export function getUnlockedAbilityIds(meta = STATE.meta) {
  const stage = meta.evoStage || 0;
  return getData().evolutions.stages
    .filter((s) => s.stage <= stage && s.ability)
    .map((s) => s.ability);
}

/**
 * Status kandidat drop bagian dari musuh.
 * @param {'normal'|'elite'|'boss'} kind
 * @param {number} partMult pengali arena
 */
export function rollPartDrop(kind, partMult, rng = Math.random) {
  const evo = getData().evolutions;
  let chance = 0;
  if (kind === 'normal') chance = evo.dropChanceNormal;
  else if (kind === 'elite') chance = evo.dropChanceElite;
  else chance = 1; // boss selalu
  if (rng() > chance * partMult) return null;
  // boss: beberapa drop sekaligus ditangani pemanggil (bossGuaranteedParts)
  const total = evo.parts.reduce((a, p) => a + p.dropWeight, 0);
  let roll = rng() * total;
  for (const p of evo.parts) {
    roll -= p.dropWeight;
    if (roll <= 0) return p.id;
  }
  return evo.parts[0].id;
}
